/**
 * Dispatch Store — 远程触发管理（手机/PWA → 桌面端执行 → 推回结果）
 *
 * 通过 Electron preload 暴露的 dispatch IPC 与主进程 DispatchBridge 通信。
 * 浏览器模式下降级为 HTTP 轮询。
 */
import { create } from 'zustand'

const api = (window as any).electronAPI

export type DispatchConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface DispatchResult {
  request_id: string
  status: string
  result_summary: string
  completed_at: string
}

interface DispatchState {
  connectionStatus: DispatchConnectionStatus
  results: DispatchResult[]
  error: string | null

  connect: (userId: string, backendUrl: string) => Promise<void>
  disconnect: () => Promise<void>
  getStatus: () => Promise<void>
  listResults: () => Promise<void>
}

export const useDispatchStore = create<DispatchState>((set) => ({
  connectionStatus: 'disconnected',
  results: [],
  error: null,

  connect: async (userId, backendUrl) => {
    if (!api?.dispatch) {
      set({ error: 'Dispatch 仅在桌面端可用', connectionStatus: 'error' })
      return
    }
    set({ connectionStatus: 'connecting', error: null })
    try {
      await api.dispatch.configure({ userId, backendUrl })
      set({ connectionStatus: 'connected' })
    } catch (e: any) {
      set({ connectionStatus: 'error', error: e.message })
    }
  },

  disconnect: async () => {
    if (!api?.dispatch) return
    try {
      await api.dispatch.disconnect()
      set({ connectionStatus: 'disconnected' })
    } catch { /* ignore */ }
  },

  getStatus: async () => {
    if (!api?.dispatch) return
    try {
      const status = await api.dispatch.status()
      set({ connectionStatus: status?.connected ? 'connected' : 'disconnected' })
    } catch { /* ignore */ }
  },

  listResults: async () => {
    if (!api?.dispatch) return
    try {
      const results = await api.dispatch.listResults()
      set({ results: results || [] })
    } catch { /* ignore */ }
  },
}))

// 监听主进程状态变化事件
if (api?.dispatch?.onStatusChange) {
  api.dispatch.onStatusChange((_e: unknown, status: { connected: boolean }) => {
    useDispatchStore.setState({
      connectionStatus: status.connected ? 'connected' : 'disconnected',
    })
  })
}

if (api?.dispatch?.onResultReady) {
  api.dispatch.onResultReady((_e: unknown, result: DispatchResult) => {
    useDispatchStore.setState((s) => ({
      results: [result, ...s.results].slice(0, 50),
    }))
  })
}
