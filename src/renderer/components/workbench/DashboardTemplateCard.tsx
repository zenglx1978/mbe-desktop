import {
  getDeliverableIcon,
  promoteCanary,
  rollbackTemplate,
  type WorkflowTemplateDef,
} from '@/lib/workflow-os-service'

const TEMPLATE_ICON: Record<string, string> = {
  auto_voucher: '🧾', batch_voucher: '📋', report_export: '📊',
  period_end_close: '📅', tax_deadline_scan: '🔔', monthly_tax_filing: '🏛️',
  contract_review: '📜', case_analysis: '⚖️', compliance_check: '🛡️',
  compensation_calc: '🧮', litigation_cost: '💰',
  onboarding: '🤝', salary_calc: '💵', performance_review: '📈',
  labor_compliance: '⚖️', separation: '📤',
  bill_of_quantities: '📐', cost_estimation: '🏗️', settlement_audit: '🔍',
  change_order: '📝', bid_analysis: '🎯',
  stock_analysis: '📊', industry_research: '🔬', portfolio_review: '💼',
  macro_monitor: '🌍',
  copd_assessment: '🫁', pneumonia_treatment: '💊', pft_interpretation: '📉',
  lead_qualification: '🎯', deal_review: '🤝', quote_generation: '💹',
  campaign_planning: '📣', content_calendar: '📅', ab_test_design: '🧪',
  ticket_triage: '🎫', satisfaction_analysis: '⭐', sla_health_check: '⏱️',
  claims_processing: '📋', policy_renewal: '🔄', compliance_audit: '🛡️',
}

export function getTemplateIcon(id: string, deliverableType?: string): string {
  if (TEMPLATE_ICON[id]) return TEMPLATE_ICON[id]
  return getDeliverableIcon(deliverableType || 'document')
}

export interface DashboardTemplateCardProps {
  tmpl: WorkflowTemplateDef
  onStart: () => void
  starting: boolean
  agentName: string
  onRefresh: () => void
}

export function DashboardTemplateCard({ tmpl, onStart, starting, agentName, onRefresh }: DashboardTemplateCardProps) {
  const hasCanary = tmpl.status === 'canary' || (tmpl.canary_weight ?? 0) > 0
  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-4 flex flex-col gap-2 hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-xl">{getTemplateIcon(tmpl.id, tmpl.deliverable_type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate">{tmpl.name}</p>
            {tmpl.version && (
              <span className="px-1 py-0.5 text-[9px] rounded bg-secondary/50 text-muted-foreground shrink-0">
                v{tmpl.version}
              </span>
            )}
            {hasCanary && (
              <span className="px-1 py-0.5 text-[9px] rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 shrink-0">
                灰度 {tmpl.canary_weight}%
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {tmpl.steps.length} 步自动完成
            {tmpl.schedule && <span className="ml-1.5 text-primary">⏰ 定时</span>}
          </p>
        </div>
      </div>
      {tmpl.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{tmpl.description}</p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {tmpl.steps.slice(0, 4).map((s) => (
          <span key={s.id} className="text-[11px] px-1.5 py-0.5 rounded bg-secondary/30 text-muted-foreground">
            {s.name}
          </span>
        ))}
        {tmpl.steps.length > 4 && (
          <span className="text-[11px] text-muted-foreground">+{tmpl.steps.length - 4}</span>
        )}
      </div>
      <div className="mt-auto flex items-center gap-1.5">
        <button
          onClick={onStart}
          disabled={starting}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
        >
          {starting ? '启动中...' : '一键启动'}
        </button>
        {hasCanary && (
          <button
            onClick={async () => { await promoteCanary(agentName, tmpl.id); onRefresh() }}
            className="px-2 py-1.5 rounded-lg text-[11px] bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900"
            title="全量发布灰度版本"
          >
            全量
          </button>
        )}
        <button
          onClick={async () => { await rollbackTemplate(agentName, tmpl.id); onRefresh() }}
          className="px-2 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:bg-secondary/50"
          title="回滚到上一版本"
        >
          回滚
        </button>
      </div>
    </div>
  )
}
