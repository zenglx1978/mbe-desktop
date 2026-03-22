import { useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { useToolStore } from '@/stores/tool-store'
import { initConnectivityMonitor } from '@/stores/connectivity-store'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'
import { useLocalFeedbackStore, startFeedbackSync } from '@/stores/local-feedback-store'
import { useSmartCacheStore } from '@/stores/smart-cache-store'
import { useCloudSyncStore, startCloudSync } from '@/stores/cloud-sync-store'
import { applySolutionTheme, fetchSolutionStatuses, getEffectiveStatus, type WorkbenchTab } from '@/lib/solution-router'
import { API_BASE, authHeaders } from '@/lib/api-client'
import { getSolutionIcon } from '@/lib/solution-icons'
import Sidebar from '@/components/Sidebar'
import ChatPanel from '@/components/ChatPanel'
import ConnectivityBadge from '@/components/ConnectivityBadge'
import ToastContainer from '@/components/ToastContainer'
import UpdateBanner from '@/components/UpdateBanner'
import WorkbenchTabs from '@/components/workbench/WorkbenchTabs'
import ToolPanel from '@/components/workbench/ToolPanel'
import DocumentsPanel from '@/components/workbench/DocumentsPanel'
import TasksPanel from '@/components/workbench/TasksPanel'
import DashboardPanel from '@/components/workbench/DashboardPanel'
import WorkflowPanel from '@/components/workbench/WorkflowPanel'
import ApprovalPanel from '@/components/workbench/ApprovalPanel'
import CostPanel from '@/components/workbench/CostPanel'
import SchedulerPanel from '@/components/workbench/SchedulerPanel'
import DesignerPanel from '@/components/workbench/DesignerPanel'
import EfficiencyPanel from '@/components/workbench/EfficiencyPanel'
import ClientChatPanel from '@/components/workbench/ClientChatPanel'
import ROIPanel from '@/components/workbench/ROIPanel'
import ScoutPanel from '@/components/workbench/ScoutPanel'
import AccountPanel from '@/components/workbench/AccountPanel'
import AutomationPanel from '@/components/workbench/AutomationPanel'
import NotificationBell from '@/components/NotificationBell'
import OfflineBanner from '@/components/OfflineBanner'
import { startApprovalPolling } from '@/stores/approval-store'
import { useApprovalNotifications } from '@/hooks/useApprovalNotifications'

let connectivityInitialized = false
let clientIntelInitialized = false

export default function Workspace() {
  const navigate = useNavigate()
  const { currentSolution, hasPickedSolution, sidebarExpanded } = useAppStore()
  const { activeTab, setActiveTab } = useToolStore()
  const solution = currentSolution()

  const switchToApprovalTab = useCallback(() => setActiveTab('approvals'), [setActiveTab])
  useApprovalNotifications(switchToApprovalTab)

  useEffect(() => {
    if (!hasPickedSolution) {
      navigate('/pick', { replace: true })
    }
    if (!connectivityInitialized) {
      initConnectivityMonitor()
      connectivityInitialized = true
    }
    if (!clientIntelInitialized) {
      useLocalFeedbackStore.getState().loadScores()
      clientIntelInitialized = true
    }
  }, [hasPickedSolution])

  useEffect(() => {
    if (!solution) return
    fetchSolutionStatuses().then(() => {
      if (getEffectiveStatus(solution.id) !== 'available') {
        navigate('/pick', { replace: true })
      }
    })
  }, [solution?.id])

  useEffect(() => {
    if (!solution) return
    useAdaptiveUIStore.getState().loadPreferences(solution.id)
    useLocalFeedbackStore.getState().computeScores(solution.id)
    useSmartCacheStore.getState().prune(500)
    // Phase 10: 定时将本地反馈同步到服务端 HOPE 学习系统
    const stopFeedback = startFeedbackSync(solution.id)
    // Phase 10.4: 云端配置快照拉取 → 应用到本地 Store
    useCloudSyncStore.getState().loadCachedSnapshot(solution.id).then(() => {
      useCloudSyncStore.getState().applySnapshot(solution.id)
    })
    const stopCloud = startCloudSync(solution.id)
    const stopApprovals = startApprovalPolling()
    return () => {
      stopFeedback()
      stopCloud()
      stopApprovals()
    }
  }, [solution?.id])

  useEffect(() => {
    if (!solution) return
    return applySolutionTheme(solution.id)
  }, [solution?.id])

  // WorkflowMiner: 从后端加载 Solution miner_patterns 并注册到本地 PatternRecognizer
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.pattern?.registerSolutionPatterns) return
    fetch(`${API_BASE}/api/v1/solutions/miner/patterns`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.patterns?.length) {
          api.pattern.registerSolutionPatterns(data.patterns)
        }
      })
      .catch(() => { /* 非关键后台任务，静默降级 */ })
  }, [solution?.id])

  const allTabs = useMemo(() => {
    if (!solution) return [] as WorkbenchTab[]
    const tabs = [...solution.enabledTabs]
    if (!tabs.includes('approvals')) tabs.push('approvals' as (typeof tabs)[number])
    if (!tabs.includes('costs')) tabs.push('costs' as (typeof tabs)[number])
    if (!tabs.includes('efficiency')) tabs.push('efficiency' as (typeof tabs)[number])
    if (!tabs.includes('automation')) tabs.push('automation' as (typeof tabs)[number])
    if (!tabs.includes('clients')) tabs.push('clients' as (typeof tabs)[number])
    if (!tabs.includes('roi')) tabs.push('roi' as (typeof tabs)[number])
    if (!tabs.includes('scout')) tabs.push('scout' as (typeof tabs)[number])
    if (!tabs.includes('account')) tabs.push('account' as (typeof tabs)[number])
    return tabs
  }, [solution])

  const SolutionIcon = useMemo(
    () => (solution ? getSolutionIcon(solution.id) : getSolutionIcon('')),
    [solution?.id],
  )

  if (!solution) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 mx-auto rounded-full bg-secondary flex items-center justify-center">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">尚未选择方案</h2>
          <p className="text-sm text-muted-foreground">请先选择一个行业解决方案</p>
          <button
            onClick={() => navigate('/pick', { replace: true })}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity"
          >
            选择方案
          </button>
        </div>
      </div>
    )
  }

  const showTabs = allTabs.length > 1

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <UpdateBanner />
      <Sidebar />
      <main
        id="main-content"
        role="main"
        aria-label={solution.name}
        className={`flex-1 flex flex-col transition-all duration-200 ${sidebarExpanded ? 'ml-64' : 'ml-16'}`}
      >
        <OfflineBanner />
        {/* 顶部栏 */}
        <header className="h-12 border-b border-border/50 flex items-center px-4 shrink-0" role="banner">
          <div className="flex items-center gap-2 shrink-0">
            <SolutionIcon className="w-5 h-5 text-primary" />
            <span className="font-medium text-sm hidden sm:inline">{solution.name}</span>
          </div>

          {/* Tab 栏 — 窄屏可横向滚动 */}
          {showTabs && (
            <div className="ml-4 sm:ml-6 flex-1 min-w-0 overflow-x-auto scrollbar-none">
              <WorkbenchTabs
                activeTab={activeTab}
                enabledTabs={allTabs}
                color={solution.color}
                onTabChange={setActiveTab}
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <ConnectivityBadge />
          </div>
        </header>

        {/* 内容区 — 根据 activeTab 切换 */}
        <ActivePanel tab={activeTab} />
      </main>
      <ToastContainer />
    </div>
  )
}

function ActivePanel({ tab }: { tab: string }) {
  const { currentSolution } = useAppStore()
  const solution = currentSolution()
  if (!solution) return null

  switch (tab) {
    case 'chat':
      return <ChatPanel />
    case 'tools':
      return <ToolPanel solution={solution} />
    case 'documents':
      return <DocumentsPanel solution={solution} />
    case 'tasks':
      return <TasksPanel solution={solution} />
    case 'dashboard':
      return <DashboardPanel solution={solution} />
    case 'workflows':
      return <WorkflowPanel solution={solution} />
    case 'approvals':
      return <ApprovalPanel />
    case 'costs':
      return <CostPanel solution={solution} />
    case 'scheduler':
      return <SchedulerPanel solution={solution} />
    case 'designer':
      return <DesignerPanel solution={solution} />
    case 'efficiency':
      return <EfficiencyPanel />
    case 'automation':
      return <AutomationPanel />
    case 'clients':
      return <ClientChatPanel />
    case 'roi':
      return <ROIPanel />
    case 'scout':
      return <ScoutPanel />
    case 'account':
      return <AccountPanel />
    default:
      return <ChatPanel />
  }
}

