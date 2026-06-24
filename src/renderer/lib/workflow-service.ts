/**
 * 工作流执行服务
 * 调用 Solution Runtime API 执行多 Agent 编排工作流，
 * 支持 SSE 流式获取每个步骤的进度。
 */

import type { WorkflowConfig, ScenarioConfig, WorkflowStep } from './solution-router'
import { authHeaders, API_BASE, isAbortError } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { useToolStore } from '@/stores/tool-store'
import type {
  ConsultResponse,
  ScenarioAskBody,
  SuccessDataEnvelope,
  WorkflowStreamEvent,
} from '@/types/api-responses'

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

export type WorkflowRequestOptions = {
  signal?: AbortSignal
  /** 前端生成的本地 runId。后端灰度支持后，可原样带回 WorkflowOS 事件用于对齐 local trace。 */
  clientRunId?: string
}

/** SSE 单步空闲超时：长时间无数据则判定连接挂起 */
const SSE_IDLE_TIMEOUT_MS = 120_000
/** 工作流 SSE 总超时（5 步深度研究） */
const SSE_OVERALL_TIMEOUT_MS = 900_000

function mergeStepAnswers(stepResults: StepResult[]): string | undefined {
  const merged = stepResults
    .filter(s => s.status === 'done' && s.answer)
    .map(s => s.answer)
    .join('\n\n---\n\n')
  return merged || undefined
}

function finalizeIncompleteSteps(
  stepResults: StepResult[],
  onProgress?: StepProgressCallback,
) {
  for (const sr of stepResults) {
    if (sr.status === 'running') {
      sr.status = 'error'
      sr.error = '步骤超时或网络中断，未完成'
      onProgress?.(sr.stepId, 'error', sr.error)
    } else if (sr.status === 'pending') {
      sr.status = 'error'
      sr.error = '未执行（前置步骤失败或连接中断）'
      onProgress?.(sr.stepId, 'error', sr.error)
    }
  }
}

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

function getTraceFields(clientRunId?: string): Record<string, string> {
  return clientRunId ? { client_run_id: clientRunId } : {}
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
  opts?: WorkflowRequestOptions,
): Promise<WorkflowResult> {
  const startTime = Date.now()
  const stepResults: StepResult[] = workflow.steps.map((s, i) => ({
    stepId: s.id ?? `step_${i}`, status: 'pending' as StepStatus,
  }))

  // 尝试 SSE 流式
  const sseResult = await trySSE(
    solutionId, workflow, query, params, stepResults, onProgress, opts,
  )
  if (sseResult?.success) {
    return { ...sseResult, totalDurationMs: Date.now() - startTime }
  }

  // SSE 部分完成：从首个未完成步骤续跑（避免重复已完成步骤）
  if (sseResult?.steps.some(s => s.status === 'done')) {
    const resumed = await resumeWorkflowSteps(
      solutionId, workflow, query, params, sseResult.steps, startTime, onProgress, opts,
    )
    return resumed
  }

  if (sseResult) {
    return { ...sseResult, totalDurationMs: Date.now() - startTime }
  }

  // Fallback: 常规 POST 逐步执行
  return executeStandard(solutionId, workflow, query, params, stepResults, startTime, onProgress, opts)
}

