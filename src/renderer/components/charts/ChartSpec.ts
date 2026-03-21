/**
 * ChartSpec TypeScript 类型定义
 *
 * 与后端 mbe-agent-core/charts/schema.py 的 ChartSpec 完全对齐。
 * 前端使用 Recharts/ECharts 根据 ChartSpec JSON 渲染图表。
 *
 * 对应后端 API：
 *   GET  /api/{agent}/charts/templates  → { templates: TemplateInfo[] }
 *   POST /api/{agent}/charts/render-spec → ChartSpec
 *   GET  /api/{agent}/charts/types → { types: ChartTypeInfo[] }
 */

export type ChartType =
  | 'line'
  | 'bar'
  | 'pie'
  | 'scatter'
  | 'radar'
  | 'heatmap'
  | 'treemap'
  | 'sankey'
  | 'gauge'
  | 'table'

export interface SeriesData {
  name: string
  data: number[]
  type?: string
  color?: string
  stack?: string
}

export interface ChartSpec {
  chart_type: ChartType
  title: string
  subtitle: string
  data: Record<string, unknown>
  series: SeriesData[]
  x_axis?: string[]
  y_axis_label: string
  options: Record<string, unknown>
  responsive: boolean
  height: number
  theme: string
}

export interface RenderSpecRequest {
  chart_type: ChartType
  title?: string
  data?: Record<string, unknown>
  options?: Record<string, unknown>
  template_id?: string
  template_params?: Record<string, unknown>
}

export interface TemplateInfo {
  template_id: string
  name: string
  agent: string
  description: string
}

export interface ChartTypeInfo {
  value: ChartType
  label: string
}

/**
 * 从后端获取并渲染 ChartSpec
 */
export async function fetchChartSpec(
  apiBase: string,
  agentName: string,
  request: RenderSpecRequest,
): Promise<ChartSpec> {
  const res = await fetch(`${apiBase}/api/${agentName}/charts/render-spec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!res.ok) throw new Error(`Chart render failed: ${res.status}`)
  return res.json()
}

/**
 * 获取可用的图表模板列表
 */
export async function fetchChartTemplates(
  apiBase: string,
  agentName: string,
): Promise<TemplateInfo[]> {
  const res = await fetch(`${apiBase}/api/${agentName}/charts/templates`)
  if (!res.ok) return []
  const data = await res.json()
  return data.templates || []
}
