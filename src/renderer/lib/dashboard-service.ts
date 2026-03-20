import type { WindowWithElectron } from '@/types/api-responses'

/**
 * 仪表盘数据聚合服务
 * 从 SQLite 的 conversations / calc_history / tasks 表聚合统计。
 */

export interface DashboardData {
  conversations: ConvStats
  calculations: CalcStats
  tasks: TaskDashStats
  recentActivities: Activity[]
  dailyTrend: DailyPoint[]
}

export interface ConvStats {
  total: number
  thisWeek: number
  totalMessages: number
}

export interface CalcStats {
  total: number
  localCount: number
  remoteCount: number
  topTools: { toolId: string; count: number }[]
}

export interface TaskDashStats {
  total: number
  pending: number
  inProgress: number
  done: number
  overdue: number
  completionRate: number
}

export interface Activity {
  id: string
  type: 'conversation' | 'calculation' | 'task'
  title: string
  icon: string
  timestamp: string
}

export interface DailyPoint {
  date: string
  conversations: number
  calculations: number
  tasks: number
}

export async function loadDashboardData(solutionId: string): Promise<DashboardData> {
  const [conversations, calculations, tasks, recentActivities, dailyTrend] = await Promise.all([
    loadConvStats(solutionId),
    loadCalcStats(solutionId),
    loadTaskStats(solutionId),
    loadRecentActivities(solutionId),
    loadDailyTrend(solutionId),
  ])
  return { conversations, calculations, tasks, recentActivities, dailyTrend }
}

async function loadConvStats(solutionId: string): Promise<ConvStats> {
  try {
    const api = (window as WindowWithElectron).electronAPI?.db
    if (!api?.conversations?.list) return { total: 0, thisWeek: 0, totalMessages: 0 }

    const convs = await api.conversations.list(solutionId)
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    let totalMessages = 0
    let thisWeek = 0
    for (const c of convs || []) {
      totalMessages += c.message_count || 0
      if (c.created_at && new Date(c.created_at) >= weekAgo) thisWeek++
    }

    return { total: (convs || []).length, thisWeek, totalMessages }
  } catch {
    return { total: 0, thisWeek: 0, totalMessages: 0 }
  }
}

async function loadCalcStats(solutionId: string): Promise<CalcStats> {
  try {
    const api = (window as WindowWithElectron).electronAPI?.db?.calc
    if (!api?.list) return { total: 0, localCount: 0, remoteCount: 0, topTools: [] }

    const records = await api.list(solutionId)
    const arr = records || []
    let localCount = 0
    let remoteCount = 0
    const toolCounts: Record<string, number> = {}

    for (const r of arr) {
      if (r.source === 'local') localCount++
      else remoteCount++
      toolCounts[r.tool_id] = (toolCounts[r.tool_id] || 0) + 1
    }

    const topTools = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([toolId, count]) => ({ toolId, count }))

    return { total: arr.length, localCount, remoteCount, topTools }
  } catch {
    return { total: 0, localCount: 0, remoteCount: 0, topTools: [] }
  }
}

async function loadTaskStats(solutionId: string): Promise<TaskDashStats> {
  try {
    const api = (window as WindowWithElectron).electronAPI?.db?.tasks
    if (!api?.list) return { total: 0, pending: 0, inProgress: 0, done: 0, overdue: 0, completionRate: 0 }

    const tasks = await api.list(solutionId)
    const arr = tasks || []
    let pending = 0, inProgress = 0, done = 0, overdue = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const t of arr) {
      if (t.status === 'pending') pending++
      else if (t.status === 'in_progress') inProgress++
      else if (t.status === 'done') done++

      if (t.status !== 'done' && t.due_date) {
        const due = new Date(t.due_date)
        due.setHours(0, 0, 0, 0)
        if (due < today) overdue++
      }
    }

    return {
      total: arr.length,
      pending,
      inProgress,
      done,
      overdue,
      completionRate: arr.length > 0 ? Math.round((done / arr.length) * 100) : 0,
    }
  } catch {
    return { total: 0, pending: 0, inProgress: 0, done: 0, overdue: 0, completionRate: 0 }
  }
}

async function loadRecentActivities(solutionId: string): Promise<Activity[]> {
  const activities: Activity[] = []

  try {
    const api = (window as WindowWithElectron).electronAPI?.db

    // 最近对话
    const convs = await api?.conversations?.list?.(solutionId) || []
    for (const c of convs.slice(0, 5)) {
      activities.push({
        id: `conv_${c.id}`,
        type: 'conversation',
        title: c.title || '新对话',
        icon: '💬',
        timestamp: c.updated_at || c.created_at || '',
      })
    }

    // 最近计算
    const calcs = await api?.calc?.list?.(solutionId) || []
    for (const r of calcs.slice(0, 5)) {
      activities.push({
        id: `calc_${r.id}`,
        type: 'calculation',
        title: `${r.tool_id} 计算`,
        icon: '🧮',
        timestamp: r.created_at || '',
      })
    }

    // 最近任务
    const tasks = await api?.tasks?.list?.(solutionId) || []
    for (const t of tasks.slice(0, 5)) {
      activities.push({
        id: `task_${t.id}`,
        type: 'task',
        title: t.title,
        icon: t.status === 'done' ? '✅' : '📋',
        timestamp: t.updated_at || t.created_at || '',
      })
    }
  } catch {
    // 静默
  }

  return activities
    .filter(a => a.timestamp)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15)
}

async function loadDailyTrend(solutionId: string): Promise<DailyPoint[]> {
  const days = 7
  const points: DailyPoint[] = []
  const now = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    points.push({ date: dateStr, conversations: 0, calculations: 0, tasks: 0 })
  }

  try {
    const api = (window as WindowWithElectron).electronAPI?.db

    const convs = await api?.conversations?.list?.(solutionId) || []
    for (const c of convs) {
      const d = (c.created_at || '').slice(0, 10)
      const pt = points.find(p => p.date === d)
      if (pt) pt.conversations++
    }

    const calcs = await api?.calc?.list?.(solutionId) || []
    for (const r of calcs) {
      const d = (r.created_at || '').slice(0, 10)
      const pt = points.find(p => p.date === d)
      if (pt) pt.calculations++
    }

    const tasks = await api?.tasks?.list?.(solutionId) || []
    for (const t of tasks) {
      const d = (t.created_at || '').slice(0, 10)
      const pt = points.find(p => p.date === d)
      if (pt) pt.tasks++
    }
  } catch {
    // 静默
  }

  return points
}
