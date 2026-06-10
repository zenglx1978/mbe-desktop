/**
 * BacktestPanel — 动态止损/止盈回测验证面板
 *
 * 功能：
 *  1. 输入 ticker、回测日期区间、可选 S/L 和 T/P 覆盖值
 *  2. 调用 POST /api/invest/strategy/backtest/compare
 *     → 将动态参数与五档位固定参数对比
 *  3. 表格展示对比结果（胜率 / Sharpe / 最大回撤 / 盈亏比）
 *  4. PDF 导出按钮 → POST /api/invest/strategy/backtest/compare/export-pdf
 */
import React, { useState, useCallback } from 'react'
import {
  FlaskConical, Play, Download, RefreshCw, AlertCircle,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { API_BASE, authHeaders } from '@/lib/api-client'

// ─── 类型 ──────────────────────────────────────────────────────────────────────

interface TierResult {
  name: string
  stop_loss_pct: number
  take_profit_pct: number
  win_rate: number
  sharpe_ratio: number
  max_drawdown_pct: number
  profit_factor: number
  total_trades: number
  avg_hold_days: number
  total_return_pct: number
  verdict?: string
}

interface CompareResult {
  ticker: string
  start_date: string
  end_date: string
  dynamic: TierResult
  tiers: TierResult[]
  verdict: string
  best_tier: string
}

// ─── 辅助 ──────────────────────────────────────────────────────────────────────

const INVEST_BASE = `${API_BASE}/api/invest`

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${INVEST_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string> ?? {}) },
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(err.detail ?? resp.statusText)
  }
  return resp.json()
}

function pct(v: number, decimals = 1) {
  return `${(v * 100).toFixed(decimals)}%`
}

function num(v: number, decimals = 2) {
  return v.toFixed(decimals)
}

function WinBadge({ v }: { v: number }) {
  const cls = v >= 0.5 ? 'text-green-600' : v >= 0.4 ? 'text-amber-500' : 'text-red-500'
  return <span className={`font-semibold ${cls}`}>{pct(v)}</span>
}

function SharpeBadge({ v }: { v: number }) {
  const cls = v >= 1.5 ? 'text-green-600' : v >= 0.8 ? 'text-amber-500' : 'text-red-500'
  return <span className={`font-semibold ${cls}`}>{num(v)}</span>
}

function DrawdownBadge({ v }: { v: number }) {
  const cls = v <= 0.1 ? 'text-green-600' : v <= 0.2 ? 'text-amber-500' : 'text-red-500'
  return <span className={`font-semibold ${cls}`}>{pct(v)}</span>
}

function TrendIcon({ current, baseline }: { current: number; baseline: number }) {
  const diff = current - baseline
  if (Math.abs(diff) < 0.005) return <Minus className="w-3 h-3 text-muted-foreground inline" />
  return diff > 0
    ? <TrendingUp className="w-3 h-3 text-green-500 inline" />
    : <TrendingDown className="w-3 h-3 text-red-500 inline" />
}

