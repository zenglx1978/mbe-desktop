// CopilotBridge — MBE Desktop AI 副驾驶
// 全局快捷键 + 剪贴板桥接 + 悬浮窗 + 截图/OCR + 窗口自动化
// 让 AI 专家成为微信/飞书/钉钉等所有本机应用的副驾驶

import {
  globalShortcut,
  clipboard,
  screen,
  ipcMain,
  BrowserWindow,
  desktopCapturer,
  Notification,
} from 'electron'
import path from 'path'
import { execSync } from 'child_process'
import { setFlag } from './module-flags'

// ────────────────────── 状态 ──────────────────────

let mainWindowRef: BrowserWindow | null = null
let copilotWindow: BrowserWindow | null = null
// 默认关闭：全局快捷键 + 剪贴板/截屏读取属敏感能力，需用户显式开启
let isEnabled = false

const COPILOT_WIDTH = 420
const COPILOT_HEIGHT = 520

export function setCopilotMainWindow(win: BrowserWindow | null): void {
  mainWindowRef = win
}

// ────────────────────── 悬浮窗管理 ──────────────────────

function getCopilotWindowUrl(): string {
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    return `${devUrl}#/copilot`
  }
  return `file://${path.join(__dirname, '..', 'renderer', 'index.html')}#/copilot`
}

function createCopilotWindow(): BrowserWindow {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { width: screenW, height: screenH } = display.workAreaSize
  const { x: areaX, y: areaY } = display.workArea

  // 右下角弹出
  const x = areaX + screenW - COPILOT_WIDTH - 20
  const y = areaY + screenH - COPILOT_HEIGHT - 20

  const win = new BrowserWindow({
    width: COPILOT_WIDTH,
    height: COPILOT_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.loadURL(getCopilotWindowUrl())

  win.on('blur', () => {
    // 失焦时不自动关闭，只是隐藏，保持状态
  })

  win.on('closed', () => {
    copilotWindow = null
  })

  return win
}

function showCopilotWindow(textToAnalyze?: string): void {
  if (!copilotWindow || copilotWindow.isDestroyed()) {
    copilotWindow = createCopilotWindow()
  }

  copilotWindow.show()
  copilotWindow.focus()

  // 传入待分析的文本
  if (textToAnalyze) {
    copilotWindow.webContents.once('did-finish-load', () => {
      copilotWindow?.webContents.send('copilot:analyze', { text: textToAnalyze })
    })
    if (!copilotWindow.webContents.isLoading()) {
      copilotWindow.webContents.send('copilot:analyze', { text: textToAnalyze })
    }
  }
}

function hideCopilotWindow(): void {
  if (copilotWindow && !copilotWindow.isDestroyed()) {
    copilotWindow.hide()
  }
}

function toggleCopilotWindow(): void {
  if (copilotWindow && !copilotWindow.isDestroyed() && copilotWindow.isVisible()) {
    hideCopilotWindow()
  } else {
    showCopilotWindow()
  }
}

// ────────────────────── 快捷键触发 + 剪贴板 ──────────────────────

function handleQuickAnalyze(): void {
  if (!isEnabled) return

  // 读取当前剪贴板内容
  const text = clipboard.readText().trim()

  if (!text) {
    // 剪贴板为空，仅打开悬浮窗
    showCopilotWindow()
    return
  }

  // 有文本，传入悬浮窗分析
  showCopilotWindow(text)
}

function handleQuickScreenshot(): void {
  if (!isEnabled) return
  captureScreen().then(dataUrl => {
    if (dataUrl) {
      showCopilotWindow()
      copilotWindow?.webContents.send('copilot:screenshot', { dataUrl })
    }
  })
}

// ────────────────────── 截图能力 ──────────────────────

async function captureScreen(): Promise<string | null> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    })

    if (sources.length === 0) return null

    const primarySource = sources[0]
    const image = primarySource.thumbnail
    return image.toDataURL()
  } catch {
    return null
  }
}

async function captureArea(): Promise<string | null> {
  // 全屏截图后由前端裁切区域
  return captureScreen()
}

// ────────────────────── 写入剪贴板 & 模拟粘贴 ──────────────────────

