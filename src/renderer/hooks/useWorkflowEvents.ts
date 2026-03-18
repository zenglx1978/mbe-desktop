/**
 * useWorkflowEvents — WorkflowOS 实时事件推送
 *
 * 通过 WebSocket 监听 workflow.* 事件，
 * 收到事件时调用 onEvent 回调，驱动 Dashboard 实时更新。
 *
 * 自动重连 + 降级到 polling 的设计：
 *   - WS 连接成功 → 实时推送，禁用 polling
 *   - WS 断开 → 自动重连（指数退避，最大 30s）
 *   - 3 次重连失败 → 通知调用者降级到 polling
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { getDeviceId } from '@/lib/api-client'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export interface WorkflowEvent {
  type: string
  data: {
    instance_id?: string
    workflow_name?: string
    user_id?: string
    status?: string
    progress_percent?: number
    completed_steps?: number
    total_steps?: number
    step_id?: string
    step_name?: string
    deliverable_id?: string
    title?: string
    error?: string
    deliverable_count?: number
    total_elapsed_ms?: number
    [key: string]: unknown
  }
  timestamp?: string
}

interface UseWorkflowEventsOptions {
  agentName: string
  userId: string
  enabled?: boolean
  onEvent: (event: WorkflowEvent) => void
  onConnectionChange?: (connected: boolean) => void
}

const MAX_RECONNECT_ATTEMPTS = 5
const BASE_DELAY = 1000
const MAX_DELAY = 30000

export function useWorkflowEvents({
  agentName,
  userId,
  enabled = true,
  onEvent,
  onConnectionChange,
}: UseWorkflowEventsOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef(0)
  const [connected, setConnected] = useState(false)

  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const onConnRef = useRef(onConnectionChange)
  onConnRef.current = onConnectionChange

  const connect = useCallback(() => {
    if (!enabled || !agentName) return

    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = BASE_URL
        ? new URL(BASE_URL).host
        : window.location.host
      const deviceId = getDeviceId()
      const url = `${proto}//${host}/ws/${agentName}/events?user_id=${encodeURIComponent(userId)}&device_id=${deviceId}`

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectRef.current = 0
        setConnected(true)
        onConnRef.current?.(true)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type?.startsWith('workflow.')) {
            onEventRef.current(data as WorkflowEvent)
          }
        } catch {
          // 忽略非 JSON 消息
        }
      }

      ws.onclose = () => {
        wsRef.current = null
        setConnected(false)
        onConnRef.current?.(false)

        if (reconnectRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            BASE_DELAY * Math.pow(2, reconnectRef.current),
            MAX_DELAY,
          )
          reconnectRef.current++
          setTimeout(connect, delay)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      // WS 构造失败，不重试
    }
  }, [agentName, userId, enabled])

  useEffect(() => {
    connect()
    return () => {
      reconnectRef.current = MAX_RECONNECT_ATTEMPTS
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  return { connected }
}
