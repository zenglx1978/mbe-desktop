/**
 * WorkflowOS 前端服务 — 与后端 /workflow-os/* API 通信
 *
 * 更富更懒：不只是聊天，AI 直接替你干活、交付成果。
 */

import { API_BASE, isElectron, authHeaders, isAbortError } from './api-client'
import type { CrossAgentWorkflowExecuteResponse } from '@/types/api-responses'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || API_BASE

export interface WorkflowInstanceSummary {
  instance_id: string
  workflow_name: string
  agent_name: string
  solution_id: string
  status: 'draft' | 'running' | 'paused' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled'
  progress_percent: number
  completed_steps: number
  total_steps: number
  deliverable_count: number
  created_at: string
  total_elapsed_ms: number
}

export interface DeliverableItem {
  deliverable_id: string
  instance_id: string
  type: 'document' | 'record' | 'report' | 'notification' | 'data_sync' | 'calculation'
  title: string
  description: string
  file_path?: string
  file_url?: string
  file_format?: string
  data: Record<string, unknown>
  billable: boolean
  billable_amount: number
  created_at: string
}

export interface DashboardData {
  user_id: string
  summary: {
    active: number
    completed_today: number
    completed_total: number
    failed: number
    pending_approval: number
  }
  active_instances: WorkflowInstanceSummary[]
  recent_completed: WorkflowInstanceSummary[]
  recent_deliverables: DeliverableItem[]
  agent_capabilities: Record<string, unknown>
  data_flywheel: {
    total_instances: number
    total_deliverables: number
    total_steps_executed: number
    avg_completion_ms: number
    data_richness: string
    total_hours_saved?: number
  }
}

export interface WorkflowTemplateDef {
  id: string
  name: string
  description: string
  steps: { id: string; name: string }[]
  deliverable_type: string
  task_type: string
  schedule?: string
  schedule_description?: string
  next_run?: string
  version?: string
  status?: string       // active | canary | deprecated | draft
  changelog?: string
  canary_weight?: number // 0-100
}

export interface ScheduleEntry {
  template_id: string
  name: string
  schedule: string
  schedule_description: string
  last_run?: string | null
  next_run?: string | null
}

export interface CrossAgentWorkflowDef {
  id: string
  name: string
  solution_id: string
  mode: string
  description: string
  steps: { id: string; agent: string; expert: string; label: string; requires_approval?: boolean }[]
}

export interface PendingApproval {
  instance_id: string
  step_id: string
  step_name: string
  approval_id: string
  workflow_name: string
  workflow_type: string
  user_id: string
  created_at: string
}

function apiUrl(agentName: string, path: string): string {
  return `${BASE_URL}/api/${agentName}/workflow-os${path}`
}

let _wfUnavailable = false
let _wfFailCount = 0
const WF_FAIL_THRESHOLD = 3

/**
 * WorkflowOS API 请求封装。
 * - Web 模式：直接返回 503（WorkflowOS 仅 Electron 可用）
 * - Electron 模式：正常发请求，连续失败超阈值后熔断，不再发请求
 */
function wfFetch(input: string, init?: RequestInit): Promise<Response> {
  if (!isElectron() || _wfUnavailable) return Promise.resolve(new Response(null, { status: 503 }))
  const headers = authHeaders(init?.headers as Record<string, string> | undefined)
  return fetch(input, { ...init, headers }).then(res => {
    if (res.ok) _wfFailCount = 0
    else {
      _wfFailCount++
      if (_wfFailCount >= WF_FAIL_THRESHOLD) _wfUnavailable = true
    }
    return res
  })
}

export async function fetchDashboard(
  agentName: string,
  userId: string,
  signal?: AbortSignal,
): Promise<DashboardData | null> {
  try {
    const res = await wfFetch(
      apiUrl(agentName, `/dashboard?user_id=${encodeURIComponent(userId)}`),
      { signal },
    )
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    if (isAbortError(e)) throw e
    return null
  }
}

export async function fetchInstances(
  agentName: string,
  params: { user_id?: string; status?: string; limit?: number } = {},
): Promise<WorkflowInstanceSummary[]> {
  try {
    const qs = new URLSearchParams()
    if (params.user_id) qs.set('user_id', params.user_id)
    if (params.status) qs.set('status', params.status)
    if (params.limit) qs.set('limit', String(params.limit))
    const res = await wfFetch(apiUrl(agentName, `/instances?${qs}`))
    if (!res.ok) return []
    const data = await res.json()
    return data.instances || []
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按空列表处理
    return []
  }
}

