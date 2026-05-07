import type { SolutionConfig, ScenarioConfig } from '@/lib/solution-router'
import { getSolutionIcon } from '@/lib/solution-icons'
import { Coins, Zap, ShieldCheck } from 'lucide-react'

export interface ChatWelcomeScreenProps {
  solution: SolutionConfig
  onScenarioClick: (prompt: string) => void
}

export function ChatWelcomeScreen({ solution, onScenarioClick }: ChatWelcomeScreenProps) {
  const pillars = (solution.scenarios ?? []).filter((s) => s.id.startsWith('pillar_'))
  const others = (solution.scenarios ?? []).filter((s) => !s.id.startsWith('pillar_'))

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto py-6">
      <div className="text-center">
        {(() => {
          const Icon = getSolutionIcon(solution.id)
          return (
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-3">
              <Icon className="w-7 h-7" />
            </div>
          )
        })()}
        <h2 className="text-2xl font-bold tracking-tight">{solution.name}</h2>
        <p className="text-muted-foreground mt-1">{solution.tagline}</p>
        {solution.entrepreneurPurpose && (
          <p className="text-xs text-primary/80 mt-2">{solution.entrepreneurPurpose}</p>
        )}
      </div>

      {solution.profitMetrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {solution.profitMetrics.map((metric, i) => {
            const MetricIcon = [Coins, Zap, ShieldCheck][i] ?? Zap
            return (
              <div
                key={i}
                className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl border border-primary/15 bg-primary/5"
              >
                <MetricIcon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span className="text-xs leading-relaxed text-foreground/80">{metric}</span>
              </div>
            )
          })}
        </div>
      )}

      {pillars.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            决策链
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {pillars.map((sc, i) => (
              <span key={sc.id} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted-foreground/50">→</span>}
                <ScenarioCard scenario={sc} onClick={() => onScenarioClick(sc.prompt)} />
              </span>
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            快捷场景
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {others.map((sc) => (
              <ScenarioCard key={sc.id} scenario={sc} onClick={() => onScenarioClick(sc.prompt)} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          AI 专家团队
          {solution.valueEquivalent && (
            <span className="inline-flex items-center gap-1 ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary normal-case">
              <Zap className="w-3 h-3" />
              {solution.valueEquivalent.humanHours}小时→{solution.valueEquivalent.mbeMinutes}分钟
            </span>
          )}
        </h3>
        <div className="flex flex-wrap gap-2">
          {solution.agents.map((a) => (
            <div
              key={a.id}
              className="px-3 py-2 rounded-lg border border-border/30 bg-secondary/20 text-sm"
            >
              <span className="font-medium">{a.role}</span>
              <span className="text-muted-foreground text-xs ml-2">· {a.handles}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export interface ScenarioCardProps {
  scenario: ScenarioConfig
  onClick: () => void
}

const PROFIT_DIMENSION_LABELS: Record<string, { prefix: string; cls: string }> = {
  revenue: { prefix: '增收', cls: 'text-green-500' },
  cost_saving: { prefix: '降本', cls: 'text-blue-500' },
  loss_avoidance: { prefix: '避损', cls: 'text-amber-500' },
}

export function ScenarioCard({ scenario, onClick }: ScenarioCardProps) {
  const profit = scenario.profitImpact
  const dim = profit ? PROFIT_DIMENSION_LABELS[profit.dimension] : null
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all text-left"
    >
      <span className="text-base">{scenario.icon}</span>
      <div className="min-w-0">
        <span className="text-sm font-medium truncate block">{scenario.label}</span>
        {profit && dim && (
          <span className={`text-[10px] ${dim.cls} block truncate mt-0.5`}>
            {dim.prefix}: {profit.amount}
          </span>
        )}
      </div>
    </button>
  )
}
