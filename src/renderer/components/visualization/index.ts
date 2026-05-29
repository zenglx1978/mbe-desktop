/**
 * MBE Desktop 可视化组件库 — 统一导出
 *
 * Direction 2: Agent 协作热力图 + 注意力流
 *   - ExpertOrchestrationPanel — 多 Expert 实时编排面板（含 WebSocket）
 *   - KnowledgeSourceBadge     — 知识溯源增强标注
 *   - EnhancedSourceList       — 知识来源列表
 *   - InlineSourceAnchor       — 行内知识锚点
 *   - AIReasoningBadge         — AI 推理无源标注
 *   - AgentHeatmap             — Agent 活动热力图
 *
 * Direction 3: 置信度可视化
 *   - ConfidenceIndicator — 左侧色条指示器
 *   - ConfidenceFooter    — 底部说明 + 交互模式
 *   - ConfidenceMessage   — 完整置信度消息包装
 *   - ConfidenceBadge     — 段落级置信度徽章
 *   - ConfidenceParagraph — 段落级置信度标注
 */

// Types
export type {
  ExpertStatus,
  OrchestrationInfo,
  SourceCitationData,
  SourceType,
  FluencyData,
  ConfidenceGrade,
  ConfidenceLevel,
  SolutionNode,
  ExpertOrbit,
  WorkflowMeteor,
  DeliverableInfo,
  WorkflowStep,
  WorkflowTimeline,
  HeatmapCell,
  HeatmapData,
  ScrollySection,
  ScrollyConfig,
} from './types'

// Direction 2: Agent Collaboration
export {
  ExpertOrchestrationPanel,
  extractOrchestration,
  KnowledgeSourceBadge,
  EnhancedSourceList,
  AIReasoningBadge,
  InlineSourceAnchor,
  AgentHeatmap,
} from './AgentCollaboration'

// Direction 3: Confidence Visual
export {
  getConfidenceStyle,
  scoreToGrade,
  ConfidenceIndicator,
  ConfidenceFooter,
  ConfidenceMessage,
  ConfidenceBadge,
  ConfidenceParagraph,
} from './ConfidenceVisual'
