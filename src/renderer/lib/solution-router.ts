/**
 * Solution Router — 行业方案 → Agent 后端映射
 *
 * 根据用户选择的行业方案，配置连接哪些 Agent 后端、
 * 显示哪些 AI 专家、启用哪些本地计算。
 * 方案切换不需要重启，热切换。
 */

export interface AgentEndpoint {
  id: string
  role: string
  handles: string
  baseUrl: string
  wsUrl: string
}

/** 方案级主题 — 借鉴 WorldMonitor 多变体仪表盘设计 */
export interface SolutionTheme {
  /** 主色调 HSL（写入 --primary / --ring） */
  primary: string
  /** 选区颜色 HSL */
  accent: string
  /** 侧边栏背景 HSL（可选，默认沿用全局 --card） */
  sidebarBg?: string
}

/** 工具表单字段定义 */
export interface ToolField {
  key: string
  label: string
  type: 'text' | 'number' | 'currency' | 'select' | 'date' | 'textarea' | 'file'
  placeholder?: string
  options?: { value: string; label: string }[]
  required?: boolean
  default?: string | number
  /** 数组字段标志：输入字符串按分隔符拆分为数组后提交（用于 List[str] 参数） */
  array?: boolean
  /** 数组分隔符（默认为逗号，支持换行、分号等） */
  arraySeparator?: string
}

/** 快捷操作（方案首页卡片） */
export interface QuickAction {
  id: string
  label: string
  icon: string
  workflowId?: string
  toolId?: string
  description?: string
  cta?: string
}

/** 工具配置 — 配置驱动，不硬编码 */
export interface ToolConfig {
  id: string
  type: 'calculator' | 'document-ai' | 'doc-generator' | 'task-board' | 'batch-processor' | 'automation' | 'setup-wizard' | 'access-control' | 'report' | 'file-export'
  name: string
  icon: string
  /** 对应的 Agent ID（用于 API 调用） */
  agent: string
  /** 远端 API 路径 */
  apiPath: string
  /** HTTP 方法（file-export 默认 GET，其他默认 POST） */
  method?: 'GET' | 'POST'
  /** 本地 Python 脚本（离线可用） */
  localScript?: string
  /** 表单字段（calculator / doc-generator 用） */
  fields?: ToolField[]
  /** 接受的文件类型（document-ai 用） */
  acceptTypes?: string[]
  /** 工具描述 */
  description?: string
  /** 工具分类标签（用于分组展示） */
  category?: string
  /** 导出格式选项（file-export 用） */
  exportFormats?: { value: string; label: string; ext: string }[]
  /** 下载文件名模板（支持 {ticker} {date} 等占位符） */
  fileNameTemplate?: string
}

/** Slash 命令 */
export interface SlashCommand {
  cmd: string
  label: string
  icon: string
  /** 关联工具 ID（打开工具面板）或 null（发送消息） */
  toolId?: string
  description?: string
}

/** 仪表盘组件 */
export interface DashboardWidget {
  type: 'stat' | 'timeline' | 'chart'
  label: string
  source: string
  filter?: string
}

export type WorkbenchTab = 'chat' | 'tools' | 'documents' | 'tasks' | 'dashboard' | 'workflows' | 'approvals' | 'costs' | 'scheduler' | 'designer' | 'efficiency' | 'automation' | 'clients' | 'roi' | 'account' | 'scout' | 'pipeline' | 'brands' | 'erp-sync'
  | 'today' | 'bookkeeping' | 'invoices' | 'tax-filing' | 'reports' | 'tax-planning' | 'consolidated' | 'ipo-prep' | 'audit-report' | 'neeq'
  | 'cases' | 'contracts' | 'legal-docs' | 'billing'
  | 'employees' | 'payroll' | 'compliance' | 'disputes'
  | 'research' | 'portfolio' | 'macro' | 'compliance-pub' | 'mises-export'
  | 'design-engine' | 'dispatch-dashboard' | 'knowledge-graph'

/** 利润影响标注 — 米塞斯 P2：企业的目的是获取利润 */
export interface ProfitImpact {
  /** 影响维度：增收 / 降本 / 避损 */
  dimension: 'revenue' | 'cost_saving' | 'loss_avoidance'
  /** 量化描述（如"省 2 小时/件"、"避免误赔 ¥5 万"） */
  amount: string
}

