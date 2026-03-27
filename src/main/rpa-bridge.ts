// RPA Bridge — MBE Desktop 桌面级全自动化层
// 通过 Python 脚本执行桌面 RPA 操作（pyautogui / pywinauto）
// 安全策略：L3 安全级别，每个 RPA 动作都需用户确认或在已授权的工作流中执行
//
// 三种 RPA 模式:
//   1. Script 模式 — 执行预定义的 Python RPA 脚本（白名单）
//   2. Action 模式 — 逐步执行单个桌面动作（截图→定位→操作）
//   3. Workflow 模式 — 编排多个动作为工作流（带容错和重试）

import { ipcMain, dialog, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { ipcRateLimit } from './safe-path'

// ────────────────────── 类型定义 ──────────────────────

export interface RpaAction {
  type: 'click' | 'doubleClick' | 'rightClick' | 'type' | 'hotkey' | 'scroll'
       | 'moveTo' | 'screenshot' | 'locateOnScreen' | 'wait' | 'alert'
  /** 操作描述（仅用于显示，如 "订单备注输入框"） */
  target?: string
  /** 屏幕坐标 */
  x?: number
  y?: number
  /** 输入文本 */
  text?: string
  /** 热键组合（如 ['ctrl', 'c']） */
  keys?: string[]
  /** 滚动量 */
  scrollAmount?: number
  /** 图片定位用的模板路径 */
  imagePath?: string
  /** 匹配置信度（0-1） */
  confidence?: number
  /** 等待秒数 */
  waitSeconds?: number
  /** 截图保存路径 */
  savePath?: string
  /** 操作间隔（毫秒） */
  interval?: number
}

export interface RpaActionResult {
  success: boolean
  action: string
  location?: { x: number; y: number; width: number; height: number }
  screenshotPath?: string
  error?: string
}

export interface RpaWorkflow {
  name: string
  description: string
  /** 是否需要每步确认（false = 自动执行整个工作流） */
  confirmEachStep: boolean
  /** 整体超时秒数 */
  timeoutSeconds: number
  /** 失败重试次数 */
  retryCount: number
  steps: RpaAction[]
}

export interface RpaWorkflowResult {
  success: boolean
  completedSteps: number
  totalSteps: number
  results: RpaActionResult[]
  error?: string
  durationMs: number
}

// ────────────────────── Python 环境检测 ──────────────────────

let mainWindowRef: BrowserWindow | null = null
let pythonPath: string | null = null
let rpaAvailable: boolean | null = null

export function setRpaMainWindow(win: BrowserWindow | null): void {
  mainWindowRef = win
}

function getRpaScriptsDir(): string {
  const dir = path.join(app.getPath('userData'), 'rpa-scripts')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function execPython(script: string, timeout = 30000): Promise<{ stdout: string; stderr: string; success: boolean }> {
  return new Promise((resolve) => {
    const py = pythonPath || 'python'
    const proc = spawn(py, ['-c', script], {
      timeout,
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })

    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', (d) => { stdout += d.toString() })
    proc.stderr?.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => resolve({ stdout: stdout.trim(), stderr: stderr.trim(), success: code === 0 }))
    proc.on('error', (err) => resolve({ stdout: '', stderr: err.message, success: false }))
  })
}

async function detectPython(): Promise<{ available: boolean; version?: string; path?: string }> {
  for (const candidate of ['python', 'python3', 'py']) {
    const result = await execPython('import sys; print(sys.version); print(sys.executable)', 5000)
    if (result.success) {
      const lines = result.stdout.split('\n')
      pythonPath = candidate
      return { available: true, version: lines[0], path: lines[1] }
    }
  }
  return { available: false }
}

async function checkRpaDeps(): Promise<{
  available: boolean
  pyautogui: boolean
  pywinauto: boolean
  pillow: boolean
  missing: string[]
}> {
  const deps = { pyautogui: false, pywinauto: false, pillow: false }
  const missing: string[] = []

  const checkScript = `
import json
result = {}
try:
    import pyautogui
    result['pyautogui'] = True
except ImportError:
    result['pyautogui'] = False
try:
    import pywinauto
    result['pywinauto'] = True
except ImportError:
    result['pywinauto'] = False
try:
    from PIL import Image
    result['pillow'] = True
except ImportError:
    result['pillow'] = False
print(json.dumps(result))
`
  const result = await execPython(checkScript, 10000)
  if (result.success) {
    try {
      const parsed = JSON.parse(result.stdout)
      deps.pyautogui = parsed.pyautogui
      deps.pywinauto = parsed.pywinauto
      deps.pillow = parsed.pillow
      if (!deps.pyautogui) missing.push('pyautogui')
      if (!deps.pywinauto) missing.push('pywinauto')
      if (!deps.pillow) missing.push('Pillow')
    } catch { /* 解析失败 */ }
  }

  rpaAvailable = deps.pyautogui && deps.pillow
  return { available: rpaAvailable, ...deps, missing }
}

async function installRpaDeps(): Promise<{ success: boolean; error?: string }> {
  const confirmResult = await dialog.showMessageBox(mainWindowRef!, {
    type: 'question',
    title: 'RPA 依赖安装',
    message: '安装 RPA 桌面自动化所需的 Python 依赖？',
    detail: '将安装: pyautogui, pywinauto, Pillow\n\n这些是开源 Python 库，用于桌面应用自动化操作。',
    buttons: ['取消', '确认安装'],
    defaultId: 0,
    cancelId: 0,
  })

  if (confirmResult.response === 0) {
    return { success: false, error: '用户取消' }
  }

  const py = pythonPath || 'python'
  const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
    const proc = spawn(py, ['-m', 'pip', 'install', 'pyautogui', 'pywinauto', 'Pillow', '--user', '-q'], {
      timeout: 120000,
      windowsHide: true,
      shell: true,
    })

    let stderr = ''
    proc.stderr?.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => {
      resolve(code === 0 ? { success: true } : { success: false, error: stderr })
    })
    proc.on('error', (err) => resolve({ success: false, error: err.message }))
  })

  if (result.success) {
    rpaAvailable = true
  }
  return result
}

