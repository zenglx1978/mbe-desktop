/**
 * usePredictionDashboard — 统一预测仪表盘数据 Hook
 *
 * 聚合 Finance / Operations / Invest / Sales 四路 Agent 预测 API，
 * 提供 loading、error、data 状态及手动刷新能力。
 *
 * 使用示例：
 *   const { data, loading, refresh } = usePredictionDashboard({
 *     financeMetrics: { revenue: [100, 110, 120], cost: [60, 65, 70] },
 *   })
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchPredictionDashboard,
  type PredictionDashboardData as ServiceData,
} from '../lib/prediction-service'
import type { PredictionDashboardData } from '../components/dashboard/PredictionDashboard'

// ── 选项 ──────────────────────────────────────────────────────

export interface UsePredictionDashboardOptions {
  /** 财务指标序列，key 为指标名，value 为时序数值 */
  financeMetrics?: Record<string, number[]>
  /** 运营预测参数 */
  operationsParams?: {
    oee_history?: number[]
    equipment_age_hours?: number
    mtbf_history?: number[]
    defect_rate_history?: number[]
    cpk_history?: number[]
  }
  /** 销售商机列表 */
  salesOpportunities?: Array<Record<string, unknown>>
  /** 历史销售额序列（辅助趋势预测） */
  salesHistoricalRevenue?: number[]
  /** 是否在 mount 时自动拉取（默认 true） */
  autoFetch?: boolean
  /** 轮询间隔（ms），0 表示不轮询 */
  pollingMs?: number
}

// ── 返回类型 ─────────────────────────────────────────────────

export interface UsePredictionDashboardResult {
  data: PredictionDashboardData
  loading: boolean
  error: string | null
  /** 手动触发刷新 */
  refresh: () => Promise<void>
  /** 最后更新时间 */
  lastUpdated: Date | null
}

// ── 适配器：将 Service 响应映射到组件 Props ────────────────────

function adaptServiceData(raw: ServiceData): PredictionDashboardData {
  const result: PredictionDashboardData = {}

  if (raw.finance) {
    result.finance = {
      anomaly_signals: raw.finance.anomalies?.map(a => ({
        metric:        a.metric,
        current_value: a.value,
        z_score:       0,
        severity:      (a.severity as 'critical' | 'warning' | 'info') ?? 'info',
        description:   a.message,
      })) ?? [],
      scan_period: raw.finance.scan_time,
    }
  }

  if (raw.operations) {
    const ops = raw.operations
    result.operations = {
      oee_forecast: ops.oee_trend?.predicted?.map((v, i) => ({
        label: `预测${i + 1}`,
        value: v,
        lower: ops.oee_trend?.lower_bound?.[i],
        upper: ops.oee_trend?.upper_bound?.[i],
      })),
      equipment_failure_prob: ops.equipment_risk
        ? Math.round((ops.equipment_risk.failure_probability ?? 0) * 100)
        : undefined,
      equipment_risk_level: ops.equipment_risk?.maintenance_urgency,
      quality_forecast: ops.quality_trend?.predicted_defect_rate?.map((v, i) => ({
        label: `预测${i + 1}`,
        value: v,
      })),
    }
  }

  if (raw.invest) {
    result.invest = {
      overall_accuracy: raw.invest.overall_accuracy ?? undefined,
      signal_weight_updates: raw.invest.weight_updates?.map(w => ({
        signal_key:       w.signal_type,
        current_weight:   w.current_weight,
        suggested_weight: w.suggested_weight,
      })),
    }
  }

  if (raw.sales) {
    result.sales = {
      total_weighted_value:   raw.sales.weighted_revenue,
      expected_revenue:       raw.sales.expected_close_90d,
      high_probability_count: undefined,
      at_risk_count:          raw.sales.high_risk_deals,
    }
  }

  return result
}

// ── Hook 实现 ─────────────────────────────────────────────────

export function usePredictionDashboard(
  opts: UsePredictionDashboardOptions = {},
): UsePredictionDashboardResult {
  const {
    financeMetrics,
    operationsParams,
    salesOpportunities,
    salesHistoricalRevenue,
    autoFetch = true,
    pollingMs = 0,
  } = opts

  const [data, setData]               = useState<PredictionDashboardData>({} as PredictionDashboardData)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const pollingRef                    = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef                      = useRef<AbortController | null>(null)

  const fetch = useCallback(async () => {
    // 取消前一次未完成的请求
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      const raw = await fetchPredictionDashboard({
        financeMetrics,
        operationsParams,
        salesOpportunities,
        salesHistoricalRevenue,
      })
      setData(adaptServiceData(raw))
      setLastUpdated(new Date())
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : '获取预测数据失败')
    } finally {
      setLoading(false)
    }
  }, [
    financeMetrics,
    operationsParams,
    salesOpportunities,
    salesHistoricalRevenue,
  ])

  // 初始自动拉取
  useEffect(() => {
    if (autoFetch) {
      void fetch()
    }
    return () => {
      abortRef.current?.abort()
    }
  }, [autoFetch, fetch])

  // 轮询
  useEffect(() => {
    if (pollingMs > 0) {
      pollingRef.current = setInterval(() => void fetch(), pollingMs)
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [pollingMs, fetch])

  return { data, loading, error, refresh: fetch, lastUpdated }
}

export default usePredictionDashboard
