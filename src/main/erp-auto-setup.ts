// ERP AutoSetup — 电商 ERP 一键检测→下载→安装→配置
// 安全策略：所有安装操作需 L3 用户二次确认，禁止静默安装未知来源软件
//
// 支持三种安装方式（按优先级）：
//   1. winget install（Windows 包管理器，最安全）
//   2. 官方安装包下载 + msiexec/exe 安装
//   3. Web 版引导（无需安装，浏览器访问）

import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { ipcRateLimit } from './safe-path'

// ────────────────────── ERP 注册表 ──────────────────────

export interface ErpDefinition {
  id: string
  name: string
  category: 'erp' | 'cs_tool' | 'office'
  zone: 'safe' | 'readonly' | 'banned'
  /** winget 包名（优先使用） */
  wingetId?: string
  /** 官方下载页面 */
  downloadUrl: string
  /** 直接下载链接（安装包） */
  directDownloadUrl?: string
  /** Web 版入口（无需安装） */
  webUrl?: string
  /** 安装包 SHA256（可选，用于校验） */
  installerHash?: string
  /** 安装类型 */
  installerType?: 'msi' | 'exe' | 'nsis'
  /** 静默安装参数 */
  silentArgs?: string[]
  /** Windows 进程名（检测是否已安装/运行） */
  processNames: string[]
  /** Windows 注册表检测路径 */
  registryPaths?: string[]
  /** 推荐配置说明 */
  configGuide: string
}

const ERP_REGISTRY: ErpDefinition[] = [
  // ────── 安全区 ERP（AI 可读写）──────
  {
    id: 'jushuitan',
    name: '聚水潭 ERP',
    category: 'erp',
    zone: 'safe',
    downloadUrl: 'https://www.jushuitan.com/download',
    webUrl: 'https://erp.jushuitan.com',
    processNames: ['jushuitan', 'JST'],
    registryPaths: ['HKLM\\SOFTWARE\\JuShuiTan', 'HKCU\\SOFTWARE\\JuShuiTan'],
    configGuide: '登录后在「系统设置→开放平台」中获取 AppKey，配置到 MBE Desktop 方案设置',
  },
  {
    id: 'wangdiantong',
    name: '旺店通 ERP',
    category: 'erp',
    zone: 'safe',
    downloadUrl: 'https://www.wangdian.cn/download',
    webUrl: 'https://erp.wangdian.cn',
    processNames: ['wangdiantong', 'WDT'],
    registryPaths: ['HKLM\\SOFTWARE\\WangDianTong'],
    configGuide: '登录后在「设置→API 授权」中生成密钥，配置到 MBE Desktop 方案设置',
  },
  {
    id: 'guanyiyun',
    name: '管易云 ERP',
    category: 'erp',
    zone: 'safe',
    downloadUrl: 'https://www.guanyiyun.com/download',
    webUrl: 'https://cloud.guanyierp.com',
    processNames: ['guanyiyun', 'GYY'],
    registryPaths: ['HKLM\\SOFTWARE\\GuanYiCloud'],
    configGuide: '登录后在「系统管理→接口管理」中获取授权信息',
  },

  // ────── 只读区客服工具 ──────
  {
    id: 'qianniu',
    name: '千牛工作台',
    category: 'cs_tool',
    zone: 'readonly',
    downloadUrl: 'https://work.taobao.com/download',
    processNames: ['AliWorkbench', '千牛工作台'],
    registryPaths: ['HKLM\\SOFTWARE\\AliWorkbench'],
    configGuide: '安装后用淘宝商家账号登录即可，MBE Desktop 通过 Accessibility API 只读消息',
  },
  {
    id: 'wangwang',
    name: '阿里旺旺',
    category: 'cs_tool',
    zone: 'readonly',
    downloadUrl: 'https://www.taobao.com/markets/tbhome/ali-page',
    processNames: ['AliWangWang', 'AliIM'],
    registryPaths: ['HKLM\\SOFTWARE\\AliWangWang'],
    configGuide: '安装后登录即可，MBE Desktop 自动读取聊天窗口消息',
  },
  {
    id: 'feige',
    name: '抖店飞鸽',
    category: 'cs_tool',
    zone: 'readonly',
    downloadUrl: 'https://fxg.jinritemai.com/',
    webUrl: 'https://im.jinritemai.com',
    processNames: ['FeigeDianShang', 'Feige'],
    configGuide: '飞鸽为 Web 版，在浏览器中登录后 MBE Desktop 通过 CDP 读取消息',
  },
]

