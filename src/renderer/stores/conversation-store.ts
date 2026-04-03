import { create } from 'zustand'
import { useChatStore, type ChatMessage } from '@/stores/chat-store'

export interface PersistedMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  agentRole?: string
  sources?: string
}

export interface ConversationRecord {
  id: string
  solutionId: string
  agentRole?: string
  title?: string
  createdAt?: string
  updatedAt?: string
}

interface ConversationState {
  currentConversationId: string | null
  conversations: ConversationRecord[]
  /** 标记当前对话是否刚从历史恢复，首条消息发送后自动重置 */
  isResumed: boolean

  createConversation: (solutionId: string, agentRole: string) => Promise<string>
  persistMessage: (msg: PersistedMessage) => void
  loadConversations: (solutionId: string) => Promise<void>
  resumeConversation: (conversationId: string) => Promise<void>
  deleteConversation: (conversationId: string) => Promise<void>
  startNewConversation: () => void
  consumeResumeFlag: () => boolean
}

function getElectronDB() {
  try {
    return (window as unknown as Record<string, unknown>).electronAPI as {
      db: {
        conversations: {
          list: (solutionId: string) => Promise<ConversationRecord[]>
          create: (data: { id: string; solutionId: string; agentRole?: string; title?: string }) => Promise<void>
          updateTitle: (id: string, title: string) => Promise<void>
          delete: (id: string) => Promise<void>
        }
        messages: {
          list: (conversationId: string) => Promise<Array<{
            id: string; conversationId: string; role: string; content: string;
            agentRole?: string; sources?: string; createdAt?: string
          }>>
          add: (data: { id: string; conversationId: string; role: string; content: string; agentRole?: string; sources?: string }) => Promise<void>
          clear: (conversationId: string) => Promise<void>
        }
      }
    } | undefined
  } catch {
    return undefined
  }
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  currentConversationId: null,
  conversations: [],
  isResumed: false,

  createConversation: async (solutionId, agentRole) => {
    const id = `conv-${Date.now()}`
    set({ currentConversationId: id, isResumed: false })

    const api = getElectronDB()
    if (api?.db?.conversations) {
      try {
        await api.db.conversations.create({ id, solutionId, agentRole })
      } catch {
        // 非 Electron 或 IPC 失败；内存 ID 仍可用
      }
    }
    return id
  },

  persistMessage: (msg) => {
    const api = getElectronDB()
    if (api?.db?.messages) {
      api.db.messages.add({
        id: msg.id,
        conversationId: msg.conversationId,
        role: msg.role,
        content: msg.content,
        agentRole: msg.agentRole,
        sources: msg.sources,
      }).then(() => {
        // 用首条用户消息自动生成对话标题
        if (msg.role === 'user') {
          const convId = msg.conversationId
          const convs = get().conversations
          const conv = convs.find(c => c.id === convId)
          if (conv && (!conv.title || conv.title === '新对话')) {
            const title = msg.content.slice(0, 30) + (msg.content.length > 30 ? '…' : '')
            api.db.conversations.updateTitle(convId, title).catch(() => {})
            set({ conversations: convs.map(c => c.id === convId ? { ...c, title } : c) })
          }
        }
      }).catch(() => {
        // 持久化失败不阻塞对话
      })
    }
  },

  loadConversations: async (solutionId) => {
    const api = getElectronDB()
    if (!api?.db?.conversations) {
      set({ conversations: [] })
      return
    }
    try {
      const list = await api.db.conversations.list(solutionId)
      set({ conversations: list ?? [] })
    } catch {
      set({ conversations: [] })
    }
  },

  resumeConversation: async (conversationId) => {
    const api = getElectronDB()
    if (!api?.db?.messages) return

    set({ currentConversationId: conversationId, isResumed: true })
    useChatStore.getState().clearMessages()

    try {
      const rows = await api.db.messages.list(conversationId)
      if (!rows?.length) return

      const chatStore = useChatStore.getState()
      for (const row of rows) {
        const parsed: Omit<ChatMessage, 'id'> = {
          role: row.role as 'user' | 'assistant',
          content: row.content,
          agentRole: row.agentRole,
        }
        if (row.sources) {
          try { parsed.sources = JSON.parse(row.sources) } catch { /* 非 JSON 忽略 */ }
        }
        chatStore.addMessage(parsed)
      }
    } catch {
      // 消息加载失败，保持空对话
    }
  },

  deleteConversation: async (conversationId) => {
    const api = getElectronDB()
    if (api?.db?.conversations) {
      try {
        await api.db.messages.clear(conversationId)
        await api.db.conversations.delete(conversationId)
      } catch {
        // 删除失败静默
      }
    }
    const { currentConversationId, conversations } = get()
    set({
      conversations: conversations.filter(c => c.id !== conversationId),
      ...(currentConversationId === conversationId
        ? { currentConversationId: null }
        : {}),
    })
    if (currentConversationId === conversationId) {
      useChatStore.getState().clearMessages()
    }
  },

  startNewConversation: () => {
    set({ currentConversationId: null, isResumed: false })
    useChatStore.getState().clearMessages()
  },

  consumeResumeFlag: () => {
    const was = get().isResumed
    if (was) set({ isResumed: false })
    return was
  },
}))
