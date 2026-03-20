/**
 * Approval Service — 审批数据类型与工具函数
 *
 * 对接各 Agent 后端的 /governance/approvals/pending API
 */

export interface ApprovalItem {
  id: string
  agent_name: string
  expert_id?: string
  action: string
  reason?: string
  risk_level: RiskLevel
  status: ApprovalStatus
  created_at: string
  expire_minutes: number
  solution_id?: string
  decided_by?: string
  decision_note?: string
  decided_at?: string
  user_id?: string
  context?: Record<string, unknown>
}

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'auto_approved'

export const RISK_META: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  critical: { label: '严重', color: 'text-red-500', bg: 'bg-red-500/10' },
  high:     { label: '高', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  medium:   { label: '中', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  low:      { label: '低', color: 'text-green-500', bg: 'bg-green-500/10' },
}

export function getTimeRemaining(createdAt: string, expireMinutes: number): string {
  const created = new Date(createdAt).getTime()
  const expireAt = created + expireMinutes * 60 * 1000
  const now = Date.now()
  const remaining = expireAt - now

  if (remaining <= 0) return '已过期'
  const mins = Math.floor(remaining / 60000)
  if (mins < 60) return `${mins} 分钟`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时`
  return `${Math.floor(hours / 24)} 天`
}
