/**
 * 品牌报表中心 — QuickBooks "Reports Library" 对标
 *
 * 5 张预制报表，全部从本地 brand-store 实时计算，无需后端。
 * 1. 品牌利润月报 — 各品牌月度 P&L
 * 2. 佣金账龄 — 按状态分桶的应收分析
 * 3. 品牌盈亏排行 — 谁最赚钱、谁在亏钱
 * 4. 结算进度 — 各品牌结算完成率
 * 5. 对账差异汇总 — 需要核实的差异清单
 */
import { useState, useMemo } from 'react'
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle2, FileText } from 'lucide-react'
import { useBrandStore, type SettlementStatus } from '@/stores/brand-store'

type ReportId = 'monthly-pnl' | 'aging' | 'ranking' | 'progress' | 'recon-diff'

const REPORTS: { id: ReportId; name: string; icon: typeof BarChart3; desc: string }[] = [
  { id: 'monthly-pnl', name: '品牌利润月报', icon: BarChart3, desc: '各品牌月度 GMV / 佣金 / 扣款 / 净收入' },
  { id: 'aging', name: '佣金账龄分析', icon: TrendingUp, desc: '按结算状态分桶，识别逾期应收' },
  { id: 'ranking', name: '品牌盈亏排行', icon: TrendingUp, desc: '按净收入排序，快速发现亏损品牌' },
  { id: 'progress', name: '结算进度总览', icon: CheckCircle2, desc: '各品牌结算单完成率与待办' },
  { id: 'recon-diff', name: '对账差异汇总', icon: AlertTriangle, desc: '需要核实的对账差异清单' },
]

interface Props {
  color: string
}

