/**
 * MBE Desktop 可视化组件库 — 统一导出
 *
 * 三条前沿线全覆盖：
 *
 * Direction 1: Data Poetry（数据诗）
 *   - ParticleCanvas     — Canvas 2D 粒子星系动效
 *   - SolutionGalaxy     — Solution 数据 → 星系映射
 *   - DeliverableAnimation — 交付物凝固微动效
 *   - DeliverableList    — 批量交付物动效列表
 *
 * Direction 2: Agent 协作热力图 + 注意力流
 *   - ExpertOrchestrationPanel — 多 Expert 实时编排面板（含 WebSocket）
 *   - KnowledgeSourceBadge     — 知识溯源增强标注
 *   - EnhancedSourceList       — 知识来源列表
 *   - InlineSourceAnchor       — 行内知识锚点
 *   - AIReasoningBadge         — AI 推理无源标注
 *   - OrchestrationTimeline    — WorkflowOS 水平时间线
 *   - AgentHeatmap             — Agent 活动热力图
 *
 * Direction 3: Dithering 交互解释
 *   - DitherWrapper       — 置信度纹理包装器
 *   - ConfidenceLegend    — 四级纹理图例
 *   - ConfidenceIndicator — 左侧色条指示器
 *   - ConfidenceFooter    — 底部说明 + 交互模式
 *   - ConfidenceMessage   — 完整置信度消息包装
 *   - ConfidenceBadge     — 段落级置信度徽章
 *   - ConfidenceParagraph — 段落级置信度标注
 *   - ScrollyExplainer    — The Pudding 滚动叙事
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

// Direction 1: Data Poetry
export {
  ParticleCanvas,
  SolutionGalaxy,
  DeliverableAnimation,
  DeliverableList,
} from './DataPoetry'

// Direction 2: Agent Collaboration
export {
  ExpertOrchestrationPanel,
  extractOrchestration,
  KnowledgeSourceBadge,
  EnhancedSourceList,
  AIReasoningBadge,
  InlineSourceAnchor,
  OrchestrationTimeline,
  AgentHeatmap,
} from './AgentCollaboration'

// Direction 3: Confidence Visual / Dithering
export {
  DitherWrapper,
  ConfidenceLegend,
  getDitherStyle,
  CONFIDENCE_DITHER,
  getConfidenceStyle,
  scoreToGrade,
  ConfidenceIndicator,
  ConfidenceFooter,
  ConfidenceMessage,
  ConfidenceBadge,
  ConfidenceParagraph,
  ScrollyExplainer,
  LABOR_DISPATCH_SCROLLY,
} from './ConfidenceVisual'
