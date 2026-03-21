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
  // 系统工具
  'where', 'which', 'cmd', 'open',
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
    // 禁止 shell 元字符注入（管道、重定向、命令串联）
    if (/[|><;&`$]/.test(arg) && !arg.startsWith('-')) return false
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
      const confirmed = await requestUserConfirm(1, `打开文件: ${path.basename(target)}`, target)
      if (!confirmed) return { success: false, error: '用户取消' }

      if (withApp) {
        return execCommand(withApp, [target, ...(args || [])], 1)
      }
      await shell.openPath(target)
      return { success: true }
    }

    case 'open_app': {
      const confirmed = await requestUserConfirm(2, `启动应用: ${target}`)
      if (!confirmed) return { success: false, error: '用户取消' }

      if (process.platform === 'win32') {
        return execCommand('cmd', ['/c', 'start', '', target, ...(args || [])], 2)
      } else {
        return execCommand('open', ['-a', target, ...(args || [])], 2)
      }
    }

    case 'open_url': {
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        return { success: false, error: '仅支持 http/https URL' }
      }
      await shell.openExternal(target)
      return { success: true }
    }

    case 'mailto': {
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

  // Layer 3: CLI 执行
  ipcMain.handle('localApp:exec', async (_, request: CliExecRequest): Promise<CliExecResult> => {
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
}
