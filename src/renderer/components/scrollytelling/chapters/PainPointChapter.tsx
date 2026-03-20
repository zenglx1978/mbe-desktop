/**
 * 第一幕：痛点共鸣
 *
 * 展示客户当前的人力成本痛点，滚动过程中数字逐渐显现。
 */

import { subProgress, animateNumber } from '@/hooks/useScrollytelling'

interface Props {
  progress: number
  tagline: string
  description: string
  profitMetrics: string[]
  valueEquivalent?: { humanHours: number; mbeMinutes: number; acceleration: string }
}

export default function PainPointChapter({
  progress,
  tagline,
  description,
  profitMetrics,
  valueEquivalent,
}: Props) {
  const titleP = subProgress(progress, 0.1, 0.3)
  const descP = subProgress(progress, 0.2, 0.4)
  const metricsP = subProgress(progress, 0.35, 0.6)
  const numberP = subProgress(progress, 0.5, 0.75)

  return (
    <div className="space-y-8 text-center">
      {/* 标题 */}
      <h2
        className="text-3xl font-bold text-foreground/90 leading-tight"
        style={{
          opacity: titleP,
          transform: `translateY(${(1 - titleP) * 20}px)`,
        }}
      >
        {tagline}
      </h2>

      {/* 描述 */}
      <p
        className="text-lg text-muted-foreground/70 max-w-2xl mx-auto leading-relaxed"
        style={{
          opacity: descP,
          transform: `translateY(${(1 - descP) * 15}px)`,
        }}
      >
        {description}
      </p>

      {/* 利润指标 */}
      <div
        className="flex flex-col gap-3 max-w-lg mx-auto"
        style={{ opacity: metricsP }}
      >
        {profitMetrics.map((metric, i) => (
          <div
            key={i}
            className="flex items-center gap-3 text-left"
            style={{
              opacity: subProgress(metricsP, i * 0.2, i * 0.2 + 0.6),
              transform: `translateX(${(1 - subProgress(metricsP, i * 0.2, i * 0.2 + 0.6)) * 30}px)`,
            }}
          >
            <span className="text-primary text-lg">→</span>
            <span className="text-sm text-foreground/80">{metric}</span>
          </div>
        ))}
      </div>

      {/* 加速倍数 */}
      {valueEquivalent && (
        <div
          className="mt-6 pt-6 border-t border-border/20"
          style={{ opacity: numberP }}
        >
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-5xl font-black text-primary tabular-nums">
              {animateNumber(valueEquivalent.humanHours, numberP)}h
            </span>
            <span className="text-2xl text-muted-foreground/40 mx-2">→</span>
            <span className="text-5xl font-black text-emerald-500 tabular-nums">
              {animateNumber(valueEquivalent.mbeMinutes, numberP)}min
            </span>
          </div>
          <p className="text-xs text-muted-foreground/50 mt-2">
            加速 {valueEquivalent.acceleration}
          </p>
        </div>
      )}
    </div>
  )
}