export async function fetchDeliverables(
  agentName: string,
  params: { user_id?: string; instance_id?: string; type?: string; limit?: number } = {},
): Promise<DeliverableItem[]> {
  try {
    const qs = new URLSearchParams()
    if (params.user_id) qs.set('user_id', params.user_id)
    if (params.instance_id) qs.set('instance_id', params.instance_id)
    if (params.type) qs.set('type', params.type)
    if (params.limit) qs.set('limit', String(params.limit))
    const res = await wfFetch(apiUrl(agentName, `/deliverables?${qs}`))
    if (!res.ok) return []
    const data = await res.json()
    return data.deliverables || []
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按空列表处理
    return []
  }
}

export async function createInstance(
  agentName: string,
  body: {
    workflow_type: string
    workflow_name: string
    user_id: string
    org_id?: string
    solution_id?: string
    steps?: { id: string; name: string }[]
    input_params?: Record<string, unknown>
  },
): Promise<Record<string, unknown> | null> {
  try {
    const res = await wfFetch(apiUrl(agentName, '/instances'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

/** 从聊天中启动工作流（用户点击"启动工作流"按钮时调用） */
export async function startFromChat(
  agentName: string,
  body: {
    workflow_type: string
    workflow_name: string
    user_id: string
    steps?: { id: string; name: string }[]
    conversation_id?: string
    description?: string
    input_params?: Record<string, unknown>
  },
): Promise<WorkflowInstanceDetail | null> {
  try {
    const res = await wfFetch(apiUrl(agentName, '/instances'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        solution_id: agentName,
      }),
    })
    if (!res.ok) return null
    const instance = await res.json()

    // 自动启动
    const startRes = await wfFetch(
      apiUrl(agentName, `/instances/${instance.instance_id}/start`),
      { method: 'POST' },
    )
    if (startRes.ok) {
      return await startRes.json()
    }
    return instance
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

/** 获取单个工作流实例详情（轮询进度用） */
export async function fetchInstance(
  agentName: string,
  instanceId: string,
  signal?: AbortSignal,
): Promise<WorkflowInstanceDetail | null> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/instances/${instanceId}`), { signal })
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    if (isAbortError(e)) throw e
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

export interface WorkflowInstanceDetail {
  instance_id: string
  workflow_name: string
  status: string
  progress_percent: number
  completed_steps: number
  total_steps: number
  deliverable_count: number
  steps: {
    step_id: string
    step_name: string
    status: string
    elapsed_ms: number
    output_summary: string
    error?: string
  }[]
  deliverables: DeliverableItem[]
  created_at: string
  total_elapsed_ms: number
  error?: string
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: '#a1a1aa' },
  running: { text: '执行中', color: '#3b82f6' },
  paused: { text: '暂停', color: '#eab308' },
  awaiting_approval: { text: '待审批', color: '#f97316' },
  completed: { text: '已完成', color: '#22c55e' },
  failed: { text: '失败', color: '#ef4444' },
  cancelled: { text: '已取消', color: '#71717a' },
}

export function getStatusDisplay(status: string) {
  return STATUS_LABEL[status] || STATUS_LABEL.draft
}

const TYPE_ICON: Record<string, string> = {
  document: '📄',
  record: '📝',
  report: '📊',
  notification: '🔔',
  data_sync: '🔄',
  calculation: '🧮',
}

export function getDeliverableIcon(type: string): string {
  return TYPE_ICON[type] || '📦'
}

/* ── 工作流模板 API ──────────────────────────── */

export async function fetchTemplates(
  agentName: string,
): Promise<WorkflowTemplateDef[]> {
  try {
    const res = await wfFetch(apiUrl(agentName, '/templates'))
    if (!res.ok) return []
    const data = await res.json()
    return data.templates || []
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按空列表处理
    return []
  }
}

export async function fetchCrossAgentWorkflows(
  agentName: string,
  solutionId: string = '',
): Promise<CrossAgentWorkflowDef[]> {
  try {
    const qs = solutionId ? `?solution_id=${solutionId}` : ''
    const res = await wfFetch(apiUrl(agentName, `/cross-agent/workflows${qs}`))
    if (!res.ok) return []
    const data = await res.json()
    return data.workflows || []
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按空列表处理
    return []
  }
}

export async function executeCrossAgentWorkflow(
  agentName: string,
  solutionId: string,
  workflowId: string,
  userId: string,
  userContext: Record<string, string> = {},
): Promise<CrossAgentWorkflowExecuteResponse | null> {
  try {
    const res = await wfFetch(
      apiUrl(agentName, `/cross-agent/${solutionId}/${workflowId}/execute`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, user_context: userContext }),
      },
    )
    if (!res.ok) return null
    return (await res.json()) as CrossAgentWorkflowExecuteResponse
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

export interface ROISummary {
  total_workflows_completed: number
  total_human_hours_saved: number
  total_cost_saved_yuan: number
  total_ai_minutes_spent: number
  avg_acceleration_ratio: number
  solution_breakdown: Record<string, { workflows: number; hours_saved: number; cost_saved: number }>
  headline: string
}

export async function fetchROI(agentName: string, userId: string = ''): Promise<ROISummary | null> {
  try {
    const qs = userId ? `?user_id=${userId}` : ''
    const res = await wfFetch(apiUrl(agentName, `/roi${qs}`))
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

export function getExportUrl(
  agentName: string,
  instanceId: string,
  format: 'html' | 'markdown' | 'excel' | 'pdf' | 'zip' = 'html',
): string {
  return apiUrl(agentName, `/instances/${instanceId}/export?format=${format}`)
}

export function getDeliverableExportUrl(
  agentName: string,
  deliverableId: string,
  format: 'html' | 'markdown' = 'html',
): string {
  return apiUrl(agentName, `/deliverables/${deliverableId}/export?format=${format}`)
}

export async function fetchPendingApprovals(
  agentName: string,
): Promise<PendingApproval[]> {
  try {
    const res = await wfFetch(apiUrl(agentName, '/approvals/pending'))
    if (!res.ok) return []
    const data = await res.json()
    return data.pending || []
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按空列表处理
    return []
  }
}

export async function approveStep(
  agentName: string,
  instanceId: string,
  stepId: string,
  approved: boolean,
  decidedBy: string = '',
  note: string = '',
): Promise<boolean> {
  try {
    const res = await wfFetch(
      apiUrl(agentName, `/instances/${instanceId}/steps/${stepId}/approve`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, decided_by: decidedBy, note }),
      },
    )
    return res.ok
  } catch {
    // Expected: 请求失败或响应异常；按未执行处理
    return false
  }
}

export async function fetchSchedules(
  agentName: string,
): Promise<ScheduleEntry[]> {
  try {
    const res = await wfFetch(apiUrl(agentName, '/schedules'))
    if (!res.ok) return []
    const data = await res.json()
    return data.schedules || []
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按空列表处理
    return []
  }
}

// ── 计费与用量 ────────────────────────────────

export interface BillingUsage {
  org_id: string
  org_name: string
  plan: string
  plan_name: string
  price_yuan: number
  usage: { workflows: number; deliverables: number; billable_total: number }
  limits: { workflows: number; deliverables: number }
  usage_percent: { workflows: number; deliverables: number }
}

export async function fetchBillingUsage(agentName: string, orgId: string): Promise<BillingUsage | null> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/billing/usage?org_id=${orgId}`))
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

// ── Designer ───────────────────────────

export interface DesignerNodeDef {
  node_id: string; node_type: string; label: string
  agent: string; expert: string; description: string
  x: number; y: number; sla_minutes: number; requires_approval: boolean
}
export interface DesignerEdgeDef {
  edge_id: string; source: string; target: string; label: string; condition: string
}
export interface DesignerCanvasDef {
  canvas_id: string; name: string; description: string
  nodes: DesignerNodeDef[]; edges: DesignerEdgeDef[]
  zoom: number; offset_x: number; offset_y: number
}

export async function createCanvas(agentName: string, name: string): Promise<DesignerCanvasDef | null> {
  try {
    const res = await wfFetch(apiUrl(agentName, '/designer/canvas'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

export async function fetchCanvas(agentName: string, canvasId: string): Promise<DesignerCanvasDef | null> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/designer/canvas/${canvasId}`))
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

export async function listCanvases(agentName: string): Promise<Array<{ canvas_id: string; name: string; nodes: number }>> {
  try {
    const res = await wfFetch(apiUrl(agentName, '/designer/canvases'))
    if (!res.ok) return []
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按空列表处理
    return []
  }
}

export async function validateCanvas(agentName: string, canvasId: string): Promise<{ valid: boolean; errors: string[]; warnings: string[] } | null> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/designer/canvas/${canvasId}/validate`))
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

export async function exportCanvas(agentName: string, canvasId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/designer/canvas/${canvasId}/export`), { method: 'POST' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

// ── Analytics ──────────────────────────

export interface AnalyticsOverview {
  period_days: number
  total_executions: number
  success_rate: number
  avg_duration_ms: number
  total_roi_saved: number
  active_workflows: number
  recommendations_count: number
}

export interface AnalyticsRecommendation {
  rec_id: string
  rec_type: string
  title: string
  description: string
  impact: string
  confidence: number
  related_workflow: string
}

export interface ROIPredictionData {
  current_monthly_savings: number
  predicted_next_month: number
  predicted_quarterly: number
  growth_rate: number
  confidence: number
}

export async function fetchAnalyticsOverview(agentName: string, days = 30): Promise<AnalyticsOverview | null> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/analytics/overview?days=${days}`))
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

export async function fetchRecommendations(agentName: string, limit = 5): Promise<AnalyticsRecommendation[]> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/analytics/recommendations?limit=${limit}`))
    if (!res.ok) return []
    const data = await res.json()
    return data.recommendations || []
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按空列表处理
    return []
  }
}

export async function fetchROIPrediction(agentName: string): Promise<ROIPredictionData | null> {
  try {
    const res = await wfFetch(apiUrl(agentName, '/analytics/roi-prediction'))
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

// ── Marketplace ────────────────────────

export interface MarketplaceCard {
  listing_id: string
  title: string
  description: string
  category: string
  tags: string[]
  publisher_name: string
  install_count: number
  avg_rating: number
  rating_count: number
  icon: string
  is_fork: boolean
}

export interface MarketplaceSearchResult {
  total: number
  offset: number
  limit: number
  items: MarketplaceCard[]
}

export async function searchMarketplace(
  agentName: string, query = '', category = '', sortBy = 'popular', limit = 12,
): Promise<MarketplaceSearchResult | null> {
  try {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (category) params.set('category', category)
    params.set('sort_by', sortBy)
    params.set('limit', String(limit))
    const res = await wfFetch(apiUrl(agentName, `/marketplace/search?${params}`))
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

export async function installFromMarketplace(
  agentName: string, listingId: string, orgId = 'default', userId = 'default_user',
): Promise<boolean> {
  try {
    const res = await wfFetch(
      apiUrl(agentName, `/marketplace/${listingId}/install?org_id=${orgId}&user_id=${userId}`),
      { method: 'POST' },
    )
    return res.ok
  } catch {
    // Expected: 请求失败或响应异常；按未执行处理
    return false
  }
}

// ── SLA ────────────────────────────────

export interface SLADashboardData {
  active_trackers: number
  health: { green: number; yellow: number; red: number; black: number }
  active_breaches: number
  total_breaches: number
  trackers: Array<{
    instance_id: string; step_id: string
    elapsed_minutes: number; remaining_minutes: number; deadline_minutes: number
    health: string; warned: boolean; circuit_broken: boolean
  }>
}

export async function fetchSLADashboard(agentName: string): Promise<SLADashboardData | null> {
  try {
    const res = await wfFetch(apiUrl(agentName, '/sla/dashboard'))
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

// ── 通知 ────────────────────────────────

export interface NotificationDef {
  notification_id: string
  org_id: string
  user_id: string
  type: string
  priority: string
  title: string
  body: string
  resource_type: string
  resource_id: string
  action_url: string
  read: boolean
  created_at: string
}

export async function fetchNotifications(
  agentName: string, userId: string, limit = 20, signal?: AbortSignal,
): Promise<{ notifications: NotificationDef[]; unread: number }> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/notifications?user_id=${userId}&limit=${limit}`), {
      signal,
    })
    if (!res.ok) return { notifications: [], unread: 0 }
    return await res.json()
  } catch (e) {
    if (isAbortError(e)) throw e
    // Expected: 通知接口不可达；按空列表与 0 未读处理
    return { notifications: [], unread: 0 }
  }
}