// ────────────────────── 检测逻辑 ──────────────────────

export interface DetectionResult {
  id: string
  name: string
  installed: boolean
  running: boolean
  installPath?: string
  version?: string
  webAvailable: boolean
  webUrl?: string
  zone: string
}

function execPromise(command: string, args: string[], timeout = 10000): Promise<{ stdout: string; success: boolean }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      shell: true,
      timeout,
      windowsHide: true,
      env: { ...process.env },
    })
    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', (d) => { stdout += d.toString() })
    proc.stderr?.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => resolve({ stdout: stdout.trim(), success: code === 0 }))
    proc.on('error', () => resolve({ stdout: '', success: false }))
  })
}

async function detectErp(erp: ErpDefinition): Promise<DetectionResult> {
  const result: DetectionResult = {
    id: erp.id,
    name: erp.name,
    installed: false,
    running: false,
    webAvailable: !!erp.webUrl,
    webUrl: erp.webUrl,
    zone: erp.zone,
  }

  if (process.platform !== 'win32') {
    return result
  }

  // 检测注册表
  if (erp.registryPaths) {
    for (const regPath of erp.registryPaths) {
      const regResult = await execPromise('reg', ['query', regPath, '/ve'], 5000)
      if (regResult.success && regResult.stdout.length > 0) {
        result.installed = true
        const pathMatch = regResult.stdout.match(/REG_SZ\s+(.+)/i)
        if (pathMatch) result.installPath = pathMatch[1].trim()
        break
      }
    }
  }

  // 检测进程（是否正在运行）
  for (const procName of erp.processNames) {
    const taskResult = await execPromise('tasklist', ['/FI', `IMAGENAME eq ${procName}*`, '/NH'], 5000)
    if (taskResult.success && taskResult.stdout.toLowerCase().includes(procName.toLowerCase())) {
      result.running = true
      result.installed = true
      break
    }
  }

  // where 命令兜底检测
  if (!result.installed) {
    for (const procName of erp.processNames) {
      const whereResult = await execPromise('where', [procName], 3000)
      if (whereResult.success && whereResult.stdout.length > 0) {
        result.installed = true
        result.installPath = whereResult.stdout.split('\n')[0].trim()
        break
      }
    }
  }

  return result
}

async function detectAllErps(): Promise<DetectionResult[]> {
  const results: DetectionResult[] = []
  for (const erp of ERP_REGISTRY) {
    results.push(await detectErp(erp))
  }
  return results
}

// ────────────────────── 安装逻辑 ──────────────────────

export interface SetupStep {
  step: number
  totalSteps: number
  action: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  detail?: string
  error?: string
}

let mainWindowRef: BrowserWindow | null = null

export function setErpSetupMainWindow(win: BrowserWindow | null): void {
  mainWindowRef = win
}

function emitSetupStep(step: SetupStep): void {
  mainWindowRef?.webContents.send('erpSetup:step', step)
}

