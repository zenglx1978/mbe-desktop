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
      const numericValues: Record<string, any> = {}
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
          numericValues[f.key] = parseFloat(v) || 0
        } else {
          numericValues[f.key] = v
        }
      })

      const calcResult = await runCalculation(tool, numericValues, currentSolutionId || '')
      setResult(calcResult)
    } catch (err: any) {
      setResult({ success: false, error: err.message || '计算失败', source: 'remote', durationMs: 0 })
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
  // 跳过嵌套对象（如 breakdown），只展示简单键值
  const entries = Object.entries(data).filter(
    ([k, v]) => !k.startsWith('_') && typeof v !== 'object'
  )
  // 检测批量扫描结果：data.results 为数组（batch_scan 专用渲染）
  const batchResults = Array.isArray((data as any).results)
    ? ((data as any).results as Array<{ ticker: string; status: string; path?: string; error?: string }>)
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

function formatValue(value: any): string {
  if (typeof value === 'number') {
    if (value >= 100) return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    return String(value)
  }
  return String(value)
}
