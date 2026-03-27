/**
 * 调度器面板 — QuickBooks "Recurring Transactions" 对标
 *
 * 定期自动交易：设置一次，按 cron 触发工作流，用户只需审批结果。
 * 电商场景：月度结算自动生成、客服绩效定期采集、ERP 批量同步。
 */
import { useState, useMemo, useCallback } from 'react'
import { Calendar, Play, Clock, CheckCircle2, AlertCircle, Zap, X } from 'lucide-react'
import type { SolutionConfig } from '@/lib/solution-router'

export interface ScheduledJob {
  id: string
  name: string
  description: string
  cron: string
  cronHuman: string
  workflowId?: string
  enabled: boolean
  lastRun?: string
  lastStatus?: 'success' | 'failed' | 'running'
  nextRun?: string
  category: 'settlement' | 'data_sync' | 'report' | 'maintenance'
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  settlement: { label: '结算', color: '#22c55e' },
  data_sync: { label: '数据同步', color: '#3b82f6' },
  report: { label: '报表', color: '#8b5cf6' },
  maintenance: { label: '维护', color: '#f59e0b' },
}

const DEFAULT_JOBS: ScheduledJob[] = [
  {
    id: 'monthly_settlement',
    name: '月度品牌服务结算',
    description: '每月 5 号自动运行结算工作流，汇总上月各品牌 GMV 并计算佣金',
    cron: '0 9 5 * *',
    cronHuman: '每月 5 日 09:00',
    workflowId: 'monthly_settlement',
    enabled: false,
    category: 'settlement',
  },
  {
    id: 'cs_performance',
    name: '客服绩效数据采集',
    description: '每周一自动采集各品牌客服工单量、响应时长、满意度指标',
    cron: '0 8 * * 1',
    cronHuman: '每周一 08:00',
    workflowId: 'cs_performance_collect',
    enabled: false,
    category: 'data_sync',
  },
  {
    id: 'erp_sync',
    name: 'ERP 订单数据同步',
    description: '每日凌晨从聚水潭/旺店通同步前日订单和退款数据',
    cron: '0 2 * * *',
    cronHuman: '每日 02:00',
    enabled: false,
    category: 'data_sync',
  },
  {
    id: 'weekly_report',
    name: '周度经营报告生成',
    description: '每周五自动生成各品牌周度经营数据汇总',
    cron: '0 17 * * 5',
    cronHuman: '每周五 17:00',
    enabled: false,
    category: 'report',
  },
  {
    id: 'contract_reminder',
    name: '合同到期提醒',
    description: '每月 1 号检查所有品牌合同到期日，提前 30 天预警',
    cron: '0 9 1 * *',
    cronHuman: '每月 1 日 09:00',
    enabled: false,
    category: 'maintenance',
  },
  {
    id: 'reconciliation_check',
    name: '对账差异巡检',
    description: '每月 10 号自动检查未完成对账的结算单，标记超期项',
    cron: '0 10 10 * *',
    cronHuman: '每月 10 日 10:00',
    enabled: false,
    category: 'settlement',
  },
]

const STORAGE_KEY = 'mbe-scheduler-jobs'

function loadJobs(): ScheduledJob[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return DEFAULT_JOBS
}

