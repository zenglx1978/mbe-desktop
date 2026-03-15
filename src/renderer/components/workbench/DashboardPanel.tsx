/**
 * 仪表盘面板 — Dashboard Tab
 * 4 指标卡片 + 7 天趋势图 + 任务进度 + 最近动态
 */

import { useState, useEffect } from 'react'
import type { SolutionConfig } from '@/lib/solution-router'
import type { DashboardData } from '@/lib/dashboard-service'
import { loadDashboardData } from '@/lib/dashboard-service'
import StatCard from '@/components/dashboard/StatCard'
import MiniChart from '@/components/dashboard/MiniChart'
import RecentActivity from '@/components/dashboard/RecentActivity'

interface Props {
  solution: SolutionConfig
}

export default function DashboardPanel({ solution }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadDashboardData(solution.id).then(d => {
      if (!cancelled) {
        setData(d)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [solution.id])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div
          className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: `${solution.color}40`, borderTopColor: solution.color }}
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        数据加载失败
      </div>
    )
  }

  const { conversations, calculations, tasks, recentActivities, dailyTrend } = data

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 标题 */}
        <div>
          <h3 className="text-lg font-bold">业务概览</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {solution.name} · 本地数据统计
          </p>
        </div>

        {/* 指标卡片 4 宫格 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon="💬"
            label="对话总数"
            value={conversations.total}
            sub={`本周 ${conversations.thisWeek} 次`}
            trend={conversations.thisWeek > 0 ? 'up' : 'flat'}
          />
          <StatCard
            icon="📨"
            label="消息总数"
            value={conversations.totalMessages}
            sub="所有对话累计"
          />
          <StatCard
            icon="🧮"
            label="计算次数"
            value={calculations.total}
            sub={calculations.total > 0
              ? `本地 ${calculations.localCount} · 远端 ${calculations.remoteCount}`
              : '尚未使用'
            }
            color={solution.color}
          />
          <StatCard
            icon="✅"
            label="任务完成率"
            value={tasks.total > 0 ? `${tasks.completionRate}%` : '—'}
            sub={tasks.total > 0
              ? `${tasks.done}/${tasks.total} 完成${tasks.overdue > 0 ? ` · ${tasks.overdue} 逾期` : ''}`
              : '暂无任务'
            }
            trend={tasks.overdue > 0 ? 'down' : tasks.completionRate > 50 ? 'up' : 'flat'}
          />
        </div>

        {/* 趋势图 */}
        <MiniChart data={dailyTrend} color={solution.color} />

        {/* 下半部：任务概况 + 最近动态 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 任务概况 */}
          <TaskOverview tasks={tasks} />

          {/* 最近动态 */}
          <RecentActivity activities={recentActivities} />
        </div>

        {/* 计算工具排行 */}
        {calculations.topTools.length > 0 && (
          <ToolRanking topTools={calculations.topTools} solution={solution} />
        )}
      </div>
    </div>
  )
}

function TaskOverview({ tasks }: { tasks: DashboardData['tasks'] }) {
  if (tasks.total === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-card p-6 flex flex-col items-center justify-center text-center">
        <span className="text-3xl mb-2">📋</span>
        <p className="text-sm text-muted-foreground">暂无任务</p>
        <p className="text-xs text-muted-foreground/50 mt-1">在任务 Tab 创建任务后这里会显示统计</p>
      </div>
    )
  }

  const segments = [
    { label: '已完成', count: tasks.done, cls: 'bg-green-500' },
    { label: '进行中', count: tasks.inProgress, cls: 'bg-blue-500' },
    { label: '待处理', count: tasks.pending, cls: 'bg-gray-400' },
  ]

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        任务概况
      </h4>

      {/* 进度条 */}
      <div className="flex rounded-full overflow-hidden h-3 bg-secondary/30 mb-4">
        {segments.map(seg => (
          seg.count > 0 && (
            <div
              key={seg.label}
              className={`${seg.cls} transition-all`}
              style={{ width: `${(seg.count / tasks.total) * 100}%` }}
            />
          )
        ))}
      </div>

      {/* 标签 */}
      <div className="flex items-center justify-between">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${seg.cls}`} />
            <span className="text-xs text-muted-foreground">{seg.label}</span>
            <span className="text-xs font-semibold">{seg.count}</span>
          </div>
        ))}
      </div>

      {/* 逾期警示 */}
      {tasks.overdue > 0 && (
        <div className="mt-4 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
          <span>🔴</span>
          <span>{tasks.overdue} 项任务已逾期</span>
        </div>
      )}
    </div>
  )
}

function ToolRanking({ topTools, solution }: {
  topTools: { toolId: string; count: number }[]
  solution: SolutionConfig
}) {
  const maxCount = Math.max(...topTools.map(t => t.count), 1)

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        常用工具排行
      </h4>
      <div className="space-y-3">
        {topTools.map((t, i) => {
          const tool = solution.tools.find(st => st.id === t.toolId)
          return (
            <div key={t.toolId} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
              <span className="text-base">{tool?.icon || '🔧'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm truncate">{tool?.name || t.toolId}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{t.count} 次</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary/30 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(t.count / maxCount) * 100}%`,
                      backgroundColor: solution.color,
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