async function installErp(erpId: string, method?: 'winget' | 'download' | 'web'): Promise<{
  success: boolean
  method: string
  message: string
  steps: SetupStep[]
}> {
  const erp = ERP_REGISTRY.find(e => e.id === erpId)
  if (!erp) {
    return { success: false, method: 'none', message: `未知 ERP: ${erpId}`, steps: [] }
  }

  const steps: SetupStep[] = []
  const totalSteps = 5

  // Step 1: 检测现有安装
  const step1: SetupStep = { step: 1, totalSteps, action: '检测现有安装', status: 'running' }
  steps.push(step1)
  emitSetupStep(step1)

  const detection = await detectErp(erp)
  if (detection.installed) {
    step1.status = 'success'
    step1.detail = `${erp.name} 已安装${detection.running ? '且正在运行' : ''}`
    emitSetupStep(step1)
    return {
      success: true,
      method: 'existing',
      message: `${erp.name} 已安装${detection.installPath ? `（${detection.installPath}）` : ''}`,
      steps,
    }
  }
  step1.status = 'success'
  step1.detail = '未检测到安装'
  emitSetupStep(step1)

  // Step 2: 用户确认安装
  const step2: SetupStep = { step: 2, totalSteps, action: '用户确认', status: 'running' }
  steps.push(step2)
  emitSetupStep(step2)

  const confirmResult = await dialog.showMessageBox(mainWindowRef!, {
    type: 'question',
    title: `安装 ${erp.name}`,
    message: `是否安装 ${erp.name}？`,
    detail: [
      `安全等级: ${erp.zone === 'safe' ? '✅ 安全区（AI 可读写）' : '⚠️ 只读区（AI 仅读取）'}`,
      '',
      erp.webUrl ? `也可使用 Web 版: ${erp.webUrl}` : '',
      '',
      `安装后配置: ${erp.configGuide}`,
    ].filter(Boolean).join('\n'),
    buttons: ['取消', erp.webUrl ? '使用 Web 版' : '', '安装桌面版'].filter(Boolean),
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  })

  if (confirmResult.response === 0) {
    step2.status = 'failed'
    step2.detail = '用户取消'
    emitSetupStep(step2)
    return { success: false, method: 'cancelled', message: '用户取消安装', steps }
  }

  // 选择使用 Web 版
  const webOptionIndex = erp.webUrl ? 1 : -1
  if (confirmResult.response === webOptionIndex && erp.webUrl) {
    step2.status = 'success'
    step2.detail = '选择 Web 版'
    emitSetupStep(step2)

    await shell.openExternal(erp.webUrl)
    return {
      success: true,
      method: 'web',
      message: `已在浏览器中打开 ${erp.name} Web 版，请登录后 MBE Desktop 将通过 CDP 自动连接`,
      steps,
    }
  }

  step2.status = 'success'
  step2.detail = '确认安装桌面版'
  emitSetupStep(step2)

  // Step 3: 尝试 winget 安装
  const useMethod = method || 'winget'
  const step3: SetupStep = { step: 3, totalSteps, action: '选择安装方式', status: 'running' }
  steps.push(step3)
  emitSetupStep(step3)

  if (useMethod === 'winget' && erp.wingetId) {
    const wingetCheck = await execPromise('where', ['winget'], 3000)
    if (wingetCheck.success) {
      step3.status = 'success'
      step3.detail = '使用 winget 包管理器'
      emitSetupStep(step3)

      const step4: SetupStep = { step: 4, totalSteps, action: '执行安装', status: 'running' }
      steps.push(step4)
      emitSetupStep(step4)

      const installResult = await execPromise('winget', [
        'install', '--id', erp.wingetId,
        '--accept-package-agreements', '--accept-source-agreements',
      ], 300000) // 5 分钟超时

      if (installResult.success) {
        step4.status = 'success'
        step4.detail = 'winget 安装完成'
        emitSetupStep(step4)
      } else {
        step4.status = 'failed'
        step4.error = installResult.stdout || '安装失败'
        emitSetupStep(step4)
        // 降级到下载安装
      }
    }
  }

  // 降级：打开下载页面让用户手动下载
  if (!steps.find(s => s.step === 4)?.status || steps.find(s => s.step === 4)?.status === 'failed') {
    step3.status = 'success'
    step3.detail = '引导用户下载安装'
    emitSetupStep(step3)

    const step4: SetupStep = { step: 4, totalSteps, action: '打开下载页面', status: 'running' }
    steps.push(step4)
    emitSetupStep(step4)

    await shell.openExternal(erp.downloadUrl)
    step4.status = 'success'
    step4.detail = `已打开 ${erp.name} 官方下载页面`
    emitSetupStep(step4)
  }

  // Step 5: 配置引导
  const step5: SetupStep = { step: 5, totalSteps, action: '配置引导', status: 'running' }
  steps.push(step5)
  emitSetupStep(step5)

  step5.status = 'success'
  step5.detail = erp.configGuide
  emitSetupStep(step5)

  return {
    success: true,
    method: useMethod,
    message: `${erp.name} 安装引导完成。${erp.configGuide}`,
    steps,
  }
}

