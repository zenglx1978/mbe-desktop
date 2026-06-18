import { useState, useCallback } from 'react'
import { useAppStore } from '@/stores/app-store'
import type { ToolConfig, ToolField } from '@/lib/solution-router'
import { runCalculation, type CalcResult } from '@/lib/tool-service'

interface Props {
  tool: ToolConfig
  color: string
}

export default function CalculatorForm({ tool, color }: Props) {
  const { currentSolutionId } = useAppStore()
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    tool.fields?.forEach(f => {
      init[f.key] = f.default != null ? String(f.default) : ''
    })
    return init
  })
  const [result, setResult] = useState<CalcResult | null>(null)
  const [computing, setComputing] = useState(false)

  const updateField = useCallback((key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }))
    setResult(null)
  }, [])

  async function handleCompute() {
    if (computing) return
    setComputing(true)
    setResult(null)

    try {
      const numericValues: Record<string, unknown> = {}
      tool.fields?.forEach(f => {
        const v = values[f.key]
        if (f.array) {
          // 数组字段：按分隔符拆分字符串为数组
          const separator = f.arraySeparator ? new RegExp(f.arraySeparator) : /[,;\n\s]+/
          numericValues[f.key] = (v || '')
            .split(separator)
            .map(s => s.trim())
            .filter(s => s.length > 0)
        } else if (f.type === 'number' || f.type === 'currency') {
          numericValues[f.key] = parseFloat(v!) || 0
        } else {
          numericValues[f.key] = v
        }
      })

      const calcResult = await runCalculation(tool, numericValues, currentSolutionId || '')
      setResult(calcResult)
    } catch (err: unknown) {
      setResult({ success: false, error: err instanceof Error ? err.message : '计算失败', source: 'remote', durationMs: 0 })
    } finally {
      setComputing(false)
    }
  }

  const allRequired = tool.fields?.filter(f => f.required).every(f => values[f.key]?.trim()) ?? true

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* 表单 */}
      <div className="space-y-4">
        {tool.fields?.map(field => (
          <FieldInput
            key={field.key}
            field={field}
            value={values[field.key] || ''}
            onChange={(v) => updateField(field.key, v)}
          />
        ))}
      </div>

      {/* 计算按钮 */}
      <button
        onClick={handleCompute}
        disabled={!allRequired || computing}
        className="w-full py-3 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
        style={{ backgroundColor: color }}
      >
        {computing ? '计算中...' : '开始计算'}
      </button>

      {/* 结果展示 */}
      {result && <CalcResultCard result={result} tool={tool} color={color} />}
    </div>
  )
}

function FieldInput({ field, value, onChange }: {
  field: ToolField; value: string; onChange: (v: string) => void
}) {
  const baseClass = "w-full px-3 py-2.5 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50 transition-colors"

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {field.type === 'select' ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={baseClass}
        >
          <option value="">请选择</option>
          {field.options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className={baseClass + ' resize-none'}
        />
      ) : (
        <input
          type={field.type === 'currency' || field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          step={field.type === 'currency' ? '0.01' : undefined}
          className={baseClass}
        />
      )}
    </div>
  )
}

