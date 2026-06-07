/**
 * ERP 同步 + 自动对账面板 — QuickBooks "Bank Feeds" 对标
 *
 * 1. ERP 数据源管理（聚水潭/旺店通/CSV/API）
 * 2. 自动对账规则引擎配置
 * 3. 一键对账执行 + 差异结果展示
 */
import { useState, useCallback, useRef } from 'react'
import {
  Link2, Play, CheckCircle2, AlertTriangle, XCircle, Upload,
  RefreshCcw, Trash2, Shield,
} from 'lucide-react'
import type { SolutionConfig } from '@/lib/solution-router'
import { useBrandStore } from '@/stores/brand-store'
import {
  loadConnections, saveConnections, loadReconRules, saveReconRules,
  parseCSVToOrders, aggregateByBrandMonth, runReconciliation,
  startERPWatch, stopERPWatch, selectWatchDirectory,
  ERP_PROVIDERS,
  type ERPConnection, type ERPProvider, type ReconRule, type ReconResult, type ERPOrderRow,
} from '@/lib/erp-sync-service'

interface Props {
  solution: SolutionConfig
}

type Tab = 'connections' | 'rules' | 'results'

const RECON_STATUS_META: Record<string, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
  matched: { label: '完全匹配', color: '#22c55e', Icon: CheckCircle2 },
  within_tolerance: { label: '容差内', color: '#3b82f6', Icon: CheckCircle2 },
  diff: { label: '差异', color: '#f59e0b', Icon: AlertTriangle },
  alert: { label: '预警', color: '#ef4444', Icon: XCircle },
}