export default function BrandReportsPanel({ color }: Props) {
  const { brands, settlements } = useBrandStore()
  const [activeReport, setActiveReport] = useState<ReportId | null>(null)

  const fmt = (n: number) => `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  if (!activeReport) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h2 className="text-base font-bold">报表中心</h2>
            <p className="text-sm text-muted-foreground mt-1">5 张预制报表，全部从品牌台账实时计算</p>
          </div>
          <div className="space-y-2">
            {REPORTS.map((r) => {
              const Icon = r.icon
              return (
                <button key={r.id} type="button" onClick={() => setActiveReport(r.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-left group">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold group-hover:text-primary">{r.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                  </div>
                  <FileText className="w-4 h-4 text-muted-foreground/30" />
                </button>
              )
            })}
          </div>
          {brands.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">请先在「品牌台账」中添加品牌和结算数据</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="max-w-4xl mx-auto space-y-4">
        <button type="button" onClick={() => setActiveReport(null)} className="text-sm text-muted-foreground hover:text-foreground">
          ← 报表列表
        </button>
        <h2 className="text-base font-bold">{REPORTS.find((r) => r.id === activeReport)?.name}</h2>

        {activeReport === 'monthly-pnl' && <MonthlyPnLReport brands={brands} settlements={settlements} fmt={fmt} color={color} />}
        {activeReport === 'aging' && <AgingReport settlements={settlements} fmt={fmt} color={color} />}
        {activeReport === 'ranking' && <RankingReport brands={brands} settlements={settlements} fmt={fmt} color={color} />}
        {activeReport === 'progress' && <ProgressReport brands={brands} settlements={settlements} color={color} />}
        {activeReport === 'recon-diff' && <ReconDiffReport brands={brands} settlements={settlements} fmt={fmt} />}
      </div>
    </div>
  )
}

function MonthlyPnLReport({ brands, settlements, fmt, color }: any) {
  const months = useMemo(() => {
    const set = new Set(settlements.map((s: any) => s.month))
    return Array.from(set).sort().reverse().slice(0, 12) as string[]
  }, [settlements])

  if (months.length === 0) return <EmptyState />

  return (
    <div className="rounded-xl border border-border/40 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-secondary/30">
            <th className="text-left px-3 py-2 font-semibold">品牌</th>
            {months.map((m) => <th key={m} className="text-right px-3 py-2 font-semibold">{m}</th>)}
            <th className="text-right px-3 py-2 font-semibold">合计</th>
          </tr>
        </thead>
        <tbody>
          {brands.map((b: any) => {
            const totals = months.map((m) => {
              const ss = settlements.filter((s: any) => s.brandId === b.id && s.month === m)
              return ss.reduce((sum: number, s: any) => sum + s.totalAmount, 0)
            })
            const total = totals.reduce((a: number, b: number) => a + b, 0)
            return (
              <tr key={b.id} className="border-t border-border/20 hover:bg-secondary/10">
                <td className="px-3 py-2 font-medium">{b.name}</td>
                {totals.map((v, i) => (
                  <td key={months[i]} className="px-3 py-2 text-right font-mono">{v > 0 ? fmt(v) : '-'}</td>
                ))}
                <td className="px-3 py-2 text-right font-mono font-bold" style={{ color }}>{fmt(total)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AgingReport({ settlements, fmt }: any) {
  const buckets: Record<SettlementStatus, { label: string; cls: string }> = {
    draft: { label: '草稿（未确认）', cls: 'text-zinc-400' },
    confirmed: { label: '已确认（待开票）', cls: 'text-blue-500' },
    invoiced: { label: '已开票（待收款）', cls: 'text-amber-500' },
    paid: { label: '已收款', cls: 'text-green-500' },
  }

  const data = useMemo(() => {
    const result: { status: SettlementStatus; count: number; amount: number }[] = []
    for (const status of ['draft', 'confirmed', 'invoiced', 'paid'] as SettlementStatus[]) {
      const ss = settlements.filter((s: any) => s.status === status)
      result.push({ status, count: ss.length, amount: ss.reduce((sum: number, s: any) => sum + s.totalAmount, 0) })
    }
    return result
  }, [settlements])

  const total = data.reduce((sum, d) => sum + d.amount, 0)

  if (settlements.length === 0) return <EmptyState />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {data.map((d) => {
          const meta = buckets[d.status]
          const pct = total > 0 ? ((d.amount / total) * 100).toFixed(0) : '0'
          return (
            <div key={d.status} className="p-3 rounded-xl border border-border/30 bg-card">
              <p className={`text-[11px] font-medium ${meta.cls}`}>{meta.label}</p>
              <p className="text-lg font-bold mt-1">{fmt(d.amount)}</p>
              <p className="text-[11px] text-muted-foreground">{d.count} 笔 · {pct}%</p>
            </div>
          )
        })}
      </div>
      {/* 可视化比例条 */}
      {total > 0 && (
        <div className="flex h-3 rounded-full overflow-hidden">
          {data.map((d) => {
            const pct = (d.amount / total) * 100
            if (pct === 0) return null
            const colors = { draft: '#a1a1aa', confirmed: '#3b82f6', invoiced: '#f59e0b', paid: '#22c55e' }
            return <div key={d.status} style={{ width: `${pct}%`, backgroundColor: colors[d.status] }} />
          })}
        </div>
      )}
    </div>
  )
}

function RankingReport({ brands, settlements, fmt, color }: any) {
  const ranking = useMemo(() => {
    return brands.map((b: any) => {
      const ss = settlements.filter((s: any) => s.brandId === b.id)
      const revenue = ss.reduce((sum: number, s: any) => sum + s.totalAmount, 0)
      const gmv = ss.reduce((sum: number, s: any) => sum + s.gmv, 0)
      const deductions = ss.reduce((sum: number, s: any) => (s.reconciliation?.deductions || 0) + sum, 0)
      return { name: b.name, gmv, revenue, deductions, profit: revenue - deductions, months: ss.length }
    }).sort((a: any, b: any) => b.profit - a.profit)
  }, [brands, settlements])

  if (ranking.length === 0) return <EmptyState />

  const maxProfit = Math.max(...ranking.map((r: any) => Math.abs(r.profit)), 1)

  return (
    <div className="space-y-2">
      {ranking.map((r: any, i: number) => (
        <div key={r.name} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card">
          <span className="w-6 text-center text-sm font-bold" style={{ color: i < 3 ? color : undefined }}>
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{r.name}</p>
            <p className="text-[11px] text-muted-foreground">{r.months} 月 · GMV {fmt(r.gmv)}</p>
          </div>
          <div className="w-32">
            <div className="h-2 bg-secondary/30 rounded-full overflow-hidden">
              <div className="h-full rounded-full"
                style={{
                  width: `${(Math.abs(r.profit) / maxProfit) * 100}%`,
                  backgroundColor: r.profit >= 0 ? '#22c55e' : '#ef4444',
                }} />
            </div>
          </div>
          <span className={`text-sm font-bold w-24 text-right ${r.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {fmt(r.profit)}
          </span>
        </div>
      ))}
    </div>
  )
}

