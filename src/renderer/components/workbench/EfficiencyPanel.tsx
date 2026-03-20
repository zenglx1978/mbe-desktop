// 效率测量面板 — MBE Desktop 成本收益报告 + 自动效率优化
// 核心功能：展示"用 MBE 前"vs"用 MBE 后"的时间对比，量化 ROI
// 扩展功能：展示 ProactiveNotifier 的优化建议、已启用规则、仪表盘

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '@/stores/app-store'
import { authFetch, API_BASE } from '@/lib/api-client'
import {
  Clock, TrendingUp, BarChart3, Download, Timer, ArrowRight,
  Lightbulb, Zap, CheckCircle2, XCircle, Eye, Settings2, Sparkles,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface CostBenefitReport {
  solutionId: string
  period: string
  taskCount: number
  totalManualMs: number
  totalAssistedMs: number
  savedMs: number
  savedPercent: number
  tasks: {
    name: string
    count: number
    avgManualMs: number
    avgAssistedMs: number
    savedPercent: number
  }[]
}

interface OptSuggestion {
  suggestion_id: string
  step_type: string
  step_display_name: string
  current_avg_seconds: number
  estimated_ai_seconds: number
  speedup_ratio: number
  matched_agent: string
  matched_capabilities: string[]
  confidence: number
  estimated_monthly_savings: number
  estimated_time_saved_hours: number
  score_pct: number
  status: string
  created_at: string
}

interface OptRule {
  rule_id: string
  step_type: string
  target_agent: string
  trigger_mode: string
  total_executions: number
  total_time_saved_seconds: number
  total_cost_saved: number
}

interface OptDashboard {
  summary: {
    total_cost_saved: number
    total_time_saved_hours: number
    active_rules: number
    pending_suggestions: number
    auto_mode: boolean
  }
  active_rules: OptRule[]
  pending_suggestions: OptSuggestion[]
  step_aggregates: { step_type: string; count: number; avg_ms: number }[]
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}秒`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}分钟`
  return `${(ms / 3600000).toFixed(1)}小时`
}

