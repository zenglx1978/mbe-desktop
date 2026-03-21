/**
 * WorkflowOS 水平时间线 — 替代步骤卡片的工作流可视化
 *
 * 每个步骤显示：Expert 名称 + 耗时 + token 消耗 + 知识源命中
 * 步骤间用连线和箭头连接，进行中的步骤有脉冲动画。
 *
 * 参考 Visualization Strategy 2.2C "WorkflowOS 时间线升级"
 */

import type { WorkflowTimeline, WorkflowStep } from '../types'

interface OrchestrationTimelineProps {
  timeline: WorkflowTimeline
  className?: string
  compact?: boolean
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; animate?: string }> = {
  pending: { color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', icon: '○' },
  running: { color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: '◉', animate: 'animate-pulse' },
  done: { color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30', icon: '✓' },
  error: { color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', icon: '✗' },
  skipped: { color: 'text-gray-300', bg: 'bg-gray-50 dark:bg-gray-800/50', icon: '—' },
}

function formatMs(ms?: number): string {
  if (!ms) return ''
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function StepNode({ step, isLast, compact }: { step: WorkflowStep; isLast: boolean; compact: boolean }) {
  const cfg = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending

  return (
    <div className="flex items-center shrink-0">
      <div className={`relative flex flex-col items-center ${compact ? 'min-w-[100px]' : 'min-w-[140px]'}`}>
        {/* 节点圆 */}
        <div className={`flex items-center justify-center h-8 w-8 rounded-full ${cfg.bg} ${cfg.animate || ''} transition-all`}>
          <span className={`text-sm font-bold ${cfg.color}`}>{cfg.icon}</span>
        </div>

        {/* 信息 */}
        <div className="mt-2 text-center">
          <p className={`text-[11px] font-medium ${cfg.color} truncate max-w-[120px]`}>
            {step.expert_name}
          </p>
          {step.elapsed_ms != null && step.status === 'done' && (
            <p className="text-[10px] tabular-nums text-gray-400 mt-0.5">{formatMs(step.elapsed_ms)}</p>
          )}
          {step.status === 'running' && (
            <p className="text-[10px] text-blue-500 mt-0.5">处理中...</p>
          )}
        </div>

        {/* 详细统计（非紧凑模式） */}
        {!compact && (step.token_used || step.kb_sources_hit) && (
          <div className="mt-1 flex items-center gap-2 text-[9px] text-gray-400">
            {step.token_used != null && <span>🪙 {step.token_used}</span>}
            {step.kb_sources_hit != null && <span>📚 {step.kb_sources_hit}</span>}
          </div>
        )}

        {/* 输出摘要 */}
        {!compact && step.output_summary && (
          <p className="mt-1 text-[9px] text-gray-400 max-w-[130px] truncate" title={step.output_summary}>
            {step.output_summary}
          </p>
        )}
      </div>

      {/* 连线 */}
      {!isLast && (
        <div className="flex items-center mx-1 -mt-8">
          <div className={`h-px w-10 ${
            step.status === 'done' ? 'bg-emerald-400' :
            step.status === 'running' ? 'bg-blue-300 animate-pulse' :
            'bg-gray-200 dark:bg-[#3c3c3c]'
          }`} />
          <div className={`h-0 w-0 border-t-[3px] border-b-[3px] border-l-[5px] border-transparent ${
            step.status === 'done' ? 'border-l-emerald-400' :
            step.status === 'running' ? 'border-l-blue-300' :
            'border-l-gray-200 dark:border-l-[#3c3c3c]'
          }`} />
        </div>
      )}
    </div>
  )
}

export function OrchestrationTimeline({ timeline, className = '', compact = false }: OrchestrationTimelineProps) {
  const doneCount = timeline.steps.filter(s => s.status === 'done').length
  const totalCount = timeline.steps.length
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  return (
    <div className={`rounded-xl border border-gray-100 dark:border-[#3c3c3c] bg-white dark:bg-[#1e1e1e] p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔄</span>
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {timeline.workflow_name}
            </p>
            <p className="text-[10px] text-gray-400">{timeline.trigger_time}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-gray-400">{doneCount}/{totalCount} 步完成</span>
          {timeline.total_elapsed_ms != null && (
            <span className="tabular-nums text-gray-400">总耗时: {formatMs(timeline.total_elapsed_ms)}</span>
          )}
        </div>
      </div>

      {/* 整体进度条 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-[10px] tabular-nums text-gray-500 shrink-0">{progressPct}%</span>
      </div>

      {/* 时间线 */}
      <div className="flex items-start overflow-x-auto pb-2">
        {/* 触发节点 */}
        <div className="flex items-center shrink-0 mr-2">
          <div className="flex flex-col items-center min-w-[60px]">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-800 dark:bg-gray-200">
              <span className="text-sm text-white dark:text-gray-800">▶</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">触发</p>
          </div>
          <div className="flex items-center mx-1 -mt-8">
            <div className="h-px w-6 bg-gray-300 dark:bg-gray-600" />
            <div className="h-0 w-0 border-t-[3px] border-b-[3px] border-l-[5px] border-transparent border-l-gray-300 dark:border-l-gray-600" />
          </div>
        </div>

        {/* 步骤节点 */}
        {timeline.steps.map((step, i) => (
          <StepNode
            key={step.id}
            step={step}
            isLast={i === timeline.steps.length - 1}
            compact={compact}
          />
        ))}
      </div>

      {/* 降级纯文本版（无障碍） */}
      <div className="sr-only" role="list" aria-label={`工作流 ${timeline.workflow_name}`}>
        {timeline.steps.map((step, i) => (
          <div key={step.id} role="listitem">
            步骤 {i + 1}: {step.expert_name} — {step.status}
            {step.elapsed_ms ? ` (${formatMs(step.elapsed_ms)})` : ''}
          </div>
        ))}
      </div>
    </div>
  )
}
