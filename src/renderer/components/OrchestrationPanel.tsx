/**
 * OrchestrationPanel — Expert 协作状态面板
 *
 * 实时展示多 Expert 编排过程：头像亮起 + 脉冲动画 + 耗时统计。
 * 三种编排模式有不同的视觉表达：
 *   - parallel: 同时脉冲
 *   - sequential: 依次点亮
 *   - fan_out: 竞争态，最优结果高亮
 */

import type { OrchestrationState, ExpertStatus } from '@/stores/chat-store'
import { Users, Loader2, CheckCircle2, AlertCircle, Zap } from 'lucide-react'

const MODE_LABELS: Record<string, string> = {
  parallel: '并行分析',
  sequential: '流水线',
  fan_out: '竞争择优',
  cross_domain: '跨域协作',
}

const MODE_DESCRIPTIONS: Record<string, string> = {
  parallel: '多位专家同时工作，合并结果',
  sequential: '逐步接力，前一位的结论传递给下一位',
  fan_out: '多位专家同时给出方案，选取最优',
  cross_domain: '跨领域专家联合分析',
}

const EXPERT_COLORS = [
  { ring: 'ring-blue-400', bg: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-400' },
  { ring: 'ring-violet-400', bg: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-400' },
  { ring: 'ring-amber-400', bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-400' },
  { ring: 'ring-emerald-400', bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-400' },
  { ring: 'ring-rose-400', bg: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-400' },
]

function getColor(index: number) {
  return EXPERT_COLORS[index % EXPERT_COLORS.length]
}

function ExpertAvatar({ label, status, index }: {
  label: string
  status: ExpertStatus
  index: number
}) {
  const color = getColor(index)
  const initial = label.replace(/^[\[\]（）\s]+/, '').charAt(0) || '?'
  const isWorking = status === 'working'
  const isDone = status === 'done'
  const isError = status === 'error'

  return (
    <div className="relative flex flex-col items-center gap-1">
      <div
        className={`
          relative w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold
          transition-all duration-300
          ${isDone ? 'bg-emerald-500 ring-2 ring-emerald-300' : ''}
          ${isError ? 'bg-red-500 ring-2 ring-red-300' : ''}
          ${isWorking ? `${color.bg} ring-2 ${color.ring} animate-pulse` : ''}
          ${status === 'idle' ? 'bg-gray-300 dark:bg-gray-600' : ''}
        `}
      >
        {isWorking && (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
        {isDone && (
          <CheckCircle2 className="w-4 h-4" />
        )}
        {isError && (
          <AlertCircle className="w-4 h-4" />
        )}
        {status === 'idle' && (
          <span>{initial}</span>
        )}
      </div>
      {isWorking && (
        <span className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${color.bg} animate-ping`} />
      )}
    </div>
  )
}

function SequentialConnector({ prevStatus, nextStatus }: {
  prevStatus: ExpertStatus
  nextStatus: ExpertStatus
}) {
  const active = prevStatus === 'done' || nextStatus === 'working' || nextStatus === 'done'
  return (
    <div className="flex items-center mx-0.5">
      <div className={`w-5 h-0.5 rounded transition-colors duration-500 ${
        active ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-700'
      }`} />
      <div className={`text-[10px] transition-colors duration-500 ${
        active ? 'text-emerald-400' : 'text-gray-300 dark:text-gray-600'
      }`}>
        →
      </div>
    </div>
  )
}

export default function OrchestrationPanel({ orchestration }: {
  orchestration: OrchestrationState
}) {
  const { mode, experts, active, total_elapsed_ms } = orchestration
  const doneCount = experts.filter(e => e.status === 'done').length
  const allDone = doneCount === experts.length && !active
  const hasError = experts.some(e => e.status === 'error')
  const isSequential = mode === 'sequential'

  return (
    <div className={`mt-3 rounded-xl border p-3 transition-colors duration-300 ${
      allDone && !hasError
        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20'
        : hasError
          ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20'
          : 'border-primary/20 bg-primary/5'
    }`}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-primary/70" />
          <span className="text-xs font-medium text-foreground/80">
            {MODE_LABELS[mode] ?? mode}
          </span>
          {active && (
            <span className="flex items-center gap-1 text-[10px] text-primary/60 animate-pulse">
              <Zap className="w-2.5 h-2.5" />
              进行中
            </span>
          )}
          {allDone && !hasError && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              ✓ 完成
            </span>
          )}
        </div>
        {total_elapsed_ms != null && (
          <span className="text-[10px] text-muted-foreground/60">
            {total_elapsed_ms < 1000
              ? `${Math.round(total_elapsed_ms)}ms`
              : `${(total_elapsed_ms / 1000).toFixed(1)}s`}
          </span>
        )}
      </div>

      {/* 专家头像区 */}
      <div className="flex items-center justify-center gap-1 py-1">
        {experts.map((expert, i) => (
          <div key={expert.id} className="flex items-center">
            {isSequential && i > 0 && (
              <SequentialConnector
                prevStatus={experts[i - 1].status}
                nextStatus={expert.status}
              />
            )}
            <ExpertAvatar
              label={expert.label}
              status={expert.status}
              index={i}
            />
          </div>
        ))}
      </div>

      {/* 专家名称+耗时 */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
        {experts.map((expert, i) => {
          const color = getColor(i)
          return (
            <div key={expert.id} className="flex items-center gap-1 text-[10px]">
              <span className={`w-1.5 h-1.5 rounded-full ${
                expert.status === 'done' ? 'bg-emerald-400'
                  : expert.status === 'error' ? 'bg-red-400'
                  : expert.status === 'working' ? color.bg
                  : 'bg-gray-300 dark:bg-gray-600'
              }`} />
              <span className={`${
                expert.status === 'idle'
                  ? 'text-muted-foreground/50'
                  : 'text-foreground/70'
              }`}>
                {expert.label}
              </span>
              {expert.elapsed_ms != null && (
                <span className="text-muted-foreground/40">
                  {expert.elapsed_ms < 1000
                    ? `${Math.round(expert.elapsed_ms)}ms`
                    : `${(expert.elapsed_ms / 1000).toFixed(1)}s`}
                </span>
              )}
              {expert.error && (
                <span className="text-red-500 text-[9px] truncate max-w-[80px]" title={expert.error}>
                  {expert.error}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* 模式说明（仅进行中时显示） */}
      {active && (
        <p className="text-center text-[10px] text-muted-foreground/40 mt-2">
          {MODE_DESCRIPTIONS[mode]}
        </p>
      )}
    </div>
  )
}
