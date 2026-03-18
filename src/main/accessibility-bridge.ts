// AccessibilityBridge — Windows UI Automation 只读桥
// 通过 PowerShell 调用 .NET UIAutomation 读取本地应用的聊天消息
// 安全策略：永远只读，禁止对平台客服工具执行写操作

import { ipcMain, BrowserWindow } from 'electron'
import { execFile } from 'child_process'
import path from 'path'

// ────────────────────── 类型 ──────────────────────

export interface ChatMessage {
  sender: string
  content: string
  timestamp?: string
  isCustomer: boolean
}

export interface ReadChatResult {
  success: boolean
  app: string
  messages: ChatMessage[]
  windowTitle?: string
  error?: string
}

interface WatchState {
  app: string
  timer: ReturnType<typeof setInterval>
  lastHash: string
}

// ────────────────────── 应用窗口进程名映射 ──────────────────────

const APP_PROCESS_MAP: Record<string, { processNames: string[]; titlePatterns: RegExp[] }> = {
  qianniu: {
    processNames: ['AliWorkbench', '千牛工作台', 'AliIM'],
    titlePatterns: [/千牛/i, /AliWorkbench/i, /qianniu/i],
  },
  wangwang: {
    processNames: ['AliWangWang', 'wwbizsrv', 'AliIM'],
    titlePatterns: [/旺旺/i, /AliWangWang/i, /wangwang/i],
  },
  feige: {
    processNames: ['FeigeDianShang', 'Feige', 'FeiGe'],
    titlePatterns: [/飞鸽/i, /抖店/i, /feige/i],
  },
}

// ────────────────────── PowerShell UI Automation ──────────────────────

const PS_READ_CHAT_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

$processNames = $args[0] -split ','
$maxMessages = 50

function Find-ChatWindow {
  param([string[]]$names)
  foreach ($name in $names) {
    $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
      if ($p.MainWindowHandle -ne [IntPtr]::Zero) {
        return @{ Handle = $p.MainWindowHandle; Title = $p.MainWindowTitle; Process = $p.ProcessName }
      }
    }
  }
  return $null
}

function Read-ChatContent {
  param([IntPtr]$handle)
  try {
    $automation = [System.Windows.Automation.AutomationElement]::FromHandle($handle)
    if (-not $automation) { return @() }

    # 查找文本内容：尝试多种控件模式
    $textCondition = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::Text
    )
    $listItemCondition = New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::ListItem
    )

    $messages = @()

    # 优先找 ListItem（聊天消息通常是列表项）
    $listItems = $automation.FindAll(
      [System.Windows.Automation.TreeScope]::Descendants, $listItemCondition
    )
    if ($listItems.Count -gt 0) {
      $start = [Math]::Max(0, $listItems.Count - $maxMessages)
      for ($i = $start; $i -lt $listItems.Count; $i++) {
        $item = $listItems[$i]
        $name = $item.Current.Name
        if ($name -and $name.Trim().Length -gt 0) {
          $messages += @{ content = $name.Trim() }
        }
      }
    }

    # 降级：找 Text 控件
    if ($messages.Count -eq 0) {
      $texts = $automation.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants, $textCondition
      )
      $start = [Math]::Max(0, $texts.Count - $maxMessages)
      for ($i = $start; $i -lt $texts.Count; $i++) {
        $el = $texts[$i]
        $name = $el.Current.Name
        if ($name -and $name.Trim().Length -gt 2) {
          $messages += @{ content = $name.Trim() }
        }
      }
    }

    return $messages
  } catch {
    return @()
  }
}

$win = Find-ChatWindow -names $processNames
if (-not $win) {
  @{ success = $false; error = "未找到目标应用窗口"; messages = @() } | ConvertTo-Json -Depth 5
  exit 0
}

