/**
 * 品牌台账面板 — QuickBooks "Chart of Accounts" 对标
 *
 * TP/代运营公司的核心资产视图：管了哪些品牌、每个赚多少、哪里在漏钱。
 * 支持品牌 CRUD、结算单生命周期（草稿→确认→开票→收款）、盈亏一览。
 */
import { useState, useCallback, useMemo } from 'react'
import {
  Plus, Building2, ChevronRight, Edit2, Trash2, X, Check,
  Receipt, ArrowUpRight, Clock, Scale, Download,
  FileText, CreditCard, CheckCircle2, CircleDot,
} from 'lucide-react'
import type { SolutionConfig } from '@/lib/solution-router'
import { useToolStore } from '@/stores/tool-store'
import {
  useBrandStore,
  type Brand, type Settlement, type SettlementStatus, type SLATier, type BrandStatus,
} from '@/stores/brand-store'
import { hasPermission, canAccessBrand, getCurrentRole } from '@/lib/rbac'
import RBACSettingsPanel from './RBACSettingsPanel'
import ReconciliationView from './ReconciliationView'
import { MonthlyTrendChart } from './BrandCharts'
import AuditLogPanel from './AuditLogPanel'
import SettlementPrintTemplate from './SettlementPrintTemplate'

const SLA_LABELS: Record<SLATier, string> = {
  standard: '标准（首响60s）',
  premium: '高级（首响30s）',
  vip: 'VIP（首响15s）',
}

const STATUS_LABELS: Record<BrandStatus, { label: string; cls: string }> = {
  active: { label: '运营中', cls: 'bg-green-500/10 text-green-500' },
  onboarding: { label: '入驻中', cls: 'bg-blue-500/10 text-blue-500' },
  paused: { label: '已暂停', cls: 'bg-amber-500/10 text-amber-500' },
  churned: { label: '已流失', cls: 'bg-red-500/10 text-red-500' },
}

const SETTLEMENT_STATUS: Record<SettlementStatus, { label: string; icon: typeof CircleDot; cls: string }> = {
  draft: { label: '草稿', icon: CircleDot, cls: 'text-zinc-400' },
  confirmed: { label: '已确认', icon: FileText, cls: 'text-blue-500' },
  invoiced: { label: '已开票', icon: CreditCard, cls: 'text-amber-500' },
  paid: { label: '已收款', icon: CheckCircle2, cls: 'text-green-500' },
}

const NEXT_STATUS: Partial<Record<SettlementStatus, SettlementStatus>> = {
  draft: 'confirmed',
  confirmed: 'invoiced',
  invoiced: 'paid',
}

interface Props {
  solution: SolutionConfig
}

type View = 'list' | 'detail' | 'add' | 'settlement' | 'reconcile'