export async function fetchUnreadCount(
  agentName: string, userId: string, signal?: AbortSignal,
): Promise<number> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/notifications/unread-count?user_id=${userId}`), {
      signal,
    })
    if (!res.ok) return 0
    const data = await res.json()
    return data.count || 0
  } catch (e) {
    if (isAbortError(e)) throw e
    // Expected: 未读计数接口不可达；按 0 处理
    return 0
  }
}

export async function markNotificationRead(agentName: string, notificationId: string): Promise<boolean> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/notifications/${notificationId}/read`), { method: 'POST' })
    return res.ok
  } catch {
    // Expected: 请求失败或响应异常；按未执行处理
    return false
  }
}

export async function markAllRead(agentName: string, userId: string): Promise<void> {
  try {
    await wfFetch(apiUrl(agentName, `/notifications/read-all?user_id=${userId}`), { method: 'POST' })
  } catch {
    // Expected: 全部已读为尽力而为；失败不阻断 UI
  }
}

// ── 审计日志 ────────────────────────────────

export interface AuditEntryDef {
  entry_id: string
  org_id: string
  actor_id: string
  actor_type: string
  action: string
  resource_type: string
  resource_id: string
  description: string
  timestamp: string
}

export async function fetchAuditLogs(
  agentName: string, orgId: string, limit = 20,
): Promise<AuditEntryDef[]> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/audit/logs?org_id=${orgId}&limit=${limit}`))
    if (!res.ok) return []
    const data = await res.json()
    return data.entries || []
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按空列表处理
    return []
  }
}

// ── RBAC ────────────────────────────────

export interface RoleMemberDef {
  assignment_id: string
  org_id: string
  user_id: string
  role: string
  permissions: string[]
  assigned_by: string
  assigned_at: string
}

export async function fetchMembers(agentName: string, orgId: string): Promise<RoleMemberDef[]> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/rbac/members?org_id=${orgId}`))
    if (!res.ok) return []
    const data = await res.json()
    return data.members || []
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按空列表处理
    return []
  }
}

