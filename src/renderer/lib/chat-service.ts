/**
 * Chat Service — 统一的 AI 专家对话服务
 *
 * 优先使用 WebSocket 流式对话，降级为 HTTP SSE。
 * 所有消息自动持久化到本地 SQLite。
 * 离线时返回提示，引导使用本地计算。
 *
 * 智能路由：根据用户消息内容自动匹配最合适的专家，
 * 无需用户手动切换。路由结果体现在回复标注中。
 */

import { useChatStore, type OrchestrationState, type OrchestrationExpert } from '@/stores/chat-store'
import { useConversationStore } from '@/stores/conversation-store'
import { useConnectivityStore } from '@/stores/connectivity-store'
import { useAppStore, type BillingContext } from '@/stores/app-store'
import { useLocalFeedbackStore } from '@/stores/local-feedback-store'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'
import { routeMessage } from '@/lib/intent-router'
import type { AgentEndpoint, SolutionConfig } from '@/lib/solution-router'
import {
  executeActions,
  getAutoExecutableActions,
  isElectronAvailable,
  type LocalAction,
} from '@/lib/local-action-executor'

import { getDeviceId, authHeaders } from '@/lib/api-client'
import type { ConsultResponse, WindowWithElectron } from '@/types/api-responses'

/** WebSocket 连接池 */
const wsPool = new Map<string, WebSocket>()

/** 是否为 fetch / 流式取消（不向用户展示错误） */
export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true
  if (err instanceof Error && err.name === 'AbortError') return true
  return false
}

export type SendMessageOptions = {
  /** 取消本次请求（新消息发送或组件卸载时 abort） */
  signal?: AbortSignal
}

/**
 * 发送消息 — 自动路由到最合适的专家
 *
 * 不再需要外部传入 agent，由 intent-router 根据消息内容自动选择。
 * 如果路由切换了专家，侧边栏会同步高亮，回复头部标注来源。
 */
