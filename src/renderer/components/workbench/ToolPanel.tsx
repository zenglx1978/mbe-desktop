import { useState, useMemo } from 'react'
import type { SolutionConfig, ToolConfig, ToolField } from '@/lib/solution-router'
import { runCalculation } from '@/lib/tool-service'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'

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
                <ToolCard key={tool.id} tool={tool} solutionId={solution.id} />
              ))}
            </div>
          ))
        ) : (
          solution.tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} solutionId={solution.id} />
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
          className={`rounded-lg border p-4 text-sm ${
            result.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
          }`}
        >
          {result.success ? (
            <pre className="whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          ) : (
            <p className="text-red-400">{result.error}</p>
          )}
          {result.source && (
            <p className="text-xs text-muted-foreground mt-2">来源：{result.source}</p>
          )}
        </div>
      )}
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