async function trySSE(
  solutionId: string,
  workflow: WorkflowConfig,
  query: string,
  params: Record<string, string>,
  stepResults: StepResult[],
  onProgress?: StepProgressCallback,
  opts?: WorkflowRequestOptions,
): Promise<Omit<WorkflowResult, 'totalDurationMs'> | null> {
  const overallCtrl = new AbortController()
  const overallTimer = setTimeout(() => overallCtrl.abort(), SSE_OVERALL_TIMEOUT_MS)
  const onAbort = () => overallCtrl.abort()
  opts?.signal?.addEventListener('abort', onAbort, { once: true })

  let idleTimer: ReturnType<typeof setTimeout> | null = null
  const bumpIdle = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => overallCtrl.abort(), SSE_IDLE_TIMEOUT_MS)
  }

  try {
    const url = `${API_BASE}/api/v1/solutions/${solutionId}/workflows/${workflow.id}/stream`
    const resp = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ query, params, ...getTraceFields(opts?.clientRunId), ...getBillingFields() }),
      signal: overallCtrl.signal,
    })

    if (!resp.ok || !resp.body) return null

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let serverMergedAnswer: string | undefined
    bumpIdle()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bumpIdle()
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
          if (evt.type === 'complete') {
            const merged = (evt as WorkflowStreamEvent & { merged_answer?: string }).merged_answer
            if (typeof merged === 'string' && merged.trim()) {
              serverMergedAnswer = merged
            }
          } else if (evt.type === 'error') {
            finalizeIncompleteSteps(stepResults, onProgress)
            return {
              success: false,
              workflowId: workflow.id,
              mode: workflow.mode ?? 'sequential',
              steps: stepResults,
              mergedAnswer: mergeStepAnswers(stepResults),
              error: evt.error || evt.message || '工作流执行失败',
            }
          } else {
            processEvent(evt, workflow.steps, stepResults, onProgress)
          }
        } catch {
          // Expected: SSE 事件块非 JSON 或结构不兼容；跳过该块
        }
      }
    }

    finalizeIncompleteSteps(stepResults, onProgress)

    const mergedAnswer = serverMergedAnswer || mergeStepAnswers(stepResults)

    return {
      success: stepResults.every(s => s.status === 'done'),
      workflowId: workflow.id,
      mode: workflow.mode ?? 'sequential',
      steps: stepResults,
      mergedAnswer,
    }
  } catch (e) {
    if (isAbortError(e)) {
      finalizeIncompleteSteps(stepResults, onProgress)
      return {
        success: false,
        workflowId: workflow.id,
        mode: workflow.mode ?? 'sequential',
        steps: stepResults,
        mergedAnswer: mergeStepAnswers(stepResults),
        error: '连接超时或已取消',
      }
    }
    // Expected: 工作流流式执行失败；返回 null 走标准降级
    return null
  } finally {
    clearTimeout(overallTimer)
    if (idleTimer) clearTimeout(idleTimer)
    opts?.signal?.removeEventListener('abort', onAbort)
  }
}

