/**
 * 研报蒸馏面板
 *
 * 功能：
 *  1. 输入股票代码 → 一键拉取最新研报并蒸馏（auto-distill）
 *  2. 展示 9 模块结构化结果（投资评级 / 目标价 / 核心论点 / 财务数据 / 竞争 / 催化剂 / 周期 / 资金 / 风险）
 *  3. 支持查询已缓存结果（KB hit 直接展示，无需重新抓取）
 *  4. 支持 PDF URL 直接解析
 */
import React, { useState, useCallback } from 'react'
import {
  Layers, Search, RefreshCw, AlertCircle, CheckCircle2,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight,
  FileText, Zap, Database,
} from 'lucide-react'
import { API_BASE, authHeaders } from '@/lib/api-client'

// ─── 类型 ─────────────────────────────────────────────────────────────────────

interface DistillModules {
  investment_thesis?: string
  rating?: string
  target_price?: { base?: number; bull?: number; bear?: number; currency?: string }
  holding_period?: string
  financial_forecast?: string
  competitive_position?: string
  catalysts?: string
  cycle_position?: { stage?: string; description?: string }
  capital_flows?: string
  risks?: string
  quality_score?: number
  [key: string]: unknown
}

interface DistillResult {
  success: boolean
  ticker?: string
  modules?: DistillModules
  from_cache?: boolean
  distilled_at?: string
  source_type?: string
  quality_score?: number
  error?: string
  hint?: string
}

// ─── 辅助组件 ─────────────────────────────────────────────────────────────────

function RatingBadge({ rating }: { rating?: string }) {
  if (!rating) return null
  const r = rating.toLowerCase()
  const isUp = r.includes('买入') || r.includes('增持') || r.includes('buy') || r.includes('outperform')
  const isDown = r.includes('卖出') || r.includes('减持') || r.includes('sell')
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      isUp ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
      isDown ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    }`}>
      {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
      {rating}
    </span>
  )
}

function QualityBar({ score }: { score?: number }) {
  if (score == null) return null
  const pct = Math.min(100, Math.max(0, score))
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>质量</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono">{pct.toFixed(0)}</span>
    </div>
  )
}

function ModuleCard({ label, content, defaultOpen = false }: { label: string; content?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!content) return null
  return (
    <div className="border border-border/60 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-medium text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span>{label}</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 py-3 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
      )}
    </div>
  )
}

// ─── 主面板 ───────────────────────────────────────────────────────────────────

export function ReportDistillPanel() {
  const [ticker, setTicker] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DistillResult | null>(null)
  const [mode, setMode] = useState<'ticker' | 'pdf'>('ticker')

  const distill = useCallback(async () => {
    const t = ticker.trim()
    if (!t && mode === 'ticker') return
    const url = pdfUrl.trim()
    if (!url && mode === 'pdf') return

    setLoading(true)
    setResult(null)
    try {
      if (mode === 'ticker') {
        const resp = await fetch(`${API_BASE}/api/invest/report/auto-distill/${encodeURIComponent(t)}`, {
          headers: authHeaders(),
        })
        const data = await resp.json()
        setResult(data)
      } else {
        const resp = await fetch(`${API_BASE}/api/invest/report/pdf/parse`, {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdf_url: url, auto_distill: true, max_pages: 30 }),
        })
        const data = await resp.json()
        if (data.distill) {
          setResult({ ...data.distill, source_type: 'pdf' })
        } else {
          setResult({ success: false, error: data.error || 'PDF 解析失败' })
        }
      }
    } catch (e) {
      setResult({ success: false, error: String(e) })
    } finally {
      setLoading(false)
    }
  }, [ticker, pdfUrl, mode])

  const m = result?.modules

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
        <Layers className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-base font-semibold">研报蒸馏</h2>
          <p className="text-xs text-muted-foreground">AI 提取 9 模块投研核心 — 评级 / 目标价 / 论点 / 财务 / 周期 / 资金 / 风险</p>
        </div>
      </div>

      {/* 输入区 */}
      <div className="px-5 py-4 border-b border-border/40 space-y-3">
        {/* 模式切换 */}
        <div className="flex rounded-lg border border-border/60 overflow-hidden w-fit text-xs">
          {(['ticker', 'pdf'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 font-medium transition-colors ${mode === m ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50'}`}
            >
              {m === 'ticker' ? '🏷 股票代码' : '📄 PDF URL'}
            </button>
          ))}
        </div>

        {mode === 'ticker' ? (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="如 600519 / AAPL / 0700.HK"
              value={ticker}
              onChange={e => setTicker(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && distill()}
              className="flex-1 px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={distill}
              disabled={loading || !ticker.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? '蒸馏中…' : '蒸馏'}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="http://static.cninfo.com.cn/finalpage/..."
              value={pdfUrl}
              onChange={e => setPdfUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && distill()}
              className="flex-1 px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={distill}
              disabled={loading || !pdfUrl.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {loading ? '解析中…' : '解析'}
            </button>
          </div>
        )}
      </div>

      {/* 结果区 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {!result && !loading && (
          <div className="flex flex-col items-center justify-center h-60 text-center text-muted-foreground gap-3">
            <Layers className="w-12 h-12 opacity-20" />
            <div>
              <p className="font-medium">输入股票代码后点击蒸馏</p>
              <p className="text-xs mt-1">自动拉取东方财富研报，结合巨潮年报 PDF + AKShare 财务数据，提取 9 模块结构化结果</p>
            </div>
          </div>
        )}

        {result && !result.success && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-destructive">蒸馏失败</p>
              <p className="text-muted-foreground mt-0.5">{result.error || result.hint}</p>
            </div>
          </div>
        )}

        {result?.success && m && (
          <>
            {/* 摘要行 */}
            <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-muted/40 border border-border/60">
              <div className="flex items-center gap-2">
                {result.from_cache
                  ? <Database className="w-4 h-4 text-blue-500" />
                  : <Zap className="w-4 h-4 text-green-500" />}
                <span className="text-sm font-semibold">{result.ticker || ticker}</span>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
              {m.rating && <RatingBadge rating={m.rating} />}
              {m.target_price?.base != null && (
                <span className="text-sm text-muted-foreground">
                  目标价 <span className="font-mono font-semibold text-foreground">
                    {m.target_price.currency || '¥'}{m.target_price.base}
                  </span>
                </span>
              )}
              {m.holding_period && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{m.holding_period}</span>
              )}
              {result.from_cache && (
                <span className="text-xs text-muted-foreground ml-auto">
                  来自缓存 · {result.distilled_at?.slice(0, 10)}
                </span>
              )}
            </div>

            <QualityBar score={m.quality_score as number | undefined} />

            {/* 9 模块 */}
            <ModuleCard label="📋 投资论点（核心观点）" content={m.investment_thesis} defaultOpen />
            <ModuleCard label="💰 财务预测" content={m.financial_forecast} />
            <ModuleCard label="🏆 竞争地位" content={m.competitive_position} />
            <ModuleCard label="⚡ 主要催化剂" content={m.catalysts} />
            <ModuleCard label="🔄 周期位置" content={
              m.cycle_position
                ? `阶段：${m.cycle_position.stage || '—'}\n${m.cycle_position.description || ''}`
                : undefined
            } />
            <ModuleCard label="💸 资金面" content={m.capital_flows} />
            <ModuleCard label="⚠️ 风险提示" content={m.risks} />
          </>
        )}
      </div>
    </div>
  )
}
