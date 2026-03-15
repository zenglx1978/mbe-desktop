import { create } from 'zustand'
import type { ToolCardData } from '@/components/chat/InlineToolCard'

export interface SourceCitation {
  title: string
  snippet: string
  doc_id?: string
  confidence?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  agentRole?: string
  timestamp: number
  /** 知识来源溯源（source_citation） */
  sources?: SourceCitation[]
  /** AI 回答整体置信度（0-1） */
  confidence?: number
  /** 是否正在流式输出 */
  streaming?: boolean
  /** 内联工具卡片 */
  toolCard?: ToolCardData
}

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  /** 当前流式回复的消息 ID */
  streamingId: string | null

  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, partial: Partial<ChatMessage>) => void
  appendToMessage: (id: string, chunk: string) => void
  clearMessages: () => void
  setLoading: (v: boolean) => void
}

let msgCounter = 0

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  streamingId: null,

  addMessage: (msg) => {
    const id = `msg_${Date.now()}_${++msgCounter}`
    const message: ChatMessage = { ...msg, id, timestamp: Date.now() }
    set(s => ({ messages: [...s.messages, message], streamingId: msg.streaming ? id : s.streamingId }))
    return id
  },

  updateMessage: (id, partial) => {
    set(s => ({
      messages: s.messages.map(m => m.id === id ? { ...m, ...partial } : m),
      streamingId: partial.streaming === false && s.streamingId === id ? null : s.streamingId,
    }))
  },

  appendToMessage: (id, chunk) => {
    set(s => ({
      messages: s.messages.map(m => m.id === id ? { ...m, content: m.content + chunk } : m),
    }))
  },

  clearMessages: () => {
    set({ messages: [], streamingId: null })
  },

  setLoading: (v) => {
    set({ isLoading: v })
  },
}))
