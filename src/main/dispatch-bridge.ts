// DispatchBridge — 远程触发 AI 专家执行（借鉴三）
//
// Anthropic Dispatch 启发：
//   用户从手机发消息 → MBE Desktop 上的 AI 专家执行 → 结果推回手机
//
// 与 Scheduler 的关系：
//   - Scheduler: 定时自动触发（cron / file watch）
//   - DispatchBridge: 远程实时触发（手机 / PWA / API / 企微）
//
// 通信方式：
//   1. WebSocket 长连接 — 实时双向（Desktop ↔ 后端 ↔ PWA/手机）
//   2. 轮询降级 — WebSocket 不可用时自动降级为 HTTP 轮询
//   3. 本地执行 — 收到 Dispatch 请求后在本地调用 Agent API
//
// 架构：
//   手机/PWA → 后端 API → WebSocket → Desktop DispatchBridge
//     → 调用本地 Agent Expert → 获取结果
//     → 通过 WebSocket 推回 → 后端存储 → 手机/PWA 收到通知

import { ipcMain, Notification, BrowserWindow, app } from 'electron'
import { randomUUID } from 'crypto'
import { isSafeUrl } from './safe-path'

// ────────────────────── 类型定义 ──────────────────────

export interface DispatchConfig {
  /** 后端 WebSocket 地址 */
  wsUrl: string
  /** 后端 REST API 地址 */
  apiBaseUrl: string
  /** 认证 token */
  authToken: string
  /** 轮询间隔（毫秒），WebSocket 不可用时使用 */
  pollIntervalMs: number
  /** 重连间隔（毫秒） */
  reconnectIntervalMs: number
  /** 最大重连次数 */
  maxReconnectAttempts: number
}

export interface DispatchRequest {
  requestId: string
  userId: string
  source: 'pwa' | 'wechat' | 'api' | 'desktop'
  /** 已有 Schedule 的 ID（触发定时任务） */
  scheduleId?: string
  /** 一次性执行参数 */
  agentName?: string
  expertId?: string
  prompt?: string
  /** 回调 */
  callbackUrl?: string
  notifyChannels: string[]
  createdAt: string
}

export interface DispatchResult {
  requestId: string
  status: 'completed' | 'failed' | 'awaiting_user'
  summary: string
  deliverables: { type: string; name: string; url?: string; path?: string }[]
  error?: string
  tokenCost: number
  executedAt: string
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

// ────────────────────── 内部状态 ──────────────────────

let mainWindow: BrowserWindow | null = null
let config: DispatchConfig | null = null
let ws: WebSocket | null = null
let connectionStatus: ConnectionStatus = 'disconnected'
let reconnectAttempts = 0
let pollTimer: ReturnType<typeof setInterval> | null = null
let pendingResults = new Map<string, DispatchResult>()

const DEFAULT_CONFIG: DispatchConfig = {
  wsUrl: 'wss://mbe.hi-maker.com/ws/dispatch',
  apiBaseUrl: 'https://mbe.hi-maker.com/api/v1',
  authToken: '',
  pollIntervalMs: 10000,
  reconnectIntervalMs: 1000,
  maxReconnectAttempts: 20,
}

function getDeviceName(): string {
  const os = process.platform === 'win32' ? 'Win' : process.platform === 'darwin' ? 'Mac' : 'Linux'
  return `MBE-Desktop-${os}-${require('os').hostname()}`
}

// ────────────────────── 初始化 ──────────────────────

export function setDispatchMainWindow(win: BrowserWindow): void {
  mainWindow = win
}

function emitToRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

// ────────────────────── WebSocket 连接 ──────────────────────

function connectWebSocket(): void {
  if (!config?.wsUrl) {
    console.log('[Dispatch] 未配置 WebSocket 地址，跳过连接')
    return
  }

  connectionStatus = 'connecting'
  emitToRenderer('dispatch:statusChange', { status: connectionStatus })

  try {
    const url = `${config.wsUrl}?token=${encodeURIComponent(config.authToken || '')}`
    ws = new WebSocket(url, {
      headers: { 'X-Device-Name': getDeviceName() },
    } as any)

    ws.onopen = () => {
      connectionStatus = 'connected'
      reconnectAttempts = 0
      console.log(`[Dispatch] WebSocket 已连接 (device=${getDeviceName()})`)
      emitToRenderer('dispatch:statusChange', { status: connectionStatus })

      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data))
        handleDispatchMessage(data)
      } catch (err) {
        console.error('[Dispatch] 消息解析失败:', err)
      }
    }

    ws.onclose = (ev) => {
      connectionStatus = 'disconnected'
      emitToRenderer('dispatch:statusChange', { status: connectionStatus })
      if (ev.code === 4001) {
        console.error('[Dispatch] JWT 验证失败，不再重连')
        emitToRenderer('dispatch:authError', { code: 4001, reason: ev.reason })
        return
      }
      scheduleReconnect()
    }

    ws.onerror = (err) => {
      console.error('[Dispatch] WebSocket 错误:', err)
      startPolling()
    }
  } catch (err) {
    console.error('[Dispatch] WebSocket 连接失败:', err)
    startPolling()
  }
}

