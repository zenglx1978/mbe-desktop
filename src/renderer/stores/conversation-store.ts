import { create } from 'zustand'

interface PersistedMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  agentRole?: string
  sources?: string
}

interface ConversationState {
  currentConversationId: string | null
  createConversation: (solutionId: string, agentRole: string) => Promise<string>
  persistMessage: (msg: PersistedMessage) => void
}

export const useConversationStore = create<ConversationState>((set) => ({
  currentConversationId: null,

  createConversation: async (_solutionId, _agentRole) => {
    const id = `conv-${Date.now()}`
    set({ currentConversationId: id })
    return id
  },

  persistMessage: (_msg) => {
    // TODO: 持久化到本地 SQLite
  },
}))
