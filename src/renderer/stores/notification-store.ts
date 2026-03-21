/**
 * 通知 Store — 轮询后端通知 API + 维护未读计数
 */
import { create } from 'zustand'
import { API_BASE, authHeaders } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'

export interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  channel: string
  is_read: boolean
  created_at: string
  data?: Record<string, unknown>
}

interface NotificationState {
  items: NotificationItem[]
  unreadCount: number
  loading: boolean
  panelOpen: boolean

  togglePanel: () => void
  closePanel: () => void
  fetchNotifications: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export const useNotificationStore = create<NotificationState>(set => ({
  items: [],
  unreadCount: 0,
  loading: false,
  panelOpen: false,

  togglePanel: () => set(s => ({ panelOpen: !s.panelOpen })),
  closePanel: () => set({ panelOpen: false }),

  fetchNotifications: async () => {
    const auth = useAuthStore.getState()
    if (!auth.token) return

    set({ loading: true })
    try {
      const res = await fetch(`${API_BASE}/api/v1/account/notifications?limit=30`, {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const items: NotificationItem[] = data.notifications ?? []
      const unreadCount = items.filter(n => !n.is_read).length
      set({ items, unreadCount })
    } catch {
      // 静默失败
    } finally {
      set({ loading: false })
    }
  },

  markAsRead: async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/v1/account/notifications/${id}/read`, {
        method: 'POST',
        headers: authHeaders(),
      })
      set(s => ({
        items: s.items.map(n => n.id === id ? { ...n, is_read: true } : n),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }))
    } catch { /* 静默 */ }
  },

  markAllRead: async () => {
    try {
      await fetch(`${API_BASE}/api/v1/account/notifications/mark-all-read`, {
        method: 'POST',
        headers: authHeaders(),
      })
      set(s => ({
        items: s.items.map(n => ({ ...n, is_read: true })),
        unreadCount: 0,
      }))
    } catch { /* 静默 */ }
  },
}))

let pollTimer: ReturnType<typeof setInterval> | null = null

export function startNotificationPolling(intervalMs = 60_000): () => void {
  useNotificationStore.getState().fetchNotifications()
  pollTimer = setInterval(() => {
    useNotificationStore.getState().fetchNotifications()
  }, intervalMs)
  return () => {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
  }
}
