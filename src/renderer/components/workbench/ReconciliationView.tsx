/**
 * 结算对账视图 — QuickBooks "Reconciliation" 对标
 *
 * 左列：我方核算（从结算单自动取数）
 * 右列：品牌方数据（手动录入或 ERP 导入）
 * 中间：逐项匹配状态（匹配 / 差异 / 待核实）
 */
import { useState, useMemo } from 'react'
import { CheckCircle2, AlertTriangle, HelpCircle, ArrowRight } from 'lucide-react'
import type { Settlement, ReconciliationData } from '@/stores/brand-store'

interface ReconItem {
  label: string
  internal: number
  external: number
  diff: number
  status: 'matched' | 'diff' | 'pending'
}

interface Props {
  settlement: Settlement
  fixedMonthlyFee: number
  externalData?: ReconciliationData | null
  onExternalDataChange?: (data: ReconciliationData) => void
  color: string
}

export default function ReconciliationView({
  settlement,
  fixedMonthlyFee,
  externalData,
  onExternalDataChange,
  color,
}: Props) {
  const [editMode, setEditMode] = useState(!externalData)
  const [formData, setFormData] = useState<ReconciliationData>(
    externalData || {
      gmv: 0,
      commission: 0,
      deductions: 0,
      finalPayable: 0,
      source: '品牌方对账单',
      reconciledAt: '',
    },
  )

  const internalTotal = settlement.baseServiceFee + settlement.performanceCommission + fixedMonthlyFee

  const items: ReconItem[] = useMemo(() => {
    if (!externalData) return []
    const threshold = 0.01
    const row = (label: string, internal: number, external: number): ReconItem => {
      const diff = internal - external
      const status = Math.abs(diff) <= threshold ? 'matched' : Math.abs(diff) > 0 ? 'diff' : 'pending'
      return { label, internal, external, diff, status }
    }
    return [
      row('GMV', settlement.gmv, externalData.gmv),
      row('服务费/佣金', internalTotal, externalData.commission),
      row('扣款/调整', 0, externalData.deductions),
      row('应付金额', internalTotal, externalData.finalPayable),
    ]
  }, [settlement, externalData, internalTotal])

  const matchCount = items.filter((i) => i.status === 'matched').length
  const diffCount = items.filter((i) => i.status === 'diff').length

  const fmt = (n: number) => `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleSubmitExternal = () => {
    onExternalDataChange?.({ ...formData, reconciledAt: new Date().toISOString() })
    setEditMode(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {settlement.month} 结算对账
        </h3>
        {externalData && (
          <div className="flex items-center gap-3 text-xs">
            {matchCount > 0 && (
              <span className="flex items-center gap-1 text-green-500">
                <CheckCircle2 className="w-3.5 h-3.5" /> {matchCount} 项匹配
              </span>
            )}
            {diffCount > 0 && (
              <span className="flex items-center gap-1 text-amber-500">
                <AlertTriangle className="w-3.5 h-3.5" /> {diffCount} 项差异
              </span>
            )}
          </div>
        )}
      </div>

      {/* 对账表格 */}
      {externalData && items.length > 0 ? (
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_auto_1fr_auto] gap-0 text-xs">
            {/* 表头 */}
            <div className="bg-secondary/30 px-3 py-2 font-semibold">项目</div>
            <div className="bg-secondary/30 px-3 py-2 font-semibold text-right">我方核算</div>
            <div className="bg-secondary/30 px-3 py-2 text-center">
              <ArrowRight className="w-3 h-3 mx-auto text-muted-foreground" />
            </div>
            <div className="bg-secondary/30 px-3 py-2 font-semibold text-right">品牌方数据</div>
            <div className="bg-secondary/30 px-3 py-2 font-semibold text-center">状态</div>

            {/* 数据行 */}
            {items.map((item) => (
              <>
                <div key={`${item.label}-label`} className="px-3 py-2.5 border-t border-border/20">{item.label}</div>
                <div key={`${item.label}-internal`} className="px-3 py-2.5 border-t border-border/20 text-right font-mono">{fmt(item.internal)}</div>
                <div key={`${item.label}-arrow`} className="px-3 py-2.5 border-t border-border/20 text-center">
                  {item.status === 'diff' && (
                    <span className={`text-[11px] font-mono ${item.diff > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {item.diff > 0 ? '+' : ''}{fmt(item.diff)}
                    </span>
                  )}
                </div>
                <div key={`${item.label}-external`} className="px-3 py-2.5 border-t border-border/20 text-right font-mono">{fmt(item.external)}</div>
                <div key={`${item.label}-status`} className="px-3 py-2.5 border-t border-border/20 text-center">
                  {item.status === 'matched' && <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />}
                  {item.status === 'diff' && <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />}
                  {item.status === 'pending' && <HelpCircle className="w-4 h-4 text-zinc-400 mx-auto" />}
                </div>
              </>
            ))}
          </div>
        </div>
      ) : null}

      {/* 差异说明 */}
      {diffCount > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
          <p className="text-xs font-semibold text-amber-600">需要核实 {diffCount} 项差异：</p>
          {items.filter((i) => i.status === 'diff').map((i) => (
            <p key={i.label} className="text-xs text-muted-foreground">
              • {i.label}：我方 {fmt(i.internal)} vs 品牌方 {fmt(i.external)}，差异 {fmt(Math.abs(i.diff))}
            </p>
          ))}
        </div>
      )}

      {/* 录入品牌方数据 */}
      {(editMode || !externalData) && (
        <div className="rounded-xl border border-border/40 bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">录入品牌方对账数据</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground">品牌方 GMV</label>
              <input type="number" value={formData.gmv || ''} onChange={(e) => setFormData({ ...formData, gmv: +e.target.value })}
                className="w-full mt-1 px-3 py-1.5 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">品牌方佣金额</label>
              <input type="number" value={formData.commission || ''} onChange={(e) => setFormData({ ...formData, commission: +e.target.value })}
                className="w-full mt-1 px-3 py-1.5 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">扣款/调整</label>
              <input type="number" value={formData.deductions || ''} onChange={(e) => setFormData({ ...formData, deductions: +e.target.value })}
                className="w-full mt-1 px-3 py-1.5 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">品牌方应付金额</label>
              <input type="number" value={formData.finalPayable || ''} onChange={(e) => setFormData({ ...formData, finalPayable: +e.target.value })}
                className="w-full mt-1 px-3 py-1.5 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleSubmitExternal}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90"
              style={{ backgroundColor: color }}>
              开始对账
            </button>
            {externalData && (
              <button type="button" onClick={() => setEditMode(false)}
                className="px-3 py-1.5 rounded-lg text-xs border border-border/50 hover:bg-secondary/30">
                取消
              </button>
            )}
          </div>
        </div>
      )}

      {/* 已对账完成可编辑 */}
      {externalData && !editMode && (
        <button type="button" onClick={() => setEditMode(true)}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
          修改品牌方数据
        </button>
      )}
    </div>
  )
}
