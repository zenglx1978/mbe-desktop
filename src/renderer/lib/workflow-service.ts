/**
 * 工作流执行服务
 * 调用 Solution Runtime API 执行多 Agent 编排工作流，
 * 支持 SSE 流式获取每个步骤的进度。
 */

import type { WorkflowConfig, ScenarioConfig, WorkflowStep } from './solution-router'
import { authHeaders, API_BASE } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import type {
  ConsultResponse,
  ScenarioAskBody,
  SuccessDataEnvelope,
  WorkflowStreamEvent,
} from '@/types/api-responses'

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true
  if (err instanceof Error && err.name === 'AbortError') return true
  return false
}

/** 合并用户取消与超时，任一方触发即中止 */
function withTimeoutAndUser(userSignal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeoutSig = AbortSignal.timeout(ms)
  if (!userSignal) return timeoutSig
  const c = new AbortController()
  const forward = () => {
    c.abort()
  }
  userSignal.addEventListener('abort', forward, { once: true })
  timeoutSig.addEventListener('abort', forward, { once: true })
  if (userSignal.aborted || timeoutSig.aborted) c.abort()
  return c.signal
}

export type WorkflowRequestOptions = { signal?: AbortSignal }

/** 获取当前计费归因字段（solution_role / sub_account_id） */
function getBillingFields(): Record<string, string> {
  const b = useAppStore.getState().getBillingContext()
  if (!b) return {}
  const fields: Record<string, string> = {}
  if (b.solutionId) fields.solution_id = b.solutionId
  if (b.solutionRole) fields.solution_role = b.solutionRole
  if (b.subAccountId) fields.sub_account_id = b.subAccountId
  return fields
}

export type StepStatus = 'pending' | 'running' | 'done' | 'error'

export interface StepResult {
  stepId: string
  status: StepStatus
  answer?: string
  error?: string
  durationMs?: number
  expert?: string
}

export interface WorkflowResult {
  success: boolean
  workflowId: string
  mode: string
  steps: StepResult[]
  mergedAnswer?: string
  totalDurationMs: number
  error?: string
}

export type StepProgressCallback = (stepId: string, status: StepStatus, partial?: string) => void

/**
 * 执行工作流 — 调用 Solution Runtime API
 * POST /api/v1/solutions/{solutionId}/workflows/{workflowId}
 */
export async function executeWorkflow(
  solutionId: string,
  workflow: WorkflowConfig,
  query: string,
  params: Record<string, string>,
  onProgress?: StepProgressCallback,
): Promise<WorkflowResult> {
  const startTime = Date.now()
  const stepResults: StepResult[] = workflow.steps.map(s => ({
    stepId: s.id, status: 'pending' as StepStatus,
  }))

  // 尝试 SSE 流式
  const sseResult = await trySSE(solutionId, workflow, query, params, stepResults, onProgress)
  if (sseResult) return { ...sseResult, totalDurationMs: Date.now() - startTime }

  // Fallback: 常规 POST
  return executeStandard(solutionId, workflow, query, params, stepResults, startTime, onProgress)
}

async function trySSE(
  solutionId: string,
  workflow: WorkflowConfig,
  query: string,
  params: Record<string, string>,
  stepResults: StepResult[],
  onProgress?: StepProgressCallback,
  signal?: AbortSignal,
): Promise<Omit<WorkflowResult, 'totalDurationMs'> | null> {
  try {
    const url = `${API_BASE}/api/v1/solutions/${solutionId}/workflows/${workflow.id}/stream`
    const resp = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ query, params, ...getBillingFields() }),
      signal,
    })

    if (!resp.ok || !resp.body) return null

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE 协议：事件以空行分隔，每个事件含 event: 和 data: 行
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() || ''

      for (const block of blocks) {
        if (!block.trim()) continue
        let eventType = ''
        let dataStr = ''
        for (const line of block.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim()
          else if (line.startsWith('data: ')) dataStr = line.slice(6).trim()
        }
        if (dataStr === '[DONE]') break
        if (!dataStr) continue

        try {
          const evt = JSON.parse(dataStr) as WorkflowStreamEvent
          evt.type = eventType || evt.type
          processEvent(evt, workflow.steps, stepResults, onProgress)
        } catch {
          // Expected: SSE 事件块非 JSON 或结构不兼容；跳过该块
        }
      }
    }

    const mergedAnswer = stepResults
      .filter(s => s.status === 'done' && s.answer)
      .map(s => s.answer)
      .join('\n\n---\n\n')

    return {
      success: stepResults.every(s => s.status === 'done'),
      workflowId: workflow.id,
      mode: workflow.mode,
      steps: stepResults,
      mergedAnswer: mergedAnswer || undefined,
    }
  } catch (e) {
    if (isAbortError(e)) throw e
    // Expected: 工作流流式执行失败；返回 null
    return null
  }
}