/** 工作流步骤 — 目标驱动，不硬编码过程 */
export interface WorkflowStep {
  id: string
  agent: string
  expert: string
  label: string
  /** 这一步要达成的目标（不是"怎么做"，而是"做到什么"） */
  goal: string
  /** 可衡量的成功标准（评估 AI 输出质量的依据） */
  successCriteria: string[]
  description?: string
  /** 此步骤对企业家利润的影响（米塞斯 P2） */
  profitImpact?: ProfitImpact
}

/** 工作流定义 — 目标驱动的多 Agent 编排 */
export interface WorkflowConfig {
  id: string
  name: string
  icon: string
  description: string
  /** sequential = 流水线（步骤间传递结果）, parallel = 并行合并, single = 单步执行 */
  mode: 'sequential' | 'parallel' | 'single'
  /** 工作流的最终交付物（用户能拿到什么） */
  deliverable: string
  /** 整体成功标准（如何判定工作流完成） */
  successCriteria: string[]
  steps: WorkflowStep[]
  /** 触发词（Chat 自动匹配） */
  triggerPhrases?: string[]
}

/** 快捷场景 — 目标驱动的一键提问 */
export interface ScenarioConfig {
  id: string
  label: string
  icon: string
  /** 预置 prompt 模板（含 {placeholder}） */
  prompt: string
  /** 期望输出的类型和质量标准 */
  expectedOutcome: string
  /** 路由到的 Agent.Expert */
  expert?: string
  /** 路由到的工作流 ID（与 expert 二选一） */
  workflowId?: string
  /** 专用 API 端点（绕过通用 /consult，直调 Agent 特定接口） */
  apiEndpoint?: string
  /** HTTP 方法（默认 GET） */
  apiMethod?: 'GET' | 'POST'
  /** 此场景对企业家利润的影响（米塞斯 P2） */
  profitImpact?: ProfitImpact
}

export interface SafetyRule {
  id: string
  label: string
  trigger: string
  action: string
}

export interface SolutionConfig {
  id: string
  name: string
  icon: string
  color: string
  tagline: string
  description: string
  /** 方案状态：available / disabled / draft / coming_soon */
  status?: 'available' | 'disabled' | 'draft' | 'coming_soon'
  /** 企业家的商业目的（米塞斯 P1：人的行为是有目的的） */
  entrepreneurPurpose: string
  /** 利润指标（米塞斯 P2：企业的目的是获取利润） */
  profitMetrics: string[]
  /** 人力等效数据（米塞斯 P3：帮企业家做经济计算） */
  valueEquivalent?: { humanHours: number; mbeMinutes: number; acceleration: string }
  agents: AgentEndpoint[]
  /** 本地可用的确定性计算脚本 */
  localScripts: string[]
  /** 离线可用的知识缓存 */
  knowledgeCache: string[]
  /** 行业方案专属主题（色彩差异化） */
  theme: SolutionTheme
  /** 业务工具配置 */
  tools: ToolConfig[]
  /** Slash 命令（Chat → 工具桥接） */
  slashCommands: SlashCommand[]
  /** 可用的 Tab 页 */
  enabledTabs: WorkbenchTab[]
  /** 仪表盘组件 */
  dashboardWidgets?: DashboardWidget[]
  /** 行业工作流（多 Agent 编排） */
  workflows: WorkflowConfig[]
  /** 快捷场景（一键提问） */
  scenarios: ScenarioConfig[]
  /** 安全规则（AI 输出合规保障） */
  safetyRules?: SafetyRule[]
  /** 快捷操作（方案首页卡片） */
  quickActions?: QuickAction[]
  /** P2-10: 首次进入引导配置（QuickBooks 风格） */
  onboarding?: {
    questions: { key: string; label: string; options: string[] }[]
  }
}

import { API_BASE, authHeaders } from '@/lib/api-client'
import { SOLUTION_REGISTRY } from './solution-registry-data'

export { agent } from './solution-router-agent'
export { SOLUTION_REGISTRY }

/**
 * 后端同步的方案状态缓存
 * Admin 后台修改 status 后，Desktop 前端通过此缓存感知变更。
 *
 * 用户级可见性：后端 /api/v1/solutions（不带 include_disabled）
 * 会根据 user_solution_roles 表过滤，只返回当前用户被授权的方案。
 * _returnedIds 记录本次后端实际返回的方案 ID 白名单：
 *   - 已拉取过后端数据 && 方案不在白名单 → 视为 'disabled'（用户无权）
 *   - 离线 / 未拉取（_statusFetchedAt === 0）→ 回退本地注册表状态
 */