export default function ERPSyncPanel({ solution }: Props) {
  const [tab, setTab] = useState<Tab>('connections')
  const [connections, setConnections] = useState<ERPConnection[]>(loadConnections)
  const [rules, setRules] = useState<ReconRule[]>(loadReconRules)
  const [results, setResults] = useState<ReconResult[]>([])
  const [importedOrders, setImportedOrders] = useState<ERPOrderRow[]>([])
  const [watching, setWatching] = useState(false)
  const [_watchPath, setWatchPath] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { brands, settlements } = useBrandStore()

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'connections', label: '数据源', count: connections.filter((c) => c.enabled).length },
    { key: 'rules', label: '对账规则', count: rules.filter((r) => r.enabled).length },
    { key: 'results', label: '对账结果', count: results.length },
  ]

  // ── CSV 导入 ──
  const handleCSVImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const orders = parseCSVToOrders(text)
      setImportedOrders(orders)
      // 自动创建一个 CSV 连接记录
      const conn: ERPConnection = {
        id: `csv-${Date.now()}`,
        provider: 'manual_csv',
        name: file.name,
        enabled: true,
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'success',
        syncInterval: 0,
        config: { filename: file.name, rowCount: String(orders.length) },
        createdAt: new Date().toISOString(),
      }
      const next = [...connections, conn]
      setConnections(next)
      saveConnections(next)
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [connections])

  // ── 目录监听（ERP Watch Mode） ──
  const handleStartWatch = useCallback(async () => {
    const dir = await selectWatchDirectory()
    if (!dir) return
    setWatchPath(dir)
    const ok = await startERPWatch(
      { dirPath: dir, fileTypes: ['csv', 'xlsx'], pollInterval: 30000 },
      (orders, filename) => {
        setImportedOrders((prev) => [...prev, ...orders])
        const conn: ERPConnection = {
          id: `watch-${Date.now()}`,
          provider: 'watch_dir',
          name: `自动导入: ${filename}`,
          enabled: true,
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: 'success',
          syncInterval: 0,
          config: { dirPath: dir, filename, rowCount: String(orders.length) },
          createdAt: new Date().toISOString(),
        }
        setConnections((prev) => {
          const next = [...prev, conn]
          saveConnections(next)
          return next
        })
      },
    )
    setWatching(ok)
    if (!ok) {
      // 降级：无 Electron IPC，仍记录目录配置
      setWatching(false)
    }
  }, [])

  const handleStopWatch = useCallback(() => {
    stopERPWatch()
    setWatching(false)
    setWatchPath(null)
  }, [])

  // ── 执行对账 ──
  const handleRunReconciliation = useCallback(() => {
    if (importedOrders.length === 0) return
    const aggregated = aggregateByBrandMonth(importedOrders)
    const settlementData = settlements.map((s) => {
      const brand = brands.find((b) => b.id === s.brandId)
      return {
        id: s.id,
        brandName: brand?.name || '',
        month: s.month,
        gmv: s.gmv,
        totalAmount: s.totalAmount,
      }
    })
    const reconResults = runReconciliation(settlementData, aggregated, rules)
    setResults(reconResults)
    setTab('results')
  }, [importedOrders, settlements, brands, rules])

  // ── 规则开关 ──
  const toggleRule = useCallback((id: string) => {
    setRules((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
      saveReconRules(next)
      return next
    })
  }, [])

  // ── 删除连接 ──
  const removeConnection = useCallback((id: string) => {
    setConnections((prev) => {
      const next = prev.filter((c) => c.id !== id)
      saveConnections(next)
      return next
    })
  }, [])

  const { setReconciliation } = useBrandStore()

  const applyToSettlement = useCallback((r: ReconResult) => {
    const settlement = settlements.find((s) => s.id === r.settlementId)
    setReconciliation(r.settlementId, {
      gmv: (settlement?.gmv || 0) + r.gmvDiff,
      commission: (settlement?.totalAmount || 0) + r.commissionDiff,
      deductions: r.deductions,
      finalPayable: (settlement?.totalAmount || 0) + r.commissionDiff - r.deductions,
      source: 'erp_auto_recon',
      reconciledAt: new Date().toISOString(),
    })
  }, [setReconciliation, settlements])

  const matchedCount = results.filter((r) => r.status === 'matched' || r.status === 'within_tolerance').length
  const alertCount = results.filter((r) => r.status === 'alert').length

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Link2 className="w-5 h-5" style={{ color: solution.color }} />
              ERP 同步 & 自动对账
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              连接 ERP → 自动汇总 → 规则引擎对账 → 差异预警
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleCSVImport}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border/40 hover:bg-primary/5 hover:border-primary/30 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> 导入 CSV
            </button>
            {watching ? (
              <button
                type="button"
                onClick={handleStopWatch}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-green-500/40 bg-green-500/10 text-green-600 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> 监听中 · 停止
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartWatch}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border/40 hover:bg-primary/5 hover:border-primary/30 transition-colors"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> 监听目录
              </button>
            )}
            <button
              type="button"
              onClick={handleRunReconciliation}
              disabled={importedOrders.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-40"
              style={{ backgroundColor: solution.color }}
            >
              <Play className="w-3.5 h-3.5" /> 执行对账
            </button>
          </div>
        </div>

        {/* 汇总卡片 */}
        {importedOrders.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            <SummaryCard label="导入订单" value={String(importedOrders.length)} color={solution.color} />
            <SummaryCard label="已匹配" value={String(matchedCount)} color="#22c55e" />
            <SummaryCard label="差异项" value={String(results.length - matchedCount - alertCount)} color="#f59e0b" />
            <SummaryCard label="预警" value={String(alertCount)} color="#ef4444" />
          </div>
        )}

        {/* Tab 切换 */}
        <div className="flex gap-1 border-b border-border/30 pb-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                tab === t.key
                  ? 'bg-primary/10 text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              {t.label} {t.count != null && <span className="ml-1 opacity-60">({t.count})</span>}
            </button>
          ))}
        </div>

        {/* 数据源 Tab */}
        {tab === 'connections' && (
          <div className="space-y-3">
            {connections.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Link2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">尚未配置 ERP 数据源</p>
                <p className="text-xs mt-1">点击「导入 CSV」上传订单数据，或连接 ERP 系统</p>
              </div>
            ) : (
              connections.map((conn) => {
                const provider = ERP_PROVIDERS[conn.provider]
                return (
                  <div key={conn.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/30 bg-card">
                    <span className="text-2xl">{provider.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold truncate">{conn.name}</h4>
                        {conn.lastSyncStatus === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{provider.description}</p>
                      {conn.lastSyncAt && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          上次同步: {new Date(conn.lastSyncAt).toLocaleString('zh-CN')}
                          {conn.config.rowCount && ` · ${conn.config.rowCount} 条`}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeConnection(conn.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })
            )}

            {/* 可用 ERP 提供商 */}
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-6">可连接的 ERP 系统</h4>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(ERP_PROVIDERS) as [ERPProvider, typeof ERP_PROVIDERS[ERPProvider]][])
                .filter(([key]) => key !== 'manual_csv')
                .map(([key, provider]) => (
                <div key={key} className="p-3 rounded-xl border border-dashed border-border/40 bg-muted/10 opacity-60">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{provider.icon}</span>
                    <span className="text-sm font-medium">{provider.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{provider.description}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">需要 Electron 桌面端 + LocalAppBridge</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 规则 Tab */}
        {tab === 'rules' && (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className={`flex items-center gap-4 p-4 rounded-xl border bg-card transition-all ${
                rule.enabled ? 'border-primary/20' : 'border-border/30 opacity-60'
              }`}>
                <button
                  type="button"
                  onClick={() => toggleRule(rule.id)}
                  className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${
                    rule.enabled ? '' : 'bg-secondary/50'
                  }`}
                  style={rule.enabled ? { backgroundColor: solution.color } : undefined}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    rule.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`} />
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">{rule.name}</h4>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                      {rule.type === 'tolerance' ? '容差' : rule.type === 'alert' ? '预警' : '匹配'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 结果 Tab */}
        {tab === 'results' && (
          <div className="space-y-3">
            {results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCcw className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">尚无对账结果</p>
                <p className="text-xs mt-1">导入 CSV 后点击「执行对账」</p>
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((r) => {
                  const meta = RECON_STATUS_META[r.status]!
                  const StatusIcon = meta.Icon
                  return (
                    <div key={r.settlementId} className="p-4 rounded-xl border border-border/30 bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <StatusIcon className="w-4 h-4" style={{ color: meta.color }} />
                          <span className="text-sm font-semibold">{r.brandName}</span>
                          <span className="text-xs text-muted-foreground">{r.month}</span>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">GMV 差异</span>
                          <p className={`font-mono font-medium ${Math.abs(r.gmvDiff) > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                            {r.gmvDiff >= 0 ? '+' : ''}{r.gmvDiff.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">佣金差异</span>
                          <p className={`font-mono font-medium ${Math.abs(r.commissionDiff) > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                            {r.commissionDiff >= 0 ? '+' : ''}{r.commissionDiff.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">退款/扣减</span>
                          <p className="font-mono font-medium text-red-500">-{r.deductions.toLocaleString()}</p>
                        </div>
                      </div>
                      {r.triggeredRules.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-2">
                          触发规则: {r.triggeredRules.join(' · ')}
                        </p>
                      )}
                      {(r.status === 'diff' || r.status === 'alert') && (
                        <div className="mt-3 pt-2 border-t border-border/20 flex gap-2">
                          <button
                            type="button"
                            onClick={() => applyToSettlement(r)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-border/40 hover:bg-primary/5 hover:border-primary/30 transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" /> 更新结算单
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-3 rounded-xl border border-border/30 bg-card">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
    </div>
  )
}
