import { create } from 'zustand'

export interface WorkflowSuggestion {
  suggested_task_type: string
  workflow_name: string
  workflow_description: string
  steps: { id: string; name: string }[]
  message: string
  confidence?: 'high' | 'medium' | 'low'
}

export interface WorkflowInstanceInfo {
  instance_id: string
  workflow_name: string
  status: string
  progress_percent: number
  total_steps: number
  steps: { id: string; name: string; status: string }[]
}

export interface LocalActionInfo {
  type: string
  label: string
  target?: string
  params?: Record<string, unknown>
  auto_execute?: boolean
  security_level?: number
  depends_on?: number
}

export type LocalActionStatus = 'pending' | 'auto_done' | 'user_done' | 'failed'

export type ExpertStatus = 'idle' | 'working' | 'done' | 'error'

export interface OrchestrationExpert {
  id: string
  label: string
  status: ExpertStatus
  elapsed_ms?: number
  error?: string
}

export interface OrchestrationState {
  active: boolean
  mode: 'parallel' | 'sequential' | 'fan_out' | 'cross_domain'
  experts: OrchestrationExpert[]
  total_elapsed_ms?: number
}

export type SourceReliability = 'high' | 'medium' | 'low'

export interface SourceCitation {
  title: string
  ref?: string
  url?: string
  reliability?: SourceReliability
  confidence?: number
  expired?: boolean
  snippet?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  agentRole?: string
  sources?: SourceCitation[]
  confidence?: number
  workflowSuggestion?: WorkflowSuggestion
  workflowInstance?: WorkflowInstanceInfo
  localActions?: LocalActionInfo[]
  localActionStatus?: Record<number, LocalActionStatus>
  localActionResults?: Record<number, unknown>
  orchestration?: OrchestrationState
}

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  addMessage: (msg: Omit<ChatMessage, 'id'>) => string
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void
  appendToMessage: (id: string, text: string) => void
  setLoading: (v: boolean) => void
  clearMessages: () => void
}

let msgSeq = 0

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,

  addMessage: (msg) => {
    const id = `msg-${Date.now()}-${++msgSeq}`
    set((s) => ({ messages: [...s.messages, { ...msg, id }] }))
    return id
  },

  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  appendToMessage: (id, text) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + text } : m,
      ),
    })),

  setLoading: (v) => set({ isLoading: v }),

  clearMessages: () => set({ messages: [] }),
}))
