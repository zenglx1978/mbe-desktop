/**
 * MBE Desktop 可视化组件 — 共享类型定义
 *
 * 三条前沿线的公共接口：
 * 1. Data Poetry（数据诗）— 首页星系 + 交付物动效
 * 2. Agent 协作热力图 + 注意力流 — 编排面板 + 知识溯源 + 时间线 + 热力图
 * 3. Dithering 交互解释 — 置信度梯度 + 滚动叙事
 */

// ─── Direction 2: Agent Collaboration ───────────────────

export interface ExpertStatus {
  id: string
  name: string
  role?: string
  status: 'idle' | 'working' | 'done' | 'error'
  elapsed_ms?: number
  token_used?: number
  kb_sources_hit?: number
}

export interface OrchestrationInfo {
  mode: 'parallel' | 'sequential' | 'fan_out' | 'single'
  experts: ExpertStatus[]
  total_elapsed_ms?: number
  solution_id?: string
  workflow_id?: string
}

export type SourceType = 'law' | 'statute' | 'regulation' | 'standard' | 'accounting'
  | 'rule' | 'case' | 'guideline' | 'research' | 'custom'

export interface SourceCitationData {
  title: string
  ref?: string
  url?: string
  reliability: 'high' | 'medium' | 'low'
  confidence?: number
  expired?: boolean
  source_type?: SourceType
  file_path?: string
  retrieval_method?: 'vector' | 'keyword' | 'rule' | 'hybrid'
  authority?: string
}

export interface FluencyData {
  confidence_grade: ConfidenceGrade
  confidence_score?: number
  interaction_mode?: 'automation' | 'augmentation' | 'referral'
  has_sources?: boolean
}

// ─── Direction 3: Confidence / Dithering ────────────────

export type ConfidenceGrade = 'very_high' | 'high' | 'medium' | 'low'

export interface ConfidenceLevel {
  bg: string
  border: string
  bar: string
  label: string
  desc: string
  pattern?: string
}

// ─── Direction 1: Data Poetry ───────────────────────────

export interface SolutionNode {
  id: string
  name: string
  icon?: string
  expert_count: number
  active_workflows: number
  completed_today: number
  color: string
}

export interface ExpertOrbit {
  expert_id: string
  name: string
  status: 'idle' | 'working'
  angle: number
  radius: number
}

export interface WorkflowMeteor {
  id: string
  from_expert: string
  to_expert?: string
  progress: number
  opacity: number
}

export interface DeliverableInfo {
  type: 'contract' | 'report' | 'record' | 'analysis' | 'plan'
  title: string
  expert_name: string
  created_at: string
}

// ─── WorkflowOS Timeline ───────────────────────────────

export interface WorkflowStep {
  id: string
  expert_id: string
  expert_name: string
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped'
  elapsed_ms?: number
  token_used?: number
  kb_sources_hit?: number
  output_summary?: string
}

export interface WorkflowTimeline {
  workflow_id: string
  workflow_name: string
  solution_id: string
  steps: WorkflowStep[]
  total_elapsed_ms?: number
  trigger_time: string
}

// ─── Agent Heatmap ─────────────────────────────────────

export interface HeatmapCell {
  row_id: string
  col_id: string
  value: number
  label?: string
}

export interface HeatmapData {
  title: string
  row_labels: { id: string; name: string }[]
  col_labels: { id: string; name: string }[]
  cells: HeatmapCell[]
  min_value: number
  max_value: number
  color_scale: 'green' | 'blue' | 'red' | 'diverging'
}

// ─── Scrollytelling ────────────────────────────────────

export interface ScrollySection {
  id: string
  type: 'hero' | 'comparison' | 'calculator' | 'workflow' | 'cta'
  title: string
  subtitle?: string
  content?: string
  data?: Record<string, unknown>
}

export interface ScrollyConfig {
  solution_id: string
  solution_name: string
  sections: ScrollySection[]
}