function scheduleReconnect(): void {
  if (!config || reconnectAttempts >= config.maxReconnectAttempts) {
    console.log('[Dispatch] 达到最大重连次数，降级到轮询')
    startPolling()
    return
  }

  reconnectAttempts++
  connectionStatus = 'reconnecting'

  // 指数退避：1s → 2s → 4s → 8s → 16s → 30s（上限）
  const delay = Math.min(
    config.reconnectIntervalMs * Math.pow(2, reconnectAttempts - 1),
    30_000,
  )

  console.log(`[Dispatch] 第 ${reconnectAttempts} 次重连 (${(delay / 1000).toFixed(1)}s 后)`)
  emitToRenderer('dispatch:statusChange', {
    status: connectionStatus,
    attempt: reconnectAttempts,
    maxAttempts: config.maxReconnectAttempts,
    nextRetryMs: delay,
  })

  setTimeout(connectWebSocket, delay)
}

// ────────────────────── HTTP 轮询降级 ──────────────────────

function startPolling(): void {
  if (pollTimer) return
  if (!config?.apiBaseUrl || !config.authToken) return

  console.log('[Dispatch] 启用 HTTP 轮询模式')

  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(
        `${config!.apiBaseUrl}/dispatch/pending`,
        {
          headers: {
            'Authorization': `Bearer ${config!.authToken}`,
            'Content-Type': 'application/json',
          },
        },
      )
      if (!res.ok) return

      const data = await res.json()
      if (data.requests?.length > 0) {
        for (const req of data.requests) {
          handleDispatchMessage({ type: 'dispatch_request', payload: req })
        }
      }
    } catch {
      // 静默忽略轮询错误
    }
  }, config.pollIntervalMs)
}

// ────────────────────── 消息处理 ──────────────────────

async function handleDispatchMessage(
  msg: { type: string; payload: Record<string, unknown> },
): Promise<void> {
  switch (msg.type) {
    case 'dispatch_request':
      await handleDispatchRequest(msg.payload as unknown as DispatchRequest)
      break
    case 'ping':
      sendToServer({ type: 'pong', payload: {} })
      break
    default:
      console.log('[Dispatch] 未知消息类型:', msg.type)
  }
}

async function handleDispatchRequest(request: DispatchRequest): Promise<void> {
  console.log(`[Dispatch] 收到远程请求: ${request.requestId} (来源: ${request.source})`)

  // 发送系统通知
  sendSystemNotification(
    `远程任务: ${request.prompt?.substring(0, 50) || '执行定时任务'}`,
    `来自 ${request.source}`,
  )

  emitToRenderer('dispatch:requestReceived', request)

  try {
    // 决定调用哪个 Agent
    const agentBaseUrl = resolveAgentUrl(request.agentName || '')
    const prompt = request.prompt || ''
    const expertId = request.expertId || ''

    // 调用本地 Agent API
    const agentResult = await callLocalAgent(agentBaseUrl, expertId, prompt, request)

    const result: DispatchResult = {
      requestId: request.requestId,
      status: agentResult.success ? 'completed' : 'failed',
      summary: agentResult.summary || '',
      deliverables: agentResult.deliverables || [],
      error: agentResult.error,
      tokenCost: agentResult.tokenCost || 0,
      executedAt: new Date().toISOString(),
    }

    // 推回结果
    sendToServer({ type: 'dispatch_result', payload: result as unknown as Record<string, unknown> })

    // 通知前端
    emitToRenderer('dispatch:resultReady', result)

    // 系统通知
    sendSystemNotification(
      result.status === 'completed' ? '✅ 任务完成' : '❌ 任务失败',
      result.summary?.substring(0, 100) || result.error || '',
    )

    pendingResults.set(request.requestId, result)

  } catch (err) {
    const errorResult: DispatchResult = {
      requestId: request.requestId,
      status: 'failed',
      summary: '',
      deliverables: [],
      error: err instanceof Error ? err.message : String(err),
      tokenCost: 0,
      executedAt: new Date().toISOString(),
    }
    sendToServer({ type: 'dispatch_result', payload: errorResult as unknown as Record<string, unknown> })
    emitToRenderer('dispatch:resultReady', errorResult)
  }
}