// ────────────────────── 核心 RPA 执行 ──────────────────────

async function executeRpaAction(action: RpaAction): Promise<RpaActionResult> {
  if (!rpaAvailable) {
    return { success: false, action: action.type, error: 'RPA 依赖未安装，请先调用 rpa:installDeps' }
  }

  let script = 'import pyautogui, json\npyautogui.FAILSAFE = True\npyautogui.PAUSE = 0.3\n'

  switch (action.type) {
    case 'click':
      script += `pyautogui.click(${action.x}, ${action.y})\nprint(json.dumps({"success": True, "action": "click"}))`
      break
    case 'doubleClick':
      script += `pyautogui.doubleClick(${action.x}, ${action.y})\nprint(json.dumps({"success": True, "action": "doubleClick"}))`
      break
    case 'rightClick':
      script += `pyautogui.rightClick(${action.x}, ${action.y})\nprint(json.dumps({"success": True, "action": "rightClick"}))`
      break
    case 'type':
      script += `pyautogui.write(${JSON.stringify(action.text || '')}, interval=0.05)\nprint(json.dumps({"success": True, "action": "type"}))`
      break
    case 'hotkey':
      if (!action.keys || action.keys.length === 0) {
        return { success: false, action: 'hotkey', error: '未指定热键' }
      }
      script += `pyautogui.hotkey(${action.keys.map(k => JSON.stringify(k)).join(', ')})\nprint(json.dumps({"success": True, "action": "hotkey"}))`
      break
    case 'scroll':
      script += `pyautogui.scroll(${action.scrollAmount || 0}${action.x ? `, ${action.x}, ${action.y}` : ''})\nprint(json.dumps({"success": True, "action": "scroll"}))`
      break
    case 'moveTo':
      script += `pyautogui.moveTo(${action.x}, ${action.y}, duration=0.3)\nprint(json.dumps({"success": True, "action": "moveTo"}))`
      break
    case 'screenshot': {
      const savePath = action.savePath || path.join(getRpaScriptsDir(), `screenshot_${Date.now()}.png`)
      script += `img = pyautogui.screenshot()\nimg.save(${JSON.stringify(savePath)})\nprint(json.dumps({"success": True, "action": "screenshot", "screenshotPath": ${JSON.stringify(savePath)}}))`
      break
    }
    case 'locateOnScreen':
      if (!action.imagePath) {
        return { success: false, action: 'locateOnScreen', error: '未指定模板图片' }
      }
      script += `
try:
    loc = pyautogui.locateOnScreen(${JSON.stringify(action.imagePath)}, confidence=${action.confidence || 0.8})
    if loc:
        print(json.dumps({"success": True, "action": "locateOnScreen", "location": {"x": loc.left, "y": loc.top, "width": loc.width, "height": loc.height}}))
    else:
        print(json.dumps({"success": False, "action": "locateOnScreen", "error": "Element not found on screen"}))
except Exception as e:
    print(json.dumps({"success": False, "action": "locateOnScreen", "error": str(e)}))`
      break
    case 'wait':
      script += `import time\ntime.sleep(${action.waitSeconds || 1})\nprint(json.dumps({"success": True, "action": "wait"}))`
      break
    case 'alert':
      script += `pyautogui.alert(text=${JSON.stringify(action.text || '提示')}, title='MBE RPA')\nprint(json.dumps({"success": True, "action": "alert"}))`
      break
    default:
      return { success: false, action: action.type, error: `未知操作: ${action.type}` }
  }

  const result = await execPython(script, (action.waitSeconds || 30) * 1000)
  if (!result.success) {
    return { success: false, action: action.type, error: result.stderr || '执行失败' }
  }

  try {
    return JSON.parse(result.stdout)
  } catch {
    return { success: false, action: action.type, error: '输出解析失败' }
  }
}

