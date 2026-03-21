/**
 * 置信度徽章 — 用于段落级标注
 *
 * 在 AI 回答的每个段落旁显示置信度徽章，
 * 视觉上结合 dithering 纹理传达确定性梯度。
 *
 * 用法：
 * <ConfidenceBadge grade="high" score={0.85} />
 * <ConfidenceBadge grade="low" label="AI 推测" />
 */

import type { ConfidenceGrade } from '../types'
import { CONFIDENCE_DITHER, getDitherStyle } from './DitherPattern'

interface ConfidenceBadgeProps {
  grade: ConfidenceGrade
  score?: number
  label?: string
  dark?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ConfidenceBadge({
  grade,
  score,
  label,
  dark = false,
  size = 'sm',
  className = '',
}: ConfidenceBadgeProps) {
  const cfg = CONFIDENCE_DITHER[grade]
  if (!cfg) return null
  const { style } = getDitherStyle(grade, dark)

  const sizeClass = size === 'md' ? 'px-2.5 py-1 text-[11px]' : 'px-1.5 py-0.5 text-[10px]'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${cfg.bg} ${cfg.border} ${sizeClass} ${className}`}
      style={style}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.bar}`} />
      <span className="text-gray-600 dark:text-gray-400">
        {label || cfg.label}
      </span>
      {score != null && (
        <span className="tabular-nums text-gray-400 dark:text-gray-500">
          {(score * 100).toFixed(0)}%
        </span>
      )}
    </span>
  )
}

/**
 * 段落级置信度标注 — 包裹内容并在右上角显示徽章
 */
export function ConfidenceParagraph({
  grade,
  score,
  dark = false,
  children,
  className = '',
}: {
  grade: ConfidenceGrade
  score?: number
  dark?: boolean
  children: React.ReactNode
  className?: string
}) {
  const { className: bgCls, style } = getDitherStyle(grade, dark)

  return (
    <div className={`relative rounded-lg px-3 py-2 ${bgCls} ${className}`} style={style}>
      {/* 右上角浮动徽章 */}
      <div className="absolute -top-2 right-2">
        <ConfidenceBadge grade={grade} score={score} dark={dark} />
      </div>
      <div className="pr-16">{children}</div>
    </div>
  )
}
