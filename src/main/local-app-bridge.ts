// LocalAppBridge — MBE Desktop 本地应用控制中枢
// 受 CLI-Anything 启发：AI Agent 通过结构化指令控制用户本机应用
// 三层架构：DocGen（文档生成）→ AppLauncher（应用启动）→ AppControl（应用控制）

import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { generatePptx } from './docgen/pptx-engine'
import { generateXlsx } from './docgen/xlsx-engine'
import { generateDocx } from './docgen/docx-engine'
import { isReadPathAllowed, isWritePathAllowed, ipcRateLimit } from './safe-path'

// ────────────────────── 类型定义 ──────────────────────

export interface DocGenRequest {
  format: 'pptx' | 'xlsx' | 'docx'
  template?: string
  data: Record<string, unknown>
  outputDir?: string
  autoOpen?: boolean
  fileName?: string
}

export interface DocGenResult {
  success: boolean
  filePath?: string
  fileSize?: number
  error?: string
}

export interface AppLaunchRequest {
  action: 'open_file' | 'open_app' | 'open_url' | 'mailto'
  target: string
  args?: string[]
  withApp?: string
}

export interface CliExecRequest {
  command: string
  args: string[]
  timeout?: number
  workingDir?: string
  securityLevel: 0 | 1 | 2 | 3
}

export interface CliExecResult {
  success: boolean
  stdout?: string
  stderr?: string
  exitCode?: number
  parsedJson?: Record<string, unknown>
  error?: string
}

export type SecurityLevel = 0 | 1 | 2 | 3

// ────────────────────── 安全等级定义 ──────────────────────

const SECURITY_DESCRIPTIONS: Record<SecurityLevel, string> = {
  0: '生成文件（自动执行）',
  1: '打开文件（通知后执行）',
  2: '执行外部命令（需确认）',
  3: '发送消息/修改外部数据（需二次确认）',
}

// ────────────────────── 命令白名单（渲染进程可调用的外部命令） ──────────────────────

const ALLOWED_COMMANDS: Set<string> = new Set([
  // Python 计算脚本
  'python', 'python3', 'py',
  // 系统工具（where/which 仅用于应用检测）
  'where', 'which',
  // 包管理器 — ERP 自动安装（L2/L3 安全级别，需用户确认）
  'winget', 'choco',
  // 安装器 — 静默安装已下载的安装包（L3 安全级别）
  'msiexec',
  // 文件下载 — 下载 ERP 安装包（L2 安全级别）
  'curl', 'certutil',
  // 进程管理 — 检测/启动/停止 ERP 进程
  'tasklist', 'taskkill', 'sc',
  // 注册表查询 — 检测已安装软件（只读）
  'reg',
  // Office / 文档
  'libreoffice', 'soffice',
  'libreoffice-cli', 'gimp-cli', 'blender-cli', 'inkscape-cli', 'mbe-calc',
  // 投资终端 CLI
  'EmStock', 'hexin', 'tdxw',
])

function isCommandAllowed(command: string): boolean {
  const base = path.basename(command).replace(/\.exe$/i, '').toLowerCase()
  for (const allowed of ALLOWED_COMMANDS) {
    if (base === allowed.toLowerCase()) return true
  }
  return false
}

