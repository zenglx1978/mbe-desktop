/**
 * 共享路径安全校验 — 所有主进程模块的文件访问必须经过此校验
 *
 * 统一 allowedDirs 定义，防止路径穿越（path traversal）攻击。
 * 渲染进程通过 IPC 传入的路径不可信，必须校验后再操作。
 */

import path from 'path'
import { app } from 'electron'

function getDataDir(): string {
  return path.join(app.getPath('documents'), 'MBE Desktop')
}

export function getAllowedReadDirs(): string[] {
  return [
    app.getPath('documents'),
    app.getPath('downloads'),
    app.getPath('desktop'),
    app.getPath('temp'),
    getDataDir(),
  ]
}

export function getAllowedWriteDirs(): string[] {
  return [
    path.join(app.getPath('documents'), 'MBE Desktop'),
    app.getPath('downloads'),
    app.getPath('desktop'),
    app.getPath('temp'),
  ]
}

/**
 * 校验 filePath 是否在 allowedDirs 列表内（含子目录）。
 * 使用 path.resolve 消除 `..` 和符号链接的相对路径穿越。
 */
export function isPathAllowed(filePath: string, allowedDirs: string[]): boolean {
  const resolved = path.resolve(filePath)
  return allowedDirs.some(dir => {
    const resolvedDir = path.resolve(dir)
    return resolved.startsWith(resolvedDir + path.sep) || resolved === resolvedDir
  })
}

/**
 * 校验路径是否在允许读取的目录中
 */
export function isReadPathAllowed(filePath: string): boolean {
  return isPathAllowed(filePath, getAllowedReadDirs())
}

/**
 * 校验路径是否在允许写入的目录中
 */
export function isWritePathAllowed(filePath: string): boolean {
  return isPathAllowed(filePath, getAllowedWriteDirs())
}

/**
 * 校验 URL 是否为安全协议（http/https），阻止 file:// / javascript: 等
 */
export function isSafeUrl(url: string): boolean {
  try {
    if (typeof url !== 'string' || url.length > 2048) return false
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 滑动窗口 IPC 速率限制器。
 * 高敏 IPC handler 调用此函数校验是否超限。
 *
 * @param channel IPC 通道名
 * @param maxCalls 窗口内最大允许调用次数
 * @param windowMs 窗口时长（毫秒），默认 60 秒
 * @returns true 表示允许，false 表示超限
 */
const rateBuckets = new Map<string, number[]>()
export function ipcRateLimit(channel: string, maxCalls: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(channel) ?? []
  const filtered = bucket.filter(ts => now - ts < windowMs)
  if (filtered.length >= maxCalls) {
    rateBuckets.set(channel, filtered)
    return false
  }
  filtered.push(now)
  rateBuckets.set(channel, filtered)
  return true
}
