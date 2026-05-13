/**
 * 交付物凝固动效 — AI 专家"签名"微动画
 *
 * 当 AI 专家完成交付物（合同/报告/记录）时播放：
 * 1. 文档从"流动态"（模糊光粒子）凝固为"成品态"（清晰文档图标）
 * 2. Expert 签名光弧划过
 * 3. 完成时微震反馈
 *
 * 纯 CSS animation + requestAnimationFrame，不依赖 Lottie
 */

import { useState, useEffect, useRef } from 'react'
import type { DeliverableInfo } from '../types'

interface DeliverableAnimationProps {
  deliverable: DeliverableInfo
  /** 是否播放入场动画 */
  animate?: boolean
  /** 动画时长 ms */
  duration?: number
  className?: string
  onComplete?: () => void
}

const TYPE_ICONS: Record<string, { icon: string; label: string; color: string }> = {
  contract: { icon: '📄', label: '合同', color: '#6366f1' },
  report: { icon: '📊', label: '报告', color: '#f59e0b' },
  record: { icon: '📋', label: '记录', color: '#10b981' },
  analysis: { icon: '🔍', label: '分析', color: '#3b82f6' },
  plan: { icon: '📐', label: '方案', color: '#8b5cf6' },
}

export function DeliverableAnimation({
  deliverable,
  animate = true,
  duration = 2000,
  className = '',
  onComplete,
}: DeliverableAnimationProps) {
  const [phase, setPhase] = useState<'fluid' | 'crystallizing' | 'done'>(animate ? 'fluid' : 'done')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const typeInfo = TYPE_ICONS[deliverable.type] || TYPE_ICONS.report

  useEffect(() => {
    if (!animate) return
    setPhase('fluid')

    timerRef.current = setTimeout(() => {
      setPhase('crystallizing')

      timerRef.current = setTimeout(() => {
        setPhase('done')
        onComplete?.()
      }, duration * 0.4)
    }, duration * 0.6)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [animate, duration, onComplete])

  return (
    <div className={`relative overflow-hidden rounded-xl border transition-all duration-500 ${className} ${
      phase === 'done'
        ? 'border-emerald-200 dark:border-emerald-800/40 bg-white dark:bg-[#1e1e1e]'
        : 'border-gray-200/50 dark:border-gray-700/50 bg-gray-50 dark:bg-[#252526]'
    }`}>
      {/* 流动态光晕（phase: fluid） */}
      {phase === 'fluid' && (
        <div className="absolute inset-0 animate-pulse">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(ellipse at 30% 50%, ${typeInfo.color}40, transparent 60%),
                           radial-gradient(ellipse at 70% 50%, ${typeInfo.color}20, transparent 50%)`,
              animation: 'fluid-drift 2s ease-in-out infinite alternate',
            }}
          />
        </div>
      )}

      {/* 凝固态光弧（phase: crystallizing） */}
      {phase === 'crystallizing' && (
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute h-0.5 w-full top-0"
            style={{
              background: `linear-gradient(90deg, transparent, ${typeInfo.color}, transparent)`,
              animation: 'sweep-line 0.8s ease-out forwards',
            }}
          />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: `linear-gradient(180deg, ${typeInfo.color}30, transparent)`,
              animation: 'fade-down 0.6s ease-out forwards',
            }}
          />
        </div>
      )}

      {/* 完成态微震 */}
      <div className={`relative px-4 py-3 flex items-center gap-3 ${
        phase === 'done' ? 'animate-[settle_0.3s_ease-out]' : ''
      }`}>
        {/* 图标 */}
        <div className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-lg transition-all duration-500 ${
          phase === 'done'
            ? 'bg-emerald-100 dark:bg-emerald-900/30'
            : phase === 'crystallizing'
              ? 'bg-white/80 dark:bg-[#1e1e1e]/80 scale-110'
              : 'bg-gray-100/50 dark:bg-gray-700/30 scale-95 blur-[1px]'
        }`}>
          <span className={`text-xl transition-all duration-500 ${
            phase === 'fluid' ? 'opacity-40 blur-[2px]' : 'opacity-100 blur-0'
          }`}>
            {typeInfo.icon}
          </span>
        </div>

        {/* 内容 */}
        <div className={`min-w-0 flex-1 transition-all duration-500 ${
          phase === 'fluid' ? 'opacity-50 translate-y-1' : 'opacity-100 translate-y-0'
        }`}>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
            {deliverable.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-gray-500">{typeInfo.label}</span>
            <span className="text-[11px] text-gray-400">·</span>
            <span className="text-[11px] text-gray-500">{deliverable.expert_name}</span>
          </div>
        </div>

        {/* 状态 */}
        {phase === 'done' && (
          <div className="shrink-0 flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <svg className="h-4 w-4 animate-[scale-in_0.3s_ease-out]" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] font-medium">已完成</span>
          </div>
        )}

        {phase === 'fluid' && (
          <div className="shrink-0 flex items-center gap-1 text-gray-400">
            <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[11px]">生成中</span>
          </div>
        )}

        {phase === 'crystallizing' && (
          <div className="shrink-0 flex items-center gap-1 text-amber-500">
            <div className="h-2 w-2 rounded-full bg-amber-400 animate-spin" />
            <span className="text-[11px]">凝固中</span>
          </div>
        )}
      </div>

      {/* CSS Keyframes (inline style tag) */}
      <style>{`
        @keyframes fluid-drift {
          0% { transform: translateX(-5%) scale(1); }
          100% { transform: translateX(5%) scale(1.05); }
        }
        @keyframes sweep-line {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        @keyframes fade-down {
          0% { opacity: 0.3; transform: translateY(-100%); }
          100% { opacity: 0; transform: translateY(0); }
        }
        @keyframes settle {
          0% { transform: scale(1.02); }
          50% { transform: scale(0.98); }
          100% { transform: scale(1); }
        }
        @keyframes scale-in {
          0% { transform: scale(0); }
          80% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

/**
 * 批量交付物动效列表
 */
export function DeliverableList({
  deliverables,
  stagger = 300,
  className = '',
}: {
  deliverables: DeliverableInfo[]
  stagger?: number
  className?: string
}) {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    if (visibleCount >= deliverables.length) return
    const timer = setTimeout(() => setVisibleCount(v => v + 1), stagger)
    return () => clearTimeout(timer)
  }, [visibleCount, deliverables.length, stagger])

  return (
    <div className={`space-y-2 ${className}`}>
      {deliverables.slice(0, visibleCount + 1).map((d, i) => (
        <DeliverableAnimation
          key={`${d.type}-${d.title}-${i}`}
          deliverable={d}
          animate={i === visibleCount}
        />
      ))}
    </div>
  )
}
