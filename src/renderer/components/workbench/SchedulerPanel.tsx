import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/app-store'
import type { SolutionConfig } from '@/lib/solution-router'
import {
  fetchSchedulerStatus,
  fetchSchedulerJobs,
  fetchSchedulerExecutions,
  pauseSchedulerJob,
  resumeSchedulerJob,
  triggerSchedulerJob,
  cleanupSchedulerExecutions,
  type SchedulerStatusDef,
  type SchedulerJobDef,
  type SchedulerExecutionDef,
} from '@/lib/workflow-os-service'

interface Props {
  solution: SolutionConfig
}

export default function SchedulerPanel({ solution }: Props) {
  const agentName = solution.agents[0]?.id || 'finance'

  const [status, setStatus] = useState<SchedulerStatusDef | null>(null)
  const [jobs, setJobs] = useState<SchedulerJobDef[]>([])
  const [executions, setExecutions] = useState<SchedulerExecutionDef[]>([])
  const [selectedJob, setSelectedJob] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string>('')
  const [tab, setTab] = useState<'jobs' | 'executions'>('jobs')

  const refresh = useCallback(async () => {
    setLoading(true)
    const [s, j, e] = await Promise.all([
      fetchSchedulerStatus(agentName),
      fetchSchedulerJobs(agentName),
      fetchSchedulerExecutions(agentName, selectedJob, 100),
    ])
    setStatus(s)
    setJobs(j)
    setExecutions(e)
    setLoading(false)
  }, [agentName, selectedJob])

  useEffect(() => { refresh() }, [refresh])

  const handlePause = async (jobId: string) => {
    setActionLoading(jobId)
    await pauseSchedulerJob(agentName, jobId)
    await refresh()
    setActionLoading('')
  }

  const handleResume = async (jobId: string) => {
    setActionLoading(jobId)
    await resumeSchedulerJob(agentName, jobId)
    await refresh()
    setActionLoading('')
  }

  const handleTrigger = async (jobId: string) => {
    setActionLoading(jobId)
    await triggerSchedulerJob(agentName, jobId)
    await refresh()
    setActionLoading('')
  }

  const handleCleanup = async () => {
    setActionLoading('cleanup')
    const result = await cleanupSchedulerExecutions(agentName)
    if (result.deleted > 0) await refresh()
    setActionLoading('')
  }

  const fmtTime = (iso: string | null) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

  const statusBadge = (s: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      active: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
      paused: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
      removed: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500' },
      running: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
      completed: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
      failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
    }
    const colors = map[s] || map.removed
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
        {s}
      </span>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* 头部状态概览 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">定时调度</h2>
          <p className="text-sm text-muted-foreground">管理定时工作流 Job — 查看状态、手动触发、执行历史</p>
        </div>
        <button onClick={refresh} disabled={loading} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-colors">
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {/* 状态卡片 */}
      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatusCard label="后端" value={status.backend} icon="⚡" />
          <StatusCard label="活跃 Job" value={status.active_jobs} icon="▶" />
          <StatusCard label="暂停 Job" value={status.paused_jobs} icon="⏸" />
          <StatusCard label="持久化" value={status.persistent_store ? '已启用' : '内存'} icon="💾" />
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex gap-1 border-b border-border">
        {(['jobs', 'executions'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'jobs' ? `Job 列表 (${jobs.length})` : `执行历史 (${executions.length})`}
          </button>
        ))}
      </div>

      {/* Jobs 列表 */}
      {tab === 'jobs' && (
        <div className="space-y-3">
          {jobs.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground">暂无定时工作流</div>
          )}
          {jobs.map(job => (
            <div
              key={job.job_id}
              className={`p-4 rounded-xl border transition-colors ${
                selectedJob === job.job_id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-foreground truncate">{job.name}</span>
                    {statusBadge(job.status)}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span title="Cron 表达式">🕐 {job.cron_expr}</span>
                    <span>已执行 {job.run_count} 次</span>
                    {job.error_count > 0 && <span className="text-red-500">{job.error_count} 次失败</span>}
                    {job.last_run_at && <span>上次: {fmtTime(job.last_run_at)}</span>}
                    {job.next_run_at && <span>下次: {fmtTime(job.next_run_at)}</span>}
                  </div>
                  {job.description && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{job.description}</p>
                  )}
                  {job.last_error && (
                    <p className="text-xs text-red-500 mt-1 truncate" title={job.last_error}>
                      最后错误: {job.last_error}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleTrigger(job.job_id)}
                    disabled={actionLoading === job.job_id}
                    className="px-2.5 py-1 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="手动触发"
                  >
                    ▶ 触发
                  </button>
                  {job.status === 'active' ? (
                    <button
                      onClick={() => handlePause(job.job_id)}
                      disabled={actionLoading === job.job_id}
                      className="px-2.5 py-1 text-xs rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 transition-colors"
                    >
                      ⏸ 暂停
                    </button>
                  ) : job.status === 'paused' ? (
                    <button
                      onClick={() => handleResume(job.job_id)}
                      disabled={actionLoading === job.job_id}
                      className="px-2.5 py-1 text-xs rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 transition-colors"
                    >
                      ▶ 恢复
                    </button>
                  ) : null}
                  <button
                    onClick={() => setSelectedJob(selectedJob === job.job_id ? '' : job.job_id)}
                    className="px-2.5 py-1 text-xs rounded-md border border-border hover:bg-muted transition-colors"
                  >
                    📋 历史
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 执行历史 */}
      {tab === 'executions' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedJob && (
                <button onClick={() => setSelectedJob('')} className="text-xs text-primary hover:underline">
                  清除筛选
                </button>
              )}
            </div>
            <button
              onClick={handleCleanup}
              disabled={actionLoading === 'cleanup'}
              className="px-3 py-1 text-xs rounded-md border border-border hover:bg-muted transition-colors"
            >
              🧹 清理过期
            </button>
          </div>

          {executions.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground">暂无执行记录</div>
          )}

          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {executions.map(exec => (
              <div key={exec.execution_id} className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {statusBadge(exec.status)}
                    <span className="text-xs text-muted-foreground">{exec.job_id.replace('sched_', '')}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span>{fmtTime(exec.triggered_at)}</span>
                    {exec.instance_id && <span>实例: {exec.instance_id}</span>}
                    {exec.final_workflow_status && <span>结果: {exec.final_workflow_status}</span>}
                    {exec.progress_percent > 0 && <span>{exec.progress_percent}%</span>}
                  </div>
                  {exec.error && (
                    <p className="text-xs text-red-500 mt-0.5 truncate">{exec.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-xl border border-border p-3 flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{String(value)}</p>
      </div>
    </div>
  )
}
