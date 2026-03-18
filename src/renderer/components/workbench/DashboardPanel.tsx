import { useState, useEffect, useCallback, useRef } from 'react'
import { useToolStore } from '@/stores/tool-store'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import type { SolutionConfig } from '@/lib/solution-router'
import {
  fetchDashboard,
  fetchInstance,
  fetchTemplates,
  fetchSchedules,
  fetchPendingApprovals,
  fetchCrossAgentWorkflows,
  executeCrossAgentWorkflow,
  approveStep,
  startFromTemplate,
  getStatusDisplay,
  getDeliverableIcon,
  getExportUrl,
  fetchROI,
  fetchWebhooks,
  deleteWebhook,
  rollbackTemplate,
  promoteCanary,
  fetchBillingUsage,
  fetchAuditLogs,
  fetchMembers,
  fetchNotifications,
  markNotificationRead,
  markAllRead,
  fetchSLADashboard,
  type SLADashboardData,
  searchMarketplace,
  installFromMarketplace,
  type MarketplaceCard,
  fetchAnalyticsOverview,
  fetchRecommendations,
  fetchROIPrediction,
  type AnalyticsOverview,
  type AnalyticsRecommendation,
  type ROIPredictionData,
  type DashboardData,
  type ROISummary,
  type WebhookDef,
  type BillingUsage,
  type AuditEntryDef,
  type RoleMemberDef,
  type NotificationDef,
  type WorkflowInstanceSummary,
  type WorkflowInstanceDetail,
  type DeliverableItem,
  type WorkflowTemplateDef,
  type ScheduleEntry,
  type PendingApproval,
  type CrossAgentWorkflowDef,
} from '@/lib/workflow-os-service'
import { useWorkflowEvents, type WorkflowEvent } from '@/hooks/useWorkflowEvents'

interface Props {
  solution: SolutionConfig
}

const POLL_INTERVAL = 5000

/* ── 通知图标 ────────────────────────────── */

function NotifIcon({ type, priority }: { type: string; priority: string }) {
  const icons: Record<string, string> = {
    workflow_completed: '✅',
    workflow_failed: '❌',
    approval_pending: '⏳',
    approval_resolved: '👍',
    deliverable_ready: '📄',
    quota_warning: '⚠️',
    quota_exceeded: '🚫',
    role_changed: '🔑',
    system_alert: '🔔',
  }
  const ring = priority === 'urgent' ? 'ring-2 ring-red-400' : priority === 'high' ? 'ring-1 ring-amber-400' : ''
  return (
    <span className={`text-base shrink-0 rounded-full p-0.5 ${ring}`}>
      {icons[type] || '📋'}
    </span>
  )
}

/* ── 审计图标 ────────────────────────────── */

function AuditIcon({ action }: { action: string }) {
  const iconMap: Record<string, string> = {
    'workflow.created': '➕',
    'workflow.completed': '✅',
    'workflow.failed': '❌',
    'workflow.cancelled': '🚫',
    'deliverable.added': '📄',
    'approval.approved': '👍',
    'approval.rejected': '👎',
    'rbac.role_assigned': '🔑',
    'rbac.role_revoked': '🔒',
    'billing.plan_changed': '💳',
  }
  return <span className="text-sm">{iconMap[action] || '📋'}</span>
}

/* ── 角色徽章 ────────────────────────────── */

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    operator: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    viewer: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
    auditor: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  }
  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${styles[role] || styles.viewer}`}>
      {role}
    </span>
  )
}

/* ── 用量进度条 ────────────────────────────── */

function UsageBar({ label, used, limit, percent }: {
  label: string; used: number; limit: number; percent: number
}) {
  const color =
    percent >= 90 ? 'bg-red-500' :
    percent >= 70 ? 'bg-amber-500' :
    'bg-emerald-500'

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
        <span className="text-neutral-500">
          {used}{limit > 0 ? ` / ${limit}` : ' (不限)'}
        </span>
      </div>
      {limit > 0 && (
        <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      )}
    </div>
  )
}

/* ── 统计卡片 ────────────────────────────── */

function StatCard({ label, value, icon, accent, suffix }: {
  label: string; value: number | string; icon: string; accent?: string; suffix?: string
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xl font-bold" style={accent ? { color: accent } : undefined}>
          {value}{suffix && <span className="text-sm font-normal ml-0.5">{suffix}</span>}
        </p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

/* ── 实例行（可点击展开） ────────────────── */

function InstanceRow({ inst, isSelected, onClick }: {
  inst: WorkflowInstanceSummary; isSelected: boolean; onClick: () => void
}) {
  const s = getStatusDisplay(inst.status)
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        isSelected
          ? 'border-primary/40 bg-primary/5'
          : 'border-border/30 bg-card/30 hover:border-primary/20'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{inst.workflow_name}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {inst.completed_steps}/{inst.total_steps} 步
          {inst.total_elapsed_ms > 0 && ` · ${(inst.total_elapsed_ms / 1000).toFixed(1)}s`}
        </p>
      </div>
      <div className="w-24">
        <div className="h-1.5 rounded-full bg-secondary/30 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${inst.progress_percent}%`, backgroundColor: s.color }}
          />
        </div>
      </div>
      <span
        className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
        style={{ color: s.color, backgroundColor: `${s.color}15` }}
      >
        {s.text}
      </span>
      {inst.deliverable_count > 0 && (
        <span className="text-[10px] text-muted-foreground shrink-0">
          {inst.deliverable_count} 交付物
        </span>
      )}
      <span className="text-muted-foreground/40 text-xs">{isSelected ? '▾' : '▸'}</span>
    </button>
  )
}