export async function assignRole(
  agentName: string, orgId: string, userId: string, role: string, assignedBy = 'admin',
): Promise<boolean> {
  try {
    const res = await wfFetch(apiUrl(agentName, '/rbac/assign'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, user_id: userId, role, assigned_by: assignedBy }),
    })
    return res.ok
  } catch {
    // Expected: 请求失败或响应异常；按未执行处理
    return false
  }
}

// ── 模板版本管理 ────────────────────────────────

export async function rollbackTemplate(agentName: string, templateId: string): Promise<boolean> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/templates/${templateId}/rollback`), { method: 'POST' })
    return res.ok
  } catch {
    // Expected: 请求失败或响应异常；按未执行处理
    return false
  }
}

export async function promoteCanary(agentName: string, templateId: string): Promise<boolean> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/templates/${templateId}/promote`), { method: 'POST' })
    return res.ok
  } catch {
    // Expected: 请求失败或响应异常；按未执行处理
    return false
  }
}

// ── Webhook 管理 ────────────────────────────────

export interface WebhookDef {
  hook_id: string
  name: string
  template_id: string
  source: string
  event_filter: string
  enabled: boolean
  trigger_count: number
  last_triggered_at: string | null
  secret_preview: string
  endpoint: string
}

export interface WebhookEventDef {
  event_id: string
  hook_id: string
  event_type: string
  success: boolean
  instance_id: string | null
  error: string | null
  received_at: string
}

