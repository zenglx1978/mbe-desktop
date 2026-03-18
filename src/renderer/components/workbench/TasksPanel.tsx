import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, CheckCircle2, Circle, Clock, AlertCircle, Filter } from 'lucide-react'
import type { SolutionConfig } from '@/lib/solution-router'

interface TaskItem {
  id: string
  title: string
  status: TaskStatus
  priority: Priority
  dueDate?: string
  note?: string
  createdAt: string
  completedAt?: string
  source?: string
}

type TaskStatus = 'todo' | 'doing' | 'done'
type Priority = 'high' | 'medium' | 'low'

const STATUS_META: Record<TaskStatus, { label: string; icon: typeof Circle; cls: string }> = {
  todo: { label: '待办', icon: Circle, cls: 'text-muted-foreground' },
  doing: { label: '进行中', icon: Clock, cls: 'text-blue-500' },
  done:  { label: '已完成', icon: CheckCircle2, cls: 'text-green-500' },
}

const PRIORITY_META: Record<Priority, { label: string; cls: string; dot: string }> = {
  high:   { label: '紧急', cls: 'text-red-500', dot: 'bg-red-500' },
  medium: { label: '普通', cls: 'text-amber-500', dot: 'bg-amber-500' },
  low:    { label: '低', cls: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
}

function storageKey(solutionId: string) {
  return `mbe_tasks_${solutionId}`
}

function loadTasks(solutionId: string): TaskItem[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(solutionId)) || '[]')
  } catch {
    return []
  }
}

function saveTasks(solutionId: string, tasks: TaskItem[]) {
  localStorage.setItem(storageKey(solutionId), JSON.stringify(tasks))
}

interface Props {
  solution: SolutionConfig
}

