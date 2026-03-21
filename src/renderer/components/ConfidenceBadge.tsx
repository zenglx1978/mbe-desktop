/**
 * ConfidenceBadge 桥接模块
 *
 * 将 visualization/ConfidenceVisual 的组件适配为
 * ChatMessage.tsx 期望的接口（默认导出 + getConfidenceCssClass）。
 */

import { ConfidenceBadge as VizBadge, scoreToGrade, getConfidenceStyle } from './visualization/ConfidenceVisual'

interface ConfidenceBadgeProps {
  confidence: number
  className?: string
}

/**
 * 根据 0-1 置信度分数返回 CSS class（供消息气泡使用）
 */
export function getConfidenceCssClass(confidence?: number): string {
  if (confidence == null) return ''
  const grade = scoreToGrade(confidence)
  const { className } = getConfidenceStyle(grade)
  return className
}

/**
 * 默认导出：显示在消息下方的置信度徽章
 */
export default function ConfidenceBadge({ confidence, className = '' }: ConfidenceBadgeProps) {
  if (confidence == null) return null
  const grade = scoreToGrade(confidence)
  return (
    <div className={`mt-1 ${className}`}>
      <VizBadge grade={grade} score={confidence} />
    </div>
  )
}