/* ── 实例详情面板 ────────────────────────── */

function InstanceDetail({ detail, loading, agentName }: { detail: WorkflowInstanceDetail | null; loading: boolean; agentName: string }) {
  if (loading) {
    return <div className="px-4 py-3 text-xs text-muted-foreground">加载详情...</div>
  }
  if (!detail) return null

  const s = getStatusDisplay(detail.status)

  return (
    <div className="ml-6 mt-1 mb-3 rounded-xl border border-border/20 bg-card/30 p-4 space-y-4">
      {/* 导出按钮 */}
      {(detail.status === 'completed' || detail.deliverables.length > 0) && (
        <div className="flex gap-2">
          <a
            href={getExportUrl(agentName, detail.instance_id, 'html')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-[10px] rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            📄 HTML
          </a>
          <a
            href={getExportUrl(agentName, detail.instance_id, 'excel')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-[10px] rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
          >
            📊 Excel
          </a>
          <a
            href={getExportUrl(agentName, detail.instance_id, 'pdf')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-[10px] rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
          >
            📕 PDF
          </a>
          <a
            href={getExportUrl(agentName, detail.instance_id, 'zip')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-[10px] rounded-md bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 transition-colors"
          >
            📦 ZIP 全包
          </a>
          <a
            href={getExportUrl(agentName, detail.instance_id, 'markdown')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-[10px] rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            📝 MD
          </a>
        </div>
      )}

      {/* 步骤进度 */}
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">步骤进度</p>
        <div className="space-y-1.5">
          {detail.steps.map((step, i) => {
            const ss = getStatusDisplay(step.status)
            return (
              <div key={step.step_id} className="flex items-center gap-2 text-xs">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0"
                  style={{ backgroundColor: `${ss.color}20`, color: ss.color }}
                >
                  {step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : i + 1}
                </span>
                <span className="flex-1 truncate">{step.step_name}</span>
                <span className="text-[10px] shrink-0" style={{ color: ss.color }}>{ss.text}</span>
                {step.elapsed_ms > 0 && (
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {(step.elapsed_ms / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 交付物 */}
      {detail.deliverables.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">交付物</p>
          <div className="space-y-1">
            {detail.deliverables.map((d) => (
              <div key={d.deliverable_id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg bg-card/20">
                <span>{getDeliverableIcon(d.type)}</span>
                <span className="flex-1 truncate">{d.title}</span>
                {d.billable && d.billable_amount > 0 && (
                  <span className="text-primary font-mono text-[10px]">¥{d.billable_amount}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 错误信息 */}
      {detail.error && (
        <div className="text-xs text-red-400 bg-red-500/5 px-3 py-2 rounded-lg">
          {detail.error}
        </div>
      )}

      {/* 总耗时 */}
      {detail.total_elapsed_ms > 0 && (
        <p className="text-[10px] text-muted-foreground">
          总耗时 {(detail.total_elapsed_ms / 1000).toFixed(1)}s ·
          状态 <span style={{ color: s.color }}>{s.text}</span>
        </p>
      )}
    </div>
  )
}

/* ── 交付物行 ────────────────────────────── */

function DeliverableRow({ d }: { d: DeliverableItem }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/20 bg-card/20">
      <span className="text-lg">{getDeliverableIcon(d.type)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{d.title}</p>
        {d.description && (
          <p className="text-[10px] text-muted-foreground truncate">{d.description}</p>
        )}
      </div>
      {d.billable && d.billable_amount > 0 && (
        <span className="text-[10px] text-primary font-mono">¥{d.billable_amount}</span>
      )}
    </div>
  )
}

/* ── 模板图标 ─────────────────────────────── */

const TEMPLATE_ICON: Record<string, string> = {
  // Finance
  auto_voucher: '🧾', batch_voucher: '📋', report_export: '📊',
  period_end_close: '📅', tax_deadline_scan: '🔔', monthly_tax_filing: '🏛️',
  // Legal
  contract_review: '📜', case_analysis: '⚖️', compliance_check: '🛡️',
  compensation_calc: '🧮', litigation_cost: '💰',
  // HR
  onboarding: '🤝', salary_calc: '💵', performance_review: '📈',
  labor_compliance: '⚖️', separation: '📤',
  // Cost
  bill_of_quantities: '📐', cost_estimation: '🏗️', settlement_audit: '🔍',
  change_order: '📝', bid_analysis: '🎯',
  // Invest
  stock_analysis: '📊', industry_research: '🔬', portfolio_review: '💼',
  macro_monitor: '🌍',
  // Pulmonary
  copd_assessment: '🫁', pneumonia_treatment: '💊', pft_interpretation: '📉',
  // Sales
  lead_qualification: '🎯', deal_review: '🤝', quote_generation: '💹',
  // Growth
  campaign_planning: '📣', content_calendar: '📅', ab_test_design: '🧪',
  // CS
  ticket_triage: '🎫', satisfaction_analysis: '⭐', sla_health_check: '⏱️',
  // Insurance
  claims_processing: '📋', policy_renewal: '🔄', compliance_audit: '🛡️',
}
function getTemplateIcon(id: string, deliverableType?: string): string {
  if (TEMPLATE_ICON[id]) return TEMPLATE_ICON[id]
  return getDeliverableIcon(deliverableType || 'document')
}

/* ── 模板卡片 ─────────────────────────────── */

function TemplateCard({ tmpl, onStart, starting, agentName, onRefresh }: {
  tmpl: WorkflowTemplateDef; onStart: () => void; starting: boolean
  agentName: string; onRefresh: () => void
}) {
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
          <p className="text-[10px] text-muted-foreground">
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
          <span key={s.id} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/30 text-muted-foreground">
            {s.name}
          </span>
        ))}
        {tmpl.steps.length > 4 && (
          <span className="text-[10px] text-muted-foreground">+{tmpl.steps.length - 4}</span>
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
            className="px-2 py-1.5 rounded-lg text-[10px] bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900"
            title="全量发布灰度版本"
          >
            全量
          </button>
        )}
        <button
          onClick={async () => { await rollbackTemplate(agentName, tmpl.id); onRefresh() }}
          className="px-2 py-1.5 rounded-lg text-[10px] text-muted-foreground hover:bg-secondary/50"
          title="回滚到上一版本"
        >
          回滚
        </button>
      </div>
    </div>
  )
}

/* ── 空状态 ──────────────────────────────── */

function EmptyState({ onStartChat }: { onStartChat: () => void }) {
  return (
    <div className="text-center py-12 space-y-4">
      <div className="text-5xl">🚀</div>
      <div>
        <p className="text-lg font-semibold text-foreground">还没有工作流</p>
        <p className="text-sm text-muted-foreground mt-1">
          在对话中告诉 AI 你要做什么，它会自动创建工作流并交付结果。
        </p>
        <p className="text-xs text-muted-foreground/60 mt-2 italic">
          "Everybody wants two things: to be richer and lazier."
        </p>
      </div>
      <button
        onClick={onStartChat}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
      >
        💬 开始对话
      </button>
    </div>
  )
}

/* ── 主面板 ──────────────────────────────── */

export default function DashboardPanel({ solution }: Props) {
  const { setActiveTab } = useToolStore()
  const userId = useAuthStore((s) => s.user?.userId) || 'current_user'
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null)
  const [instanceDetail, setInstanceDetail] = useState<WorkflowInstanceDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [templates, setTemplates] = useState<WorkflowTemplateDef[]>([])
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([])
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  const [crossWorkflows, setCrossWorkflows] = useState<CrossAgentWorkflowDef[]>([])
  const [roi, setRoi] = useState<ROISummary | null>(null)
  const [webhooks, setWebhooks] = useState<WebhookDef[]>([])
  const [billing, setBilling] = useState<BillingUsage | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditEntryDef[]>([])
  const [members, setMembers] = useState<RoleMemberDef[]>([])
  const [notifications, setNotifications] = useState<NotificationDef[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [slaDash, setSLADash] = useState<SLADashboardData | null>(null)
  const [mktItems, setMktItems] = useState<MarketplaceCard[]>([])
  const [mktQuery, setMktQuery] = useState('')
  const [anlOverview, setAnlOverview] = useState<AnalyticsOverview | null>(null)
  const [anlRecs, setAnlRecs] = useState<AnalyticsRecommendation[]>([])
  const [roiPred, setRoiPred] = useState<ROIPredictionData | null>(null)
  const [decidingApproval, setDecidingApproval] = useState<string | null>(null)
  const [startingCross, setStartingCross] = useState<string | null>(null)
  const [startingTemplate, setStartingTemplate] = useState<string | null>(null)

  const [wsConnected, setWsConnected] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const agentName = solution.agents[0]?.id?.split('.')[0] || solution.id

  const loadDashboard = useCallback(async () => {
    const data = await fetchDashboard(agentName, userId)
    if (data) {
      setDashboard(data)
      setLoading(false)
    }
  }, [agentName, userId])

  // WS 事件回调 — 收到 workflow.* 事件时刷新 dashboard
  const handleWorkflowEvent = useCallback((event: WorkflowEvent) => {
    loadDashboard()
    if (event.type === 'workflow.approval_requested' || event.type === 'workflow.approval_resolved') {
      fetchPendingApprovals(agentName).then(setApprovals)
    }
    if (event.data.instance_id === selectedInstanceId) {
      fetchInstance(agentName, event.data.instance_id!).then((detail) => {
        if (detail) setInstanceDetail(detail)
      })
    }
  }, [loadDashboard, agentName, selectedInstanceId])

  // WebSocket 实时推送（优先通道）
  useWorkflowEvents({
    agentName,
    userId,
    enabled: true,
    onEvent: handleWorkflowEvent,
    onConnectionChange: setWsConnected,
  })

  // 首次加载
  useEffect(() => {
    setLoading(true)
    loadDashboard()
    fetchTemplates(agentName).then(setTemplates)
    fetchSchedules(agentName).then(setSchedules)
    fetchPendingApprovals(agentName).then(setApprovals)
    fetchCrossAgentWorkflows(agentName).then(setCrossWorkflows)
    fetchROI(agentName).then(setRoi)
    fetchWebhooks(agentName).then(setWebhooks)
    fetchBillingUsage(agentName, userId).then(setBilling)
    fetchAuditLogs(agentName, userId, 10).then(setAuditLogs)
    fetchMembers(agentName, userId).then(setMembers)
    fetchSLADashboard(agentName).then(setSLADash)
    searchMarketplace(agentName, '', '', 'popular', 8).then((r) => { if (r) setMktItems(r.items) })
    fetchAnalyticsOverview(agentName).then(setAnlOverview)
    fetchRecommendations(agentName, 4).then(setAnlRecs)
    fetchROIPrediction(agentName).then(setRoiPred)
    fetchNotifications(agentName, userId, 15).then((data) => {
      setNotifications(data.notifications)
      setUnreadCount(data.unread)
    })
  }, [loadDashboard, agentName, userId])

  // polling 降级：WS 未连接且有活跃工作流时才轮询
  useEffect(() => {
    const needPoll = !wsConnected && dashboard && dashboard.summary.active > 0
    if (needPoll) {
      pollRef.current = setInterval(loadDashboard, POLL_INTERVAL)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [wsConnected, dashboard?.summary.active, loadDashboard])

  // 选中实例时加载详情
  useEffect(() => {
    if (!selectedInstanceId) {
      setInstanceDetail(null)
      return
    }
    let cancelled = false
    async function load() {
      setDetailLoading(true)
      const detail = await fetchInstance(agentName, selectedInstanceId!)
      if (!cancelled) {
        setInstanceDetail(detail)
        setDetailLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [agentName, selectedInstanceId])

  const toggleInstance = (id: string) => {
    setSelectedInstanceId((prev) => (prev === id ? null : id))
  }

  const handleApproval = async (a: PendingApproval, approved: boolean) => {
    const key = `${a.instance_id}/${a.step_id}`
    setDecidingApproval(key)
    const ok = await approveStep(agentName, a.instance_id, a.step_id, approved, 'current_user')
    setDecidingApproval(null)
    if (ok) {
      fetchPendingApprovals(agentName).then(setApprovals)
      loadDashboard()
    }
  }

  const handleStartCrossAgent = async (wf: CrossAgentWorkflowDef) => {
    const key = `${wf.solution_id}/${wf.id}`
    setStartingCross(key)
    const result = await executeCrossAgentWorkflow(
      agentName, wf.solution_id, wf.id, 'current_user',
    )
    setStartingCross(null)
    if (result) {
      await loadDashboard()
      setSelectedInstanceId(result.instance_id)
    }
  }

  const handleStartTemplate = async (tmplId: string) => {
    setStartingTemplate(tmplId)
    const result = await startFromTemplate(agentName, tmplId, {
      user_id: 'current_user',
      solution_id: agentName,
    })
    setStartingTemplate(null)
    if (result) {
      await loadDashboard()
      setSelectedInstanceId(result.instance_id)
    }
  }

  const hasAnyWorkflow = dashboard && dashboard.data_flywheel.total_instances > 0

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* 方案头部 */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{solution.name}</h2>
          <p className="text-muted-foreground mt-1">{solution.tagline}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground/60 italic">
              Richer &amp; Lazier — AI 专家替你干活，按效果付费
            </p>
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${wsConnected ? 'bg-green-400' : 'bg-zinc-400'}`}
              title={wsConnected ? '实时连接' : '轮询模式'}
            />
          </div>
        </div>

        {/* 通知铃铛 */}
        <div className="flex items-center justify-end -mb-2">
          <button
            onClick={() => setShowNotifPanel(!showNotifPanel)}
            className="relative p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="通知"
          >
            <span className="text-lg">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* 通知面板 */}
        {showNotifPanel && (
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-semibold">通知 {unreadCount > 0 && `(${unreadCount})`}</h3>
              {unreadCount > 0 && (
                <button
                  onClick={async () => {
                    await markAllRead(agentName, userId)
                    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
                    setUnreadCount(0)
                  }}
                  className="text-xs text-blue-500 hover:text-blue-600"
                >
                  全部已读
                </button>
              )}
            </div>
            <div className="max-h-[320px] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-700">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">暂无通知</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.notification_id}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors ${!n.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                    onClick={async () => {
                      if (!n.read) {
                        await markNotificationRead(agentName, n.notification_id)
                        setNotifications((prev) =>
                          prev.map((x) => x.notification_id === n.notification_id ? { ...x, read: true } : x)
                        )
                        setUnreadCount((c) => Math.max(0, c - 1))
                      }
                    }}
                  >
                    <NotifIcon type={n.type} priority={n.priority} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.read ? 'font-semibold' : 'font-medium'} truncate`}>{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.body}</p>}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                      {new Date(n.created_at).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* WorkflowOS 仪表盘 */}
        {dashboard && hasAnyWorkflow && (
          <>
            {/* ROI 标语 */}
            {(roi?.total_workflows_completed ?? 0) > 0 && (
              <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4">
                <p className="text-lg font-semibold text-foreground">
                  {roi?.headline || 'AI 效率飞轮正在加速'}
                </p>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                  <span>
                    <span className="text-primary font-bold text-base">{roi!.total_human_hours_saved}</span> 小时节省
                  </span>
                  <span>
                    <span className="text-green-500 font-bold text-base">¥{roi!.total_cost_saved_yuan.toLocaleString()}</span> 成本节省
                  </span>
                  <span>
                    <span className="text-amber-500 font-bold text-base">{roi!.avg_acceleration_ratio}x</span> 加速比
                  </span>
                  <span>
                    <span className="text-purple-500 font-bold text-base">{roi!.total_workflows_completed}</span> 个工作流
                  </span>
                </div>
              </div>
            )}

            {/* 统计卡片 */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                工作流概览
              </h3>
              <div className="grid gap-3 sm:grid-cols-4">
                <StatCard label="进行中" value={dashboard.summary.active} icon="🔄" accent="#3b82f6" />
                <StatCard label="今日完成" value={dashboard.summary.completed_today} icon="✅" accent="#22c55e" />
                <StatCard label="节省工时" value={dashboard.data_flywheel.total_hours_saved || 0} icon="⏱️" accent="#f59e0b" suffix="h" />
                <StatCard label="待审批" value={dashboard.summary.pending_approval} icon="🛡️" accent="#f97316" />
              </div>
            </div>

            {/* 用量与套餐 */}
            {billing && (
              <div className="bg-white dark:bg-neutral-800 rounded-xl p-5 border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {billing.plan_name}
                  </h3>
                  {billing.price_yuan > 0 && (
                    <span className="text-xs text-neutral-500">
                      ¥{billing.price_yuan}/月
                    </span>
                  )}
                </div>
                <UsageBar
                  label="工作流"
                  used={billing.usage.workflows}
                  limit={billing.limits.workflows}
                  percent={billing.usage_percent.workflows}
                />
                <UsageBar
                  label="交付物"
                  used={billing.usage.deliverables}
                  limit={billing.limits.deliverables}
                  percent={billing.usage_percent.deliverables}
                />
                {billing.usage.billable_total > 0 && (
                  <div className="mt-2 text-xs text-neutral-500">
                    本月计费: ¥{billing.usage.billable_total.toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {/* SLA 监控 */}
            {slaDash && slaDash.active_trackers > 0 && (
              <div className="bg-white dark:bg-neutral-800 rounded-xl p-5 border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    SLA 监控
                  </h3>
                  <div className="flex items-center gap-2 text-xs">
                    {slaDash.health.green > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{slaDash.health.green}</span>}
                    {slaDash.health.yellow > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{slaDash.health.yellow}</span>}
                    {slaDash.health.red > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{slaDash.health.red}</span>}
                    {slaDash.health.black > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neutral-900 dark:bg-neutral-400" />{slaDash.health.black}</span>}
                  </div>
                </div>
                {slaDash.active_breaches > 0 && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs">
                    {slaDash.active_breaches} 个步骤超时
                  </div>
                )}
                <div className="space-y-2">
                  {slaDash.trackers.slice(0, 5).map((t) => (
                    <div key={`${t.instance_id}-${t.step_id}`} className="flex items-center gap-3 text-xs">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        t.health === 'green' ? 'bg-emerald-500' :
                        t.health === 'yellow' ? 'bg-amber-500' :
                        t.health === 'red' ? 'bg-red-500' : 'bg-neutral-900 dark:bg-neutral-400'
                      }`} />
                      <span className="truncate flex-1 text-neutral-700 dark:text-neutral-300">{t.step_id}</span>
                      <span className="text-muted-foreground shrink-0">
                        {t.elapsed_minutes.toFixed(0)}m / {t.deadline_minutes}m
                      </span>
                      {t.circuit_broken && <span className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-[9px]">熔断</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 工作流市场 */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl p-5 border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  工作流市场
                </h3>
                <input
                  className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 bg-transparent w-36"
                  placeholder="搜索模板..."
                  value={mktQuery}
                  onChange={(e) => {
                    setMktQuery(e.target.value)
                    searchMarketplace(agentName, e.target.value, '', 'popular', 8).then((r) => { if (r) setMktItems(r.items) })
                  }}
                />
              </div>
              {mktItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无模板</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {mktItems.map((item) => (
                    <div key={item.listing_id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{item.icon || '\u{1F4CB}'}</span>
                        <span className="text-xs font-medium truncate flex-1">{item.title}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2">{item.description}</p>
                      <div className="flex items-center justify-between mt-auto pt-1">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{item.avg_rating > 0 ? `${'★'.repeat(Math.round(item.avg_rating))} ${item.avg_rating}` : '暂无评分'}</span>
                          <span>{item.install_count} 次安装</span>
                        </div>
                        <button
                          className="text-[10px] px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                          onClick={async () => {
                            const ok = await installFromMarketplace(agentName, item.listing_id)
                            if (ok) alert('安装成功')
                          }}
                        >
                          安装
                        </button>
                      </div>
                      {item.is_fork && <span className="text-[9px] text-amber-600 dark:text-amber-400">Fork</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 智能分析 */}
            {anlOverview && anlOverview.total_executions > 0 && (
              <div className="bg-white dark:bg-neutral-800 rounded-xl p-5 border border-neutral-200 dark:border-neutral-700">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                  工作流分析
                </h3>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  {[
                    { label: '执行', value: anlOverview.total_executions },
                    { label: '成功率', value: `${(anlOverview.success_rate * 100).toFixed(0)}%` },
                    { label: '活跃流程', value: anlOverview.active_workflows },
                    { label: 'ROI', value: `¥${anlOverview.total_roi_saved.toLocaleString()}` },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{s.value}</div>
                      <div className="text-[10px] text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* ROI 预测 */}
                {roiPred && roiPred.predicted_next_month > 0 && (
                  <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-800 dark:text-emerald-300 mb-3">
                    <span className="font-medium">ROI 预测</span>：下月 ¥{roiPred.predicted_next_month.toLocaleString()}
                    {roiPred.growth_rate !== 0 && (
                      <span className={roiPred.growth_rate > 0 ? 'text-emerald-600' : 'text-red-500'}>
                        {' '}({roiPred.growth_rate > 0 ? '+' : ''}{(roiPred.growth_rate * 100).toFixed(0)}%)
                      </span>
                    )}
                    <span className="text-muted-foreground ml-1">置信度 {(roiPred.confidence * 100).toFixed(0)}%</span>
                  </div>
                )}

                {/* 推荐 */}
                {anlRecs.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300">智能推荐</div>
                    {anlRecs.map((r) => (
                      <div key={r.rec_id} className="flex items-start gap-2 text-xs">
                        <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${
                          r.impact === 'high' ? 'bg-red-500' : r.impact === 'medium' ? 'bg-amber-500' : 'bg-blue-400'
                        }`} />
                        <div>
                          <div className="font-medium text-neutral-800 dark:text-neutral-200">{r.title}</div>
                          <div className="text-muted-foreground">{r.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 审批中心 */}
            {approvals.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-amber-500 uppercase tracking-wider mb-3">
                  ⚠ 待审批 ({approvals.length})
                </h3>
                <div className="space-y-2">
                  {approvals.map((a) => {
                    const key = `${a.instance_id}/${a.step_id}`
                    const deciding = decidingApproval === key
                    return (
                      <div
                        key={key}
                        className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">🔐</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{a.workflow_name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              步骤「{a.step_name}」需要您的审批确认
                            </p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">
                              {a.created_at && new Date(a.created_at).toLocaleString('zh-CN')}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleApproval(a, true)}
                            disabled={deciding}
                            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                          >
                            {deciding ? '处理中...' : '✓ 批准执行'}
                          </button>
                          <button
                            onClick={() => handleApproval(a, false)}
                            disabled={deciding}
                            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/80 text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                          >
                            {deciding ? '处理中...' : '✕ 驳回'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 活跃工作流 */}
            {dashboard.active_instances.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    活跃工作流
                  </h3>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                </div>
                <div className="space-y-2">
                  {dashboard.active_instances.map((inst) => (
                    <div key={inst.instance_id}>
                      <InstanceRow
                        inst={inst}
                        isSelected={selectedInstanceId === inst.instance_id}
                        onClick={() => toggleInstance(inst.instance_id)}
                      />
                      {selectedInstanceId === inst.instance_id && (
                        <InstanceDetail detail={instanceDetail} loading={detailLoading} agentName={agentName} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 最近完成 */}
            {dashboard.recent_completed.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  最近完成
                </h3>
                <div className="space-y-2">
                  {dashboard.recent_completed.slice(0, 5).map((inst) => (
                    <div key={inst.instance_id}>
                      <InstanceRow
                        inst={inst}
                        isSelected={selectedInstanceId === inst.instance_id}
                        onClick={() => toggleInstance(inst.instance_id)}
                      />
                      {selectedInstanceId === inst.instance_id && (
                        <InstanceDetail detail={instanceDetail} loading={detailLoading} agentName={agentName} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 最近交付物 */}
            {dashboard.recent_deliverables.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  最近交付物
                </h3>
                <div className="space-y-1.5">
                  {dashboard.recent_deliverables.map((d) => (
                    <DeliverableRow key={d.deliverable_id} d={d} />
                  ))}
                </div>
              </div>
            )}

            {/* 数据飞轮 */}
            {dashboard.data_flywheel.total_instances > 0 && (
              <div className="px-4 py-3 rounded-xl border border-primary/10 bg-primary/5">
                <p className="text-xs font-semibold text-primary mb-1">数据飞轮</p>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span>{dashboard.data_flywheel.total_instances} 个工作流</span>
                  <span>·</span>
                  <span>{dashboard.data_flywheel.total_deliverables} 个交付物</span>
                  <span>·</span>
                  <span>{dashboard.data_flywheel.total_steps_executed} 步操作</span>
                  {dashboard.data_flywheel.avg_completion_ms > 0 && (
                    <>
                      <span>·</span>
                      <span>平均 {(dashboard.data_flywheel.avg_completion_ms / 1000).toFixed(1)}s/流程</span>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  每个工作流的数据沉淀让 AI 越来越懂你的业务。
                </p>
              </div>
            )}
          </>
        )}

        {/* 定时工作流 */}
        {schedules.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              定时工作流 <span className="text-xs font-normal">— AI 主动替你干活</span>
            </h3>
            <div className="space-y-1.5">
              {schedules.map((s) => (
                <div
                  key={s.template_id}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/20 bg-card/20"
                >
                  <span className="text-lg">{getTemplateIcon(s.template_id)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.schedule_description || s.schedule}
                    </p>
                  </div>
                  {s.next_run && (
                    <span className="text-[10px] text-primary font-mono shrink-0">
                      下次 {new Date(s.next_run).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 跨 Agent 工作流 */}
        {crossWorkflows.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              跨 Agent 编排 <span className="text-xs font-normal">— 多 Agent 协作完成复杂任务</span>
            </h3>
            <div className="grid gap-2">
              {crossWorkflows.map((wf) => {
                const key = `${wf.solution_id}/${wf.id}`
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
                  >
                    <span className="text-lg">🌐</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{wf.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {wf.description || `${wf.mode} · ${wf.steps.length} 步`}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {[...new Set(wf.steps.map((s) => s.agent))].map((a) => (
                          <span key={a} className="px-1.5 py-0.5 text-[9px] rounded bg-secondary text-secondary-foreground">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => handleStartCrossAgent(wf)}
                      disabled={startingCross === key}
                      className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shrink-0"
                    >
                      {startingCross === key ? '启动中…' : '启动'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ROI 方案分布 */}
        {roi && Object.keys(roi.solution_breakdown).length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              效率飞轮 · 方案 ROI 分布
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(roi.solution_breakdown).map(([sid, data]) => (
                <div key={sid} className="rounded-lg border border-border/40 bg-card/50 p-3">
                  <p className="text-sm font-medium truncate">{sid}</p>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      <span className="text-primary font-semibold">{data.workflows}</span> 个工作流
                    </span>
                    <span className="text-xs text-muted-foreground">
                      省 <span className="text-green-500 font-semibold">{data.hours_saved}h</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ¥<span className="text-amber-500 font-semibold">{data.cost_saved.toLocaleString()}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Webhook 触发器 */}
        {webhooks.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Webhook 触发器 <span className="text-xs font-normal">— 外部系统自动启动工作流</span>
            </h3>
            <div className="grid gap-2">
              {webhooks.map((wh) => (
                <div
                  key={wh.hook_id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/40 bg-card/50"
                >
                  <span className="text-lg">{wh.enabled ? '🔗' : '🔒'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{wh.name}</p>
                      {wh.source && (
                        <span className="px-1.5 py-0.5 text-[9px] rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                          {wh.source}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {wh.endpoint} → {wh.template_id}
                      {wh.trigger_count > 0 && ` · 已触发 ${wh.trigger_count} 次`}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm(`确认删除 Webhook "${wh.name}"？`)) {
                        await deleteWebhook(agentName, wh.hook_id)
                        setWebhooks((prev) => prev.filter((h) => h.hook_id !== wh.hook_id))
                      }
                    }}
                    className="px-2 py-1 text-[10px] rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950 shrink-0"
                    title="删除"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 审计日志流 */}
        {auditLogs.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              审计日志 <span className="text-xs font-normal">— 操作追溯</span>
            </h3>
            <div className="space-y-1">
              {auditLogs.map((log) => (
                <div
                  key={log.entry_id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/30 bg-card/30 text-xs"
                >
                  <AuditIcon action={log.action} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{log.description || log.action}</span>
                    <span className="text-muted-foreground ml-2">
                      {log.actor_id} · {log.resource_type}/{log.resource_id.slice(0, 12)}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(log.timestamp).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 成员角色 */}
        {members.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              团队成员 <span className="text-xs font-normal">— 角色权限</span>
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {members.map((m) => (
                <div
                  key={m.assignment_id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/40 bg-card/50"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                    {m.user_id.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.user_id}</p>
                    <p className="text-[10px] text-muted-foreground">{m.permissions.length} 项权限</p>
                  </div>
                  <RoleBadge role={m.role} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 工作流目录（模板商店） */}
        {templates.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {hasAnyWorkflow ? 'AI 可以帮你做' : '选择一个工作流，AI 自动完成并交付结果'}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((tmpl) => (
                <TemplateCard
                  key={tmpl.id}
                  tmpl={tmpl}
                  onStart={() => handleStartTemplate(tmpl.id)}
                  starting={startingTemplate === tmpl.id}
                  agentName={agentName}
                  onRefresh={loadDashboard}
                />
              ))}
            </div>
          </div>
        )}

        {/* 空状态（无模板也无工作流时显示） */}
        {dashboard && !hasAnyWorkflow && templates.length === 0 && (
          <EmptyState onStartChat={() => setActiveTab('chat')} />
        )}

        {/* 加载中 */}
        {loading && !dashboard && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            加载工作流数据...
          </div>
        )}

        {/* 利润指标 */}
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

        {/* AI 专家状态 */}
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

        {/* 快捷场景 */}
        {solution.scenarios.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              快捷场景
            </h3>
            <div className="flex flex-wrap gap-2">
              {solution.scenarios.slice(0, 6).map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => setActiveTab('workflows')}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all text-sm"
                >
                  <span>{sc.icon}</span>
                  <span>{sc.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
