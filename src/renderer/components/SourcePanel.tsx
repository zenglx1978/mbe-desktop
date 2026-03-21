/**
 * SourcePanel 桥接模块
 *
 * 将 visualization/AgentCollaboration 的 EnhancedSourceList
 * 适配为 ChatMessage.tsx 期望的接口。
 */

import { EnhancedSourceList, AIReasoningBadge } from './visualization/AgentCollaboration'
import type { SourceCitationData } from './visualization/types'

interface SourcePanelProps {
  sources: {
    title: string
    ref?: string
    url?: string
    reliability?: string
    confidence?: number
    expired?: boolean
    source_type?: string
    file_path?: string
    retrieval_method?: string
    authority?: string
  }[]
  className?: string
}

export default function SourcePanel({ sources, className }: SourcePanelProps) {
  if (!sources || sources.length === 0) return null

  const normalized: SourceCitationData[] = sources.map(s => ({
    title: s.title,
    ref: s.ref,
    url: s.url,
    reliability: (s.reliability as 'high' | 'medium' | 'low') || 'medium',
    confidence: s.confidence,
    expired: s.expired,
    source_type: s.source_type as SourceCitationData['source_type'],
    file_path: s.file_path,
    retrieval_method: s.retrieval_method as SourceCitationData['retrieval_method'],
    authority: s.authority,
  }))

  return (
    <div className={className}>
      <EnhancedSourceList sources={normalized} />
    </div>
  )
}

export { AIReasoningBadge }
