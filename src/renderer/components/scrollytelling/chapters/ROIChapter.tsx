/**
 * 第四幕：ROI 数字跳动
 *
 * 滚动驱动计数器，展示经济价值。
 * 大数字 + 对比条形 + "人力等效" 换算。
 */

import { subProgress, animateNumber, easeOut } from '@/hooks/useScrollytelling'

interface Props {
  progress: number
  profitMetrics: string[]
  valueEquivalent?: { humanHours: number; mbeMinutes: number; acceleration: string }
}

export default function ROIChapter({ progress, profitMetrics, valueEquivalent }: Props) {
  const titleP = subProgress(progress, 0.05, 0.2)
  const barsP = subProgress(progress, 0.2, 0.6)
  const comparisonP = subProgress(progress, 0.5, 0.8)

  return (
    <div className="space-y-10">
      {/* 标题 */}
      <div className="text-center" style={{ opacity: titleP }}>
        <p className="text-xs text-primary/60 tracking-widest uppercase mb-2">
          投入产出
        </p>
        <h2 className="text-2xl font-bold text-foreground/90">
          省下来的每一分钱，都是利润
        </h2>
      </div>

      {/* 对比条形图 */}
      {valueEquivalent && (
        <div className="max-w-md mx-auto space-y-4" style={{ opacity: barsP }}>
          {/* 人工耗时 */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground/60">传统人工</span>
              <span className="text-red-400 tabular-nums font-medium">
                {animateNumber(valueEquivalent.humanHours, barsP)} 小时
              </span>
            </div>
            <div className="h-6 rounded-full bg-card overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-500/60 to-red-400/40 transition-[width] duration-100"
                style={{ width: `${easeOut(barsP) * 100}%` }}
              />
            </div>
          </div>

          {/* MBE AI */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground/60">MBE AI 专家</span>
              <span className="text-emerald-400 tabular-nums font-medium">
                {animateNumber(valueEquivalent.mbeMinutes, barsP)} 分钟
              </span>
            </div>
            <div className="h-6 rounded-full bg-card overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-100"
                style={{
                  width: `${easeOut(barsP) * (valueEquivalent.mbeMinutes / valueEquivalent.humanHours) * 100}%`,
                  minWidth: easeOut(barsP) > 0 ? '24px' : '0',
                }}
              />
            </div>
          </div>

          {/* 倍数 */}
          <div
            className="text-center pt-4"
            style={{ opacity: comparisonP, transform: `scale(${0.8 + easeOut(comparisonP) * 0.2})` }}
          >
            <span className="text-5xl font-black text-primary">
              {valueEquivalent.acceleration}
            </span>
            <p className="text-xs text-muted-foreground/50 mt-1">提速倍数</p>
          </div>
        </div>
      )}

      {/* 利润指标列表 */}
      <div className="max-w-md mx-auto space-y-3" style={{ opacity: subProgress(progress, 0.6, 0.85) }}>
        {profitMetrics.map((metric, i) => {
          const itemP = subProgress(progress, 0.6 + i * 0.06, 0.75 + i * 0.06)
          return (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10"
              style={{ opacity: itemP, transform: `translateX(${(1 - easeOut(itemP)) * 20}px)` }}
            >
              <span className="text-emerald-500 text-sm">✓</span>
              <span className="text-sm text-foreground/80">{metric}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
