import type { SolutionConfig } from '@/lib/solution-router'
import { DashboardTemplateCard } from './DashboardTemplateCard'
import { EmptyState } from './dashboard-panel-widgets'
import type { WorkflowTemplateDef } from '@/lib/workflow-os-service'

export interface DashboardCatalogFooterProps {
  solution: SolutionConfig
  hasAnyWorkflow: boolean
  templates: WorkflowTemplateDef[]
  dashboardLoaded: boolean
  loading: boolean
  startingTemplate: string | null
  agentName: string
  onStartTemplate: (tmplId: string) => void
  onRefreshDashboard: () => void
  onStartChat: () => void
  onOpenWorkflows: () => void
}

export function DashboardCatalogFooter({
  solution,
  hasAnyWorkflow,
  templates,
  dashboardLoaded,
  loading,
  startingTemplate,
  agentName,
  onStartTemplate,
  onRefreshDashboard,
  onStartChat,
  onOpenWorkflows,
}: DashboardCatalogFooterProps) {
  return (
    <>
      {templates.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            {hasAnyWorkflow ? 'AI 可以帮你做' : '选择一个工作流，AI 自动完成并交付结果'}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((tmpl) => (
              <DashboardTemplateCard
                key={tmpl.id}
                tmpl={tmpl}
                onStart={() => onStartTemplate(tmpl.id)}
                starting={startingTemplate === tmpl.id}
                agentName={agentName}
                onRefresh={onRefreshDashboard}
              />
            ))}
          </div>
        </div>
      )}

      {dashboardLoaded && !hasAnyWorkflow && templates.length === 0 && (
        <EmptyState onStartChat={onStartChat} />
      )}

      {loading && !dashboardLoaded && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          加载工作流数据...
        </div>
      )}

      {solution.profitMetrics.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            利润指标
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {solution.profitMetrics.map((metric, i) => (
              <div
                key={i}
                className="rounded-xl border border-primary/15 bg-primary/5 p-4"
              >
                <div className="text-primary text-lg mb-1">
                  {i === 0 ? '💰' : i === 1 ? '⚡' : '🛡️'}
                </div>
                <p className="text-xs leading-relaxed text-foreground/80">{metric}</p>
              </div>
            ))}
          </div>
          {solution.valueEquivalent && (
            <div className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-secondary/20">
              <span className="text-sm">⏱️</span>
              <span className="text-xs text-muted-foreground">
                人工 <strong className="text-foreground">{solution.valueEquivalent.humanHours}h</strong>
                {' → MBE '}
                <strong className="text-foreground">{solution.valueEquivalent.mbeMinutes}min</strong>
              </span>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary ml-auto">
                {solution.valueEquivalent.acceleration}
              </span>
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          AI 专家状态
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {solution.agents.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border border-border/50 bg-card/50 p-4"
            >
              <div className="font-medium text-sm">{a.role}</div>
              <p className="text-xs text-muted-foreground mt-1">{a.handles}</p>
            </div>
          ))}
        </div>
      </div>

      {(solution.scenarios ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            快捷场景
          </h3>
          <div className="flex flex-wrap gap-2">
            {(solution.scenarios ?? []).slice(0, 6).map((sc) => (
              <button
                key={sc.id}
                onClick={onOpenWorkflows}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all text-sm"
              >
                <span>{sc.icon}</span>
                <span>{sc.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
