/**
 * Expert 协作面板 — 多 Expert 编排实时可视化（Desktop 增强版）
 *
 * 相对 mbe-finance 的基础版增强：
 * 1. WebSocket 实时推送状态（/ws/{agent}/orchestration）
 * 2. Expert 头像 + 角色标签
 * 3. token 消耗 + 知识源命中统计
 * 4. parallel 并排 / sequential 流水线 / fan_out 竞争三种布局
 * 5. 结果归属色条（每段回答标注产出 Expert）
 *
 * 遵循 Visualization Strategy 5.4 状态映射
 */

import { useState, useEffect, useRef } from 'react'
import type { ExpertStatus, OrchestrationInfo } from '../types'

interface ExpertOrchestrationPanelProps {
  info: OrchestrationInfo
  /** WebSocket URL，传入后自动接收实时更新 */
  wsUrl?: string
  className?: string
}

const MODE_CONFIG: Record<string, { label: string; icon: string; desc: string }> = {
  parallel: { label: '并行协作', icon: '⚡', desc: '多位专家同时分析' },
  sequential: { label: '流水线', icon: '➡️', desc: '按步骤依次处理' },
  fan_out: { label: '竞争择优', icon: '🎯', desc: '多方案择优采纳' },
  single: { label: '单专家', icon: '👤', desc: '单一专家处理' },
}

const STATUS_STYLE: Record<string, {
  dot: string
  ring: string
  text: string
  label: string
  bg: string
}> = {
  idle: {
    dot: 'bg-gray-300 dark:bg-gray-600',
    ring: 'ring-gray-200 dark:ring-gray-700',
    text: 'text-gray-400',
    label: '排队',
    bg: 'bg-gray-50 dark:bg-gray-800/30',
  },
  working: {
    dot: 'bg-blue-500 animate-pulse',
    ring: 'ring-blue-200 dark:ring-blue-800 ring-2',
    text: 'text-blue-600 dark:text-blue-400',
    label: '分析中',
    bg: 'bg-blue-50/50 dark:bg-blue-900/10',
  },
  done: {
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-200 dark:ring-emerald-800',
    text: 'text-emerald-600 dark:text-emerald-400',
    label: '完成',
    bg: 'bg-emerald-50/50 dark:bg-emerald-900/10',
  },
  error: {
    dot: 'bg-red-500',
    ring: 'ring-red-200 dark:ring-red-800',
    text: 'text-red-600 dark:text-red-400',
    label: '失败',
    bg: 'bg-red-50/50 dark:bg-red-900/10',
  },
}

const EXPERT_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4']

