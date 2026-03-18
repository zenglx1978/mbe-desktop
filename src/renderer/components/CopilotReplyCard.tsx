// CopilotReplyCard — 电商 CS Copilot 回复卡片
// AI 生成回复 → 展示卡片 → 用户点击「复制」→ 切到千牛粘贴发送
// 支持单条和批量模式

import { useState, useCallback, useEffect } from 'react'
import {
  Copy, Check, Edit3, SkipForward, AlertTriangle,
  ChevronDown, ChevronUp, ClipboardCheck, Users,
} from 'lucide-react'

const api = (window as any).electronAPI

// ────────────────────── 类型 ──────────────────────

export interface CopilotReplyData {
  id: string
  customerName: string
  customerQuery: string
  aiReply: string
  confidence: number
  sourceApp: string
  status: 'pending' | 'copied' | 'sent' | 'skipped' | 'escalated'
  createdAt: string
  copiedAt?: string
}

// ────────────────────── 单条回复卡片 ──────────────────────

export function CopilotReplyCard({
  reply,
  onStatusChange,
  compact = false,
}: {
  reply: CopilotReplyData
  onStatusChange?: (id: string, status: CopilotReplyData['status']) => void
  compact?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(reply.aiReply)
  const [justCopied, setJustCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const text = editing ? editText : reply.aiReply
    if (api?.ecommerceCs?.copyReply) {
      await api.ecommerceCs.copyReply(reply.id)
    } else if (api?.copilot?.clipboard?.write) {
      await api.copilot.clipboard.write(text)
    } else {
      await navigator.clipboard.writeText(text)
    }
    setJustCopied(true)
    onStatusChange?.(reply.id, 'copied')
    setTimeout(() => setJustCopied(false), 2000)
  }, [reply.id, reply.aiReply, editing, editText, onStatusChange])

  const handleSkip = useCallback(() => {
    if (api?.ecommerceCs?.updateStatus) {
      api.ecommerceCs.updateStatus(reply.id, 'skipped')
    }
    onStatusChange?.(reply.id, 'skipped')
  }, [reply.id, onStatusChange])

  const handleEscalate = useCallback(() => {
    if (api?.ecommerceCs?.updateStatus) {
      api.ecommerceCs.updateStatus(reply.id, 'escalated')
    }
    onStatusChange?.(reply.id, 'escalated')
  }, [reply.id, onStatusChange])

  const handleMarkSent = useCallback(() => {
    if (api?.ecommerceCs?.updateStatus) {
      api.ecommerceCs.updateStatus(reply.id, 'sent')
    }
    onStatusChange?.(reply.id, 'sent')
  }, [reply.id, onStatusChange])

  const confidenceColor = reply.confidence >= 0.8
    ? 'text-emerald-600 dark:text-emerald-400'
    : reply.confidence >= 0.5
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400'

  const statusBg = reply.status === 'copied'
    ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30'
    : reply.status === 'sent'
      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30'
      : reply.status === 'skipped' || reply.status === 'escalated'
        ? 'border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-950/30 opacity-60'
        : 'border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/30'

  if (reply.status === 'sent' || reply.status === 'skipped' || reply.status === 'escalated') {
    if (compact) return null
    return (
      <div className={`rounded-lg border p-2 text-xs ${statusBg}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>{reply.status === 'sent' ? '✓ 已发送' : reply.status === 'escalated' ? '⚡ 已转人工' : '→ 已跳过'}</span>
          <span>· {reply.customerName}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border ${statusBg} p-3 transition-all`}>
      {/* 头部：客户信息 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-violet-200 dark:bg-violet-800 flex items-center justify-center text-[10px] font-bold text-violet-700 dark:text-violet-300">
            {reply.customerName.charAt(0)}
          </div>
          <div>
            <span className="text-sm font-medium">{reply.customerName}</span>
            <span className="text-[10px] text-muted-foreground ml-2">
              {APP_LABELS[reply.sourceApp] ?? reply.sourceApp}
            </span>
          </div>
        </div>
        <span className={`text-[10px] ${confidenceColor}`}>
          {Math.round(reply.confidence * 100)}%
        </span>
      </div>

      {/* 客户问题 */}
      {!compact && (
        <div className="mb-2 px-2 py-1.5 rounded bg-black/5 dark:bg-white/5 text-xs text-muted-foreground">
          <span className="text-[10px] font-medium text-muted-foreground/60">客户:</span>{' '}
          {reply.customerQuery.length > 120
            ? reply.customerQuery.slice(0, 120) + '...'
            : reply.customerQuery}
        </div>
      )}

      {/* AI 回复 */}
      <div className="mb-2">
        {editing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full rounded border border-violet-300 dark:border-violet-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-violet-500"
            rows={3}
            autoFocus
          />
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {reply.aiReply}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-all ${
            justCopied || reply.status === 'copied'
              ? 'bg-emerald-500 text-white'
              : 'bg-violet-600 text-white hover:bg-violet-700'
          }`}
        >
          {justCopied || reply.status === 'copied'
            ? <><ClipboardCheck className="w-3.5 h-3.5" /> 已复制，去粘贴</>
            : <><Copy className="w-3.5 h-3.5" /> 复制回复</>}
        </button>

        {reply.status === 'copied' && (
          <button
            onClick={handleMarkSent}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/60 transition-colors"
          >
            <Check className="w-3 h-3" /> 已发送
          </button>
        )}

        <button
          onClick={() => {
            if (editing) setEditText(reply.aiReply)
            setEditing(!editing)
          }}
          className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md bg-secondary/50 hover:bg-secondary/80 text-muted-foreground transition-colors"
        >
          <Edit3 className="w-3 h-3" /> {editing ? '取消' : '编辑'}
        </button>

        <button
          onClick={handleSkip}
          className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md bg-secondary/50 hover:bg-secondary/80 text-muted-foreground transition-colors"
          title="跳过此回复"
        >
          <SkipForward className="w-3 h-3" />
        </button>

        <button
          onClick={handleEscalate}
          className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors"
          title="转人工处理"
        >
          <AlertTriangle className="w-3 h-3" /> 转人工
        </button>
      </div>
    </div>
  )
}

// ────────────────────── 批量 Copilot 面板 ──────────────────────

export function BatchCopilotPanel() {
  const [replies, setReplies] = useState<CopilotReplyData[]>([])
  const [expanded, setExpanded] = useState(true)
  const [stats, setStats] = useState({ pending: 0, copied: 0, sent: 0, skipped: 0, escalated: 0 })

  useEffect(() => {
    loadReplies()
    const cleanup = api?.ecommerceCs?.onNewReply?.((reply: CopilotReplyData) => {
      setReplies(prev => [...prev, reply])
    })
    const cleanupUpdate = api?.ecommerceCs?.onReplyUpdated?.((updated: CopilotReplyData) => {
      setReplies(prev => prev.map(r => r.id === updated.id ? updated : r))
    })
    return () => { cleanup?.(); cleanupUpdate?.() }
  }, [])

  useEffect(() => {
    const s = { pending: 0, copied: 0, sent: 0, skipped: 0, escalated: 0 }
    for (const r of replies) {
      s[r.status]++
    }
    setStats(s)
  }, [replies])

  const loadReplies = async () => {
    if (!api?.ecommerceCs?.pendingReplies) return
    const list = await api.ecommerceCs.pendingReplies()
    setReplies(list)
  }

  const handleStatusChange = (id: string, status: CopilotReplyData['status']) => {
    setReplies(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  const pending = replies.filter(r => r.status === 'pending' || r.status === 'copied')

  if (pending.length === 0) return null

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/20 overflow-hidden">
      {/* 头部 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-violet-100/50 dark:hover:bg-violet-900/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
            待回复客户 ({pending.length})
          </span>
          {stats.copied > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300">
              {stats.copied} 待粘贴
            </span>
          )}
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-violet-400" />
          : <ChevronDown className="w-4 h-4 text-violet-400" />}
      </button>

      {/* 回复列表 */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {pending.map(reply => (
            <CopilotReplyCard
              key={reply.id}
              reply={reply}
              onStatusChange={handleStatusChange}
              compact={pending.length > 5}
            />
          ))}
        </div>
      )}

      {/* 底部统计 */}
      {expanded && (stats.sent > 0 || stats.skipped > 0) && (
        <div className="px-4 py-2 border-t border-violet-200/50 dark:border-violet-800/50 flex items-center gap-3 text-[10px] text-muted-foreground">
          {stats.sent > 0 && <span>✓ 已发送 {stats.sent}</span>}
          {stats.skipped > 0 && <span>→ 已跳过 {stats.skipped}</span>}
          {stats.escalated > 0 && <span>⚡ 已转人工 {stats.escalated}</span>}
        </div>
      )}
    </div>
  )
}

// ────────────────────── LocalAction 卡片集成 ──────────────────────

export function CopilotReplyActionCard({
  text,
  customerName,
  customerQuery,
  confidence,
  sourceApp,
}: {
  text: string
  customerName?: string
  customerQuery?: string
  confidence?: number
  sourceApp?: string
}) {
  const reply: CopilotReplyData = {
    id: `local_${Date.now()}`,
    customerName: customerName ?? '客户',
    customerQuery: customerQuery ?? '',
    aiReply: text,
    confidence: confidence ?? 0.8,
    sourceApp: sourceApp ?? 'unknown',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  return <CopilotReplyCard reply={reply} />
}

// ────────────────────── 常量 ──────────────────────

const APP_LABELS: Record<string, string> = {
  qianniu: '千牛',
  wangwang: '旺旺',
  feige: '抖店飞鸽',
  pinduoduo_seller: '拼多多',
  xiaohongshu_seller: '小红书',
  jushuitan: '聚水潭',
  wangdiantong: '旺店通',
  guanyiyun: '管易云',
}
