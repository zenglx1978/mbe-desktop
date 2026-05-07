/**
 * safe-path 单元测试
 *
 * 测试路径白名单校验、URL 安全校验、IPC 速率限制
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

// electron app 模块在 Node 测试环境中不可用，需 mock
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      const map: Record<string, string> = {
        documents: '/mock/documents',
        downloads: '/mock/downloads',
        desktop: '/mock/desktop',
        temp: '/tmp',
        userData: '/mock/userData',
      }
      return map[name] ?? `/mock/${name}`
    },
  },
}))

import {
  isReadPathAllowed,
  isWritePathAllowed,
  isSafeUrl,
  ipcRateLimit,
  isPathAllowed,
  getAllowedReadDirs,
  getAllowedWriteDirs,
} from './safe-path'

describe('getAllowedReadDirs', () => {
  it('包含 documents / downloads / desktop / temp', () => {
    const dirs = getAllowedReadDirs()
    expect(dirs).toContain('/mock/documents')
    expect(dirs).toContain('/mock/downloads')
    expect(dirs).toContain('/mock/desktop')
    expect(dirs).toContain('/tmp')
  })
})

describe('getAllowedWriteDirs', () => {
  it('包含 MBE Desktop 子目录', () => {
    const dirs = getAllowedWriteDirs()
    expect(dirs.some(d => d.includes('MBE Desktop'))).toBe(true)
  })

  it('不包含 temp 以外的系统目录', () => {
    const dirs = getAllowedWriteDirs()
    expect(dirs).not.toContain('/mock/userData')
  })
})

describe('isPathAllowed', () => {
  const allowedDirs = ['/allowed/dir']

  it('直接匹配允许目录返回 true', () => {
    expect(isPathAllowed('/allowed/dir', allowedDirs)).toBe(true)
  })

  it('子路径返回 true', () => {
    expect(isPathAllowed('/allowed/dir/subdir/file.txt', allowedDirs)).toBe(true)
  })

  it('路径穿越（../）被拒绝', () => {
    expect(isPathAllowed('/allowed/dir/../etc/passwd', allowedDirs)).toBe(false)
  })

  it('完全不同的目录被拒绝', () => {
    expect(isPathAllowed('/forbidden/path/file.txt', allowedDirs)).toBe(false)
  })

  it('相似前缀但非子目录被拒绝（防 prefix 伪造）', () => {
    expect(isPathAllowed('/allowed/dir_evil/file.txt', allowedDirs)).toBe(false)
  })
})

describe('isReadPathAllowed', () => {
  it('documents 子路径允许读取', () => {
    expect(isReadPathAllowed('/mock/documents/report.pdf')).toBe(true)
  })

  it('系统目录被拒绝', () => {
    expect(isReadPathAllowed('/etc/passwd')).toBe(false)
    expect(isReadPathAllowed('/root/.ssh/id_rsa')).toBe(false)
  })
})

describe('isWritePathAllowed', () => {
  it('MBE Desktop 子目录允许写入', () => {
    expect(isWritePathAllowed('/mock/documents/MBE Desktop/data.db')).toBe(true)
  })

  it('downloads 允许写入', () => {
    expect(isWritePathAllowed('/mock/downloads/report.pdf')).toBe(true)
  })

  it('系统目录禁止写入', () => {
    expect(isWritePathAllowed('/etc/cron.d/malicious')).toBe(false)
  })
})

describe('isSafeUrl', () => {
  it('https URL 安全', () => {
    expect(isSafeUrl('https://mbe.hi-maker.com/api/health')).toBe(true)
  })

  it('http URL 安全', () => {
    expect(isSafeUrl('http://localhost:8003/api')).toBe(true)
  })

  it('file:// 不安全', () => {
    expect(isSafeUrl('file:///etc/passwd')).toBe(false)
  })

  it('javascript: 不安全', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
  })

  it('超长 URL 拒绝', () => {
    expect(isSafeUrl('https://mbe.hi-maker.com/' + 'a'.repeat(3000))).toBe(false)
  })

  it('空字符串拒绝', () => {
    expect(isSafeUrl('')).toBe(false)
  })
})

describe('ipcRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('窗口内请求未超限时返回 true', () => {
    for (let i = 0; i < 5; i++) {
      expect(ipcRateLimit('test:channel1', 10, 60_000)).toBe(true)
    }
  })

  it('超过最大次数返回 false', () => {
    const channel = 'test:ratelimit-exceed'
    for (let i = 0; i < 3; i++) {
      ipcRateLimit(channel, 3, 60_000)
    }
    expect(ipcRateLimit(channel, 3, 60_000)).toBe(false)
  })

  it('窗口过期后重置计数', () => {
    const channel = 'test:ratelimit-reset'
    for (let i = 0; i < 3; i++) {
      ipcRateLimit(channel, 3, 60_000)
    }
    expect(ipcRateLimit(channel, 3, 60_000)).toBe(false)

    // 推进 61 秒
    vi.advanceTimersByTime(61_000)
    expect(ipcRateLimit(channel, 3, 60_000)).toBe(true)
  })
})
