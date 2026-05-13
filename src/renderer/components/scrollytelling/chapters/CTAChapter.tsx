/**
 * 第五幕：CTA 终章
 *
 * 行动召唤 — 立即体验方案。
 */

import type { LucideIcon } from 'lucide-react'
import { subProgress, easeOut } from '@/hooks/useScrollytelling'

interface Props {
  progress: number
  solutionName: string
  solutionIcon: string
  solutionColor: string
  IconComponent: LucideIcon
  tagline: string
  onStart: () => void
}

export default function CTAChapter({
  progress,
  solutionName,
  solutionColor,
  IconComponent,
  tagline,
  onStart,
}: Props) {
  const contentP = subProgress(progress, 0.1, 0.4)
  const buttonP = subProgress(progress, 0.3, 0.55)

  return (
    <div className="text-center space-y-8" style={{ opacity: contentP }}>
      {/* 方案图标 */}
      <div
        className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center"
        style={{
          backgroundColor: solutionColor + '15',
          color: solutionColor,
          transform: `scale(${0.5 + easeOut(contentP) * 0.5})`,
        }}
      >
        <IconComponent className="w-10 h-10" />
      </div>

      {/* 标题 */}
      <div>
        <h2 className="text-3xl font-bold text-foreground/90">
          准备好了吗？
        </h2>
        <p className="text-lg text-muted-foreground/60 mt-3 max-w-lg mx-auto">
          {solutionName} — {tagline}
        </p>
      </div>

      {/* CTA 按钮 */}
      <div style={{ opacity: buttonP, transform: `translateY(${(1 - easeOut(buttonP)) * 20}px)` }}>
        <button
          onClick={onStart}
          className="px-8 py-3 rounded-xl bg-primary text-primary-foreground text-base font-semibold hover:brightness-110 transition-all shadow-[0_0_20px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.5)]"
        >
          开始使用 →
        </button>
        <p className="text-xs text-muted-foreground/40 mt-3">
          免费试用 · 无需绑定支付 · 数据留在本地
        </p>
      </div>

      {/* 底部信任标识 */}
      <div
        className="flex items-center justify-center gap-6 pt-8 border-t border-border/10"
        style={{ opacity: subProgress(progress, 0.5, 0.7) }}
      >
        {['🔒 数据本地化', '📴 断线可用', '🛡️ 可溯源可靠'].map((badge) => (
          <span key={badge} className="text-[11px] text-muted-foreground/40">
            {badge}
          </span>
        ))}
      </div>
    </div>
  )
}