// ────────────────────── Agent 调用 ──────────────────────

const AGENT_PORTS: Record<string, number> = {
  finance: 8002,
  legal: 8003,
  cs: 8004,
  pulmonary: 8005,
  education: 8006,
  cost: 8007,
  sales: 8008,
  growth: 8009,
  hr: 8010,
  invest: 8011,
  transcribe: 8012,
  insurance_cs: 8013,
}

function resolveAgentUrl(agentName: string): string {
  const port = AGENT_PORTS[agentName] || 8002
  return `http://localhost:${port}`
}

async function callLocalAgent(
  baseUrl: string,
  expertId: string,
  prompt: string,
  request: DispatchRequest,
): Promise<{
  success: boolean
  summary: string
  deliverables: { type: string; name: string; url?: string; path?: string }[]
  error?: string
  tokenCost: number
}> {
  const endpoint = `${baseUrl}/api/v1/consult`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120000) // 2 分钟超时

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: prompt,
        expert_id: expertId || undefined,
        context: {
          dispatch_request_id: request.requestId,
          dispatch_source: request.source,
        },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      return {
        success: false,
        summary: '',
        deliverables: [],
        error: `Agent 返回 ${res.status}: ${await res.text()}`,
        tokenCost: 0,
      }
    }

    const data = await res.json()
    return {
      success: true,
      summary: data.answer || data.response || data.summary || '',
      deliverables: data.deliverables || [],
      tokenCost: (data.tokens_in || 0) + (data.tokens_out || 0),
    }
  } catch (err) {
    return {
      success: false,
      summary: '',
      deliverables: [],
      error: err instanceof Error ? err.message : String(err),
      tokenCost: 0,
    }
  }
}

// ────────────────────── 通知 ──────────────────────

function sendSystemNotification(title: string, body: string): void {
  if (!Notification.isSupported()) return

  const notification = new Notification({
    title: `[MBE Dispatch] ${title}`,
    body,
    urgency: 'normal',
  })

  notification.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  notification.show()
}

// ────────────────────── 服务端通信 ──────────────────────

function sendToServer(msg: { type: string; payload: Record<string, unknown> }): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
    return
  }

  // 降级到 HTTP POST
  if (config?.apiBaseUrl && config.authToken) {
    fetch(`${config.apiBaseUrl}/dispatch/results`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(msg.payload),
    }).catch(() => {})
  }
}

// ────────────────────── 销毁 ──────────────────────

export function destroyDispatch(): void {
  if (ws) {
    ws.close()
    ws = null
  }
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  pendingResults.clear()
  connectionStatus = 'disconnected'
  console.log('[Dispatch] 已断开连接')
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupDispatchIPC(): void {
  // 配置 Dispatch
  ipcMain.handle('dispatch:configure', async (_, cfg: Partial<DispatchConfig>) => {
    config = { ...DEFAULT_CONFIG, ...cfg }
    connectWebSocket()
    return { success: true, status: connectionStatus }
  })

  // 获取连接状态
  ipcMain.handle('dispatch:status', async () => {
    return {
      status: connectionStatus,
      pendingCount: pendingResults.size,
      reconnectAttempts,
    }
  })

  // 从 Desktop 端发起 Dispatch（也可以让桌面端用户远程触发另一台设备）
  ipcMain.handle('dispatch:send', async (_, request: {
    agentName: string
    expertId?: string
    prompt: string
    notifyChannels?: string[]
  }) => {
    const dispatchReq: DispatchRequest = {
      requestId: randomUUID(),
      userId: 'desktop_user',
      source: 'desktop',
      agentName: request.agentName,
      expertId: request.expertId,
      prompt: request.prompt,
      notifyChannels: request.notifyChannels || ['desktop', 'in_app'],
      createdAt: new Date().toISOString(),
    }

    await handleDispatchRequest(dispatchReq)
    return {
      success: true,
      requestId: dispatchReq.requestId,
    }
  })

  // 获取执行结果
  ipcMain.handle('dispatch:getResult', async (_, requestId: string) => {
    return pendingResults.get(requestId) || null
  })

  // 列出最近的结果
  ipcMain.handle('dispatch:listResults', async (_, limit?: number) => {
    const results = Array.from(pendingResults.values())
    return results.slice(-(limit || 20))
  })

  // 断开连接
  ipcMain.handle('dispatch:disconnect', async () => {
    destroyDispatch()
    return { success: true }
  })

  // 监听远程请求到达
  // 渲染进程可通过 onRequestReceived 注册回调
}
