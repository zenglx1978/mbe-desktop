/**
 * WorkflowOS 水平时间线 — 替代步骤卡片
 *
 * 三种轨道状态（Agent 追踪线）：
 *   done   → 实色绿色渐变
 *   active → 流动光带动画
 *   pending → 虚线
 *
 * 遵循 MBE_VISUALIZATION_STRATEGY.md §5.6 工作流时间线规范
 */

import type { WorkflowInstanceInfo, WorkflowSuggestion } from '@/stores/chat-store'

type StepStatus = 'completed' | 'running' | 'failed' | 'pending'

interface TimelineStep {
  id: string
  name: string
  status: StepStatus
  elapsed_ms?: number
}

function normalizeStatus(raw: string): StepStatus {
  if (raw === 'completed' || raw === 'done') return 'completed'
  if (raw === 'running' || raw === 'active' || raw === 'in_progress') return 'running'
  if (raw === 'failed' || raw === 'error') return 'failed'
  return 'pending'
}

const STATUS_STYLES: Record<StepStatus, {
  node: string
  ring: string
  icon: string
  label: string
}> = {
  completed: {
    node: 'bg-emerald-500 border-emerald-400',
    ring: '',
    icon: '✓',
    label: 'text-emerald-600 dark:text-emerald-400',
  },
  running: {
    node: 'bg-primary border-primary wf-node-active',
    ring: '',
    icon: '◉',
    label: 'text-primary',
  },
  failed: {
    node: 'bg-red-500 border-red-400',
    ring: '',
    icon: '✗',
    label: 'text-red-500 dark:text-red-400',
  },
  pending: {
    node: 'bg-gray-600 dark:bg-gray-700 border-gray-500',
    ring: '',
    icon: '',
    label: 'text-muted-foreground/50',
  },
}

function getTrackClass(fromStatus: StepStatus, toStatus: StepStatus): string {
  if (fromStatus === 'completed' && toStatus === 'completed') return 'wf-track-done'
  if (fromStatus === 'completed' && toStatus === 'running') return 'wf-track-active'
  if (fromStatus === 'running') return 'wf-track-active'
  return 'wf-track-pending'
}