function ProgressReport({ brands, settlements, color }: any) {
  const data = useMemo(() => {
    return brands.map((b: any) => {
      const ss = settlements.filter((s: any) => s.brandId === b.id)
      const paid = ss.filter((s: any) => s.status === 'paid').length
      const total = ss.length
      return { name: b.name, total, paid, pending: total - paid, rate: total > 0 ? ((paid / total) * 100).toFixed(0) : '0' }
    })
  }, [brands, settlements])

  if (data.length === 0) return <EmptyState />

  return (
    <div className="space-y-2">
      {data.map((d: any) => (
        <div key={d.name} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{d.name}</p>
            <p className="text-[11px] text-muted-foreground">{d.paid}/{d.total} 笔已收款</p>
          </div>
          <div className="w-40">
            <div className="h-2 bg-secondary/30 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${d.rate}%`, backgroundColor: color }} />
            </div>
          </div>
          <span className="text-sm font-bold w-12 text-right" style={{ color }}>{d.rate}%</span>
        </div>
      ))}
    </div>
  )
}

function ReconDiffReport({ brands, settlements, fmt }: any) {
  const diffs = useMemo(() => {
    return settlements
      .filter((s: any) => s.reconciliation)
      .map((s: any) => {
        const brand = brands.find((b: any) => b.id === s.brandId)
        const internal = s.totalAmount
        const external = s.reconciliation.finalPayable
        const diff = internal - external
        return { month: s.month, brand: brand?.name || '未知', internal, external, diff, deductions: s.reconciliation.deductions }
      })
      .filter((d: any) => Math.abs(d.diff) > 0.01)
      .sort((a: any, b: any) => Math.abs(b.diff) - Math.abs(a.diff))
  }, [brands, settlements])

  if (diffs.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="w-12 h-12 mx-auto text-green-500/30 mb-3" />
        <p className="text-sm text-muted-foreground">没有对账差异，一切匹配</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-secondary/30">
            <th className="text-left px-3 py-2">月份</th>
            <th className="text-left px-3 py-2">品牌</th>
            <th className="text-right px-3 py-2">我方核算</th>
            <th className="text-right px-3 py-2">品牌方</th>
            <th className="text-right px-3 py-2">差异</th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((d: any, i: number) => (
            <tr key={i} className="border-t border-border/20">
              <td className="px-3 py-2">{d.month}</td>
              <td className="px-3 py-2 font-medium">{d.brand}</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(d.internal)}</td>
              <td className="px-3 py-2 text-right font-mono">{fmt(d.external)}</td>
              <td className={`px-3 py-2 text-right font-mono font-bold ${d.diff > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {d.diff > 0 ? '+' : ''}{fmt(d.diff)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <FileText className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
      <p className="text-sm text-muted-foreground">暂无数据</p>
      <p className="text-xs text-muted-foreground/60 mt-1">请先在品牌台账中添加品牌和结算数据</p>
    </div>
  )
}
