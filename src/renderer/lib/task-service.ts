/**
 * Task Service — 用户任务 CRUD（后端持久化 + localStorage 降级）
 */
import { API_BASE, authFetch } from '@/lib/api-client'
import type { AccountTasksListResponse, AccountTaskApiRow } from '@/types/api-responses'

export type TaskStatus = 'todo' | 'doing' | 'done' | 'pending' | 'in_progress'
export type Priority = 'high' | 'medium' | 'low'
export type TaskPriority = Priority

export interface TaskItem {
  id: string
  title: string
  status: TaskStatus
  priority: Priority
  type?: string
  dueDate?: string
  note?: string
  createdAt: string
  completedAt?: string
  source?: string
  solutionId?: string
}

export type Task = TaskItem

export const PRIORITY_META: Record<Priority, { label: string; icon: string; color: string }> = {
  high: { label: '高', icon: '🔴', color: 'text-red-400' },
  medium: { label: '中', icon: '🟡', color: 'text-amber-400' },
  low: { label: '低', icon: '🟢', color: 'text-green-400' },
}

export function getDueStatus(task: TaskItem): 'overdue' | 'today' | 'upcoming' | 'none' {
  if (!task.dueDate) return 'none'
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(task.dueDate)
  due.setHours(0, 0, 0, 0)
  const diff = due.getTime() - now.getTime()
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 3 * 86400000) return 'upcoming'
  return 'none'
}

export function getDaysRemaining(task: TaskItem): number | null {
  if (!task.dueDate) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(task.dueDate)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - now.getTime()) / 86400000)
}

const LS_PREFIX = 'mbe_tasks_'

function lsKey(solutionId: string) {
  return `${LS_PREFIX}${solutionId}`
}

function readLS(solutionId: string): TaskItem[] {
  try {
    return JSON.parse(localStorage.getItem(lsKey(solutionId)) || '[]')
  } catch {
    return []
  }
}

function writeLS(solutionId: string, tasks: TaskItem[]) {
  localStorage.setItem(lsKey(solutionId), JSON.stringify(tasks))
}

export async function fetchTasks(solutionId: string): Promise<TaskItem[]> {
  try {
    const params = new URLSearchParams({ solution_id: solutionId, limit: '300' })
    const resp = await authFetch(`${API_BASE}/api/v1/account/tasks?${params}`)
    if (!resp.ok) throw new Error(`${resp.status}`)
    const data = (await resp.json()) as AccountTasksListResponse
    const tasks: TaskItem[] = (data.tasks || []).map((t: AccountTaskApiRow) => ({
      id: t.id,
      title: t.title,
      status: t.status as TaskStatus,
      priority: t.priority as Priority,
      dueDate: t.dueDate || undefined,
      note: t.note || undefined,
      createdAt: t.createdAt,
      completedAt: t.completedAt || undefined,
      source: t.source,
      solutionId: t.solutionId,
    }))
    writeLS(solutionId, tasks)
    return tasks
  } catch {
    return readLS(solutionId)
  }
}

export async function createTask(
  solutionId: string,
  title: string,
  priority: Priority,
  dueDate?: string,
  note?: string,
): Promise<TaskItem> {
  const fallback: TaskItem = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title, status: 'todo', priority,
    dueDate, note,
    createdAt: new Date().toISOString(),
    source: 'manual',
    solutionId,
  }

  try {
    const resp = await authFetch(`${API_BASE}/api/v1/account/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title, priority,
        due_date: dueDate || null,
        note: note || '',
        solution_id: solutionId,
      }),
    })
    if (!resp.ok) throw new Error(`${resp.status}`)
    const t = (await resp.json()) as AccountTaskApiRow
    return {
      id: t.id,
      title: t.title,
      status: t.status as TaskStatus,
      priority: t.priority as Priority,
      dueDate: t.dueDate || undefined,
      note: t.note || undefined,
      createdAt: t.createdAt,
      completedAt: t.completedAt || undefined,
      source: t.source,
      solutionId: t.solutionId,
    }
  } catch {
    const tasks = readLS(solutionId)
    writeLS(solutionId, [fallback, ...tasks])
    return fallback
  }
}

export async function updateTask(
  taskId: string,
  updates: { title?: string; status?: string; priority?: string; due_date?: string; note?: string },
): Promise<boolean> {
  try {
    const resp = await authFetch(`${API_BASE}/api/v1/account/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    return resp.ok
  } catch {
    return false
  }
}

export async function deleteTask(solutionId: string, taskId: string): Promise<boolean> {
  try {
    const resp = await authFetch(`${API_BASE}/api/v1/account/tasks/${taskId}`, {
      method: 'DELETE',
    })
    if (resp.ok) {
      const tasks = readLS(solutionId)
      writeLS(solutionId, tasks.filter(t => t.id !== taskId))
    }
    return resp.ok
  } catch {
    const tasks = readLS(solutionId)
    writeLS(solutionId, tasks.filter(t => t.id !== taskId))
    return true
  }
}