function writeToClipboardAndPaste(text: string): void {
  clipboard.writeText(text)

  // 通知前端已复制
  copilotWindow?.webContents.send('copilot:copied', { text })
  mainWindowRef?.webContents.send('copilot:copied', { text })

  if (Notification.isSupported()) {
    new Notification({
      title: 'MBE AI 专家',
      body: '回答已复制到剪贴板，切换到目标窗口粘贴即可',
      silent: true,
    }).show()
  }
}

// ────────────────────── 窗口检测（当前活跃应用） ──────────────────────

interface ActiveWindowInfo {
  title: string
  app: string
  pid: number
}

async function getActiveWindow(): Promise<ActiveWindowInfo | null> {
  // Windows: 使用 PowerShell 获取当前活跃窗口信息
  if (process.platform === 'win32') {
    try {
      const ps = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          using System.Text;
          public class WinAPI {
            [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
            [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
            [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
          }
"@
        $hwnd = [WinAPI]::GetForegroundWindow()
        $sb = New-Object System.Text.StringBuilder 256
        [WinAPI]::GetWindowText($hwnd, $sb, 256) | Out-Null
        $pid = 0
        [WinAPI]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        @{ title = $sb.ToString(); app = $proc.ProcessName; pid = $pid } | ConvertTo-Json
      `
      const result = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, {
        encoding: 'utf-8',
        timeout: 3000,
        windowsHide: true,
      })
      return JSON.parse(result.trim())
    } catch {
      return null
    }
  }

  // macOS: 使用 AppleScript
  if (process.platform === 'darwin') {
    try {
      const script = `
        tell application "System Events"
          set frontApp to name of first application process whose frontmost is true
          set frontTitle to ""
          try
            set frontTitle to name of front window of (first application process whose frontmost is true)
          end try
        end tell
        return "{\\"app\\":\\"" & frontApp & "\\",\\"title\\":\\"" & frontTitle & "\\",\\"pid\\":0}"
      `
      const result = execSync(`osascript -e '${script}'`, { encoding: 'utf-8', timeout: 3000 })
      return JSON.parse(result.trim())
    } catch {
      return null
    }
  }

  return null
}

// 识别应用类别（微信/飞书/钉钉/浏览器/电商客服/ERP 等）
function classifyApp(info: ActiveWindowInfo): string {
  const app = (info.app || '').toLowerCase()
  const title = (info.title || '').toLowerCase()

  // 🚫 红线区 — 微信/企微
  if (app.includes('wechat') || app.includes('weixin') || title.includes('微信'))
    return 'wechat'
  if (app.includes('wxwork') || app.includes('wecom') || title.includes('企业微信'))
    return 'wecom'

  // ⚠️ 只读区 — 电商平台客服工具
  if (app.includes('aliworkbench') || app.includes('qianniu') || title.includes('千牛'))
    return 'qianniu'
  if (app.includes('aliwangwang') || title.includes('旺旺'))
    return 'wangwang'
  if (app.includes('feige') || title.includes('飞鸽') || title.includes('抖店'))
    return 'feige'
  if (title.includes('拼多多商家') || title.includes('多多商家'))
    return 'pinduoduo_seller'
  if (title.includes('小红书商家') || title.includes('小红书千帆'))
    return 'xiaohongshu_seller'

  // ✅ 安全区 — 第三方 ERP
  if (title.includes('聚水潭') || title.includes('jushuitan'))
    return 'jushuitan'
  if (title.includes('旺店通') || title.includes('wangdiantong'))
    return 'wangdiantong'
  if (title.includes('管易云') || title.includes('guanyiyun'))
    return 'guanyiyun'

  // IM 工具
  if (app.includes('feishu') || app.includes('lark') || title.includes('飞书'))
    return 'feishu'
  if (app.includes('dingtalk') || title.includes('钉钉'))
    return 'dingtalk'

  // 通用应用
  if (app.includes('chrome') || app.includes('edge') || app.includes('firefox') || app.includes('brave'))
    return 'browser'
  if (app.includes('outlook') || app.includes('foxmail') || title.includes('邮'))
    return 'email'
  if (app.includes('excel') || app.includes('wps') || title.includes('.xlsx'))
    return 'spreadsheet'
  if (app.includes('word') || app.includes('wps') || title.includes('.docx'))
    return 'document'

  return 'other'
}

// ────────────────────── 快捷键注册 ──────────────────────

const DEFAULT_SHORTCUTS = {
  quickAnalyze: 'CommandOrControl+Shift+M',   // 读剪贴板 → AI 分析
  screenshot: 'CommandOrControl+Shift+S',       // 截图 → AI 分析
  toggle: 'CommandOrControl+Shift+Space',       // 开关悬浮窗
}

function registerShortcuts(): void {
  globalShortcut.register(DEFAULT_SHORTCUTS.quickAnalyze, handleQuickAnalyze)
  globalShortcut.register(DEFAULT_SHORTCUTS.screenshot, handleQuickScreenshot)
  globalShortcut.register(DEFAULT_SHORTCUTS.toggle, toggleCopilotWindow)
}

function unregisterShortcuts(): void {
  globalShortcut.unregisterAll()
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupCopilotBridgeIPC(): void {
  // 悬浮窗控制
  ipcMain.handle('copilot:show', (_, text?: string) => {
    showCopilotWindow(text)
    return { success: true }
  })

  ipcMain.handle('copilot:hide', () => {
    hideCopilotWindow()
    return { success: true }
  })

  ipcMain.handle('copilot:toggle', () => {
    toggleCopilotWindow()
    return { success: true }
  })

  // 剪贴板操作
  ipcMain.handle('copilot:clipboard:read', () => {
    return { text: clipboard.readText(), html: clipboard.readHTML() }
  })

  ipcMain.handle('copilot:clipboard:write', (_, text: string) => {
    writeToClipboardAndPaste(text)
    return { success: true }
  })

  ipcMain.handle('copilot:clipboard:writeAndNotify', (_, text: string) => {
    writeToClipboardAndPaste(text)
    return { success: true }
  })

  // 截图
  ipcMain.handle('copilot:screenshot', async () => {
    const dataUrl = await captureScreen()
    return { success: !!dataUrl, dataUrl }
  })

  ipcMain.handle('copilot:screenshot:area', async () => {
    const dataUrl = await captureArea()
    return { success: !!dataUrl, dataUrl }
  })

  // 当前活跃窗口检测
  ipcMain.handle('copilot:activeWindow', async () => {
    const info = await getActiveWindow()
    if (!info) return { success: false }
    return {
      success: true,
      ...info,
      category: classifyApp(info),
    }
  })

  // 启用/禁用
  ipcMain.handle('copilot:setEnabled', (_, enabled: boolean) => {
    isEnabled = enabled
    if (enabled) {
      registerShortcuts()
    } else {
      unregisterShortcuts()
      hideCopilotWindow()
    }
    setFlag('copilot', enabled) // 持久化：重启后保持用户选择
    return { success: true, enabled: isEnabled }
  })

  ipcMain.handle('copilot:getStatus', () => {
    return {
      enabled: isEnabled,
      windowVisible: copilotWindow?.isVisible() ?? false,
      shortcuts: DEFAULT_SHORTCUTS,
    }
  })

  // 悬浮窗位置/大小控制
  ipcMain.on('copilot:window:move', (_, { x, y }: { x: number; y: number }) => {
    copilotWindow?.setPosition(Math.round(x), Math.round(y))
  })

  ipcMain.on('copilot:window:resize', (_, { width, height }: { width: number; height: number }) => {
    copilotWindow?.setSize(Math.round(width), Math.round(height))
  })

  ipcMain.on('copilot:window:pin', (_, pinned: boolean) => {
    copilotWindow?.setAlwaysOnTop(pinned)
  })

  ipcMain.on('copilot:window:close', () => {
    hideCopilotWindow()
  })
}

// ────────────────────── 生命周期 ──────────────────────

export function initCopilotBridge(): void {
  isEnabled = true
  registerShortcuts()
}

export function destroyCopilotBridge(): void {
  unregisterShortcuts()
  if (copilotWindow && !copilotWindow.isDestroyed()) {
    copilotWindow.close()
    copilotWindow = null
  }
}
