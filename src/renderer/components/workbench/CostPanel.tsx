/**
 * 成本归因仪表盘 — Cost Attribution Dashboard
 *
 * 三维度（expert / solution / workflow）可视化 AI 调用成本分布。
 * 纯 SVG 图表，无外部依赖。
 */

import { useState, useEffect, useCallback } from 'react'
import type { SolutionConfig } from '@/lib/solution-router'
import type {
  AggregatedCostData,
  CostBreakdownItem,
  CostDimension,
  CostPeriod,
  CostTrendPoint,
} from '@/lib/cost-service'
import { loadCostData } from '@/lib/cost-service'

interface Props {
  solution: SolutionConfig
}

const DIMENSION_OPTIONS: { value: CostDimension; label: string }[] = [
  { value: 'expert_id', label: '按专家' },
  { value: 'solution_id', label: '按方案' },
  { value: 'workflow_step', label: '按工作流' },
  { value: 'action', label: '按操作' },
]

const PERIOD_OPTIONS: { value: CostPeriod; label: string }[] = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '近7天' },
  { value: 'month', label: '近30天' },
  { value: 'all', label: '全部' },
]

const PALETTE = [
  '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
]

export default function CostPanel({ solution }: Props) {
  const [data, setData] = useState<AggregatedCostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<CostPeriod>('month')
  const [dimension, setDimension] = useState<CostDimension>('expert_id')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await loadCostData(solution, period, dimension)
      setData(result)
    } catch {
      setData(null)
    }
    setLoading(false)
  }, [solution.id, period, dimension])

  useEffect(() => { refresh() }, [refresh])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div
          className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: `${solution.color}40`, borderTopColor: solution.color }}
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
        <span className="text-3xl">📊</span>
        <p>成本数据暂不可用</p>
        <p className="text-xs text-muted-foreground/50">确保 Agent 后端已配置 billing 路由</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 标题 + 控制栏 */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">成本归因</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI 调用成本 · 三维度分析
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SegmentControl
              options={PERIOD_OPTIONS}
              value={period}
              onChange={v => setPeriod(v as CostPeriod)}
            />
          </div>
        </div>

        {/* 汇总卡片 */}
        <div className="grid grid-cols-3 gap-4">
          <SummaryCard
            icon="💰"
            label="总成本"
            value={`¥${data.totalCostYuan.toFixed(2)}`}
            color={solution.color}
          />
          <SummaryCard
            icon="🔤"
            label="总 Token"
            value={formatNumber(data.totalTokens)}
          />
          <SummaryCard
            icon="📡"
            label="总调用"
            value={formatNumber(data.totalCalls)}
          />
        </div>

        {/* 维度切换 + 归因分布 */}
        <div className="rounded-xl border border-border/40 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              成本分布
            </h4>
            <SegmentControl
              options={DIMENSION_OPTIONS}
              value={dimension}
              onChange={v => setDimension(v as CostDimension)}
            />
          </div>

          {data.mergedBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              暂无数据
            </p>
          ) : (
            <div className="flex gap-6">
              {/* 饼图 */}
              <div className="w-48 h-48 shrink-0">
                <DonutChart items={data.mergedBreakdown} />
              </div>

              {/* 表格 */}
              <div className="flex-1 min-w-0">
                <BreakdownTable items={data.mergedBreakdown} color={solution.color} />
              </div>
            </div>
          )}
        </div>

        {/* 成本趋势 */}
        {data.trend.length > 0 && (
          <CostTrendChart trend={data.trend} color={solution.color} />
        )}

        {/* 分 Agent 明细 */}
        {data.byAgent.length > 1 && (
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              分 Agent 成本
            </h4>
            <div className="space-y-3">
              {data.byAgent.map((agent, i) => {
                const pct = data.totalCostYuan > 0
                  ? (agent.totalCostYuan / data.totalCostYuan) * 100
                  : 0
                return (
                  <div key={agent.agentId} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                    />
                    <span className="text-sm w-28 truncate">{agent.agentId}</span>
                    <div className="flex-1 h-2 rounded-full bg-secondary/30 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: PALETTE[i % PALETTE.length],
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      ¥{agent.totalCostYuan.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground/60 w-12 text-right">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


/* ── 子组件 ── */

function SummaryCard({ icon, label, value, color }: {
  icon: string; label: string; value: string; color?: string
}) {
  return (
    <div className="px-5 py-4 rounded-xl border border-border/40 bg-card">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center justify-between">
        <p className="text-2xl font-bold tracking-tight" style={color ? { color } : undefined}>
          {value}
        </p>
        <span className="text-2xl opacity-60">{icon}</span>
      </div>
    </div>
  )
}

function SegmentControl<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-lg border border-border/40 bg-secondary/20 p-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-xs rounded-md transition-all ${
            value === opt.value
              ? 'bg-card text-foreground shadow-sm font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function DonutChart({ items }: { items: CostBreakdownItem[] }) {
  const total = items.reduce((s, i) => s + i.cost_yuan, 0) || 1
  const R = 70
  const STROKE = 20
  const CX = 90
  const CY = 90

  let offset = 0
  const segments = items.slice(0, 8).map((item, i) => {
    const pct = item.cost_yuan / total
    const len = pct * 2 * Math.PI * R
    const gap = 2
    const seg = {
      offset,
      len: Math.max(len - gap, 0),
      circumference: 2 * Math.PI * R,
      color: PALETTE[i % PALETTE.length],
      label: item.dimension,
    }
    offset += len
    return seg
  })

  return (
    <svg viewBox="0 0 180 180" className="w-full h-full">
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={seg.color}
          strokeWidth={STROKE}
          strokeDasharray={`${seg.len} ${seg.circumference - seg.len}`}
          strokeDashoffset={-seg.offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${CX} ${CY})`}
          className="transition-all duration-300"
        >
          <title>{seg.label}</title>
        </circle>
      ))}
      <text x={CX} y={CY - 6} textAnchor="middle" fontSize={18} fontWeight="bold" fill="currentColor">
        ¥{total < 1000 ? total.toFixed(2) : `${(total / 1000).toFixed(1)}k`}
      </text>
      <text x={CX} y={CY + 12} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.4}>
        总成本
      </text>
    </svg>
  )
}

function BreakdownTable({ items, color }: { items: CostBreakdownItem[]; color: string }) {
  const max = Math.max(...items.map(i => i.cost_yuan), 0.01)

  return (
    <div className="space-y-2.5">
      {items.slice(0, 8).map((item, i) => (
        <div key={item.dimension} className="flex items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
          />
          <span className="text-sm w-32 truncate" title={item.dimension}>
            {item.dimension}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-secondary/30 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(item.cost_yuan / max) * 100}%`,
                backgroundColor: PALETTE[i % PALETTE.length],
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-16 text-right">
            ¥{item.cost_yuan.toFixed(2)}
          </span>
          <span className="text-xs text-muted-foreground/50 w-10 text-right">
            {item.percentage}%
          </span>
        </div>
      ))}
    </div>
  )
}

function CostTrendChart({ trend, color }: { trend: CostTrendPoint[]; color: string }) {
  const W = 320
  const H = 100
  const PAD = 20

  const costs = trend.map(t => t.cost_yuan)
  const max = Math.max(...costs, 0.01)

  const points = costs.map((v, i) => {
    const x = PAD + (i / Math.max(trend.length - 1, 1)) * (W - 2 * PAD)
    const y = H - PAD - (v / max) * (H - 2 * PAD)
    return { x, y, v }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${H - PAD} L ${points[0].x} ${H - PAD} Z`

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        成本趋势
      </h4>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = H - PAD - ratio * (H - 2 * PAD)
          return (
            <line
              key={ratio}
              x1={PAD} y1={y} x2={W - PAD} y2={y}
              stroke="currentColor" strokeOpacity={0.06}
            />
          )
        })}
        <path d={areaPath} fill={color} fillOpacity={0.08} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill={color} />
            <text x={p.x} y={H - 4} textAnchor="middle" fontSize={8} fill="currentColor" fillOpacity={0.3}>
              {trend[i].date.slice(5)}
            </text>
            {p.v > 0 && (
              <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={9} fill={color} fontWeight="bold">
                ¥{p.v < 1 ? p.v.toFixed(2) : p.v.toFixed(0)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}


function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}
