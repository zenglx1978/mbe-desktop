/**
 * 统一预测仪表盘 — 聚合四域预测结果可视化
 *
 * 覆盖：
 *   Finance  — 13周现金流预测 + 动态异常信号
 *   Operations — OEE 趋势预测 + 设备故障概率
 *   Invest   — 预测准确率热图 + 信号权重
 *   Sales    — Pipeline 加权价值 + 商机成交预测
 *
 * 设计原则：
 *   - 纯展示组件，数据由父组件或 hook 传入
 *   - 使用 Recharts（已在 package.json 声明）
 *   - 降级友好：数据为 null/空时显示骨架占位
 */

import { useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts'

// ── 颜色常量 ──────────────────────────────────────────────

const COLORS = {
  primary:  '#3b82f6',
  success:  '#22c55e',
  warning:  '#f59e0b',
  danger:   '#ef4444',
  muted:    '#94a3b8',
  info:     '#06b6d4',
  purple:   '#8b5cf6',
}

// ── 共用工具组件 ──────────────────────────────────────────

function SectionTitle({ icon, title, badge }: { icon: string; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-lg">{icon}</span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {badge && (
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          {badge}
        </span>
      )}
    </div>
  )
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-muted-foreground text-xs">
      {message || '暂无数据'}
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    critical: { bg: 'bg-red-500/15',    text: 'text-red-400',    label: '严重' },
    warning:  { bg: 'bg-amber-500/15',  text: 'text-amber-400',  label: '警告' },
    info:     { bg: 'bg-blue-500/15',   text: 'text-blue-400',   label: '提示' },
  }
  const c = cfg[severity] || cfg.info
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.bg} ${c.text} font-medium`}>
      {c.label}
    </span>
  )
}

// ── 类型定义 ─────────────────────────────────────────────

export interface ForecastPoint {
  label: string        // x轴标签（如"W1", "第1周", "M+1"）
  value: number        // 预测值
  lower?: number       // 置信下界
  upper?: number       // 置信上界
  actual?: number      // 实际值（有则叠加显示）
}

export interface AnomalySignal {
  metric: string
  current_value: number
  z_score: number
  severity: 'critical' | 'warning' | 'info'
  description: string
  period?: string
}

export interface DealForecastItem {
  opportunity_id: string
  company_name?: string
  stage: string
  amount: number
  adjusted_probability: number
  weighted_value: number
  predicted_close_days?: number
  risk_flags: string[]
}

export interface PredictionAccuracyByType {
  prediction_type: string
  direction_accuracy?: number
  verified: number
  trend: string
}

export interface PredictionDashboardData {
  finance?: {
    cash_flow_forecast?: ForecastPoint[]   // 13周现金流预测
    anomaly_signals?: AnomalySignal[]
    scan_period?: string
  }
  operations?: {
    oee_forecast?: ForecastPoint[]         // OEE 趋势预测
    equipment_failure_prob?: number        // 当前设备故障概率 %
    equipment_risk_level?: string          // normal / soon / urgent / overdue
    quality_forecast?: ForecastPoint[]
  }
  invest?: {
    accuracy_by_type?: PredictionAccuracyByType[]
    overall_accuracy?: number
    signal_weight_updates?: Array<{
      signal_key: string
      current_weight: number
      suggested_weight: number
    }>
  }
  sales?: {
    total_weighted_value?: number
    expected_revenue?: number
    deal_forecasts?: DealForecastItem[]
    high_probability_count?: number
    at_risk_count?: number
  }
}

interface Props {
  data: PredictionDashboardData
  loading?: boolean
  className?: string
}

// ── 子面板：财务现金流预测 ────────────────────────────────

function FinanceForecastPanel({ data }: { data: NonNullable<PredictionDashboardData['finance']> }) {
  const chartData = useMemo(() =>
    (data.cash_flow_forecast || []).map(p => ({
      name: p.label,
      预测值: p.value,
      下界: p.lower,
      上界: p.upper,
      实际: p.actual,
    })),
    [data.cash_flow_forecast]
  )

  const signals = data.anomaly_signals || []
  const criticals = signals.filter(s => s.severity === 'critical')
  const warnings = signals.filter(s => s.severity === 'warning')

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <SectionTitle
        icon="💰"
        title="财务预测"
        badge={data.scan_period || undefined}
      />

      {/* 现金流折线图 */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLORS.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.muted }} />
            <YAxis tick={{ fontSize: 10, fill: COLORS.muted }} width={48} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
            />
            {/* 置信区间面积 */}
            {chartData[0]?.上界 !== undefined && (
              <Area type="monotone" dataKey="上界" stroke="none" fill="rgba(59,130,246,0.08)" />
            )}
            <Area
              type="monotone"
              dataKey="预测值"
              stroke={COLORS.primary}
              fill="url(#cashGrad)"
              strokeWidth={2}
              dot={false}
            />
            {chartData.some(d => d.实际 !== undefined) && (
              <Line type="monotone" dataKey="实际" stroke={COLORS.success} strokeWidth={1.5} dot={false} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState message="暂无现金流预测数据" />
      )}

      {/* 异常信号 */}
      {signals.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] text-muted-foreground">
            异常信号：{criticals.length > 0 && <span className="text-red-400">{criticals.length} 严重</span>}
            {warnings.length > 0 && <span className="text-amber-400 ml-1">{warnings.length} 警告</span>}
          </p>
          {signals.slice(0, 3).map((sig, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              <SeverityBadge severity={sig.severity} />
              <span className="text-muted-foreground flex-1 leading-tight">{sig.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 子面板：运营 OEE 预测 ─────────────────────────────────

function OperationsForecastPanel({ data }: { data: NonNullable<PredictionDashboardData['operations']> }) {
  const oeeData = useMemo(() =>
    (data.oee_forecast || []).map(p => ({
      name: p.label,
      OEE: p.value,
      下界: p.lower,
      上界: p.upper,
    })),
    [data.oee_forecast]
  )

  const failureProb = data.equipment_failure_prob ?? 0
  const riskLevel = data.equipment_risk_level || 'normal'
  const riskColor: Record<string, string> = {
    normal: COLORS.success,
    soon: COLORS.info,
    urgent: COLORS.warning,
    overdue: COLORS.danger,
  }
  const riskLabel: Record<string, string> = {
    normal: '正常', soon: '建议维护', urgent: '需尽快维护', overdue: '已超期',
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <SectionTitle icon="🏭" title="运营预测" />

      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* 设备故障概率 */}
        <div className="rounded-lg bg-muted/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground mb-1">设备故障概率</p>
          <p className="text-xl font-bold" style={{ color: riskColor[riskLevel] }}>
            {failureProb.toFixed(1)}%
          </p>
          <p className="text-[10px]" style={{ color: riskColor[riskLevel] }}>
            {riskLabel[riskLevel]}
          </p>
        </div>
        {/* OEE 目标 */}
        <div className="rounded-lg bg-muted/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground mb-1">预测 OEE</p>
          <p className="text-xl font-bold text-foreground">
            {oeeData.length > 0 ? `${oeeData[0].OEE.toFixed(1)}%` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground">下期均值</p>
        </div>
      </div>

      {/* OEE 折线图 */}
      {oeeData.length > 0 ? (
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={oeeData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.muted }} />
            <YAxis tick={{ fontSize: 10, fill: COLORS.muted }} domain={[50, 100]} width={36} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
            />
            <ReferenceLine y={85} stroke={COLORS.success} strokeDasharray="4 2"
              label={{ value: '85%目标', position: 'right', fontSize: 9, fill: COLORS.success }} />
            <Line type="monotone" dataKey="OEE" stroke={COLORS.info} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState message="暂无 OEE 预测数据" />
      )}
    </div>
  )
}

// ── 子面板：投资预测准确率 ────────────────────────────────

function InvestAccuracyPanel({ data }: { data: NonNullable<PredictionDashboardData['invest']> }) {
  const radarData = useMemo(() =>
    (data.accuracy_by_type || []).map(t => ({
      type: t.prediction_type,
      准确率: t.direction_accuracy != null ? Math.round(t.direction_accuracy * 100) : 0,
      样本数: Math.min(100, t.verified * 5),  // 归一化到 0-100 方便雷达展示
    })),
    [data.accuracy_by_type]
  )

  const overallAcc = data.overall_accuracy
  const updates = data.signal_weight_updates || []

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <SectionTitle
        icon="📊"
        title="投资预测准确率"
        badge={overallAcc != null ? `整体 ${(overallAcc * 100).toFixed(0)}%` : undefined}
      />

      {radarData.length > 0 ? (
        <ResponsiveContainer width="100%" height={160}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="rgba(148,163,184,0.15)" />
            <PolarAngleAxis dataKey="type" tick={{ fontSize: 10, fill: COLORS.muted }} />
            <Radar name="准确率" dataKey="准确率" stroke={COLORS.purple} fill={COLORS.purple} fillOpacity={0.25} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState message="暂无回测数据" />
      )}

      {/* 权重更新建议 */}
      {updates.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-[10px] text-muted-foreground">权重调整建议</p>
          {updates.slice(0, 3).map((u, i) => {
            const delta = u.suggested_weight - u.current_weight
            return (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground w-20 truncate">{u.signal_key}</span>
                <span className="text-muted-foreground">{(u.current_weight * 100).toFixed(0)}%</span>
                <span className="text-muted-foreground">→</span>
                <span className={delta > 0 ? 'text-green-400' : 'text-red-400'}>
                  {(u.suggested_weight * 100).toFixed(0)}%
                  {delta > 0 ? ' ↑' : ' ↓'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── 子面板：Sales Pipeline 预测 ──────────────────────────

function SalesForecastPanel({ data }: { data: NonNullable<PredictionDashboardData['sales']> }) {
  const dealData = useMemo(() =>
    (data.deal_forecasts || [])
      .slice(0, 8)
      .sort((a, b) => b.weighted_value - a.weighted_value)
      .map(d => ({
        name: d.company_name?.slice(0, 8) || d.opportunity_id.slice(0, 6),
        加权金额: Math.round(d.weighted_value),
        概率: Math.round(d.adjusted_probability),
        hasRisk: d.risk_flags.length > 0,
      })),
    [data.deal_forecasts]
  )

  const totalWeighted = data.total_weighted_value ?? 0
  const expectedRev = data.expected_revenue ?? 0
  const highProbCount = data.high_probability_count ?? 0
  const atRiskCount = data.at_risk_count ?? 0

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <SectionTitle icon="🎯" title="Sales Pipeline 预测" />

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-muted/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground">加权预测总值</p>
          <p className="text-lg font-bold text-foreground">
            ¥{totalWeighted >= 10000
              ? `${(totalWeighted / 10000).toFixed(1)}万`
              : totalWeighted.toLocaleString()
            }
          </p>
        </div>
        <div className="rounded-lg bg-muted/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground">预期成交</p>
          <p className="text-lg font-bold text-primary">
            ¥{expectedRev >= 10000
              ? `${(expectedRev / 10000).toFixed(1)}万`
              : expectedRev.toLocaleString()
            }
          </p>
        </div>
        <div className="rounded-lg bg-muted/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground">高概率商机</p>
          <p className="text-lg font-bold text-green-400">{highProbCount}</p>
        </div>
        <div className="rounded-lg bg-muted/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground">风险商机</p>
          <p className="text-lg font-bold text-amber-400">{atRiskCount}</p>
        </div>
      </div>

      {/* 商机加权金额柱图 */}
      {dealData.length > 0 ? (
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={dealData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: COLORS.muted }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: COLORS.muted }} width={56} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
              formatter={(v: unknown, name: unknown) => {
                const val = typeof v === 'number' ? v : Number(v)
                const label = String(name)
                return label === '加权金额'
                  ? [`¥${val.toLocaleString()}`, label]
                  : [`${val}%`, label]
              }}
            />
            <Bar dataKey="加权金额" fill={COLORS.primary} radius={[0, 3, 3, 0]} maxBarSize={12} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState message="暂无活跃商机" />
      )}
    </div>
  )
}

// ── 主仪表盘组件 ─────────────────────────────────────────

export default function PredictionDashboard({ data, loading, className = '' }: Props) {
  if (loading) {
    return (
      <div className={`grid grid-cols-2 gap-4 ${className}`}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-border/40 bg-card p-4 h-48 animate-pulse">
            <div className="h-3 bg-muted/40 rounded w-1/3 mb-3" />
            <div className="h-32 bg-muted/20 rounded" />
          </div>
        ))}
      </div>
    )
  }

  const hasAnyData =
    data.finance || data.operations || data.invest || data.sales

  if (!hasAnyData) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 text-muted-foreground ${className}`}>
        <span className="text-4xl mb-3 opacity-30">📈</span>
        <p className="text-sm">暂无预测数据</p>
        <p className="text-xs mt-1 opacity-60">各 Agent 完成首次预测后将在此展示</p>
      </div>
    )
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`}>
      {data.finance    && <FinanceForecastPanel    data={data.finance} />}
      {data.operations && <OperationsForecastPanel data={data.operations} />}
      {data.invest     && <InvestAccuracyPanel     data={data.invest} />}
      {data.sales      && <SalesForecastPanel      data={data.sales} />}
    </div>
  )
}
