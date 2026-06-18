import { useState, useMemo } from 'react'
import type { SolutionConfig, ToolConfig, ToolField } from '@/lib/solution-router'
import { runCalculation, runFileExport } from '@/lib/tool-service'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'
import { Download, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react'

interface Props {
  solution: SolutionConfig
}

export default function ToolPanel({ solution }: Props) {
  const grouped = useMemo(() => {
    const hasCategories = solution.tools.some((t) => t.category)
    if (!hasCategories) return null
    const map = new Map<string, ToolConfig[]>()
    for (const tool of solution.tools) {
      const cat = tool.category || '其他'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(tool)
    }
    return map
  }, [solution.tools])

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {grouped ? (
          Array.from(grouped.entries()).map(([category, tools]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {category}
              </h3>
              {tools.map((tool) => (
                tool.type === 'file-export'
                  ? <FileExportCard key={tool.id} tool={tool} />
                  : <ToolCard key={tool.id} tool={tool} solutionId={solution.id} />
              ))}            </div>
          ))
        ) : (
          solution.tools.map((tool) => (
            tool.type === 'file-export'
              ? <FileExportCard key={tool.id} tool={tool} />
              : <ToolCard key={tool.id} tool={tool} solutionId={solution.id} />
          ))
        )}
      </div>
    </div>
  )
}

