/**
 * CSS Dithering 纹理工具 — 用可控的"模糊"表达不确定性
 *
 * 四级置信度纹理：
 * - very_high (0.9-1.0): 实色，无纹理
 * - high (0.7-0.9): 轻微纹理（细点）
 * - medium (0.5-0.7): 明显 dithering（斜线纹理）
 * - low (<0.5): 虚线框 + 稀疏点阵
 *
 * 遵循 Visualization Strategy 5.3 规范
 *
 * 实现：SVG pattern 内联 + CSS background-image，零外部依赖
 */

import type { ConfidenceGrade } from '../types'

/**
 * SVG 纹理 pattern 定义（内联 data URI）
 */
const DITHER_PATTERNS: Record<string, string> = {
  dots_fine: `url("data:image/svg+xml,%3Csvg width='6' height='6' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='0.5' fill='%23000' opacity='0.08'/%3E%3C/svg%3E")`,
  diagonal_lines: `url("data:image/svg+xml,%3Csvg width='8' height='8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 8L8 0' stroke='%23000' stroke-opacity='0.1' stroke-width='1'/%3E%3C/svg%3E")`,
  sparse_dots: `url("data:image/svg+xml,%3Csvg width='12' height='12' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23000' opacity='0.12'/%3E%3Ccircle cx='8' cy='8' r='0.8' fill='%23000' opacity='0.08'/%3E%3C/svg%3E")`,
  crosshatch: `url("data:image/svg+xml,%3Csvg width='10' height='10' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10L10 0M-2 2L2-2M8 12L12 8' stroke='%23000' stroke-opacity='0.07' stroke-width='0.5'/%3E%3C/svg%3E")`,
}

const DITHER_PATTERNS_DARK: Record<string, string> = {
  dots_fine: `url("data:image/svg+xml,%3Csvg width='6' height='6' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='0.5' fill='%23fff' opacity='0.06'/%3E%3C/svg%3E")`,
  diagonal_lines: `url("data:image/svg+xml,%3Csvg width='8' height='8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 8L8 0' stroke='%23fff' stroke-opacity='0.08' stroke-width='1'/%3E%3C/svg%3E")`,
  sparse_dots: `url("data:image/svg+xml,%3Csvg width='12' height='12' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23fff' opacity='0.1'/%3E%3Ccircle cx='8' cy='8' r='0.8' fill='%23fff' opacity='0.06'/%3E%3C/svg%3E")`,
  crosshatch: `url("data:image/svg+xml,%3Csvg width='10' height='10' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10L10 0M-2 2L2-2M8 12L12 8' stroke='%23fff' stroke-opacity='0.05' stroke-width='0.5'/%3E%3C/svg%3E")`,
}

export interface DitherConfig {
  bg: string
  border: string
  bar: string
  label: string
  desc: string
  pattern: string
  patternDark: string
}

export const CONFIDENCE_DITHER: Record<ConfidenceGrade, DitherConfig> = {
  very_high: {
    bg: 'bg-emerald-50/50 dark:bg-emerald-900/10',
    border: 'border border-emerald-200/60 dark:border-emerald-800/30',
    bar: 'bg-emerald-500',
    label: '确定',
    desc: '有明确法条/准则支撑',
    pattern: '',
    patternDark: '',
  },
  high: {
    bg: 'bg-amber-50/40 dark:bg-amber-900/10',
    border: 'border border-amber-200/60 dark:border-amber-800/30',
    bar: 'bg-amber-500',
    label: '较确定',
    desc: '有依据但存在地区差异',
    pattern: DITHER_PATTERNS.dots_fine!,
    patternDark: DITHER_PATTERNS_DARK.dots_fine!,
  },
  medium: {
    bg: 'bg-orange-50/40 dark:bg-orange-900/10',
    border: 'border border-orange-200/60 dark:border-orange-800/30',
    bar: 'bg-orange-500',
    label: '需验证',
    desc: '经验判断，非强制规定',
    pattern: DITHER_PATTERNS.diagonal_lines!,
    patternDark: DITHER_PATTERNS_DARK.diagonal_lines!,
  },
  low: {
    bg: 'bg-red-50/30 dark:bg-red-900/10',
    border: 'border-dashed border border-red-200/60 dark:border-red-800/30',
    bar: 'bg-red-500',
    label: '需确认',
    desc: 'AI 推测/建议，需人工确认',
    pattern: DITHER_PATTERNS.sparse_dots!,
    patternDark: DITHER_PATTERNS_DARK.sparse_dots!,
  },
}

/**
 * 获取指定置信度的背景样式（className + inline style）
 */
export function getDitherStyle(grade: ConfidenceGrade, dark = false): {
  className: string
  style: React.CSSProperties
} {
  const cfg = CONFIDENCE_DITHER[grade]
  const pattern = dark ? cfg.patternDark : cfg.pattern
  return {
    className: `${cfg.bg} ${cfg.border}`,
    style: pattern ? { backgroundImage: pattern, backgroundRepeat: 'repeat' } : {},
  }
}
