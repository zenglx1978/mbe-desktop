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
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
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
      <div className="px-4 py-2 bg-secondary/20 text-[10px] text-muted-foreground/50">
        结果仅供参考，具体以实际为准
      </div>
    </>
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
