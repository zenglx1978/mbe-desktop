/**
 * State 高级可视化 Widget 组件库
 *
 * 将 WorkflowState 的原始 JSON 智能识别为可视化 Widget：
 *   - SparkLine: 纯 SVG 趋势线（snapshots → 指标趋势）
 *   - KpiCard: 数值 KPI 卡（含趋势箭头 + 环比变化）
 *   - CountdownCard: 日期倒计时（合同到期、申报截止）
 *   - ProgressRing: SVG 圆环进度条（完成率、成功率）
 *   - ActionList: 待办事项列表（pending_actions 专属）
 *   - detectWidgetType: 自动识别字段类型的分类器
 *
 * 设计原则：零外部图表依赖，纯 React + SVG 实现。
 */
import { useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Minus, Clock, CheckCircle2,
  AlertCircle, Timer, Activity,
} from 'lucide-react'

// ─── 类型 ───

export interface Snapshot {
  ts: string
  v: number
  m: Record<string, number>
}

export interface StateData {
  schedule_id?: string
  version?: number
  last_updated?: string
  accumulated_context?: Record<string, unknown>
  last_result_summary?: string
  pending_actions?: Array<Record<string, unknown>>
  user_inputs?: Record<string, unknown>
  custom_data?: Record<string, unknown>
  snapshots?: Snapshot[]
}

type WidgetType = 'kpi' | 'countdown' | 'progress' | 'text' | 'list' | 'trend'

interface DetectedWidget {
  type: WidgetType
  key: string
  label: string
  value: unknown
  trendData?: number[]
}

// ─── 字段类型检测器 ───

const DATE_KEYWORDS = ['到期', '截止', 'expire', 'deadline', 'due', '过期']
const PROGRESS_KEYWORDS = ['完成率', '成功率', '进度', 'rate', 'ratio', 'percent', '覆盖率']

export function detectWidgetType(key: string, value: unknown): WidgetType {
  if (value === null || value === undefined) return 'text'

  if (typeof value === 'string') {
    if (DATE_KEYWORDS.some((kw) => key.toLowerCase().includes(kw))) {
      const d = Date.parse(value)
      if (!isNaN(d)) return 'countdown'
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      if (DATE_KEYWORDS.some((kw) => key.toLowerCase().includes(kw))) return 'countdown'
    }
    return 'text'
  }

  if (typeof value === 'number' && !isNaN(value)) {
    if (PROGRESS_KEYWORDS.some((kw) => key.toLowerCase().includes(kw))) return 'progress'
    return 'kpi'
  }

  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === 'number')) return 'trend'
    return 'list'
  }

  return 'text'
}

export function detectWidgets(state: StateData): DetectedWidget[] {
  const widgets: DetectedWidget[] = []
  const ctx = state.accumulated_context || {}
  const snapshots = state.snapshots || []

  for (const [key, value] of Object.entries(ctx)) {
    if (key.startsWith('_')) continue
    const type = detectWidgetType(key, value)
    const label = key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())

    const w: DetectedWidget = { type, key, label, value }

    if (type === 'kpi' && snapshots.length >= 2) {
      const trend = snapshots.map((s) => s.m?.[key]).filter((v): v is number => v !== undefined)
      if (trend.length >= 2) w.trendData = trend
    }

    widgets.push(w)
  }

  return widgets
}

// ─── SparkLine: 纯 SVG 迷你趋势图 ───

interface SparkLineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  showArea?: boolean
}