export async function sendMessage(
  text: string,
  solution: SolutionConfig,
  fallbackAgent?: AgentEndpoint,
  options?: SendMessageOptions,
) {
  const signal = options?.signal
  if (signal?.aborted) return

  const chatStore = useChatStore.getState()
  const convStore = useConversationStore.getState()
  const connectivity = useConnectivityStore.getState()
  const appStore = useAppStore.getState()
  const _sendStartMs = Date.now()

  // Phase 6: 从对话中自动学习用户事实
  autoLearnFromMessage(text, solution.id, convStore.currentConversationId ?? undefined)

  // Phase 6: 获取 memory context 注入到 Agent 请求
  const memoryContext = await getMemoryPromptText(solution.id)

  // 智能路由：分析消息内容，匹配最合适的专家
  const currentIdx = appStore.currentAgentIndex
  const route = routeMessage(text, solution, currentIdx)
  const agent = route.agent ?? fallbackAgent ?? solution.agents[currentIdx]

  // 自动切换侧边栏高亮 + 反馈追踪
  if (route.autoRouted && route.agentIndex !== currentIdx) {
    appStore.switchAgent(route.agentIndex)
    useLocalFeedbackStore.getState().recordSwitch(
      solution.id,
      solution.agents[currentIdx]?.role ?? 'unknown',
      agent.role,
      text,
    )
  }

  // 追踪 Agent 使用
  useAdaptiveUIStore.getState().trackAgentSwitch(solution.id, route.agentIndex, agent.role)

  // 添加用户消息
  const userMsgId = chatStore.addMessage({ role: 'user', content: text })

  // 确保有一个对话 ID
  let convId = convStore.currentConversationId
  if (!convId) {
    convId = await convStore.createConversation(solution.id, agent.role)
  }

  // 持久化用户消息
  convStore.persistMessage({
    id: userMsgId,
    conversationId: convId,
    role: 'user',
    content: text,
  })

  // 离线检查 — Phase 7: 离线时走本地推理而非直接拒绝
  if (connectivity.mode === 'offline') {
    const offlineResult = await tryLocalInference(text, solution.id)
    const badge = offlineSourceBadge(offlineResult.source)
    const content = `${badge}\n\n${offlineResult.text}${offlineResult.suggestOnline ? '\n\n---\n💡 _连接网络后可获得更完整的 AI 专家分析_' : ''}`

    const offlineId = chatStore.addMessage({
      role: 'assistant',
      content,
      agentRole: agent.role,
    })
    convStore.persistMessage({
      id: offlineId,
      conversationId: convId,
      role: 'assistant',
      content,
      agentRole: agent.role,
    })
    return
  }

  chatStore.setLoading(true)

  // 如果是自动路由切换，在回复头部加提示
  const routeHint = route.autoRouted && route.agentIndex !== currentIdx
    ? `> 已为你转接 **${agent.role}**\n\n`
    : ''

  const assistantId = chatStore.addMessage({
    role: 'assistant',
    content: routeHint,
    agentRole: agent.role,
    streaming: true,
  })

  // 成本归因：注入方案角色和子账号
  const billing = appStore.getBillingContext()

  let aborted = false
  try {
    await streamViaWebSocket(text, agent, assistantId, convId, memoryContext, billing, signal)
  } catch (e) {
    if (isAbortError(e)) {
      aborted = true
    } else {
      try {
        await streamViaHTTP(text, agent, assistantId, convId, memoryContext, billing, signal)
      } catch (err) {
        if (isAbortError(err)) {
          aborted = true
        } else {
          const errorMsg = err instanceof Error ? err.message : '请求失败'
          chatStore.updateMessage(assistantId, {
            content: `⚠️ 连接${agent.role}失败：${errorMsg}\n\n请检查网络连接，或使用本地计算功能。`,
            streaming: false,
          })
        }
      }
    }
  } finally {
    chatStore.setLoading(false)
    const responseTimeMs = Date.now() - _sendStartMs

    if (aborted) {
      chatStore.updateMessage(assistantId, { streaming: false })
      const partial = useChatStore.getState().messages.find(m => m.id === assistantId)
      if (partial) {
        convStore.persistMessage({
          id: assistantId,
          conversationId: convId,
          role: 'assistant',
          content: partial.content,
          agentRole: partial.agentRole,
          sources: partial.sources ? JSON.stringify(partial.sources) : undefined,
        })
      }
      return
    }

    // 流式完成后持久化助手消息
    const finalMsg = useChatStore.getState().messages.find(m => m.id === assistantId)
    if (finalMsg) {
      convStore.persistMessage({
        id: assistantId,
        conversationId: convId,
        role: 'assistant',
        content: finalMsg.content,
        agentRole: finalMsg.agentRole,
        sources: finalMsg.sources ? JSON.stringify(finalMsg.sources) : undefined,
      })

      // Bitter Lesson: 隐式反馈信号采集
      const feedback = useLocalFeedbackStore.getState()
      if (responseTimeMs > 15_000) {
        feedback.recordTimeout(solution.id, agent.role, responseTimeMs)
      } else if (finalMsg.content && finalMsg.content.length > 50) {
        feedback.recordPositive(solution.id, agent.role, text)
      }
    }
  }
}

// ── WebSocket 流式 ──