function ToolCard({ tool, solutionId }: { tool: ToolConfig; solutionId: string }) {
  const [values, setValues] = useState<Record<string, string | number>>({})
  const [result, setResult] = useState<{ success: boolean; data?: Record<string, unknown>; error?: string; source?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCalc() {
    setLoading(true)
    setResult(null)
    const startTime = Date.now()
    try {
      const res = await runCalculation(tool, values as Record<string, unknown>, solutionId)
      setResult({
        success: res.success,
        data: res.data,
        error: res.error,
        source: res.source,
      })

      // 埋点：记录工具使用 + 操作参数 + 效率数据
      const stringValues: Record<string, string> = {}
      for (const [k, v] of Object.entries(values)) {
        if (v != null) stringValues[k] = String(v)
      }
      useAdaptiveUIStore.getState().trackToolUse(solutionId, tool.id, stringValues)
      useAdaptiveUIStore.getState().trackWorkflowTiming(
        solutionId, `tool:${tool.id}`, Date.now() - startTime, true
      )
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : '计算失败' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{tool.icon}</span>
        <div>
          <h3 className="font-medium text-sm">{tool.name}</h3>
          {tool.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
          )}
        </div>
      </div>
      {tool.fields && tool.fields.length > 0 && (
        <div className="grid gap-3">
          {tool.fields.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={values[f.key] ?? (f.default ?? '')}
              onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
            />
          ))}
        </div>
      )}
      <button
        onClick={handleCalc}
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
      >
        {loading ? '计算中...' : '计算'}
      </button>
      {result && (
        <div
          className={`rounded-lg border overflow-hidden text-sm ${
            result.success ? 'border-green-500/30' : 'bg-red-500/10 border-red-500/30'
          }`}
        >
          {result.success ? (
            <ResultTable data={result.data || {}} tool={tool} source={result.source} />
          ) : (
            <div className="p-4">
              <p className="text-red-400">{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const KEY_LABELS: Record<string, string> = {
  annual_income: '年收入',
  taxable_income: '应纳税所得额',
  tax: '应纳税额',
  effective_rate: '实际税率',
  formula: '计算公式',
  legal_basis: '法律依据',
  after_tax: '税后收入',
  monthly_tax: '月应纳税额',
  net_salary: '税后月薪',
  rate: '税率',
  deduction: '速算扣除数',
  compensation: '补偿金额',
  n_value: 'N 值',
  fee: '受理费',
  total: '合计',
  result: '计算结果',
  amount: '金额',
  vat_amount: 'VAT 稅額',
  price_without_tax: '不含税金额',
  surcharge: '附加税额',
  score: '评分结果',
  grade: '等级',
  interpretation: '解读',
  direct_cost: '直接费',
  indirect_cost: '间接费',
  profit: '利润',
  tax_amount: '税金',
  total_cost: '总造价',
}

function formatResultValue(v: unknown): string {
  if (v == null) return '—'
  const s = String(v)
  const num = Number(s)
  if (!isNaN(num) && s !== '' && num >= 100) {
    return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return s
}

function ResultTable({ data, tool, source }: { data: Record<string, unknown>; tool: ToolConfig; source?: string }) {
  if (tool.id === 'founder-os-signal') {
    return <FounderOSResult data={data} tool={tool} source={source} />
  }

  const entries = Object.entries(data).filter(
    ([k, v]) => !k.startsWith('_') && typeof v !== 'object'
  )

  return (
    <>
      <div className="px-4 py-2.5 bg-green-500/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>{tool.icon}</span>
          <span className="font-medium text-sm">{tool.name} · 计算结果</span>
        </div>
        {source && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {source === 'local' ? '📱 本地计算' : '☁️ 云端计算'}
          </span>
        )}
      </div>
      <div className="p-4 space-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between py-2 border-b border-border/20 last:border-0">
            <span className="text-sm text-muted-foreground">{KEY_LABELS[key] || key.replace(/_/g, ' ')}</span>
            <span className="text-sm font-medium text-right max-w-[60%]">{formatResultValue(value)}</span>
          </div>
        ))}
      </div>
      <div className="px-4 py-2 bg-secondary/20 text-[11px] text-muted-foreground/50">
        结果仅供参考，具体以实际为准
      </div>
    </>
  )
}

function FounderOSResult({ data, tool, source }: { data: Record<string, unknown>; tool: ToolConfig; source?: string }) {
  const payload = unwrapApiData(data)
  const peerRelative = asRecord(payload.peer_relative)
  const target = asRecord(peerRelative.target)
  const score = formatMaybeNumber(payload.founder_os_signal, 1)
  const verdict = String(peerRelative.relative_verdict ?? 'insufficient_valuation_data')
  const position = String(peerRelative.valuation_position ?? 'unknown')
  const confidence = String(peerRelative.confidence ?? 'low')

  return (
    <>
      <div className="px-4 py-2.5 bg-green-500/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>{tool.icon}</span>
          <span className="font-medium text-sm">{tool.name} · 相对同行结论</span>
        </div>
        {source && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {source === 'local' ? '📱 本地计算' : '☁️ 云端计算'}
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">相对结论</p>
              <p className="text-base font-semibold mt-0.5">{FOUNDER_VERDICT_LABELS[verdict] ?? verdict}</p>
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${confidenceClass(confidence)}`}>
              {FOUNDER_CONFIDENCE_LABELS[confidence] ?? confidence}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {String(peerRelative.note ?? payload.summary ?? '暂无相对同行说明')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FounderMetric label="Founder OS" value={score} />
          <FounderMetric label="估值位置" value={FOUNDER_POSITION_LABELS[position] ?? position} />
          <FounderMetric label="PE 相对同行" value={formatPct(peerRelative.pe_vs_peer_pct)} />
          <FounderMetric label="PB 相对同行" value={formatPct(peerRelative.pb_vs_peer_pct)} />
          <FounderMetric label="目标 PE/PB" value={`${formatMaybeNumber(target.pe, 2)} / ${formatMaybeNumber(target.pb, 2)}`} />
          <FounderMetric label="同行 PE/PB" value={`${formatMaybeNumber(peerRelative.peer_avg_pe, 2)} / ${formatMaybeNumber(peerRelative.peer_avg_pb, 2)}`} />
        </div>

        <div className="text-[11px] text-muted-foreground/70">
          目标估值来源：{String(target.source ?? 'unknown')}；本结论仅用于投研排序与复核，不构成交易建议。
        </div>
      </div>
    </>
  )
}

function FounderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/30 px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  )
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ToolField
  value: string | number
  onChange: (v: string | number) => void
}) {
  if (field.type === 'select') {
    return (
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{field.label}</label>
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border/50 text-sm outline-none focus:border-primary/50"
        >
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    )
  }
  if (field.type === 'textarea') {
    return (
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{field.label}</label>
        <textarea
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border/50 text-sm outline-none focus:border-primary/50 resize-none"
        />
      </div>
    )
  }
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{field.label}</label>
      <input
        type={field.type === 'number' || field.type === 'currency' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={String(value)}
        onChange={(e) => onChange(field.type === 'number' || field.type === 'currency' ? parseFloat(e.target.value) || 0 : e.target.value)}
        placeholder={field.placeholder}
        className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border/50 text-sm outline-none focus:border-primary/50"
      />
    </div>
  )
}

const FOUNDER_VERDICT_LABELS: Record<string, string> = {
  undervalued_quality: '低估质量候选',
  quality_priced_in: '优质但已定价',
  value_trap_check: '价值陷阱复核',
  avoid_or_shortlist_review: '谨慎/回避复核',
  insufficient_valuation_data: '估值数据不足',
  watchlist: '观察名单',
}

const FOUNDER_POSITION_LABELS: Record<string, string> = {
  deep_discount: '深度折价',
  discount: '折价',
  in_line: '基本匹配同行',
  slight_premium: '小幅溢价',
  premium: '明显溢价',
  unknown: '不可比',
}

const FOUNDER_CONFIDENCE_LABELS: Record<string, string> = {
  high: '高置信度',
  medium: '中置信度',
  low: '低置信度',
}

function unwrapApiData(data: Record<string, unknown>): Record<string, unknown> {
  const nested = data.data
  return isRecord(nested) ? nested : data
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function formatMaybeNumber(value: unknown, digits: number): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return num.toFixed(digits)
}

function formatPct(value: unknown): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return `${num > 0 ? '+' : ''}${num.toFixed(1)}%`
}

function confidenceClass(confidence: string): string {
  if (confidence === 'high') return 'bg-green-500/10 text-green-400 border-green-500/30'
  if (confidence === 'medium') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
  return 'bg-red-500/10 text-red-400 border-red-500/30'
}

// ── FileExportCard — file-export 类型工具渲染 ────────────────────────────────
function FileExportCard({ tool }: { tool: ToolConfig }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [activeFormat, setActiveFormat] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; fileName?: string; error?: string } | null>(null)

  const formats = tool.exportFormats ?? [{ value: 'pdf', label: 'PDF', ext: 'pdf' }]

  const handleDownload = async (fmt: string) => {
    setLoading(true)
    setActiveFormat(fmt)
    setResult(null)
    const today = new Date().toISOString().slice(0, 10)
    const res = await runFileExport(tool, { ...values, date: today }, fmt)
    setResult(res)
    setLoading(false)
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center gap-4 p-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-xl shrink-0">
          {tool.icon}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold">{tool.name}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 text-xs font-medium text-amber-600">
          <Download className="w-3 h-3" />文件导出
        </div>
      </div>

      {/* 表单字段 */}
      {tool.fields && tool.fields.length > 0 && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-2">
          {tool.fields.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={values[f.key] ?? (f.default != null ? String(f.default) : '')}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: String(v) }))}
            />
          ))}
        </div>
      )}

      {/* 结果提示 */}
      {result && (
        <div className={`mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${result.success ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-destructive/10 text-destructive'}`}>
          {result.success
            ? <><CheckCircle2 className="w-3.5 h-3.5 shrink-0" />已下载：{result.fileName}</>
            : <><AlertCircle className="w-3.5 h-3.5 shrink-0" />{result.error}</>}
        </div>
      )}

      {/* 导出格式按钮 */}
      <div className="flex gap-2 px-4 pb-4">
        {formats.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => handleDownload(f.value)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-semibold border border-border/50 hover:bg-muted disabled:opacity-50 transition-all"
          >
            {loading && activeFormat === f.value
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <FileText className="w-3.5 h-3.5" />}
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}