export default function BrandsPanel({ solution }: Props) {
  const {
    brands, settlements, activeBrandId,
    addBrand, updateBrand, removeBrand, setActiveBrand,
    addSettlement, updateSettlementStatus, setReconciliation,
    getTotalReceivable, getTotalGMV,
  } = useBrandStore()

  const [view, setView] = useState<View>('list')
  const [editingBrand, setEditingBrand] = useState<Partial<Brand>>({})
  const [editingSettlement, setEditingSettlement] = useState<Partial<Settlement>>({})
  const [reconSettlement, setReconSettlement] = useState<Settlement | null>(null)
  const [printSettlement, setPrintSettlement] = useState<Settlement | null>(null)
  const [showRBAC, setShowRBAC] = useState(false)
  const currentRole = getCurrentRole()

  const canCreate = hasPermission('brand:create')

  const visibleBrands = useMemo(
    () => brands.filter((b) => canAccessBrand(b.id)),
    [brands],
  )

  const activeBrand = useMemo(
    () => visibleBrands.find((b) => b.id === activeBrandId) || null,
    [visibleBrands, activeBrandId],
  )

  const brandSettlements = useMemo(
    () => (activeBrandId
      ? settlements
          .filter((s) => s.brandId === activeBrandId)
          .sort((a, b) => b.month.localeCompare(a.month))
      : []),
    [settlements, activeBrandId],
  )

  const stats = useMemo(() => {
    const active = brands.filter((b) => b.status === 'active').length
    const totalGmv = getTotalGMV()
    const receivable = getTotalReceivable()
    const paid = settlements.filter((s) => s.status === 'paid').reduce((sum, s) => sum + s.totalAmount, 0)
    return { active, total: brands.length, totalGmv, receivable, paid }
  }, [brands, settlements, getTotalGMV, getTotalReceivable])

  const openDetail = useCallback((brandId: string) => {
    setActiveBrand(brandId)
    setView('detail')
  }, [setActiveBrand])

  const openAdd = useCallback(() => {
    setEditingBrand({
      name: '', category: '', platforms: [], contractRate: 3,
      performanceRate: 1, fixedMonthlyFee: 0, slaTier: 'standard', status: 'onboarding',
    })
    setView('add')
  }, [])

  const handleSaveBrand = useCallback(() => {
    const b = editingBrand
    if (!b.name) return
    if (activeBrandId && view === 'detail') {
      updateBrand(activeBrandId, b)
    } else {
      addBrand({
        name: b.name || '',
        category: b.category || '',
        platforms: b.platforms || [],
        contractRate: b.contractRate || 3,
        performanceRate: b.performanceRate || 1,
        fixedMonthlyFee: b.fixedMonthlyFee || 0,
        slaTier: (b.slaTier as SLATier) || 'standard',
        status: (b.status as BrandStatus) || 'onboarding',
        contactPerson: b.contactPerson,
        contractExpiry: b.contractExpiry,
        monthlyGmvTarget: b.monthlyGmvTarget,
      })
    }
    setView('list')
  }, [editingBrand, activeBrandId, view, addBrand, updateBrand])

  const openNewSettlement = useCallback(() => {
    if (!activeBrandId || !activeBrand) return
    const month = new Date().toISOString().slice(0, 7)
    setEditingSettlement({
      brandId: activeBrandId,
      month,
      gmv: 0,
      baseServiceFee: 0,
      performanceCommission: 0,
      totalAmount: 0,
      taxAmount: 0,
      status: 'draft',
    })
    setView('settlement')
  }, [activeBrandId, activeBrand])

  const handleSaveSettlement = useCallback(() => {
    const s = editingSettlement
    if (!s.brandId || !s.month) return
    const base = (s.gmv || 0) * ((activeBrand?.contractRate || 3) / 100)
    const perf = (s.gmv || 0) * ((activeBrand?.performanceRate || 1) / 100)
    const total = base + perf + (activeBrand?.fixedMonthlyFee || 0)
    const tax = total * 0.06
    addSettlement({
      brandId: s.brandId,
      month: s.month,
      gmv: s.gmv || 0,
      baseServiceFee: Math.round(base * 100) / 100,
      performanceCommission: Math.round(perf * 100) / 100,
      totalAmount: Math.round(total * 100) / 100,
      taxAmount: Math.round(tax * 100) / 100,
      status: 'draft',
      notes: s.notes,
    })
    setView('detail')
  }, [editingSettlement, activeBrand, addSettlement])

  const fmt = (n: number) => `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  // ─── 品牌列表视图 ───
  if (view === 'list') {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* 汇总卡片 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="管理品牌" value={`${stats.active}/${stats.total}`} icon={<Building2 className="w-4 h-4" />} color={solution.color} />
            <StatCard label="累计 GMV" value={fmt(stats.totalGmv)} icon={<ArrowUpRight className="w-4 h-4 text-green-500" />} color={solution.color} />
            <StatCard label="应收佣金" value={fmt(stats.receivable)} icon={<Clock className="w-4 h-4 text-amber-500" />} color={solution.color} />
            <StatCard label="已收佣金" value={fmt(stats.paid)} icon={<CheckCircle2 className="w-4 h-4 text-green-500" />} color={solution.color} />
          </div>

          {/* 应收账龄分析 */}
          {(() => {
            const unpaid = settlements.filter((s) => s.status !== 'paid')
            if (unpaid.length === 0) return null
            const now = new Date()
            const buckets = { current: 0, d30: 0, d60: 0, d90: 0 }
            for (const s of unpaid) {
              const monthDate = new Date(s.month + '-01')
              const days = Math.floor((now.getTime() - monthDate.getTime()) / 86400000)
              if (days <= 30) buckets.current += s.totalAmount
              else if (days <= 60) buckets.d30 += s.totalAmount
              else if (days <= 90) buckets.d60 += s.totalAmount
              else buckets.d90 += s.totalAmount
            }
            const total = buckets.current + buckets.d30 + buckets.d60 + buckets.d90
            if (total === 0) return null
            return (
              <div className="rounded-xl border border-border/40 bg-card p-4 space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> 应收账龄分析
                </h3>
                <div className="grid grid-cols-4 gap-3 text-center">
                  {([['≤30天', buckets.current, '#22c55e'], ['31-60天', buckets.d30, '#3b82f6'], ['61-90天', buckets.d60, '#f59e0b'], ['>90天', buckets.d90, '#ef4444']] as [string, number, string][]).map(([label, val, color]) => (
                    <div key={label}>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="text-sm font-bold" style={{ color: val > 0 ? color : undefined }}>{fmt(val)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-secondary/30">
                  {total > 0 && (
                    <>
                      <div style={{ width: `${(buckets.current / total) * 100}%`, backgroundColor: '#22c55e' }} />
                      <div style={{ width: `${(buckets.d30 / total) * 100}%`, backgroundColor: '#3b82f6' }} />
                      <div style={{ width: `${(buckets.d60 / total) * 100}%`, backgroundColor: '#f59e0b' }} />
                      <div style={{ width: `${(buckets.d90 / total) * 100}%`, backgroundColor: '#ef4444' }} />
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          {/* 品牌列表 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">品牌列表</h3>
              <button
                type="button"
                onClick={() => setShowRBAC(true)}
                className="text-[10px] px-2 py-0.5 rounded-full border border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60 transition-colors"
              >
                {currentRole.name}
              </button>
            </div>
            {canCreate && (
              <button
                type="button"
                onClick={openAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: solution.color }}
              >
                <Plus className="w-3.5 h-3.5" /> 添加品牌
              </button>
            )}
          </div>

          {visibleBrands.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">还没有品牌数据</p>
              <p className="text-xs text-muted-foreground/60">添加第一个品牌客户，开始跟踪佣金和结算</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={openAdd}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white hover:opacity-90"
                  style={{ backgroundColor: solution.color }}
                >
                  <Plus className="w-4 h-4" /> 手动添加
                </button>
              </div>
              <div className="pt-2 flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <button type="button" className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <Download className="w-3.5 h-3.5" /> 从 CSV 导入品牌
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { setActiveTab } = useToolStore.getState()
                    setActiveTab('erp-sync')
                  }}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" /> 从 ERP 同步
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleBrands.map((brand) => {
                const bs = settlements.filter((s) => s.brandId === brand.id)
                const lastMonth = bs.sort((a, b) => b.month.localeCompare(a.month))[0]
                const receivable = bs.filter((s) => s.status !== 'paid').reduce((sum, s) => sum + s.totalAmount, 0)
                const st = STATUS_LABELS[brand.status]
                return (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() => openDetail(brand.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                  >
                    <div className="relative w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0"
                      style={{ backgroundColor: `${solution.color}15`, color: solution.color }}>
                      {brand.name.charAt(0)}
                      {(() => {
                        const overdueCount = bs.filter((s) => s.status === 'draft' || s.status === 'confirmed').length
                        const healthColor = overdueCount >= 3 ? '#ef4444' : overdueCount >= 1 ? '#f59e0b' : '#22c55e'
                        return <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card" style={{ backgroundColor: healthColor }} title={overdueCount > 0 ? `${overdueCount} 笔待结算` : '健康'} />
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold group-hover:text-primary transition-colors truncate">
                          {brand.name}
                        </h4>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {brand.category} · {brand.platforms.join('/')} · 费率 {brand.contractRate}%+{brand.performanceRate}%
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {lastMonth && (
                        <p className="text-xs text-muted-foreground">{lastMonth.month} GMV {fmt(lastMonth.gmv)}</p>
                      )}
                      {receivable > 0 && (
                        <p className="text-xs text-amber-500 mt-0.5">应收 {fmt(receivable)}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── 品牌详情视图 ───
  if (view === 'detail' && activeBrand) {
    const st = STATUS_LABELS[activeBrand.status]
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setView('list')} className="text-sm text-muted-foreground hover:text-foreground">
              ← 品牌列表
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold"
              style={{ backgroundColor: `${solution.color}15`, color: solution.color }}>
              {activeBrand.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{activeBrand.name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {activeBrand.category} · {activeBrand.platforms.join('、')}
              </p>
            </div>
            <button type="button" onClick={() => {
              setEditingBrand({ ...activeBrand })
              setView('add')
            }} className="p-2 rounded-lg hover:bg-secondary/50">
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </button>
            <button type="button" onClick={() => {
              removeBrand(activeBrand.id)
              setView('list')
            }} className="p-2 rounded-lg hover:bg-red-500/10">
              <Trash2 className="w-4 h-4 text-red-500/50 hover:text-red-500" />
            </button>
          </div>

          {/* 合同条款 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-secondary/20">
              <p className="text-[10px] text-muted-foreground uppercase">基础服务费率</p>
              <p className="text-lg font-bold mt-1">{activeBrand.contractRate}%</p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/20">
              <p className="text-[10px] text-muted-foreground uppercase">绩效佣金费率</p>
              <p className="text-lg font-bold mt-1">{activeBrand.performanceRate}%</p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/20">
              <p className="text-[10px] text-muted-foreground uppercase">固定月费</p>
              <p className="text-lg font-bold mt-1">{fmt(activeBrand.fixedMonthlyFee)}</p>
            </div>
            <div className="p-3 rounded-xl bg-secondary/20">
              <p className="text-[10px] text-muted-foreground uppercase">SLA 等级</p>
              <p className="text-sm font-semibold mt-1">{SLA_LABELS[activeBrand.slaTier]}</p>
            </div>
          </div>

          {/* 品牌盈亏分析 — QuickBooks P&L Report 对标 */}
          {brandSettlements.length > 0 && (() => {
            const totalRevenue = brandSettlements.reduce((sum, s) => sum + s.totalAmount, 0)
            const totalDeductions = brandSettlements.reduce((sum, s) => (s.reconciliation?.deductions || 0) + sum, 0)
            const totalPaid = brandSettlements.filter((s) => s.status === 'paid').reduce((sum, s) => sum + s.totalAmount, 0)
            const receivable = totalRevenue - totalPaid
            const totalGmv = brandSettlements.reduce((sum, s) => sum + s.gmv, 0)
            const effectiveRate = totalGmv > 0 ? ((totalRevenue / totalGmv) * 100).toFixed(2) : '0'
            return (
              <div className="rounded-xl border border-border/40 bg-card p-4 space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">品牌盈亏分析（P&L）</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">累计 GMV</p>
                    <p className="text-base font-bold mt-0.5">{fmt(totalGmv)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">佣金收入</p>
                    <p className="text-base font-bold mt-0.5 text-green-500">{fmt(totalRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">扣款/调整</p>
                    <p className="text-base font-bold mt-0.5 text-red-500">{fmt(totalDeductions)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">应收余额</p>
                    <p className={`text-base font-bold mt-0.5 ${receivable > 0 ? 'text-amber-500' : 'text-green-500'}`}>{fmt(receivable)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">实际费率</p>
                    <p className="text-base font-bold mt-0.5" style={{ color: solution.color }}>{effectiveRate}%</p>
                  </div>
                </div>
                {/* 月度趋势迷你表 */}
                <div className="pt-2 border-t border-border/20 space-y-1">
                  {brandSettlements.slice(0, 6).map((s) => {
                    const pct = totalGmv > 0 ? (s.gmv / totalGmv) * 100 : 0
                    return (
                      <div key={s.id} className="flex items-center gap-2 text-xs">
                        <span className="w-16 text-muted-foreground shrink-0">{s.month}</span>
                        <div className="flex-1 h-2 bg-secondary/30 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: solution.color, opacity: 0.7 }} />
                        </div>
                        <span className="w-20 text-right shrink-0">{fmt(s.gmv)}</span>
                        <span className="w-16 text-right shrink-0 font-medium">{fmt(s.totalAmount)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* 月度趋势图 */}
          <MonthlyTrendChart brandId={activeBrandId} height={180} />

          {/* 结算记录 */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-4 h-4" /> 结算记录
            </h3>
            <div className="flex items-center gap-2">
              {brandSettlements.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const header = '月份,GMV,基础服务费,绩效佣金,固定月费,合计金额,税额,状态,对账差异\n'
                    const rows = brandSettlements.map((s) => {
                      const diff = s.reconciliation ? (s.totalAmount - s.reconciliation.finalPayable).toFixed(2) : ''
                      const statusMap: Record<string, string> = { draft: '草稿', confirmed: '已确认', invoiced: '已开票', paid: '已收款' }
                      return `${s.month},${s.gmv},${s.baseServiceFee},${s.performanceCommission},${activeBrand.fixedMonthlyFee},${s.totalAmount},${s.taxAmount},${statusMap[s.status] || s.status},${diff}`
                    }).join('\n')
                    const bom = '\uFEFF'
                    const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `结算明细_${activeBrand.name}_${new Date().toISOString().slice(0, 10)}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border/40 hover:bg-secondary/30 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> 导出 CSV
                </button>
              )}
              <button
                type="button"
                onClick={openNewSettlement}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90"
                style={{ backgroundColor: solution.color }}
              >
                <Plus className="w-3.5 h-3.5" /> 新建结算
              </button>
            </div>
          </div>

          {brandSettlements.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">暂无结算记录</p>
              <p className="text-xs text-muted-foreground/60 mt-1">创建第一笔结算单，开始追踪收入</p>
            </div>
          ) : (
            <div className="space-y-2">
              {brandSettlements.map((s) => {
                const ss = SETTLEMENT_STATUS[s.status]
                const SIcon = ss.icon
                const next = NEXT_STATUS[s.status]
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card">
                    <SIcon className={`w-5 h-5 shrink-0 ${ss.cls}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{s.month}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ss.cls} bg-secondary/30`}>{ss.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        GMV {fmt(s.gmv)} · 基础 {fmt(s.baseServiceFee)} + 绩效 {fmt(s.performanceCommission)} + 月费 {fmt(activeBrand.fixedMonthlyFee)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{fmt(s.totalAmount)}</p>
                      <p className="text-[10px] text-muted-foreground">税 {fmt(s.taxAmount)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReconSettlement(s)
                        setView('reconcile')
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border/40 hover:bg-primary/5 hover:border-primary/30 transition-colors shrink-0 flex items-center gap-1"
                    >
                      <Scale className="w-3 h-3" /> 对账
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrintSettlement(s)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border/40 hover:bg-primary/5 hover:border-primary/30 transition-colors shrink-0 flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" /> 结算单
                    </button>
                    {s.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => {
                          const text = `${activeBrand.name} ${s.month} 结算单\n合计: ¥${s.totalAmount.toLocaleString()}\n状态: ${SETTLEMENT_STATUS[s.status].label}`
                          navigator.clipboard?.writeText(text)
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border/40 hover:bg-primary/5 hover:border-primary/30 transition-colors shrink-0 flex items-center gap-1"
                        title="复制结算摘要到剪贴板，发送给品牌方"
                      >
                        <ArrowUpRight className="w-3 h-3" /> 发送
                      </button>
                    )}
                    {next && (
                      <button
                        type="button"
                        onClick={() => updateSettlementStatus(s.id, next)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border/40 hover:bg-primary/5 hover:border-primary/30 transition-colors shrink-0"
                      >
                        → {SETTLEMENT_STATUS[next].label}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* 审计日志 */}
          <AuditLogPanel entityType="brand" entityId={activeBrandId!} limit={20} />
        </div>
      </div>
    )
  }

  // ─── 添加/编辑品牌表单 ───
  if (view === 'add') {
    const isEdit = !!editingBrand.id
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-2xl mx-auto space-y-6">
          <button type="button" onClick={() => setView(isEdit ? 'detail' : 'list')} className="text-sm text-muted-foreground hover:text-foreground">
            ← {isEdit ? '返回详情' : '品牌列表'}
          </button>
          <h2 className="text-base font-bold">{isEdit ? '编辑品牌' : '添加品牌'}</h2>
          <div className="space-y-4">
            <FormField label="品牌名称" required>
              <input type="text" value={editingBrand.name || ''} onChange={(e) => setEditingBrand({ ...editingBrand, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50" placeholder="如：花西子" />
            </FormField>
            <FormField label="品类">
              <input type="text" value={editingBrand.category || ''} onChange={(e) => setEditingBrand({ ...editingBrand, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50" placeholder="如：美妆" />
            </FormField>
            <FormField label="销售平台（逗号分隔）">
              <input type="text" value={(editingBrand.platforms || []).join(',')} onChange={(e) => setEditingBrand({ ...editingBrand, platforms: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50" placeholder="天猫,抖音,京东" />
            </FormField>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="基础服务费率 (%)">
                <input type="number" step="0.1" value={editingBrand.contractRate || 3} onChange={(e) => setEditingBrand({ ...editingBrand, contractRate: +e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50" />
              </FormField>
              <FormField label="绩效佣金费率 (%)">
                <input type="number" step="0.1" value={editingBrand.performanceRate || 1} onChange={(e) => setEditingBrand({ ...editingBrand, performanceRate: +e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50" />
              </FormField>
              <FormField label="固定月费 (元)">
                <input type="number" value={editingBrand.fixedMonthlyFee || 0} onChange={(e) => setEditingBrand({ ...editingBrand, fixedMonthlyFee: +e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="SLA 等级">
                <select value={editingBrand.slaTier || 'standard'} onChange={(e) => setEditingBrand({ ...editingBrand, slaTier: e.target.value as SLATier })}
                  className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50">
                  {Object.entries(SLA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </FormField>
              <FormField label="品牌状态">
                <select value={editingBrand.status || 'onboarding'} onChange={(e) => setEditingBrand({ ...editingBrand, status: e.target.value as BrandStatus })}
                  className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50">
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="对接人">
              <input type="text" value={editingBrand.contactPerson || ''} onChange={(e) => setEditingBrand({ ...editingBrand, contactPerson: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50" placeholder="品牌方对接人" />
            </FormField>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setView(isEdit ? 'detail' : 'list')}
              className="px-4 py-2 rounded-xl text-sm border border-border/50 hover:bg-secondary/30 transition-colors flex items-center gap-1.5">
              <X className="w-4 h-4" /> 取消
            </button>
            <button type="button" onClick={handleSaveBrand} disabled={!editingBrand.name}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-colors flex items-center gap-1.5 disabled:opacity-40"
              style={{ backgroundColor: solution.color }}>
              <Check className="w-4 h-4" /> {isEdit ? '保存修改' : '创建品牌'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── 新建结算单视图 ───
  if (view === 'settlement' && activeBrand) {
    const gmv = editingSettlement.gmv || 0
    const base = gmv * (activeBrand.contractRate / 100)
    const perf = gmv * (activeBrand.performanceRate / 100)
    const total = base + perf + activeBrand.fixedMonthlyFee
    const tax = total * 0.06
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-2xl mx-auto space-y-6">
          <button type="button" onClick={() => setView('detail')} className="text-sm text-muted-foreground hover:text-foreground">
            ← {activeBrand.name}
          </button>
          <h2 className="text-base font-bold">新建月度结算单</h2>
          <div className="px-4 py-3 rounded-xl bg-primary/5 border border-primary/10 text-sm">
            <p className="font-semibold" style={{ color: solution.color }}>合同费率自动引用</p>
            <p className="text-xs text-muted-foreground mt-1">
              基础服务费 {activeBrand.contractRate}% + 绩效佣金 {activeBrand.performanceRate}% + 固定月费 {fmt(activeBrand.fixedMonthlyFee)}
            </p>
          </div>
          <div className="space-y-4">
            <FormField label="结算月份" required>
              <input type="month" value={editingSettlement.month || ''} onChange={(e) => setEditingSettlement({ ...editingSettlement, month: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50" />
            </FormField>
            <FormField label="月度 GMV（元）" required>
              <input type="number" value={editingSettlement.gmv || ''} onChange={(e) => setEditingSettlement({ ...editingSettlement, gmv: +e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50" placeholder="输入 GMV，自动计算佣金" />
            </FormField>
            <FormField label="备注">
              <textarea value={editingSettlement.notes || ''} onChange={(e) => setEditingSettlement({ ...editingSettlement, notes: e.target.value })}
                rows={3} className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50 resize-none" placeholder="可选备注" />
            </FormField>
          </div>

          {/* 实时计算预览 */}
          {gmv > 0 && (
            <div className="rounded-xl border border-border/40 bg-card p-4 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">结算预览</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">月度 GMV</span><span>{fmt(gmv)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">基础服务费 ({activeBrand.contractRate}%)</span><span>{fmt(Math.round(base))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">绩效佣金 ({activeBrand.performanceRate}%)</span><span>{fmt(Math.round(perf))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">固定月费</span><span>{fmt(activeBrand.fixedMonthlyFee)}</span></div>
                <div className="border-t border-border/30 pt-1 flex justify-between font-bold">
                  <span>应收合计</span><span style={{ color: solution.color }}>{fmt(Math.round(total))}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>服務稅 (6%)</span><span>{fmt(Math.round(tax))}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => setView('detail')}
              className="px-4 py-2 rounded-xl text-sm border border-border/50 hover:bg-secondary/30 transition-colors flex items-center gap-1.5">
              <X className="w-4 h-4" /> 取消
            </button>
            <button type="button" onClick={handleSaveSettlement} disabled={!gmv}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-colors flex items-center gap-1.5 disabled:opacity-40"
              style={{ backgroundColor: solution.color }}>
              <Receipt className="w-4 h-4" /> 创建结算单（草稿）
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── 对账视图 ───
  if (view === 'reconcile' && reconSettlement && activeBrand) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-3xl mx-auto space-y-6">
          <button type="button" onClick={() => setView('detail')} className="text-sm text-muted-foreground hover:text-foreground">
            ← {activeBrand.name} · 结算记录
          </button>
          <ReconciliationView
            settlement={reconSettlement}
            fixedMonthlyFee={activeBrand.fixedMonthlyFee}
            externalData={reconSettlement.reconciliation || null}
            onExternalDataChange={(data) => {
              setReconciliation(reconSettlement.id, data)
              setReconSettlement({ ...reconSettlement, reconciliation: data })
            }}
            color={solution.color}
          />
        </div>
      </div>
    )
  }

  return (
    <>
      {printSettlement && activeBrand && (
        <SettlementPrintTemplate
          brand={activeBrand}
          settlement={printSettlement}
          color={solution.color}
          onClose={() => setPrintSettlement(null)}
        />
      )}
      {showRBAC && <RBACSettingsPanel onClose={() => setShowRBAC(false)} />}
    </>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="p-3 rounded-xl border border-border/30 bg-card">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
      </div>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