function formatElapsed(ms?: number): string {
  if (ms == null || ms <= 0) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60000)}min`
}

function StepNode({ step, index, total }: {
  step: TimelineStep
  index: number
  total: number
}) {
  const style = STATUS_STYLES[step.status]
  const elapsed = formatElapsed(step.elapsed_ms)
  const isFirst = index === 0
  const isLast = index === total - 1

  return (
    <div className="flex flex-col items-center relative" style={{ minWidth: 56 }}>
      {/* 节点圆 */}
      <div
        className={`
          w-6 h-6 rounded-full border-2 flex items-center justify-center
          text-[10px] font-bold text-white shrink-0
          transition-all duration-300
          ${style.node}
        `}
        title={`${step.name}${elapsed ? ` · ${elapsed}` : ''}`}
      >
        {step.status === 'pending' ? (
          <span className="text-[8px] text-gray-400">{index + 1}</span>
        ) : (
          <span className="text-[10px]">{style.icon}</span>
        )}
      </div>

      {/* 步骤名称 */}
      <span
        className={`
          mt-1.5 text-[10px] leading-tight text-center max-w-[72px] truncate
          ${style.label}
          ${step.status === 'running' ? 'font-semibold' : ''}
        `}
        title={step.name}
      >
        {step.name}
      </span>

      {/* 耗时标签 */}
      {elapsed && step.status === 'completed' && (
        <span className="text-[8px] text-emerald-500/60 mt-0.5">{elapsed}</span>
      )}

      {/* 首尾标记 */}
      {isFirst && step.status !== 'pending' && (
        <span className="absolute -top-4 text-[8px] text-muted-foreground/40">起</span>
      )}
      {isLast && step.status === 'completed' && (
        <span className="absolute -top-4 text-[8px] text-emerald-500/60">✓</span>
      )}
    </div>
  )
}

function TrackSegment({ from, to }: { from: TimelineStep; to: TimelineStep }) {
  const cls = getTrackClass(from.status, to.status)
  return (
    <div className="flex-1 flex items-start pt-[10px]">
      <div className={`w-full h-[2px] rounded-full ${cls}`} />
    </div>
  )
}

/** 从 WorkflowInstanceInfo 生成时间线 */
export function WorkflowInstanceTimeline({
  instance,
}: {
  instance: WorkflowInstanceInfo
}) {
  const steps: TimelineStep[] = instance.steps.map(s => ({
    id: s.id,
    name: s.name,
    status: normalizeStatus(s.status),
  }))

  if (steps.length === 0) return null

  const completedCount = steps.filter(s => s.status === 'completed').length
  const runningStep = steps.find(s => s.status === 'running')

  return (
    <div className="mt-3 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50 bg-emerald-950/10 p-3">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-500">⚡</span>
          <span className="font-medium text-foreground/90">{instance.workflow_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
            {completedCount}/{steps.length}
          </span>
          <StatusBadge status={instance.status} />
        </div>
      </div>

      {/* 水平时间线 */}
      <div className="flex items-start gap-0 overflow-x-auto pb-1">
        {steps.map((step, i) => (
          <div key={step.id} className="contents">
            <StepNode step={step} index={i} total={steps.length} />
            {i < steps.length - 1 && (
              <TrackSegment from={step} to={steps[i + 1]} />
            )}
          </div>
        ))}
      </div>

      {/* 当前执行提示 */}
      {runningStep && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-primary/70">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          正在执行: {runningStep.name}
        </div>
      )}

      {/* ID */}
      <p className="text-[9px] text-muted-foreground/30 mt-2 tabular-nums">
        {instance.instance_id}
      </p>
    </div>
  )
}

/** 从 WorkflowSuggestion 生成预览时间线 */
export function WorkflowSuggestionTimeline({
  suggestion,
  onStart,
  starting = false,
}: {
  suggestion: WorkflowSuggestion
  onStart: () => void
  starting?: boolean
}) {
  const steps: TimelineStep[] = suggestion.steps.map(s => ({
    id: s.id,
    name: s.name,
    status: 'pending' as StepStatus,
  }))

  return (
    <div className="mt-3 rounded-lg border border-blue-200/50 dark:border-blue-800/50 bg-blue-950/10 p-3">
      {/* 头部 */}
      <div className="flex items-center gap-2 text-xs mb-1">
        <span className="text-blue-400">⚡</span>
        <span className="font-medium text-foreground/90">AI 可以直接帮你做</span>
        {suggestion.confidence === 'high' && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400">
            高匹配
          </span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground/70 mb-3">
        {suggestion.message}
      </p>

      {/* 预览时间线 */}
      {steps.length > 0 && (
        <div className="flex items-start gap-0 overflow-x-auto pb-1 mb-3 opacity-60">
          {steps.map((step, i) => (
            <div key={step.id} className="contents">
              <StepNode step={step} index={i} total={steps.length} />
              {i < steps.length - 1 && (
                <TrackSegment from={step} to={steps[i + 1]} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* 启动按钮 */}
      <button
        className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        onClick={onStart}
        disabled={starting}
      >
        {starting ? (
          <>
            <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            启动中…
          </>
        ) : (
          <>启动工作流 →</>
        )}
      </button>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    draft: { text: '草稿', cls: 'text-gray-400 bg-gray-400/10' },
    running: { text: '执行中', cls: 'text-blue-400 bg-blue-400/10' },
    paused: { text: '暂停', cls: 'text-yellow-400 bg-yellow-400/10' },
    awaiting_approval: { text: '待审批', cls: 'text-orange-400 bg-orange-400/10' },
    completed: { text: '完成', cls: 'text-emerald-400 bg-emerald-400/10' },
    failed: { text: '失败', cls: 'text-red-400 bg-red-400/10' },
    cancelled: { text: '已取消', cls: 'text-gray-400 bg-gray-400/10' },
  }
  const { text, cls } = map[status] ?? map.draft
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${cls}`}>
      {text}
    </span>
  )
}
