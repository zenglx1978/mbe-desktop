/**
 * OrchestrationPanel 桥接模块
 *
 * 将 visualization/AgentCollaboration 的 ExpertOrchestrationPanel
 * 适配为 ChatMessage.tsx 期望的接口。
 */

import { ExpertOrchestrationPanel, extractOrchestration } from './visualization/AgentCollaboration'
import type { OrchestrationInfo } from './visualization/types'

interface OrchestrationPanelProps {
  orchestration: {
    mode?: string
    experts: {
      id?: string
      expert_id?: string
      name?: string
      expert_name?: string
      role?: string
      status?: string
      elapsed_ms?: number
      token_used?: number
      kb_sources_hit?: number
    }[]
    total_elapsed_ms?: number
  }
  className?: string
}

export default function OrchestrationPanel({ orchestration, className }: OrchestrationPanelProps) {
  const info: OrchestrationInfo = {
    mode: (orchestration.mode as OrchestrationInfo['mode']) || 'parallel',
    experts: (orchestration.experts || []).map(e => ({
      id: e.id || e.expert_id || '',
      name: e.name || e.expert_name || e.id || '',
      role: e.role,
      status: (e.status as 'idle' | 'working' | 'done' | 'error') || 'done',
      elapsed_ms: e.elapsed_ms,
      token_used: e.token_used,
      kb_sources_hit: e.kb_sources_hit,
    })),
    total_elapsed_ms: orchestration.total_elapsed_ms,
  }

  return <ExpertOrchestrationPanel info={info} className={className} />
}

export { extractOrchestration }
export type { OrchestrationInfo }
