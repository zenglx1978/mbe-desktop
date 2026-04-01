/**
 * ScheduleManager — AI 专家定时巡检管理页面
 *
 * Anthropic Schedule + Dispatch + SelfHeal 的统一管理界面：
 *   - 从预置模板一键创建（税务日历、合同预警、投资晨报）
 *   - 管理所有活跃/暂停的 Schedule
 *   - 查看执行历史和自纠错链路
 *   - Dispatch 远程连接状态
 */
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar, Play, Pause, Trash2, Clock, CheckCircle2, AlertCircle,
  Zap, ArrowLeft, History, Radio, Plus, RefreshCw, Loader2, Database,
  Settings2, X, Activity,
} from 'lucide-react'
import {
  useScheduleStore, usePipelineStore, useTemplateMarketStore,
  type ScheduleItem, type CreateScheduleData,
  type PipelineItem, type PipelineRunItem, type MarketTemplate,
} from '@/stores/schedule-store'
import { useDispatchStore } from '@/stores/dispatch-store'
import { useAppStore } from '@/stores/app-store'
import {
  type StateData, type Snapshot,
  detectWidgets, KpiCard, CountdownCard, ProgressRing,
  ActionList, TrendChart,
} from '@/components/workbench/StateWidgets'

const STATUS_BADGE: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active: { label: '运行中', color: '#22c55e', icon: CheckCircle2 },
  paused: { label: '已暂停', color: '#f59e0b', icon: Pause },
  disabled: { label: '已禁用', color: '#6b7280', icon: AlertCircle },
  error: { label: '异常', color: '#ef4444', icon: AlertCircle },
}

const EXEC_STATUS: Record<string, { label: string; color: string }> = {
  completed: { label: '成功', color: '#22c55e' },
  self_healed: { label: '自修复', color: '#3b82f6' },
  failed: { label: '失败', color: '#ef4444' },
  awaiting_user: { label: '待补充', color: '#f59e0b' },
  pending: { label: '排队中', color: '#6b7280' },
}

