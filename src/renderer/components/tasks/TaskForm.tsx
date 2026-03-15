/**
 * 创建/编辑任务的内联表单
 */

import { useState } from 'react'
import type { TaskPriority } from '@/lib/task-service'
import { PRIORITY_META } from '@/lib/task-service'

interface Props {
  onSubmit: (data: { title: string; type: string; priority: TaskPriority; dueDate?: string }) => void
  onCancel: () => void
  color: string
  /** 当前方案的任务类型选项 */
  taskTypes?: string[]
}

export default function TaskForm({ onSubmit, onCancel, color, taskTypes }: Props) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState(taskTypes?.[0] || 'general')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    onSubmit({ title: t, type, priority, dueDate: dueDate || undefined })
    setTitle('')
    setDueDate('')
  }

  const types = taskTypes && taskTypes.length > 0 ? taskTypes : ['general']

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-xl border border-primary/20 bg-card space-y-3">
      {/* 标题 */}
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="输入任务标题..."
        className="w-full px-3 py-2 rounded-lg border border-border/50 bg-secondary/20 text-sm outline-none focus:border-primary/50 transition-colors"
      />

      <div className="flex items-center gap-3 flex-wrap">
        {/* 任务类型 */}
        {types.length > 1 && (
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-border/50 bg-secondary/20 text-xs outline-none"
          >
            {types.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        {/* 优先级 */}
        <div className="flex items-center gap-1">
          {(Object.keys(PRIORITY_META) as TaskPriority[]).map(p => {
            const meta = PRIORITY_META[p]
            const isActive = priority === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`text-[11px] px-2 py-1 rounded-md transition-all ${
                  isActive
                    ? 'ring-1 ring-offset-1 ring-offset-background'
                    : 'opacity-50 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: `${meta.color}15`,
                  color: meta.color,
                  ...(isActive ? { ringColor: meta.color } : {}),
                }}
              >
                {meta.icon} {meta.label}
              </button>
            )
          })}
        </div>

        {/* 截止日期 */}
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="px-2 py-1.5 rounded-lg border border-border/50 bg-secondary/20 text-xs outline-none"
        />
      </div>

      {/* 操作 */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={!title.trim()}
          className="px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-all disabled:opacity-40 hover:opacity-90"
          style={{ backgroundColor: color }}
        >
          创建任务
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          取消
        </button>
      </div>
    </form>
  )
}