/** 从首个未完成步骤续跑（SSE 中断后的恢复路径） */
async function resumeWorkflowSteps(
  solutionId: string,
  workflow: WorkflowConfig,
  query: string,
  params: Record<string, string>,
  stepResults: StepResult[],
  startTime: number,
  onProgress?: StepProgressCallback,
  opts?: WorkflowRequestOptions,
): Promise<WorkflowResult> {
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i]!
    const sr = stepResults[i]!
    if (sr.status === 'done') continue

    const stepId = step.id ?? `step_${i}`
    sr.status = 'running'
    onProgress?.(stepId, 'running')
    const stepStart = Date.now()

    try {
      const prevAnswer = stepResults.slice(0, i).reverse().find(s => s.answer)?.answer
      const enrichedQuery = prevAnswer
        ? `${query}\n\n[上一步分析结果]\n${prevAnswer}`
        : query

      const data = await callStepWithFallback(
        solutionId, step, enrichedQuery, params, opts,
      )
      sr.status = 'done'
      sr.answer = data.answer || data.text || data.content || JSON.stringify(data)
      sr.expert = `${step.agent}.${step.expert}`
      sr.durationMs = Date.now() - stepStart
      onProgress?.(stepId, 'done', sr.answer)
    } catch (err: unknown) {
      if (isAbortError(err)) throw err
      sr.status = 'error'
      sr.error = err instanceof Error ? err.message : '请求失败'
      sr.durationMs = Date.now() - stepStart
      onProgress?.(stepId, 'error', sr.error)
    }
  }

  return {
    success: stepResults.every(s => s.status === 'done'),
    workflowId: workflow.id,
    mode: workflow.mode ?? 'sequential',
    steps: stepResults,
    mergedAnswer: mergeStepAnswers(stepResults),
    totalDurationMs: Date.now() - startTime,
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
  opts?: WorkflowRequestOptions,
): Promise<WorkflowResult> {
  try {
    // 按步骤依次执行（sequential 模式）
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i]!
      const sr = stepResults[i]!
      const stepId = step.id ?? `step_${i}`

      sr.status = 'running'
      onProgress?.(stepId, 'running')
      const stepStart = Date.now()

      try {
        const prevAnswer = i > 0 ? stepResults[i - 1]!.answer : undefined
        const enrichedQuery = prevAnswer
          ? `${query}\n\n[上一步分析结果]\n${prevAnswer}`
          : query

        const data = await callStepWithFallback(
          solutionId, step, enrichedQuery, params, opts,
        )
        sr.status = 'done'
        sr.answer =
          data.answer || data.text || data.content || JSON.stringify(data)
        sr.expert = `${step.agent}.${step.expert}`
        sr.durationMs = Date.now() - stepStart
        onProgress?.(stepId, 'done', sr.answer)
      } catch (err: unknown) {
        if (isAbortError(err)) throw err
        sr.status = 'error'
        sr.error = err instanceof Error ? err.message : '请求失败'
        sr.durationMs = Date.now() - stepStart
        onProgress?.(stepId, 'error', sr.error)
      }
    }

    const mergedAnswer = mergeStepAnswers(stepResults)

    return {
      success: stepResults.every(s => s.status === 'done'),
      workflowId: workflow.id,
      mode: workflow.mode ?? 'sequential',
      steps: stepResults,
      mergedAnswer,
      totalDurationMs: Date.now() - startTime,
    }
  } catch (err: unknown) {
    if (isAbortError(err)) throw err
    return {
      success: false,
      workflowId: workflow.id,
      mode: workflow.mode ?? 'sequential',
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
  const reqSignal = withTimeoutAndUser(opts?.signal, 90_000)
  const traceFields = getTraceFields(opts?.clientRunId)
  try {
    // 专用 API 端点直调（绕过通用 /consult，如 WorldMonitor 宏观数据管线）
    if (scenario.apiEndpoint) {
      try {
        const method = scenario.apiMethod || 'GET'
        let url = `${API_BASE}${scenario.apiEndpoint}`
        const reqInit: RequestInit = {
          method,
          headers: authHeaders(),
          signal: reqSignal,
        }
        if (method === 'GET') {
          // GET 场景（四柱系统等）：把股票上下文作为 query 参数传入，
          // 让后端在宏观/热点分析中加入该标的的针对性结论。
          // 优先级：1) 用户在输入框里打的内容  2) 全局选中的股票  3) 无
          const stockCtx =
            userInput?.trim() ||
            (() => {
              const s = useToolStore.getState().selectedStock
              return s ? `${s.name}（${s.ticker}）` : ''
            })()
          if (stockCtx) {
            const sep = url.includes('?') ? '&' : '?'
            url += `${sep}stock_query=${encodeURIComponent(stockCtx)}`
          }
          if (opts?.clientRunId) {
            const sep = url.includes('?') ? '&' : '?'
            url += `${sep}client_run_id=${encodeURIComponent(opts.clientRunId)}`
          }
        } else if (method === 'POST') {
          reqInit.body = JSON.stringify({ query: userInput || scenario.prompt, ...traceFields, ...getBillingFields() })
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

    const body: ScenarioAskBody = { query, ...traceFields, ...getBillingFields() }
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
      const [agentId, ...expertParts] = scenario.expert.split('.')
      const expertId = expertParts.join('.') || undefined
      const directResp = await fetch(`${API_BASE}/api/${agentId}/consult`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          request: query,
          query,
          question: query,
          expert_id: expertId,
          ...traceFields,
          ...getBillingFields(),
        }),
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
  opts?: WorkflowRequestOptions,
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
        ...getTraceFields(opts?.clientRunId),
        ...getBillingFields(),
      }),
      signal: opts?.signal ?? AbortSignal.timeout(120_000),
    })

    if (resp.ok) {
      const data = (await resp.json()) as ConsultResponse
      if (data.answer || data.text || data.content) return data
    }

    // 401/404/500 → 降级到 Agent 直连
    if (resp.status === 401 || resp.status === 404 || resp.status >= 500) {
      return await callAgentDirect(step, query, opts)
    }
    throw new Error(`API ${resp.status}`)
  } catch (err: unknown) {
    // 网络错误也走降级
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('API ')) throw err
    return await callAgentDirect(step, query, opts)
  }
}

