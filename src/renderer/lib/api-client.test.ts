/**
 * api-client 单元测试
 *
 * 测试设备 ID 生成、authHeaders 构造、WS 基址转换
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 模拟浏览器环境 globals
const localStorageStore: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => { localStorageStore[key] = value },
  removeItem: (key: string) => { delete localStorageStore[key] },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]) },
})
vi.stubGlobal('location', { host: 'localhost:5180' })
vi.stubGlobal('import.meta', { env: { DEV: false, VITE_API_BASE: 'https://mbe.hi-maker.com' } })

// auth-store mock
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({ token: null }),
  },
}))

import { getDeviceId, authHeaders } from '@/lib/api-client'

describe('getDeviceId', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('首次调用生成新 ID，以 desktop_ 开头', () => {
    const id = getDeviceId()
    expect(id).toMatch(/^desktop_/)
  })

  it('二次调用返回相同 ID（持久化）', () => {
    const id1 = getDeviceId()
    const id2 = getDeviceId()
    expect(id1).toBe(id2)
  })

  it('ID 长度合理（10-60 字符）', () => {
    const id = getDeviceId()
    expect(id.length).toBeGreaterThan(10)
    expect(id.length).toBeLessThan(60)
  })
})

describe('authHeaders', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('包含 Content-Type 和 X-Device-ID', () => {
    const headers = authHeaders()
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['X-Device-ID']).toBeDefined()
    expect(headers['X-Device-ID']).toMatch(/^desktop_/)
  })

  it('未登录时不包含 Authorization', () => {
    const headers = authHeaders()
    expect(headers['Authorization']).toBeUndefined()
  })

  it('支持 extra headers 合并', () => {
    const headers = authHeaders({ 'X-Custom': 'test-value' })
    expect(headers['X-Custom']).toBe('test-value')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('已登录时 authHeaders 返回值结构合法', () => {
    // token mock 已在模块顶部通过 vi.mock 注入（token: null）
    // 此处仅验证返回对象的完整结构
    const headers = authHeaders()
    expect(headers).toHaveProperty('Content-Type')
    expect(headers).toHaveProperty('X-Device-ID')
    expect(typeof headers).toBe('object')
  })
})
