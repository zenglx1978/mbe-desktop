/**
 * ScrollySection — 滚动叙事章节容器
 *
 * 提供：
 * 1. 足够高度的滚动区域（`scrollHeight` vh）
 * 2. 粘性内容面板（视口内固定）
 * 3. 根据 progress 自动淡入淡出
 */

import type { ReactNode } from 'react'

interface ScrollySectionProps {
  id: string
  sectionRef: React.RefObject<HTMLDivElement | null>
  progress: number
  visible: boolean
  children: ReactNode
  /** 章节占几个屏高度，默认 3 */
  scrollHeight?: number
  /** 背景色 class */
  bgClass?: string
}

export default function ScrollySection({
  id,
  sectionRef,
  progress,
  visible,
  children,
  scrollHeight = 3,
  bgClass = '',
}: ScrollySectionProps) {
  // 入场：0→0.15 淡入 / 出场：0.85→1 淡出
  const fadeIn = Math.min(1, progress / 0.15)
  const fadeOut = Math.min(1, (1 - progress) / 0.15)
  const opacity = Math.min(fadeIn, fadeOut)

  return (
    <section
      ref={sectionRef as React.RefObject<HTMLElement>}
      id={id}
      className={`relative ${bgClass}`}
      style={{ minHeight: `${scrollHeight * 100}vh` }}
    >
      <div
        className="sticky top-0 h-screen flex items-center justify-center overflow-hidden"
        style={{ opacity: visible ? opacity : 0, transition: 'opacity 0.15s ease-out' }}
      >
        <div className="w-full max-w-4xl mx-auto px-6">
          {children}
        </div>
      </div>
    </section>
  )
}
