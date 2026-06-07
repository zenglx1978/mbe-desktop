/**
 * 品牌可视化图表 — QuickBooks Dashboard Charts 对标
 *
 * 使用 recharts（已安装 ^3.8.0）绘制：
 * 1. GMV/佣金月度趋势折线图
 * 2. 佣金账龄饼图
 * 3. 品牌盈亏排行横向柱状图
 */
import { useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useBrandStore, type SettlementStatus } from '@/stores/brand-store'

const COLORS = {
  gmv: '#3b82f6',
  revenue: '#22c55e',
  receivable: '#f59e0b',
  paid: '#22c55e',
  draft: '#a1a1aa',
  confirmed: '#3b82f6',
  invoiced: '#f59e0b',
}

const fmtK = (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${(v / 1000).toFixed(0)}k`)

/** 月度趋势折线图：全品牌或单品牌 */
export function MonthlyTrendChart({ brandId, height = 220 }: { brandId?: string | null; height?: number }) {
  const { settlements } = useBrandStore()

  const data = useMemo(() => {
    const filtered = brandId ? settlements.filter((s) => s.brandId === brandId) : settlements
    const monthMap = new Map<string, { month: string; gmv: number; revenue: number }>()
    for (const s of filtered) {
      const existing = monthMap.get(s.month) || { month: s.month, gmv: 0, revenue: 0 }
      existing.gmv += s.gmv
      existing.revenue += s.totalAmount
      monthMap.set(s.month, existing)
    }
    return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-12)
  }, [settlements, brandId])

  if (data.length < 2) return null

  return (
    <div className="rounded-xl border border-border/30 bg-card p-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">月度趋势</h4>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtK} width={45} />
          <Tooltip
            formatter={(value: any, name: any) => [`¥${Number(value).toLocaleString()}`, name === 'gmv' ? 'GMV' : '佣金收入']}
            labelFormatter={(label) => `${label}`}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
          />
          <Legend formatter={(v) => (v === 'gmv' ? 'GMV' : '佣金收入')} wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="gmv" stroke={COLORS.gmv} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="revenue" stroke={COLORS.revenue} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** 佣金账龄饼图 */
export function AgingPieChart({ height = 200 }: { height?: number }) {
  const { settlements } = useBrandStore()

  const data = useMemo(() => {
    const buckets: { name: string; value: number; color: string }[] = [
      { name: '草稿', value: 0, color: COLORS.draft },
      { name: '已确认', value: 0, color: COLORS.confirmed },
      { name: '已开票', value: 0, color: COLORS.invoiced },
      { name: '已收款', value: 0, color: COLORS.paid },
    ]
    const statusIdx: Record<SettlementStatus, number> = { draft: 0, confirmed: 1, invoiced: 2, paid: 3 }
    for (const s of settlements) {
      buckets[statusIdx[s.status]]!.value += s.totalAmount
    }
    return buckets.filter((b) => b.value > 0)
  }, [settlements])

  if (data.length === 0) return null

  return (
    <div className="rounded-xl border border-border/30 bg-card p-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">佣金账龄分布</h4>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={3}
            dataKey="value"
            label={(props: any) => `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={{ strokeWidth: 1 }}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: any) => `¥${Number(value).toLocaleString()}`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

/** 品牌盈亏排行横向柱状图 */
export function BrandRankingChart({ height = 250 }: { height?: number }) {
  const { brands, settlements } = useBrandStore()

  const data = useMemo(() => {
    return brands
      .map((b) => {
        const ss = settlements.filter((s) => s.brandId === b.id)
        const revenue = ss.reduce((sum, s) => sum + s.totalAmount, 0)
        const deductions = ss.reduce((sum, s) => (s.reconciliation?.deductions || 0) + sum, 0)
        return { name: b.name.length > 6 ? b.name.slice(0, 6) + '…' : b.name, profit: revenue - deductions, revenue }
      })
      .filter((d) => d.revenue > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10)
  }, [brands, settlements])

  if (data.length === 0) return null

  return (
    <div className="rounded-xl border border-border/30 bg-card p-4">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">品牌盈亏排行</h4>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmtK} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} />
          <Tooltip formatter={(value: any) => `¥${Number(value).toLocaleString()}`} />
          <Bar dataKey="profit" fill={COLORS.revenue} radius={[0, 4, 4, 0]} barSize={18}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.profit >= 0 ? COLORS.revenue : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** 仪表盘用：品牌概览组合图（趋势 + 饼图并排） */
export function DashboardBrandCharts({ brandId }: { brandId?: string | null }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <MonthlyTrendChart brandId={brandId} height={200} />
      <AgingPieChart height={200} />
    </div>
  )
}
