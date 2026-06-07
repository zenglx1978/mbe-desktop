/**
 * API 响应 Zod Schema 集合
 *
 * 目的：在 API 数据进入 React state 之前做校验 + 默认值填充，
 * 彻底断掉因后端返回 null/undefined 字段导致的运行时崩溃。
 *
 * 用法：
 *   import { parseOptDashboard } from '@/lib/api-schemas'
 *   const dashboard = parseOptDashboard(await res.json())
 *   setOptDashboard(dashboard)  // 永远是合法结构，永不 undefined
 */

import { z } from 'zod'

// ─── 通用工具 ──────────────────────────────────────────────────────────────────

/**
 * 安全解析：解析成功则返回数据，失败则返回 schema 带默认值的空结构，不抛错。
 * 同时在开发环境输出警告以便排查问题。
 */
export function safeParse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (result.success) return result.data
  if (process.env.NODE_ENV === 'development') {
    console.warn('[api-schemas] safeParse failed, using defaults:', result.error.flatten())
  }
  // 用 schema 的默认值生成兜底数据
  return schema.parse({})
}

// ─── 效率优化面板 (EfficiencyPanel) ───────────────────────────────────────────

export const OptSuggestionSchema = z.object({
  suggestion_id:               z.string().default(''),
  step_type:                   z.string().default(''),
  step_display_name:           z.string().default(''),
  current_avg_seconds:         z.number().default(0),
  estimated_ai_seconds:        z.number().default(0),
  speedup_ratio:               z.number().default(0),
  matched_agent:               z.string().default(''),
  matched_capabilities:        z.array(z.string()).default([]),
  confidence:                  z.number().default(0),
  estimated_monthly_savings:   z.number().default(0),
  estimated_time_saved_hours:  z.number().default(0),
  score_pct:                   z.number().default(0),
  status:                      z.string().default(''),
  created_at:                  z.string().default(''),
})
export type OptSuggestion = z.infer<typeof OptSuggestionSchema>

export const OptRuleSchema = z.object({
  rule_id:                   z.string().default(''),
  step_type:                 z.string().default(''),
  target_agent:              z.string().default(''),
  trigger_mode:              z.string().default(''),
  total_executions:          z.number().default(0),
  total_time_saved_seconds:  z.number().default(0),
  total_cost_saved:          z.number().default(0),
})
export type OptRule = z.infer<typeof OptRuleSchema>

const OptSummarySchema = z.object({
  total_cost_saved:       z.number().default(0),
  total_time_saved_hours: z.number().default(0),
  active_rules:           z.number().default(0),
  pending_suggestions:    z.number().default(0),
  auto_mode:              z.boolean().default(false),
})

export const OptDashboardSchema = z.object({
  summary: OptSummarySchema.default({
    total_cost_saved: 0, total_time_saved_hours: 0,
    active_rules: 0,     pending_suggestions: 0,
    auto_mode: false,
  }),
  active_rules:        z.array(OptRuleSchema).default([]),
  pending_suggestions: z.array(OptSuggestionSchema).default([]),
  step_aggregates:     z.array(z.object({
    step_type: z.string().default(''),
    count:     z.number().default(0),
    avg_ms:    z.number().default(0),
  })).default([]),
})
export type OptDashboard = z.infer<typeof OptDashboardSchema>

export function parseOptDashboard(raw: unknown): OptDashboard {
  return safeParse(OptDashboardSchema, raw)
}

// ─── Workflow OS 分析数据 (DashboardCharts / workflow-os-service) ──────────────

export const AnalyticsOverviewSchema = z.object({
  period_days:          z.number().default(30),
  total_executions:     z.number().default(0),
  success_rate:         z.number().default(0),
  avg_duration_ms:      z.number().default(0),
  total_roi_saved:      z.number().default(0),
  active_workflows:     z.number().default(0),
  recommendations_count: z.number().default(0),
})
export type AnalyticsOverview = z.infer<typeof AnalyticsOverviewSchema>

export function parseAnalyticsOverview(raw: unknown): AnalyticsOverview {
  return safeParse(AnalyticsOverviewSchema, raw)
}

export const ROIPredictionDataSchema = z.object({
  current_monthly_savings: z.number().default(0),
  predicted_next_month:    z.number().default(0),
  predicted_quarterly:     z.number().default(0),
  growth_rate:             z.number().default(0),
  confidence:              z.number().default(0),
})
export type ROIPredictionData = z.infer<typeof ROIPredictionDataSchema>

export function parseROIPredictionData(raw: unknown): ROIPredictionData {
  return safeParse(ROIPredictionDataSchema, raw)
}

// ─── ROI 面板 (ROIPanel) ──────────────────────────────────────────────────────

export const RoleROISchema = z.object({
  role:          z.string().default(''),
  role_display:  z.string().default(''),
  revenue:       z.number().default(0),
  cost:          z.number().default(0),
  profit:        z.number().default(0),
  roi_percent:   z.number().default(0),
  user_count:    z.number().default(0),
})

export const ROISummarySchema = z.object({
  total_revenue:  z.number().default(0),
  total_cost:     z.number().default(0),
  total_profit:   z.number().default(0),
  overall_roi:    z.number().default(0),
  roles:          z.array(RoleROISchema).default([]),
  period:         z.string().default(''),
})
export type ROISummary = z.infer<typeof ROISummarySchema>

export function parseROISummary(raw: unknown): ROISummary {
  return safeParse(ROISummarySchema, raw)
}