function saveJobs(jobs: ScheduledJob[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
}

interface Props {
  solution: SolutionConfig
}

const RECOMMENDED_IDS = ['monthly_settlement', 'erp_sync', 'cs_performance']

export default function SchedulerPanel({ solution }: Props) {
  const [jobs, setJobs] = useState<ScheduledJob[]>(loadJobs)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCron, setEditCron] = useState('')
  const [dismissedRecommend, setDismissedRecommend] = useState(false)

  const enabledCount = useMemo(() => jobs.filter((j) => j.enabled).length, [jobs])

  const showRecommendation = useMemo(
    () => !dismissedRecommend && enabledCount === 0,
    [dismissedRecommend, enabledCount],
  )

  const enableRecommended = useCallback(() => {
    setJobs((prev) => {
      const next = prev.map((j) => (RECOMMENDED_IDS.includes(j.id) ? { ...j, enabled: true } : j))
      saveJobs(next)
      return next
    })
    setDismissedRecommend(true)
  }, [])
  const categories = useMemo(() => {
    const cats = new Set(jobs.map((j) => j.category))
    return Array.from(cats)
  }, [jobs])

  const toggleJob = useCallback((id: string) => {
    setJobs((prev) => {
      const next = prev.map((j) => (j.id === id ? { ...j, enabled: !j.enabled } : j))
      saveJobs(next)
      return next
    })
  }, [])

  const updateCron = useCallback((id: string, cronHuman: string) => {
    setJobs((prev) => {
      const next = prev.map((j) => (j.id === id ? { ...j, cronHuman } : j))
      saveJobs(next)
      return next
    })
    setEditingId(null)
  }, [])

  const runNow = useCallback((id: string) => {
    setJobs((prev) => {
      const next = prev.map((j) =>
        j.id === id ? { ...j, lastRun: new Date().toISOString(), lastStatus: 'running' as const } : j,
      )
      saveJobs(next)
      return next
    })
    setTimeout(() => {
      setJobs((prev) => {
        const next = prev.map((j) =>
          j.id === id && j.lastStatus === 'running' ? { ...j, lastStatus: 'success' as const } : j,
        )
        saveJobs(next)
        return next
      })
    }, 2000)
  }, [])

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 头部 */}
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5" style={{ color: solution.color }} />
            定期任务调度
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            设置一次，自动执行。{enabledCount}/{jobs.length} 个任务已启用。
          </p>
        </div>

        {/* 汇总 */}
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(CATEGORY_META).map(([key, meta]) => {
            const count = jobs.filter((j) => j.category === key && j.enabled).length
            const total = jobs.filter((j) => j.category === key).length
            return (
              <div key={key} className="p-3 rounded-xl border border-border/30 bg-card">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className="text-[10px] text-muted-foreground uppercase">{meta.label}</span>
                </div>
                <p className="text-lg font-bold">{count}<span className="text-xs text-muted-foreground font-normal">/{total}</span></p>
              </div>
            )
          })}
        </div>

        {/* 推荐开启横幅 */}
        {showRecommendation && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
            <Zap className="w-5 h-5 shrink-0" style={{ color: solution.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">建议开启核心任务</p>
              <p className="text-xs text-muted-foreground mt-0.5">一键启用「月度结算 + ERP 同步 + 客服绩效」，覆盖 80% 日常运营自动化</p>
            </div>
            <button
              type="button"
              onClick={enableRecommended}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white shrink-0"
              style={{ backgroundColor: solution.color }}
            >
              一键开启
            </button>
            <button type="button" onClick={() => setDismissedRecommend(true)} className="p-1 hover:bg-muted/50 rounded shrink-0">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* 任务列表 */}
        {categories.map((cat) => {
          const catJobs = jobs.filter((j) => j.category === cat)
          const meta = CATEGORY_META[cat]
          return (
            <div key={cat} className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                {meta.label}
              </h3>
              {catJobs.map((job) => (
                <div key={job.id} className={`flex items-center gap-4 p-4 rounded-xl border bg-card transition-all ${
                  job.enabled ? 'border-primary/20' : 'border-border/30 opacity-60'
                }`}>
                  {/* 开关 */}
                  <button
                    type="button"
                    onClick={() => toggleJob(job.id)}
                    className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${
                      job.enabled ? '' : 'bg-secondary/50'
                    }`}
                    style={job.enabled ? { backgroundColor: solution.color } : undefined}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      job.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`} />
                  </button>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold truncate">{job.name}</h4>
                      {job.lastStatus === 'running' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 animate-pulse">运行中</span>
                      )}
                      {job.lastStatus === 'success' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      )}
                      {job.lastStatus === 'failed' && (
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{job.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {editingId === job.id ? (
                          <input
                            type="text"
                            value={editCron}
                            onChange={(e) => setEditCron(e.target.value)}
                            onBlur={() => updateCron(job.id, editCron)}
                            onKeyDown={(e) => e.key === 'Enter' && updateCron(job.id, editCron)}
                            className="w-32 px-1.5 py-0.5 rounded border border-border/50 bg-secondary/20 text-xs outline-none"
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setEditingId(job.id); setEditCron(job.cronHuman) }}
                            className="hover:text-foreground underline-offset-2 hover:underline"
                          >
                            {job.cronHuman}
                          </button>
                        )}
                      </span>
                      {job.lastRun && (
                        <span>上次: {new Date(job.lastRun).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  </div>

                  {/* 操作 */}
                  <button
                    type="button"
                    onClick={() => runNow(job.id)}
                    disabled={job.lastStatus === 'running'}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border/40 hover:bg-primary/5 hover:border-primary/30 transition-colors disabled:opacity-40 flex items-center gap-1 shrink-0"
                  >
                    <Play className="w-3 h-3" /> 立即执行
                  </button>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
