import { useState, useEffect, useCallback, useRef } from 'react'
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling'
import { isAbortError } from '@/lib/chat-service'
import { useToolStore } from '@/stores/tool-store'
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
  fetchROI,
  fetchWebhooks,
  fetchBillingUsage,
  fetchAuditLogs,
  fetchMembers,
  fetchNotifications,
  fetchSLADashboard,
  searchMarketplace,
  fetchAnalyticsOverview,
  fetchRecommendations,
  fetchROIPrediction,
  type DashboardData,
  type WorkflowInstanceDetail,
  type WorkflowTemplateDef,
  type ScheduleEntry,
  type PendingApproval,
  type CrossAgentWorkflowDef,
  type WebhookDef,
  type BillingUsage,
  type AuditEntryDef,
  type RoleMemberDef,
  type NotificationDef,
  type MarketplaceCard,
  type AnalyticsOverview,
  type AnalyticsRecommendation,
  type ROIPredictionData,
  type ROISummary,
  type SLADashboardData,
} from '@/lib/workflow-os-service'
import { useWorkflowEvents, type WorkflowEvent } from '@/hooks/useWorkflowEvents'
import { DashboardNotifications } from './DashboardNotifications'
import { DashboardStatCards } from './DashboardStatCards'
import { DashboardCharts } from './DashboardCharts'
import { DashboardWorkflowInstances } from './DashboardWorkflowInstances'
import { DashboardExtendedSections } from './DashboardExtendedSections'
import { DashboardTimeline } from './DashboardTimeline'
import { DashboardCatalogFooter } from './DashboardCatalogFooter'
import BrandReportsPanel from './BrandReportsPanel'
import { DashboardBrandCharts } from './BrandCharts'

interface Props {
  solution: SolutionConfig
}

const POLL_INTERVAL = 5000

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
  const dashboardFetchRef = useRef<AbortController | null>(null)

  const agentName = solution.agents[0]?.id?.split('.')[0] || solution.id

  const loadDashboard = useCallback(async () => {
    dashboardFetchRef.current?.abort()
    const ac = new AbortController()
    dashboardFetchRef.current = ac
    try {
      const data = await fetchDashboard(agentName, userId, ac.signal)
      if (ac.signal.aborted) return
      if (data) {
        setDashboard(data)
        setLoading(false)
      }
    } catch (e) {
      if (isAbortError(e)) return
    }
  }, [agentName, userId])

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

  useWorkflowEvents({
    agentName,
    userId,
    enabled: true,
    onEvent: handleWorkflowEvent,
    onConnectionChange: setWsConnected,
  })

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

  useEffect(() => () => {
    dashboardFetchRef.current?.abort()
  }, [])

  const needPoll = !wsConnected && !!dashboard && dashboard.summary.active > 0
  useVisibilityPolling(loadDashboard, POLL_INTERVAL, needPoll)

  useEffect(() => {
    if (!selectedInstanceId) {
      setInstanceDetail(null)
      return
    }
    const ac = new AbortController()
    async function load() {
      setDetailLoading(true)
      try {
        const detail = await fetchInstance(agentName, selectedInstanceId!, ac.signal)
        if (ac.signal.aborted) return
        setInstanceDetail(detail)
      } catch (e) {
        if (!isAbortError(e)) setInstanceDetail(null)
      } finally {
        if (!ac.signal.aborted) setDetailLoading(false)
      }
    }
    load()
    return () => ac.abort()
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
      setSelectedInstanceId(result.instance_id ?? null)
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
      setSelectedInstanceId(result.instance_id ?? null)
    }
  }

  const handleMarketplaceSearch = useCallback((query: string) => {
    searchMarketplace(agentName, query, '', 'popular', 8).then((r) => { if (r) setMktItems(r.items) })
  }, [agentName])

  const hasAnyWorkflow = dashboard ? dashboard.data_flywheel.total_instances > 0 : false

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{solution.name}</h2>
          <p className="text-muted-foreground mt-1">{solution.tagline}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground/60 italic">
              Richer &amp; Lazier — AI 专家替你干活，按效果付费
            </p>
            {/* P2-9: WebSocket graceful fallback — 断线时静默降级到轮询，不显示错误 */}
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${wsConnected ? 'bg-green-400' : 'bg-zinc-400 animate-pulse'}`}
              title={wsConnected ? '实时连接' : '自动刷新模式（每 5 秒）'}
            />
          </div>
        </div>

        <DashboardNotifications
          agentName={agentName}
          userId={userId}
          showNotifPanel={showNotifPanel}
          unreadCount={unreadCount}
          notifications={notifications}
          onTogglePanel={() => setShowNotifPanel(!showNotifPanel)}
          onNotificationsChange={setNotifications}
          onUnreadCountChange={setUnreadCount}
        />

        {dashboard && hasAnyWorkflow && (
          <>
            <DashboardStatCards dashboard={dashboard} roi={roi} billing={billing} slaDash={slaDash} />
            {solution.id === 'ecommerce-brand-service' && (
              <>
                <DashboardBrandCharts brandId={null} />
                <BrandReportsPanel color={solution.color} />
              </>
            )}
            <DashboardCharts
              agentName={agentName}
              mktQuery={mktQuery}
              mktItems={mktItems}
              onMktQueryChange={setMktQuery}
              onMarketplaceSearch={handleMarketplaceSearch}
              anlOverview={anlOverview}
              anlRecs={anlRecs}
              roiPred={roiPred}
            />
            <DashboardWorkflowInstances
              dashboard={dashboard}
              agentName={agentName}
              approvals={approvals}
              decidingApproval={decidingApproval}
              onApproval={handleApproval}
              selectedInstanceId={selectedInstanceId}
              instanceDetail={instanceDetail}
              detailLoading={detailLoading}
              onToggleInstance={toggleInstance}
            />
          </>
        )}

        <DashboardExtendedSections
          schedules={schedules}
          crossWorkflows={crossWorkflows}
          agentName={agentName}
          startingCross={startingCross}
          onStartCrossAgent={handleStartCrossAgent}
          roi={roi}
          webhooks={webhooks}
          setWebhooks={setWebhooks}
        />

        <DashboardTimeline auditLogs={auditLogs} members={members} />

        <DashboardCatalogFooter
          solution={solution}
          hasAnyWorkflow={hasAnyWorkflow}
          templates={templates}
          dashboardLoaded={!!dashboard}
          loading={loading}
          startingTemplate={startingTemplate}
          agentName={agentName}
          onStartTemplate={handleStartTemplate}
          onRefreshDashboard={loadDashboard}
          onStartChat={() => setActiveTab('chat')}
          onOpenWorkflows={() => setActiveTab('workflows')}
        />
      </div>
    </div>
  )
}