export function SparkLine({
  data,
  width = 120,
  height = 32,
  color = '#6366f1',
  showArea = true,
}: SparkLineProps) {
  const path = useMemo(() => {
    if (data.length < 2) return ''
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const padY = 2
    const usableH = height - padY * 2

    const points = data.map((v, i) => ({
      x: (i / (data.length - 1)) * width,
      y: padY + usableH - ((v - min) / range) * usableH,
    }))

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    return linePath
  }, [data, width, height])

  const areaPath = useMemo(() => {
    if (!showArea || data.length < 2) return ''
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const padY = 2
    const usableH = height - padY * 2

    const points = data.map((v, i) => ({
      x: (i / (data.length - 1)) * width,
      y: padY + usableH - ((v - min) / range) * usableH,
    }))

    return (
      points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
      ` L${width},${height} L0,${height} Z`
    )
  }, [data, width, height, showArea])

  if (data.length < 2) return null

  return (
    <svg width={width} height={height} className="shrink-0">
      {showArea && areaPath && (
        <path d={areaPath} fill={`${color}15`} />
      )}
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={(data.length - 1) / (data.length - 1) * width}
        cy={(() => {
          const min = Math.min(...data)
          const max = Math.max(...data)
          const range = max - min || 1
          return 2 + (height - 4) - ((data[data.length - 1] - min) / range) * (height - 4)
        })()}
        r={2.5}
        fill={color}
      />
    </svg>
  )
}

// ─── ProgressRing: SVG 圆环进度条 ───

interface ProgressRingProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  color?: string
}

export function ProgressRing({
  value,
  max = 100,
  size = 48,
  strokeWidth = 4,
  color = '#22c55e',
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(Math.max(value / max, 0), 1)
  const offset = circumference * (1 - pct)

  const ringColor = pct >= 0.8 ? '#22c55e' : pct >= 0.5 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          className="text-border/20"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color || ringColor} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-[11px] font-bold" style={{ color: color || ringColor }}>
        {Math.round(pct * 100)}%
      </span>
    </div>
  )
}

// ─── KpiCard ───

interface KpiCardProps {
  label: string
  value: number
  trendData?: number[]
  color?: string
  unit?: string
}