async function callAgentDirect(
  step: WorkflowStep,
  query: string,
  opts?: WorkflowRequestOptions,
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
        body: JSON.stringify({ request: query, query, question: query, ...getTraceFields(opts?.clientRunId), ...getBillingFields() }),
        signal: opts?.signal ?? AbortSignal.timeout(120_000),
      })
      if (resp.ok) return (await resp.json()) as ConsultResponse
    } catch (e) {
      if (isAbortError(e)) throw e
      // Expected: 该 Agent URL 请求失败；试下一候选端点
    }
  }
  throw new Error('所有端点均不可用')
}

/** 将 SSE 事件映射到工作流步骤索引（导出供单元测试） */
export function resolveWorkflowStepIndex(
  evt: Pick<WorkflowStreamEvent, 'step_id' | 'step' | 'agent' | 'expert'>,
  steps: Pick<WorkflowStep, 'id' | 'agent' | 'expert'>[],
): number {
  if (evt.step_id) {
    const byId = steps.findIndex(s => s.id === evt.step_id)
    if (byId >= 0) return byId
  }
  if (typeof evt.step === 'number' && evt.step >= 1 && evt.step <= steps.length) {
    return evt.step - 1
  }
  // 同 agent+expert 多步工作流（如 deep_research 1/2/3/5 均为 invest）时禁止 findIndex 首匹配
  if (evt.agent && evt.expert) {
    const matches = steps
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.agent === evt.agent && s.expert === evt.expert)
    if (matches.length === 1) return matches[0]!.i
  }
  return -1
}

function processEvent(
  evt: WorkflowStreamEvent,
  steps: WorkflowStep[],
  stepResults: StepResult[],
  onProgress?: StepProgressCallback,
) {
  const findIdx = (): number => resolveWorkflowStepIndex(evt, steps)

  const type = evt.type || ''
  const idx = findIdx()

  if (type === 'step_start') {
    if (idx >= 0) {
      const sr = stepResults[idx]!
      const step = steps[idx]!
      sr.status = 'running'
      onProgress?.(step.id ?? `step_${idx}`, 'running')
    }
  } else if (type === 'step_complete' || type === 'step_done') {
    if (idx >= 0) {
      const sr = stepResults[idx]!
      const step = steps[idx]!
      const stepId = step.id ?? `step_${idx}`
      if (evt.success === false) {
        sr.status = 'error'
        sr.error = evt.error || '步骤执行失败'
        onProgress?.(stepId, 'error', evt.error)
      } else {
        sr.status = 'done'
        sr.answer = evt.answer || evt.text
        sr.durationMs = evt.elapsed_ms || evt.duration_ms
        sr.expert = `${evt.agent}.${evt.expert}`
        onProgress?.(stepId, 'done', evt.answer)
      }
    }
  } else if (type === 'step_token') {
    if (idx >= 0) {
      const sr = stepResults[idx]!
      const step = steps[idx]!
      const token = (evt as WorkflowStreamEvent & { content?: string }).content ?? ''
      if (token) {
        sr.answer = (sr.answer ?? '') + token
        onProgress?.(step.id ?? `step_${idx}`, 'running', sr.answer)
      }
    }
  } else if (type === 'step_error') {
    if (idx >= 0) {
      const sr = stepResults[idx]!
      const step = steps[idx]!
      sr.status = 'error'
      sr.error = evt.error || evt.message
      onProgress?.(step.id ?? `step_${idx}`, 'error', evt.error)
    }
  }
}
