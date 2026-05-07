/**
 * 主进程结构化日志模块
 *
 * - 格式：ISO 时间戳 + 级别 + tag + 消息 + 可选 JSON extra
 * - 同时写入滚动日志文件（按日期，保留 7 天）
 * - info/debug 级别使用 process.stdout.write，不触发 ESLint no-console
 * - warn/error 级别使用 console.warn/error（ESLint 允许）
 */

import path from 'path'
import fs from 'fs'

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

const LOG_RETENTION_DAYS = 7

function formatEntry(level: LogLevel, tag: string, message: string, extra?: unknown): string {
  const ts = new Date().toISOString()
  const base = `${ts} [${level}] [${tag}] ${message}`
  if (extra !== undefined) {
    try {
      return `${base} ${JSON.stringify(extra)}`
    } catch {
      return `${base} [unserializable]`
    }
  }
  return base
}

class Logger {
  private logFile: string | null = null
  private logDir: string | null = null

  init(dataDir: string): void {
    try {
      this.logDir = path.join(dataDir, 'logs')
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true })
      }
      const date = new Date().toISOString().slice(0, 10)
      this.logFile = path.join(this.logDir, `mbe-${date}.log`)
      this._pruneOldLogs()
    } catch {
      /* 日志初始化失败不应中断主进程 */
    }
  }

  private _write(entry: string): void {
    if (!this.logFile) return
    try {
      fs.appendFileSync(this.logFile, entry + '\n', 'utf-8')
    } catch {
      /* 写入失败静默忽略，避免循环错误 */
    }
  }

  private _pruneOldLogs(): void {
    if (!this.logDir) return
    try {
      const cutoff = Date.now() - LOG_RETENTION_DAYS * 86400 * 1000
      const files = fs.readdirSync(this.logDir)
      for (const f of files) {
        if (!f.startsWith('mbe-') || !f.endsWith('.log')) continue
        const filePath = path.join(this.logDir!, f)
        const stat = fs.statSync(filePath)
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath)
        }
      }
    } catch {
      /* 清理失败静默 */
    }
  }

  debug(tag: string, message: string, extra?: unknown): void {
    if (process.env.NODE_ENV === 'production') return
    const entry = formatEntry('DEBUG', tag, message, extra)
    process.stdout.write(`${entry}\n`)
    this._write(entry)
  }

  info(tag: string, message: string, extra?: unknown): void {
    const entry = formatEntry('INFO', tag, message, extra)
    process.stdout.write(`${entry}\n`)
    this._write(entry)
  }

  warn(tag: string, message: string, extra?: unknown): void {
    const entry = formatEntry('WARN', tag, message, extra)
    console.warn(entry)
    this._write(entry)
  }

  error(tag: string, message: string, extra?: unknown): void {
    const entry = formatEntry('ERROR', tag, message, extra)
    console.error(entry)
    this._write(entry)
  }
}

export const logger = new Logger()
