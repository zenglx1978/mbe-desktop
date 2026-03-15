/**
 * 任务管理面板 — Tasks Tab
 * 三列 Kanban 看板：待处理 | 进行中 | 已完成
 * 顶部统计条 + 新建任务入口
 */

import { useState, useEffect, useCallback } from 'react'
import type { SolutionConfig } from '@/lib/solution-router'
import type { Task, TaskStatus, TaskPriority } from '@/lib/task-service'
import {
  listTasks, createTask, updateTask, deleteTask,
  groupByStatus, getStats, STATUS_META,
} from '@/lib/task-service'
import TaskCard from '@/components/tasks/TaskCard'
import TaskForm from '@/components/tasks/TaskForm'

interface Props {
  solution: SolutionConfig
}

export default function TasksPanel({ solution }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const result = await listTasks(solution.id)
    setTasks(result)
    setLoading(false)
  }, [solution.id])

  useEffect(() => { reload() }, [reload])

  async function handleCreate(data: { title: string; type: string; priority: TaskPriority; dueDate?: string }) {
    const task = await createTask({
      solutionId: solution.id,
      ...data,
    })
    if (task) {
      setTasks(prev => [task, ...prev])
    }
    setShowForm(false)
  }

  async function handleStatusChange(id: string, status: TaskStatus) {
    await updateTask(id, { status })
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status, updated_at: new Date().toISOString() } : t))
  }

  async function handlePriorityChange(id: string, priority: TaskPriority) {
    await updateTask(id, { priority })
    setTasks(prev => prev.map(t => t.id === id ? { ...t, priority, updated_at: new Date().toISOString() } : t))
  }

  async function handleDelete(id: string) {
    await deleteTask(id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const stats = getStats(tasks)
  const groups = groupByStatus(tasks)

  const columns: { key: TaskStatus; label: string; icon: string }[] = [
    { key: 'pending', label: STATUS_META.pending.label, icon: STATUS_META.pending.icon },
    { key: 'in_progress', label: STATUS_META.in_progress.label, icon: STATUS_META.in_progress.icon },
    { key: 'done', label: STATUS_META.done.label, icon: STATUS_META.done.icon },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 顶部：统计 + 操作 */}
      <div className="px-6 py-4 border-b border-border/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h3 className="text-lg font-bold">任务看板</h3>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>共 <b className="text-foreground">{stats.total}</b> 项</span>
              {stats.overdue > 0 && (
                <span className="text-red-400">🔴 {stats.overdue} 项逾期</span>
              )}
              {stats.dueToday > 0 && (
                <span className="text-amber-400">🟡 {stats.dueToday} 项今天到期</span>
              )}
              {stats.total > 0 && (
                <span>
                  完成率 <b className="text-foreground">{stats.total > 0 ? Math.round(stats.done / stats.total * 100) : 0}%</b>
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-xl text-xs font-medium text-white transition-all hover:opacity-90"
            style={{ backgroundColor: solution.color }}
          >
            + 新建任务
          </button>
        </div>

        {/* 新建表单 */}
        {showForm && (
          <div className="mt-4">
            <TaskForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              color={solution.color}
              taskTypes={getTaskTypes(solution)}
            />
          </div>
        )}
      </div>

      {/* Kanban 三列 */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: `${solution.color}40`, borderTopColor: solution.color }}
          />
        </div>
      ) : tasks.length === 0 && !showForm ? (
        <EmptyState color={solution.color} onAdd={() => setShowForm(true)} />
      ) : (
        <div className="flex-1 overflow-x-auto px-4 py-4">
          <div className="flex gap-4 min-w-[720px] h-full">
            {columns.map(col => (
              <KanbanColumn
                key={col.key}
                label={col.label}
                icon={col.icon}
                count={groups[col.key].length}
                tasks={groups[col.key]}
                color={solution.color}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function KanbanColumn({ label, icon, count, tasks, color, onStatusChange, onPriorityChange, onDelete }: {
  label: string
  icon: string
  count: number
  tasks: Task[]
  color: string
  onStatusChange: (id: string, status: TaskStatus) => void
  onPriorityChange: (id: string, priority: TaskPriority) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex-1 flex flex-col min-w-[220px] max-w-[400px]">
      {/* 列头 */}
      <div className="flex items-center gap-2 px-3 py-2 mb-3">
        <span className="text-sm">{icon}</span>
        <span className="text-sm font-semibold">{label}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-secondary/40 px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>

      {/* 卡片列表 */}
      <div className="flex-1 overflow-y-auto space-y-2 px-1 pb-4">
        {tasks.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground/40 py-8">
            暂无任务
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              color={color}
              onStatusChange={onStatusChange}
              onPriorityChange={onPriorityChange}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}

function EmptyState({ color, onAdd }: { color: string; onAdd: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <span className="text-5xl block">✅</span>
        <h3 className="text-lg font-semibold">暂无任务</h3>
        <p className="text-sm text-muted-foreground">
          创建任务来跟踪合同审查、纳税申报、诉讼时效等待办事项，支持时效提醒和优先级管理。
        </p>
        <button
          onClick={onAdd}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: color }}
        >
          + 创建第一个任务
        </button>
      </div>
    </div>
  )
}

function getTaskTypes(solution: SolutionConfig): string[] {
  const typeMap: Record<string, string[]> = {
    'labor-dispatch': ['合规检查', '合同审查', '薪资结算', '纠纷跟进', '一般'],
    'law-firm': ['案件管理', '合同审查', '文书起草', '诉讼时效', '一般'],
    'finance-tax-service': ['纳税申报', '凭证审核', '审计任务', '税务筹划', '一般'],
    'construction-cost': ['造价审核', '结算审计', '变更签证', '一般'],
    'clinic-respiratory': ['病历审查', '随访任务', '检查安排', '一般'],
    'smb-operations': ['法务', '财务', '客服', '销售', '一般'],
    'ecommerce-brand-service': ['店铺运营', '客诉处理', '结算对账', '营销活动', '一般'],
    'education-training': ['招生跟进', '课程安排', '考试准备', '一般'],
  }
  return typeMap[solution.id] || ['一般']
}
