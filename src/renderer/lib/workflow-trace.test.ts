import { describe, expect, it, vi } from 'vitest'
import {
  createWorkflowTraceEvent,
  filterWorkflowTraceEventsByRunId,
  mergeWorkflowTraceEvents,
  normalizeWorkflowOsTraceEvent,
  subscribeWorkflowTrace,
} from './workflow-trace'

describe('workflow trace protocol', () => {
  it('creates local trace events with label/detail metadata', () => {
    const event = createWorkflowTraceEvent({
      runId: 'local-run-1',
      sequence: 1,
      type: 'step.started',
      label: '开始执行：资料读取',
      detail: '读取用户输入',
      workflowId: 'wf-1',
      stepId: 'step-1',
      agentId: 'finance',
      timestamp: '2026-06-24T00:00:00.000Z',
    })

    expect(event).toMatchObject({
      id: 'local-run-1-local-1',
      runId: 'local-run-1',
      source: 'local',
      type: 'step.started',
      timestamp: '2026-06-24T00:00:00.000Z',
      workflowId: 'wf-1',
      stepId: 'step-1',
      agentId: 'finance',
      metadata: {
        label: '开始执行：资料读取',
        detail: '读取用户输入',
      },
    })
  })

  it('normalizes WorkflowOS raw events into frontend trace events', () => {
    const event = normalizeWorkflowOsTraceEvent({
      id: 'backend-event-1',
      run_id: 'backend-run-1',
      event_type: 'step.completed',
      created_at: '2026-06-24T00:00:01.000Z',
      workflow_id: 'wf-1',
      step_id: 'step-1',
      agent_id: 'legal',
      duration_ms: 1250,
      title: '合同审查完成',
      detail: '发现 2 个风险点',
      metadata: {
        score: 0.92,
        ignoredObject: { nested: true },
      },
    })

    expect(event).toMatchObject({
      id: 'backend-event-1',
      runId: 'backend-run-1',
      source: 'workflowos',
      type: 'step.completed',
      timestamp: '2026-06-24T00:00:01.000Z',
      workflowId: 'wf-1',
      stepId: 'step-1',
      agentId: 'legal',
      durationMs: 1250,
      metadata: {
        label: '合同审查完成',
        detail: '发现 2 个风险点',
        score: 0.92,
      },
    })
    expect(event?.metadata).not.toHaveProperty('ignoredObject')
  })

  it('rejects unknown WorkflowOS event types', () => {
    expect(normalizeWorkflowOsTraceEvent({
      run_id: 'backend-run-1',
      event_type: 'unknown.event',
    })).toBeNull()
  })

  it('uses fallback runId when backend event omits run id', () => {
    const event = normalizeWorkflowOsTraceEvent({
      event_type: 'run.completed',
      timestamp: '2026-06-24T00:00:02.000Z',
    }, 'fallback-run')

    expect(event).toMatchObject({
      runId: 'fallback-run',
      source: 'workflowos',
      type: 'run.completed',
    })
  })

  it('merges traces by id and sorts by timestamp', () => {
    const local = createWorkflowTraceEvent({
      runId: 'run-1',
      sequence: 1,
      type: 'run.started',
      label: '启动',
      timestamp: '2026-06-24T00:00:02.000Z',
    })
    const backend = normalizeWorkflowOsTraceEvent({
      id: 'backend-1',
      run_id: 'run-1',
      event_type: 'step.started',
      timestamp: '2026-06-24T00:00:01.000Z',
      label: '后端步骤开始',
    })

    const merged = mergeWorkflowTraceEvents([local], backend ? [backend] : [])
    expect(merged.map(event => event.id)).toEqual(['backend-1', 'run-1-local-1'])
  })

  it('allows stable event ids so final step results can replace progress events', () => {
    const progress = createWorkflowTraceEvent({
      id: 'run-1-local-step.completed-wf-1-step-1',
      runId: 'run-1',
      sequence: 1,
      type: 'step.completed',
      label: '完成步骤：资料读取',
      workflowId: 'wf-1',
      stepId: 'step-1',
      timestamp: '2026-06-24T00:00:01.000Z',
    })
    const final = createWorkflowTraceEvent({
      id: 'run-1-local-step.completed-wf-1-step-1',
      runId: 'run-1',
      sequence: 2,
      type: 'step.completed',
      label: '步骤完成：资料读取',
      workflowId: 'wf-1',
      stepId: 'step-1',
      durationMs: 1500,
      timestamp: '2026-06-24T00:00:02.000Z',
    })

    const merged = mergeWorkflowTraceEvents([progress], [final])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.durationMs).toBe(1500)
    expect(merged[0]?.metadata?.label).toBe('步骤完成：资料读取')
  })

  it('filters events by current run id before UI display', () => {
    const current = createWorkflowTraceEvent({
      runId: 'current-run',
      sequence: 1,
      type: 'run.started',
      label: '当前运行',
    })
    const stale = createWorkflowTraceEvent({
      runId: 'stale-run',
      sequence: 1,
      type: 'run.started',
      label: '旧运行',
    })

    expect(filterWorkflowTraceEventsByRunId([current, stale], 'current-run')).toEqual([current])
  })

  it('uses id as a stable tie breaker for equal or invalid timestamps', () => {
    const invalid = createWorkflowTraceEvent({
      id: 'b-invalid',
      runId: 'run-1',
      sequence: 1,
      type: 'run.started',
      label: '无效时间',
      timestamp: 'not-a-date',
    })
    const sameTimeA = createWorkflowTraceEvent({
      id: 'a-same-time',
      runId: 'run-1',
      sequence: 2,
      type: 'step.started',
      label: '同时间 A',
      timestamp: '2026-06-24T00:00:01.000Z',
    })
    const sameTimeB = createWorkflowTraceEvent({
      id: 'c-same-time',
      runId: 'run-1',
      sequence: 3,
      type: 'step.completed',
      label: '同时间 B',
      timestamp: '2026-06-24T00:00:01.000Z',
    })

    const merged = mergeWorkflowTraceEvents([sameTimeB, invalid, sameTimeA])
    expect(merged.map(event => event.id)).toEqual(['b-invalid', 'a-same-time', 'c-same-time'])
  })

  it('exposes a no-op subscription adapter for future WorkflowOS events', () => {
    const onEvent = vi.fn()
    const unsubscribe = subscribeWorkflowTrace('run-1', onEvent)

    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
    expect(onEvent).not.toHaveBeenCalled()
  })
})