function ResultTable({ result }: { result: CompareResult }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const allRows: (TierResult & { isDynamic?: boolean })[] = [
    { ...result.dynamic, isDynamic: true },
    ...result.tiers,
  ]
  const bestName = result.best_tier

  return (
    <div className="space-y-4">
      {/* 综合结论 */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{result.ticker} 回测结论</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{result.verdict}</p>
            <p className="text-xs text-muted-foreground">
              {result.start_date} → {result.end_date} · 最优档位：
              <span className="font-semibold text-primary ml-1">{bestName}</span>
            </p>
          </div>
        </div>
      </div>

      {/* 核心指标对比表 */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border/60">
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">档位</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">止损</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">止盈</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">胜率</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">Sharpe</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">最大回撤</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">盈亏比</th>
                <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">笔数</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((row, i) => {
                const isBest = row.name === bestName
                const isFirst = i === 0
                return (
                  <tr
                    key={row.name}
                    className={`border-b border-border/40 transition-colors ${
                      isBest ? 'bg-green-500/5' : isFirst ? 'bg-primary/5' : 'hover:bg-muted/20'
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {isBest && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                        <span className={`font-medium ${row.isDynamic ? 'text-primary' : 'text-foreground'}`}>
                          {row.isDynamic ? '⚡ 动态' : row.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono">{pct(row.stop_loss_pct)}</td>
                    <td className="px-3 py-2.5 text-center font-mono">{pct(row.take_profit_pct)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <WinBadge v={row.win_rate} />
                      {!row.isDynamic && (
                        <TrendIcon current={row.win_rate} baseline={result.dynamic.win_rate} />
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <SharpeBadge v={row.sharpe_ratio} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <DrawdownBadge v={row.max_drawdown_pct} />
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold">
                      {num(row.profit_factor)}
                    </td>
                    <td className="px-3 py-2.5 text-center text-muted-foreground">
                      {row.total_trades}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 折叠详情 */}
      <button
        onClick={() => setDetailOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {detailOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {detailOpen ? '收起' : '展开'} 详细指标（总收益 / 平均持仓天数）
      </button>
      {detailOpen && (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60">
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">档位</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">总收益率</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground">平均持仓天数</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map(row => (
                  <tr key={row.name} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{row.isDynamic ? '⚡ 动态' : row.name}</td>
                    <td className={`px-3 py-2 text-center font-semibold ${row.total_return_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {row.total_return_pct >= 0 ? '+' : ''}{pct(row.total_return_pct)}
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground">
                      {row.avg_hold_days.toFixed(1)} 天
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 主面板 ────────────────────────────────────────────────────────────────────

export default function BacktestPanel() {
  const [ticker, setTicker] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [manualSL, setManualSL] = useState('')
  const [manualTP, setManualTP] = useState('')
  const [rolling, setRolling] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<CompareResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    const t = ticker.trim().toUpperCase()
    if (!t) return
    setLoading(true); setError(null); setResult(null)
    try {
      const body: Record<string, unknown> = {
        ticker: t,
        start_date: startDate,
        end_date: endDate,
        rolling_entry: rolling,
      }
      if (manualSL) body.stop_loss_pct = parseFloat(manualSL) / 100
      if (manualTP) body.take_profit_pct = parseFloat(manualTP) / 100
      const data = await apiFetch<CompareResult>('/strategy/backtest/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setResult(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [ticker, startDate, endDate, rolling, manualSL, manualTP])

  const exportPDF = useCallback(async () => {
    if (!result) return
    setExporting(true)
    try {
      const body: Record<string, unknown> = {
        ticker: result.ticker,
        start_date: result.start_date,
        end_date: result.end_date,
        rolling_entry: rolling,
      }
      if (manualSL) body.stop_loss_pct = parseFloat(manualSL) / 100
      if (manualTP) body.take_profit_pct = parseFloat(manualTP) / 100
      const resp = await fetch(`${INVEST_BASE}/strategy/backtest/compare/export-pdf`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!resp.ok) throw new Error(resp.statusText)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backtest_${result.ticker}_${result.start_date}_${result.end_date}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(String(e))
    } finally {
      setExporting(false)
    }
  }, [result, rolling, manualSL, manualTP])

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
        <FlaskConical className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-base font-semibold">回测验证</h2>
          <p className="text-xs text-muted-foreground">
            将动态止损/止盈参数与五档固定策略在历史数据上对比验证
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* 参数输入 */}
        <div className="rounded-xl border border-border/60 p-4 space-y-4">
          <h3 className="text-sm font-semibold">回测参数</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">股票代码 *</label>
              <input
                type="text"
                placeholder="如 600519 / AAPL"
                value={ticker}
                onChange={e => setTicker(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && run()}
                className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">开始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">结束日期</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">手动止损 % （可选，留空用动态值）</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="30"
                placeholder="如 8"
                value={manualSL}
                onChange={e => setManualSL(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">手动止盈 % （可选）</label>
              <input
                type="number"
                step="0.5"
                min="2"
                max="100"
                placeholder="如 20"
                value={manualTP}
                onChange={e => setManualTP(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={rolling}
                  onChange={e => setRolling(e.target.checked)}
                  className="w-4 h-4 rounded border-border/60 accent-primary"
                />
                滚动入场模式（每 5 日新开仓）
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={run}
              disabled={loading || !ticker.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {loading ? '计算中…' : '运行回测'}
            </button>
            {result && (
              <button
                onClick={exportPDF}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/60 text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {exporting ? '生成中…' : '导出 PDF'}
              </button>
            )}
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* 回测结果 */}
        {result && <ResultTable result={result} />}

        {/* 空态提示 */}
        {!result && !loading && !error && (
          <div className="text-center py-16 text-muted-foreground">
            <FlaskConical className="w-12 h-12 mx-auto opacity-20 mb-3" />
            <p className="text-sm">输入股票代码，点击"运行回测"开始验证</p>
            <p className="text-xs mt-1 opacity-70">
              将自动拉取历史 K 线，对比动态参数与保守/平衡/激进等五种固定档位
            </p>
          </div>
        )}

        {/* 说明 */}
        <div className="rounded-lg bg-muted/30 border border-border/40 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">回测方法说明</p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>每笔交易模拟从收盘价入场，日内低/高价触发止损/止盈</li>
            <li>动态参数由个股 MISES 评分、AI 冲击系数、财务质量等计算</li>
            <li>固定档位：T1 保守（5%/12%）→ T5 激进（15%/40%）</li>
            <li>Sharpe 使用无风险收益率 3%；胜率 = 盈利笔数 / 总笔数</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
