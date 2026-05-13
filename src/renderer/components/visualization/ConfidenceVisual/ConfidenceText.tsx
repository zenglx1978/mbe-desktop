/**
 * 置信度视觉梯度（Desktop 4 级增强版）
 *
 * 从 mbe-finance 的 3 级离散色块升级为 4 级 dithering 纹理：
 * - very_high: 实色 emerald — 有法条/准则支撑
 * - high: 细点纹理 amber — 有依据但存在差异
 * - medium: 斜线纹理 orange — 经验判断
 * - low: 虚线框 + 稀疏点阵 red — AI 推测
 *
 * 三个输出组件：
 * 1. getConfidenceStyle() — className 工具函数
 * 2. ConfidenceIndicator — 左侧色条指示器
 * 3. ConfidenceFooter — 底部说明 + 交互模式
 *
 * 遵循 Visualization Strategy 5.3 规范
 */

import type { ConfidenceGrade, FluencyData } from '../types'
import { CONFIDENCE_DITHER, getDitherStyle } from './DitherPattern'

/**
 * 根据置信度等级返回消息气泡的附加 className + style
 */
export function getConfidenceStyle(grade?: ConfidenceGrade | string, dark = false): {
  className: string
  style: React.CSSProperties
} {
  if (!grade || !CONFIDENCE_DITHER[grade as ConfidenceGrade]) {
    return { className: '', style: {} }
  }
  return getDitherStyle(grade as ConfidenceGrade, dark)
}

/**
 * 从 confidence_score 数值映射到 4 级 grade
 */
export function scoreToGrade(score?: number): ConfidenceGrade {
  if (!score || score >= 0.9) return 'very_high'
  if (score >= 0.7) return 'high'
  if (score >= 0.5) return 'medium'
  return 'low'
}

/**
 * 消息左侧的置信度色条 + dithering 纹理指示器
 */
export function ConfidenceIndicator({
  fluency,
  dark = false,
}: {
  fluency?: FluencyData
  dark?: boolean
}) {
  if (!fluency?.confidence_grade) return null
  const cfg = CONFIDENCE_DITHER[fluency.confidence_grade]
  if (!cfg) return null
  const pattern = dark ? cfg.patternDark : cfg.pattern

  return (
    <div className="flex items-stretch gap-2 shrink-0">
      <div
        className={`w-1.5 rounded-full shrink-0 ${cfg.bar}`}
        style={pattern ? { backgroundImage: pattern, backgroundRepeat: 'repeat' } : {}}
        title={`${cfg.label} — ${cfg.desc}`}
      />
    </div>
  )
}

/**
 * 消息气泡底部的置信度说明 + 交互模式 + dithering 图例
 */
export function ConfidenceFooter({
  fluency,
  hasSources,
}: {
  fluency?: FluencyData
  hasSources?: boolean
}) {
  if (!fluency?.confidence_grade) return null
  const cfg = CONFIDENCE_DITHER[fluency.confidence_grade]
  if (!cfg) return null

  const modeLabel: Record<string, { label: string; icon: string }> = {
    automation: { label: '自动执行', icon: '⚡' },
    augmentation: { label: '人机协作', icon: '🤝' },
    referral: { label: '建议转人工', icon: '👤' },
  }

  const mode = fluency.interaction_mode ? modeLabel[fluency.interaction_mode] : null

  return (
    <div className="mt-2 flex items-center gap-2 text-[11px] flex-wrap">
      {/* 置信度标签 */}
      <div className="flex items-center gap-1">
        <span className={`h-2 w-2 rounded-full ${cfg.bar}`} />
        <span className="text-gray-500 dark:text-gray-400 font-medium">{cfg.label}</span>
        <span className="text-gray-400 dark:text-gray-500">— {cfg.desc}</span>
      </div>

      {/* 置信度分数 */}
      {fluency.confidence_score != null && (
        <span className="tabular-nums text-gray-400">
          ({(fluency.confidence_score * 100).toFixed(0)}%)
        </span>
      )}

      {/* 交互模式 */}
      {mode && (
        <span className="text-gray-400 dark:text-gray-500">
          · {mode.icon} {mode.label}
        </span>
      )}

      {/* 无知识源警告 */}
      {!hasSources && fluency.confidence_grade !== 'very_high' && (
        <span className="text-amber-500 dark:text-amber-400">· ⚠ 未匹配知识源</span>
      )}
    </div>
  )
}

/**
 * 完整的置信度消息包装器（色条 + 内容 + 底部说明）
 */
export function ConfidenceMessage({
  fluency,
  hasSources,
  dark = false,
  children,
  className = '',
}: {
  fluency?: FluencyData
  hasSources?: boolean
  dark?: boolean
  children: React.ReactNode
  className?: string
}) {
  const grade = fluency?.confidence_grade
  const { className: bgCls, style } = getConfidenceStyle(grade, dark)

  return (
    <div className={`rounded-xl p-4 ${bgCls} ${className}`} style={style}>
      <div className="flex gap-2">
        <ConfidenceIndicator fluency={fluency} dark={dark} />
        <div className="min-w-0 flex-1">
          {children}
          <ConfidenceFooter fluency={fluency} hasSources={hasSources} />
        </div>
      </div>
    </div>
  )
}
