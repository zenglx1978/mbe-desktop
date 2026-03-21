/**
 * Audit Service — 审批审计日志查询与统计
 *
 * 从各 Agent 后端的 /governance/approvals/audit 聚合审计数据。
 */

import type { SolutionConfig } from '@/lib/solution-router'
import type { ApprovalItem } from '@/lib/approval-service'
import { authHeaders } from '@/lib/api-client'
import type { AuditExportJsonResponse } from '@/types/api-responses'

export interface AuditFilters {
  status?: string
  riskLevel?: string
  agentName?: string
  limit?: number
  offset?: number
}

export interface AuditStats {
  total: number
  by_status: Record<string, number>
  by_risk_level: Record<string, number>
  by_action: Record<string, number>
  approval_rate: number
  decided_count: number
}

export interface AuditResult {
  total: number
  items: ApprovalItem[]
}

export interface AggregatedAuditData {
  stats: AuditStats
  items: ApprovalItem[]
  total: number
}

async function fetchAuditLog(
  baseUrl: string,
  _agentName: string,
  filters: AuditFilters,
): Promise<AuditResult | null> {
  try {
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.riskLevel) params.set('risk_level', filters.riskLevel)
    if (filters.agentName) params.set('agent_name', filters.agentName)
    params.set('limit', String(filters.limit || 50))
    params.set('offset', String(filters.offset || 0))

    const url = `${baseUrl}/governance/approvals/audit?${params}`
    const resp = await fetch(url, { headers: authHeaders(), signal: AbortSignal.timeout(8000) })
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    // Expected: 审计日志接口超时/不可达；按无数据聚合
    return null
  }
}

async function fetchAuditStats(
  baseUrl: string,
  _agentName: string,
): Promise<AuditStats | null> {
  try {
    const url = `${baseUrl}/governance/approvals/audit/stats`
    const resp = await fetch(url, { headers: authHeaders(), signal: AbortSignal.timeout(8000) })
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    // Expected: 审计统计接口超时/不可达；按无数据聚合
    return null
  }
}

export async function loadAuditData(
  solution: SolutionConfig,
  filters: AuditFilters = {},
): Promise<AggregatedAuditData> {
  const agents = solution.agents

  const [logResults, statsResults] = await Promise.all([
    Promise.all(agents.map(a => fetchAuditLog(a.baseUrl, a.id, filters))),
    Promise.all(agents.map(a => fetchAuditStats(a.baseUrl, a.id))),
  ])

  const allItems: ApprovalItem[] = []
  let totalCount = 0
  for (const r of logResults) {
    if (r) {
      allItems.push(...r.items)
      totalCount += r.total
    }
  }

  allItems.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const mergedStats: AuditStats = {
    total: 0,
    by_status: {},
    by_risk_level: {},
    by_action: {},
    approval_rate: 0,
    decided_count: 0,
  }

  for (const s of statsResults) {
    if (!s) continue
    mergedStats.total += s.total
    mergedStats.decided_count += s.decided_count
    for (const [k, v] of Object.entries(s.by_status)) {
      mergedStats.by_status[k] = (mergedStats.by_status[k] || 0) + v
    }
    for (const [k, v] of Object.entries(s.by_risk_level)) {
      mergedStats.by_risk_level[k] = (mergedStats.by_risk_level[k] || 0) + v
    }
    for (const [k, v] of Object.entries(s.by_action)) {
      mergedStats.by_action[k] = (mergedStats.by_action[k] || 0) + v
    }
  }

  const approved = mergedStats.by_status['approved'] || 0
  mergedStats.approval_rate = mergedStats.decided_count > 0
    ? Math.round(approved / mergedStats.decided_count * 1000) / 10
    : 0

  return {
    stats: mergedStats,
    items: allItems,
    total: totalCount,
  }
}

export async function exportAuditCSV(
  solution: SolutionConfig,
  filters: AuditFilters = {},
): Promise<string> {
  const agents = solution.agents
  const results = await Promise.all(
    agents.map(async a => {
      try {
        const params = new URLSearchParams({ format: 'csv' })
        if (filters.status) params.set('status', filters.status)
        if (filters.agentName) params.set('agent_name', filters.agentName)
        const url = `${a.baseUrl}/governance/approvals/audit/export?${params}`
        const resp = await fetch(url, { headers: authHeaders(), signal: AbortSignal.timeout(15000) })
        if (!resp.ok) return ''
        const data = (await resp.json()) as AuditExportJsonResponse
        return data.csv || ''
      } catch {
        // Expected: 单 Agent 导出失败；其他 Agent 结果仍合并
        return ''
      }
    })
  )

  return results.filter(Boolean).join('\n')
}
