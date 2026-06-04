/**
 * 预测数据聚合服务 — 聚合四个 Agent 的预测 API
 *
 * 端口映射：
 *   Finance  → 8002  /api/finance/dashboard/dynamic-anomaly
 *   Operations → 8015  /api/operations/predict/oee
 *   Invest   → 8011  /api/invest/predictions/backtest
 *   Sales    → 8008  /pipeline/forecast
 */

import { API_BASE, authHeaders } from './api-client'

// ── Agent 端口配置（开发模式走 Vite 代理，生产模式同 API_BASE）───
function agentBase(port: number): string {
  if (import.meta.env.DEV) {
    return `http://localhost:${port}`
  }
  return API_BASE
}

const FINANCE_BASE    = agentBase(8002)
const OPERATIONS_BASE = agentBase(8015)
const INVEST_BASE     = agentBase(8011)
const SALES_BASE      = agentBase(8008)

// ── 类型定义 ──────────────────────────────────────────────────

export interface FinanceForecastData {
  anomalies: Array<{
    metric: string
    signal_type: string
    severity: string
    value: number
    message: string
  }>
  scan_time: string
  total_anomalies: number
}

export interface OperationsForecastData {
  oee_trend: {
    predicted: number[]
    lower_bound: number[]
    upper_bound: number[]
    method: string
    risk_level: string
    spc_signals: string[]
  } | null
  equipment_risk: {
    failure_probability: number
    maintenance_urgency: string
    recommended_action: string
  } | null
  quality_trend: {
    predicted_defect_rate: number[]
    quality_level: string
    spc_signals: string[]
  } | null
}

export interface InvestForecastData {
  total_predictions: number
  verified_count: number
  expired_count: number
  overall_accuracy: number | null
  weight_updates: Array<{
    signal_type: string
    current_weight: number
    suggested_weight: number
    change_pct: number
  }>
  insights: string[]
}

export interface SalesForecastData {
  pipeline_total: number
  weighted_revenue: number
  expected_close_30d: number
  expected_close_90d: number
  high_risk_deals: number
  revenue_trend: number[]
  confidence: number
}

export interface PredictionDashboardData {
  finance?: FinanceForecastData
  operations?: OperationsForecastData
  invest?: InvestForecastData
  sales?: SalesForecastData
}

// ── 内部 fetch 辅助 ──────────────────────────────────────────

async function safeFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T | undefined> {
  try {
    const res = await fetch(url, { ...init, headers: authHeaders(init?.headers as Record<string, string>) })
    if (!res.ok) return undefined
    return (await res.json()) as T
  } catch {
    return undefined
  }
}

// ── Finance 动态异常扫描 ─────────────────────────────────────

export async function fetchFinanceForecast(
  metrics: Record<string, number[]>,
): Promise<FinanceForecastData | undefined> {
  const body = { metrics, window: 6 }
  const data = await safeFetch<{
    anomalies: FinanceForecastData['anomalies']
    scan_time: string
    total_anomalies: number
  }>(
    `${FINANCE_BASE}/api/finance/dashboard/dynamic-anomaly`,
    { method: 'POST', body: JSON.stringify(body) },
  )
  return data
}

// ── Operations OEE 预测 ──────────────────────────────────────

export async function fetchOperationsForecast(params?: {
  oee_history?: number[]
  equipment_age_hours?: number
  mtbf_history?: number[]
  defect_rate_history?: number[]
  cpk_history?: number[]
}): Promise<OperationsForecastData> {
  const result: OperationsForecastData = {
    oee_trend: null,
    equipment_risk: null,
    quality_trend: null,
  }

  const [oeeData, eqData, qualData] = await Promise.all([
    params?.oee_history?.length
      ? safeFetch<{ forecast: OperationsForecastData['oee_trend'] }>(
          `${OPERATIONS_BASE}/api/operations/predict/oee`,
          { method: 'POST', body: JSON.stringify({ oee_history: params.oee_history }) },
        )
      : Promise.resolve(undefined),
    params?.equipment_age_hours !== undefined
      ? safeFetch<{ prediction: OperationsForecastData['equipment_risk'] }>(
          `${OPERATIONS_BASE}/api/operations/predict/equipment-failure`,
          {
            method: 'POST',
            body: JSON.stringify({
              equipment_age_hours: params.equipment_age_hours,
              mtbf_history: params.mtbf_history ?? [],
            }),
          },
        )
      : Promise.resolve(undefined),
    params?.defect_rate_history?.length
      ? safeFetch<{ forecast: OperationsForecastData['quality_trend'] }>(
          `${OPERATIONS_BASE}/api/operations/predict/quality-defect`,
          {
            method: 'POST',
            body: JSON.stringify({
              defect_rate_history: params.defect_rate_history,
              cpk_history: params.cpk_history ?? [],
            }),
          },
        )
      : Promise.resolve(undefined),
  ])

  if (oeeData?.forecast)     result.oee_trend      = oeeData.forecast
  if (eqData?.prediction)    result.equipment_risk = eqData.prediction
  if (qualData?.forecast)    result.quality_trend  = qualData.forecast

  return result
}

// ── Invest 回测报告 ──────────────────────────────────────────

export async function fetchInvestForecast(): Promise<InvestForecastData | undefined> {
  return safeFetch<InvestForecastData>(
    `${INVEST_BASE}/api/invest/predictions/backtest`,
    { method: 'POST' },
  )
}

// ── Sales Pipeline 预测 ──────────────────────────────────────

export async function fetchSalesForecast(
  opportunities: Array<Record<string, unknown>>,
  historicalRevenue?: number[],
): Promise<SalesForecastData | undefined> {
  if (!opportunities.length) return undefined

  return safeFetch<SalesForecastData>(
    `${SALES_BASE}/pipeline/forecast`,
    {
      method: 'POST',
      body: JSON.stringify({
        opportunities,
        forecast_days: 90,
        historical_revenue_series: historicalRevenue ?? [],
      }),
    },
  )
}

// ── 聚合入口（并行拉取四个 Agent）────────────────────────────

export async function fetchPredictionDashboard(opts?: {
  financeMetrics?: Record<string, number[]>
  operationsParams?: Parameters<typeof fetchOperationsForecast>[0]
  salesOpportunities?: Array<Record<string, unknown>>
  salesHistoricalRevenue?: number[]
}): Promise<PredictionDashboardData> {
  const [finance, operations, invest, sales] = await Promise.all([
    opts?.financeMetrics
      ? fetchFinanceForecast(opts.financeMetrics)
      : Promise.resolve(undefined),
    fetchOperationsForecast(opts?.operationsParams),
    fetchInvestForecast(),
    opts?.salesOpportunities
      ? fetchSalesForecast(
          opts.salesOpportunities,
          opts.salesHistoricalRevenue,
        )
      : Promise.resolve(undefined),
  ])

  return {
    finance:    finance    ?? undefined,
    operations: (operations.oee_trend || operations.equipment_risk || operations.quality_trend)
                  ? operations : undefined,
    invest:     invest     ?? undefined,
    sales:      sales      ?? undefined,
  }
}
