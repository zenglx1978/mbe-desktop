/**
 * Portal Service — 客户门户数据接入
 *
 * 对接 _build-api 新增的客户门户 API：
 *   GET /portal/api/my-company
 *   GET /portal/api/ai-status
 *   GET /portal/api/monthly-report
 *   GET /portal/api/active-agents
 *   GET /portal/api/takeover-status
 *
 * 供 ROIPanel / DashboardPanel 等展示公司 AI 就绪度与派遣月报。
 */

import { authFetch, API_BASE } from './api-client'

export interface PortalAIStatus {
  twin_id: string
  company_name: string
  ai_score: number
  total_employees: number
  ai_covered_employees: number
  ai_covered_rate: number
  monthly_saved_hours: number
  monthly_saved_cost: number
  agents_active: string[]
  last_updated: string
}

export interface PortalMyCompany {
  company_name: string
  twin_id: string
  industry: string
  employee_count: number
  contract_status: string
  onboarding_completed: boolean
}

export interface PortalMonthlyReportMonth {
  month: string
  saved_hours: number
  saved_cost: number
  agent_calls: number
  roi_percent: number
}

export interface PortalActiveAgent {
  agent_id: string
  agent_name: string
  expert_id: string
  last_active: string
  calls_this_month: number
}

export interface PortalTakeoverStatus {
  role_name: string
  takeover_percent: number
  status: 'active' | 'pending' | 'paused'
  started_at: string
}

async function portalGet<T>(path: string): Promise<T | null> {
  try {
    const res = await authFetch(`${API_BASE}${path}`)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export const portalService = {
  getMyCompany: () => portalGet<PortalMyCompany>('/portal/api/my-company'),

  getAIStatus: () => portalGet<PortalAIStatus>('/portal/api/ai-status'),

  getMonthlyReport: (months = 6) =>
    portalGet<{ months: PortalMonthlyReportMonth[] }>(`/portal/api/monthly-report?months=${months}`),

  getActiveAgents: () =>
    portalGet<{ agents: PortalActiveAgent[] }>('/portal/api/active-agents'),

  getTakeoverStatus: () =>
    portalGet<{ roles: PortalTakeoverStatus[] }>('/portal/api/takeover-status'),
}
