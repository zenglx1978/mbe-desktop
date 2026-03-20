import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { useToolStore } from '@/stores/tool-store'
import { initConnectivityMonitor } from '@/stores/connectivity-store'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'
import { useLocalFeedbackStore, startFeedbackSync } from '@/stores/local-feedback-store'
import { useSmartCacheStore } from '@/stores/smart-cache-store'
import { useCloudSyncStore, startCloudSync } from '@/stores/cloud-sync-store'
import { applySolutionTheme, fetchSolutionStatuses, getEffectiveStatus } from '@/lib/solution-router'
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
import AccountPanel from '@/components/workbench/AccountPanel'
import NotificationBell from '@/components/NotificationBell'
import { startApprovalPolling, stopApprovalPolling } from '@/stores/approval-store'
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

  if (!solution) return null

  const SolutionIcon = getSolutionIcon(solution.id)
  const allTabs = [...solution.enabledTabs]
  if (!allTabs.includes('approvals')) allTabs.push('approvals' as const)
  if (!allTabs.includes('costs')) allTabs.push('costs' as const)
  if (!allTabs.includes('efficiency')) allTabs.push('efficiency' as const)
  if (!allTabs.includes('clients')) allTabs.push('clients' as const)
  if (!allTabs.includes('roi')) allTabs.push('roi' as const)
  if (!allTabs.includes('account')) allTabs.push('account' as const)
  const showTabs = allTabs.length > 1

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <UpdateBanner />
      <Sidebar />
      <main className={`flex-1 flex flex-col transition-all duration-200 ${sidebarExpanded ? 'ml-64' : 'ml-16'}`}>
        {/* 顶部栏 */}
        <header className="h-12 border-b border-border/50 flex items-center px-4 shrink-0">
          <div className="flex items-center gap-2">
            <SolutionIcon className="w-5 h-5 text-primary" />
            <span className="font-medium text-sm">{solution.name}</span>
          </div>

          {/* Tab 栏 */}
          {showTabs && (
            <div className="ml-6 flex-shrink-0 overflow-x-auto">
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
    case 'clients':
      return <ClientChatPanel />
    case 'roi':
      return <ROIPanel />
    case 'account':
      return <AccountPanel />
    default:
      return <ChatPanel />
  }
}

