/**
 * ScheduledWorkflow Store — 定时 AI 专家巡检管理
 *
 * 连接后端 /api/{agent}/scheduled-workflows/* API，
 * 支持 Schedule CRUD、手动触发、Dispatch、历史查询和 State 管理。
 */
import { create } from 'zustand'
import { API_BASE, authHeaders } from '@/lib/api-client'

// ─── 类型 ───

export interface ScheduleItem {
  schedule_id: string
  user_id: string
  agent_name: string
  expert_id: string
  solution_id: string
  name: string
  description: string
  prompt: string
  frequency: string
  cron_expr: string
  preferred_hour: number
  preferred_minute: number
  weekdays: number[]
  monthdays: number[]
  status: 'active' | 'paused' | 'disabled' | 'error'
  total_runs: number
  success_runs: number
  failed_runs: number
  self_healed_runs: number
  last_run_at: string | null
  last_run_status: string | null
  created_at: string
}

export interface ExecutionRecord {
  execution_id: string
  schedule_id: string
  triggered_at: string
  completed_at: string | null
  trigger_source: string
  status: string
  result_summary: string
  deliverables: Record<string, unknown>[]
  error: string | null
  attempt_number: number
  heal_chain: Record<string, unknown>[]
  tokens_in: number
  tokens_out: number
  cost_rmb: number
}

export interface PresetTemplate {
  id: string
  name: string
  description: string
  agent_name: string
  expert_id: string
  frequency: string
  prompt: string
}

export interface WorkflowStateData {
  [key: string]: unknown
}

interface ScheduleState {
  schedules: ScheduleItem[]
  presets: PresetTemplate[]
  history: ExecutionRecord[]
  stateData: WorkflowStateData | null
  loading: boolean
  error: string | null

  fetchSchedules: (agentName: string) => Promise<void>
  fetchPresets: (agentName: string) => Promise<void>
  createFromPreset: (agentName: string, presetId: string) => Promise<ScheduleItem | null>
  createSchedule: (agentName: string, data: CreateScheduleData) => Promise<ScheduleItem | null>
  pauseSchedule: (agentName: string, scheduleId: string) => Promise<void>
  resumeSchedule: (agentName: string, scheduleId: string) => Promise<void>
  deleteSchedule: (agentName: string, scheduleId: string) => Promise<void>
  triggerExecution: (agentName: string, scheduleId: string) => Promise<ExecutionRecord | null>
  fetchHistory: (agentName: string, scheduleId: string) => Promise<void>
  fetchState: (agentName: string, scheduleId: string) => Promise<void>
}

export interface CreateScheduleData {
  agent_name: string
  expert_id: string
  name: string
  description?: string
  prompt: string
  frequency?: string
  preferred_hour?: number
  preferred_minute?: number
  weekdays?: number[]
  monthdays?: number[]
  cron_expr?: string
}

// ─── API 帮助函数 ───

function buildUrl(agentName: string, path: string): string {
  return `${API_BASE}/api/${agentName}/scheduled-workflows${path}`
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: authHeaders(init?.headers as Record<string, string>) })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}

// ─── Store ───

