/**
 * Approval Store — 审批状态管理（WS 实时 + 轮询降级）
 *
 * 优先通过 WebSocket 接收 governance.* 事件实现即时更新，
 * WS 不可用时自动降级为 HTTP 轮询（60s 间隔）。
 * 提供 pendingCount 用于侧边栏徽标显示。
 */

import { create } from 'zustand'
import { useAppStore } from '@/stores/app-store'
import {
  listPendingApprovals,
  submitDecision,
  resolveAgentUrl,
  approvalWsManager,
  type ApprovalItem,
  type ApprovalDecisionInput,
  type GovernanceWsEvent,
} from '@/lib/approval-service'

interface ApprovalState {
  /** 待审批列表 */
  items: ApprovalItem[]
  /** 待审批总数（用于侧边栏徽标） */
  pendingCount: number
  /** 当前选中查看的审批项 */
  selectedId: string | null
  /** 加载中 */
  loading: boolean
  /** 上次刷新时间 */
  lastRefreshed: number
  /** WS 连接状态 */
  wsConnected: boolean
  /** 最近一次 WS 事件（供 Toast 消费后清除） */
  lastWsEvent: GovernanceWsEvent | null

  /** 刷新待审批列表（HTTP 全量拉取） */
  refresh: () => Promise<void>
  /** 选中审批项 */
  select: (id: string | null) => void
  /** 提交审批决策 */
  decide: (approvalId: string, agentName: string, decision: ApprovalDecisionInput) => Promise<boolean>
  /** 收到 WS 事件后的增量更新 */
  handleWsEvent: (event: GovernanceWsEvent) => void
  /** 清除最近 WS 事件（Toast 消费后调用） */
  clearLastWsEvent: () => void
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  items: [],
  pendingCount: 0,
  selectedId: null,
  loading: false,
  lastRefreshed: 0,
  wsConnected: false,
  lastWsEvent: null,

  refresh: async () => {
    const solution = useAppStore.getState().currentSolution()
    if (!solution) return

    set({ loading: true })
    try {
      const items = await listPendingApprovals(solution)
      set({
        items,
        pendingCount: items.length,
        loading: false,
        lastRefreshed: Date.now(),
      })
    } catch {
      set({ loading: false })
    }
  },

  select: (id) => set({ selectedId: id }),

  decide: async (approvalId, agentName, decision) => {
    const solution = useAppStore.getState().currentSolution()
    if (!solution) return false

    const baseUrl = resolveAgentUrl(solution, agentName)
    if (!baseUrl) return false

    const result = await submitDecision(baseUrl, agentName, approvalId, decision)
    if (result) {
      set((state) => ({
        items: state.items.filter(i => i.id !== approvalId),
        pendingCount: Math.max(0, state.pendingCount - 1),
      }))
      return true
    }
    return false
  },

  handleWsEvent: (event) => {
    const { type, data } = event

    if (type === 'governance.approval_requested') {
      const newItem: ApprovalItem = {
        id: data.approval_id,
        action: data.action,
        risk_level: (data.risk_level as ApprovalItem['risk_level']) || 'medium',
        status: 'pending',
        agent_name: data.agent_name || '',
        expert_id: data.expert_id || '',
        solution_id: data.solution_id || '',
        user_id: '',
        org_id: '',
        reason: data.reason || '',
        context: {},
        created_at: data.created_at || new Date().toISOString(),
        decided_at: null,
        decided_by: null,
        decision_note: null,
        expire_minutes: data.expire_minutes ?? 60,
      }

      set((state) => {
        const exists = state.items.some(i => i.id === newItem.id)
        if (exists) return state
        const items = [newItem, ...state.items]
        return {
          items,
          pendingCount: items.length,
          lastWsEvent: event,
        }
      })
    }

    if (type === 'governance.approval_decided') {
      set((state) => {
        const items = state.items.filter(i => i.id !== data.approval_id)
        return {
          items,
          pendingCount: items.length,
          lastWsEvent: event,
        }
      })
    }
  },

  clearLastWsEvent: () => set({ lastWsEvent: null }),
}))


// ── 连接生命周期管理 ──

let pollTimer: ReturnType<typeof setInterval> | null = null
let wsUnsubscribe: (() => void) | null = null
const POLL_INTERVAL_WS = 60_000    // WS 可用时，轮询仅作兜底（60s）
const POLL_INTERVAL_FALLBACK = 15_000 // WS 不可用时，加速轮询（15s）

/**
 * 启动审批轮询（方案切换时调用）
 *
 * 采用纯 HTTP 轮询（60s），不在页面加载时建立 WS 连接避免 403 噪音。
 * WS 连接可通过 connectApprovalWs() 按需建立。
 */
export function startApprovalPolling(): () => void {
  stopApprovalPolling()

  const solution = useAppStore.getState().currentSolution()
  if (!solution) return stopApprovalPolling

  if (!solution.enabledTabs.includes('approvals')) return stopApprovalPolling

  // 立即做一次全量拉取
  useApprovalStore.getState().refresh()

  // HTTP 轮询
  pollTimer = setInterval(() => {
    useApprovalStore.getState().refresh()
  }, POLL_INTERVAL_WS)

  return stopApprovalPolling
}

/**
 * 按需建立 governance WS 连接（从审批 Panel 调用）
 */
export function connectApprovalWs() {
  const solution = useAppStore.getState().currentSolution()
  if (!solution) return

  if (approvalWsManager.connected) return

  approvalWsManager.connectAll(solution)

  if (!wsUnsubscribe) {
    wsUnsubscribe = approvalWsManager.onEvent((event) => {
      useApprovalStore.getState().handleWsEvent(event)
    })
  }

  const connected = approvalWsManager.connected
  useApprovalStore.setState({ wsConnected: connected })
}

export function stopApprovalPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (wsUnsubscribe) {
    wsUnsubscribe()
    wsUnsubscribe = null
  }
  approvalWsManager.disconnectAll()
  useApprovalStore.setState({ wsConnected: false })
}
