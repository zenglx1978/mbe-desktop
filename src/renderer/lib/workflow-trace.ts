export type WorkflowTraceEventType =
  | 'run.started'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'run.completed'
  | 'run.failed'

export type WorkflowTraceSource = 'local' | 'workflowos'

export type WorkflowTraceMetadata = Record<string, string | number | boolean | null | undefined>

export interface WorkflowTraceEvent {
  id: string
  runId: string
  source: WorkflowTraceSource
  type: WorkflowTraceEventType
  timestamp: string
  workflowId?: string
  scenarioId?: string
  stepId?: string
  agentId?: string
  durationMs?: number
  metadata?: WorkflowTraceMetadata
}

export interface CreateWorkflowTraceEventInput {
  id?: string
  type: WorkflowTraceEventType
  runId: string
  sequence: number
  label: string
  detail?: string
  workflowId?: string
  scenarioId?: string
  stepId?: string
  agentId?: string
  durationMs?: number
  metadata?: WorkflowTraceMetadata
  source?: WorkflowTraceSource
  timestamp?: string
}

export interface WorkflowOsRawTraceEvent {
  id?: string
  run_id?: string
  runId?: string
  type?: string
  event_type?: string
  timestamp?: string
  created_at?: string
  workflow_id?: string
  workflowId?: string
  scenario_id?: string
  scenarioId?: string
  step_id?: string
  stepId?: string
  agent_id?: string
  agentId?: string
  duration_ms?: number
  durationMs?: number
  label?: string
  title?: string
  message?: string
  detail?: string
  metadata?: Record<string, unknown>
}

export type WorkflowTraceUnsubscribe = () => void

export interface SubscribeWorkflowTraceOptions {
  /**
   * 后续接入 WorkflowOS 时可用于取消 SSE/WebSocket/轮询。
   * 当前占位实现不会发起网络请求。
   */
  signal?: AbortSignal
}

const WORKFLOW_TRACE_EVENT_TYPES: WorkflowTraceEventType[] = [
  'run.started',
  'step.started',
  'step.completed',
  'step.failed',
  'run.completed',
  'run.failed',
]

function isWorkflowTraceEventType(value: string | undefined): value is WorkflowTraceEventType {
  return Boolean(value && WORKFLOW_TRACE_EVENT_TYPES.includes(value as WorkflowTraceEventType))
}

function pickString(...values: Array<string | undefined>): string | undefined {
  return values.find(value => typeof value === 'string' && value.trim().length > 0)
}

function pickNumber(...values: Array<number | undefined>): number | undefined {
  return values.find(value => typeof value === 'number' && Number.isFinite(value))
}

function normalizeMetadata(raw: Record<string, unknown> | undefined): WorkflowTraceMetadata {
  const metadata: WorkflowTraceMetadata = {}
  if (!raw) return metadata
  for (const [key, value] of Object.entries(raw)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null ||
      value === undefined
    ) {
      metadata[key] = value
    }
  }
  return metadata
}

export function createLocalRunId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createWorkflowTraceEvent(input: CreateWorkflowTraceEventInput): WorkflowTraceEvent {
  const {
    id,
    type,
    runId,
    sequence,
    label,
    detail,
    workflowId,
    scenarioId,
    stepId,
    agentId,
    durationMs,
    metadata,
    source = 'local',
    timestamp = new Date().toISOString(),
  } = input

  return {
    id: id ?? `${runId}-${source}-${sequence}`,
    runId,
    source,
    type,
    timestamp,
    workflowId,
    scenarioId,
    stepId,
    agentId,
    durationMs,
    metadata: {
      ...metadata,
      label,
      detail,
    },
  }
}

export function getTraceSourceLabel(source: WorkflowTraceSource): string {
  return source === 'workflowos' ? 'WorkflowOS' : 'local'
}

export function normalizeWorkflowOsTraceEvent(
  raw: WorkflowOsRawTraceEvent,
  fallbackRunId?: string,
): WorkflowTraceEvent | null {
  const type = pickString(raw.type, raw.event_type)
  if (!isWorkflowTraceEventType(type)) return null

  const runId = pickString(raw.runId, raw.run_id, fallbackRunId)
  if (!runId) return null

  const timestamp = pickString(raw.timestamp, raw.created_at) ?? new Date().toISOString()
  const label = pickString(raw.label, raw.title, raw.message, type) ?? type
  const detail = pickString(raw.detail, raw.message)
  const workflowId = pickString(raw.workflowId, raw.workflow_id)
  const scenarioId = pickString(raw.scenarioId, raw.scenario_id)
  const stepId = pickString(raw.stepId, raw.step_id)
  const agentId = pickString(raw.agentId, raw.agent_id)
  const durationMs = pickNumber(raw.durationMs, raw.duration_ms)
  const id = pickString(raw.id) ?? `${runId}-workflowos-${type}-${timestamp}-${stepId ?? 'run'}`

  return {
    id,
    runId,
    source: 'workflowos',
    type,
    timestamp,
    workflowId,
    scenarioId,
    stepId,
    agentId,
    durationMs,
    metadata: {
      ...normalizeMetadata(raw.metadata),
      label,
      detail,
    },
  }
}

export function mergeWorkflowTraceEvents(
  localEvents: WorkflowTraceEvent[],
  workflowOsEvents: WorkflowTraceEvent[] = [],
): WorkflowTraceEvent[] {
  const byId = new Map<string, WorkflowTraceEvent>()
  for (const event of [...localEvents, ...workflowOsEvents]) {
    byId.set(event.id, event)
  }
  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime()
    const bTime = new Date(b.timestamp).getTime()
    const safeATime = Number.isFinite(aTime) ? aTime : 0
    const safeBTime = Number.isFinite(bTime) ? bTime : 0
    return safeATime - safeBTime || a.id.localeCompare(b.id)
  })
}

export function filterWorkflowTraceEventsByRunId(
  events: WorkflowTraceEvent[],
  runId: string,
): WorkflowTraceEvent[] {
  return events.filter(event => event.runId === runId)
}

export function subscribeWorkflowTrace(
  _runId: string,
  _onEvent: (event: WorkflowTraceEvent) => void,
  _options: SubscribeWorkflowTraceOptions = {},
): WorkflowTraceUnsubscribe {
  // 占位 adapter：后续在这里接 SSE/WebSocket/轮询，不让 UI 层感知传输方式。
  return () => {}
}
