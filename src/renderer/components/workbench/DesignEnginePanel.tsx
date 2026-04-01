import { useState, useRef, useCallback } from 'react'
import type { SolutionConfig } from '@/lib/solution-router'
import {
  generateDesign,
  downloadBlob,
  checkDesignHealth,
  type DesignFormat,
  type DesignTheme,
} from '@/lib/design-engine-service'
import { FileImage, Download, Loader2, AlertCircle, RefreshCw, Eye } from 'lucide-react'

interface Props {
  solution: SolutionConfig
}

const FORMAT_OPTIONS: { value: DesignFormat; label: string }[] = [
  { value: 'pptx', label: 'PPTX' },
  { value: 'png', label: 'PNG' },
  { value: 'pdf', label: 'PDF' },
  { value: 'svg', label: 'SVG' },
]

const THEME_OPTIONS: { value: DesignTheme; label: string }[] = [
  { value: 'dark', label: '深色' },
  { value: 'light', label: '浅色' },
]

const SAMPLE_MARKDOWN = `---
title: MBE 季度报告
subtitle: 2025 Q4 业务回顾
---

# 本季度亮点

- 营收同比增长 42%
- 新增客户 120 家
- NPS 评分提升至 72

---

# 产品路线图

## 已完成
- Design Engine 上线
- 多 Agent 编排优化

## 进行中
- MBE Desktop 集成
- 知识库增强`

export default function DesignEnginePanel({ solution }: Props) {
  const agentName = solution.agents[0]?.id || ''

  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN)
  const [format, setFormat] = useState<DesignFormat>('pptx')
  const [theme, setTheme] = useState<DesignTheme>('dark')
  const [page, setPage] = useState<number | undefined>(undefined)

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)
  const [healthy, setHealthy] = useState<boolean | null>(null)

  const previewRef = useRef<string | null>(null)

  const revokePreview = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
      previewRef.current = null
    }
  }, [])

  const handleGenerate = async (preview = false) => {
    if (!markdown.trim()) return
    setGenerating(true)
    setError(null)

    const targetFormat: DesignFormat = preview ? 'png' : format

    try {
      const blob = await generateDesign({
        markdown,
        format: targetFormat,
        page: preview ? 0 : (page !== undefined ? page - 1 : undefined),
        theme,
        agent: agentName || undefined,
      })

      if (preview || targetFormat === 'png' || targetFormat === 'svg') {
        revokePreview()
        const url = URL.createObjectURL(blob)
        previewRef.current = url
        setPreviewUrl(url)
        setLastBlob(blob)
      } else {
        downloadBlob(blob, targetFormat)
        setLastBlob(blob)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleHealthCheck = async () => {
    const res = await checkDesignHealth()
    setHealthy(res !== null)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 bg-background/80 backdrop-blur-sm shrink-0">
        <FileImage className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Design Engine</span>
        <span className="text-xs text-muted-foreground">Markdown → 专业文档</span>
        <div className="flex-1" />

        {/* 健康检查 */}
        <button
          onClick={handleHealthCheck}
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md hover:bg-muted/50 transition-colors"
          title="检查 Design Engine 状态"
        >
          <RefreshCw className="w-3 h-3" />
          {healthy === true && <span className="text-emerald-500">在线</span>}
          {healthy === false && <span className="text-red-500">离线</span>}
          {healthy === null && <span className="text-muted-foreground">检查</span>}
        </button>
      </div>

      {/* 主体：左编辑 + 右预览 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左列：编辑器 + 选项 */}
        <div className="w-1/2 flex flex-col border-r border-border/30 overflow-hidden">
          {/* Markdown 编辑器 */}
          <div className="flex-1 overflow-hidden">
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="输入 Markdown 内容..."
              className="w-full h-full p-4 text-sm font-mono bg-background text-foreground resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>

          {/* 选项栏 */}
          <div className="shrink-0 border-t border-border/30 px-4 py-3 space-y-3 bg-muted/20">
            <div className="flex items-center gap-4 flex-wrap">
              {/* 格式 */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">格式</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as DesignFormat)}
                  className="px-2 py-1 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  {FORMAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* 主题 */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">主题</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as DesignTheme)}
                  className="px-2 py-1 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  {THEME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* 页码 */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">页码</label>
                <input
                  type="number"
                  min={1}
                  value={page ?? ''}
                  onChange={(e) => setPage(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="全部"
                  className="w-16 px-2 py-1 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleGenerate(true)}
                disabled={generating || !markdown.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                预览
              </button>

              <button
                onClick={() => handleGenerate(false)}
                disabled={generating || !markdown.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                生成 {format.toUpperCase()}
              </button>

              {lastBlob && !generating && (
                <button
                  onClick={() => downloadBlob(lastBlob, format)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 右列：预览 */}
        <div className="w-1/2 flex flex-col overflow-hidden bg-muted/10">
          {error && (
            <div className="mx-4 mt-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {previewUrl ? (
            <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
              <img
                src={previewUrl}
                alt="Design Preview"
                className="max-w-full rounded-lg shadow-lg border border-border/20"
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div className="space-y-3">
                <FileImage className="w-12 h-12 mx-auto text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">在左侧输入 Markdown 内容</p>
                <p className="text-xs text-muted-foreground/60">
                  点击「预览」查看首页效果，或直接「生成」下载文件
                </p>
                <div className="pt-2 space-y-1 text-xs text-muted-foreground/50 text-left max-w-xs mx-auto">
                  <p>支持的 Markdown 语法：</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>YAML frontmatter（title / subtitle）</li>
                    <li><code className="bg-muted/50 px-1 rounded">---</code> 分页符</li>
                    <li>标题、列表、代码块</li>
                    <li>图片引用</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
