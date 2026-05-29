/**
 * TodayPanel 共享原语 — 各方案"今日待办"仪表盘复用的基础组件
 *
 * 抽取自 TodayPanel / LaborTodayPanel / InvestTodayPanel / HkFinanceTodayPanel
 * 中逐字重复的子组件，消除 4× 复制粘贴。各面板的领域逻辑（截止日历、紧急提醒、
 * 快速开始列表）仍保留在各自文件中，仅共用以下与领域无关的原语。
 *
 * 注意：LawTodayPanel 的 StatCard/QuickAction 采用了不同的视觉变体，保留其本地实现，
 * 不强行统一以避免外观回归；但其 footer / 计算器 chip 与多数派一致，可复用此处。
 */
import type { SolutionConfig } from '@/lib/solution-router'
import { ChevronRight, ArrowRight, Zap } from 'lucide-react'

/** 顶部统计卡片（多数派变体：图标+右上 chevron，下方大数字） */
export function StatCard({ icon, label, value, sub, color, bgColor, onClick }: {
  icon: React.ReactNode; label: string; value: string; sub: string
  color: string; bgColor: string; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-sm transition-all text-left"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bgColor} ${color}`}>
          {icon}
        </div>
        {onClick && <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
      </div>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-xs font-medium text-foreground mt-1">{label}</span>
      <span className="text-[11px] text-muted-foreground">{sub}</span>
    </button>
  )
}

/** 快速开始动作卡片（多数派变体：p-4，左图标右 chevron） */
export function QuickAction({ icon, title, desc, onClick, color }: {
  icon: React.ReactNode; title: string; desc: string
  onClick: () => void; color: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-sm transition-all text-left group"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-muted/50 ${color} shrink-0 group-hover:scale-105 transition-transform`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{desc}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0 mt-1 group-hover:text-primary transition-colors" />
    </button>
  )
}

/** 计算器 chip（emoji 图标 + 名称 + 箭头） */
export function CalcButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-card text-sm hover:border-primary/30 hover:bg-primary/5 transition-colors"
    >
      <span>{icon}</span>
      <span className="text-foreground">{label}</span>
      <ArrowRight className="w-3 h-3 text-muted-foreground" />
    </button>
  )
}

/**
 * 计算器 chip 行：渲染 solution 中 type==='calculator' 的工具。
 * 无计算器工具且提供 fallback 时渲染 fallback（HkFinance 用到）。
 */
export function CalculatorChips({ solution, onOpenTools, fallback }: {
  solution: SolutionConfig; onOpenTools: () => void; fallback?: React.ReactNode
}) {
  const calcs = solution.tools.filter(t => t.type === 'calculator')
  if (calcs.length === 0 && fallback) return <>{fallback}</>
  return (
    <>
      {calcs.map((tool) => (
        <CalcButton key={tool.id} icon={tool.icon} label={tool.name} onClick={onOpenTools} />
      ))}
    </>
  )
}

/** 底部利润影响提示（entrepreneurPurpose + profitMetrics 徽章） */
export function ProfitImpactFooter({ solution }: { solution: SolutionConfig }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-foreground mb-1">{solution.entrepreneurPurpose}</div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {solution.profitMetrics.map((m, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{m}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
