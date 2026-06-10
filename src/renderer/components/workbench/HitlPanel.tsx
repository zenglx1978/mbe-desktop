/**
 * HitlPanel — 基金经理 HITL 决策层
 *
 * 工作流：
 *   report-to-plan 自动生成 AI 提案 → 基金经理在此面板审核
 *   → 批准（使用 AI 参数）/ 调整（覆盖止损/止盈 + 批注）/ 否决（附理由）
 *
 * 体现「AI 提案 + 人工确认」可追溯闭环。
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  UserCheck, RefreshCw, Clock, CheckCircle2, XCircle,
  Edit3, AlertCircle, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, BarChart3, MessageSquare,
  Filter,
} from 'lucide-react'
import { API_BASE, authHeaders } from '@/lib/api-client'

// ─── 类型 ──────────────────────────────────────────────────────────────────────

type ProposalStatus = 'pending' | 'approved' | 'adjusted' | 'rejected'

interface Proposal {
  id: string
  ticker: string
  source: string
  ai_action: 'buy' | 'sell' | 'hold'
  ai_stop_loss_pct: number
  ai_take_profit_pct: number
  ai_confidence: number | null
  ai_thesis: string | null
  ai_reasoning: Record<string, unknown> | null
  ai_tier: string | null
  status: ProposalStatus
  reviewer: string | null
  reviewed_at: string | null
  human_stop_loss_pct: number | null
  human_take_profit_pct: number | null
  human_annotation: string | null
  final_stop_loss_pct: number | null
  final_take_profit_pct: number | null
  created_at: string
}

interface Stats {
  total: number
  pending: number
  approved: number
  adjusted: number
  rejected: number
  approval_rate: number | null
  adjustment_rate: number | null
  rejection_rate: number | null
}

// ─── 辅助 ──────────────────────────────────────────────────────────────────────

const BASE = `${API_BASE}/api/invest/hitl`

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string> ?? {}) },
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(err.detail ?? resp.statusText)
  }
  return resp.json()
}

function pct(v: number | null, decimals = 1) {
  if (v == null) return '—'
  return `${(Math.abs(v) * 100).toFixed(decimals)}%`
}

function fmtDt(s?: string | null) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return s.slice(0, 16)
  }
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  const cfg = {
    pending:  { label: '待审核', cls: 'bg-amber-500/10 text-amber-500', icon: <Clock className="w-3 h-3" /> },
    approved: { label: '已批准', cls: 'bg-green-500/10 text-green-600', icon: <CheckCircle2 className="w-3 h-3" /> },
    adjusted: { label: '已调整', cls: 'bg-blue-500/10 text-blue-600', icon: <Edit3 className="w-3 h-3" /> },
    rejected: { label: '已否决', cls: 'bg-red-500/10 text-red-500', icon: <XCircle className="w-3 h-3" /> },
  }[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function ActionBadge({ action }: { action: string }) {
  const cls = action === 'buy' ? 'text-green-600' : action === 'sell' ? 'text-red-500' : 'text-muted-foreground'
  const icon = action === 'buy' ? <TrendingUp className="w-3.5 h-3.5" /> : action === 'sell' ? <TrendingDown className="w-3.5 h-3.5" /> : <BarChart3 className="w-3.5 h-3.5" />
  return <span className={`inline-flex items-center gap-1 font-semibold uppercase text-xs ${cls}`}>{icon}{action}</span>
}

// ─── 审核对话框 ─────────────────────────────────────────────────────────────────

interface ReviewDialogProps {
  proposal: Proposal
  onClose: () => void
  onDone: () => void
}

function ReviewDialog({ proposal, onClose, onDone }: ReviewDialogProps) {
  const [mode, setMode] = useState<'approve' | 'adjust' | 'reject'>('approve')
  const [slOverride, setSlOverride] = useState(String(Math.abs(proposal.ai_stop_loss_pct) * 100))
  const [tpOverride, setTpOverride] = useState(String(proposal.ai_take_profit_pct * 100))
  const [annotation, setAnnotation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const submit = async () => {
    setLoading(true); setError(null)
    try {
      if (mode === 'approve') {
        await apiFetch(`/proposals/${proposal.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ annotation: annotation || null }),
        })
      } else if (mode === 'adjust') {
        const sl = -Math.abs(parseFloat(slOverride)) / 100
        const tp = Math.abs(parseFloat(tpOverride)) / 100
        await apiFetch(`/proposals/${proposal.id}/adjust`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stop_loss_pct: sl, take_profit_pct: tp, annotation: annotation || null }),
        })
      } else {
        if (!annotation.trim()) { setError('否决时必须填写理由'); setLoading(false); return }
        await apiFetch(`/proposals/${proposal.id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: annotation }),
        })
      }
      onDone()
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-card rounded-2xl border border-border/60 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">审核 AI 提案</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-mono font-semibold">{proposal.ticker}</span>
              &nbsp;·&nbsp;{fmtDt(proposal.created_at)} 生成
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* AI 参数摘要 */}
          <div className="rounded-xl border border-border/60 p-3 bg-muted/20 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">AI 建议参数</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center">
                <p className="text-muted-foreground text-[11px]">操作</p>
                <ActionBadge action={proposal.ai_action} />
              </div>
              <div className="text-center">
                <p className="text-muted-foreground text-[11px]">止损</p>
                <span className="font-semibold text-red-500">{pct(proposal.ai_stop_loss_pct)}</span>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground text-[11px]">止盈</p>
                <span className="font-semibold text-green-600">{pct(proposal.ai_take_profit_pct)}</span>
              </div>
            </div>
            {proposal.ai_confidence != null && (
              <p className="text-xs text-muted-foreground">
                置信度：<span className="font-medium text-foreground">{(proposal.ai_confidence * 100).toFixed(0)}%</span>
                {proposal.ai_tier && <>&nbsp;·&nbsp;推荐档位 <span className="font-mono">{proposal.ai_tier}</span></>}
              </p>
            )}
          </div>

          {/* AI 投资论点 */}
          {proposal.ai_thesis && (
            <div className="rounded-xl border border-border/60 p-3 bg-primary/5 text-xs text-foreground leading-relaxed">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">AI 投资论点</p>
              {proposal.ai_thesis}
            </div>
          )}

          {/* 展开动态风控详情 */}
          {proposal.ai_reasoning && (
            <button
              onClick={() => setDetailOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {detailOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {detailOpen ? '收起' : '展开'} 动态风控计算详情
            </button>
          )}
          {detailOpen && proposal.ai_reasoning && (
            <pre className="text-[11px] bg-muted/30 p-3 rounded-lg overflow-x-auto text-muted-foreground max-h-32">
              {JSON.stringify(proposal.ai_reasoning, null, 2)}
            </pre>
          )}

          {/* 审核模式选择 */}
          <div>
            <p className="text-xs font-semibold mb-2">审核决定</p>
            <div className="grid grid-cols-3 gap-2">
              {(['approve', 'adjust', 'reject'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                    mode === m
                      ? m === 'reject' ? 'bg-red-500/10 border-red-500/40 text-red-500'
                        : m === 'adjust' ? 'bg-blue-500/10 border-blue-500/40 text-blue-600'
                        : 'bg-green-500/10 border-green-500/40 text-green-600'
                      : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  {m === 'approve' ? '✓ 批准' : m === 'adjust' ? '✎ 调整' : '✕ 否决'}
                </button>
              ))}
            </div>
          </div>

          {/* 调整参数 */}
          {mode === 'adjust' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">止损 % *</label>
                <input
                  type="number" step="0.1" min="0.5" max="30"
                  value={slOverride}
                  onChange={e => setSlOverride(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">止盈 % *</label>
                <input
                  type="number" step="0.5" min="2" max="100"
                  value={tpOverride}
                  onChange={e => setTpOverride(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}

          {/* 批注/理由 */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {mode === 'reject' ? '否决理由 *' : '批注（可选）'}
            </label>
            <textarea
              rows={3}
              value={annotation}
              onChange={e => setAnnotation(e.target.value)}
              placeholder={mode === 'reject' ? '请填写否决理由…' : '添加批注、调整依据或补充说明…'}
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-border/60 text-sm hover:bg-muted/40 transition-colors">
              取消
            </button>
            <button
              onClick={submit}
              disabled={loading}
              className={`flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2 ${
                mode === 'reject' ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              {loading ? '提交中…' : mode === 'approve' ? '确认批准' : mode === 'adjust' ? '确认调整' : '确认否决'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 提案卡片 ───────────────────────────────────────────────────────────────────

function ProposalCard({ proposal, onReview, onRefresh }: { proposal: Proposal; onReview: () => void; onRefresh: () => void }) {
  const isPending = proposal.status === 'pending'
  const finalSL = proposal.final_stop_loss_pct ?? proposal.ai_stop_loss_pct
  const finalTP = proposal.final_take_profit_pct ?? proposal.ai_take_profit_pct

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-colors ${isPending ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/60 bg-card'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-sm ${isPending ? 'bg-amber-500/15 text-amber-600' : 'bg-muted/50 text-muted-foreground'}`}>
            {proposal.ticker.slice(0, 4)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{proposal.ticker}</span>
              <ActionBadge action={proposal.ai_action} />
              <StatusBadge status={proposal.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fmtDt(proposal.created_at)} 生成
              {proposal.reviewed_at && ` · ${fmtDt(proposal.reviewed_at)} 审核`}
            </p>
          </div>
        </div>
        {isPending && (
          <button
            onClick={onReview}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5" /> 审核
          </button>
        )}
      </div>

      {/* 参数对比（已审核时显示 AI vs 最终） */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">AI 止损</p>
          <p className="font-semibold text-red-500">{pct(proposal.ai_stop_loss_pct)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">AI 止盈</p>
          <p className="font-semibold text-green-600">{pct(proposal.ai_take_profit_pct)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">最终止损</p>
          <p className={`font-semibold ${proposal.status === 'adjusted' ? 'text-blue-600' : 'text-red-500'}`}>{pct(finalSL)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">最终止盈</p>
          <p className={`font-semibold ${proposal.status === 'adjusted' ? 'text-blue-600' : 'text-green-600'}`}>{pct(finalTP)}</p>
        </div>
      </div>

      {/* 投资论点摘要 */}
      {proposal.ai_thesis && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{proposal.ai_thesis}</p>
      )}

      {/* 批注 */}
      {proposal.human_annotation && (
        <div className="flex items-start gap-2 text-xs bg-muted/30 rounded-lg p-2.5">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <span className="text-muted-foreground">{proposal.human_annotation}</span>
        </div>
      )}
    </div>
  )
}

// ─── 主面板 ────────────────────────────────────────────────────────────────────

export default function HitlPanel() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<Proposal | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const q = statusFilter ? `?status=${statusFilter}` : ''
      const [data, st] = await Promise.all([
        apiFetch<{ total: number; proposals: Proposal[] }>(`/proposals${q}`),
        apiFetch<Stats>('/stats'),
      ])
      setProposals(data.proposals)
      setStats(st)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <UserCheck className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold">基金经理决策台</h2>
            <p className="text-xs text-muted-foreground">AI 提案 → 人工批准 / 调整 / 否决</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-muted/50 transition-colors" title="刷新">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* 汇总统计 */}
        {stats && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '待审核', value: stats.pending, cls: 'text-amber-500' },
              { label: '已批准', value: stats.approved, cls: 'text-green-600' },
              { label: '已调整', value: stats.adjusted, cls: 'text-blue-600' },
              { label: '已否决', value: stats.rejected, cls: 'text-red-500' },
            ].map(({ label, value, cls }) => (
              <button
                key={label}
                onClick={() => setStatusFilter(label === '待审核' ? 'pending' : label === '已批准' ? 'approved' : label === '已调整' ? 'adjusted' : 'rejected')}
                className="rounded-xl border border-border/60 p-3 text-center hover:bg-muted/30 transition-colors"
              >
                <p className={`text-2xl font-bold ${cls}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </button>
            ))}
          </div>
        )}

        {/* 批准率摘要 */}
        {stats && stats.approval_rate != null && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
            <span>批准率 <span className="font-semibold text-green-600">{(stats.approval_rate * 100).toFixed(0)}%</span></span>
            <span>调整率 <span className="font-semibold text-blue-600">{((stats.adjustment_rate ?? 0) * 100).toFixed(0)}%</span></span>
            <span>否决率 <span className="font-semibold text-red-500">{((stats.rejection_rate ?? 0) * 100).toFixed(0)}%</span></span>
          </div>
        )}

        {/* 过滤器 */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          {[
            { v: '' as const, label: '全部' },
            { v: 'pending' as const, label: '待审核' },
            { v: 'approved' as const, label: '已批准' },
            { v: 'adjusted' as const, label: '已调整' },
            { v: 'rejected' as const, label: '已否决' },
          ].map(({ v, label }) => (
            <button
              key={v || 'all'}
              onClick={() => setStatusFilter(v)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${statusFilter === v ? 'bg-primary text-primary-foreground' : 'border border-border/60 hover:bg-muted/40 text-muted-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 错误 */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* 提案列表 */}
        {proposals.length === 0 && !loading && !error && (
          <div className="text-center py-16 text-muted-foreground">
            <UserCheck className="w-12 h-12 mx-auto opacity-20 mb-3" />
            <p className="text-sm">暂无提案</p>
            <p className="text-xs mt-1 opacity-70">
              执行"研报→交易计划"后，AI 提案会自动出现在此处等待审核
            </p>
          </div>
        )}

        <div className="space-y-3">
          {proposals.map(p => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onReview={() => setReviewing(p)}
              onRefresh={load}
            />
          ))}
        </div>
      </div>

      {/* 审核对话框 */}
      {reviewing && (
        <ReviewDialog
          proposal={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => { setReviewing(null); load() }}
        />
      )}
    </div>
  )
}
