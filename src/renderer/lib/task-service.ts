/**
 * 任务管理服务 — CRUD + 时效计算 + 统计
 */

export interface Task {
  id: string
  solution_id: string
  type: string
  title: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in_progress' | 'done'
  due_date: string | null
  related_conversation_id: string | null
  related_calc_id: string | null
  metadata_json: string | null
  created_at: string
  updated_at: string
}

export type TaskPriority = Task['priority']
export type TaskStatus = Task['status']

export interface CreateTaskInput {
  solutionId: string
  type: string
  title: string
  priority?: TaskPriority
  dueDate?: string
  relatedConversationId?: string
}

export interface TaskStats {
  total: number
  pending: number
  inProgress: number
  done: number
  overdue: number
  dueToday: number
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }
const STATUS_ORDER: Record<TaskStatus, number> = { in_progress: 0, pending: 1, done: 2 }

function api() {
  return (window as any).electronAPI?.db?.tasks
}

export async function listTasks(solutionId: string): Promise<Task[]> {
  const db = api()
  if (!db) return []
  try {
    const rows = await db.list(solutionId)
    return (rows || []).map(normalizeTask)
  } catch {
    return []
  }
}

export async function createTask(input: CreateTaskInput): Promise<Task | null> {
  const db = api()
  if (!db) return null
  const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  try {
    await db.create({
      id,
      solutionId: input.solutionId,
      type: input.type,
      title: input.title,
      priority: input.priority || 'medium',
      dueDate: input.dueDate || undefined,
      relatedConversationId: input.relatedConversationId || undefined,
    })
    return {
      id,
      solution_id: input.solutionId,
      type: input.type,
      title: input.title,
      priority: input.priority || 'medium',
      status: 'pending',
      due_date: input.dueDate || null,
      related_conversation_id: input.relatedConversationId || null,
      related_calc_id: null,
      metadata_json: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export async function updateTask(id: string, updates: Partial<Pick<Task, 'status' | 'title' | 'priority'>>): Promise<void> {
  const db = api()
  if (!db) return
  try {
    await db.update(id, updates)
  } catch {
    // 静默
  }
}

export async function deleteTask(id: string): Promise<void> {
  const db = api()
  if (!db) return
  try {
    await db.delete(id)
  } catch {
    // 静默
  }
}

/** 按看板列分组 */
export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups: Record<TaskStatus, Task[]> = { pending: [], in_progress: [], done: [] }
  for (const t of tasks) {
    const s = t.status as TaskStatus
    if (groups[s]) groups[s].push(t)
    else groups.pending.push(t)
  }
  for (const key of Object.keys(groups) as TaskStatus[]) {
    groups[key].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  }
  return groups
}

/** 按优先级排序 */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (sd !== 0) return sd
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  })
}

/** 时效状态 */
export function getDueStatus(task: Task): 'overdue' | 'today' | 'upcoming' | 'none' {
  if (!task.due_date) return 'none'
  const now = new Date()
  const due = new Date(task.due_date)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())

  if (dueDay < today) return 'overdue'
  if (dueDay.getTime() === today.getTime()) return 'today'
  return 'upcoming'
}

/** 剩余天数 */
export function getDaysRemaining(task: Task): number | null {
  if (!task.due_date) return null
  const now = new Date()
  const due = new Date(task.due_date)
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

/** 统计 */
export function getStats(tasks: Task[]): TaskStats {
  const stats: TaskStats = { total: 0, pending: 0, inProgress: 0, done: 0, overdue: 0, dueToday: 0 }
  for (const t of tasks) {
    stats.total++
    if (t.status === 'pending') stats.pending++
    else if (t.status === 'in_progress') stats.inProgress++
    else if (t.status === 'done') stats.done++

    if (t.status !== 'done') {
      const ds = getDueStatus(t)
      if (ds === 'overdue') stats.overdue++
      if (ds === 'today') stats.dueToday++
    }
  }
  return stats
}

function normalizeTask(row: any): Task {
  return {
    id: row.id,
    solution_id: row.solution_id,
    type: row.type || 'general',
    title: row.title,
    priority: row.priority || 'medium',
    status: row.status || 'pending',
    due_date: row.due_date || null,
    related_conversation_id: row.related_conversation_id || null,
    related_calc_id: row.related_calc_id || null,
    metadata_json: row.metadata_json || null,
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
  }
}

export const PRIORITY_META: Record<TaskPriority, { label: string; color: string; icon: string }> = {
  high: { label: '紧急', color: '#ef4444', icon: '🔴' },
  medium: { label: '普通', color: '#f59e0b', icon: '🟡' },
  low: { label: '低', color: '#6b7280', icon: '⚪' },
}

export const STATUS_META: Record<TaskStatus, { label: string; icon: string }> = {
  pending: { label: '待处理', icon: '⏳' },
  in_progress: { label: '进行中', icon: '🔄' },
  done: { label: '已完成', icon: '✅' },
}