async function streamViaWebSocket(
  text: string,
  agent: AgentEndpoint,
  messageId: string,
  _convId: string,
  memoryContext?: string,
  billing?: BillingContext | null,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const chatStore = useChatStore.getState()
    const wsKey = `${agent.id}_${agent.role}`

    let ws = wsPool.get(wsKey)
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      const deviceId = getDeviceId()
      const authToken = authHeaders()['Authorization']?.replace('Bearer ', '') ?? null
      const wsUrlWithAuth = authToken
        ? `${agent.wsUrl}?device_id=${deviceId}&token=${encodeURIComponent(authToken)}`
        : `${agent.wsUrl}?device_id=${deviceId}`
      const urls = [wsUrlWithAuth]
      let connected = false
      for (const url of urls) {
        try {
          ws = new WebSocket(url)
          wsPool.set(wsKey, ws)
          connected = true
          break
        } catch {
          // Expected: 该 WS URL 建连失败；试下一候选
        }
      }
      if (!connected || !ws) {
        reject(new Error('WebSocket 不可用'))
        return
      }
    }

    const socket = ws!

    const timeout = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort)
      reject(new Error('WebSocket 超时'))
    }, 30000)

    const onAbort = () => {
      clearTimeout(timeout)
      if (signal) signal.removeEventListener('abort', onAbort)
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
      try {
        socket.close()
      } catch {
        // Expected: 连接已关闭
      }
      wsPool.delete(wsKey)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal) {
      signal.addEventListener('abort', onAbort)
    }

    const payload = JSON.stringify({
      query: text,
      ...(memoryContext ? { memory_context: memoryContext } : {}),
      ...(billing?.solutionId ? { solution_id: billing.solutionId } : {}),
      ...(billing?.solutionRole ? { solution_role: billing.solutionRole } : {}),
      ...(billing?.subAccountId ? { sub_account_id: billing.subAccountId } : {}),
    })

    socket.onopen = () => {
      socket.send(payload)
    }

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload)
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'orchestration_start') {
          const experts: OrchestrationExpert[] = (data.experts ?? []).map(
            (e: { id: string; label: string }) => ({
              id: e.id,
              label: e.label,
              status: 'idle' as const,
            }),
          )
          const orch: OrchestrationState = {
            active: true,
            mode: data.mode ?? 'parallel',
            experts,
          }
          chatStore.updateMessage(messageId, { orchestration: orch })
        } else if (data.type === 'expert_start') {
          const msg = useChatStore.getState().messages.find(m => m.id === messageId)
          if (msg?.orchestration) {
            const experts = msg.orchestration.experts.map(e =>
              e.id === data.expert_id ? { ...e, status: 'working' as const } : e,
            )
            chatStore.updateMessage(messageId, {
              orchestration: { ...msg.orchestration, experts },
            })
          }
        } else if (data.type === 'expert_done') {
          const msg = useChatStore.getState().messages.find(m => m.id === messageId)
          if (msg?.orchestration) {
            const experts = msg.orchestration.experts.map(e =>
              e.id === data.expert_id
                ? { ...e, status: 'done' as const, elapsed_ms: data.elapsed_ms }
                : e,
            )
            chatStore.updateMessage(messageId, {
              orchestration: { ...msg.orchestration, experts },
            })
          }
        } else if (data.type === 'expert_error') {
          const msg = useChatStore.getState().messages.find(m => m.id === messageId)
          if (msg?.orchestration) {
            const experts = msg.orchestration.experts.map(e =>
              e.id === data.expert_id
                ? { ...e, status: 'error' as const, error: data.error, elapsed_ms: data.elapsed_ms }
                : e,
            )
            chatStore.updateMessage(messageId, {
              orchestration: { ...msg.orchestration, experts },
            })
          }
        } else if (data.type === 'orchestration_done') {
          const msg = useChatStore.getState().messages.find(m => m.id === messageId)
          if (msg?.orchestration) {
            chatStore.updateMessage(messageId, {
              orchestration: {
                ...msg.orchestration,
                active: false,
                total_elapsed_ms: data.total_elapsed_ms,
              },
            })
          }
        } else if (data.type === 'chat_chunk' && data.chunk) {
          chatStore.appendToMessage(messageId, data.chunk)
        } else if (data.type === 'chunk' && data.content) {
          chatStore.appendToMessage(messageId, data.content)
        } else if (data.type === 'sources') {
          chatStore.updateMessage(messageId, { sources: data.sources })
        } else if (data.type === 'confidence') {
          chatStore.updateMessage(messageId, { confidence: data.confidence ?? data.value })
        } else if (data.type === 'chat_complete' || data.type === 'done') {
          const updates: Record<string, unknown> = { streaming: false }
          if (data.sources) updates.sources = data.sources
          if (data.source_citation) updates.sources = data.source_citation
          if (data.confidence != null) updates.confidence = data.confidence
          if (data.workflow_suggestion) updates.workflowSuggestion = data.workflow_suggestion
          if (data.workflow_instance) updates.workflowInstance = data.workflow_instance
          if (data.local_actions?.length) updates.localActions = data.local_actions
          chatStore.updateMessage(messageId, updates)

          // 自动执行安全等级 ≤ L1 的操作
          if (data.local_actions?.length && isElectronAvailable()) {
            autoExecuteLocalActions(data.local_actions as LocalAction[], messageId)
          }

          clearTimeout(timeout)
          if (signal) signal.removeEventListener('abort', onAbort)
          resolve()
        } else if (data.type === 'error') {
          clearTimeout(timeout)
          if (signal) signal.removeEventListener('abort', onAbort)
          reject(new Error(data.message || 'WS 错误'))
        } else if (data.type === 'auth_required') {
          clearTimeout(timeout)
          if (signal) signal.removeEventListener('abort', onAbort)
          reject(new Error('需要登录后才能使用'))
        }
      } catch {
        // Expected: WS 帧非 JSON；原样追加文本
        chatStore.appendToMessage(messageId, event.data)
      }
    }

    socket.onerror = () => {
      clearTimeout(timeout)
      if (signal) signal.removeEventListener('abort', onAbort)
      wsPool.delete(wsKey)
      reject(new Error('WebSocket 连接失败'))
    }

    socket.onclose = () => {
      wsPool.delete(wsKey)
      const msg = useChatStore.getState().messages.find(m => m.id === messageId)
      if (msg?.streaming) {
        chatStore.updateMessage(messageId, { streaming: false })
        clearTimeout(timeout)
        if (signal) signal.removeEventListener('abort', onAbort)
        resolve()
      }
    }
  })
}