const _remoteStatuses = new Map<string, SolutionConfig['status']>()
const _returnedIds = new Set<string>()
let _statusFetchedAt = 0

/**
 * 重置方案状态缓存。
 * 在用户登出或切换账号时调用，防止上一用户的数据污染新用户的视图。
 */
export function resetSolutionStatuses(): void {
  _remoteStatuses.clear()
  _returnedIds.clear()
  _statusFetchedAt = 0
}

export async function fetchSolutionStatuses(): Promise<Map<string, SolutionConfig['status']>> {
  try {
    const url = `${API_BASE}/api/v1/solutions`
    console.log(`[SolutionRouter] fetching ${url}`)
    const res = await fetch(url, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(10_000),
    })
    console.log(`[SolutionRouter] response status=${res.status} ok=${res.ok} type=${res.headers.get('content-type')}`)
    if (res.ok) {
      const data = await res.json()
      const solutions: { id: string; status?: string }[] = data.solutions || []
      console.log(`[SolutionRouter] received ${solutions.length} solutions:`, solutions.map(s => s.id))
      _remoteStatuses.clear()
      _returnedIds.clear()
      for (const sol of solutions) {
        _returnedIds.add(sol.id)
        if (sol.status && sol.status !== 'available') {
          _remoteStatuses.set(sol.id, sol.status as SolutionConfig['status'])
        }
      }
      _statusFetchedAt = Date.now()
    } else {
      const body = await res.text().catch(() => '<unreadable>')
      console.error(`[SolutionRouter] non-ok response body (first 500 chars):`, body.slice(0, 500))
    }
  } catch (err) {
    console.warn('[SolutionRouter] fetchSolutionStatuses failed – user may see unfiltered solutions:', err)
  }
  console.log(`[SolutionRouter] final state: returnedIds=${[..._returnedIds]}, fetchedAt=${_statusFetchedAt}`)
  return _remoteStatuses
}

/** 获取指定方案的有效状态（远端覆盖本地；未在白名单中则视为 disabled） */
export function getEffectiveStatus(id: string): NonNullable<SolutionConfig['status']> {
  // 已成功从后端拉取过数据，且该方案不在返回白名单中 → 用户无权访问
  if (_statusFetchedAt > 0 && !_returnedIds.has(id)) {
    return 'disabled'
  }
  return _remoteStatuses.get(id) ?? SOLUTION_REGISTRY.find(s => s.id === id)?.status ?? 'available'
}

/** 状态缓存是否已初始化 */
export function isStatusSynced(): boolean {
  return _statusFetchedAt > 0
}

export function getSolution(id: string): SolutionConfig | undefined {
  return SOLUTION_REGISTRY.find(s => s.id === id)
}

/** 仅返回已上架的方案（远端状态覆盖本地定义） */
export function getAvailableSolutions(): SolutionConfig[] {
  return SOLUTION_REGISTRY.filter(s => getEffectiveStatus(s.id) === 'available')
}

export function getDefaultAgent(solution: SolutionConfig): AgentEndpoint {
  return solution.agents[0]
}

/** 默认主题（无方案选中时恢复） */
const DEFAULT_THEME: SolutionTheme = {
  primary: '217 91% 60%',
  accent: '217 91% 60%',
}

/**
 * 将方案主题注入 CSS 变量 — 借鉴 WorldMonitor 多变体仪表盘
 *
 * WorldMonitor 用单代码库为 Market/Company/Geo/Climate/Aviation 5 个变体
 * 切换色彩和布局。MBE 用 CSS 变量实现同样效果，零组件代码改动。
 */
export function applySolutionTheme(solutionId: string | null): () => void {
  const root = document.documentElement
  const solution = solutionId ? getSolution(solutionId) : undefined
  const theme = solution?.theme ?? DEFAULT_THEME

  root.style.setProperty('--primary', theme.primary)
  root.style.setProperty('--ring', theme.primary)
  root.style.setProperty('--accent', theme.accent)

  if (theme.sidebarBg) {
    root.style.setProperty('--card', theme.sidebarBg)
  } else {
    root.style.removeProperty('--card')
  }

  root.setAttribute('data-solution', solutionId ?? '')

  return () => {
    root.style.setProperty('--primary', DEFAULT_THEME.primary)
    root.style.setProperty('--ring', DEFAULT_THEME.primary)
    root.style.setProperty('--accent', DEFAULT_THEME.accent)
    root.style.removeProperty('--card')
    root.removeAttribute('data-solution')
  }
}
