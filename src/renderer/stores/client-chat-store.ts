/**
 * 客户沟通 — 消息与频道内容（消息列表、文档、任务、搜索、快捷回复、统计、发送）
 *
 * 会话维度见 client-session-store；输入区 UI 见 client-input-store。
 * 对外默认使用本文件导出的 useClientChatStore（合并三 store，保持旧 API）。
 */
import { create } from 'zustand'
import { authHeaders } from '@/lib/api-client'
import { CLIENT_PORTAL_API as API } from './client-portal-constants'
import { useClientSessionStore } from './client-session-store'
import { useClientInputStore } from './client-input-store'
import type {
  ClientMsg,
  ChannelDigest,
  ChannelTask,
  SearchResult,
  QuickReply,
  ChannelAnalytics,
  GlobalDashboard,
  AIDraft,
} from './client-portal-types'

export type {
  ClientInvite,
  MemberPermissions,
  ChannelMember,
  ClientMsg,
  ChannelDigest,
  ChannelTask,
  SearchResult,
  QuickReply,
  ChannelAnalytics,
  GlobalDashboard,
  AIDraft,
} from './client-portal-types'

function activeChannelId(): string | null {
  return useClientSessionStore.getState().activeChannel
}

export interface ClientChatMessagesState {
  messages: ClientMsg[]
  digests: ChannelDigest[]
  tasks: ChannelTask[]
  searchResults: SearchResult[]
  quickReplies: QuickReply[]
  channelAnalytics: ChannelAnalytics | null
  globalDashboard: GlobalDashboard | null
  loading: boolean
  error: string | null

  resetMessagesForChannelSwitch: () => void
  searchMessages: (query: string, channelId?: string) => Promise<void>
  clearSearch: () => void
  fetchQuickReplies: (category?: string) => Promise<void>
  createQuickReply: (title: string, content: string, category?: string, shortcut?: string) => Promise<boolean>
  deleteQuickReply: (replyId: string) => Promise<boolean>
  useQuickReply: (replyId: string) => Promise<string | null>
  fetchChannelAnalytics: (channelId: string, days?: number) => Promise<void>
  fetchGlobalDashboard: (days?: number) => Promise<void>
  fetchMessages: (channelId?: string) => Promise<void>
  sendMessage: (content: string, visibleTo?: string | string[]) => Promise<void>
  uploadFile: (file: File, visibleTo?: string | string[]) => Promise<void>
  generateDigest: (channelId: string, digestType: string, visibleTo?: string | string[]) => Promise<ChannelDigest | null>
  fetchDigests: (channelId?: string) => Promise<void>
  publishDigest: (digestId: string) => Promise<boolean>
  invokeAI: (channelId: string, agentId: string, question?: string) => Promise<AIDraft | null>
  reviewAI: (draftId: string, action: 'approve' | 'edit' | 'reject', editedContent?: string, visibleTo?: string | string[]) => Promise<boolean>
  fetchTasks: (channelId?: string) => Promise<void>
  createTask: (channelId: string, title: string, opts?: Partial<Pick<ChannelTask, 'priority' | 'assignee_id' | 'assignee_name' | 'due_date' | 'description'>>) => Promise<ChannelTask | null>
  updateTask: (taskId: string, updates: Partial<Pick<ChannelTask, 'status' | 'title' | 'priority' | 'assignee_id' | 'assignee_name'>>) => Promise<boolean>
  createTasksFromDigest: (channelId: string, digestId: string) => Promise<number>
}