// ── HTTP SSE 降级 ──

async function streamViaHTTP(
  text: string,
  agent: AgentEndpoint,
  messageId: string,
  _convId: string,
  memoryContext?: string,
  billing?: BillingContext | null,
  signal?: AbortSignal,
): Promise<void> {
  const chatStore = useChatStore.getState()

  const candidates = [
    `${agent.baseUrl}/consult`,
    `${agent.baseUrl}/secretary/chat`,
    `${agent.baseUrl}/chat`,
  ]
  const body = JSON.stringify({
    query: text, request: text, question: text, message: text, stream: true,
    ...(memoryContext ? { memory_context: memoryContext } : {}),
    ...(billing?.solutionId ? { solution_id: billing.solutionId } : {}),
    ...(billing?.solutionRole ? { solution_role: billing.solutionRole } : {}),
    ...(billing?.subAccountId ? { sub_account_id: billing.subAccountId } : {}),
  })
  const headers = authHeaders()

  let response: Response | null = null
  for (const url of candidates) {
    try {
      const r = await fetch(url, { method: 'POST', headers, body, signal })
      if (r.ok || r.status === 401) {
        response = r
        break
      }
    } catch (e) {
      if (isAbortError(e)) throw e
      // Expected: 该 HTTP 端点不可用；试下一候选路径
    }
  }

  if (!response) {
    throw new Error('所有 HTTP 端点均不可用')
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''
  const isSSE = contentType.includes('text/event-stream')
  const isJSON = contentType.includes('application/json')

  // 非流式 JSON 响应（/consult 端点的标准返回格式）
  if (isJSON || !isSSE) {
    try {
      const data = (await response.json()) as ConsultResponse
      const answer = data.answer || data.text || data.content || data.message || ''
      if (answer) {
        chatStore.appendToMessage(messageId, answer)
      } else {
        chatStore.appendToMessage(messageId, JSON.stringify(data, null, 2))
      }
      if (data.sources || data.source_citation) {
        chatStore.updateMessage(messageId, { sources: data.sources ?? data.source_citation })
      }
      if (data.confidence != null) {
        chatStore.updateMessage(messageId, { confidence: data.confidence })
      }
      if (data.local_actions?.length) {
        chatStore.updateMessage(messageId, { localActions: data.local_actions })
        if (isElectronAvailable()) {
          autoExecuteLocalActions(data.local_actions as LocalAction[], messageId)
        }
      }
    } catch {
      // Expected: 响应体非 JSON；降级为纯文本追加
      const text = await response.text()
      if (text) chatStore.appendToMessage(messageId, text)
    }
    chatStore.updateMessage(messageId, { streaming: false })
    return
  }

  // SSE 流式响应
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          if (parsed.content) {
            chatStore.appendToMessage(messageId, parsed.content)
          }
          if (parsed.sources || parsed.source_citation) {
            chatStore.updateMessage(messageId, { sources: parsed.sources ?? parsed.source_citation })
          }
          if (parsed.confidence != null) {
            chatStore.updateMessage(messageId, { confidence: parsed.confidence })
          }
        } catch {
          // Expected: SSE data 行非 JSON；按纯文本块追加
          if (data) chatStore.appendToMessage(messageId, data)
        }
      }
    }
  }

  chatStore.updateMessage(messageId, { streaming: false })
}

