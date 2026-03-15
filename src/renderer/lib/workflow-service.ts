/**
 * 工作流执行服务
 * 调用 Solution Runtime API 执行多 Agent 编排工作流，
 * 支持 SSE 流式获取每个步骤的进度。
 */

import type { WorkflowConfig, ScenarioConfig, WorkflowStep } from './solution-router'

const API_BASE = 'https://mbe.hi-maker.com'

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
): Promise<Omit<WorkflowResult, 'totalDurationMs'> | null> {
  try {
    const url = `${API_BASE}/api/v1/solutions/${solutionId}/workflows/${workflow.id}/stream`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, params }),
    })

    if (!resp.ok || !resp.body) return null

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') break

        try {
          const evt = JSON.parse(data)
          processEvent(evt, workflow.steps, stepResults, onProgress)
        } catch {
          // 忽略解析失败的事件
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
  } catch {
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

        const url = `${API_BASE}/api/v1/solutions/${solutionId}/ask`
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: enrichedQuery,
            expert_hint: `${step.agent}.${step.expert}`,
            params,
          }),
          signal: AbortSignal.timeout(60000),
        })

        if (!resp.ok) {
          throw new Error(`API ${resp.status}`)
        }

        const data = await resp.json()
        sr.status = 'done'
        sr.answer = data.answer || data.text || data.content || JSON.stringify(data)
        sr.expert = `${step.agent}.${step.expert}`
        sr.durationMs = Date.now() - stepStart
        onProgress?.(step.id, 'done', sr.answer)
      } catch (err: any) {
        sr.status = 'error'
        sr.error = err.message || '请求失败'
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
  } catch (err: any) {
    return {
      success: false,
      workflowId: workflow.id,
      mode: workflow.mode,
      steps: stepResults,
      totalDurationMs: Date.now() - startTime,
      error: err.message,
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
): Promise<{ success: boolean; answer?: string; error?: string; durationMs: number }> {
  const start = Date.now()
  try {
    const query = userInput
      ? `${scenario.prompt}\n\n${userInput}`
      : scenario.prompt

    const body: Record<string, any> = { query }
    if (scenario.expert) body.expert_hint = scenario.expert
    if (scenario.workflowId) body.workflow_hint = scenario.workflowId

    const resp = await fetch(`${API_BASE}/api/v1/solutions/${solutionId}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    })

    if (!resp.ok) {
      return { success: false, error: `API ${resp.status}`, durationMs: Date.now() - start }
    }

    const data = await resp.json()
    return {
      success: true,
      answer: data.answer || data.text || data.content || JSON.stringify(data),
      durationMs: Date.now() - start,
    }
  } catch (err: any) {
    return { success: false, error: err.message, durationMs: Date.now() - start }
  }
}

function processEvent(
  evt: any,
  steps: WorkflowStep[],
  stepResults: StepResult[],
  onProgress?: StepProgressCallback,
) {
  if (evt.type === 'step_start' && evt.step_id) {
    const idx = steps.findIndex(s => s.id === evt.step_id)
    if (idx >= 0) {
      stepResults[idx].status = 'running'
      onProgress?.(evt.step_id, 'running')
    }
  } else if (evt.type === 'step_done' && evt.step_id) {
    const idx = steps.findIndex(s => s.id === evt.step_id)
    if (idx >= 0) {
      stepResults[idx].status = 'done'
      stepResults[idx].answer = evt.answer || evt.text
      stepResults[idx].durationMs = evt.duration_ms
      onProgress?.(evt.step_id, 'done', evt.answer)
    }
  } else if (evt.type === 'step_error' && evt.step_id) {
    const idx = steps.findIndex(s => s.id === evt.step_id)
    if (idx >= 0) {
      stepResults[idx].status = 'error'
      stepResults[idx].error = evt.error
      onProgress?.(evt.step_id, 'error', evt.error)
    }
  }
}
