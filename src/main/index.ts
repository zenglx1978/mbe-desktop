import { app, BrowserWindow, shell, ipcMain, dialog, safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import { autoUpdater } from 'electron-updater'
import { isReadPathAllowed, isWritePathAllowed, isSafeUrl } from './safe-path'
import { initDatabase, setupDatabaseIPC, closeDatabase, getDb, checkAutoBackup } from './database'
import { setupLocalCalcIPC } from './local-calc'
import { setupMigrationIPC, setMigrationDb } from './migration'
import { setupLocalAppBridgeIPC, setMainWindow } from './local-app-bridge'
import { setupWorkflowMinerIPC } from './workflow-miner'
import { setupCopilotBridgeIPC, setCopilotMainWindow, initCopilotBridge, destroyCopilotBridge } from './copilot-bridge'
import { setupAccessibilityBridgeIPC, setAccessibilityMainWindow, destroyAccessibilityBridge } from './accessibility-bridge'
import { setupEcommerceCsBridgeIPC, setEcommerceCSMainWindow } from './ecommerce-cs-bridge'
import { setupWebReaderIPC } from './web-reader'
import { setupLocalDataReaderIPC } from './local-data-reader'
import { setupFileIntelIPC, setFileIntelMainWindow } from './file-intel'
import { setupDataPipelineIPC, setPipelineMainWindow } from './data-pipeline'
import { setupSchedulerIPC, setSchedulerMainWindow, setSchedulerDb, initScheduler, destroyScheduler } from './scheduler'
import { setupDispatchIPC, setDispatchMainWindow, destroyDispatch } from './dispatch-bridge'
import { setupUserMemoryIPC, setMemoryMainWindow, setMemoryDb } from './user-memory'
import { setupLocalInferenceIPC, setInferenceDb, setInferenceMainWindow, initLocalInference } from './local-inference'
import { setupBehaviorObserverIPC, setBehaviorObserverMainWindow, setBehaviorObserverDb, startBehaviorObserver, stopBehaviorObserver } from './behavior-observer'
import { setupPatternRecognizerIPC, setPatternRecognizerMainWindow, setPatternRecognizerDb, startPatternRecognizer, stopPatternRecognizer } from './pattern-recognizer'
import { setupDownloadManagerIPC, setDownloadManagerMainWindow } from './download-manager'
import { setupErpAutoSetupIPC, setErpSetupMainWindow } from './erp-auto-setup'
import { setupRpaBridgeIPC, setRpaMainWindow } from './rpa-bridge'
import { setupFullPipelineIPC, setFullPipelineMainWindow } from './full-pipeline'

console.log(`[App] MBE Desktop starting — pid=${process.pid}, platform=${process.platform}, electron=${process.versions.electron}`)

process.on('uncaughtException', (err) => {
  console.error('[App] Uncaught exception:', err)
  try {
    const lockFile = path.join(app.getPath('userData'), '.mbe-running.lock')
    if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile)
  } catch { /* ignore */ }
  app.quit()
})

process.on('unhandledRejection', (reason) => {
  console.error('[App] Unhandled rejection:', reason)
})

if (process.platform === 'win32') {
  app.disableHardwareAcceleration()
}

// ==================== 自定义协议 mbe-desktop:// ====================

const PROTOCOL = 'mbe-desktop'

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL)
}

// ==================== 持久化会话存储 ====================

function getDataDir(): string {
  const docs = app.getPath('documents')
  return path.join(docs, 'MBE Desktop')
}

function getSessionPath(): string {
  return path.join(getDataDir(), 'session.json')
}

function ensureDataDir(): void {
  const dir = getDataDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readSession(): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(getSessionPath(), 'utf-8')
    const data = JSON.parse(raw)
    if (safeStorage.isEncryptionAvailable()) {
      for (const key of Object.keys(data)) {
        if (key.startsWith('_enc_') && typeof data[key] === 'string') {
          const realKey = key.slice(5)
          try {
            data[realKey] = safeStorage.decryptString(Buffer.from(data[key], 'base64'))
          } catch { /* 旧格式 */ }
          delete data[key]
        }
      }
    }
    return data
  } catch {
    return {}
  }
}

const SESSION_MAX_BYTES = 2 * 1024 * 1024 // 2MB

