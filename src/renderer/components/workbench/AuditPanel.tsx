/**
 * 审批审计面板 — Approval Audit Log
 *
 * 统计概览 + 历史记录表格 + 过滤 + CSV 导出
 * 嵌入 ApprovalPanel 中作为"审计日志"视图。
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '@/stores/app-store'
import type { ApprovalItem, RiskLevel } from '@/lib/approval-service'
import { RISK_META } from '@/lib/approval-service'
import type { AuditStats, AuditFilters } from '@/lib/audit-service'
import { loadAuditData, exportAuditCSV } from '@/lib/audit-service'

const STATUS_META: Record<string, { label: string; dot: string }> = {
  pending: { label: '待审批', dot: 'bg-yellow-500' },
  approved: { label: '已批准', dot: 'bg-emerald-500' },
  rejected: { label: '已拒绝', dot: 'bg-red-500' },
  expired: { label: '已过期', dot: 'bg-gray-400' },
  auto_approved: { label: '自动放行', dot: 'bg-blue-400' },
}

const STATUS_OPTIONS = ['', 'pending', 'approved', 'rejected', 'expired', 'auto_approved']
const RISK_OPTIONS = ['', 'low', 'medium', 'high', 'critical']

export default function AuditPanel() {
  const { currentSolution } = useAppStore()
  const solution = currentSolution()

  const [stats, setStats] = useState<AuditStats | null>(null)
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState<AuditFilters>({ limit: 50, offset: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!solution) return
    setLoading(true)
    try {
      const data = await loadAuditData(solution, filters)
      setStats(data.stats)
      setItems(data.items)
      setTotal(data.total)
    } catch {
      setStats(null)
      setItems([])
    }
    setLoading(false)
  }, [solution?.id, filters])

  useEffect(() => { refresh() }, [refresh])

  const handleExport = useCallback(async () => {
    if (!solution) return
    setExporting(true)
    try {
      const csv = await exportAuditCSV(solution, filters)
      if (csv) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch { /* silent */ }
    setExporting(false)
  }, [solution, filters])

  const statusSelectOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((v) => ({
        value: v,
        label: v ? (STATUS_META[v]?.label || v) : '全部',
      })),
    [],
  )

  const riskSelectOptions = useMemo(
    () =>
      RISK_OPTIONS.map((v) => ({
        value: v,
        label: v ? `${RISK_META[v as RiskLevel]?.label || v}风险` : '全部',
      })),
    [],
  )

  const onStatusFilterChange = useCallback((v: string) => {
    setFilters((f) => ({ ...f, status: v || undefined, offset: 0 }))
  }, [])

  const onRiskFilterChange = useCallback((v: string) => {
    setFilters((f) => ({ ...f, riskLevel: v || undefined, offset: 0 }))
  }, [])

  const closeDetail = useCallback(() => setSelectedId(null), [])

  const pagePrev = useCallback(() => {
    setFilters((f) => ({
      ...f,
      offset: Math.max(0, (f.offset || 0) - (f.limit || 50)),
    }))
  }, [])

  const pageNext = useCallback(() => {
    setFilters((f) => ({
      ...f,
      offset: (f.offset || 0) + (f.limit || 50),
    }))
  }, [])

  const selected = useMemo(
    () => (selectedId ? items.find((i) => i.id === selectedId) : null),
    [selectedId, items],
  )

  if (!solution) return null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 统计概览 */}
      {stats && stats.total > 0 && (
        <div className="px-5 py-4 border-b border-border/30 shrink-0">
          <div className="grid grid-cols-5 gap-3">
            <MiniStat label="总记录" value={stats.total} />
            <MiniStat
              label="已批准"
              value={stats.by_status['approved'] || 0}
              dot="bg-emerald-500"
            />
            <MiniStat
              label="已拒绝"
              value={stats.by_status['rejected'] || 0}
              dot="bg-red-500"
            />
            <MiniStat
              label="通过率"
              value={`${stats.approval_rate}%`}
              dot="bg-blue-500"
            />
            <MiniStat
              label="自动放行"
              value={stats.by_status['auto_approved'] || 0}
              dot="bg-blue-400"
            />
          </div>

          {/* 风险分布条 */}
          {Object.keys(stats.by_risk_level).length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[10px] text-muted-foreground/60 shrink-0">风险分布</span>
              <div className="flex-1 flex rounded-full overflow-hidden h-2">
                {(['critical', 'high', 'medium', 'low'] as const).map(level => {
                  const count = stats.by_risk_level[level] || 0
                  if (count === 0) return null
                  const pct = (count / stats.total) * 100
                  const colors = {
                    critical: 'bg-red-500',
                    high: 'bg-orange-500',
                    medium: 'bg-yellow-500',
                    low: 'bg-green-500',
                  }
                  return (
                    <div
                      key={level}
                      className={`${colors[level]} transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${({ critical: '严重', high: '高', medium: '中', low: '低' } as Record<string, string>)[level] || level}：${count}`}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 过滤栏 */}
      <div className="px-5 py-2.5 border-b border-border/20 flex items-center gap-3 shrink-0">
        <FilterSelect
          label="状态"
          value={filters.status || ''}
          options={statusSelectOptions}
          onChange={onStatusFilterChange}
        />
        <FilterSelect
          label="风险"
          value={filters.riskLevel || ''}
          options={riskSelectOptions}
          onChange={onRiskFilterChange}
        />

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50">
            {total} 条记录
          </span>
          <button
            onClick={handleExport}
            disabled={exporting || items.length === 0}
            className="text-[10px] px-2 py-1 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors disabled:opacity-40"
          >
            {exporting ? '导出中...' : '📥 导出 CSV'}
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="text-[10px] px-2 py-1 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors disabled:opacity-40"
          >
            {loading ? '...' : '刷新'}
          </button>
        </div>
      </div>

      {/* 内容区：左表格 + 右详情 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 审计记录列表 */}
        <div className={`${selected ? 'w-1/2' : 'flex-1'} overflow-y-auto border-r border-border/30`}>
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin border-primary/40" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
              <span className="text-3xl mb-2">📋</span>
              <p>暂无审计记录</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border/30">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground/70">状态</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground/70">风险</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground/70">操作</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground/70">智能体</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground/70">审批人</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground/70">时间</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const sm = STATUS_META[item.status] || { label: item.status, dot: 'bg-gray-400' }
                  const rm = RISK_META[item.risk_level] || RISK_META.medium
                  const isSelected = item.id === selectedId
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedId(isSelected ? null : item.id)}
                      className={`border-b border-border/10 cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/5' : 'hover:bg-secondary/20'
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${sm.dot}`} />
                          <span>{sm.label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${rm.color} ${rm.bg}`}>
                          {rm.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 max-w-[160px] truncate" title={item.action}>
                        {item.action}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {item.agent_name}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {item.decided_by || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground/70">
                        {formatTime(item.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* 分页 */}
          {total > (filters.limit || 50) && (
            <div className="flex items-center justify-center gap-3 py-3 border-t border-border/20">
              <button
                type="button"
                onClick={pagePrev}
                disabled={(filters.offset || 0) === 0}
                className="text-[10px] px-2 py-1 rounded border border-border/40 disabled:opacity-30"
              >
                ← 上一页
              </button>
              <span className="text-[10px] text-muted-foreground">
                {(filters.offset || 0) + 1}–{Math.min((filters.offset || 0) + (filters.limit || 50), total)} / {total}
              </span>
              <button
                type="button"
                onClick={pageNext}
                disabled={(filters.offset || 0) + (filters.limit || 50) >= total}
                className="text-[10px] px-2 py-1 rounded border border-border/40 disabled:opacity-30"
              >
                下一页 →
              </button>
            </div>
          )}
        </div>

        {/* 详情侧栏 */}
        {selected && (
          <div className="w-1/2 overflow-y-auto p-5">
            <AuditDetail item={selected} onClose={closeDetail} />
          </div>
        )}
      </div>
    </div>
  )
}


/* ── 子组件 ── */

function MiniStat({ label, value, dot }: { label: string; value: number | string; dot?: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
        <span className="text-[10px] text-muted-foreground/60">{label}</span>
      </div>
      <span className="text-sm font-bold">{value}</span>
    </div>
  )
}

function FilterSelect({ label, value, options, onChange }: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground/60">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-[11px] px-2 py-1 rounded border border-border/40 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

function AuditDetail({ item, onClose }: { item: ApprovalItem; onClose: () => void }) {
  const sm = STATUS_META[item.status] || { label: item.status, dot: 'bg-gray-400' }
  const rm = RISK_META[item.risk_level] || RISK_META.medium

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2.5 h-2.5 rounded-full ${sm.dot}`} />
            <span className="text-xs font-medium">{sm.label}</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${rm.color} ${rm.bg}`}>
              {rm.label}风险
            </span>
          </div>
          <h3 className="text-sm font-semibold">{item.action}</h3>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
      </div>

      {item.reason && (
        <div className="mb-3">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">原因</label>
          <p className="text-xs mt-1 p-2.5 rounded-lg bg-secondary/30">{item.reason}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <DetailField label="智能体" value={item.agent_name} />
        {item.expert_id && <DetailField label="专家" value={item.expert_id} />}
        {item.solution_id && <DetailField label="方案" value={item.solution_id} />}
        {item.user_id && <DetailField label="发起人" value={item.user_id} />}
        <DetailField label="创建时间" value={new Date(item.created_at).toLocaleString()} />
        {item.decided_at && (
          <DetailField label="决策时间" value={new Date(item.decided_at).toLocaleString()} />
        )}
        {item.decided_by && <DetailField label="审批人" value={item.decided_by} />}
      </div>

      {item.decision_note && (
        <div className="mb-3">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">审批备注</label>
          <p className="text-xs mt-1 p-2.5 rounded-lg bg-secondary/30">{item.decision_note}</p>
        </div>
      )}

      {item.context && Object.keys(item.context).length > 0 && (
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">上下文</label>
          <div className="mt-1 p-2.5 rounded-lg bg-secondary/20 text-[11px] font-mono max-h-40 overflow-y-auto">
            {Object.entries(item.context).map(([k, v]) => (
              <div key={k} className="flex gap-2 py-0.5">
                <span className="text-muted-foreground shrink-0">{k}:</span>
                <span className="break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-border/20">
        <span className="text-[10px] text-muted-foreground/40 font-mono">{item.id}</span>
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-lg bg-secondary/20">
      <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">{label}</div>
      <div className="text-[11px] font-medium mt-0.5 truncate">{value}</div>
    </div>
  )
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`
    if (diff < 604800_000) return `${Math.floor(diff / 86400_000)}天前`
    return d.toLocaleDateString()
  } catch {
    return iso
  }
}