export function KpiCard({ label, value, trendData, color = '#6366f1', unit = '' }: KpiCardProps) {
  const trend = useMemo(() => {
    if (!trendData || trendData.length < 2) return null
    const prev = trendData[trendData.length - 2]
    const curr = trendData[trendData.length - 1]
    if (prev === 0) return { dir: 'flat' as const, pct: 0 }
    const pct = ((curr - prev) / Math.abs(prev)) * 100
    return { dir: pct > 0.5 ? 'up' as const : pct < -0.5 ? 'down' as const : 'flat' as const, pct }
  }, [trendData])

  const TrendIcon = trend?.dir === 'up' ? TrendingUp : trend?.dir === 'down' ? TrendingDown : Minus
  const trendColor = trend?.dir === 'up' ? '#22c55e' : trend?.dir === 'down' ? '#ef4444' : '#6b7280'

  return (
    <div className="p-3 rounded-xl border border-border/30 bg-card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-muted-foreground truncate">{label}</span>
        {trend && (
          <span className="flex items-center gap-0.5 text-[11px]" style={{ color: trendColor }}>
            <TrendIcon className="w-3 h-3" />
            {Math.abs(trend.pct).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-lg font-bold" style={{ color }}>
          {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : value}
          {unit && <span className="text-xs font-normal text-muted-foreground ml-0.5">{unit}</span>}
        </span>
        {trendData && trendData.length >= 2 && (
          <SparkLine data={trendData} color={color} width={80} height={24} />
        )}
      </div>
    </div>
  )
}

// ─── CountdownCard ───

interface CountdownCardProps {
  label: string
  targetDate: string
  color?: string
}

export function CountdownCard({ label, targetDate }: CountdownCardProps) {
  const diff = useMemo(() => {
    const target = new Date(targetDate)
    const now = new Date()
    const ms = target.getTime() - now.getTime()
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24))
    return days
  }, [targetDate])

  const urgencyColor = diff <= 3 ? '#ef4444' : diff <= 7 ? '#f59e0b' : '#22c55e'
  const UrgencyIcon = diff <= 3 ? AlertCircle : diff <= 7 ? Timer : Clock

  return (
    <div className="p-3 rounded-xl border border-border/30 bg-card">
      <div className="flex items-center gap-2 mb-1">
        <UrgencyIcon className="w-3.5 h-3.5" style={{ color: urgencyColor }} />
        <span className="text-[11px] text-muted-foreground truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold" style={{ color: urgencyColor }}>
          {diff > 0 ? diff : '已过期'}
        </span>
        {diff > 0 && <span className="text-xs text-muted-foreground">天</span>}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">
        {new Date(targetDate).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
      </p>
    </div>
  )
}

// ─── ActionList: 待办事项 ───

interface ActionListProps {
  actions: Array<Record<string, unknown>>
  color?: string
}

export function ActionList({ actions, color = '#6366f1' }: ActionListProps) {
  if (!actions.length) return null

  const pending = actions.filter((a) => a.status === 'pending')
  const completed = actions.filter((a) => a.status !== 'pending')

  return (
    <div className="space-y-1.5">
      {pending.map((a, i) => (
        <div key={`p-${i}`} className="flex items-start gap-2 p-2 rounded-lg border border-border/20 bg-card">
          <div className="w-4 h-4 mt-0.5 rounded-full border-2 shrink-0" style={{ borderColor: color }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-relaxed">{String(a.description || a.action || a.title || '待办')}</p>
            {!!a.created_at && (
              <p className="text-[11px] text-muted-foreground">{String(a.created_at).slice(0, 10)}</p>
            )}
          </div>
        </div>
      ))}
      {completed.length > 0 && (
        <details className="text-muted-foreground">
          <summary className="text-[11px] cursor-pointer hover:text-foreground">
            {completed.length} 项已完成
          </summary>
          <div className="mt-1 space-y-1">
            {completed.map((a, i) => (
              <div key={`c-${i}`} className="flex items-center gap-2 p-1.5 rounded-lg opacity-60">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                <span className="text-[11px] line-through truncate">
                  {String(a.description || a.action || a.title || '已完成')}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// ─── TrendChart: 多指标趋势图（大版，用于 snapshots） ───

interface TrendChartProps {
  snapshots: Snapshot[]
  metricKey: string
  label: string
  color?: string
  height?: number
}

export function TrendChart({ snapshots, metricKey, label, color = '#6366f1', height = 80 }: TrendChartProps) {
  const data = useMemo(
    () => snapshots.map((s) => s.m?.[metricKey]).filter((v): v is number => v !== undefined),
    [snapshots, metricKey],
  )

  const labels = useMemo(
    () =>
      snapshots
        .filter((s) => s.m?.[metricKey] !== undefined)
        .map((s) => new Date(s.ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })),
    [snapshots, metricKey],
  )

  if (data.length < 2) return null

  const width = 280
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padY = 8
  const padX = 4
  const usableW = width - padX * 2
  const usableH = height - padY * 2

  const points = data.map((v, i) => ({
    x: padX + (i / (data.length - 1)) * usableW,
    y: padY + usableH - ((v - min) / range) * usableH,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = linePath + ` L${padX + usableW},${height} L${padX},${height} Z`

  const last = data[data.length - 1]
  const prev = data[data.length - 2]
  const change = prev !== 0 ? ((last - prev) / Math.abs(prev)) * 100 : 0

  return (
    <div className="p-3 rounded-xl border border-border/30 bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" style={{ color }} />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold" style={{ color }}>
            {Number.isInteger(last) ? last : last.toFixed(2)}
          </span>
          {Math.abs(change) > 0.5 && (
            <span className={`text-[11px] ${change > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {change > 0 ? '+' : ''}{change.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {/* Y 轴刻度线 */}
        {[0, 0.5, 1].map((pct) => (
          <line
            key={pct}
            x1={padX} y1={padY + usableH * (1 - pct)}
            x2={padX + usableW} y2={padY + usableH * (1 - pct)}
            stroke="currentColor" strokeWidth={0.5} className="text-border/20"
          />
        ))}
        <path d={areaPath} fill={`${color}10`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {/* 末尾圆点 */}
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={3} fill={color} />
      </svg>
      {/* X 轴标签 */}
      {labels.length >= 2 && (
        <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  )
}
