/**
 * 置信度视觉梯度（Desktop 4 级增强版）
 *
 * 从 mbe-finance 的 3 级离散色块升级为 4 级 dithering 纹理：
 * - very_high: 实色 emerald — 有法条/准则支撑
 * - high: 细点纹理 amber — 有依据但存在差异
 * - medium: 斜线纹理 orange — 经验判断
 * - low: 虚线框 + 稀疏点阵 red — AI 推测
 *
 * 输出工具函数：
 * - getConfidenceStyle() — className 工具函数
 * - scoreToGrade() — confidence_score 数值映射到 4 级 grade
 *
 * 遵循 Visualization Strategy 5.3 规范
 */

import type { ConfidenceGrade } from '../types'
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
