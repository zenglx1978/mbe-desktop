// DownloadManager — MBE Desktop 文件下载管理器
// 支持断点续传、进度回调、SHA256 校验、并发控制
// 安全策略：只下载到允许的目录（downloads / temp / MBE Desktop）

import { ipcMain, BrowserWindow, net } from 'electron'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { isWritePathAllowed, isSafeUrl, ipcRateLimit } from './safe-path'

// ────────────────────── 类型定义 ──────────────────────

export interface DownloadRequest {
  url: string
  savePath?: string
  fileName?: string
  expectedHash?: string
  hashAlgorithm?: 'sha256' | 'md5'
  overwrite?: boolean
  headers?: Record<string, string>
}

export interface DownloadProgress {
  id: string
  url: string
  savePath: string
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'failed' | 'verifying'
  bytesReceived: number
  totalBytes: number
  percent: number
  speed: number
  error?: string
  hashMatch?: boolean
}

interface ActiveDownload {
  id: string
  request: DownloadRequest
  savePath: string
  tempPath: string
  bytesReceived: number
  totalBytes: number
  startTime: number
  lastProgressTime: number
  abortController?: AbortController
  writeStream?: fs.WriteStream
}

// ────────────────────── 状态管理 ──────────────────────

const activeDownloads = new Map<string, ActiveDownload>()
let mainWindowRef: BrowserWindow | null = null
let downloadIdCounter = 0

export function setDownloadManagerMainWindow(win: BrowserWindow | null): void {
  mainWindowRef = win
}

function generateDownloadId(): string {
  return `dl_${Date.now()}_${++downloadIdCounter}`
}

function getDefaultDownloadDir(): string {
  return app.getPath('downloads')
}

function emitProgress(download: ActiveDownload, status: DownloadProgress['status'], error?: string, hashMatch?: boolean): void {
  const now = Date.now()
  const elapsed = (now - download.startTime) / 1000
  const speed = elapsed > 0 ? download.bytesReceived / elapsed : 0

  const progress: DownloadProgress = {
    id: download.id,
    url: download.request.url,
    savePath: download.savePath,
    status,
    bytesReceived: download.bytesReceived,
    totalBytes: download.totalBytes,
    percent: download.totalBytes > 0 ? Math.round((download.bytesReceived / download.totalBytes) * 100) : 0,
    speed,
    error,
    hashMatch,
  }

  mainWindowRef?.webContents.send('download:progress', progress)
}

// ────────────────────── 核心下载逻辑 ──────────────────────

async function startDownload(req: DownloadRequest): Promise<DownloadProgress> {
  if (!isSafeUrl(req.url)) {
    return {
      id: '', url: req.url, savePath: '', status: 'failed',
      bytesReceived: 0, totalBytes: 0, percent: 0, speed: 0,
      error: '仅支持 http/https 协议',
    }
  }

  const dir = req.savePath ? path.dirname(req.savePath) : getDefaultDownloadDir()
  const fileName = req.fileName || extractFileName(req.url)
  const savePath = req.savePath || path.join(dir, fileName)

  if (!isWritePathAllowed(savePath)) {
    return {
      id: '', url: req.url, savePath, status: 'failed',
      bytesReceived: 0, totalBytes: 0, percent: 0, speed: 0,
      error: '目标路径不在允许的写入目录中',
    }
  }

  if (!req.overwrite && fs.existsSync(savePath)) {
    return {
      id: '', url: req.url, savePath, status: 'failed',
      bytesReceived: 0, totalBytes: 0, percent: 0, speed: 0,
      error: '文件已存在，设置 overwrite=true 覆盖',
    }
  }

  const id = generateDownloadId()
  const tempPath = savePath + '.mbe-download'

  const download: ActiveDownload = {
    id,
    request: req,
    savePath,
    tempPath,
    bytesReceived: 0,
    totalBytes: 0,
    startTime: Date.now(),
    lastProgressTime: Date.now(),
  }
  activeDownloads.set(id, download)

  // 断点续传：检查已有临时文件
  let resumeOffset = 0
  if (fs.existsSync(tempPath)) {
    const stat = fs.statSync(tempPath)
    resumeOffset = stat.size
    download.bytesReceived = resumeOffset
  }

  emitProgress(download, 'downloading')

  try {
    const result = await executeDownload(download, resumeOffset)
    return result
  } catch (err) {
    const errMsg = (err as Error).message
    emitProgress(download, 'failed', errMsg)
    activeDownloads.delete(id)
    return {
      id, url: req.url, savePath, status: 'failed',
      bytesReceived: download.bytesReceived, totalBytes: download.totalBytes,
      percent: 0, speed: 0, error: errMsg,
    }
  }
}