// ── 离线提示 ──

// ── LocalAction 自动执行 ──

async function autoExecuteLocalActions(actions: LocalAction[], messageId: string) {
  const chatStore = useChatStore.getState()
  const autoActions = getAutoExecutableActions(actions)
  if (autoActions.length === 0) return

  const results = await executeActions(autoActions, (result) => {
    chatStore.updateMessage(messageId, {
      localActionStatus: {
        ...useChatStore.getState().messages.find(m => m.id === messageId)?.localActionStatus,
        [result.index]: result.status === 'completed' ? 'auto_done'
          : result.status === 'failed' ? 'failed' : 'pending',
      },
    })
  })

  // 如果所有自动操作都成功，在消息末尾追加确认
  const allOk = results.every(r => r.status === 'completed')
  if (allOk && results.length > 0) {
    const summary = results.map(r => `✓ ${r.action.label}`).join('\n')
    chatStore.appendToMessage(messageId, `\n\n---\n${summary}`)
  }
}

// ── Phase 7: 本地轻量推理 — 离线智能回答 ──

interface LocalInferenceResult {
  text: string
  source: 'calc' | 'knowledge' | 'pattern' | 'fallback'
  confidence: number
  suggestOnline: boolean
}

async function tryLocalInference(text: string, solutionId?: string): Promise<LocalInferenceResult> {
  try {
    const api = (window as WindowWithElectron).electronAPI
    if (api?.inference?.answer) {
      return (await api.inference.answer(text, solutionId)) as LocalInferenceResult
    }
  } catch {
    // Expected: 非 Electron 或本地推理 IPC 不可用；走下方 fallback 文案
  }

  return {
    text: '⚡ 当前处于离线状态，AI 对话暂不可用。\n\n请连接网络后重试。',
    source: 'fallback',
    confidence: 0,
    suggestOnline: true,
  }
}

function offlineSourceBadge(source: string): string {
  const badges: Record<string, string> = {
    calc: '> 🔢 **离线计算** — 本地精确计算引擎',
    knowledge: '> 📚 **离线知识** — 内置知识库匹配',
    pattern: '> 🧠 **离线推理** — 本地意图识别',
    fallback: '> ⚡ **离线模式**',
  }
  return badges[source] ?? badges.fallback
}

// ── Phase 6: 用户偏好记忆 — 自动学习 + 上下文注入 ──

async function getMemoryPromptText(solutionId?: string): Promise<string> {
  try {
    const api = (window as WindowWithElectron).electronAPI
    if (api?.memory?.getPromptText) {
      return await api.memory.getPromptText(solutionId) ?? ''
    }
  } catch {
    // Expected: 非 Electron 或 memory.getPromptText 不可用；无记忆注入
  }
  return ''
}

function autoLearnFromMessage(text: string, solutionId?: string, conversationId?: string): void {
  try {
    const api = (window as WindowWithElectron).electronAPI
    if (api?.memory?.learn) {
      api.memory.learn(text, solutionId, conversationId).catch(() => {
        // Expected: 后台学习 IPC 失败；不影响主对话
      })
    }
  } catch {
    // Expected: memory.learn 入口不可用；跳过隐式学习
  }
}