$chatMessages = Read-ChatContent -handle $win.Handle
$result = @{
  success = $true
  windowTitle = $win.Title
  processName = $win.Process
  messageCount = $chatMessages.Count
  messages = $chatMessages
}
$result | ConvertTo-Json -Depth 5
`

function runPowerShell(script: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const psArgs = [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-Command', script,
      ...args,
    ]
    execFile('powershell.exe', psArgs, {
      encoding: 'utf-8',
      timeout: 10000,
      windowsHide: true,
      env: { ...process.env },
    }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message))
      } else {
        resolve(stdout.trim())
      }
    })
  })
}

// ────────────────────── 核心函数 ──────────────────────

async function readChatMessages(appKey: string): Promise<ReadChatResult> {
  if (process.platform !== 'win32') {
    return { success: false, app: appKey, messages: [], error: 'Accessibility 仅支持 Windows' }
  }

  const appConfig = APP_PROCESS_MAP[appKey]
  if (!appConfig) {
    return { success: false, app: appKey, messages: [], error: `不支持的应用: ${appKey}` }
  }

  try {
    const processNamesArg = appConfig.processNames.join(',')
    const output = await runPowerShell(PS_READ_CHAT_SCRIPT, [processNamesArg])

    const parsed = JSON.parse(output)
    if (!parsed.success) {
      return { success: false, app: appKey, messages: [], error: parsed.error }
    }

    const messages: ChatMessage[] = (parsed.messages || []).map((m: { content: string }, idx: number) => ({
      sender: `msg_${idx}`,
      content: m.content,
      isCustomer: idx % 2 === 0,
    }))

    return {
      success: true,
      app: appKey,
      messages,
      windowTitle: parsed.windowTitle,
    }
  } catch (err) {
    return {
      success: false,
      app: appKey,
      messages: [],
      error: (err as Error).message,
    }
  }
}

// ────────────────────── 消息监听 ──────────────────────

let mainWindowRef: BrowserWindow | null = null
const activeWatchers: Map<string, WatchState> = new Map()

export function setAccessibilityMainWindow(win: BrowserWindow | null): void {
  mainWindowRef = win
}

function hashMessages(messages: ChatMessage[]): string {
  return messages.map(m => m.content).join('|').slice(-500)
}

function startWatching(appKey: string, intervalMs = 3000): { success: boolean; error?: string } {
  if (activeWatchers.has(appKey)) {
    return { success: true }
  }

  const timer = setInterval(async () => {
    const result = await readChatMessages(appKey)
    if (!result.success || result.messages.length === 0) return

    const hash = hashMessages(result.messages)
    const state = activeWatchers.get(appKey)
    if (!state) return

    if (hash !== state.lastHash) {
      state.lastHash = hash
      mainWindowRef?.webContents.send('accessibility:newMessages', {
        app: appKey,
        messages: result.messages,
        windowTitle: result.windowTitle,
      })
    }
  }, intervalMs)

  activeWatchers.set(appKey, { app: appKey, timer, lastHash: '' })
  return { success: true }
}

function stopWatching(appKey: string): { success: boolean } {
  const state = activeWatchers.get(appKey)
  if (state) {
    clearInterval(state.timer)
    activeWatchers.delete(appKey)
  }
  return { success: true }
}

function stopAllWatching(): void {
  for (const [key, state] of activeWatchers) {
    clearInterval(state.timer)
    activeWatchers.delete(key)
  }
}

// ────────────────────── IPC ──────────────────────

export function setupAccessibilityBridgeIPC(): void {
  ipcMain.handle('accessibility:readChat', async (_, appKey: string) => {
    return readChatMessages(appKey)
  })

  ipcMain.handle('accessibility:watchChat', async (_, appKey: string, intervalMs?: number) => {
    return startWatching(appKey, intervalMs)
  })

  ipcMain.handle('accessibility:stopWatch', async (_, appKey: string) => {
    return stopWatching(appKey)
  })

  ipcMain.handle('accessibility:stopAll', async () => {
    stopAllWatching()
    return { success: true }
  })

  ipcMain.handle('accessibility:supportedApps', async () => {
    return Object.keys(APP_PROCESS_MAP)
  })
}

export function destroyAccessibilityBridge(): void {
  stopAllWatching()
}
