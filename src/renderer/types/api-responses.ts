/**
 * 前端与后端 / Agent API 交互的通用响应类型（仅类型，无运行时）
 */

// ── 咨询 / 聊天（非流式 JSON：/consult、/secretary/chat、/chat、/ask） ──

/** 单条知识或引用来源（结构因 Agent 而异，允许扩展字段） */
export interface KnowledgeSourceItem {
  title?: string
  url?: string
  snippet?: string
  ref?: string
}

export interface ConsultBillingInfo {
  tokens_in?: number
  tokens_out?: number
  cost_yuan?: number
}

/**
 * 咨询类接口常见 JSON 形态（多字段名并存以兼容不同后端）
 */
export interface ConsultResponse {
  success?: boolean
  answer?: string
  text?: string
  content?: string
  message?: string
  expert?: string
  confidence?: number
  sources?: KnowledgeSourceItem[]
  source_citation?: KnowledgeSourceItem[] | unknown
  billing?: ConsultBillingInfo
  local_actions?: unknown[]
  workflow_suggestion?: unknown
  workflow_instance?: unknown
}

// ── 分页列表 ──

export interface PaginatedListResponse<T> {
  items: T[]
  total: number
  page?: number
}

// ── 通用成功包装 ──

export interface ApiSuccessResponse {
  success: boolean
  message: string
  data?: unknown
}

// ── 健康检查 ──

export interface HealthApiResponse {
  status: string
  service: string
  version: string
}

// ── OAuth / 登录 ──

export interface AuthTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
}

// ── Solution /ask 与宏观类嵌套 data ──

export interface MacroNestedData {
  report?: string
  summary?: string
  analysis?: string
  signal?: string
  scores?: unknown
  indicators?: unknown
  risk_on_off?: string
  recommendation?: string
}

export interface SuccessDataEnvelope {
  success?: boolean
  data?: MacroNestedData | Record<string, unknown>
}

// ── 工作流 SSE / 流事件 ──

export interface WorkflowStreamEvent {
  type?: string
  step_id?: string
  agent?: string
  expert?: string
  step?: number
  success?: boolean
  error?: string
  message?: string
  answer?: string
  text?: string
  elapsed_ms?: number
  duration_ms?: number
}

// ── 跨 Agent 工作流执行 ──

export interface CrossAgentWorkflowExecuteResponse {
  success?: boolean
  instance_id?: string
  workflow_name?: string
  status?: string
  error?: string
  message?: string
  merged_answer?: string
}

// ── 账户任务 / 文档 API ──

export interface AccountTaskApiRow {
  id: string
  title: string
  status: string
  priority: string
  dueDate?: string | null
  note?: string | null
  createdAt: string
  completedAt?: string | null
  source?: string
  solutionId?: string
}

export interface AccountTasksListResponse {
  tasks?: AccountTaskApiRow[]
}

export interface AccountDocumentApiRow {
  id: string
  title: string
  type: string
  content: string
  createdAt: string
  updatedAt: string
  source?: string
  solutionId?: string
}

export interface AccountDocumentsListResponse {
  documents?: AccountDocumentApiRow[]
}

// ── 审计导出 ──

export interface AuditExportJsonResponse {
  csv?: string
}

// ── 快捷场景 POST body（/api/v1/solutions/.../ask） ──

export interface ScenarioAskBody {
  query: string
  expert_hint?: string
  workflow_hint?: string
  solution_id?: string
  solution_role?: string
  sub_account_id?: string
}

// ── Electron preload 最小形状（渲染进程通过 window.electronAPI 访问） ──

export interface LocalInferenceIPCResult {
  text: string
  source: string
  confidence: number
  suggestOnline?: boolean
}

export interface ElectronInferenceBridge {
  answer?: (text: string, solutionId?: string) => Promise<LocalInferenceIPCResult>
}

export interface ElectronMemoryBridge {
  getPromptText?: (solutionId?: string) => Promise<string | null | undefined>
  learn?: (userMessage: string, solutionId?: string, conversationId?: string) => Promise<unknown>
}

export interface RunLocalCalcRawResult {
  success: boolean
  result?: string
  error?: string
}

export interface ElectronDbConversationRow {
  id: string
  title?: string
  message_count?: number
  created_at?: string
  updated_at?: string
}

export interface ElectronDbCalcRow {
  id: string
  tool_id: string
  created_at?: string
  source?: string
}

export interface ElectronDbTaskRow {
  id: string
  title: string
  status: string
  due_date?: string
  created_at?: string
  updated_at?: string
}

export interface ElectronDbBridge {
  conversations?: { list?: (solutionId: string) => Promise<ElectronDbConversationRow[]> }
  calc?: { list?: (solutionId: string) => Promise<ElectronDbCalcRow[]>; add?: (row: Record<string, unknown>) => Promise<unknown> }
  tasks?: { list?: (solutionId: string) => Promise<ElectronDbTaskRow[]> }
}

export interface ElectronEcommerceCsBridge {
  addReply?: (opts: Record<string, unknown>) => Promise<{ id?: string }>
}

export interface ElectronAccessibilityBridge {
  readChat?: (appKey: string) => Promise<unknown>
}

export interface ElectronSessionBridge {
  set: (key: string, value: unknown) => void | Promise<void>
  get: (key: string) => Promise<unknown>
  remove: (key: string) => void | Promise<void>
}

export interface ElectronCalcBridge {
  pythonAvailable: () => Promise<boolean>
  available: () => Promise<string[]>
}

/** 各文件实际用到的 preload 字段子集 */
export interface ElectronAPIPreload {
  inference?: ElectronInferenceBridge
  memory?: ElectronMemoryBridge
  runLocalCalc?: (script: string, args: string[] | Record<string, unknown>) => Promise<RunLocalCalcRawResult>
  db?: ElectronDbBridge
  ecommerceCs?: ElectronEcommerceCsBridge
  accessibility?: ElectronAccessibilityBridge
  session?: ElectronSessionBridge
  calc?: ElectronCalcBridge
}

export type WindowWithElectron = Window & { electronAPI?: ElectronAPIPreload }
