import { useState, useEffect, useCallback } from 'react'
import { DollarSign, TrendingUp, Activity, RefreshCw, BarChart3, Layers, Zap } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { SolutionConfig } from '@/lib/solution-router'
import {
  loadCostData,
  type AggregatedCostData,
  type CostDimension,
  type CostPeriod,
} from '@/lib/cost-service'

interface Props {
  solution: SolutionConfig
}

const PERIOD_OPTIONS: { value: CostPeriod; label: string }[] = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'all', label: '全部' },
]

const DIMENSION_OPTIONS: { value: CostDimension; label: string; icon: typeof Layers }[] = [
  { value: 'expert_id', label: '按专家', icon: Layers },
  { value: 'action', label: '按操作', icon: Zap },
  { value: 'workflow_step', label: '按工作流', icon: BarChart3 },
]

export default function CostPanel({ solution }: Props) {
  const [data, setData] = useState<AggregatedCostData | null>(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<CostPeriod>('month')
  const [dimension, setDimension] = useState<CostDimension>('expert_id')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await loadCostData(solution, period, dimension, 7)
      setData(result)
    } catch {
      setData(null)
    }
    setLoading(false)
  }, [solution, period, dimension])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatCost = (yuan: number) => {
    if (yuan >= 10000) return `¥${(yuan / 10000).toFixed(2)}万`
    if (yuan >= 100) return `¥${yuan.toFixed(0)}`
    return `¥${yuan.toFixed(2)}`
  }

  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
    return `${tokens}`
  }

  const isEmpty = !data || (data.totalCalls === 0 && data.mergedBreakdown.length === 0)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">费用追踪</h2>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-secondary/30 hover:bg-secondary/50 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {/* 筛选条件 */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-secondary/30 rounded-lg p-1">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                  period === opt.value ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 bg-secondary/30 rounded-lg p-1">
            {DIMENSION_OPTIONS.map(opt => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.value}
                  onClick={() => setDimension(opt.value)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
                    dimension === opt.value ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 总览卡片 */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<DollarSign className="w-4 h-4" />}
            label="总费用"
            value={data ? formatCost(data.totalCostYuan) : '—'}
            cls="text-amber-500"
          />
          <StatCard
            icon={<Activity className="w-4 h-4" />}
            label="调用次数"
            value={data ? `${data.totalCalls}` : '—'}
            cls="text-blue-500"
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Token 消耗"
            value={data ? formatTokens(data.totalTokens) : '—'}
            cls="text-purple-500"
          />
        </div>

        {/* 费用明细 — recharts 横向柱状图 */}
        {!isEmpty && data!.mergedBreakdown.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              费用明细（{DIMENSION_OPTIONS.find(d => d.value === dimension)?.label}）
            </h3>
            <div className="rounded-xl border border-border/40 bg-card/50 p-4">
              <ResponsiveContainer width="100%" height={Math.max(120, data!.mergedBreakdown.length * 44)}>
                <BarChart
                  data={data!.mergedBreakdown.map(item => ({
                    name: item.dimension || '未分类',
                    cost: item.cost_yuan,
                    calls: item.call_count,
                    tokens: item.total_tokens,
                    pct: item.percentage,
                  }))}
                  layout="vertical"
                  margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.[0]) return null
                      const d = payload[0].payload as { name: string; cost: number; calls: number; tokens: number; pct: number }
                      return (
                        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                          <p className="font-medium">{d.name}</p>
                          <p className="text-amber-500 font-bold">{formatCost(d.cost)}</p>
                          <p className="text-muted-foreground">{d.calls} 次 · {formatTokens(d.tokens)} tokens · {d.pct}%</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="cost" radius={[0, 4, 4, 0]} barSize={18}>
                    {data!.mergedBreakdown.map((_, i) => (
                      <Cell key={i} fill={`hsl(var(--primary) / ${0.35 + (0.45 * (1 - i / Math.max(data!.mergedBreakdown.length - 1, 1)))})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <EmptyCost loading={loading} />
        )}

        {/* 趋势图 — recharts 柱状图 */}
        {data && data.trend.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">近 7 日趋势</h3>
            <div className="rounded-xl border border-border/40 bg-card/50 p-4">
              <ResponsiveContainer width="100%" height={100}>
                <BarChart
                  data={data.trend.map(p => ({ date: p.date.slice(5), cost: p.cost_yuan }))}
                  margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
                >
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.[0]) return null
                      const d = payload[0].payload as { date: string; cost: number }
                      return (
                        <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg">
                          <span className="text-muted-foreground">{d.date}</span>{' '}
                          <span className="font-bold text-amber-500">{formatCost(d.cost)}</span>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="cost" fill="hsl(var(--primary) / 0.5)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, cls }: { icon: React.ReactNode; label: string; value: string; cls: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-3 flex items-center gap-3">
      <div className={cls}>{icon}</div>
      <div>
        <p className="text-lg font-bold">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function EmptyCost({ loading }: { loading: boolean }) {
  return (
    <div className="text-center py-16 space-y-4">
      <div className="text-5xl">💰</div>
      <div>
        <p className="text-lg font-semibold text-foreground">
          {loading ? '加载中...' : '暂无费用数据'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {loading
            ? '正在从各 Agent 后端获取成本归因数据'
            : '使用 AI 专家咨询和工作流后，费用数据会自动在此显示'}
        </p>
      </div>
    </div>
  )
}