function CalcResultCard({ result, tool, color }: {
  result: CalcResult; tool: ToolConfig; color: string
}) {
  if (!result.success) {
    return (
      <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5">
        <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
          <span>❌</span> 计算失败
        </div>
        <p className="text-xs text-red-400 mt-1">{result.error}</p>
      </div>
    )
  }

  const data = result.data || {}
  if (tool.id === 'founder-os-signal') {
    return <FounderOSCalcResult data={data} tool={tool} color={color} result={result} />
  }

  // 跳过嵌套对象（如 breakdown），只展示简单键值
  const entries = Object.entries(data).filter(
    ([k, v]) => !k.startsWith('_') && typeof v !== 'object'
  )
  // 检测批量扫描结果：data.results 为数组（batch_scan 专用渲染）
  const rawBatchResults = data.results
  const batchResults = Array.isArray(rawBatchResults)
    ? (rawBatchResults as Array<{ ticker: string; status: string; path?: string; error?: string }>)
    : null

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      {/* 结果头 */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: color + '15' }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{tool.icon}</span>
          <span className="font-medium text-sm">{tool.name} · 计算结果</span>
        </div>
        <div className="flex items-center gap-2">
          {tool.type === 'calculator' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-medium">
              ✓ 100% 确定性计算
            </span>
          )}
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {result.source === 'local' ? '📱 本地计算' : '☁️ 云端计算'}
            {result.durationMs > 0 && ` · ${result.durationMs}ms`}
          </span>
        </div>
      </div>

      {/* 结果数据 */}
      <div className="p-4 space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between py-1.5 border-b border-border/20 last:border-0">
            <span className="text-sm text-muted-foreground">{formatKey(key)}</span>
            <span className="text-sm font-medium">{formatValue(value)}</span>
          </div>
        ))}
      </div>

      {/* 批量扫描结果列表（batch_scan 专用） */}
      {batchResults && batchResults.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-xs font-medium text-muted-foreground mb-2 mt-1">
            批量结果（{batchResults.length} 项）
          </div>
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
            {batchResults.map((item, idx) => {
              const ok = item.status === 'ok' || item.status === 'success'
              return (
                <div
                  key={`${item.ticker}-${idx}`}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs ${
                    ok ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-red-500/5 border border-red-500/20'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={ok ? 'text-emerald-600' : 'text-red-500'}>{ok ? '✓' : '✗'}</span>
                    <span className="font-mono font-medium">{item.ticker}</span>
                    {ok && item.path && (
                      <span className="text-muted-foreground/70 truncate" title={item.path}>
                        {item.path}
                      </span>
                    )}
                    {!ok && item.error && (
                      <span className="text-red-400/80 truncate" title={item.error}>
                        {item.error}
                      </span>
                    )}
                  </div>
                  {ok && item.path && (
                    <button
                      onClick={() => navigator.clipboard.writeText(item.path!)}
                      className="text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-secondary/50 flex-shrink-0"
                      title="复制路径"
                    >
                      📋
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 底部操作 */}
      <div className="px-4 py-3 bg-secondary/20 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground/50">
          结果仅供参考，具体以实际为准
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const text = entries.map(([k, v]) => `${formatKey(k)}: ${formatValue(v)}`).join('\n')
              navigator.clipboard.writeText(text)
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary/50"
          >
            📋 复制
          </button>
        </div>
      </div>
    </div>
  )
}

function FounderOSCalcResult({ data, tool, color, result }: {
  data: Record<string, unknown>; tool: ToolConfig; color: string; result: CalcResult
}) {
  const payload = unwrapApiData(data)
  const peerRelative = asRecord(payload.peer_relative)
  const target = asRecord(peerRelative.target)
  const verdict = String(peerRelative.relative_verdict ?? 'insufficient_valuation_data')
  const position = String(peerRelative.valuation_position ?? 'unknown')
  const confidence = String(peerRelative.confidence ?? 'low')

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: color + '15' }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{tool.icon}</span>
          <span className="font-medium text-sm">{tool.name} · 相对同行结论</span>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
          {result.source === 'local' ? '📱 本地计算' : '☁️ 云端计算'}
          {result.durationMs > 0 && ` · ${result.durationMs}ms`}
        </span>
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
          <FounderMetric label="Founder OS" value={formatMaybeNumber(payload.founder_os_signal, 1)} />
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
    </div>
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

function formatKey(key: string): string {
  const map: Record<string, string> = {
    compensation: '补偿金额',
    n_value: 'N 值',
    formula: '计算公式',
    legal_basis: '法律依据',
    tax: '应纳税额',
    after_tax: '税后收入',
    fee: '受理费',
    total: '合计',
    result: '计算结果',
    amount: '金额',
    rate: '税率',
    deduction: '速算扣除数',
    taxable_income: '应纳税所得额',
    monthly_tax: '月应纳税额',
    net_salary: '税后月薪',
    vat_amount: 'VAT 稅額',
    price_without_tax: '不含税金额',
    surcharge: '附加税额',
    score: '评分结果',
    grade: '等级',
    interpretation: '解读',
    fev1_fvc_ratio: 'FEV1/FVC比值',
    obstruction: '阻塞程度',
    tidal_volume: '潮气量',
    respiratory_rate: '呼吸频率',
    minute_ventilation: '分钟通气量',
    direct_cost: '直接费',
    indirect_cost: '间接费',
    profit: '利润',
    tax_amount: '税金',
    total_cost: '总造价',
  }
  return map[key] || key.replace(/_/g, ' ')
}

function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    if (value >= 100) return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    return String(value)
  }
  return String(value)
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
