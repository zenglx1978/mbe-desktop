/**
 * Approval Store — Zustand 审批状态管理
 *
 * 从各 Agent 的 /governance/approvals/pending 聚合审批请求，
 * 支持 WS 实时推送 + HTTP 轮询降级。
 */
import { create } from 'zustand'
import { API_BASE, WS_BASE, authFetch, authHeaders } from '@/lib/api-client'
import type { ApprovalItem } from '@/lib/approval-service'
import { useAppStore } from '@/stores/app-store'

interface ApprovalState {
  items: ApprovalItem[]
  pendingCount: number
  loading: boolean
  lastRefreshed: number
  wsConnected: boolean
  selectedId: string | null

  refresh: () => Promise<void>
  select: (id: string) => void
  decide: (id: string, agentName: string, decision: {
    status: 'approved' | 'rejected'
    decided_by: string
    decision_note: string
  }) => Promise<boolean>
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  items: [],
  pendingCount: 0,
  loading: false,
  lastRefreshed: 0,
  wsConnected: false,
  selectedId: null,

  select: (id: string) => set({ selectedId: id }),

  refresh: async () => {
    set({ loading: true })
    try {
      const solution = useAppStore.getState().currentSolution?.()
      if (!solution) {
        set({ items: [], pendingCount: 0, loading: false, lastRefreshed: Date.now() })
        return
      }

      const results = await Promise.all(
        solution.agents.map(async (agent) => {
          try {
            const resp = await authFetch(
              `${agent.baseUrl}/governance/approvals/pending?limit=50`,
              { signal: AbortSignal.timeout(8000) },
            )
            if (!resp.ok) return []
            const data = await resp.json()
            return (data.items || []).map((item: any) => ({
              ...item,
              agent_name: item.agent_name || agent.id,
            })) as ApprovalItem[]
          } catch {
            return []
          }
        })
      )

      const allItems = results.flat().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      const pending = allItems.filter(i => i.status === 'pending').length

      set({
        items: allItems,
        pendingCount: pending,
        loading: false,
        lastRefreshed: Date.now(),
      })
    } catch {
      set({ loading: false, lastRefreshed: Date.now() })
    }
  },

  decide: async (id, agentName, decision) => {
    try {
      const solution = useAppStore.getState().currentSolution?.()
      if (!solution) return false
      const agent = solution.agents.find(a => a.id === agentName) || solution.agents[0]
      if (!agent) return false

      const resp = await authFetch(
        `${agent.baseUrl}/governance/approvals/${id}/decide`,
        { method: 'POST', body: JSON.stringify(decision) },
      )
      if (resp.ok) {
        await get().refresh()
        return true
      }
      return false
    } catch {
      return false
    }
  },
}))

let _ws: WebSocket | null = null
let _pollTimer: ReturnType<typeof setInterval> | null = null

/**
 * 启动审批轮询（WS 优先，降级 HTTP），返回清理函数
 */
export function startApprovalPolling(): () => void {
  useApprovalStore.getState().refresh()
  connectApprovalWs()
  return stopApprovalPolling
}

export function stopApprovalPolling() {
  stopPolling()
  if (_ws) {
    _ws.close()
    _ws = null
  }
}

export function connectApprovalWs() {
  if (_ws) return

  const solution = useAppStore.getState().currentSolution?.()
  if (!solution || !solution.agents[0]) {
    startPolling()
    return
  }

  try {
    const wsUrl = solution.agents[0].wsUrl || WS_BASE
    _ws = new WebSocket(`${wsUrl}/ws/governance/approvals`)

    _ws.onopen = () => {
      useApprovalStore.setState({ wsConnected: true })
      stopPolling()
    }

    _ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'approval_update') {
          useApprovalStore.getState().refresh()
        }
      } catch { /* ignore */ }
    }

    _ws.onclose = () => {
      useApprovalStore.setState({ wsConnected: false })
      _ws = null
      startPolling()
    }

    _ws.onerror = () => {
      _ws?.close()
    }
  } catch {
    startPolling()
  }
}

function startPolling() {
  if (_pollTimer) return
  _pollTimer = setInterval(() => {
    useApprovalStore.getState().refresh()
  }, 30000)
}

function stopPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer)
    _pollTimer = null
  }
}
