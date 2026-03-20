/**
 * 第三幕：工作流演示
 *
 * 滚动驱动水平时间线推进，展示 AI 专家如何协作处理一个典型场景。
 */

import { subProgress, easeOut } from '@/hooks/useScrollytelling'

interface ScenarioDef {
  label: string
  icon: string
  expectedOutcome: string
  profitImpact?: { dimension: string; amount: string }
}

interface Props {
  progress: number
  scenarios: ScenarioDef[]
}

export default function WorkflowChapter({ progress, scenarios }: Props) {
  const titleP = subProgress(progress, 0.05, 0.2)
  const display = scenarios.slice(0, 4)
  const count = display.length

  return (
    <div className="space-y-8">
      {/* 标题 */}
      <div className="text-center" style={{ opacity: titleP }}>
        <p className="text-xs text-primary/60 tracking-widest uppercase mb-2">
          典型业务场景
        </p>
        <h2 className="text-2xl font-bold text-foreground/90">
          AI 直接替你干活，交付结果
        </h2>
      </div>

      {/* 水平时间线 */}
      <div className="relative mt-12">
        {/* 轨道 */}
        <div className="absolute top-8 left-0 right-0 h-[2px] bg-border/20" />
        <div
          className="absolute top-8 left-0 h-[2px] bg-primary transition-[width] duration-100"
          style={{ width: `${Math.min(100, subProgress(progress, 0.2, 0.85) * 100)}%` }}
        />

        {/* 节点 */}
        <div className="relative flex justify-between">
          {display.map((scenario, i) => {
            const nodeP = subProgress(progress, 0.2 + (i / count) * 0.5, 0.35 + (i / count) * 0.5)
            const isReached = nodeP > 0.3
            const detailP = subProgress(nodeP, 0.4, 1)

            return (
              <div key={i} className="flex flex-col items-center flex-1">
                {/* 节点圆 */}
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl border-2 transition-all duration-300 ${
                    isReached
                      ? 'border-primary bg-primary/10 shadow-[0_0_12px_hsl(var(--primary)/0.2)]'
                      : 'border-border/30 bg-card'
                  }`}
                  style={{ transform: `scale(${0.85 + easeOut(nodeP) * 0.15})` }}
                >
                  {scenario.icon}
                </div>

                {/* 标签 */}
                <span
                  className={`mt-3 text-xs font-medium text-center ${
                    isReached ? 'text-foreground/90' : 'text-muted-foreground/40'
                  }`}
                >
                  {scenario.label}
                </span>

                {/* 产出预览 */}
                <div
                  className="mt-2 max-w-[160px]"
                  style={{ opacity: detailP, transform: `translateY(${(1 - detailP) * 8}px)` }}
                >
                  <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed">
                    {scenario.expectedOutcome}
                  </p>
                  {scenario.profitImpact && (
                    <p className="text-[9px] text-emerald-500/70 text-center mt-1">
                      💰 {scenario.profitImpact.amount}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
