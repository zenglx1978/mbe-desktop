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

import { useChatStore } from '@/stores/chat-store'
import { useConversationStore } from '@/stores/conversation-store'
import { useConnectivityStore } from '@/stores/connectivity-store'
import { useAppStore } from '@/stores/app-store'
import { useLocalFeedbackStore } from '@/stores/local-feedback-store'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'
import { routeMessage } from '@/lib/intent-router'
import type { AgentEndpoint, SolutionConfig } from '@/lib/solution-router'

/** WebSocket 连接池 */
const wsPool = new Map<string, WebSocket>()

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
) {
  const chatStore = useChatStore.getState()
  const convStore = useConversationStore.getState()
  const connectivity = useConnectivityStore.getState()
  const appStore = useAppStore.getState()
  const _sendStartMs = Date.now()

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

  // 离线检查
  if (connectivity.mode === 'offline') {
    const offlineId = chatStore.addMessage({
      role: 'assistant',
      content: offlineHint(solution),
      agentRole: agent.role,
    })
    convStore.persistMessage({
      id: offlineId,
      conversationId: convId,
      role: 'assistant',
      content: offlineHint(solution),
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

  try {
    await streamViaWebSocket(text, agent, assistantId, convId)
  } catch {
    try {
      await streamViaHTTP(text, agent, assistantId, convId)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '请求失败'
      chatStore.updateMessage(assistantId, {
        content: `⚠️ 连接${agent.role}失败：${errorMsg}\n\n请检查网络连接，或使用本地计算功能。`,
        streaming: false,
      })
    }
  } finally {
    chatStore.setLoading(false)
    const responseTimeMs = Date.now() - _sendStartMs

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
): Promise<void> {
  return new Promise((resolve, reject) => {
    const chatStore = useChatStore.getState()
    const wsKey = `${agent.id}_${agent.role}`

    let ws = wsPool.get(wsKey)
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      const legacyWsUrl = `wss://mbe.hi-maker.com/ws/${agent.id}/chat`
      const urls = [agent.wsUrl, legacyWsUrl]
      let connected = false
      for (const url of urls) {
        try {
          ws = new WebSocket(url)
          wsPool.set(wsKey, ws)
          connected = true
          break
        } catch { /* try next */ }
      }
      if (!connected || !ws) {
        reject(new Error('WebSocket 不可用'))
        return
      }
    }

    const socket = ws!

    const timeout = setTimeout(() => {
      reject(new Error('WebSocket 超时'))
    }, 30000)

    const payload = JSON.stringify({ query: text })

    socket.onopen = () => {
      socket.send(payload)
    }

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload)
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'chat_chunk' && data.chunk) {
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
          chatStore.updateMessage(messageId, updates)
          clearTimeout(timeout)
          resolve()
        } else if (data.type === 'error') {
          clearTimeout(timeout)
          reject(new Error(data.message || 'WS 错误'))
        } else if (data.type === 'auth_required') {
          clearTimeout(timeout)
          reject(new Error('需要登录后才能使用'))
        }
      } catch {
        chatStore.appendToMessage(messageId, event.data)
      }
    }

    socket.onerror = () => {
      clearTimeout(timeout)
      wsPool.delete(wsKey)
      reject(new Error('WebSocket 连接失败'))
    }

    socket.onclose = () => {
      wsPool.delete(wsKey)
      const msg = useChatStore.getState().messages.find(m => m.id === messageId)
      if (msg?.streaming) {
        chatStore.updateMessage(messageId, { streaming: false })
        clearTimeout(timeout)
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
): Promise<void> {
  const chatStore = useChatStore.getState()

  const candidates = [
    `${agent.baseUrl}/secretary/chat`,
    `${agent.baseUrl}/chat`,
    `${agent.baseUrl}/consult`,
  ]
  const body = JSON.stringify({ query: text, question: text, message: text, stream: true })
  const headers = { 'Content-Type': 'application/json' }

  let response: Response | null = null
  for (const url of candidates) {
    try {
      const r = await fetch(url, { method: 'POST', headers, body })
      if (r.ok || r.status === 401 || r.status === 422) {
        response = r
        break
      }
    } catch { /* try next */ }
  }

  if (!response) {
    throw new Error('所有 HTTP 端点均不可用')
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

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
          if (data) chatStore.appendToMessage(messageId, data)
        }
      }
    }
  }

  chatStore.updateMessage(messageId, { streaming: false })
}

// ── 离线提示 ──

function offlineHint(solution: SolutionConfig): string {
  const scripts = solution.localScripts
  if (scripts.length === 0) {
    return '⚡ 当前处于离线状态，AI 对话暂不可用。\n\n请连接网络后重试。'
  }

  const features = scripts.map(s => {
    const names: Record<string, string> = {
      calc_iit: '个人所得税计算',
      calc_vat: '增值税计算',
      calc_labor_compensation: '劳动补偿金计算',
      calc_litigation_fee: '诉讼费计算',
      calc_statute: '诉讼时效查询',
      calc_cost_estimate: '造价快速估算',
      calc_cost_fee: '取费计算',
      calc_cost_tax: '工程税金计算',
      calc_clinical_score: '临床评分',
      calc_pft: '肺功能解读',
      calc_ventilator: '呼吸机参数计算',
    }
    return `  - ${names[s] || s}`
  }).join('\n')

  return `⚡ 当前处于离线状态，AI 对话暂不可用。\n\n以下功能仍可使用（无需网络）：\n${features}\n\n请在输入框使用 \`/calc\` 命令执行本地计算。`
}