export default function EfficiencyPanel() {
  const { solutionId, currentSolution } = useAppStore()
  const solution = currentSolution()
  const [report, setReport] = useState<CostBenefitReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30)
  const [optDashboard, setOptDashboard] = useState<OptDashboard | null>(null)
  const [optLoading, setOptLoading] = useState(false)

  const agentName = solution?.agents?.[0]?.id || ''

  const loadReport = useCallback(async () => {
    if (!solutionId) return
    setLoading(true)
    try {
      const api = window.electronAPI
      if (api?.miner?.costBenefitReport) {
        const data = await api.miner.costBenefitReport(solutionId, period)
        setReport(data)
      }
    } catch {
      // Expected: Electron miner.costBenefitReport 不可用或抛错；面板无报告数据
    } finally {
      setLoading(false)
    }
  }, [solutionId, period])

  const loadOptDashboard = useCallback(async () => {
    if (!agentName) return
    setOptLoading(true)
    try {
      const res = await authFetch(`${API_BASE}/api/${agentName}/optimization/dashboard`)
      if (res.ok) setOptDashboard(await res.json())
    } catch {
      // Expected: 优化看板 HTTP 不可达；静默降级无仪表盘
    } finally {
      setOptLoading(false)
    }
  }, [agentName])

  const handleAccept = useCallback(async (suggestionId: string) => {
    if (!agentName) return
    try {
      const res = await authFetch(
        `${API_BASE}/api/${agentName}/optimization/suggestions/${suggestionId}/accept`,
        { method: 'POST' },
      )
      if (res.ok) loadOptDashboard()
    } catch {
      // Expected: 接受建议 API 失败；不刷新仪表盘
    }
  }, [agentName, loadOptDashboard])

  const handleDismiss = useCallback(async (suggestionId: string) => {
    if (!agentName) return
    try {
      const res = await authFetch(
        `${API_BASE}/api/${agentName}/optimization/suggestions/${suggestionId}/dismiss`,
        { method: 'POST' },
      )
      if (res.ok) loadOptDashboard()
    } catch {
      // Expected: 忽略建议 API 失败；不刷新仪表盘
    }
  }, [agentName, loadOptDashboard])

  useEffect(() => { loadReport() }, [loadReport])
  useEffect(() => { loadOptDashboard() }, [loadOptDashboard])

  const periodClickHandlers = useMemo(
    () =>
      ({
        7: () => setPeriod(7),
        30: () => setPeriod(30),
        90: () => setPeriod(90),
      }) as Record<number, () => void>,
    [],
  )

  const summaryBarData = useMemo(
    () =>
      report
        ? [
            {
              label: '总耗时',
              human: report.totalManualMs / 1000,
              mbe: report.totalAssistedMs / 1000,
            },
          ]
        : [],
    [report],
  )

  const taskBarData = useMemo(
    () =>
      report?.tasks.map((t) => ({
        name: t.name.length > 10 ? t.name.slice(0, 10) + '…' : t.name,
        fullName: t.name,
        human: t.avgManualMs / 1000,
        mbe: t.avgAssistedMs / 1000,
        saved: t.savedPercent,
        count: t.count,
      })) ?? [],
    [report],
  )

  const handleExportReport = useCallback(() => {
    if (report) exportReport(report)
  }, [report])

  if (!solution) return null

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              效率报告 · 成本收益分析
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              对比使用 MBE 前后的操作耗时，量化 AI 专家带来的效率提升
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={periodClickHandlers[d]}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  period === d
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/50'
                }`}
              >
                {d}天
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Timer className="w-5 h-5 animate-spin mr-2" />
            加载效率数据...
          </div>
        ) : !report || report.taskCount === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* 概览统计卡片 */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="总操作次数"
                value={report.taskCount.toString()}
                icon={<Clock className="w-4 h-4" />}
              />
              <StatCard
                label="人工总耗时"
                value={formatDuration(report.totalManualMs)}
                icon={<Timer className="w-4 h-4" />}
                sublabel="不用 MBE"
              />
              <StatCard
                label="MBE 总耗时"
                value={formatDuration(report.totalAssistedMs)}
                icon={<TrendingUp className="w-4 h-4" />}
                sublabel="使用 MBE"
                highlight
              />
              <StatCard
                label="效率提升"
                value={`${report.savedPercent}%`}
                icon={<BarChart3 className="w-4 h-4" />}
                sublabel={`节省 ${formatDuration(report.savedMs)}`}
                highlight
              />
            </div>

            {/* 时间对比 — recharts 分组柱状图 */}
            <div className="rounded-xl border border-border/50 bg-card p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">时间对比</h3>
                <span className="text-xs text-emerald-600 font-medium">节省 {report.savedPercent}%</span>
              </div>
              <ResponsiveContainer width="100%" height={56}>
                <BarChart
                  data={summaryBarData}
                  layout="vertical"
                  margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" hide />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.length) return null
                      return (
                        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                          {payload.map(p => (
                            <p key={p.dataKey as string}>
                              <span style={{ color: p.color }}>{p.name}</span>：{formatDuration((p.value as number) * 1000)}
                            </p>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(v: string) => <span className="text-muted-foreground text-[11px]">{v}</span>}
                  />
                  <Bar dataKey="human" name="人工" fill="hsl(0 72% 51% / 0.5)" radius={[0, 4, 4, 0]} barSize={14} />
                  <Bar dataKey="mbe" name="MBE" fill="hsl(160 84% 39% / 0.6)" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 分任务效率 — recharts 分组柱状图 */}
            {report.tasks.length > 0 && (
              <div className="rounded-xl border border-border/50 bg-card">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
                  <h3 className="text-sm font-semibold text-foreground">各任务效率明细</h3>
                  <button
                    type="button"
                    onClick={handleExportReport}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    导出报告
                  </button>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={Math.max(120, report.tasks.length * 52)}>
                    <BarChart
                      data={taskBarData}
                      layout="vertical"
                      margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => formatDuration(v * 1000)}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={90}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ payload }) => {
                          if (!payload?.length) return null
                          const d = payload[0].payload as { fullName: string; human: number; mbe: number; saved: number; count: number }
                          return (
                            <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                              <p className="font-medium mb-1">{d.fullName}（{d.count}次）</p>
                              <p>人工：{formatDuration(d.human * 1000)}</p>
                              <p className="text-primary">MBE：{formatDuration(d.mbe * 1000)}</p>
                              <p className="text-emerald-600 font-bold mt-1">节省 {d.saved}%</p>
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="human" name="人工" fill="hsl(0 72% 51% / 0.4)" radius={[0, 3, 3, 0]} barSize={10} />
                      <Bar dataKey="mbe" name="MBE" fill="hsl(160 84% 39% / 0.55)" radius={[0, 3, 3, 0]} barSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}

        {/* ======== 自动效率优化区域 ======== */}
        {optDashboard && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-foreground">智能优化</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                AI 自动发现
              </span>
            </div>

            {/* 优化总览 */}
            {(optDashboard.summary.active_rules > 0 || optDashboard.summary.pending_suggestions > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <StatCard
                  label="累计节省"
                  value={`¥${optDashboard.summary.total_cost_saved.toLocaleString()}`}
                  icon={<TrendingUp className="w-4 h-4" />}
                  highlight
                />
                <StatCard
                  label="释放时间"
                  value={`${optDashboard.summary.total_time_saved_hours}h`}
                  icon={<Clock className="w-4 h-4" />}
                />
                <StatCard
                  label="已优化步骤"
                  value={optDashboard.summary.active_rules.toString()}
                  icon={<CheckCircle2 className="w-4 h-4" />}
                />
                <StatCard
                  label="待确认建议"
                  value={optDashboard.summary.pending_suggestions.toString()}
                  icon={<Lightbulb className="w-4 h-4" />}
                  sublabel={optDashboard.summary.auto_mode ? '自动模式已开启' : undefined}
                />
              </div>
            )}

            {/* 优化建议卡片 */}
            {optDashboard.pending_suggestions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  发现优化机会
                </h3>
                {optDashboard.pending_suggestions.map((s) => (
                  <SuggestionCard
                    key={s.suggestion_id}
                    suggestion={s}
                    onAccept={handleAccept}
                    onDismiss={handleDismiss}
                  />
                ))}
              </div>
            )}

            {/* 已启用规则 */}
            {optDashboard.active_rules.length > 0 && (
              <div className="rounded-xl border border-border/50 bg-card">
                <div className="px-5 py-3 border-b border-border/30">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-500" />
                    已启用的 AI 接管
                  </h3>
                </div>
                <div className="divide-y divide-border/20">
                  {optDashboard.active_rules.map((rule) => (
                    <div key={rule.rule_id} className="flex items-center gap-4 px-5 py-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{rule.step_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {rule.target_agent} · {rule.total_executions} 次执行
                          {rule.trigger_mode === 'auto_silent' && ' · 自动模式'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-emerald-600">
                          省 {(rule.total_time_saved_seconds / 3600).toFixed(1)}h
                        </p>
                        {rule.total_cost_saved > 0 && (
                          <p className="text-xs text-muted-foreground">
                            ¥{rule.total_cost_saved.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SuggestionCard({ suggestion, onAccept, onDismiss }: {
  suggestion: OptSuggestion
  onAccept: (suggestionId: string) => void | Promise<void>
  onDismiss: (suggestionId: string) => void | Promise<void>
}) {
  const currentTime = suggestion.current_avg_seconds >= 3600
    ? `${(suggestion.current_avg_seconds / 3600).toFixed(1)} 小时`
    : suggestion.current_avg_seconds >= 60
      ? `${(suggestion.current_avg_seconds / 60).toFixed(0)} 分钟`
      : `${suggestion.current_avg_seconds.toFixed(0)} 秒`
  const aiTime = suggestion.estimated_ai_seconds >= 60
    ? `${(suggestion.estimated_ai_seconds / 60).toFixed(0)} 分钟`
    : `${suggestion.estimated_ai_seconds.toFixed(0)} 秒`

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
          <Lightbulb className="w-5 h-5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            「{suggestion.step_display_name}」
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            你平均每次花 <span className="font-medium text-foreground">{currentTime}</span>
            ，AI 可以在 <span className="font-medium text-primary">{aiTime}</span> 完成
            （快 <span className="font-bold text-primary">{suggestion.speedup_ratio}x</span>）
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>预估月省 <strong className="text-emerald-600">¥{suggestion.estimated_monthly_savings.toLocaleString()}</strong></span>
            <span>·</span>
            <span>释放 <strong>{suggestion.estimated_time_saved_hours}h</strong>/月</span>
            <span>·</span>
            <span>置信度 {(suggestion.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => void onAccept(suggestion.suggestion_id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              立即启用
            </button>
            <button
              type="button"
              onClick={() => void onDismiss(suggestion.suggestion_id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary/50 transition-colors"
            >
              下次再说
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sublabel, icon, highlight }: {
  label: string
  value: string
  sublabel?: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${
      highlight ? 'border-primary/25 bg-primary/5' : 'border-border/50 bg-card'
    }`}>
      <div className={`flex items-center gap-2 mb-2 text-xs ${
        highlight ? 'text-primary' : 'text-muted-foreground'
      }`}>
        {icon}
        {label}
      </div>
      <p className={`text-2xl font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      {sublabel && (
        <p className="text-[10px] text-muted-foreground mt-1">{sublabel}</p>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <BarChart3 className="w-12 h-12 text-muted-foreground/20 mb-4" />
      <p className="text-muted-foreground font-medium">暂无效率数据</p>
      <p className="text-muted-foreground/50 text-sm mt-2 max-w-md">
        使用 MBE 处理业务后，系统会自动记录操作耗时。
        数据积累后，您将看到详细的成本收益分析报告。
      </p>
    </div>
  )
}

function exportReport(report: CostBenefitReport) {
  const lines = [
    `MBE 效率报告 — ${report.period}`,
    `方案: ${report.solutionId}`,
    `总操作: ${report.taskCount} 次`,
    `人工总耗时: ${formatDuration(report.totalManualMs)}`,
    `MBE 总耗时: ${formatDuration(report.totalAssistedMs)}`,
    `节省: ${formatDuration(report.savedMs)} (${report.savedPercent}%)`,
    '',
    '任务明细:',
    ...report.tasks.map((t) =>
      `  ${t.name}: ${formatDuration(t.avgManualMs)} → ${formatDuration(t.avgAssistedMs)} (省 ${t.savedPercent}%, ${t.count}次)`
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `MBE效率报告_${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
