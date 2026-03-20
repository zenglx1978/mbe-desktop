/**
 * Agent 端点构造（原 solution-router 内联函数）。
 * 独立文件以便 solution-registry-data 使用，且不与 solution-router 形成运行时环。
 */
import { API_BASE, WS_BASE } from '@/lib/api-client'

import type { AgentEndpoint } from './solution-router'

export function agent(id: string, _port: number, role: string, handles: string): AgentEndpoint {
  return {
    id,
    role,
    handles,
    baseUrl: `${API_BASE}/api/${id}`,
    wsUrl: `${WS_BASE}/ws/${id}/chat`,
  }
}