// ────────────────────── 一键全部检测并安装 ──────────────────────

async function autoSetupAll(erpIds?: string[]): Promise<{
  detection: DetectionResult[]
  needInstall: string[]
  message: string
}> {
  const targets = erpIds
    ? ERP_REGISTRY.filter(e => erpIds.includes(e.id))
    : ERP_REGISTRY.filter(e => e.zone === 'safe')

  const detection = await Promise.all(targets.map(detectErp))
  const needInstall = detection.filter(d => !d.installed && !d.webAvailable).map(d => d.id)
  const hasWeb = detection.filter(d => !d.installed && d.webAvailable)

  const messages = [
    `检测 ${detection.length} 个应用:`,
    ...detection.map(d =>
      `  ${d.installed ? '✅' : d.webAvailable ? '🌐' : '❌'} ${d.name} — ${d.installed ? (d.running ? '已安装且运行中' : '已安装') : d.webAvailable ? 'Web 版可用' : '未安装'}`
    ),
  ]

  if (hasWeb.length > 0) {
    messages.push('', '以下可直接使用 Web 版（推荐）:')
    hasWeb.forEach(d => messages.push(`  🌐 ${d.name}: ${d.webUrl}`))
  }

  return {
    detection,
    needInstall,
    message: messages.join('\n'),
  }
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupErpAutoSetupIPC(): void {
  ipcMain.handle('erpSetup:registry', () => {
    return ERP_REGISTRY.map(e => ({
      id: e.id, name: e.name, category: e.category, zone: e.zone,
      webUrl: e.webUrl, downloadUrl: e.downloadUrl,
      configGuide: e.configGuide,
    }))
  })

  ipcMain.handle('erpSetup:detect', async (_, erpId?: string) => {
    if (erpId) {
      const erp = ERP_REGISTRY.find(e => e.id === erpId)
      if (!erp) return { success: false, error: `未知 ERP: ${erpId}` }
      return detectErp(erp)
    }
    return detectAllErps()
  })

  ipcMain.handle('erpSetup:install', async (_, erpId: string, method?: string) => {
    if (!ipcRateLimit('erpSetup:install', 3)) {
      return { success: false, method: 'none', message: '操作频率超限', steps: [] }
    }
    return installErp(erpId, method as 'winget' | 'download' | 'web')
  })

  ipcMain.handle('erpSetup:autoSetup', async (_, erpIds?: string[]) => {
    return autoSetupAll(erpIds)
  })

  ipcMain.handle('erpSetup:openWeb', async (_, erpId: string) => {
    const erp = ERP_REGISTRY.find(e => e.id === erpId)
    if (!erp?.webUrl) return { success: false, error: '该 ERP 无 Web 版' }
    await shell.openExternal(erp.webUrl)
    return { success: true, url: erp.webUrl }
  })

  ipcMain.handle('erpSetup:getConfigGuide', (_, erpId: string) => {
    const erp = ERP_REGISTRY.find(e => e.id === erpId)
    if (!erp) return null
    return { id: erp.id, name: erp.name, guide: erp.configGuide, zone: erp.zone }
  })
}
