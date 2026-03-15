/**
 * 文档 AI 分析面板
 * 上传文档 → 调用 Agent AI 接口 → 展示结构化分析结果。
 */

import { useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import type { ToolConfig } from '@/lib/solution-router'
import DocumentUploader, { type UploadedFile } from './DocumentUploader'
import AIAnalysisResult, { type AnalysisResult } from './AIAnalysisResult'
import { resolveAgentBase } from '@/lib/tool-service'

interface Props {
  tool: ToolConfig
  color: string
}

type Status = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error'

export default function DocumentAIPanel({ tool, color }: Props) {
  const { currentSolutionId } = useAppStore()
  const [status, setStatus] = useState<Status>('idle')
  const [file, setFile] = useState<UploadedFile | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')

  async function handleFileReady(uploaded: UploadedFile) {
    setFile(uploaded)
    setStatus('analyzing')
    setResult(null)
    setError('')
    setProgress(`正在分析 "${uploaded.name}"...`)

    const start = Date.now()

    try {
      const base = resolveAgentBase(tool.agent)
      const resp = await fetch(`${base}${tool.apiPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: uploaded.name,
          file_type: uploaded.type,
          content: uploaded.content,
          content_type: uploaded.contentType,
          solution_id: currentSolutionId,
        }),
      })

      const duration = Date.now() - start

      if (!resp.ok) {
        const errText = await resp.text().catch(() => resp.statusText)
        setError(`API ${resp.status}: ${errText}`)
        setStatus('error')
        return
      }

      const data = await resp.json()
      const analysisResult = normalizeResult(data, duration)
      setResult(analysisResult)
      setStatus('done')
    } catch (err: any) {
      setError(err.message || '网络错误')
      setStatus('error')
    }
  }

  function handleReset() {
    setStatus('idle')
    setFile(null)
    setResult(null)
    setError('')
    setProgress('')
  }

  return (
    <div className="space-y-6">
      {/* 已上传文件信息 */}
      {file && status !== 'idle' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-secondary/10">
          <span className="text-lg">{getFileIcon(file.name)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatSize(file.size)} · {file.contentType === 'text' ? '纯文本' : '二进制'}
            </p>
          </div>
          {status !== 'analyzing' && (
            <button
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary/30"
            >
              重新上传
            </button>
          )}
        </div>
      )}

      {/* 上传区（仅 idle 状态显示） */}
      {status === 'idle' && (
        <DocumentUploader tool={tool} color={color} onFileReady={handleFileReady} />
      )}

      {/* 分析中 */}
      {status === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div
            className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mb-4"
            style={{ borderColor: `${color}40`, borderTopColor: color }}
          />
          <p className="text-sm font-medium">{progress}</p>
          <p className="text-xs text-muted-foreground mt-1">AI 正在逐条审查，请稍候</p>
        </div>
      )}

      {/* 错误 */}
      {status === 'error' && (
        <div className="space-y-3">
          <div className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-sm text-red-400">
            {error}
          </div>
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-xl text-sm border border-border/50 hover:bg-secondary/30 transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {/* 分析结果 */}
      {status === 'done' && result && (
        <AIAnalysisResult result={result} title={`${tool.name} · ${file?.name || ''}`} color={color} />
      )}
    </div>
  )
}

/**
 * 将后端返回的各种格式归一化为 AnalysisResult
 */
function normalizeResult(data: any, duration: number): AnalysisResult {
  // 如果后端返回标准格式
  if (data.summary && Array.isArray(data.items)) {
    return { ...data, duration }
  }

  // 合同审查格式
  if (data.risk_items || data.risks || data.issues) {
    const risks = data.risk_items || data.risks || data.issues || []
    return {
      summary: data.summary || data.conclusion || '审查完成',
      items: risks.map((r: any) => ({
        label: r.clause || r.category || r.title || '条款',
        value: r.description || r.detail || r.content || JSON.stringify(r),
        level: mapRiskLevel(r.level || r.severity || r.risk_level),
      })),
      suggestions: data.suggestions || data.recommendations || [],
      sources: data.sources || data.references || [],
      confidence: data.confidence,
      duration,
    }
  }

  // 兜底：纯文本或通用 JSON
  return {
    summary: data.answer || data.text || data.content || JSON.stringify(data, null, 2),
    items: [],
    duration,
  }
}

function mapRiskLevel(level: string): 'info' | 'warn' | 'error' | 'success' {
  const l = (level || '').toLowerCase()
  if (l.includes('high') || l.includes('critical') || l === '高') return 'error'
  if (l.includes('medium') || l === '中') return 'warn'
  if (l.includes('low') || l === '低') return 'info'
  return 'info'
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const icons: Record<string, string> = {
    pdf: '📄', doc: '📝', docx: '📝', txt: '📋',
    jpg: '🖼', jpeg: '🖼', png: '🖼',
  }
  return icons[ext] || '📎'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
