/**
 * 单个任务卡片 — 用于 Kanban 看板
 */

import type { Task, TaskStatus, TaskPriority } from '@/lib/task-service'
import { PRIORITY_META, getDueStatus, getDaysRemaining } from '@/lib/task-service'

interface Props {
  task: Task
  onStatusChange: (id: string, status: TaskStatus) => void
  onPriorityChange: (id: string, priority: TaskPriority) => void
  onDelete: (id: string) => void
  color: string
}

const DUE_STYLE: Record<string, string> = {
  overdue: 'text-red-400 bg-red-500/10',
  today: 'text-amber-400 bg-amber-500/10',
  upcoming: 'text-muted-foreground bg-secondary/30',
  none: '',
}

export default function TaskCard({ task, onStatusChange, onPriorityChange, onDelete, color }: Props) {
  const dueStatus = getDueStatus(task)
  const daysLeft = getDaysRemaining(task)
  const pmeta = PRIORITY_META[task.priority]
  const isDone = task.status === 'done'

  function cycleStatus() {
    const next: Record<TaskStatus, TaskStatus> = {
      pending: 'in_progress',
      in_progress: 'done',
      done: 'pending',
    }
    onStatusChange(task.id, next[task.status])
  }

  function cyclePriority() {
    const next: Record<TaskPriority, TaskPriority> = {
      low: 'medium',
      medium: 'high',
      high: 'low',
    }
    onPriorityChange(task.id, next[task.priority])
  }

  return (
    <div
      className={`group px-4 py-3 rounded-xl border transition-all ${
        isDone
          ? 'border-border/20 bg-secondary/10 opacity-60'
          : 'border-border/40 bg-card hover:border-primary/20 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* 状态切换按钮 */}
        <button
          onClick={cycleStatus}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
            isDone
              ? 'border-green-500 bg-green-500 text-white'
              : task.status === 'in_progress'
                ? 'border-primary'
                : 'border-border/50 hover:border-primary/50'
          }`}
          style={task.status === 'in_progress' ? { borderColor: color } : undefined}
          title="切换状态"
        >
          {isDone && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {task.status === 'in_progress' && (
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <p className={`text-sm leading-snug ${isDone ? 'line-through text-muted-foreground' : ''}`}>
            {task.title}
          </p>

          {/* 标签行 */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* 优先级 */}
            <button
              onClick={cyclePriority}
              className="text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: `${pmeta.color}15`, color: pmeta.color }}
              title="切换优先级"
            >
              {pmeta.icon} {pmeta.label}
            </button>

            {/* 任务类型 */}
            {task.type !== 'general' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary/40 text-muted-foreground">
                {task.type}
              </span>
            )}

            {/* 时效 */}
            {task.due_date && dueStatus !== 'none' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${DUE_STYLE[dueStatus]}`}>
                {dueStatus === 'overdue' && `逾期 ${Math.abs(daysLeft || 0)} 天`}
                {dueStatus === 'today' && '今天到期'}
                {dueStatus === 'upcoming' && `${daysLeft} 天后到期`}
              </span>
            )}
          </div>
        </div>

        {/* 删除 */}
        <button
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground text-xs transition-opacity shrink-0 mt-0.5"
          title="删除"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