async function executeStandard(
  solutionId: string,
  workflow: WorkflowConfig,
  query: string,
  params: Record<string, string>,
  stepResults: StepResult[],
  startTime: number,
  onProgress?: StepProgressCallback,
  signal?: AbortSignal,
): Promise<WorkflowResult> {
  try {
    // 按步骤依次执行（sequential 模式）
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i]
      const sr = stepResults[i]

      sr.status = 'running'
      onProgress?.(step.id, 'running')
      const stepStart = Date.now()

      try {
        const prevAnswer = i > 0 ? stepResults[i - 1].answer : undefined
        const enrichedQuery = prevAnswer
          ? `${query}\n\n[上一步分析结果]\n${prevAnswer}`
          : query

        const data = await callStepWithFallback(
          solutionId, step, enrichedQuery, params, signal,
        )
        sr.status = 'done'
        sr.answer =
          data.answer || data.text || data.content || JSON.stringify(data)
        sr.expert = `${step.agent}.${step.expert}`
        sr.durationMs = Date.now() - stepStart
        onProgress?.(step.id, 'done', sr.answer)
      } catch (err: unknown) {
        if (isAbortError(err)) throw err
        sr.status = 'error'
        sr.error = err instanceof Error ? err.message : '请求失败'
        sr.durationMs = Date.now() - stepStart
        onProgress?.(step.id, 'error', sr.error)
      }
    }

    const mergedAnswer = stepResults
      .filter(s => s.status === 'done' && s.answer)
      .map(s => s.answer)
      .join('\n\n---\n\n')

    return {
      success: stepResults.every(s => s.status === 'done'),
      workflowId: workflow.id,
      mode: workflow.mode,
      steps: stepResults,
      mergedAnswer: mergedAnswer || undefined,
      totalDurationMs: Date.now() - startTime,
    }
  } catch (err: unknown) {
    if (isAbortError(err)) throw err
    return {
      success: false,
      workflowId: workflow.id,
      mode: workflow.mode,
      steps: stepResults,
      totalDurationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : '请求失败',
    }
  }
}

/**
 * 执行快捷场景 — 调用 /ask 智能路由
 */
export async function executeScenario(
  solutionId: string,
  scenario: ScenarioConfig,
  userInput?: string,
  opts?: WorkflowRequestOptions,
): Promise<{ success: boolean; answer?: string; error?: string; durationMs: number }> {
  const start = Date.now()
  const reqSignal = withTimeoutAndUser(opts?.signal, 60_000)
  try {
    // 专用 API 端点直调（绕过通用 /consult，如 WorldMonitor 宏观数据管线）
    if (scenario.apiEndpoint) {
      try {
        const method = scenario.apiMethod || 'GET'
        const url = `${API_BASE}${scenario.apiEndpoint}`
        const reqInit: RequestInit = {
          method,
          headers: authHeaders(),
          signal: reqSignal,
        }
        if (method === 'POST') {
          reqInit.body = JSON.stringify({ query: userInput || scenario.prompt, ...getBillingFields() })
        }
        const directResp = await fetch(url, reqInit)
        if (directResp.ok) {
          const data = await directResp.json()
          const answer = extractAnswer(data)
          if (answer) {
            return { success: true, answer, durationMs: Date.now() - start }
          }
        }
      } catch (e) {
        if (isAbortError(e)) throw e
        // Expected: 场景专用直连端点失败；回退到通用 ask 路径
      }
    }

    const query = userInput
      ? `${scenario.prompt}\n\n${userInput}`
      : scenario.prompt

    const body: ScenarioAskBody = { query, ...getBillingFields() }
    if (scenario.expert) body.expert_hint = scenario.expert
    if (scenario.workflowId) body.workflow_hint = scenario.workflowId

    const resp = await fetch(`${API_BASE}/api/v1/solutions/${solutionId}/ask`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: reqSignal,
    })

    if (resp.ok) {
      const data = (await resp.json()) as ConsultResponse
      if (data.answer || data.text || data.content) {
        return {
          success: true,
          answer: data.answer || data.text || data.content || JSON.stringify(data),
          durationMs: Date.now() - start,
        }
      }
    }

    // 降级：直接调用 Agent /consult
    if (scenario.expert) {
      const agentId = scenario.expert.split('.')[0]
      const directResp = await fetch(`${API_BASE}/api/${agentId}/consult`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ request: query, query, question: query, ...getBillingFields() }),
        signal: reqSignal,
      })
      if (directResp.ok) {
        const data = (await directResp.json()) as ConsultResponse
        return {
          success: true,
          answer: data.answer || data.text || data.content || JSON.stringify(data),
          durationMs: Date.now() - start,
        }
      }
    }

    return { success: false, error: `API ${resp.status}`, durationMs: Date.now() - start }
  } catch (err: unknown) {
    if (isAbortError(err)) {
      return { success: false, durationMs: Date.now() - start }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : '请求失败',
      durationMs: Date.now() - start,
    }
  }
}

/**
 * 从各种 API 响应格式中提取可读答案
 */
