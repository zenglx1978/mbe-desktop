/**
 * MISES 研报导出面板 — PDF / PPTX 矢量研报下载
 *
 * 调用 GET /api/invest/mises/report/{ticker}/export?format=pdf|pptx
 * 返回二进制文件流，触发浏览器/Electron 下载。
 */
import { useState, useEffect } from 'react'
import { Download, FileText, Presentation, AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react'
import type { SolutionConfig } from '@/lib/solution-router'
import { runFileExport } from '@/lib/tool-service'
import { API_BASE, authHeaders } from '@/lib/api-client'
import { useToolStore } from '@/stores/tool-store'

interface Props {
  solution: SolutionConfig
}

type Format = 'pdf' | 'pptx'

interface ReportStatus {
  ticker: string
  format: Format
  status: 'idle' | 'loading' | 'success' | 'error'
  message?: string
  fileName?: string
}

const FORMAT_META: Record<Format, { label: string; desc: string; icon: typeof FileText; color: string }> = {
  pdf: {
    label: 'PDF 研报',
    desc: '含矢量图表，适合打印存档、邮件分发',
    icon: FileText,
    color: '#ef4444',
  },
  pptx: {
    label: 'PPTX 演示文稿',
    desc: '可编辑幻灯片，适合路演 / 汇报演示',
    icon: Presentation,
    color: '#f97316',
  },
}

export default function MisesExportPanel({ solution: _solution }: Props) {
  const selectedStock = useToolStore((s) => s.selectedStock)
  const [ticker, setTicker] = useState('')
  const [market, setMarket] = useState<'A' | 'HK' | 'US'>('A')
  const [statuses, setStatuses] = useState<ReportStatus[]>([])

  // 从全局股票上下文预填（首次进入或上下文切换时）
  useEffect(() => {
    if (selectedStock) {
      setTicker(selectedStock.ticker)
      setMarket(selectedStock.market)
    }
  }, [selectedStock])

  const setStatus = (s: ReportStatus) => {
    setStatuses((prev) => {
      const idx = prev.findIndex((x) => x.ticker === s.ticker && x.format === s.format)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = s
        return next
      }
      return [s, ...prev]
    })
  }

  const handleExport = async (format: Format) => {
    const t = ticker.trim().toUpperCase()
    if (!t) return
    setStatus({ ticker: t, format, status: 'loading' })

    // 使用 tool-service.ts 中的 runFileExport 函数
    const mockTool = {
      id: 'mises-report-export',
      type: 'file-export' as const,
      name: 'MISES 研报',
      icon: '📄',
      agent: 'invest',
      apiPath: '/api/invest/mises/report/{ticker}/export',
      method: 'GET' as const,
      fileNameTemplate: `{ticker}_MISES研报.{ext}`,
    }

    const result = await runFileExport(mockTool, { ticker: t, market }, format)
    if (result.success) {
      setStatus({ ticker: t, format, status: 'success', fileName: result.fileName })
    } else {
      setStatus({ ticker: t, format, status: 'error', message: result.error })
    }
  }

  const handleBatchCheck = async () => {
    const t = ticker.trim().toUpperCase()
    if (!t) return
    // 快速调用 JSON 接口检查研报是否存在
    try {
      const resp = await fetch(`${API_BASE}/api/invest/mises/report/${encodeURIComponent(t)}/summary`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(10000),
      })
      if (resp.ok) {
        const data = await resp.json() as Record<string, unknown>
        const name = data.company_name ?? t
        alert(`✅ 已找到 ${name} 的 MISES 研报，可直接导出。`)
      } else if (resp.status === 404) {
        alert(`⚠️ 尚无 ${t} 的 MISES 研报，请先在"研究"标签对该股票完成分析。`)
      } else {
        alert(`服务器返回 ${resp.status}`)
      }
    } catch {
      alert('网络错误，无法检查研报状态')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* 标题 */}
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Download className="w-5 h-5 text-amber-500" />
            MISES 深度研报导出
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            导出含矢量图表的 MISES 五维深度研报，PDF 适合存档，PPTX 适合路演演示。
          </p>
        </div>

        {/* 已选中股票的快捷提示 */}
        {selectedStock ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span className="text-foreground">
              已从「组合」自动填入：<span className="font-semibold text-primary">{selectedStock.name}（{selectedStock.ticker}）</span>
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span className="text-amber-700 dark:text-amber-400">
              导出前需先在「研究」标签对目标股票完成 MISES 评分分析，系统才能生成研报。或从「组合」自选股卡片点击直接跳转。
            </span>
          </div>
        )}

        {/* 输入区 */}
        <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-card">
          <h3 className="text-sm font-semibold">股票信息</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">股票代码</label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="如 600482 / 00751 / AAPL"
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">市场</label>
              <select
                value={market}
                onChange={(e) => setMarket(e.target.value as 'A' | 'HK' | 'US')}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all"
              >
                <option value="A">A 股</option>
                <option value="HK">港股</option>
                <option value="US">美股</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={handleBatchCheck}
            disabled={!ticker.trim()}
            className="text-xs text-amber-600 hover:text-amber-700 disabled:opacity-40 underline underline-offset-2"
          >
            检查研报是否已生成
          </button>
        </div>

        {/* 导出格式卡片 */}
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(FORMAT_META) as Format[]).map((fmt) => {
            const meta = FORMAT_META[fmt]
            const Icon = meta.icon
            const st = statuses.find((s) => s.ticker === ticker.trim().toUpperCase() && s.format === fmt)
            const isLoading = st?.status === 'loading'
            const isSuccess = st?.status === 'success'
            const isError = st?.status === 'error'

            return (
              <div key={fmt} className="p-4 rounded-xl border border-border/60 bg-card space-y-3 hover:border-border transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${meta.color}18` }}>
                    <Icon className="w-5 h-5" style={{ color: meta.color }} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">{meta.label}</h4>
                    <p className="text-xs text-muted-foreground">{meta.desc}</p>
                  </div>
                </div>

                {/* 状态提示 */}
                {isSuccess && (
                  <div className="flex items-center gap-1.5 text-xs text-green-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>已下载：{st?.fileName}</span>
                  </div>
                )}
                {isError && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{st?.message}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleExport(fmt)}
                  disabled={!ticker.trim() || isLoading}
                  className="w-full h-8 flex items-center justify-center gap-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: ticker.trim() && !isLoading ? meta.color : undefined }}
                >
                  {isLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />生成中…</>
                  ) : (
                    <><Download className="w-3.5 h-3.5" />导出 {fmt.toUpperCase()}</>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* 历史记录 */}
        {statuses.filter((s) => s.status === 'success').length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">本次会话下载记录</h3>
            {statuses.filter((s) => s.status === 'success').map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <span className="font-medium">{s.ticker}</span>
                <span className="text-muted-foreground">{s.format.toUpperCase()}</span>
                <span className="flex-1 text-xs text-muted-foreground truncate">{s.fileName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
