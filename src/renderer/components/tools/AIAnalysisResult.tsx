/**
 * 通用 AI 分析结果展示组件
 * 适用于合同审查、文档分析等 AI 返回的结构化结果。
 */

import { useState } from 'react'

export interface AnalysisItem {
  label: string
  value: string
  level?: 'info' | 'warn' | 'error' | 'success'
}

export interface AnalysisResult {
  summary: string
  items: AnalysisItem[]
  details?: string
  suggestions?: string[]
  sources?: string[]
  confidence?: number
  duration?: number
}

interface Props {
  result: AnalysisResult
  title?: string
  color: string
}

const LEVEL_STYLE: Record<string, string> = {
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  warn: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  error: 'text-red-400 bg-red-500/10 border-red-500/20',
  success: 'text-green-400 bg-green-500/10 border-green-500/20',
}

const LEVEL_ICON: Record<string, string> = {
  info: 'ℹ️', warn: '⚠️', error: '🚫', success: '✅',
}

export default function AIAnalysisResult({ result, title, color }: Props) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="space-y-4">
      {/* 摘要 */}
      <div className="px-4 py-3 rounded-xl border border-border/50 bg-card">
        <div className="flex items-start gap-3">
          <span className="text-xl shrink-0">📋</span>
          <div className="flex-1 min-w-0">
            {title && <h4 className="text-sm font-semibold mb-1">{title}</h4>}
            <p className="text-sm whitespace-pre-wrap">{result.summary}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {result.confidence != null && (
                <span>置信度 {Math.round(result.confidence * 100)}%</span>
              )}
              {result.duration != null && (
                <span>耗时 {(result.duration / 1000).toFixed(1)}s</span>
              )}
              {result.sources && result.sources.length > 0 && (
                <span>{result.sources.length} 个来源</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 分析条目 */}
      {result.items.length > 0 && (
        <div className="space-y-2">
          {result.items.map((item, i) => {
            const level = item.level || 'info'
            return (
              <div
                key={i}
                className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${LEVEL_STYLE[level]}`}
              >
                <span className="text-sm shrink-0">{LEVEL_ICON[level]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{item.label}</p>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{item.value}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 建议 */}
      {result.suggestions && result.suggestions.length > 0 && (
        <div className="px-4 py-3 rounded-xl border border-border/50 bg-secondary/20">
          <h4 className="text-sm font-semibold mb-2">💡 建议</h4>
          <ul className="space-y-1.5">
            {result.suggestions.map((s, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 详细分析（可折叠） */}
      {result.details && (
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDetails ? '收起' : '展开'}详细分析 ▾
          </button>
          {showDetails && (
            <div className="mt-2 px-4 py-3 rounded-xl border border-border/30 bg-secondary/10 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
              {result.details}
            </div>
          )}
        </div>
      )}

      {/* 来源 */}
      {result.sources && result.sources.length > 0 && (
        <div className="text-xs text-muted-foreground/60">
          <span className="font-medium">引用来源：</span>
          {result.sources.map((s, i) => (
            <span key={i} className="ml-1">
              [{i + 1}] {s}{i < result.sources!.length - 1 ? '；' : ''}
            </span>
          ))}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => {
            const text = [
              result.summary,
              '',
              ...result.items.map(it => `[${it.label}] ${it.value}`),
              '',
              ...(result.suggestions?.map((s, i) => `${i + 1}. ${s}`) || []),
            ].join('\n')
            navigator.clipboard.writeText(text)
          }}
          className="px-3 py-1.5 rounded-lg text-xs border border-border/50 hover:bg-secondary/30 transition-colors"
        >
          📋 复制结果
        </button>
        <button
          className="px-3 py-1.5 rounded-lg text-xs text-white hover:opacity-90 transition-colors"
          style={{ backgroundColor: color }}
          onClick={() => {
            const blob = new Blob(
              [JSON.stringify(result, null, 2)],
              { type: 'application/json' },
            )
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'analysis-result.json'
            a.click()
            URL.revokeObjectURL(url)
          }}
        >
          💾 导出 JSON
        </button>
      </div>
    </div>
  )
}