export const useClientChatMessagesStore = create<ClientChatMessagesState>((set, get) => ({
  messages: [],
  digests: [],
  tasks: [],
  searchResults: [],
  quickReplies: [],
  channelAnalytics: null,
  globalDashboard: null,
  loading: false,
  error: null,

  resetMessagesForChannelSwitch: () => set({ messages: [] }),

  searchMessages: async (query, channelId) => {
    try {
      const url = channelId
        ? `${API}/channels/${channelId}/search?q=${encodeURIComponent(query)}`
        : `${API}/search?q=${encodeURIComponent(query)}`
      const res = await fetch(url, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        set({ searchResults: data.results || [] })
      }
    } catch { set({ searchResults: [] }) }
  },

  clearSearch: () => set({ searchResults: [] }),

  fetchQuickReplies: async (category) => {
    try {
      const url = category
        ? `${API}/quick-replies?category=${encodeURIComponent(category)}`
        : `${API}/quick-replies`
      const res = await fetch(url, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        set({ quickReplies: data.items || [] })
      }
    } catch { /* noop */ }
  },

  createQuickReply: async (title, content, category = 'general', shortcut = '') => {
    try {
      const res = await fetch(`${API}/quick-replies`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ title, content, category, shortcut }),
      })
      if (res.ok) {
        get().fetchQuickReplies()
        return true
      }
    } catch { /* noop */ }
    return false
  },

  deleteQuickReply: async (replyId) => {
    try {
      const res = await fetch(`${API}/quick-replies/${replyId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.ok) {
        set({ quickReplies: get().quickReplies.filter(r => r.reply_id !== replyId) })
        return true
      }
    } catch { /* noop */ }
    return false
  },

  useQuickReply: async (replyId) => {
    try {
      const res = await fetch(`${API}/quick-replies/${replyId}/use`, {
        method: 'POST',
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        return data.content || null
      }
    } catch { /* noop */ }
    return null
  },

  fetchChannelAnalytics: async (channelId, days = 30) => {
    try {
      const res = await fetch(`${API}/analytics/channels/${channelId}?days=${days}`, { headers: authHeaders() })
      if (res.ok) {
        set({ channelAnalytics: await res.json() })
      }
    } catch { /* noop */ }
  },

  fetchGlobalDashboard: async (days = 30) => {
    try {
      const res = await fetch(`${API}/analytics/dashboard?days=${days}`, { headers: authHeaders() })
      if (res.ok) {
        set({ globalDashboard: await res.json() })
      }
    } catch { /* noop */ }
  },

  fetchMessages: async (channelId) => {
    const ch = channelId ?? activeChannelId()
    if (!ch) return
    try {
      const res = await fetch(`${API}/channels/${ch}/messages?limit=200`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        set({ messages: data.messages || [], error: null })
      }
    } catch {
      /* silent */
    }
  },

  sendMessage: async (content, visibleTo = 'all') => {
    const ch = activeChannelId()
    if (!ch || !content.trim()) return
    set({ loading: true })
    try {
      await fetch(`${API}/channels/${ch}/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content, message_type: 'text', visible_to: visibleTo }),
      })
      await get().fetchMessages()
    } finally {
      set({ loading: false })
    }
  },

  uploadFile: async (file, visibleTo = 'all') => {
    const ch = activeChannelId()
    if (!ch) return
    set({ loading: true })
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('channel_id', ch)
      fd.append('sender_type', 'professional')
      fd.append('sender_name', 'advisor')
      fd.append('visible_to', Array.isArray(visibleTo) ? visibleTo.join(',') : visibleTo)
      const { 'Content-Type': _, ...h } = authHeaders()
      await fetch(`${API}/upload`, { method: 'POST', headers: h, body: fd })
      await get().fetchMessages()
    } finally {
      set({ loading: false })
    }
  },

  generateDigest: async (channelId, digestType, visibleTo = 'all') => {
    set({ loading: true })
    try {
      const res = await fetch(`${API}/channels/${channelId}/digests`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ digest_type: digestType, visible_to: visibleTo }),
      })
      if (res.ok) {
        const digest = await res.json()
        await get().fetchDigests(channelId)
        return digest as ChannelDigest
      }
      return null
    } catch {
      return null
    } finally {
      set({ loading: false })
    }
  },

  fetchDigests: async (channelId) => {
    const ch = channelId ?? activeChannelId()
    if (!ch) return
    try {
      const res = await fetch(`${API}/channels/${ch}/digests`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        set({ digests: data })
      }
    } catch { /* noop */ }
  },

  publishDigest: async (digestId) => {
    try {
      const res = await fetch(`${API}/digests/${digestId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'published' }),
      })
      if (res.ok) {
        await get().fetchDigests()
        return true
      }
      return false
    } catch {
      return false
    }
  },

  invokeAI: async (channelId, agentId, question) => {
    set({ loading: true })
    try {
      const res = await fetch(`${API}/channels/${channelId}/ai/invoke`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          agent_id: agentId,
          question: question || '',
          context_messages: 15,
        }),
      })
      if (res.ok) {
        return await res.json() as AIDraft
      }
      return null
    } catch {
      return null
    } finally {
      set({ loading: false })
    }
  },

  reviewAI: async (draftId, action, editedContent, visibleTo = 'all') => {
    try {
      const res = await fetch(`${API}/ai/${draftId}/review`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          action,
          edited_content: editedContent || '',
          visible_to: visibleTo,
        }),
      })
      if (res.ok) {
        await get().fetchMessages()
        return true
      }
      return false
    } catch {
      return false
    }
  },

  fetchTasks: async (channelId) => {
    const ch = channelId ?? activeChannelId()
    if (!ch) return
    try {
      const res = await fetch(`${API}/channels/${ch}/tasks`, { headers: authHeaders() })
      if (res.ok) set({ tasks: await res.json() })
    } catch { /* noop */ }
  },

  createTask: async (channelId, title, opts = {}) => {
    try {
      const res = await fetch(`${API}/channels/${channelId}/tasks`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ title, ...opts }),
      })
      if (res.ok) {
        const task = await res.json() as ChannelTask
        await get().fetchTasks(channelId)
        return task
      }
      return null
    } catch {
      return null
    }
  },

  updateTask: async (taskId, updates) => {
    try {
      const res = await fetch(`${API}/tasks/${taskId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        await get().fetchTasks()
        return true
      }
      return false
    } catch {
      return false
    }
  },

  createTasksFromDigest: async (channelId, digestId) => {
    try {
      const res = await fetch(`${API}/channels/${channelId}/tasks/from-digest`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ digest_id: digestId }),
      })
      if (res.ok) {
        const data = await res.json()
        await get().fetchTasks(channelId)
        return data.created_count as number
      }
      return 0
    } catch {
      return 0
    }
  },
}))

/** 切换当前频道（与原单文件 store 行为一致：清空消息与成员再拉取；'' 视为全局仪表板，归一为 null） */
export function selectChannel(channelId: string): void {
  const next = channelId === '' ? null : channelId
  useClientSessionStore.getState().setActiveChannel(next)
  useClientSessionStore.getState().clearMembers()
  useClientChatMessagesStore.getState().resetMessagesForChannelSwitch()
  if (next) {
    void useClientChatMessagesStore.getState().fetchMessages(next)
    void useClientSessionStore.getState().fetchMembers(next)
  }
}

/** 合并会话 + 消息 + 输入，保持原 useClientChatStore() 用法 */
export function useClientChatStore() {
  const session = useClientSessionStore()
  const messages = useClientChatMessagesStore()
  const input = useClientInputStore()
  return {
    ...session,
    ...messages,
    ...input,
    selectChannel,
  }
}

export { useClientSessionStore } from './client-session-store'
export { useClientInputStore } from './client-input-store'