function writeSession(data: Record<string, unknown>): void {
  ensureDataDir()
  const toSave = { ...data }
  const sensitiveKeys = ['auth_token', 'token', 'accessToken', 'refreshToken', 'apiKey']
  if (safeStorage.isEncryptionAvailable()) {
    for (const key of sensitiveKeys) {
      if (toSave[key] && typeof toSave[key] === 'string') {
        toSave[`_enc_${key}`] = safeStorage.encryptString(toSave[key] as string).toString('base64')
        delete toSave[key]
      }
    }
  }
  const json = JSON.stringify(toSave, null, 2)
  if (Buffer.byteLength(json, 'utf-8') > SESSION_MAX_BYTES) {
    throw new Error('session 数据超出 2MB 限制')
  }
  fs.writeFileSync(getSessionPath(), json, 'utf-8')
}

// ==================== 单实例锁 ====================

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  console.log('[App] Another instance is running, exiting.')
  app.quit()
  process.exit(0)
}

// 清理上次异常退出遗留的锁标记文件（Windows 僵尸进程保护）
const lockFilePath = path.join(app.getPath('userData'), '.mbe-running.lock')

function writeLockFile(): void {
  try {
    fs.writeFileSync(lockFilePath, JSON.stringify({ pid: process.pid, time: Date.now() }))
  } catch { /* ignore */ }
}

function removeLockFile(): void {
  try {
    if (fs.existsSync(lockFilePath)) fs.unlinkSync(lockFilePath)
  } catch { /* ignore */ }
}

writeLockFile()

let mainWindow: BrowserWindow | null = null

const isDev = !!process.env.VITE_DEV_SERVER_URL
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5180'

let pendingAuthUrl: string | null = null

const SAFE_TOKEN_RE = /^[A-Za-z0-9\-_./+=]{10,4096}$/
const SAFE_EMAIL_RE = /^[^<>"';&|`$]{1,256}$/
const SAFE_REF_RE = /^[A-Za-z0-9\-_]{1,64}$/

function handleDeepLink(url: string) {
  if (!url.startsWith(`${PROTOCOL}://`)) return
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'auth' || parsed.pathname.startsWith('/auth')) {
      const token = parsed.searchParams.get('token') || ''
      const email = parsed.searchParams.get('email') || ''
      const name = parsed.searchParams.get('name') || ''
      const refreshToken = parsed.searchParams.get('refresh_token') || ''
      const ref = parsed.searchParams.get('ref') || ''

      if (token && !SAFE_TOKEN_RE.test(token)) return
      if (refreshToken && !SAFE_TOKEN_RE.test(refreshToken)) return
      if (email && !SAFE_EMAIL_RE.test(email)) return
      if (name && !SAFE_EMAIL_RE.test(name)) return

      if (ref && SAFE_REF_RE.test(ref) && mainWindow) {
        mainWindow.webContents.send('referral:set', { code: ref })
      }
      if (token && mainWindow) {
        mainWindow.webContents.send('auth:callback', { token, email, name, refreshToken })
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      } else if (token) {
        pendingAuthUrl = url
      }
    }
  } catch {
    // malformed URL
  }
}

// ==================== 窗口创建 ====================

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'MBE Desktop — AI 专业服务',
    icon: getIconPath(),
    show: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    autoHideMenuBar: true,
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: 'bottom' })
    }
    if (pendingAuthUrl) {
      handleDeepLink(pendingAuthUrl)
      pendingAuthUrl = null
    }
  })

  // CSP: 限制脚本/样式/连接来源
  // connect-src 通过环境变量 MBE_API_ORIGIN 可配置，默认 mbe.hi-maker.com
  const apiOrigin = process.env.MBE_API_ORIGIN || 'mbe.hi-maker.com'
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev
      ? `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:* http://localhost:* https://${apiOrigin} wss://${apiOrigin}; img-src 'self' data: https:; font-src 'self' data:; object-src 'none'; base-uri 'self';`
      : `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://${apiOrigin} wss://${apiOrigin}; img-src 'self' data: https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self';`
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(devServerUrl)
  } else {
    const indexPath = path.join(__dirname, '..', 'renderer', 'index.html')
    mainWindow.loadFile(indexPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    setMainWindow(null)
  })
}