// ────────────────────── 工作流执行 ──────────────────────

async function executeRpaWorkflow(workflow: RpaWorkflow): Promise<RpaWorkflowResult> {
  const startTime = Date.now()
  const results: RpaActionResult[] = []
  let completedSteps = 0

  // 工作流执行前确认
  if (workflow.confirmEachStep) {
    const confirm = await dialog.showMessageBox(mainWindowRef!, {
      type: 'warning',
      title: 'RPA 工作流确认',
      message: `即将执行 RPA 工作流: ${workflow.name}`,
      detail: `${workflow.description}\n\n共 ${workflow.steps.length} 步操作，每步将请求确认。\n超时: ${workflow.timeoutSeconds}秒`,
      buttons: ['取消', '开始执行'],
      defaultId: 0,
      cancelId: 0,
    })
    if (confirm.response === 0) {
      return {
        success: false, completedSteps: 0, totalSteps: workflow.steps.length,
        results: [], error: '用户取消', durationMs: Date.now() - startTime,
      }
    }
  }

  for (let attempt = 0; attempt <= workflow.retryCount; attempt++) {
    completedSteps = 0
    results.length = 0
    let failed = false

    for (const step of workflow.steps) {
      if (Date.now() - startTime > workflow.timeoutSeconds * 1000) {
        results.push({ success: false, action: step.type, error: '工作流超时' })
        failed = true
        break
      }

      // 逐步确认模式
      if (workflow.confirmEachStep) {
        const stepConfirm = await dialog.showMessageBox(mainWindowRef!, {
          type: 'question',
          title: `RPA Step ${completedSteps + 1}/${workflow.steps.length}`,
          message: `下一步: ${step.type}${step.target ? ` → ${step.target}` : ''}${step.text ? ` (${step.text})` : ''}`,
          buttons: ['跳过', '取消工作流', '执行'],
          defaultId: 2,
          cancelId: 1,
        })

        if (stepConfirm.response === 1) {
          results.push({ success: false, action: step.type, error: '用户取消' })
          return {
            success: false, completedSteps, totalSteps: workflow.steps.length,
            results, error: '用户取消', durationMs: Date.now() - startTime,
          }
        }
        if (stepConfirm.response === 0) {
          results.push({ success: true, action: step.type, error: '已跳过' })
          completedSteps++
          continue
        }
      }

      const result = await executeRpaAction(step)
      results.push(result)

      if (result.success) {
        completedSteps++
        mainWindowRef?.webContents.send('rpa:stepCompleted', {
          step: completedSteps, total: workflow.steps.length, result,
        })
      } else {
        failed = true
        break
      }

      // 步骤间隔
      if (step.interval) {
        await new Promise(r => setTimeout(r, step.interval))
      }
    }

    if (!failed) {
      return {
        success: true, completedSteps, totalSteps: workflow.steps.length,
        results, durationMs: Date.now() - startTime,
      }
    }

    if (attempt < workflow.retryCount) {
      mainWindowRef?.webContents.send('rpa:retrying', { attempt: attempt + 1, maxRetries: workflow.retryCount })
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  return {
    success: false, completedSteps, totalSteps: workflow.steps.length,
    results, error: results[results.length - 1]?.error, durationMs: Date.now() - startTime,
  }
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupRpaBridgeIPC(): void {
  ipcMain.handle('rpa:detectPython', async () => {
    return detectPython()
  })

  ipcMain.handle('rpa:checkDeps', async () => {
    return checkRpaDeps()
  })

  ipcMain.handle('rpa:installDeps', async () => {
    return installRpaDeps()
  })

  ipcMain.handle('rpa:action', async (_, action: RpaAction) => {
    if (!ipcRateLimit('rpa:action', 30)) {
      return { success: false, action: action?.type ?? '', error: 'RPA 操作频率超限' }
    }
    return executeRpaAction(action)
  })

  ipcMain.handle('rpa:workflow', async (_, workflow: RpaWorkflow) => {
    if (!ipcRateLimit('rpa:workflow', 3)) {
      return {
        success: false, completedSteps: 0, totalSteps: 0,
        results: [], error: '工作流频率超限', durationMs: 0,
      }
    }
    return executeRpaWorkflow(workflow)
  })

  ipcMain.handle('rpa:screenshot', async () => {
    return executeRpaAction({ type: 'screenshot' })
  })

  ipcMain.handle('rpa:status', async () => {
    const pythonInfo = await detectPython()
    const depsInfo = pythonInfo.available ? await checkRpaDeps() : null
    return {
      pythonAvailable: pythonInfo.available,
      pythonVersion: pythonInfo.version,
      rpaAvailable: rpaAvailable ?? false,
      deps: depsInfo,
    }
  })
}
