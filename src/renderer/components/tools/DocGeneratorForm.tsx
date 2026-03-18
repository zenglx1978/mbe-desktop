/**
 * 文书生成表单
 * 根据 ToolConfig.fields 动态渲染表单，提交后调用远端 AI 生成文书。
 */

import { useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import type { ToolConfig } from '@/lib/solution-router'
import { resolveAgentBase } from '@/lib/tool-service'

interface Props {
  tool: ToolConfig
  color: string
}

interface GenerateResult {
  success: boolean
  content?: string
  title?: string
  error?: string
  duration?: number
}

export default function DocGeneratorForm({ tool, color }: Props) {
  const { currentSolutionId } = useAppStore()
  const [values, setValues] = useState<Record<string, string>>({})
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [generating, setGenerating] = useState(false)

  const fields = tool.fields || []

  function setField(key: string, val: string) {
    setValues(prev => ({ ...prev, [key]: val }))
  }

  async function handleGenerate() {
    const missing = fields.filter(f => f.required && !values[f.key]?.trim())
    if (missing.length > 0) {
      setResult({ success: false, error: `请填写：${missing.map(f => f.label).join('、')}` })
      return
    }

    setGenerating(true)
    setResult(null)
    const start = Date.now()

    try {
      const base = resolveAgentBase(tool.agent)
      const resp = await fetch(`${base}${tool.apiPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          solution_id: currentSolutionId,
        }),
      })

      if (!resp.ok) {
        const err = await resp.text().catch(() => resp.statusText)
        setResult({ success: false, error: `API ${resp.status}: ${err}`, duration: Date.now() - start })
        return
      }

      const data = await resp.json()
      setResult({
        success: true,
        content: data.content || data.text || data.document || JSON.stringify(data, null, 2),
        title: data.title || `${tool.name} — ${values.type || ''}`,
        duration: Date.now() - start,
      })
    } catch (err: any) {
      setResult({ success: false, error: err.message || '网络错误', duration: Date.now() - start })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 表单区 */}
      <div className="space-y-4">
        {fields.map(field => (
          <div key={field.key}>
            <label className="text-sm font-medium flex items-center gap-1 mb-1.5">
              {field.label}
              {field.required && <span className="text-red-400">*</span>}
            </label>

            {field.type === 'select' && field.options ? (
              <select
                value={values[field.key] || ''}
                onChange={(e) => setField(field.key, e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50 transition-colors appearance-none"
              >
                <option value="">请选择</option>
                {field.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                value={values[field.key] || ''}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={field.placeholder || `请输入${field.label}`}
                rows={6}
                className="w-full px-4 py-3 rounded-xl border border-border/50 bg-secondary/20 text-sm resize-none outline-none focus:border-primary/50 transition-colors"
              />
            ) : (
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                value={values[field.key] || ''}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={field.placeholder || `请输入${field.label}`}
                className="w-full px-4 py-2.5 rounded-xl border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50 transition-colors"
              />
            )}
          </div>
        ))}
      </div>

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 hover:opacity-90"
        style={{ backgroundColor: color }}
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            AI 生成中…
          </span>
        ) : (
          `生成${tool.name.replace('生成', '')}`
        )}
      </button>

      {/* 结果展示 */}
      {result && !result.success && (
        <div className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-sm text-red-400">
          {result.error}
        </div>
      )}

      {result && result.success && result.content && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{result.title}</h4>
            {result.duration != null && (
              <span className="text-xs text-muted-foreground">
                耗时 {(result.duration / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          <div className="px-5 py-4 rounded-xl border border-border/50 bg-card text-sm whitespace-pre-wrap max-h-[60vh] overflow-y-auto leading-relaxed">
            {result.content}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigator.clipboard.writeText(result.content || '')}
              className="px-3 py-1.5 rounded-lg text-xs border border-border/50 hover:bg-secondary/30 transition-colors"
            >
              复制全文
            </button>
            <button
              onClick={() => {
                const blob = new Blob([result.content || ''], { type: 'text/plain;charset=utf-8' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${result.title || '文书'}.txt`
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="px-3 py-1.5 rounded-lg text-xs border border-border/50 hover:bg-secondary/30 transition-colors"
            >
              导出 TXT
            </button>
            {window.electronAPI?.localApp && (
              <>
                <button
                  onClick={async () => {
                    const sections = (result.content || '').split('\n').filter(Boolean)
                    const res = await window.electronAPI!.localApp.docgen({
                      format: 'docx',
                      data: {
                        title: result.title || tool.name,
                        author: 'MBE AI 专家',
                        theme: 'mbe',
                        sections: sections.map(text => ({
                          type: text.startsWith('#') ? 'heading' : 'paragraph',
                          level: text.startsWith('###') ? 3 : text.startsWith('##') ? 2 : 1,
                          text: text.replace(/^#+\s*/, ''),
                        })),
                      },
                      fileName: `${result.title || tool.name}.docx`,
                    })
                    if (!res.success) alert(res.error || '导出失败')
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs text-white hover:opacity-90 transition-colors"
                  style={{ backgroundColor: color }}
                >
                  导出 Word
                </button>
                <button
                  onClick={async () => {
                    const sections = (result.content || '').split('\n').filter(Boolean)
                    const res = await window.electronAPI!.localApp.docgen({
                      format: 'pptx',
                      data: {
                        title: result.title || tool.name,
                        author: 'MBE AI 专家',
                        theme: 'mbe',
                        slides: [{
                          layout: 'content',
                          title: result.title || tool.name,
                          bullets: sections.slice(0, 8),
                        }],
                      },
                      fileName: `${result.title || tool.name}.pptx`,
                    })
                    if (!res.success) alert(res.error || '导出失败')
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs text-white hover:opacity-90 transition-colors"
                  style={{ backgroundColor: '#6366f1' }}
                >
                  导出 PPT
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