export async function fetchWebhooks(agentName: string): Promise<WebhookDef[]> {
  try {
    const res = await wfFetch(apiUrl(agentName, '/webhooks'))
    if (!res.ok) return []
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按空列表处理
    return []
  }
}

export async function registerWebhook(
  agentName: string,
  body: {
    name: string
    template_id: string
    user_id: string
    source?: string
    event_filter?: string
    param_mapping?: Record<string, string>
    fixed_params?: Record<string, unknown>
  },
): Promise<(WebhookDef & { secret: string }) | null> {
  try {
    const res = await wfFetch(apiUrl(agentName, '/webhooks'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

export async function deleteWebhook(agentName: string, hookId: string): Promise<boolean> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/webhooks/${hookId}`), { method: 'DELETE' })
    return res.ok
  } catch {
    // Expected: 请求失败或响应异常；按未执行处理
    return false
  }
}

export async function fetchWebhookEvents(
  agentName: string, hookId: string, limit = 20,
): Promise<WebhookEventDef[]> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/webhooks/${hookId}/events?limit=${limit}`))
    if (!res.ok) return []
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按空列表处理
    return []
  }
}

export async function startFromTemplate(
  agentName: string,
  templateId: string,
  body: {
    user_id: string
    org_id?: string
    solution_id?: string
    input_params?: Record<string, unknown>
    conversation_id?: string
  },
): Promise<WorkflowInstanceDetail | null> {
  try {
    const res = await wfFetch(apiUrl(agentName, `/templates/${templateId}/start`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

// ── Scheduler 管理 API (P35-P36) ─────────────────

function schedulerUrl(agentName: string, path: string): string {
  return `${BASE_URL}/api/${agentName}/workflow-os/scheduler${path}`
}

export interface SchedulerJobDef {
  job_id: string
  template_id: string
  name: string
  cron_expr: string
  description: string
  status: 'active' | 'paused' | 'removed'
  created_at: string
  last_run_at: string | null
  last_instance_id: string | null
  last_run_status: string | null
  next_run_at: string | null
  run_count: number
  error_count: number
  last_error: string | null
}

export interface SchedulerExecutionDef {
  execution_id: string
  job_id: string
  template_id: string
  instance_id: string | null
  triggered_at: string
  completed_at: string | null
  status: 'running' | 'completed' | 'failed'
  final_workflow_status: string | null
  progress_percent: number
  error: string | null
}

export interface SchedulerStatusDef {
  running: boolean
  backend: string
  persistent_store: boolean
  total_jobs: number
  active_jobs: number
  paused_jobs: number
  total_executions_in_memory: number
  auto_run_enabled: boolean
  max_concurrent: number
  step_executor_available: boolean
}

export async function fetchSchedulerStatus(agentName: string): Promise<SchedulerStatusDef | null> {
  try {
    const res = await wfFetch(schedulerUrl(agentName, '/status'))
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

export async function fetchSchedulerJobs(agentName: string, includeRemoved = false): Promise<SchedulerJobDef[]> {
  try {
    const res = await wfFetch(schedulerUrl(agentName, `/jobs?include_removed=${includeRemoved}`))
    if (!res.ok) return []
    const data = await res.json()
    return data.jobs || []
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按空列表处理
    return []
  }
}

export async function fetchSchedulerJob(agentName: string, jobId: string): Promise<SchedulerJobDef | null> {
  try {
    const res = await wfFetch(schedulerUrl(agentName, `/jobs/${jobId}`))
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

export async function pauseSchedulerJob(agentName: string, jobId: string): Promise<SchedulerJobDef | null> {
  try {
    const res = await wfFetch(schedulerUrl(agentName, `/jobs/${jobId}/pause`), { method: 'POST' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

export async function resumeSchedulerJob(agentName: string, jobId: string): Promise<SchedulerJobDef | null> {
  try {
    const res = await wfFetch(schedulerUrl(agentName, `/jobs/${jobId}/resume`), { method: 'POST' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

export async function triggerSchedulerJob(agentName: string, jobId: string): Promise<SchedulerExecutionDef | null> {
  try {
    const res = await wfFetch(schedulerUrl(agentName, `/jobs/${jobId}/trigger`), { method: 'POST' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按无数据处理
    return null
  }
}

export async function removeSchedulerJob(agentName: string, jobId: string): Promise<boolean> {
  try {
    const res = await wfFetch(schedulerUrl(agentName, `/jobs/${jobId}`), { method: 'DELETE' })
    return res.ok
  } catch {
    // Expected: 请求失败或响应异常；按未执行处理
    return false
  }
}

export async function fetchSchedulerExecutions(
  agentName: string, jobId = '', limit = 50,
): Promise<SchedulerExecutionDef[]> {
  try {
    const qs = new URLSearchParams()
    if (jobId) qs.set('job_id', jobId)
    qs.set('limit', String(limit))
    const res = await wfFetch(schedulerUrl(agentName, `/executions?${qs}`))
    if (!res.ok) return []
    const data = await res.json()
    return data.executions || []
  } catch {
    // Expected: Workflow OS 接口不可达或响应非 JSON；按空列表处理
    return []
  }
}

export async function cleanupSchedulerExecutions(
  agentName: string, maxAgeDays = 90, maxRows = 10000,
): Promise<{ deleted: number }> {
  try {
    const res = await wfFetch(
      schedulerUrl(agentName, `/cleanup?max_age_days=${maxAgeDays}&max_rows=${maxRows}`),
      { method: 'POST' },
    )
    if (!res.ok) return { deleted: 0 }
    return await res.json()
  } catch {
    // Expected: 清理接口不可达；按无删除处理
    return { deleted: 0 }
  }
}