function formatMs(ms?: number): string {
  if (!ms) return ''
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function formatTokens(n?: number): string {
  if (!n) return ''
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`
}

function ExpertCard({ expert, index }: { expert: ExpertStatus; index: number }) {
  const style = STATUS_STYLE[expert.status] || STATUS_STYLE.idle
  const color = EXPERT_COLORS[index % EXPERT_COLORS.length]

  return (
    <div className={`relative flex items-center gap-3 rounded-xl border border-gray-100 dark:border-[#3c3c3c] px-4 py-3 min-w-[160px] transition-all duration-300 ${style.bg}`}>
      {/* 左侧归属色条 */}
      <div
        className="absolute left-0 top-2 bottom-2 w-1 rounded-full"
        style={{ backgroundColor: color }}
      />

      {/* 头像 */}
      <div className={`shrink-0 flex items-center justify-center h-9 w-9 rounded-full bg-gray-100 dark:bg-[#333] ${style.ring} transition-all`}>
        <span className="text-sm">👤</span>
      </div>

      {/* 信息 */}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-gray-700 dark:text-gray-300 truncate">
          {expert.name}
        </p>
        {expert.role && (
          <p className="text-[11px] text-gray-400 truncate">{expert.role}</p>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`} />
          <span className={`text-[11px] ${style.text}`}>{style.label}</span>
          {expert.status === 'done' && expert.elapsed_ms != null && (
            <span className="text-[11px] tabular-nums text-gray-400 ml-1">{formatMs(expert.elapsed_ms)}</span>
          )}
        </div>

        {/* token + 知识源统计 */}
        {(expert.token_used || expert.kb_sources_hit) && (
          <div className="flex items-center gap-2 mt-1 text-[9px] text-gray-400">
            {expert.token_used != null && (
              <span>🪙 {formatTokens(expert.token_used)} tokens</span>
            )}
            {expert.kb_sources_hit != null && (
              <span>📚 {expert.kb_sources_hit} 知识源</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function ExpertOrchestrationPanel({
  info: initialInfo,
  wsUrl,
  className = '',
}: ExpertOrchestrationPanelProps) {
  const [info, setInfo] = useState<OrchestrationInfo>(initialInfo)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => setInfo(initialInfo), [initialInfo])

  // WebSocket 实时更新（带自动重连）
  useEffect(() => {
    if (!wsUrl) return

    let retries = 0
    const MAX_RETRIES = 3
    let timer: ReturnType<typeof setTimeout> | null = null
    let disposed = false

    function connect() {
      if (disposed) return
      const ws = new WebSocket(wsUrl!)
      wsRef.current = ws

      ws.onopen = () => { retries = 0 }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'orchestration_update' && data.payload) {
            setInfo(prev => ({
              ...prev,
              ...data.payload,
              experts: data.payload.experts || prev.experts,
            }))
          }
        } catch {}
      }

      ws.onerror = () => ws.close()

      ws.onclose = () => {
        wsRef.current = null
        if (!disposed && retries < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, retries), 8000)
          retries++
          timer = setTimeout(connect, delay)
        }
      }
    }

    connect()
    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [wsUrl])

  if (!info || !info.experts || info.experts.length <= 1) return null

  const mode = MODE_CONFIG[info.mode] || MODE_CONFIG.parallel
  const allDone = info.experts.every(e => e.status === 'done' || e.status === 'error')
  const workingCount = info.experts.filter(e => e.status === 'working').length

  const statusSummary = allDone
    ? `AI 专家协作完成，共 ${info.experts.length} 位专家${info.total_elapsed_ms ? `，总耗时 ${formatMs(info.total_elapsed_ms)}` : ''}`
    : `AI 专家协作中，${workingCount} 位分析中`

  return (
    <div
      className={`rounded-xl border px-5 py-4 mb-3 transition-all duration-500 ${className} ${
        allDone
          ? 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-900/5'
          : 'border-blue-200 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-900/5'
      }`}
      role="status"
      aria-live="polite"
      aria-label={statusSummary}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">{mode.icon}</span>
          <div>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              AI 专家{allDone ? '协作完成' : '协作中'}
            </span>
            <span className="ml-2 text-[11px] text-gray-400">{mode.desc}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          {workingCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" aria-hidden="true" />
              {workingCount} 位分析中
            </span>
          )}
          {info.total_elapsed_ms != null && (
            <span className="tabular-nums">总耗时: {formatMs(info.total_elapsed_ms)}</span>
          )}
        </div>
      </div>

      {/* Expert Cards: parallel 并排, sequential 流水线 */}
      {info.mode === 'sequential' ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {info.experts.map((expert, i) => (
            <div key={expert.id} className="flex items-center shrink-0">
              <ExpertCard expert={expert} index={i} />
              {i < info.experts.length - 1 && (
                <div className="flex items-center mx-1">
                  <div className={`h-px w-8 ${
                    expert.status === 'done' ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-[#3c3c3c]'
                  }`} />
                  <div className={`h-0 w-0 border-t-[4px] border-b-[4px] border-l-[6px] border-transparent ${
                    expert.status === 'done' ? 'border-l-emerald-400' : 'border-l-gray-200 dark:border-l-[#3c3c3c]'
                  }`} />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : info.mode === 'fan_out' ? (
        <div className="space-y-2">
          {info.experts.map((expert, i) => (
            <div key={expert.id} className="flex items-center gap-2">
              <ExpertCard expert={expert} index={i} />
              {expert.status === 'done' && (
                <span className="text-[11px] text-emerald-500 font-medium shrink-0">
                  {i === 0 ? '✦ 最优' : `#${i + 1}`}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {info.experts.map((expert, i) => (
            <ExpertCard key={expert.id} expert={expert} index={i} />
          ))}
        </div>
      )}

      {/* 流水线进度指示器 */}
      {info.mode === 'sequential' && (
        <div className="mt-3 flex items-center gap-1">
          {info.experts.map((expert, i) => {
            return (
              <div key={expert.id} className="flex items-center flex-1">
                <div className={`h-1.5 flex-1 rounded-full ${
                  expert.status === 'done' ? 'bg-emerald-400'
                    : expert.status === 'working' ? 'bg-blue-400 animate-pulse'
                    : 'bg-gray-200 dark:bg-[#3c3c3c]'
                }`} />
                {i < info.experts.length - 1 && <div className="w-1" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * 从消息中提取编排信息
 */
export function extractOrchestration(msg: Record<string, any>): OrchestrationInfo | null {
  if (msg.orchestration) return msg.orchestration as OrchestrationInfo
  if (msg.experts && Array.isArray(msg.experts) && msg.experts.length > 1) {
    return {
      mode: msg.orchestration_mode || 'parallel',
      experts: msg.experts.map((e: any) => ({
        id: e.id || e.expert_id,
        name: e.name || e.expert_name || e.id,
        role: e.role,
        status: e.status || 'done',
        elapsed_ms: e.elapsed_ms,
        token_used: e.token_used,
        kb_sources_hit: e.kb_sources_hit,
      })),
      total_elapsed_ms: msg.total_elapsed_ms,
    }
  }
  return null
}
