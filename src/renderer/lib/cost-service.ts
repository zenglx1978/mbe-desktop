/**
 * Cost Attribution Service — 成本归因数据聚合
 *
 * 从各 Agent 后端的 /billing/cost-attribution 和 /billing/cost-trend
 * 聚合成本数据，支持三维度（expert/solution/workflow）切片。
 */

import type { SolutionConfig } from '@/lib/solution-router'
import { authHeaders } from '@/lib/api-client'

export type CostDimension = 'expert_id' | 'solution_id' | 'workflow_step' | 'action'
export type CostPeriod = 'today' | 'week' | 'month' | 'all'

export interface CostBreakdownItem {
  dimension: string
  call_count: number
  tokens_in: number
  tokens_out: number
  total_tokens: number
  cost_yuan: number
  percentage: number
}

export interface CostAttribution {
  agentId: string
  period: CostPeriod
  groupBy: CostDimension
  totalCostYuan: number
  totalTokens: number
  totalCalls: number
  breakdown: CostBreakdownItem[]
}

export interface CostTrendPoint {
  date: string
  call_count: number
  total_tokens: number
  cost_yuan: number
}

export interface CostTrend {
  agentId: string
  days: number
  trend: CostTrendPoint[]
}

export interface AggregatedCostData {
  totalCostYuan: number
  totalTokens: number
  totalCalls: number
  byAgent: CostAttribution[]
  mergedBreakdown: CostBreakdownItem[]
  trend: CostTrendPoint[]
}

async function fetchCostAttribution(
  baseUrl: string,
  agentId: string,
  period: CostPeriod,
  groupBy: CostDimension,
): Promise<CostAttribution | null> {
  try {
    const params = new URLSearchParams({ period, group_by: groupBy })
    const resp = await fetch(`${baseUrl}/billing/cost-attribution?${params}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(8000),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return {
      agentId,
      period,
      groupBy,
      totalCostYuan: data.total_cost_yuan || 0,
      totalTokens: data.total_tokens || 0,
      totalCalls: data.total_calls || 0,
      breakdown: data.breakdown || [],
    }
  } catch {
    return null
  }
}

async function fetchCostTrend(
  baseUrl: string,
  agentId: string,
  days: number,
): Promise<CostTrend | null> {
  try {
    const resp = await fetch(`${baseUrl}/billing/cost-trend?days=${days}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(8000),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return {
      agentId,
      days,
      trend: data.trend || [],
    }
  } catch {
    return null
  }
}

/**
 * 加载并聚合所有 Agent 的成本归因数据
 */
export async function loadCostData(
  solution: SolutionConfig,
  period: CostPeriod = 'month',
  groupBy: CostDimension = 'expert_id',
  trendDays: number = 7,
): Promise<AggregatedCostData> {
  const agents = solution.agents

  const [attrResults, trendResults] = await Promise.all([
    Promise.all(
      agents.map(a => fetchCostAttribution(a.baseUrl, a.id, period, groupBy))
    ),
    Promise.all(
      agents.map(a => fetchCostTrend(a.baseUrl, a.id, trendDays))
    ),
  ])

  const byAgent = attrResults.filter((r): r is CostAttribution => r !== null)
  const trends = trendResults.filter((r): r is CostTrend => r !== null)

  let totalCostYuan = 0
  let totalTokens = 0
  let totalCalls = 0
  const mergedMap = new Map<string, CostBreakdownItem>()

  for (const attr of byAgent) {
    totalCostYuan += attr.totalCostYuan
    totalTokens += attr.totalTokens
    totalCalls += attr.totalCalls

    for (const item of attr.breakdown) {
      const existing = mergedMap.get(item.dimension)
      if (existing) {
        existing.call_count += item.call_count
        existing.tokens_in += item.tokens_in
        existing.tokens_out += item.tokens_out
        existing.total_tokens += item.total_tokens
        existing.cost_yuan += item.cost_yuan
      } else {
        mergedMap.set(item.dimension, { ...item })
      }
    }
  }

  const mergedBreakdown = Array.from(mergedMap.values())
    .map(item => ({
      ...item,
      cost_yuan: Math.round(item.cost_yuan * 10000) / 10000,
      percentage: totalCostYuan > 0
        ? Math.round((item.cost_yuan / totalCostYuan) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.cost_yuan - a.cost_yuan)

  // 合并趋势数据
  const trendMap = new Map<string, CostTrendPoint>()
  for (const t of trends) {
    for (const point of t.trend) {
      const existing = trendMap.get(point.date)
      if (existing) {
        existing.call_count += point.call_count
        existing.total_tokens += point.total_tokens
        existing.cost_yuan += point.cost_yuan
      } else {
        trendMap.set(point.date, { ...point })
      }
    }
  }
  const trend = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  return {
    totalCostYuan: Math.round(totalCostYuan * 10000) / 10000,
    totalTokens,
    totalCalls,
    byAgent,
    mergedBreakdown,
    trend,
  }
}