function getIconPath(): string | undefined {
  const candidates = [
    path.join(__dirname, '..', '..', 'build', 'icon.png'),
    path.join(__dirname, '..', '..', 'build', 'icon.ico'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return undefined
}

// ==================== 自动更新 ====================

let autoUpdateInterval: ReturnType<typeof setInterval> | null = null
let autoUpdateInitTimer: ReturnType<typeof setTimeout> | null = null

function setupAutoUpdater() {
  if (isDev) {
    console.log('[AutoUpdater] Skipped in dev mode')
    return
  }
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version)
    sendUpdateStatus('available', { version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus('downloading', {
      progress: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info: any) => {
    console.log('[AutoUpdater] Update downloaded:', info.version)
    const downloadedFile: string = info.downloadedFile || ''

    if (downloadedFile.endsWith('.msi')) {
      const resolved = path.resolve(downloadedFile)
      const tempDir = path.resolve(app.getPath('temp'))
      const userDataDir = path.resolve(app.getPath('userData'))
      const inSafeDir = resolved.startsWith(tempDir + path.sep) || resolved.startsWith(userDataDir + path.sep)

      if (!inSafeDir || /[;&|`$]/.test(resolved)) {
        console.error('[AutoUpdater] 安全校验失败，跳过 MSI 安装:', resolved)
        sendUpdateStatus('error', { error: '安装包安全校验失败' })
        return
      }

      sendUpdateStatus('installing', { version: info.version })
      setTimeout(() => {
        const proc = spawn('msiexec', ['/passive', '/norestart', '/i', resolved], {
          detached: true,
          stdio: 'ignore',
        })
        proc.unref()
        app.quit()
      }, 1500)
    } else {
      sendUpdateStatus('installing', { version: info.version })
      // isSilent=false: 让 NSIS 显示安装界面并正确处理 UAC 提权（perMachine 必须）
      // forceRunAfter=true: 配合 package.json runAfterFinish 确保安装后重启
      setTimeout(() => autoUpdater.quitAndInstall(false, true), 2000)
    }
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] No update available')
  })

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err.message)
    sendUpdateStatus('error', { error: err.message })
  })

  autoUpdateInterval = setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[AutoUpdater] Periodic check failed:', err?.message)
    })
  }, 30 * 60 * 1000)

  autoUpdateInitTimer = setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[AutoUpdater] Initial check failed:', err?.message)
    })
    autoUpdateInitTimer = null
  }, 10 * 1000)
}

function cleanupAutoUpdater(): void {
  if (autoUpdateInterval) { clearInterval(autoUpdateInterval); autoUpdateInterval = null }
  if (autoUpdateInitTimer) { clearTimeout(autoUpdateInitTimer); autoUpdateInitTimer = null }
}

function sendUpdateStatus(status: string, data?: Record<string, unknown>) {
  if (mainWindow) {
    mainWindow.webContents.send('update:status', { status, ...data })
  }
}

ipcMain.on('update:check', () => {
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[AutoUpdater] Manual check failed:', err?.message)
    sendUpdateStatus('error', { error: err?.message || '检查更新失败' })
  })
})
ipcMain.on('update:download', () => {
  autoUpdater.downloadUpdate().catch((err) => {
    console.error('[AutoUpdater] Download failed:', err?.message)
    sendUpdateStatus('error', { error: err?.message || '下载更新失败' })
  })
})

// ==================== App 生命周期 ====================

app.whenReady().then(async () => {
  console.log('[App] whenReady fired, starting initialization...')

  try {
    await initDatabase()
  } catch (err) {
    console.error('[App] Database init failed, continuing with null db:', err)
  }

  setupDatabaseIPC()
  checkAutoBackup()
  setupLocalCalcIPC()
  setupLocalAppBridgeIPC()
  setupWorkflowMinerIPC()
  setupCopilotBridgeIPC()
  setupAccessibilityBridgeIPC()
  setupEcommerceCsBridgeIPC()
  setupWebReaderIPC()
  setupLocalDataReaderIPC()
  setupFileIntelIPC()
  setupDataPipelineIPC()
  setupSchedulerIPC()
  setupDispatchIPC()
  setupUserMemoryIPC()
  setupLocalInferenceIPC()
  setupBehaviorObserverIPC()
  setupPatternRecognizerIPC()
  setupDownloadManagerIPC()
  setupErpAutoSetupIPC()
  setupRpaBridgeIPC()
  setupFullPipelineIPC()
  setMigrationDb(getDb())
  setupMigrationIPC()

  createWindow()
  console.log('[App] Window created successfully')

  setMainWindow(mainWindow)
  setCopilotMainWindow(mainWindow)
  setAccessibilityMainWindow(mainWindow)
  setEcommerceCSMainWindow(mainWindow)
  setFileIntelMainWindow(mainWindow)
  setPipelineMainWindow(mainWindow)
  setSchedulerMainWindow(mainWindow!)
  setSchedulerDb(getDb())
  setDispatchMainWindow(mainWindow!)
  setMemoryMainWindow(mainWindow!)
  setMemoryDb(getDb())
  setInferenceMainWindow(mainWindow!)
  setInferenceDb(getDb())
  initLocalInference()
  initScheduler()
  setBehaviorObserverMainWindow(mainWindow!)
  setBehaviorObserverDb(getDb())
  startBehaviorObserver()
  setPatternRecognizerMainWindow(mainWindow!)
  setPatternRecognizerDb(getDb())
  startPatternRecognizer()
  setDownloadManagerMainWindow(mainWindow)
  setErpSetupMainWindow(mainWindow)
  setRpaMainWindow(mainWindow)
  setFullPipelineMainWindow(mainWindow)
  initCopilotBridge()
  setupAutoUpdater()

  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLink(url)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  console.log('[App] Initialization complete')
}).catch((err) => {
  console.error('[App] FATAL: whenReady initialization failed:', err)
  dialog.showErrorBox(
    'MBE Desktop 启动失败',
    `初始化过程中出现错误，请重启应用。\n\n错误信息: ${err?.message || err}`
  )
  app.quit()
})

app.on('second-instance', (_event, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
  const deepLinkUrl = argv.find(arg => arg.startsWith(`${PROTOCOL}://`))
  if (deepLinkUrl) {
    handleDeepLink(deepLinkUrl)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

let isQuitting = false

app.on('before-quit', () => {
  if (isQuitting) return
  isQuitting = true
  console.log('[Quit] before-quit fired, cleaning up...')

  try { cleanupAutoUpdater() } catch (e) { console.error('[Quit] cleanupAutoUpdater:', e) }
  try { stopBehaviorObserver() } catch (e) { console.error('[Quit] stopBehaviorObserver:', e) }
  try { stopPatternRecognizer() } catch (e) { console.error('[Quit] stopPatternRecognizer:', e) }
  try { destroyScheduler() } catch (e) { console.error('[Quit] destroyScheduler:', e) }
  try { destroyDispatch() } catch (e) { console.error('[Quit] destroyDispatch:', e) }
  try { destroyCopilotBridge() } catch (e) { console.error('[Quit] destroyCopilotBridge:', e) }
  try { destroyAccessibilityBridge() } catch (e) { console.error('[Quit] destroyAccessibilityBridge:', e) }
  try { closeDatabase() } catch (e) { console.error('[Quit] closeDatabase:', e) }

  removeLockFile()
  console.log('[Quit] Cleanup done')
})

// 兜底：will-quit 后如果事件循环仍未退出，强制终止
app.on('will-quit', () => {
  removeLockFile()
  setTimeout(() => {
    console.warn('[Quit] 强制退出（超时 5s）')
    process.exit(0)
  }, 5000).unref()
})

// ==================== IPC Handlers ====================

ipcMain.handle('dialog:openFile', async (_, options?: {
  title?: string
  filters?: { name: string; extensions: string[] }[]
}) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: options?.title || '选择文件',
    filters: options?.filters || [
      { name: '文档', extensions: ['pdf', 'doc', 'docx', 'txt'] },
      { name: '图片/PDF', extensions: ['jpg', 'jpeg', 'png', 'pdf', 'bmp'] },
      { name: 'Excel', extensions: ['xlsx', 'xls', 'csv'] },
      { name: '所有文件', extensions: ['*'] },
    ],
    properties: ['openFile', 'multiSelections'],
  })
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('dialog:saveFile', async (_, options?: {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
}) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: options?.title || '导出文件',
    defaultPath: options?.defaultPath,
    filters: options?.filters || [
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'Excel', extensions: ['xlsx'] },
      { name: 'CSV', extensions: ['csv'] },
    ],
  })
  return result.canceled ? null : result.filePath
})

ipcMain.handle('fs:readFileBase64', async (_, filePath: string) => {
  try {
    const resolved = path.resolve(filePath)
    if (!isReadPathAllowed(resolved)) {
      return { success: false, error: `路径不在允许的读取目录中: ${path.basename(filePath)}` }
    }
    const buffer = fs.readFileSync(resolved)
    return { success: true, data: buffer.toString('base64'), name: path.basename(resolved) }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('fs:writeFile', async (_, filePath: string, base64Data: string) => {
  try {
    const resolved = path.resolve(filePath)
    if (!isWritePathAllowed(resolved)) {
      return { success: false, error: `路径不在允许的写入目录中: ${path.basename(filePath)}` }
    }
    const buffer = Buffer.from(base64Data, 'base64')
    const dir = path.dirname(resolved)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(resolved, buffer)
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('export:printToPDF', async (_, html: string) => {
  let pdfWin: BrowserWindow | null = null
  try {
    pdfWin = new BrowserWindow({
      show: false, width: 800, height: 600,
      webPreferences: {
        offscreen: true,
        javascript: false,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    })
    const sanitized = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=/gi, ' data-removed=')
    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(sanitized)}`)
    await new Promise(r => setTimeout(r, 300))
    const pdfBuffer = await pdfWin.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { marginType: 'custom', top: 1.2, bottom: 1.2, left: 0.8, right: 0.8 },
    })
    return { success: true, data: Buffer.from(pdfBuffer).toString('base64') }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  } finally {
    pdfWin?.close()
  }
})

ipcMain.handle('shell:openPath', async (_, filePath: string) => {
  try {
    const resolved = path.resolve(filePath)
    if (!isReadPathAllowed(resolved)) {
      return { success: false, error: `路径不在允许的目录中: ${path.basename(filePath)}` }
    }
    await shell.openPath(resolved)
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('shell:openExternal', async (_, url: string) => {
  if (typeof url !== 'string' || !isSafeUrl(url)) return
  await shell.openExternal(url)
})

ipcMain.handle('app:getInfo', () => ({
  version: app.getVersion(),
  name: app.getName(),
  platform: process.platform,
  arch: process.arch,
  isDev,
  paths: {
    userData: app.getPath('userData'),
    documents: app.getPath('documents'),
    dataDir: getDataDir(),
    temp: app.getPath('temp'),
  },
}))

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window:close', () => mainWindow?.close())

// ==================== 持久化会话 IPC ====================

ipcMain.handle('session:read', () => readSession())

ipcMain.handle('session:write', (_, data: Record<string, unknown>) => {
  if (!data || typeof data !== 'object') return
  const forbidden = Object.keys(data).some(k => k.startsWith('_enc_'))
  if (forbidden) return
  const current = readSession()
  const merged = { ...current, ...data }
  writeSession(merged)
  return merged
})

ipcMain.handle('session:get', (_, key: string) => {
  const session = readSession()
  return session[key] ?? null
})

ipcMain.handle('session:set', (_, key: string, value: unknown) => {
  if (typeof key !== 'string' || !key || key.length > 128) return
  if (key.startsWith('_enc_')) return
  const session = readSession()
  session[key] = value
  writeSession(session)
})

ipcMain.handle('session:remove', (_, key: string) => {
  const session = readSession()
  delete session[key]
  writeSession(session)
})

// ==================== 数据备份 IPC ====================

ipcMain.handle('backup:saveFile', async (_, data: ArrayBuffer, defaultName: string) => {
  try {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'MBE Desktop 备份', extensions: ['mbedesktop'] }],
    })
    if (result.canceled || !result.filePath) return { success: false }
    fs.writeFileSync(result.filePath, Buffer.from(data))
    return { success: true, path: result.filePath }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('backup:loadFile', async () => {
  try {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'MBE Desktop 备份', extensions: ['mbedesktop'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const data = fs.readFileSync(filePath)
    return { data: data.buffer, name: path.basename(filePath) }
  } catch {
    return null
  }
})
