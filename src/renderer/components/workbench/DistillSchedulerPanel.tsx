/**
 * 定时蒸馏调度器面板
 *
 * 功能：
 *  1. Watchlist 管理（添加 / 删除股票代码）
 *  2. 调度器状态（下次运行时间 / 已运行次数）
 *  3. 手动触发批量蒸馏
 *  4. 单个 ticker 立即蒸馏
 *  5. 历史记录（最近 N 次批量任务）
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Timer, Plus, Trash2, Play, RefreshCw, Clock, CheckCircle2,
  XCircle, SkipForward, AlertCircle, ChevronDown, ChevronRight,
  Database, ChevronUp,
} from 'lucide-react'
import { API_BASE, authHeaders } from '@/lib/api-client'

// ─── 类型 ─────────────────────────────────────────────────────────────────────

interface WatchlistItem {
  ticker: string
  added_at: string
  enabled: boolean
  last_run?: string
  last_status?: 'success' | 'skipped' | 'failed'
}

interface SchedulerStatus {
  running: boolean
  job_id?: string
  next_run?: string
  last_run?: string
  trigger?: string
}

interface JobHistory {
  id: number
  triggered_by: string
  started_at: string
  finished_at?: string
  total: number
  success: number
  skipped: number
  failed: number
}

// ─── 类型补充 ──────────────────────────────────────────────────────────────────

interface KBRecord {
  ticker: string
  title: string
  institution: string
  report_date: string
  quality_score: number
  created_at: string
}

interface KBStatus {
  total: number
  tickers: string[]
  records?: KBRecord[]
}

// ─── 辅助 ─────────────────────────────────────────────────────────────────────

const BASE = `${API_BASE}/api/invest/scheduler`
const REPORT_BASE = `${API_BASE}/api/invest/report`

async function apiFetch(path: string, init?: RequestInit) {
  const resp = await fetch(`${BASE}${path}`, { ...init, headers: { ...authHeaders(), ...(init?.headers as Record<string, string> ?? {}) } })
  return resp.json()
}

async function reportApiFetch(path: string, init?: RequestInit) {
  const resp = await fetch(`${REPORT_BASE}${path}`, { ...init, headers: { ...authHeaders(), ...(init?.headers as Record<string, string> ?? {}) } })
  return resp.json()
}

function StatusDot({ status }: { status?: string }) {
  if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-green-500" />
  if (status === 'failed') return <XCircle className="w-4 h-4 text-red-500" />
  if (status === 'skipped') return <SkipForward className="w-4 h-4 text-yellow-500" />
  return <Clock className="w-4 h-4 text-muted-foreground" />
}

function fmtDt(s?: string) {
  if (!s) return '—'
  try { return new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
  catch { return s.slice(0, 16) }
}

// ─── 主面板 ───────────────────────────────────────────────────────────────────

export function DistillSchedulerPanel() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [status, setStatus] = useState<SchedulerStatus | null>(null)
  const [history, setHistory] = useState<JobHistory[]>([])
  const [newTicker, setNewTicker] = useState('')
  const [runningTicker, setRunningTicker] = useState<string | null>(null)
  const [batchRunning, setBatchRunning] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  // KB 状态
  const [kbStatus, setKbStatus] = useState<KBStatus | null>(null)
  const [kbOpen, setKbOpen] = useState(false)
  const [kbTicker, setKbTicker] = useState('')
  const [kbRecords, setKbRecords] = useState<KBRecord[]>([])
  const [kbLoading, setKbLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const [wl, st, hist, kb] = await Promise.all([
        apiFetch('/watchlist'),
        apiFetch('/status'),
        apiFetch('/history?limit=5'),
        reportApiFetch('/kb/status').catch(() => null),
      ])
      setWatchlist(wl.watchlist ?? [])
      setStatus(st)
      setHistory(hist.history ?? [])
      if (kb) setKbStatus(kb)
      setLoadErr(null)
    } catch (e) {
      setLoadErr(String(e))
    }
  }, [])

  const queryKB = useCallback(async (t?: string) => {
    setKbLoading(true)
    try {
      const q = t ? `?ticker=${encodeURIComponent(t)}` : ''
      const data = await reportApiFetch(`/kb/status${q}`)
      if (t) {
        setKbRecords(data.records ?? [])
      } else {
        setKbStatus(data)
      }
    } finally {
      setKbLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const addTicker = async () => {
    const t = newTicker.trim().toUpperCase()
    if (!t) return
    await apiFetch('/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: t }),
    })
    setNewTicker('')
    load()
  }

  const removeTicker = async (t: string) => {
    await apiFetch(`/watchlist/${encodeURIComponent(t)}`, { method: 'DELETE' })
    load()
  }

  const runOne = async (t: string) => {
    setRunningTicker(t)
    try { await apiFetch(`/run-now/${encodeURIComponent(t)}`, { method: 'POST' }) }
    finally { setRunningTicker(null); load() }
  }

  const runAll = async () => {
    setBatchRunning(true)
    try { await apiFetch('/run-now?sync=false', { method: 'POST' }) }
    finally { setBatchRunning(false); load() }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <Timer className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold">定时蒸馏调度器</h2>
            <p className="text-xs text-muted-foreground">每日自动抓取 Watchlist 研报并蒸馏入 KB 缓存</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-muted/50 transition-colors" title="刷新">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {loadErr && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" /> {loadErr}
          </div>
        )}

        {/* 调度器状态卡 */}
        {status && (
          <div className="rounded-xl border border-border/60 p-4 bg-muted/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className={`w-2 h-2 rounded-full ${status.running ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                {status.running ? '调度器运行中' : '调度器已停止'}
              </div>
              <button
                onClick={runAll}
                disabled={batchRunning}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {batchRunning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                {batchRunning ? '运行中…' : '立即运行全部'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>下次运行：<span className="text-foreground">{fmtDt(status.next_run)}</span></span>
              <span>上次运行：<span className="text-foreground">{fmtDt(status.last_run)}</span></span>
              {status.trigger && <span className="col-span-2">调度规则：<span className="font-mono text-foreground">{status.trigger}</span></span>}
            </div>
          </div>
        )}

        {/* 添加 Ticker */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Watchlist（{watchlist.length} 个）</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              placeholder="添加股票代码，如 600519"
              value={newTicker}
              onChange={e => setNewTicker(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTicker()}
              className="flex-1 px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={addTicker}
              disabled={!newTicker.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> 添加
            </button>
          </div>

          {/* Watchlist 列表 */}
          {watchlist.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Timer className="w-10 h-10 mx-auto opacity-20 mb-2" />
              <p>暂无股票，添加后每日自动蒸馏</p>
            </div>
          ) : (
            <div className="space-y-2">
              {watchlist.map(item => (
                <div key={item.ticker} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card hover:bg-muted/20 transition-colors">
                  <StatusDot status={item.last_status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono font-semibold">{item.ticker}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {item.last_run ? `上次：${fmtDt(item.last_run)} · ${item.last_status}` : '尚未运行'}
                    </div>
                  </div>
                  <button
                    onClick={() => runOne(item.ticker)}
                    disabled={runningTicker === item.ticker}
                    className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-primary transition-colors"
                    title="立即蒸馏"
                  >
                    {runningTicker === item.ticker
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => removeTicker(item.ticker)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="从 Watchlist 移除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 历史记录 */}
        {history.length > 0 && (
          <div>
            <button
              onClick={() => setHistoryOpen(o => !o)}
              className="flex items-center gap-2 text-sm font-semibold mb-2 hover:text-primary transition-colors"
            >
              {historyOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              最近批量记录（{history.length}）
            </button>
            {historyOpen && (
              <div className="space-y-2">
                {history.map(job => (
                  <div key={job.id} className="p-3 rounded-lg border border-border/60 bg-muted/20 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{fmtDt(job.started_at)}</span>
                      <span className="text-muted-foreground">{job.triggered_by}</span>
                    </div>
                    <div className="flex gap-3 text-muted-foreground">
                      <span>总计 <b className="text-foreground">{job.total}</b></span>
                      <span className="text-green-600">成功 {job.success}</span>
                      <span className="text-yellow-600">跳过 {job.skipped}</span>
                      {job.failed > 0 && <span className="text-red-500">失败 {job.failed}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 研报 KB 状态 */}
        <div>
          <button
            onClick={() => { setKbOpen(o => !o); if (!kbOpen) queryKB() }}
            className="flex items-center gap-2 text-sm font-semibold mb-2 hover:text-primary transition-colors"
          >
            <Database className="w-4 h-4" />
            研报知识库（KB）状态
            {kbStatus && <span className="text-xs font-normal text-muted-foreground ml-1">共 {kbStatus.total} 条</span>}
            {kbOpen ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
          </button>
          {kbOpen && (
            <div className="space-y-3">
              {/* 按 ticker 查询 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="输入代码查询具体记录…"
                  value={kbTicker}
                  onChange={e => setKbTicker(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && queryKB(kbTicker.trim().toUpperCase())}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-border/60 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={() => queryKB(kbTicker.trim().toUpperCase() || undefined)}
                  disabled={kbLoading}
                  className="px-3 py-1.5 rounded-lg border border-border/60 text-xs hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  {kbLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : '查询'}
                </button>
              </div>

              {/* 全局统计 */}
              {kbStatus && !kbTicker && (
                <div className="rounded-lg border border-border/60 p-3 bg-muted/20 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">全库统计</span>
                    <span className="text-muted-foreground">共 <b className="text-foreground">{kbStatus.total}</b> 条蒸馏记录</span>
                  </div>
                  {kbStatus.tickers && kbStatus.tickers.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {kbStatus.tickers.map(t => (
                        <button
                          key={t}
                          onClick={() => { setKbTicker(t); queryKB(t) }}
                          className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono hover:bg-primary/20 transition-colors"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ticker 详情 */}
              {kbRecords.length > 0 && (
                <div className="space-y-1">
                  {kbRecords.map((rec, i) => (
                    <div key={i} className="p-2 rounded-lg border border-border/40 bg-card text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate max-w-[60%]">{rec.title || '无标题'}</span>
                        <span className="text-muted-foreground shrink-0">{rec.report_date || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                        <span>{rec.institution || '—'}</span>
                        <span>质量 <b className={rec.quality_score >= 0.7 ? 'text-green-600' : 'text-amber-500'}>{(rec.quality_score * 100).toFixed(0)}%</b></span>
                        <span className="ml-auto">{fmtDt(rec.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
