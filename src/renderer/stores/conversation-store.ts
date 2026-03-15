/**
 * 对话历史持久化 Store
 *
 * 通过 preload 暴露的 db API 调用主进程 SQLite。
 * chat-store 管理当前会话实时状态，本 store 管理跨会话 CRUD。
 */

import { create } from 'zustand'

export interface Conversation {
  id: string
  solution_id: string
  agent_role: string | null
  title: string
  created_at: string
  updated_at: string
}

export interface PersistedMessage {
  id: string
  conversation_id: string
  role: string
  content: string
  agent_role: string | null
  sources: string | null
  created_at: string
}

interface ConversationState {
  conversations: Conversation[]
  currentConversationId: string | null
  loading: boolean

  loadConversations: (solutionId: string) => Promise<void>
  createConversation: (solutionId: string, agentRole?: string) => Promise<string>
  deleteConversation: (id: string) => Promise<void>
  updateTitle: (id: string, title: string) => Promise<void>
  selectConversation: (id: string | null) => void
  loadMessages: (conversationId: string) => Promise<PersistedMessage[]>
  persistMessage: (data: {
    id: string
    conversationId: string
    role: string
    content: string
    agentRole?: string
    sources?: string
  }) => Promise<void>
}

function genId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getDb() {
  return (window as any).electronAPI?.db
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  loading: false,

  loadConversations: async (solutionId: string) => {
    set({ loading: true })
    try {
      const db = getDb()
      if (!db) { set({ loading: false }); return }
      const result = await db.conversations.list(solutionId)
      set({ conversations: result || [], loading: false })
    } catch {
      set({ loading: false })
    }
  },

  createConversation: async (solutionId: string, agentRole?: string) => {
    const id = genId()
    const db = getDb()
    if (db) {
      await db.conversations.create({
        id,
        solutionId,
        agentRole: agentRole || undefined,
        title: '新对话',
      })
    }
    const now = new Date().toISOString()
    set(s => ({
      conversations: [
        { id, solution_id: solutionId, agent_role: agentRole || null, title: '新对话', created_at: now, updated_at: now },
        ...s.conversations,
      ],
      currentConversationId: id,
    }))
    return id
  },

  deleteConversation: async (id: string) => {
    const db = getDb()
    if (db) await db.conversations.delete(id)
    set(s => ({
      conversations: s.conversations.filter(c => c.id !== id),
      currentConversationId: s.currentConversationId === id ? null : s.currentConversationId,
    }))
  },

  updateTitle: async (id: string, title: string) => {
    const db = getDb()
    if (db) await db.conversations.updateTitle(id, title)
    set(s => ({
      conversations: s.conversations.map(c => c.id === id ? { ...c, title, updated_at: new Date().toISOString() } : c),
    }))
  },

  selectConversation: (id: string | null) => {
    set({ currentConversationId: id })
  },

  loadMessages: async (conversationId: string) => {
    const db = getDb()
    if (!db) return []
    return (await db.messages.list(conversationId)) || []
  },

  persistMessage: async (data) => {
    const db = getDb()
    if (db) await db.messages.add(data)
    if (data.role === 'user') {
      const conv = get().conversations.find(c => c.id === data.conversationId)
      if (conv && conv.title === '新对话') {
        const title = data.content.slice(0, 30) + (data.content.length > 30 ? '...' : '')
        get().updateTitle(data.conversationId, title)
      }
    }
  },
}))