export const useScheduleStore = create<ScheduleState>((set) => ({
  schedules: [],
  presets: [],
  history: [],
  stateData: null,
  loading: false,
  error: null,

  fetchSchedules: async (agentName) => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch<{ schedules: ScheduleItem[] }>(buildUrl(agentName, '/schedules'))
      set({ schedules: data.schedules, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  fetchPresets: async (agentName) => {
    try {
      const data = await apiFetch<{ presets: PresetTemplate[] }>(buildUrl(agentName, '/presets'))
      set({ presets: data.presets })
    } catch { /* 静默失败 — 预置列表非关键 */ }
  },

  createFromPreset: async (agentName, presetId) => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch<{ schedule: ScheduleItem }>(
        buildUrl(agentName, '/schedules/from-preset'),
        { method: 'POST', body: JSON.stringify({ preset_id: presetId }) },
      )
      set((s) => ({ schedules: [...s.schedules, data.schedule], loading: false }))
      return data.schedule
    } catch (e: any) {
      set({ error: e.message, loading: false })
      return null
    }
  },

  createSchedule: async (agentName, payload) => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch<{ schedule: ScheduleItem }>(
        buildUrl(agentName, '/schedules'),
        { method: 'POST', body: JSON.stringify(payload) },
      )
      set((s) => ({ schedules: [...s.schedules, data.schedule], loading: false }))
      return data.schedule
    } catch (e: any) {
      set({ error: e.message, loading: false })
      return null
    }
  },

  pauseSchedule: async (agentName, scheduleId) => {
    try {
      await apiFetch(buildUrl(agentName, `/schedules/${scheduleId}/pause`), { method: 'POST' })
      set((s) => ({
        schedules: s.schedules.map((sc) =>
          sc.schedule_id === scheduleId ? { ...sc, status: 'paused' as const } : sc,
        ),
      }))
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  resumeSchedule: async (agentName, scheduleId) => {
    try {
      await apiFetch(buildUrl(agentName, `/schedules/${scheduleId}/resume`), { method: 'POST' })
      set((s) => ({
        schedules: s.schedules.map((sc) =>
          sc.schedule_id === scheduleId ? { ...sc, status: 'active' as const } : sc,
        ),
      }))
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  deleteSchedule: async (agentName, scheduleId) => {
    try {
      await apiFetch(buildUrl(agentName, `/schedules/${scheduleId}`), { method: 'DELETE' })
      set((s) => ({
        schedules: s.schedules.filter((sc) => sc.schedule_id !== scheduleId),
      }))
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  triggerExecution: async (agentName, scheduleId) => {
    set({ loading: true, error: null })
    try {
      const data = await apiFetch<{ execution: ExecutionRecord }>(
        buildUrl(agentName, `/schedules/${scheduleId}/trigger`),
        { method: 'POST' },
      )
      set({ loading: false })

      // 系统通知（Electron Toast + 桌面弹窗）
      const exec = data.execution
      const isOk = exec.status === 'success' || exec.status === 'self_healed'
      sendScheduleNotification(
        `${isOk ? '✅' : '❌'} 定时任务执行${isOk ? '完成' : '失败'}`,
        exec.result_summary || exec.error || '执行结束',
        isOk ? 'normal' : 'critical',
        scheduleId,
      )

      return exec
    } catch (e: any) {
      set({ error: e.message, loading: false })
      return null
    }
  },

  fetchHistory: async (agentName, scheduleId) => {
    try {
      const data = await apiFetch<{ executions: ExecutionRecord[] }>(
        buildUrl(agentName, `/schedules/${scheduleId}/history`),
      )
      set({ history: data.executions })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchState: async (agentName, scheduleId) => {
    try {
      const data = await apiFetch<WorkflowStateData>(
        buildUrl(agentName, `/schedules/${scheduleId}/state`),
      )
      set({ stateData: data })
    } catch {
      set({ stateData: null })
    }
  },
}))

// ─── Pipeline 编排 ───

export interface PipelineItem {
  pipeline_id: string
  name: string
  description: string
  steps: PipelineStepItem[]
  status: string
  total_runs: number
  success_runs: number
  last_run_at: string | null
  enabled: boolean
}

export interface PipelineStepItem {
  step_id: string
  order: number
  agent_name: string
  expert_id: string
  prompt: string
  inject_prev_result: boolean
  failure_policy: string
}

export interface PipelineRunItem {
  run_id: string
  pipeline_id: string
  triggered_at: string
  completed_at: string
  status: string
  step_results: Array<Record<string, unknown>>
  total_tokens_in: number
  total_tokens_out: number
  total_cost_rmb: number
  error: string
}

export interface PipelinePreset {
  id: string
  name: string
  description: string
  steps: Array<Record<string, unknown>>
}

interface PipelineState {
  pipelines: PipelineItem[]
  pipelinePresets: PipelinePreset[]
  pipelineRuns: PipelineRunItem[]
  pipelineLoading: boolean
  pipelineError: string | null

  fetchPipelines: (agentName: string) => Promise<void>
  fetchPipelinePresets: (agentName: string) => Promise<void>
  createPipelineFromPreset: (agentName: string, presetId: string) => Promise<PipelineItem | null>
  createPipeline: (agentName: string, data: Record<string, unknown>) => Promise<PipelineItem | null>
  deletePipeline: (agentName: string, pipelineId: string) => Promise<void>
  runPipeline: (agentName: string, pipelineId: string) => Promise<PipelineRunItem | null>
  fetchPipelineRuns: (agentName: string, pipelineId: string) => Promise<void>
}

export const usePipelineStore = create<PipelineState>((set) => ({
  pipelines: [],
  pipelinePresets: [],
  pipelineRuns: [],
  pipelineLoading: false,
  pipelineError: null,

  fetchPipelines: async (agentName) => {
    set({ pipelineLoading: true, pipelineError: null })
    try {
      const data = await apiFetch<{ pipelines: PipelineItem[] }>(buildUrl(agentName, '/pipelines'))
      set({ pipelines: data.pipelines, pipelineLoading: false })
    } catch (e: any) {
      set({ pipelineError: e.message, pipelineLoading: false })
    }
  },

  fetchPipelinePresets: async (agentName) => {
    try {
      const data = await apiFetch<{ presets: PipelinePreset[] }>(buildUrl(agentName, '/pipeline-presets'))
      set({ pipelinePresets: data.presets })
    } catch { /* 静默 */ }
  },

  createPipelineFromPreset: async (agentName, presetId) => {
    set({ pipelineLoading: true, pipelineError: null })
    try {
      const data = await apiFetch<{ pipeline: PipelineItem }>(
        buildUrl(agentName, '/pipelines/from-preset'),
        { method: 'POST', body: JSON.stringify({ preset_id: presetId }) },
      )
      set((s) => ({ pipelines: [...s.pipelines, data.pipeline], pipelineLoading: false }))
      return data.pipeline
    } catch (e: any) {
      set({ pipelineError: e.message, pipelineLoading: false })
      return null
    }
  },

  createPipeline: async (agentName, payload) => {
    set({ pipelineLoading: true, pipelineError: null })
    try {
      const data = await apiFetch<{ pipeline: PipelineItem }>(
        buildUrl(agentName, '/pipelines'),
        { method: 'POST', body: JSON.stringify(payload) },
      )
      set((s) => ({ pipelines: [...s.pipelines, data.pipeline], pipelineLoading: false }))
      return data.pipeline
    } catch (e: any) {
      set({ pipelineError: e.message, pipelineLoading: false })
      return null
    }
  },

  deletePipeline: async (agentName, pipelineId) => {
    try {
      await apiFetch(buildUrl(agentName, `/pipelines/${pipelineId}`), { method: 'DELETE' })
      set((s) => ({ pipelines: s.pipelines.filter((p) => p.pipeline_id !== pipelineId) }))
    } catch (e: any) {
      set({ pipelineError: e.message })
    }
  },

  runPipeline: async (agentName, pipelineId) => {
    set({ pipelineLoading: true, pipelineError: null })
    try {
      const data = await apiFetch<{ run: PipelineRunItem }>(
        buildUrl(agentName, `/pipelines/${pipelineId}/run`),
        { method: 'POST' },
      )
      set({ pipelineLoading: false })
      return data.run
    } catch (e: any) {
      set({ pipelineError: e.message, pipelineLoading: false })
      return null
    }
  },

  fetchPipelineRuns: async (agentName, pipelineId) => {
    try {
      const data = await apiFetch<{ runs: PipelineRunItem[] }>(
        buildUrl(agentName, `/pipelines/${pipelineId}/runs`),
      )
      set({ pipelineRuns: data.runs })
    } catch (e: any) {
      set({ pipelineError: e.message })
    }
  },
}))

// ─── 系统通知 ───

declare global {
  interface Window {
    electronAPI?: {
      scheduler?: {
        notify: (req: {
          title: string
          body: string
          urgency?: 'normal' | 'critical' | 'low'
          onClick?: { type: string; target: string }
          alsoToast?: boolean
        }) => Promise<{ success: boolean }>
        onToast: (callback: (data: { title: string; body: string; urgency?: string }) => void) => () => void
      }
    }
  }
}

function sendScheduleNotification(
  title: string,
  body: string,
  urgency: 'normal' | 'critical' | 'low' = 'normal',
  scheduleId?: string,
): void {
  const api = window.electronAPI?.scheduler
  if (api?.notify) {
    api.notify({
      title,
      body: body.length > 200 ? body.slice(0, 197) + '...' : body,
      urgency,
      alsoToast: true,
      onClick: scheduleId
        ? { type: 'navigate', target: '/schedule' }
        : undefined,
    }).catch(() => {})
  }
}

/**
 * 后台轮询：每 60 秒拉一次全部 Schedule，检测新执行结果并通知。
 * 在 ScheduleManager 页面挂载时调用。
 */
// ─── 模板市场 (P22) ───

export interface MarketTemplate {
  template_id: string
  type: 'schedule' | 'pipeline'
  agent_name: string
  tags: string[]
  author: string
  description: string
  installs: number
  rating: number
  published_at: string
  data: Record<string, unknown>
}

interface TemplateMarketState {
  marketTemplates: MarketTemplate[]
  marketLoading: boolean
  marketError: string | null

  fetchMarket: (agentName: string, type?: string, tag?: string) => Promise<void>
  publishTemplate: (agentName: string, data: Record<string, unknown>) => Promise<string | null>
  installTemplate: (agentName: string, templateId: string) => Promise<Record<string, unknown> | null>
}

export const useTemplateMarketStore = create<TemplateMarketState>((set) => ({
  marketTemplates: [],
  marketLoading: false,
  marketError: null,

  fetchMarket: async (agentName, type, tag) => {
    set({ marketLoading: true, marketError: null })
    try {
      const params = new URLSearchParams()
      if (type) params.set('type', type)
      if (tag) params.set('tag', tag)
      const url = buildUrl(agentName, `/templates/market?${params.toString()}`)
      const data = await apiFetch<{ templates: MarketTemplate[] }>(url)
      set({ marketTemplates: data.templates, marketLoading: false })
    } catch (e: any) {
      set({ marketError: e.message, marketLoading: false })
    }
  },

  publishTemplate: async (agentName, payload) => {
    try {
      const data = await apiFetch<{ template_id: string }>(
        buildUrl(agentName, '/templates/publish'),
        { method: 'POST', body: JSON.stringify(payload) },
      )
      return data.template_id
    } catch { return null }
  },

  installTemplate: async (agentName, templateId) => {
    try {
      const data = await apiFetch<Record<string, unknown>>(
        buildUrl(agentName, '/templates/install'),
        { method: 'POST', body: JSON.stringify({ template_id: templateId }) },
      )
      return data
    } catch { return null }
  },
}))

export function startScheduleNotificationPolling(
  agentName: string,
  intervalMs = 60_000,
): () => void {
  const seen = new Set<string>()

  async function poll() {
    try {
      const data = await apiFetch<{ schedules: ScheduleItem[] }>(
        buildUrl(agentName, '/schedules'),
      )
      for (const sc of data.schedules) {
        if (sc.last_run_at && !seen.has(`${sc.schedule_id}:${sc.last_run_at}`)) {
          seen.add(`${sc.schedule_id}:${sc.last_run_at}`)
          if (seen.size > 1) {
            const isOk = sc.last_run_status === 'success' || sc.last_run_status === 'self_healed'
            sendScheduleNotification(
              `${isOk ? '✅' : '❌'} ${sc.name}`,
              isOk ? '定时巡检已完成' : '定时巡检执行异常',
              isOk ? 'normal' : 'critical',
              sc.schedule_id,
            )
          }
        }
      }
    } catch { /* 静默 — 轮询失败不影响用户 */ }
  }

  poll()
  const timer = setInterval(poll, intervalMs)
  return () => clearInterval(timer)
}