function executeDownload(download: ActiveDownload, resumeOffset: number): Promise<DownloadProgress> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      'User-Agent': 'MBE-Desktop/1.0',
      ...(download.request.headers || {}),
    }
    if (resumeOffset > 0) {
      headers['Range'] = `bytes=${resumeOffset}-`
    }

    const request = net.request({
      url: download.request.url,
      method: 'GET',
    })

    for (const [key, val] of Object.entries(headers)) {
      request.setHeader(key, val)
    }

    const writeStream = fs.createWriteStream(download.tempPath, {
      flags: resumeOffset > 0 ? 'a' : 'w',
    })
    download.writeStream = writeStream

    request.on('response', (response) => {
      const contentLength = parseInt(response.headers['content-length'] as string, 10) || 0
      const statusCode = response.statusCode

      if (statusCode >= 400) {
        writeStream.close()
        reject(new Error(`HTTP ${statusCode}`))
        return
      }

      if (statusCode === 206) {
        // 断点续传成功
        download.totalBytes = resumeOffset + contentLength
      } else {
        download.totalBytes = contentLength
        download.bytesReceived = 0
      }

      response.on('data', (chunk: Buffer) => {
        writeStream.write(chunk)
        download.bytesReceived += chunk.length

        const now = Date.now()
        if (now - download.lastProgressTime > 500) {
          download.lastProgressTime = now
          emitProgress(download, 'downloading')
        }
      })

      response.on('end', async () => {
        writeStream.end()

        // 校验文件完整性
        if (download.request.expectedHash) {
          emitProgress(download, 'verifying')
          const hashMatch = await verifyFileHash(
            download.tempPath,
            download.request.expectedHash,
            download.request.hashAlgorithm || 'sha256'
          )
          if (!hashMatch) {
            fs.unlinkSync(download.tempPath)
            activeDownloads.delete(download.id)
            emitProgress(download, 'failed', '文件校验失败', false)
            resolve({
              id: download.id, url: download.request.url, savePath: download.savePath,
              status: 'failed', bytesReceived: download.bytesReceived,
              totalBytes: download.totalBytes, percent: 100, speed: 0,
              error: '文件 Hash 校验失败', hashMatch: false,
            })
            return
          }
        }

        // 移动临时文件到目标路径
        if (fs.existsSync(download.savePath)) {
          fs.unlinkSync(download.savePath)
        }
        fs.renameSync(download.tempPath, download.savePath)
        activeDownloads.delete(download.id)

        emitProgress(download, 'completed', undefined, true)
        resolve({
          id: download.id, url: download.request.url, savePath: download.savePath,
          status: 'completed', bytesReceived: download.bytesReceived,
          totalBytes: download.totalBytes, percent: 100,
          speed: download.bytesReceived / ((Date.now() - download.startTime) / 1000),
          hashMatch: true,
        })
      })

      response.on('error', (err) => {
        writeStream.close()
        reject(err)
      })
    })

    request.on('error', (err) => {
      writeStream.close()
      reject(err)
    })

    request.end()
  })
}

// ────────────────────── 文件校验 ──────────────────────

function verifyFileHash(filePath: string, expectedHash: string, algorithm: string): Promise<boolean> {
  return new Promise((resolve) => {
    const hash = crypto.createHash(algorithm)
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => {
      const actual = hash.digest('hex')
      resolve(actual.toLowerCase() === expectedHash.toLowerCase())
    })
    stream.on('error', () => resolve(false))
  })
}

// ────────────────────── 工具函数 ──────────────────────

function extractFileName(url: string): string {
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname
    const segments = pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1] || 'download'
    return decodeURIComponent(last)
  } catch {
    return `download_${Date.now()}`
  }
}

function cancelDownload(downloadId: string): { success: boolean; error?: string } {
  const download = activeDownloads.get(downloadId)
  if (!download) return { success: false, error: '下载任务不存在' }

  download.writeStream?.close()
  download.abortController?.abort()
  activeDownloads.delete(downloadId)

  // 清理临时文件
  try {
    if (fs.existsSync(download.tempPath)) {
      fs.unlinkSync(download.tempPath)
    }
  } catch { /* 忽略清理失败 */ }

  emitProgress(download, 'failed', '用户取消')
  return { success: true }
}

function getDownloadStatus(): DownloadProgress[] {
  return Array.from(activeDownloads.values()).map(d => ({
    id: d.id,
    url: d.request.url,
    savePath: d.savePath,
    status: 'downloading' as const,
    bytesReceived: d.bytesReceived,
    totalBytes: d.totalBytes,
    percent: d.totalBytes > 0 ? Math.round((d.bytesReceived / d.totalBytes) * 100) : 0,
    speed: d.bytesReceived / ((Date.now() - d.startTime) / 1000),
  }))
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupDownloadManagerIPC(): void {
  ipcMain.handle('download:start', async (_, req: DownloadRequest): Promise<DownloadProgress> => {
    if (!ipcRateLimit('download:start', 5)) {
      return {
        id: '', url: req?.url ?? '', savePath: '', status: 'failed',
        bytesReceived: 0, totalBytes: 0, percent: 0, speed: 0,
        error: '下载频率超限，请稍后重试',
      }
    }
    return startDownload(req)
  })

  ipcMain.handle('download:cancel', (_, downloadId: string) => {
    return cancelDownload(downloadId)
  })

  ipcMain.handle('download:status', () => {
    return getDownloadStatus()
  })

  ipcMain.handle('download:verify', async (_, filePath: string, expectedHash: string, algorithm?: string) => {
    if (!fs.existsSync(filePath)) return { success: false, error: '文件不存在' }
    const match = await verifyFileHash(filePath, expectedHash, algorithm || 'sha256')
    return { success: true, match }
  })
}
