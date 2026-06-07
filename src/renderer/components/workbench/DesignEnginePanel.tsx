import { useState, useRef, useCallback, useEffect } from 'react'
import type { SolutionConfig } from '@/lib/solution-router'
import {
  generateDesign,
  downloadBlob,
  checkDesignHealth,
  type DesignFormat,
  type DesignTheme,
} from '@/lib/design-engine-service'
import { useToolStore } from '@/stores/tool-store'
import { FileImage, Download, Loader2, AlertCircle, RefreshCw, Eye, ArrowRight, BarChart2, BookOpen, TrendingUp } from 'lucide-react'

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
  const consumePendingDesignMarkdown = useToolStore((s) => s.consumePendingDesignMarkdown)
  const selectedStock = useToolStore((s) => s.selectedStock)
  const navigateToWorkflow = useToolStore((s) => s.navigateToWorkflow)

  const [markdown, setMarkdown] = useState(() => {
    return consumePendingDesignMarkdown() ?? SAMPLE_MARKDOWN
  })
  const [format, setFormat] = useState<DesignFormat>('pptx')
  const [theme, setTheme] = useState<DesignTheme>('dark')
  const [page, setPage] = useState<number | undefined>(undefined)

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)
  const [healthy, setHealthy] = useState<boolean | null>(null)

  const previewRef = useRef<string | null>(null)
  const autoPreviewDone = useRef(false)

  /** 将 Blob 转为 data: URL（CSP img-src 不允许 blob: 时的安全替代） */
  const blobToDataUrl = useCallback((blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }, [])

  const revokePreview = useCallback(() => {
    previewRef.current = null
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
        // 用 data: URL 而非 blob: URL，兼容 Electron CSP img-src 限制
        const dataUrl = await blobToDataUrl(blob)
        previewRef.current = dataUrl
        setPreviewUrl(dataUrl)
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

  // 挂载时自动生成首页预览（仅一次）
  useEffect(() => {
    if (autoPreviewDone.current) return
    autoPreviewDone.current = true
    void handleGenerate(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


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

      {/* 来源引导栏：显示如何把研究结果导入 Design Engine */}
      <div className="shrink-0 px-4 py-2 border-b border-border/30 bg-muted/10 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">内容来源：</span>

        {/* 有选中股票：快速生成该股票的分析报告模板 */}
        {selectedStock ? (
          <button
            type="button"
            onClick={() => {
              const frontmatter = `---\ntitle: ${selectedStock.name}（${selectedStock.ticker}）投研报告\nsubtitle: 深度研究 · ${new Date().toLocaleDateString('zh-CN')}\n---\n\n# 请先在「研究」工作流中完成分析\n\n完成分析后，点击结果页底部的「生成 PPTX」按钮，\n分析结论将自动填入此编辑器。\n\n---\n\n# 分析概要\n\n（待填入）\n\n# 估值区间\n\n（待填入）\n\n# 风险提示\n\n（待填入）`
              setMarkdown(frontmatter)
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <BarChart2 className="w-3 h-3" />
            {selectedStock.name} 报告模板
          </button>
        ) : null}

        {/* 快捷入口：去研究工作流 */}
        <button
          type="button"
          onClick={() => navigateToWorkflow('stock_research')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border border-border/50 hover:bg-muted/40 transition-colors text-muted-foreground"
        >
          <TrendingUp className="w-3 h-3" />
          去研究 → 生成研报
          <ArrowRight className="w-3 h-3" />
        </button>

        {/* 快捷入口：行业研究 */}
        <button
          type="button"
          onClick={() => navigateToWorkflow('sector_research')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border border-border/50 hover:bg-muted/40 transition-colors text-muted-foreground"
        >
          <BookOpen className="w-3 h-3" />
          行业研究 → 生成研报
          <ArrowRight className="w-3 h-3" />
        </button>

        <span className="text-xs text-muted-foreground/60 ml-auto hidden sm:block">
          研究完成后点击「生成 PPTX」自动导入
        </span>
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
                {generating
                  ? <Loader2 className="w-12 h-12 mx-auto text-primary/40 animate-spin" />
                  : <FileImage className="w-12 h-12 mx-auto text-muted-foreground/30" />
                }
                <p className="text-sm text-muted-foreground">
                  {generating ? '正在生成首页预览…' : '点击「预览」查看幻灯片效果'}
                </p>
                <p className="text-xs text-muted-foreground/60">
                  或点击「生成 PPTX」直接下载文件
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
