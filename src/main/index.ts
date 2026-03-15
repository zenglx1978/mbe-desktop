import { app, BrowserWindow, shell, ipcMain, dialog, safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'
import { autoUpdater } from 'electron-updater'
import { initDatabase, setupDatabaseIPC, closeDatabase, getDb } from './database'
import { setupLocalCalcIPC } from './local-calc'
import { setupMigrationIPC, setMigrationDb } from './migration'

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
  fs.writeFileSync(getSessionPath(), JSON.stringify(toSave, null, 2), 'utf-8')
}

// ==================== 单实例锁 ====================

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

const isDev = !!process.env.VITE_DEV_SERVER_URL
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5180'

let pendingAuthUrl: string | null = null

function handleDeepLink(url: string) {
  if (!url.startsWith(`${PROTOCOL}://`)) return
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'auth' || parsed.pathname.startsWith('/auth')) {
      const token = parsed.searchParams.get('token') || ''
      const email = parsed.searchParams.get('email') || ''
      const name = parsed.searchParams.get('name') || ''
      const refreshToken = parsed.searchParams.get('refresh_token') || ''
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
      sandbox: false,
      webSecurity: !isDev,
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

function setupAutoUpdater() {
  if (isDev) {
    console.log('[AutoUpdater] Skipped in dev mode')
    return
  }
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus('available', { version: info.version })
  })
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus('installing', { version: info.version })
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 2000)
  })
  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err.message)
  })

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 30 * 60 * 1000)

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 10 * 1000)
}

function sendUpdateStatus(status: string, data?: Record<string, unknown>) {
  if (mainWindow) {
    mainWindow.webContents.send('update:status', { status, ...data })
  }
}

ipcMain.on('update:check', () => {
  autoUpdater.checkForUpdates().catch(() => {})
})
ipcMain.on('update:download', () => {
  autoUpdater.downloadUpdate().catch(() => {})
})

// ==================== App 生命周期 ====================

app.whenReady().then(() => {
  initDatabase()
  setupDatabaseIPC()
  setupLocalCalcIPC()
  setMigrationDb(getDb())
  setupMigrationIPC()
  createWindow()
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
    closeDatabase()
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDatabase()
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
    const buffer = fs.readFileSync(filePath)
    return { success: true, data: buffer.toString('base64'), name: path.basename(filePath) }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('fs:writeFile', async (_, filePath: string, base64Data: string) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64')
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, buffer)
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('export:printToPDF', async (_, html: string) => {
  let pdfWin: BrowserWindow | null = null
  try {
    pdfWin = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { offscreen: true } })
    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
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
    await shell.openPath(filePath)
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('shell:openExternal', async (_, url: string) => {
  if (!url.startsWith('http://') && !url.startsWith('https://')) return
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