function extractAnswer(data: unknown): string | null {
  if (typeof data === 'string') return data
  if (!data || typeof data !== 'object') return null
  const o = data as ConsultResponse & SuccessDataEnvelope
  if (o.answer) return o.answer
  if (o.text) return o.text
  if (o.content) return o.content

  // 四柱系统 / 宏观报告格式：{ success: true, data: { ... } }
  if (o.success && o.data && typeof o.data === 'object') {
    const d = o.data as Record<string, unknown>
    // macro-report 格式
    const report = d.report ?? d.summary ?? d.analysis
    if (typeof report === 'string' && report) return report

    // macro pillar 格式：格式化 JSON 为可读文本
    if (d.signal || d.scores || d.indicators) {
      const parts: string[] = []
      if (typeof d.signal === 'string') parts.push(`## 宏观信号: ${d.signal}`)
      if (d.scores != null) parts.push(`## 评分\n${JSON.stringify(d.scores, null, 2)}`)
      if (typeof d.risk_on_off === 'string') parts.push(`## Risk-On/Off: ${d.risk_on_off}`)
      if (typeof d.recommendation === 'string') parts.push(`## 建议\n${d.recommendation}`)
      if (d.indicators != null) parts.push(`## 指标\n${JSON.stringify(d.indicators, null, 2)}`)
      if (parts.length > 0) return parts.join('\n\n')
    }
    // 通用 data 对象
    return JSON.stringify(d, null, 2)
  }

  return JSON.stringify(data, null, 2)
}

/**
 * 带降级的步骤调用：先走 Solution Runtime /ask，401/404 时直接调 Agent /consult
 */
async function callStepWithFallback(
  solutionId: string,
  step: WorkflowStep,
  query: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<ConsultResponse> {
  // 1. 先尝试 Solution Runtime API
  try {
    const url = `${API_BASE}/api/v1/solutions/${solutionId}/ask`
    const resp = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        query,
        expert_hint: `${step.agent}.${step.expert}`,
        params,
        ...getBillingFields(),
      }),
      signal: signal ?? AbortSignal.timeout(60_000),
    })

    if (resp.ok) {
      const data = (await resp.json()) as ConsultResponse
      if (data.answer || data.text || data.content) return data
    }

    // 401/404/500 → 降级到 Agent 直连
    if (resp.status === 401 || resp.status === 404 || resp.status >= 500) {
      return await callAgentDirect(step, query, signal)
    }
    throw new Error(`API ${resp.status}`)
  } catch (err: unknown) {
    // 网络错误也走降级
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('API ')) throw err
    return await callAgentDirect(step, query, signal)
  }
}

async function callAgentDirect(
  step: WorkflowStep,
  query: string,
  signal?: AbortSignal,
): Promise<ConsultResponse> {
  const candidates = [
    `${API_BASE}/api/${step.agent}/consult`,
    `${API_BASE}/api/${step.agent}/chat`,
  ]

  for (const url of candidates) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ request: query, query, question: query, ...getBillingFields() }),
        signal: signal ?? AbortSignal.timeout(60_000),
      })
      if (resp.ok) return (await resp.json()) as ConsultResponse
    } catch (e) {
      if (isAbortError(e)) throw e
      // Expected: 该 Agent URL 请求失败；试下一候选端点
    }
  }
  throw new Error('所有端点均不可用')
}

function processEvent(
  evt: WorkflowStreamEvent,
  steps: WorkflowStep[],
  stepResults: StepResult[],
  onProgress?: StepProgressCallback,
) {
  // 匹配步骤：优先用 step_id，降级用 agent+expert 或 step 序号
  const findIdx = (): number => {
    if (evt.step_id) {
      const i = steps.findIndex(s => s.id === evt.step_id)
      if (i >= 0) return i
    }
    if (evt.agent && evt.expert) {
      const i = steps.findIndex(s => s.agent === evt.agent && s.expert === evt.expert)
      if (i >= 0) return i
    }
    if (typeof evt.step === 'number') return evt.step - 1
    return -1
  }

  const type = evt.type || ''
  const idx = findIdx()

  if (type === 'step_start') {
    if (idx >= 0) {
      stepResults[idx].status = 'running'
      onProgress?.(steps[idx].id, 'running')
    }
  } else if (type === 'step_complete' || type === 'step_done') {
    if (idx >= 0) {
      const stepId = steps[idx].id
      if (evt.success === false) {
        stepResults[idx].status = 'error'
        stepResults[idx].error = evt.error || '步骤执行失败'
        onProgress?.(stepId, 'error', evt.error)
      } else {
        stepResults[idx].status = 'done'
        stepResults[idx].answer = evt.answer || evt.text
        stepResults[idx].durationMs = evt.elapsed_ms || evt.duration_ms
        stepResults[idx].expert = `${evt.agent}.${evt.expert}`
        onProgress?.(stepId, 'done', evt.answer)
      }
    }
  } else if (type === 'step_error') {
    if (idx >= 0) {
      stepResults[idx].status = 'error'
      stepResults[idx].error = evt.error || evt.message
      onProgress?.(steps[idx].id, 'error', evt.error)
    }
  }
}