const FREQ_OPTIONS = [
  { value: 'hourly', label: '每小时' },
  { value: 'daily', label: '每天' },
  { value: 'weekdays', label: '工作日' },
  { value: 'weekly', label: '每周' },
  { value: 'biweekly', label: '每半月' },
  { value: 'monthly', label: '每月' },
  { value: 'quarterly', label: '每季度' },
  { value: 'custom', label: '自定义 Cron' },
]

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function describeSchedule(sc: ScheduleItem): string {
  if (sc.frequency === 'custom' && sc.cron_expr) return `Cron: ${sc.cron_expr}`
  if (sc.weekdays?.length > 0) {
    const days = sc.weekdays.map((d) => `周${WEEKDAY_LABELS[d]}`).join('/')
    return `${days} ${String(sc.preferred_hour).padStart(2, '0')}:${String(sc.preferred_minute).padStart(2, '0')}`
  }
  if (sc.monthdays?.length > 0) {
    const days = sc.monthdays.join(', ')
    return `每月 ${days} 号 ${String(sc.preferred_hour).padStart(2, '0')}:${String(sc.preferred_minute).padStart(2, '0')}`
  }
  const freqLabel = FREQ_OPTIONS.find((f) => f.value === sc.frequency)?.label || sc.frequency
  return `${freqLabel} ${String(sc.preferred_hour).padStart(2, '0')}:${String(sc.preferred_minute).padStart(2, '0')}`
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function StatePanel({ stateData, color }: { stateData: Record<string, unknown> | null; color: string }) {
  const snapshots = useMemo(
    () => (stateData ? ((stateData as StateData).snapshots || []) as Snapshot[] : []),
    [stateData],
  )

  const snapshotKeys = useMemo(() => {
    if (snapshots.length < 2) return []
    const allKeys = new Set<string>()
    snapshots.forEach((s) => { Object.keys(s.m || {}).forEach((k) => allKeys.add(k)) })
    return Array.from(allKeys)
  }, [snapshots])

  if (!stateData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Database className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm">暂无业务记忆</p>
        <p className="text-xs mt-1">Schedule 执行后会自动积累上下文</p>
      </div>
    )
  }

  const state = stateData as StateData
  const widgets = detectWidgets(state)
  const pendingActions = (state.pending_actions || []) as Array<Record<string, unknown>>
  const lastSummary = state.last_result_summary as string | undefined

  const kpiWidgets = widgets.filter((w) => w.type === 'kpi')
  const countdownWidgets = widgets.filter((w) => w.type === 'countdown')
  const progressWidgets = widgets.filter((w) => w.type === 'progress')
  const textWidgets = widgets.filter((w) => w.type === 'text' || w.type === 'list')

  const hasContent = widgets.length > 0 || snapshots.length > 0 || pendingActions.length > 0 || lastSummary

  if (!hasContent) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Database className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm">业务记忆为空</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold flex items-center gap-2">
        <Database className="w-4 h-4" style={{ color }} />
        业务记忆
      </h2>
      <p className="text-xs text-muted-foreground">
        AI 专家每次执行后积累的业务上下文，让下次执行更有连续性。
      </p>

      {/* 上次执行摘要 */}
      {lastSummary && (
        <div className="p-3 rounded-xl border border-border/30 bg-card">
          <p className="text-[10px] text-muted-foreground mb-1">上次执行摘要</p>
          <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{lastSummary}</p>
        </div>
      )}

      {/* KPI 卡片网格 */}
      {kpiWidgets.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {kpiWidgets.map((w) => (
            <KpiCard
              key={w.key}
              label={w.label}
              value={w.value as number}
              trendData={w.trendData}
              color={color}
            />
          ))}
        </div>
      )}

      {/* 倒计时 */}
      {countdownWidgets.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {countdownWidgets.map((w) => (
            <CountdownCard
              key={w.key}
              label={w.label}
              targetDate={String(w.value)}
              color={color}
            />
          ))}
        </div>
      )}

      {/* 进度条 */}
      {progressWidgets.length > 0 && (
        <div className="space-y-2">
          {progressWidgets.map((w) => {
            const val = w.value as number
            return (
              <div key={w.key} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card">
                <ProgressRing value={val} color={color} />
                <div>
                  <p className="text-xs font-medium">{w.label}</p>
                  <p className="text-[10px] text-muted-foreground">{val}%</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 趋势图表（来自 snapshots） */}
      {snapshotKeys.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold flex items-center gap-1.5 text-muted-foreground">
            <Activity className="w-3.5 h-3.5" />
            指标趋势
          </h3>
          {snapshotKeys.map((key) => (
            <TrendChart
              key={key}
              snapshots={snapshots}
              metricKey={key}
              label={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              color={color}
            />
          ))}
        </div>
      )}

      {/* 待办事项 */}
      {pendingActions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5" />
            待办事项（{pendingActions.filter((a) => a.status === 'pending').length} 项待处理）
          </h3>
          <ActionList actions={pendingActions} color={color} />
        </div>
      )}

      {/* 其他文本字段 */}
      {textWidgets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground">其他上下文</h3>
          {textWidgets.map((w) => (
            <div key={w.key} className="p-3 rounded-xl border border-border/30 bg-card">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">{w.key}</div>
              <div className="text-xs text-foreground/80 whitespace-pre-wrap break-all leading-relaxed">
                {typeof w.value === 'object' ? JSON.stringify(w.value, null, 2) : String(w.value)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ScheduleManager() {
  const navigate = useNavigate()
  const solution = useAppStore((s) => s.currentSolution())
  const agentName = solution?.agents?.[0]?.id || 'finance'

  const {
    schedules, presets, history, stateData, loading, error,
    fetchSchedules, fetchPresets, createFromPreset, createSchedule,
    pauseSchedule, resumeSchedule, deleteSchedule,
    triggerExecution, fetchHistory, fetchState,
  } = useScheduleStore()

  const {
    pipelines, pipelinePresets, pipelineRuns, pipelineLoading, pipelineError,
    fetchPipelines, fetchPipelinePresets, createPipelineFromPreset, createPipeline,
    deletePipeline, runPipeline, fetchPipelineRuns,
  } = usePipelineStore()

  const { connectionStatus } = useDispatchStore()
  const {
    marketTemplates, marketLoading, marketError,
    fetchMarket, installTemplate: installMarketTemplate,
  } = useTemplateMarketStore()

  const [viewMode, setViewMode] = useState<'schedules' | 'pipelines' | 'market'>('schedules')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null)
  const [showPresets, setShowPresets] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    expert_id: '',
    prompt: '',
    frequency: 'daily',
    preferred_hour: 9,
    preferred_minute: 0,
    weekdays: [] as number[],
    monthdays: '' as string,
    cron_expr: '',
    watch_path: '',
    watch_file_types: '',
    auto_fill_target: '',
    auto_fill_type: 'write_text' as string,
  })

  useEffect(() => {
    fetchSchedules(agentName)
    fetchPresets(agentName)
    fetchPipelines(agentName)
    fetchPipelinePresets(agentName)
  }, [agentName, fetchSchedules, fetchPresets, fetchPipelines, fetchPipelinePresets])

  const handleCreatePreset = useCallback(async (presetId: string) => {
    const result = await createFromPreset(agentName, presetId)
    if (result) {
      setShowPresets(false)
      fetchSchedules(agentName)
    }
  }, [agentName, createFromPreset, fetchSchedules])

  const handleCustomCreate = useCallback(async () => {
    const data: CreateScheduleData = {
      agent_name: agentName,
      expert_id: formData.expert_id,
      name: formData.name,
      prompt: formData.prompt,
      frequency: formData.frequency,
      preferred_hour: formData.preferred_hour,
      preferred_minute: formData.preferred_minute,
    }
    if (formData.weekdays.length > 0) data.weekdays = formData.weekdays
    if (formData.monthdays.trim()) {
      data.monthdays = formData.monthdays.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n >= 1 && n <= 31)
    }
    if (formData.frequency === 'custom' && formData.cron_expr.trim()) {
      data.cron_expr = formData.cron_expr.trim()
    }
    if (formData.watch_path.trim()) {
      ;(data as any).watch_path = formData.watch_path.trim()
    }
    if (formData.watch_file_types.trim()) {
      ;(data as any).watch_file_types = formData.watch_file_types.split(',').map((s) => s.trim()).filter(Boolean)
    }
    if (formData.auto_fill_target.trim()) {
      ;(data as any).auto_fill_actions = [{
        action_type: formData.auto_fill_type,
        target_path: formData.auto_fill_target.trim(),
        data: { __result_summary__: '__result_summary__' },
      }]
    }
    const result = await createSchedule(agentName, data)
    if (result) {
      setShowCustomForm(false)
      setFormData({ name: '', expert_id: '', prompt: '', frequency: 'daily', preferred_hour: 9, preferred_minute: 0, weekdays: [], monthdays: '', cron_expr: '', watch_path: '', watch_file_types: '', auto_fill_target: '', auto_fill_type: 'write_text' })
      fetchSchedules(agentName)
    }
  }, [agentName, formData, createSchedule, fetchSchedules])

  const toggleWeekday = useCallback((day: number) => {
    setFormData((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day].sort(),
    }))
  }, [])

  const handleToggle = useCallback(async (sc: ScheduleItem) => {
    if (sc.status === 'active') {
      await pauseSchedule(agentName, sc.schedule_id)
    } else {
      await resumeSchedule(agentName, sc.schedule_id)
    }
  }, [agentName, pauseSchedule, resumeSchedule])

  const handleTrigger = useCallback(async (scheduleId: string) => {
    await triggerExecution(agentName, scheduleId)
    fetchSchedules(agentName)
  }, [agentName, triggerExecution, fetchSchedules])

  const handleDelete = useCallback(async (scheduleId: string) => {
    await deleteSchedule(agentName, scheduleId)
    if (selectedId === scheduleId) setSelectedId(null)
  }, [agentName, deleteSchedule, selectedId])

  const [showState, setShowState] = useState(false)

  const handleViewHistory = useCallback(async (scheduleId: string) => {
    setSelectedId(scheduleId)
    setShowState(false)
    await fetchHistory(agentName, scheduleId)
  }, [agentName, fetchHistory])

  const handleViewState = useCallback(async (scheduleId: string) => {
    setSelectedId(scheduleId)
    setShowState(true)
    await fetchState(agentName, scheduleId)
  }, [agentName, fetchState])

  const handleSelectPipeline = useCallback(async (pipelineId: string) => {
    setSelectedPipelineId(pipelineId)
    await fetchPipelineRuns(agentName, pipelineId)
  }, [agentName, fetchPipelineRuns])

  const handleRunPipeline = useCallback(async (pipelineId: string) => {
    await runPipeline(agentName, pipelineId)
    fetchPipelines(agentName)
    fetchPipelineRuns(agentName, pipelineId)
  }, [agentName, runPipeline, fetchPipelines, fetchPipelineRuns])

  const handleDeletePipeline = useCallback(async (pipelineId: string) => {
    await deletePipeline(agentName, pipelineId)
    if (selectedPipelineId === pipelineId) setSelectedPipelineId(null)
  }, [agentName, deletePipeline, selectedPipelineId])

  const handleCreatePipelinePreset = useCallback(async (presetId: string) => {
    await createPipelineFromPreset(agentName, presetId)
    fetchPipelines(agentName)
  }, [agentName, createPipelineFromPreset, fetchPipelines])

  const color = solution?.color || '#6366f1'

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 顶部栏 */}
      <header className="shrink-0 h-14 flex items-center gap-3 px-6 border-b border-border/50">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-muted/50 rounded-lg">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Calendar className="w-5 h-5" style={{ color }} />
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('schedules')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === 'schedules' ? 'bg-background font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            定时任务
          </button>
          <button
            onClick={() => setViewMode('pipelines')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === 'pipelines' ? 'bg-background font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Pipeline 编排
          </button>
          <button
            onClick={() => { setViewMode('market'); fetchMarket(agentName) }}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === 'market' ? 'bg-background font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            模板市场
          </button>
        </div>
        <div className="flex-1" />

        {/* Dispatch 连接状态 */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Radio className={`w-3.5 h-3.5 ${connectionStatus === 'connected' ? 'text-green-500' : 'text-muted-foreground'}`} />
          <span>{connectionStatus === 'connected' ? 'Dispatch 已连接' : 'Dispatch 未连接'}</span>
        </div>

        <button
          onClick={() => {
            fetchSchedules(agentName); fetchPresets(agentName)
            fetchPipelines(agentName); fetchPipelinePresets(agentName)
          }}
          className="p-1.5 hover:bg-muted/50 rounded-lg"
          title="刷新"
        >
          <RefreshCw className={`w-4 h-4 ${(loading || pipelineLoading) ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'market' ? (
          <TemplateMarketPanel
            templates={marketTemplates}
            loading={marketLoading}
            error={marketError}
            color={color}
            onInstall={async (tid) => {
              const result = await installMarketTemplate(agentName, tid)
              if (result) {
                fetchSchedules(agentName)
                fetchPipelines(agentName)
              }
            }}
            onRefresh={() => fetchMarket(agentName)}
          />
        ) : viewMode === 'pipelines' ? (
          <PipelinePanel
            pipelines={pipelines}
            presets={pipelinePresets}
            runs={pipelineRuns}
            loading={pipelineLoading}
            error={pipelineError}
            selectedId={selectedPipelineId}
            color={color}
            agentName={agentName}
            onSelect={handleSelectPipeline}
            onRun={handleRunPipeline}
            onDelete={handleDeletePipeline}
            onCreateFromPreset={handleCreatePipelinePreset}
            onCreatePipeline={async (data) => { await createPipeline(agentName, data); fetchPipelines(agentName) }}
          />
        ) : (
        <>
        {/* 左列：Schedule 列表 */}
        <div className="w-[420px] border-r border-border/50 overflow-y-auto p-4 space-y-4">
          {/* 预置模板 */}
          <div>
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border border-dashed border-primary/30 hover:bg-primary/5 transition-colors"
            >
              <Plus className="w-4 h-4" style={{ color }} />
              <span className="text-sm font-medium">从模板创建定时任务</span>
            </button>

            {showPresets && presets.length > 0 && (
              <div className="mt-2 space-y-2">
                {presets.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card hover:border-primary/20 transition-colors cursor-pointer"
                    onClick={() => handleCreatePreset(p.id)}
                  >
                    <Zap className="w-4 h-4 shrink-0" style={{ color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">
                      {p.frequency}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 自定义创建 */}
          <button
            onClick={() => setShowCustomForm(!showCustomForm)}
            className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border border-dashed border-border/40 hover:bg-muted/30 transition-colors"
          >
            <Settings2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">自定义高级定时任务</span>
          </button>

          {showCustomForm && (
            <div className="p-4 rounded-xl border border-border/40 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">创建定时任务</h3>
                <button onClick={() => setShowCustomForm(false)} className="p-1 hover:bg-muted/50 rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-border/40 bg-background"
                placeholder="任务名称"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
              <input
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-border/40 bg-background"
                placeholder="Expert ID（如 tax_consultant）"
                value={formData.expert_id}
                onChange={(e) => setFormData((p) => ({ ...p, expert_id: e.target.value }))}
              />
              <textarea
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-border/40 bg-background resize-none"
                rows={3}
                placeholder="AI 任务提示词"
                value={formData.prompt}
                onChange={(e) => setFormData((p) => ({ ...p, prompt: e.target.value }))}
              />

              {/* 频率选择 */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">调度频率</label>
                <select
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-border/40 bg-background"
                  value={formData.frequency}
                  onChange={(e) => setFormData((p) => ({ ...p, frequency: e.target.value }))}
                >
                  {FREQ_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* 执行时间 */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">时</label>
                  <input
                    type="number" min={0} max={23}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border/40 bg-background"
                    value={formData.preferred_hour}
                    onChange={(e) => setFormData((p) => ({ ...p, preferred_hour: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">分</label>
                  <input
                    type="number" min={0} max={59}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border/40 bg-background"
                    value={formData.preferred_minute}
                    onChange={(e) => setFormData((p) => ({ ...p, preferred_minute: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
              </div>

              {/* 周几选择 */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  指定周几执行（可选，覆盖频率默认规则）
                </label>
                <div className="flex gap-1">
                  {WEEKDAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleWeekday(i)}
                      className={`w-8 h-8 text-xs rounded-lg border transition-colors ${
                        formData.weekdays.includes(i)
                          ? 'border-primary bg-primary/10 font-bold'
                          : 'border-border/40 hover:bg-muted/30 text-muted-foreground'
                      }`}
                      style={formData.weekdays.includes(i) ? { color, borderColor: color } : undefined}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 每月几号 */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  指定每月几号执行（可选，逗号分隔，如 1,15）
                </label>
                <input
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-border/40 bg-background"
                  placeholder="如：1,15 表示每月 1 号和 15 号"
                  value={formData.monthdays}
                  onChange={(e) => setFormData((p) => ({ ...p, monthdays: e.target.value }))}
                />
              </div>

              {/* 自定义 Cron（仅 frequency=custom 时显示） */}
              {formData.frequency === 'custom' && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Cron 表达式（分 时 日 月 周）
                  </label>
                  <input
                    className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-border/40 bg-background"
                    placeholder="0 9 * * 1,3,5"
                    value={formData.cron_expr}
                    onChange={(e) => setFormData((p) => ({ ...p, cron_expr: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    格式：分(0-59) 时(0-23) 日(1-31) 月(1-12) 周(0=周日,1=周一..6=周六)
                  </p>
                </div>
              )}

              {/* Computer Use 配置 */}
              <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                  <Database className="w-3.5 h-3.5" />
                  <span>Computer Use 本地文件集成（可选）</span>
                </summary>
                <div className="mt-2 space-y-2 pl-5">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-0.5 block">监控本地文件/目录路径</label>
                    <input
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-border/40 bg-background font-mono"
                      placeholder="如 C:\Reports\monthly.xlsx"
                      value={formData.watch_path}
                      onChange={(e) => setFormData((p) => ({ ...p, watch_path: e.target.value }))}
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">执行前自动读取并注入文件内容到 AI 提示词</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-0.5 block">文件类型过滤（可选）</label>
                    <input
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-border/40 bg-background"
                      placeholder="如 xlsx,csv,pdf（逗号分隔，留空=全部）"
                      value={formData.watch_file_types}
                      onChange={(e) => setFormData((p) => ({ ...p, watch_file_types: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-0.5 block">自动填报输出路径（可选）</label>
                    <div className="flex gap-2">
                      <select
                        className="px-2 py-1.5 text-sm rounded-lg border border-border/40 bg-background"
                        value={formData.auto_fill_type}
                        onChange={(e) => setFormData((p) => ({ ...p, auto_fill_type: e.target.value }))}
                      >
                        <option value="write_text">文本</option>
                        <option value="write_csv">CSV</option>
                        <option value="write_excel">Excel</option>
                        <option value="fill_template">模板填充</option>
                      </select>
                      <input
                        className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border/40 bg-background font-mono"
                        placeholder="如 C:\Output\report.md"
                        value={formData.auto_fill_target}
                        onChange={(e) => setFormData((p) => ({ ...p, auto_fill_target: e.target.value }))}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">执行后自动将 AI 结果写入本地文件</p>
                  </div>
                </div>
              </details>

              <button
                onClick={handleCustomCreate}
                disabled={!formData.name || !formData.expert_id || !formData.prompt}
                className="w-full py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
                style={{ backgroundColor: color }}
              >
                创建定时任务
              </button>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-xs">
              {error}
            </div>
          )}

          {/* Schedule 列表 */}
          {loading && schedules.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              加载中…
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无定时任务</p>
              <p className="text-xs mt-1">点击上方按钮从模板快速创建</p>
            </div>
          ) : (
            schedules.map((sc) => {
              const badge = STATUS_BADGE[sc.status] || STATUS_BADGE.error
              const BadgeIcon = badge.icon
              const isSelected = selectedId === sc.schedule_id
              return (
                <div
                  key={sc.schedule_id}
                  className={`p-4 rounded-xl border bg-card transition-all cursor-pointer ${
                    isSelected ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border/30 hover:border-border/60'
                  }`}
                  onClick={() => handleViewHistory(sc.schedule_id)}
                >
                  <div className="flex items-start gap-3">
                    {/* 状态切换 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(sc) }}
                      className={`mt-0.5 w-9 h-5 rounded-full relative transition-colors shrink-0 ${
                        sc.status === 'active' ? '' : 'bg-secondary/50'
                      }`}
                      style={sc.status === 'active' ? { backgroundColor: color } : undefined}
                    >
                      <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        sc.status === 'active' ? 'translate-x-[18px]' : 'translate-x-[2px]'
                      }`} />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold truncate">{sc.name}</h3>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                          style={{ backgroundColor: `${badge.color}15`, color: badge.color }}
                        >
                          <BadgeIcon className="w-3 h-3" /> {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{sc.description || sc.prompt}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {describeSchedule(sc)}
                        </span>
                        <span>{sc.total_runs} 次执行</span>
                        {sc.self_healed_runs > 0 && (
                          <span className="text-blue-500">{sc.self_healed_runs} 次自修复</span>
                        )}
                        <span>上次: {formatTime(sc.last_run_at)}</span>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTrigger(sc.schedule_id) }}
                        className="p-1.5 hover:bg-primary/10 rounded-lg transition-colors"
                        title="立即执行"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(sc.schedule_id) }}
                        className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* 右列：执行历史 / State */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedId ? (
            <div className="max-w-2xl space-y-4">
              {/* 标签切换 */}
              <div className="flex items-center gap-1 border-b border-border/30 pb-2">
                <button
                  onClick={() => { setShowState(false); fetchHistory(agentName, selectedId) }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    !showState ? 'bg-primary/10 font-bold' : 'hover:bg-muted/50 text-muted-foreground'
                  }`}
                  style={!showState ? { color } : undefined}
                >
                  <History className="w-3.5 h-3.5" /> 执行历史
                </button>
                <button
                  onClick={() => handleViewState(selectedId)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    showState ? 'bg-primary/10 font-bold' : 'hover:bg-muted/50 text-muted-foreground'
                  }`}
                  style={showState ? { color } : undefined}
                >
                  <Database className="w-3.5 h-3.5" /> 业务记忆
                </button>
              </div>

              {showState ? (
                <StatePanel stateData={stateData} color={color} />
              ) : (
              <>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <History className="w-4 h-4" style={{ color }} />
                执行历史
              </h2>

              {/* P19: 成本趋势迷你图 + 统计摘要 */}
              {history.length >= 2 && (() => {
                const costs = history.filter((r) => r.cost_rmb > 0).map((r) => r.cost_rmb)
                const totalCost = costs.reduce((a, b) => a + b, 0)
                const successRate = history.length > 0
                  ? Math.round((history.filter((r) => r.status === 'completed' || r.status === 'self_healed').length / history.length) * 100)
                  : 0
                const avgTokens = history.length > 0
                  ? Math.round(history.reduce((a, r) => a + r.tokens_in + r.tokens_out, 0) / history.length)
                  : 0
                const maxCost = Math.max(...costs, 0.01)

                return (
                  <div className="p-3 rounded-xl border border-border/30 bg-card">
                    <div className="flex items-center gap-4 text-xs mb-2">
                      <span className="font-medium">累计费用: <span style={{ color }}>¥{totalCost.toFixed(2)}</span></span>
                      <span>成功率: {successRate}%</span>
                      <span>平均 Token: {avgTokens}</span>
                    </div>
                    {costs.length >= 2 && (
                      <div className="h-10 flex items-end gap-[2px]">
                        {costs.slice(-20).map((c, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-t-sm min-w-[3px] transition-all"
                            style={{
                              height: `${Math.max((c / maxCost) * 100, 8)}%`,
                              backgroundColor: color,
                              opacity: 0.3 + (i / costs.slice(-20).length) * 0.7,
                            }}
                            title={`¥${c.toFixed(2)}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">暂无执行记录</p>
              ) : (
                <div className="relative">
                  {/* P19: 时间线竖线 */}
                  <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border/30" />

                {history.map((rec) => {
                  const st = EXEC_STATUS[rec.status] || EXEC_STATUS.pending
                  return (
                    <div key={rec.execution_id} className="relative flex gap-3 pb-4">
                      {/* 时间线圆点 */}
                      <div className="relative z-10 mt-1 shrink-0">
                        <div className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center"
                          style={{ borderColor: st.color, backgroundColor: `${st.color}15` }}>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }} />
                        </div>
                      </div>
                      <div className="flex-1 p-3 rounded-xl border border-border/30 bg-card space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: `${st.color}15`, color: st.color }}
                        >
                          {st.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatTime(rec.triggered_at)}</span>
                        {rec.trigger_source !== 'schedule' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500">
                            {rec.trigger_source}
                          </span>
                        )}
                        {rec.attempt_number > 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                            {rec.attempt_number} 次尝试
                          </span>
                        )}
                      </div>

                      {rec.result_summary && (
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                          {rec.result_summary}
                        </p>
                      )}

                      {rec.error && (
                        <p className="text-xs text-red-500">{rec.error}</p>
                      )}

                      {/* 自纠错链路 */}
                      {rec.heal_chain.length > 0 && (
                        <div className="mt-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                          <p className="text-[10px] font-semibold text-blue-500 mb-1">自纠错链路</p>
                          {rec.heal_chain.map((entry, i) => (
                            <div key={i} className="text-[10px] text-muted-foreground">
                              第 {(entry as any).attempt || i + 1} 次: {(entry as any).strategy || '—'} → {(entry as any).action || '—'}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
                        <span>Token: {rec.tokens_in + rec.tokens_out}</span>
                        {rec.cost_rmb > 0 && <span>费用: ¥{rec.cost_rmb.toFixed(2)}</span>}
                        {rec.deliverables.length > 0 && <span>{rec.deliverables.length} 个交付物</span>}
                      </div>
                      </div>
                    </div>
                  )
                })}
                </div>
              )}
              </>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <History className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">选择左侧任务查看执行历史</p>
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}

// ═══════════ Pipeline 编排面板 ═══════════

// P20: 可用 Agent/Expert 列表（供拖拽选择）
const AVAILABLE_EXPERTS = [
  { agent: 'finance', experts: ['tax_consultant', 'finance_accountant'], label: '财务' },
  { agent: 'legal', experts: ['dynamic_civil_lawyer', 'contract_reviewer'], label: '法律' },
  { agent: 'hr', experts: ['hr_consultant'], label: '人力资源' },
  { agent: 'cost', experts: ['cost_engineer'], label: '造价' },
  { agent: 'cs', experts: ['cs_consultant'], label: '客服' },
  { agent: 'sales', experts: ['sales_strategist'], label: '销售' },
  { agent: 'growth', experts: ['growth_consultant', 'content_creator'], label: '增长' },
  { agent: 'invest', experts: ['investment_analyst'], label: '投资' },
  { agent: 'pulmonary', experts: ['pulmonary_physician'], label: '肺科' },
]

interface DraftStep {
  id: string
  agent_name: string
  expert_id: string
  prompt: string
  inject_prev_result: boolean
  failure_policy: 'abort' | 'skip' | 'retry'
}

function PipelinePanel({
  pipelines, presets, runs, loading, error,
  selectedId, color,
  onSelect, onRun, onDelete, onCreateFromPreset, onCreatePipeline,
}: {
  pipelines: PipelineItem[]
  presets: Array<{ id: string; name: string; description: string; steps: Array<Record<string, unknown>> }>
  runs: PipelineRunItem[]
  loading: boolean
  error: string | null
  selectedId: string | null
  color: string
  agentName: string
  onSelect: (id: string) => void
  onRun: (id: string) => void
  onDelete: (id: string) => void
  onCreateFromPreset: (presetId: string) => void
  onCreatePipeline: (data: Record<string, unknown>) => Promise<unknown>
}) {
  const [showPresets, setShowPresets] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editorName, setEditorName] = useState('')
  const [editorDesc, setEditorDesc] = useState('')
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([])
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const selected = pipelines.find((p) => p.pipeline_id === selectedId)

  const STATUS_COLORS: Record<string, string> = {
    idle: '#6b7280', running: '#3b82f6', completed: '#22c55e',
    failed: '#ef4444', partial: '#f59e0b',
  }

  return (
    <>
      {/* 左列 */}
      <div className="w-[420px] border-r border-border/50 overflow-y-auto p-4 space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-2 flex-1 text-left px-3 py-2 rounded-lg border border-dashed border-primary/30 hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-4 h-4" style={{ color }} />
            <span className="text-sm font-medium">从模板</span>
          </button>
          <button
            onClick={() => { setShowEditor(!showEditor); setShowPresets(false) }}
            className="flex items-center gap-2 flex-1 text-left px-3 py-2 rounded-lg border border-dashed border-blue-500/30 hover:bg-blue-500/5 transition-colors"
          >
            <Activity className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">可视化编排</span>
          </button>
        </div>

        {/* P20: 可视化 Pipeline 编辑器 */}
        {showEditor && (
          <div className="space-y-3 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 animate-in slide-in-from-top-2">
            <div className="space-y-2">
              <input
                className="w-full text-sm bg-background border border-border/50 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                placeholder="Pipeline 名称"
                value={editorName}
                onChange={(e) => setEditorName(e.target.value)}
              />
              <input
                className="w-full text-xs bg-background border border-border/50 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                placeholder="描述（可选）"
                value={editorDesc}
                onChange={(e) => setEditorDesc(e.target.value)}
              />
            </div>

            {/* 步骤列表（可拖拽排序） */}
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground">步骤（拖拽排序）</p>
              {draftSteps.map((step, i) => (
                <div
                  key={step.id}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx !== null && dragIdx !== i) {
                      setDraftSteps((prev) => {
                        const arr = [...prev]
                        const [moved] = arr.splice(dragIdx, 1)
                        arr.splice(i, 0, moved)
                        return arr
                      })
                    }
                    setDragIdx(null)
                  }}
                  className={`flex items-start gap-2 p-2 rounded-lg border bg-background transition-all ${
                    dragIdx === i ? 'border-blue-500 opacity-50' : 'border-border/30'
                  }`}
                >
                  <div className="cursor-grab mt-1 text-muted-foreground hover:text-foreground">⣿</div>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex gap-2">
                      <select
                        className="text-xs bg-background border border-border/50 rounded px-1.5 py-1"
                        value={`${step.agent_name}/${step.expert_id}`}
                        onChange={(e) => {
                          const [a, x] = e.target.value.split('/')
                          setDraftSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, agent_name: a, expert_id: x } : s))
                        }}
                      >
                        {AVAILABLE_EXPERTS.flatMap((g) =>
                          g.experts.map((x) => (
                            <option key={`${g.agent}/${x}`} value={`${g.agent}/${x}`}>
                              {g.label} / {x}
                            </option>
                          )),
                        )}
                      </select>
                      <select
                        className="text-[10px] bg-background border border-border/50 rounded px-1 py-0.5"
                        value={step.failure_policy}
                        onChange={(e) => setDraftSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, failure_policy: e.target.value as any } : s))}
                      >
                        <option value="abort">失败终止</option>
                        <option value="skip">跳过继续</option>
                        <option value="retry">自动重试</option>
                      </select>
                    </div>
                    <input
                      className="w-full text-[11px] bg-background border border-border/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                      placeholder="该步骤的提示词"
                      value={step.prompt}
                      onChange={(e) => setDraftSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, prompt: e.target.value } : s))}
                    />
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={step.inject_prev_result}
                        onChange={(e) => setDraftSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, inject_prev_result: e.target.checked } : s))}
                      />
                      接收上一步结果
                    </label>
                  </div>
                  <button
                    onClick={() => setDraftSteps((prev) => prev.filter((s) => s.id !== step.id))}
                    className="text-red-400 hover:text-red-500 mt-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => setDraftSteps((prev) => [...prev, {
                  id: `step-${Date.now()}`,
                  agent_name: 'finance',
                  expert_id: 'tax_consultant',
                  prompt: '',
                  inject_prev_result: prev.length > 0,
                  failure_policy: 'abort',
                }])}
                className="w-full text-xs text-blue-500 hover:bg-blue-500/5 rounded-lg py-1.5 transition-colors border border-dashed border-blue-500/20"
              >
                + 添加步骤
              </button>
            </div>

            {/* 流程预览 */}
            {draftSteps.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap text-[10px]">
                <span className="text-muted-foreground">预览:</span>
                {draftSteps.map((s, i) => (
                  <span key={s.id} className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">
                      {s.agent_name}/{s.expert_id}
                    </span>
                    {i < draftSteps.length - 1 && <span className="text-muted-foreground">→</span>}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={async () => {
                  if (!editorName.trim() || draftSteps.length === 0) return
                  await onCreatePipeline({
                    name: editorName.trim(),
                    description: editorDesc.trim(),
                    steps: draftSteps.map((s, i) => ({
                      order: i + 1,
                      agent_name: s.agent_name,
                      expert_id: s.expert_id,
                      prompt: s.prompt,
                      inject_prev_result: s.inject_prev_result,
                      failure_policy: s.failure_policy,
                    })),
                  })
                  setShowEditor(false)
                  setEditorName('')
                  setEditorDesc('')
                  setDraftSteps([])
                }}
                disabled={!editorName.trim() || draftSteps.length === 0}
                className="flex-1 text-xs bg-blue-500 text-white rounded-lg py-1.5 disabled:opacity-40 hover:bg-blue-600 transition-colors"
              >
                创建 Pipeline ({draftSteps.length} 步)
              </button>
              <button
                onClick={() => { setShowEditor(false); setDraftSteps([]) }}
                className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {showPresets && presets.length > 0 && (
          <div className="space-y-2 animate-in slide-in-from-top-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => { onCreateFromPreset(preset.id); setShowPresets(false) }}
                className="w-full text-left p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all group"
              >
                <p className="text-sm font-medium group-hover:text-foreground">{preset.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {(preset.steps || []).length} 步 · {(preset.steps || []).map((s: any) => s.agent_name).filter(Boolean).join(' → ')}
                </p>
              </button>
            ))}
          </div>
        )}

        {loading && pipelines.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="text-xs text-red-500 px-2">{error}</div>
        )}

        {pipelines.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">暂无 Pipeline</p>
            <p className="text-xs mt-1">从模板创建，串联多个 AI 专家</p>
          </div>
        )}

        {pipelines.map((p) => (
          <div
            key={p.pipeline_id}
            onClick={() => onSelect(p.pipeline_id)}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              selectedId === p.pipeline_id
                ? 'border-primary/40 bg-primary/5 shadow-sm'
                : 'border-border/50 hover:border-border hover:bg-muted/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{p.name}</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onRun(p.pipeline_id) }}
                  className="p-1 hover:bg-green-500/10 rounded-md transition-colors"
                  title="执行 Pipeline"
                >
                  <Play className="w-3.5 h-3.5 text-green-500" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(p.pipeline_id) }}
                  className="p-1 hover:bg-red-500/10 rounded-md transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            </div>
            {p.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>
            )}

            {/* 步骤流水线 */}
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {p.steps.map((step, i) => (
                <div key={step.step_id} className="flex items-center gap-1">
                  <div
                    className="px-2 py-0.5 rounded-md text-[10px] font-medium border"
                    style={{ borderColor: `${color}40`, color }}
                  >
                    {step.agent_name}/{step.expert_id}
                  </div>
                  {i < p.steps.length - 1 && (
                    <span className="text-muted-foreground text-[10px]">→</span>
                  )}
                </div>
              ))}
            </div>

            {/* 统计 */}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <span>累计 {p.total_runs} 次</span>
              {p.total_runs > 0 && (
                <span>成功率 {Math.round((p.success_runs / p.total_runs) * 100)}%</span>
              )}
              {p.last_run_at && (
                <span>上次 {new Date(p.last_run_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 右列：Pipeline 详情 & 执行历史 */}
      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">{selected.name}</h2>
              {selected.description && (
                <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
              )}
            </div>

            {/* Pipeline 流程图 */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                执行流程（{selected.steps.length} 步串行）
              </h3>
              <div className="space-y-2">
                {selected.steps.map((step, i) => (
                  <div key={step.step_id} className="relative">
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-muted/10">
                      <div
                        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: color }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{step.agent_name}/{step.expert_id}</span>
                          {step.inject_prev_result && i > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                              接收上一步结果
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {step.failure_policy}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">
                          {step.prompt}
                        </p>
                      </div>
                    </div>
                    {i < selected.steps.length - 1 && (
                      <div className="absolute left-[26px] -bottom-2 w-0.5 h-2 bg-border/50" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 执行历史 */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                执行历史
              </h3>
              {runs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">暂无执行记录</p>
              ) : (
                <div className="space-y-3">
                  {runs.slice().reverse().map((run) => (
                    <div
                      key={run.run_id}
                      className="p-3 rounded-xl border border-border/50 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: STATUS_COLORS[run.status] || '#6b7280' }}
                          />
                          <span className="text-sm font-medium">{run.status}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(run.triggered_at).toLocaleString('zh-CN')}
                        </span>
                      </div>

                      {run.error && (
                        <p className="text-xs text-red-500">{run.error}</p>
                      )}

                      {/* 步骤结果 */}
                      <div className="space-y-1">
                        {run.step_results.map((sr: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <div
                              className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                background: sr.status === 'completed' ? '#22c55e'
                                  : sr.status === 'failed' ? '#ef4444'
                                  : '#6b7280',
                              }}
                            />
                            <div className="min-w-0">
                              <span className="font-medium">{sr.agent_name}/{sr.expert_id}</span>
                              {sr.summary && (
                                <p className="text-muted-foreground mt-0.5 line-clamp-2">{sr.summary}</p>
                              )}
                              {sr.error && (
                                <p className="text-red-500 mt-0.5">{sr.error}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
                        <span>Token: {run.total_tokens_in + run.total_tokens_out}</span>
                        {run.total_cost_rmb > 0 && <span>费用: ¥{run.total_cost_rmb.toFixed(2)}</span>}
                        {run.completed_at && (
                          <span>
                            耗时: {((new Date(run.completed_at).getTime() - new Date(run.triggered_at).getTime()) / 1000).toFixed(0)}s
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">选择左侧 Pipeline 查看详情</p>
              <p className="text-xs mt-1 text-muted-foreground/60">
                Pipeline 可串联多个 AI 专家，前一步结果自动注入后一步
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ═══════════ P22: 模板市场面板 ═══════════

function TemplateMarketPanel({
  templates, loading, error, color,
  onInstall, onRefresh,
}: {
  templates: MarketTemplate[]
  loading: boolean
  error: string | null
  color: string
  onInstall: (templateId: string) => Promise<void>
  onRefresh: () => void
}) {
  const [filter, setFilter] = useState<'all' | 'schedule' | 'pipeline'>('all')
  const [installing, setInstalling] = useState<string | null>(null)

  const filtered = templates.filter((t) =>
    filter === 'all' ? true : t.type === filter,
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5" style={{ color }} />
            模板市场
          </h2>
          <button onClick={onRefresh} className="p-1.5 hover:bg-muted/50 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          浏览社区分享的 Schedule 和 Pipeline 模板，一键安装到您的 AI 专家
        </p>

        {/* 过滤器 */}
        <div className="flex gap-2">
          {(['all', 'schedule', 'pipeline'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filter === f
                  ? 'text-white'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
              }`}
              style={filter === f ? { backgroundColor: color } : undefined}
            >
              {f === 'all' ? '全部' : f === 'schedule' ? '定时任务' : 'Pipeline'}
            </button>
          ))}
        </div>

        {error && <div className="text-xs text-red-500 p-2">{error}</div>}

        {loading && templates.length === 0 && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Database className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">暂无模板</p>
            <p className="text-xs mt-1">
              您可以将自己的 Schedule/Pipeline 通过导出功能分享到市场
            </p>
          </div>
        )}

        <div className="grid gap-3">
          {filtered.map((tpl) => (
            <div
              key={tpl.template_id}
              className="p-4 rounded-xl border border-border/30 bg-card hover:border-border/60 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: tpl.type === 'pipeline' ? '#3b82f615' : `${color}15`,
                        color: tpl.type === 'pipeline' ? '#3b82f6' : color,
                      }}
                    >
                      {tpl.type === 'pipeline' ? 'Pipeline' : 'Schedule'}
                    </span>
                    <span className="text-xs text-muted-foreground">{tpl.agent_name}</span>
                    <span className="text-xs text-muted-foreground">by {tpl.author}</span>
                  </div>
                  <h3 className="text-sm font-medium mt-1">
                    {(tpl.data as any)?.name || tpl.description || tpl.template_id}
                  </h3>
                  {tpl.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {tpl.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                    <span className="text-[10px] text-muted-foreground">{tpl.installs} 次安装</span>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setInstalling(tpl.template_id)
                    await onInstall(tpl.template_id)
                    setInstalling(null)
                  }}
                  disabled={installing === tpl.template_id}
                  className="shrink-0 px-3 py-1.5 text-xs rounded-lg border transition-colors hover:bg-primary/5"
                  style={{ borderColor: `${color}40`, color }}
                >
                  {installing === tpl.template_id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    '安装'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