function validateArgs(args: string[]): boolean {
  for (const arg of args) {
    if (typeof arg !== 'string') return false
    if (/[|><;&`$]/.test(arg)) return false
    if (arg.length > 4096) return false
  }
  return true
}

// ────────────────────── 路径工具 ──────────────────────

function getExportsDir(): string {
  const docs = require('electron').app.getPath('documents')
  const dir = path.join(docs, 'MBE Desktop', 'exports')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function generateFileName(format: string, prefix?: string): string {
  const now = new Date()
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const p = prefix || 'MBE'
  return `${p}_${ts}.${format}`
}

// ────────────────────── 安全确认 ──────────────────────

let mainWindowRef: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindowRef = win
}

async function requestUserConfirm(
  level: SecurityLevel,
  description: string,
  detail?: string
): Promise<boolean> {
  if (level === 0) return true

  const parentWin = mainWindowRef || undefined
  const levelLabel = SECURITY_DESCRIPTIONS[level]

  if (level === 1) {
    // L1: 仅通知
    if (parentWin) {
      parentWin.webContents.send('localApp:notify', {
        level,
        message: description,
        detail,
      })
    }
    return true
  }

  // L2/L3: 弹窗确认
  const buttons = level === 3
    ? ['取消', '确认执行（不可撤销）']
    : ['取消', '确认执行']

  const result = await dialog.showMessageBox(parentWin!, {
    type: level === 3 ? 'warning' : 'question',
    title: `MBE 操作确认 [${levelLabel}]`,
    message: description,
    detail: detail || undefined,
    buttons,
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  })

  return result.response === 1
}

// ────────────────────── Layer 1: DocGen ──────────────────────

async function handleDocGen(request: DocGenRequest): Promise<DocGenResult> {
  try {
    const outputDir = request.outputDir || getExportsDir()
    if (!isWritePathAllowed(outputDir)) {
      return { success: false, error: '输出目录不在允许的写入目录中' }
    }
    const fileName = request.fileName || generateFileName(request.format, request.template)
    const filePath = path.join(outputDir, fileName)

    let buffer: Buffer

    switch (request.format) {
      case 'pptx':
        buffer = await generatePptx(request.data, request.template)
        break
      case 'xlsx':
        buffer = await generateXlsx(request.data, request.template)
        break
      case 'docx':
        buffer = await generateDocx(request.data, request.template)
        break
      default:
        return { success: false, error: `不支持的格式: ${request.format}` }
    }

    fs.writeFileSync(filePath, buffer)
    const stats = fs.statSync(filePath)

    if (request.autoOpen !== false) {
      await shell.openPath(filePath)
    }

    return {
      success: true,
      filePath,
      fileSize: stats.size,
    }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
}

// ────────────────────── Layer 2: AppLauncher ──────────────────────

async function handleAppLaunch(request: AppLaunchRequest): Promise<{ success: boolean; error?: string }> {
  const { action, target, args, withApp } = request

  switch (action) {
    case 'open_file': {
      if (!isReadPathAllowed(target)) {
        return { success: false, error: '文件路径不在允许的目录中' }
      }
      const confirmed = await requestUserConfirm(1, `打开文件: ${path.basename(target)}`, target)
      if (!confirmed) return { success: false, error: '用户取消' }

      if (withApp && isCommandAllowed(withApp)) {
        return execCommand(withApp, [target, ...(args || [])], 1)
      }
      await shell.openPath(path.resolve(target))
      return { success: true }
    }

    case 'open_app': {
      const confirmed = await requestUserConfirm(2, `启动应用: ${target}`)
      if (!confirmed) return { success: false, error: '用户取消' }

      await shell.openPath(target)
      return { success: true }
    }

    case 'open_url': {
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        return { success: false, error: '仅支持 http/https URL' }
      }
      await shell.openExternal(target)
      return { success: true }
    }

    case 'mailto': {
      if (!/^(mailto:)?[^@\s]+@[^@\s]+\.[^@\s]+/.test(target)) {
        return { success: false, error: '无效的邮件地址' }
      }
      const mailtoUrl = target.startsWith('mailto:') ? target : `mailto:${target}`
      await shell.openExternal(mailtoUrl)
      return { success: true }
    }

    default:
      return { success: false, error: `未知操作: ${action}` }
  }
}

// ────────────────────── Layer 3: CLI 执行 ──────────────────────

function execCommand(
  command: string,
  args: string[],
  securityLevel: SecurityLevel,
  timeout = 30000,
  workingDir?: string,
): Promise<{ success: boolean; stdout?: string; stderr?: string; exitCode?: number; parsedJson?: Record<string, unknown>; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: workingDir,
      timeout,
      shell: process.platform === 'win32',
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => { stdout += data.toString() })
    proc.stderr?.on('data', (data) => { stderr += data.toString() })

    proc.on('close', (code) => {
      let parsedJson: Record<string, unknown> | undefined
      try {
        const trimmed = stdout.trim()
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          parsedJson = JSON.parse(trimmed)
        }
      } catch { /* 非 JSON 输出 */ }

      resolve({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? undefined,
        parsedJson,
      })
    })

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
}

async function handleCliExec(request: CliExecRequest): Promise<CliExecResult> {
  if (!isCommandAllowed(request.command)) {
    return { success: false, error: `命令不在白名单中: ${request.command}` }
  }

  if (!validateArgs(request.args)) {
    return { success: false, error: '参数包含不允许的字符' }
  }

  const confirmed = await requestUserConfirm(
    request.securityLevel,
    `执行命令: ${request.command} ${request.args.join(' ')}`,
    `安全等级: ${SECURITY_DESCRIPTIONS[request.securityLevel]}`,
  )
  if (!confirmed) {
    return { success: false, error: '用户取消' }
  }

  return execCommand(
    request.command,
    request.args,
    request.securityLevel,
    request.timeout,
    request.workingDir,
  )
}

// ────────────────────── 应用检测 ──────────────────────

interface DetectedApp {
  name: string
  available: boolean
  path?: string
  version?: string
}

async function detectInstalledApps(): Promise<DetectedApp[]> {
  const apps: DetectedApp[] = []

  const checks: { name: string; winCmd: string; macCmd: string }[] = [
    { name: 'WeChat', winCmd: 'where WeChat', macCmd: 'mdfind -name "WeChat.app"' },
    { name: 'WeCom', winCmd: 'where WXWork', macCmd: 'mdfind -name "企业微信.app"' },
    { name: 'Feishu', winCmd: 'where Feishu', macCmd: 'mdfind -name "Feishu.app"' },
    { name: 'DingTalk', winCmd: 'where DingTalk', macCmd: 'mdfind -name "DingTalk.app"' },
    // 电商平台客服工具（只读区）
    { name: 'QianNiu', winCmd: 'where AliWorkbench', macCmd: 'mdfind -name "千牛工作台.app"' },
    { name: 'AliWangWang', winCmd: 'where AliIM', macCmd: 'mdfind -name "阿里旺旺.app"' },
    // 电商 ERP（安全区，AI 可读写 Web 版）
    { name: 'JuShuiTan', winCmd: 'reg query "HKLM\\SOFTWARE\\JuShuiTan" /ve 2>nul || where jushuitan', macCmd: 'mdfind -name "聚水潭.app"' },
    { name: 'WangDianTong', winCmd: 'reg query "HKLM\\SOFTWARE\\WangDianTong" /ve 2>nul || where wangdiantong', macCmd: 'mdfind -name "旺店通.app"' },
    { name: 'GuanYiYun', winCmd: 'reg query "HKLM\\SOFTWARE\\GuanYiCloud" /ve 2>nul || where guanyiyun', macCmd: 'mdfind -name "管易云.app"' },
    // 投资终端
    { name: 'EastMoney', winCmd: 'where EmStock', macCmd: 'mdfind -name "东方财富.app"' },
    { name: 'THS_iFinD', winCmd: 'where hexin', macCmd: 'mdfind -name "同花顺.app"' },
    { name: 'TongDaXin', winCmd: 'where tdxw', macCmd: 'mdfind -name "通达信.app"' },
    // Office
    { name: 'Outlook', winCmd: 'where OUTLOOK', macCmd: 'mdfind -name "Microsoft Outlook.app"' },
    { name: 'Excel', winCmd: 'where EXCEL', macCmd: 'mdfind -name "Microsoft Excel.app"' },
    { name: 'Word', winCmd: 'where WINWORD', macCmd: 'mdfind -name "Microsoft Word.app"' },
    { name: 'PowerPoint', winCmd: 'where POWERPNT', macCmd: 'mdfind -name "Microsoft PowerPoint.app"' },
    { name: 'WPS', winCmd: 'where wps', macCmd: 'mdfind -name "WPS Office.app"' },
    { name: 'Photoshop', winCmd: 'where photoshop', macCmd: 'mdfind -name "Adobe Photoshop"' },
    { name: 'GIMP', winCmd: 'where gimp', macCmd: 'mdfind -name "GIMP.app"' },
    { name: 'LibreOffice', winCmd: 'where soffice', macCmd: 'mdfind -name "LibreOffice.app"' },
    { name: 'Blender', winCmd: 'where blender', macCmd: 'mdfind -name "Blender.app"' },
  ]

  const isWin = process.platform === 'win32'

  for (const check of checks) {
    const cmd = isWin ? check.winCmd : check.macCmd
    const parts = cmd.split(' ')
    const result = await execCommand(parts[0], parts.slice(1), 0, 5000)
    apps.push({
      name: check.name,
      available: result.success && (result.stdout?.trim().length ?? 0) > 0,
      path: result.success ? result.stdout?.trim().split('\n')[0] : undefined,
    })
  }

  // 检测 CLI-Anything 生成的 CLI 工具
  const cliAnythingTools = ['libreoffice-cli', 'gimp-cli', 'blender-cli', 'inkscape-cli', 'mbe-calc']
  for (const tool of cliAnythingTools) {
    const whereCmd = isWin ? 'where' : 'which'
    const result = await execCommand(whereCmd, [tool], 0, 3000)
    apps.push({
      name: `${tool} (CLI)`,
      available: result.success,
      path: result.success ? result.stdout?.trim() : undefined,
    })
  }

  return apps
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupLocalAppBridgeIPC(): void {
  // Layer 1: 文档生成
  ipcMain.handle('localApp:docgen', async (_, request: DocGenRequest): Promise<DocGenResult> => {
    return handleDocGen(request)
  })

  // Layer 2: 应用启动
  ipcMain.handle('localApp:open', async (_, request: AppLaunchRequest) => {
    return handleAppLaunch(request)
  })

  // Layer 3: CLI 执行（限速 10 次/分钟）
  ipcMain.handle('localApp:exec', async (_, request: CliExecRequest): Promise<CliExecResult> => {
    if (!ipcRateLimit('localApp:exec', 10)) {
      return { success: false, error: '调用频率超限，请稍后重试' }
    }
    return handleCliExec(request)
  })

  // 应用检测
  ipcMain.handle('localApp:detect', async (): Promise<DetectedApp[]> => {
    return detectInstalledApps()
  })

  // 导出目录信息
  ipcMain.handle('localApp:getExportsDir', (): string => {
    return getExportsDir()
  })

  // 列出已导出的文件
  ipcMain.handle('localApp:listExports', async (): Promise<{
    name: string; size: number; created: string; format: string
  }[]> => {
    const dir = getExportsDir()
    try {
      const files = fs.readdirSync(dir)
      return files
        .filter(f => /\.(pptx|xlsx|docx|pdf)$/i.test(f))
        .map(f => {
          const stat = fs.statSync(path.join(dir, f))
          return {
            name: f,
            size: stat.size,
            created: stat.birthtime.toISOString(),
            format: path.extname(f).slice(1).toLowerCase(),
          }
        })
        .sort((a, b) => b.created.localeCompare(a.created))
    } catch {
      return []
    }
  })

  // ═══════════════════ Computer Use 增强（借鉴二）═══════════════════
  // Anthropic Computer Use 启发：AI 不只是回答问题，直接操控本地应用完成业务
  // MBE 优势：走 API/IPC 而非截屏+鼠标模拟，更可靠、更快、更安全

  // 批量文档生成（如：一键生成月度财务报表套件）
  ipcMain.handle('localApp:batchDocgen', async (_, requests: DocGenRequest[]): Promise<{
    results: DocGenResult[]
    successCount: number
    failCount: number
    outputDir: string
  }> => {
    const results: DocGenResult[] = []
    let successCount = 0
    let failCount = 0
    for (const req of requests.slice(0, 20)) {
      const result = await handleDocGen(req)
      results.push(result)
      if (result.success) successCount++
      else failCount++
    }
    return { results, successCount, failCount, outputDir: getExportsDir() }
  })

  // 文件模板填充（如：用审查结果填入 Word 合同模板）
  ipcMain.handle('localApp:fillTemplate', async (_, request: {
    templatePath: string
    outputPath?: string
    format: 'docx' | 'xlsx' | 'pptx'
    variables: Record<string, unknown>
    autoOpen?: boolean
  }): Promise<DocGenResult> => {
    if (!isReadPathAllowed(request.templatePath)) {
      return { success: false, error: '模板路径不在允许的目录中' }
    }
    if (!fs.existsSync(request.templatePath)) {
      return { success: false, error: `模板文件不存在: ${request.templatePath}` }
    }
    return handleDocGen({
      format: request.format,
      template: request.templatePath,
      data: request.variables,
      outputDir: request.outputPath ? path.dirname(request.outputPath) : undefined,
      fileName: request.outputPath ? path.basename(request.outputPath) : undefined,
      autoOpen: request.autoOpen,
    })
  })

  // 文件操作流水线（Computer Use 核心：连续多步本地操作）
  ipcMain.handle('localApp:pipeline', async (_, steps: {
    action: 'docgen' | 'open' | 'copy' | 'rename' | 'archive'
    params: Record<string, unknown>
  }[]): Promise<{
    success: boolean
    completedSteps: number
    totalSteps: number
    results: { step: number; action: string; success: boolean; output?: unknown; error?: string }[]
  }> => {
    const results: { step: number; action: string; success: boolean; output?: unknown; error?: string }[] = []
    let completedSteps = 0

    for (let i = 0; i < Math.min(steps.length, 10); i++) {
      const step = steps[i]
      try {
        let output: unknown

        switch (step.action) {
          case 'docgen':
            output = await handleDocGen(step.params as unknown as DocGenRequest)
            break
          case 'open':
            output = await handleAppLaunch(step.params as unknown as AppLaunchRequest)
            break
          case 'copy': {
            const src = String(step.params.source || '')
            const dest = String(step.params.destination || '')
            if (!isReadPathAllowed(src) || !isWritePathAllowed(dest)) {
              throw new Error('路径不在允许的目录中')
            }
            fs.copyFileSync(src, dest)
            output = { copied: true, source: src, destination: dest }
            break
          }
          case 'rename': {
            const from = String(step.params.from || '')
            const to = String(step.params.to || '')
            if (!isWritePathAllowed(from) || !isWritePathAllowed(to)) {
              throw new Error('路径不在允许的目录中')
            }
            fs.renameSync(from, to)
            output = { renamed: true, from, to }
            break
          }
          case 'archive':
            output = { archived: false, message: '归档功能开发中' }
            break
          default:
            throw new Error(`未知操作: ${step.action}`)
        }

        const isSuccess = typeof output === 'object' && output !== null
          && ('success' in output ? (output as Record<string, unknown>).success !== false : true)
        results.push({ step: i, action: step.action, success: isSuccess, output })
        if (isSuccess) completedSteps++
      } catch (err) {
        results.push({
          step: i,
          action: step.action,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return {
      success: completedSteps === steps.length,
      completedSteps,
      totalSteps: steps.length,
      results,
    }
  })

  // 系统信息采集（AI 专家可了解用户环境以提供更精准的建议）
  ipcMain.handle('localApp:systemInfo', async (): Promise<{
    platform: string
    arch: string
    electronVersion: string
    appVersion: string
    locale: string
    timezone: string
    homeDir: string
    tempDir: string
  }> => {
    const os = await import('os')
    return {
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      appVersion: app.getVersion(),
      locale: app.getLocale(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      homeDir: os.homedir(),
      tempDir: os.tmpdir(),
    }
  })
}
