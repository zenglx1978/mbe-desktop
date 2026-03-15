/**
 * Approval Service — 治理审批 API + WebSocket 实时推送
 *
 * 连接各 Agent 后端的 /governance 端点，获取待审批列表并提交决策。
 * 支持多 Agent 聚合查询：遍历当前方案的所有 Agent 后端。
 *
 * WebSocket: 订阅 governance.* 事件实现即时推送，HTTP 轮询作为降级方案。
 */

import type { SolutionConfig, AgentEndpoint } from '@/lib/solution-router'

export interface ApprovalItem {
  id: string
  action: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'auto_approved'
  agent_name: string
  expert_id: string
  solution_id: string
  user_id: string
  org_id: string
  reason: string
  context: Record<string, any>
  created_at: string
  decided_at: string | null
  decided_by: string | null
  decision_note: string | null
  expire_minutes: number
}

export interface ApprovalDecisionInput {
  status: 'approved' | 'rejected'
  decided_by: string
  decision_note: string
}

const RISK_PRIORITY: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

/**
 * 从单个 Agent 后端获取待审批列表
 */
async function fetchAgentApprovals(baseUrl: string, agentName: string): Promise<ApprovalItem[]> {
  try {
    const url = `${baseUrl}/api/${agentName}/governance/approvals/pending?limit=50`
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return []
    const data = await resp.json()
    return (data.items || []) as ApprovalItem[]
  } catch {
    return []
  }
}

/**
 * 从当前方案的所有 Agent 后端聚合待审批列表
 */
export async function listPendingApprovals(solution: SolutionConfig): Promise<ApprovalItem[]> {
  const results = await Promise.allSettled(
    solution.agents.map(agent =>
      fetchAgentApprovals(agent.baseUrl, agent.id)
    )
  )

  const all: ApprovalItem[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') {
      all.push(...r.value)
    }
  }

  all.sort((a, b) => {
    const riskDiff = (RISK_PRIORITY[a.risk_level] ?? 9) - (RISK_PRIORITY[b.risk_level] ?? 9)
    if (riskDiff !== 0) return riskDiff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return all
}

/**
 * 获取单个审批详情
 */
export async function getApprovalDetail(
  baseUrl: string,
  agentName: string,
  approvalId: string,
): Promise<ApprovalItem | null> {
  try {
    const url = `${baseUrl}/api/${agentName}/governance/approvals/${approvalId}`
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

/**
 * 提交审批决策
 */
export async function submitDecision(
  baseUrl: string,
  agentName: string,
  approvalId: string,
  decision: ApprovalDecisionInput,
): Promise<ApprovalItem | null> {
  try {
    const url = `${baseUrl}/api/${agentName}/governance/approvals/${approvalId}/decide`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decision),
      signal: AbortSignal.timeout(10000),
    })
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

/**
 * 查找审批项所属 Agent 的 baseUrl
 */
export function resolveAgentUrl(solution: SolutionConfig, agentName: string): string {
  const agent = solution.agents.find(a => a.id === agentName)
  return agent?.baseUrl || solution.agents[0]?.baseUrl || ''
}

/**
 * 风险等级显示配置
 */
export const RISK_META: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: '极高', color: 'text-red-500', bg: 'bg-red-500/10' },
  high: { label: '高', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  medium: { label: '中', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  low: { label: '低', color: 'text-green-500', bg: 'bg-green-500/10' },
}

/**
 * 计算剩余过期时间
 */
export function getTimeRemaining(createdAt: string, expireMinutes: number): string {
  const created = new Date(createdAt).getTime()
  const expires = created + expireMinutes * 60 * 1000
  const remaining = expires - Date.now()

  if (remaining <= 0) return '已过期'
  if (remaining < 60_000) return '不到 1 分钟'
  const mins = Math.floor(remaining / 60_000)
  if (mins < 60) return `${mins} 分钟`
  const hours = Math.floor(mins / 60)
  return `${hours} 小时 ${mins % 60} 分钟`
}


// ── WebSocket 实时审批推送 ──

export type GovernanceEventType = 'governance.approval_requested' | 'governance.approval_decided'

export interface GovernanceWsEvent {
  type: GovernanceEventType
  data: {
    approval_id: string
    action: string
    risk_level: string
    status: string
    agent_name: string
    expert_id?: string
    solution_id?: string
    reason?: string
    expire_minutes?: number
    created_at?: string
    decided_by?: string
    decision_note?: string
  }
}

export type GovernanceEventHandler = (event: GovernanceWsEvent) => void

/**
 * 管理到多个 Agent 的 WebSocket 连接，订阅 governance.* 事件。
 *
 * 架构：每个 Agent 的 /ws 端点已通过 EventBus 广播所有事件，
 * 此管理器连接到各 Agent 的 WS 端点，过滤 governance.* 事件并回调。
 */
class ApprovalWsManager {
  private connections = new Map<string, WebSocket>()
  private handlers = new Set<GovernanceEventHandler>()
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private _closed = false

  /** 连接到方案中所有 Agent 的 WS 端点 */
  connectAll(solution: SolutionConfig) {
    this.disconnectAll()
    this._closed = false
    for (const agent of solution.agents) {
      this.connectAgent(agent)
    }
  }

  /** 断开所有连接 */
  disconnectAll() {
    this._closed = true
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer)
    }
    this.reconnectTimers.clear()
    for (const [key, ws] of this.connections) {
      try { ws.close(1000) } catch { /* ignore */ }
      this.connections.delete(key)
    }
  }

  /** 注册事件处理函数 */
  onEvent(handler: GovernanceEventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  /** 当前是否有任何活跃连接 */
  get connected(): boolean {
    for (const ws of this.connections.values()) {
      if (ws.readyState === WebSocket.OPEN) return true
    }
    return false
  }

  private connectAgent(agent: AgentEndpoint) {
    if (this._closed) return

    const key = agent.id
    const existingWs = this.connections.get(key)
    if (existingWs && existingWs.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(`${agent.wsUrl}?room=governance`)
      this.connections.set(key, ws)

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'subscribe_room', room: 'governance' }))
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type?.startsWith('governance.')) {
            const wsEvent: GovernanceWsEvent = {
              type: msg.type as GovernanceEventType,
              data: msg.data ?? msg,
            }
            for (const handler of this.handlers) {
              try { handler(wsEvent) } catch { /* handler error */ }
            }
          }
        } catch { /* malformed message */ }
      }

      ws.onclose = () => {
        this.connections.delete(key)
        this.scheduleReconnect(agent)
      }

      ws.onerror = () => {
        try { ws.close() } catch { /* ignore */ }
      }
    } catch {
      this.scheduleReconnect(agent)
    }
  }

  private scheduleReconnect(agent: AgentEndpoint, delayMs = 5000) {
    if (this._closed) return
    const key = agent.id

    if (this.reconnectTimers.has(key)) return
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(key)
      this.connectAgent(agent)
    }, delayMs)
    this.reconnectTimers.set(key, timer)
  }
}

/** 全局单例 */
export const approvalWsManager = new ApprovalWsManager()