export default function TasksPanel({ solution }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => {
    setTasks(loadTasks(solution.id))
  }, [solution.id])

  const persist = useCallback((next: TaskItem[]) => {
    setTasks(next)
    saveTasks(solution.id, next)
  }, [solution.id])

  const addTask = useCallback((title: string, priority: Priority, dueDate?: string, note?: string) => {
    const task: TaskItem = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      status: 'todo',
      priority,
      dueDate,
      note,
      createdAt: new Date().toISOString(),
      source: 'manual',
    }
    persist([task, ...tasks])
    setShowAdd(false)
  }, [tasks, persist])

  const cycleStatus = useCallback((id: string) => {
    const order: TaskStatus[] = ['todo', 'doing', 'done']
    persist(tasks.map(t => {
      if (t.id !== id) return t
      const nextIdx = (order.indexOf(t.status) + 1) % order.length
      const nextStatus = order[nextIdx]
      return {
        ...t,
        status: nextStatus,
        completedAt: nextStatus === 'done' ? new Date().toISOString() : undefined,
      }
    }))
  }, [tasks, persist])

  const deleteTask = useCallback((id: string) => {
    persist(tasks.filter(t => t.id !== id))
  }, [tasks, persist])

  const activeTasks = tasks.filter(t => t.status !== 'done')
  const completedTasks = tasks.filter(t => t.status === 'done')

  const filtered = (filterStatus === 'all' ? activeTasks : activeTasks.filter(t => t.status === filterStatus))
    .sort((a, b) => {
      const pOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
      return pOrder[a.priority] - pOrder[b.priority]
    })

  const counts = {
    todo: tasks.filter(t => t.status === 'todo').length,
    doing: tasks.filter(t => t.status === 'doing').length,
    done: completedTasks.length,
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 统计概览 */}
        <div className="grid grid-cols-3 gap-3">
          <StatBadge icon={<Circle className="w-4 h-4" />} label="待办" count={counts.todo} cls="text-muted-foreground" />
          <StatBadge icon={<Clock className="w-4 h-4" />} label="进行中" count={counts.doing} cls="text-blue-500" />
          <StatBadge icon={<CheckCircle2 className="w-4 h-4" />} label="已完成" count={counts.done} cls="text-green-500" />
        </div>

        {/* 筛选 + 新建 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-secondary/30 rounded-lg p-1">
            <Filter className="w-3.5 h-3.5 text-muted-foreground ml-2" />
            {(['all', 'todo', 'doing'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                  filterStatus === s ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'all' ? '全部' : STATUS_META[s].label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors ml-auto"
          >
            <Plus className="w-4 h-4" />
            新建任务
          </button>
        </div>

        {/* 新建任务表单 */}
        {showAdd && <AddTaskForm onAdd={addTask} onCancel={() => setShowAdd(false)} />}

        {/* 活跃任务列表 */}
        {filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onCycleStatus={() => cycleStatus(task.id)}
                onDelete={() => deleteTask(task.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyTasks hasAny={tasks.length > 0} onAdd={() => setShowAdd(true)} />
        )}

        {/* 已完成（折叠） */}
        {completedTasks.length > 0 && (
          <div>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showCompleted ? '▾' : '▸'}
              已完成 ({completedTasks.length})
            </button>
            {showCompleted && (
              <div className="mt-2 space-y-2">
                {completedTasks.slice(0, 20).map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onCycleStatus={() => cycleStatus(task.id)}
                    onDelete={() => deleteTask(task.id)}
                    dimmed
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatBadge({ icon, label, count, cls }: { icon: React.ReactNode; label: string; count: number; cls: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-3 flex items-center gap-3">
      <div className={cls}>{icon}</div>
      <div>
        <p className="text-lg font-bold">{count}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function TaskRow({ task, onCycleStatus, onDelete, dimmed }: {
  task: TaskItem; onCycleStatus: () => void; onDelete: () => void; dimmed?: boolean
}) {
  const meta = STATUS_META[task.status]
  const prio = PRIORITY_META[task.priority]
  const StatusIcon = meta.icon
  const isOverdue = task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date()

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
      dimmed ? 'border-border/20 bg-card/20 opacity-60' : 'border-border/40 bg-card/50 hover:border-primary/20'
    }`}>
      <button onClick={onCycleStatus} className={`shrink-0 ${meta.cls} hover:scale-110 transition-transform`} title={`切换到下一状态`}>
        <StatusIcon className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : 'font-medium'}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`flex items-center gap-1 text-[10px] ${prio.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} /> {prio.label}
          </span>
          {task.dueDate && (
            <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
              {isOverdue && <AlertCircle className="w-3 h-3" />}
              {new Date(task.dueDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.note && <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{task.note}</span>}
        </div>
      </div>
      {task.status === 'done' && task.completedAt && (
        <span className="text-[10px] text-green-500 shrink-0">
          {new Date(task.completedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
        </span>
      )}
      <button onClick={onDelete} className="shrink-0 text-muted-foreground/40 hover:text-red-400 transition-colors" title="删除">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function AddTaskForm({ onAdd, onCancel }: { onAdd: (title: string, priority: Priority, dueDate?: string, note?: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')

  return (
    <div className="rounded-xl border border-primary/20 bg-card/50 p-4 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Plus className="w-4 h-4 text-primary" /> 新建任务
      </h3>
      <div className="grid gap-3">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="任务标题"
          className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border/50 text-sm outline-none focus:border-primary/50"
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">优先级</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as Priority)}
              className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border/50 text-sm outline-none focus:border-primary/50"
            >
              <option value="high">🔴 紧急</option>
              <option value="medium">🟡 普通</option>
              <option value="low">⚪ 低优先级</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">截止日期（可选）</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border/50 text-sm outline-none focus:border-primary/50"
            />
          </div>
        </div>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="备注（可选）"
          className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border/50 text-sm outline-none focus:border-primary/50"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => title.trim() && onAdd(title.trim(), priority, dueDate || undefined, note || undefined)}
          disabled={!title.trim()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          创建
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-border/50 text-sm hover:bg-secondary/30 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  )
}

function EmptyTasks({ hasAny, onAdd }: { hasAny: boolean; onAdd: () => void }) {
  return (
    <div className="text-center py-12 space-y-4">
      <div className="text-5xl">✅</div>
      <div>
        <p className="text-lg font-semibold text-foreground">
          {hasAny ? '当前筛选条件下没有任务' : '还没有任务'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {hasAny
            ? '尝试切换筛选条件查看其他任务'
            : '创建任务来跟踪业务待办事项，如合同审查、报税提醒、客户跟进等'}
        </p>
      </div>
      {!hasAny && (
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> 新建任务
        </button>
      )}
    </div>
  )
}
