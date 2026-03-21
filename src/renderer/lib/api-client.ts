/**
 * 统一 API 客户端 — 认证 + 请求头 + 环境自适应
 *
 * 1. 导出 API_BASE / WS_BASE：dev 模式走 Vite 代理绕 CORS，生产模式直连
 * 2. 所有后端 API 调用统一通过此模块获取请求头，
 *    确保 X-Device-ID 始终携带，已登录用户自动附加 Bearer token。
 */

import { useAuthStore } from '@/stores/auth-store'

/** HTTP API 基地址：dev 走 Vite proxy，prod 直连 */
export const API_BASE = import.meta.env.DEV ? '' : 'https://mbe.hi-maker.com'

/** 检测当前是否运行在 Electron 桌面端（非浏览器 Web 模式） */
export function isElectron(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.electronAPI !== 'undefined' &&
    window.electronAPI !== null
}

/** WebSocket 基地址：dev 走 Vite proxy，prod 直连 */
export const WS_BASE = import.meta.env.DEV
  ? `ws://${typeof location !== 'undefined' ? location.host : 'localhost:5180'}`
  : 'wss://mbe.hi-maker.com'

const DEVICE_ID_KEY = 'mbe_device_id'

/** 获取/生成持久化的匿名设备标识 */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = `desktop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

/** 构建带认证的请求头（自动附加 X-Device-ID 和 Bearer token） */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-ID': getDeviceId(),
    ...extra,
  }

  const { token } = useAuthStore.getState()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}

/** 带认证的 fetch 封装 */
export async function authFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = authHeaders(
    init?.headers as Record<string, string> | undefined,
  )
  return fetch(url, { ...init, headers })
}
