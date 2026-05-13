import { useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { useToolStore } from '@/stores/tool-store'
import { initConnectivityMonitor } from '@/stores/connectivity-store'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'
import { useLocalFeedbackStore, startFeedbackSync } from '@/stores/local-feedback-store'
import { useSmartCacheStore } from '@/stores/smart-cache-store'
import { useCloudSyncStore, startCloudSync } from '@/stores/cloud-sync-store'
import { applySolutionTheme, fetchSolutionStatuses, getEffectiveStatus, type WorkbenchTab, type SolutionConfig } from '@/lib/solution-router'
import { API_BASE, authHeaders } from '@/lib/api-client'
import { getSolutionIcon } from '@/lib/solution-icons'
import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import ChatPanel from '@/components/ChatPanel'
import ConnectivityBadge from '@/components/ConnectivityBadge'
import ToastContainer from '@/components/ToastContainer'
import UpdateBanner from '@/components/UpdateBanner'
import WorkbenchTabs from '@/components/workbench/WorkbenchTabs'
import ToolPanel from '@/components/workbench/ToolPanel'
import DocumentsPanel from '@/components/workbench/DocumentsPanel'
import CaseDocumentsPanel from '@/components/workbench/CaseDocumentsPanel'
import TasksPanel from '@/components/workbench/TasksPanel'
import DashboardPanel from '@/components/workbench/DashboardPanel'
import WorkflowPanel from '@/components/workbench/WorkflowPanel'
import ApprovalPanel from '@/components/workbench/ApprovalPanel'
import CostPanel from '@/components/workbench/CostPanel'
import SchedulerPanel from '@/components/workbench/SchedulerPanel'
import DesignerPanel from '@/components/workbench/DesignerPanel'
import DesignEnginePanel from '@/components/workbench/DesignEnginePanel'
import KnowledgeGraphPanel from '@/components/workbench/KnowledgeGraphPanel'
import EfficiencyPanel from '@/components/workbench/EfficiencyPanel'
import ClientChatPanel from '@/components/workbench/ClientChatPanel'
import ROIPanel from '@/components/workbench/ROIPanel'
import ScoutPanel from '@/components/workbench/ScoutPanel'
import AccountPanel from '@/components/workbench/AccountPanel'
import AutomationPanel from '@/components/workbench/AutomationPanel'
import SalesPipelinePanel from '@/components/workbench/SalesPipelinePanel'
import BrandsPanel from '@/components/workbench/BrandsPanel'
import ERPSyncPanel from '@/components/workbench/ERPSyncPanel'
import TodayPanel from '@/components/workbench/TodayPanel'
import LawTodayPanel from '@/components/workbench/LawTodayPanel'
import LaborTodayPanel from '@/components/workbench/LaborTodayPanel'
import InvestTodayPanel from '@/components/workbench/InvestTodayPanel'
import HkFinanceTodayPanel from '@/components/workbench/HkFinanceTodayPanel'
import TaskContextPanel from '@/components/workbench/TaskContextPanel'
import ConsolidatedReportPanel from '@/components/workbench/ConsolidatedReportPanel'
import MisesExportPanel from '@/components/workbench/MisesExportPanel'
import IPOPrepPanel from '@/components/workbench/IPOPrepPanel'
import AuditReportFullPanel from '@/components/workbench/AuditReportFullPanel'
import NEEQPanel from '@/components/workbench/NEEQPanel'
import NotificationBell from '@/components/NotificationBell'
import OfflineBanner from '@/components/OfflineBanner'
import UndoToast from '@/components/workbench/UndoToast'
import { startApprovalPolling } from '@/stores/approval-store'
import { useApprovalNotifications } from '@/hooks/useApprovalNotifications'
import { MessageSquare, ChevronDown, X, ArrowLeftRight, Sparkles } from 'lucide-react'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'

let connectivityInitialized = false
let clientIntelInitialized = false

const ONBOARDING_PREFIX = 'mbe-onboarding-done-'

function OnboardingDialog({ solution, onComplete }: { solution: SolutionConfig; onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const questions = solution.onboarding?.questions || []
  if (questions.length === 0) return null

  const isHk = solution.id === 'hk-finance-tax'
  const current = questions[step]
  const isLast = step === questions.length - 1

  const handleSelect = (value: string) => {
    const next = { ...answers, [current.key]: value }
    setAnswers(next)
    if (isLast) {
      try { sessionStorage.setItem(`mbe-onboarding-answers-${solution.id}`, JSON.stringify(next)) } catch {}
      onComplete()
    } else {
      setStep(step + 1)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${solution.color}20` }}>
            <Sparkles className="w-5 h-5" style={{ color: solution.color }} />
          </div>
          <div>
            <h2 className="text-base font-bold">{isHk ? '快速瞭解您的業務' : '快速了解你的业务'}</h2>
            <p className="text-xs text-muted-foreground">{isHk ? 'AI 專家會根據您的回答優化建議' : 'AI 专家会根据你的回答优化建议'}（{step + 1}/{questions.length}）</p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{current.label}</h3>
          <div className="grid gap-2">
            {current.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleSelect(opt)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all hover:border-primary/50 hover:bg-primary/5 ${
                  answers[current.key] === opt ? 'border-primary bg-primary/10 font-medium' : 'border-border/40'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full transition-colors" style={{ backgroundColor: i <= step ? solution.color : 'var(--border)' }} />
            ))}
          </div>
          <button type="button" onClick={onComplete} className="text-xs text-muted-foreground hover:text-foreground">
            {isHk ? '跳過' : '跳过'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** 是否支持 AI 助手侧面板（非 chat tab 时可滑出） */
function supportsAssistant(tab: string): boolean {
  return tab !== 'chat' && !['today'].includes(tab)
}

export default function Workspace() {
  const navigate = useNavigate()
  const { currentSolution, hasPickedSolution, sidebarExpanded } = useAppStore()
  const { activeTab, setActiveTab } = useToolStore()
  const solution = currentSolution()

  const [assistantOpen, setAssistantOpen] = useState(false)
  const [activeClient, setActiveClient] = useState<string>('default')
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!solution?.onboarding?.questions?.length) return
    const done = localStorage.getItem(`${ONBOARDING_PREFIX}${solution.id}`)
    if (!done) setShowOnboarding(true)
  }, [solution?.id])

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
    // 定时将本地反馈同步到服务端
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
    const tabs = [...(solution.enabledTabs ?? [])]
    const isTaskOriented = ['finance-tax-service', 'law-firm', 'labor-dispatch', 'investment-research'].includes(solution.id)
    // 「账户 / 用量 / 订阅」对所有付费用户始终可达，不受方案类型影响
    if (!tabs.includes('approvals')) tabs.push('approvals' as (typeof tabs)[number])
    if (!tabs.includes('account')) tabs.push('account' as (typeof tabs)[number])
    if (!isTaskOriented) {
      if (!tabs.includes('costs')) tabs.push('costs' as (typeof tabs)[number])
      if (!tabs.includes('efficiency')) tabs.push('efficiency' as (typeof tabs)[number])
      if (!tabs.includes('automation')) tabs.push('automation' as (typeof tabs)[number])
      if (!tabs.includes('clients')) tabs.push('clients' as (typeof tabs)[number])
      if (!tabs.includes('roi')) tabs.push('roi' as (typeof tabs)[number])
      if (!tabs.includes('scout')) tabs.push('scout' as (typeof tabs)[number])
      if (!tabs.includes('pipeline')) tabs.push('pipeline' as (typeof tabs)[number])
    }
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

  const isFinance = solution.id === 'finance-tax-service'
  const isLawFirm = solution.id === 'law-firm'
  const isHkSolution = solution.id === 'hk-finance-tax'
  const showAssistantButton = supportsAssistant(activeTab)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <UpdateBanner />
      {/* 移动端侧边栏遮罩：小于 md 且侧边栏展开时显示，点击收起 */}
      {sidebarExpanded && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          aria-hidden="true"
          onClick={() => useAppStore.getState().toggleSidebar?.()}
        />
      )}
      <Sidebar />
      <main
        id="main-content"
        role="main"
        aria-label={solution.name}
        className={`flex-1 flex flex-col transition-all duration-200 ${sidebarExpanded ? 'md:ml-64 ml-0' : 'ml-16'}`}
      >
        <OfflineBanner />
        {/* 顶部栏 */}
        <header className="h-12 border-b border-border/50 flex items-center px-4 shrink-0" role="banner">
            <button
                onClick={() => {
                  useAppStore.getState().clearSolution()
                  navigate('/pick', { replace: true })
                }}
                className="flex items-center gap-2 shrink-0 px-2 py-1 -ml-2 rounded-md hover:bg-secondary/40 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={`${solution.name} — ${isHkSolution ? '切換行業方案' : '切换行业方案'}`}
                title={isHkSolution ? '切換行業方案' : '切换行业方案'}
              >
                <SolutionIcon className="w-5 h-5 text-primary" aria-hidden="true" />
                <span className="font-medium text-sm hidden sm:inline">{solution.name}</span>
                <ArrowLeftRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
              </button>

          {/* P1-7: 客户切换下拉（代理记账多客户场景） */}
          {isFinance && (
            <div className="relative ml-3">
              <button
                onClick={() => setClientDropdownOpen(!clientDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-muted/40 hover:bg-muted/70 rounded-md transition-colors"
              >
                <span className="text-muted-foreground">{activeClient === 'default' ? '全部客户' : activeClient}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
              {clientDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 py-1 bg-card border border-border rounded-lg shadow-lg z-50">
                  {['default', '客户A-某贸易公司', '客户B-某科技公司', '客户C-某餐饮店'].map((c) => (
                    <button
                      key={c}
                      onClick={() => { setActiveClient(c); setClientDropdownOpen(false) }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors ${activeClient === c ? 'text-primary font-medium' : 'text-foreground'}`}
                    >
                      {c === 'default' ? '全部客户' : c}
                    </button>
                  ))}
                  <div className="border-t border-border/30 mt-1 pt-1">
                    <button className="w-full text-left px-3 py-1.5 text-xs text-primary hover:bg-muted/50 transition-colors">
                      + 添加客户
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 栏 — 窄屏可横向滚动 */}
          {showTabs && (
            <div className="ml-4 sm:ml-6 flex-1 min-w-0 overflow-x-auto scrollbar-none">
              <WorkbenchTabs
                activeTab={activeTab}
                enabledTabs={allTabs}
                color={solution.color}
                onTabChange={setActiveTab as (tab: string) => void}
                solutionId={solution.id}
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            {/* AI Copilot 状态指示灯 — 品牌电商方案专属 */}
            {solution.id === 'ecommerce-brand-service' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-green-500/10 text-green-600 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="hidden sm:inline">Copilot 在线</span>
              </div>
            )}
            {/* P1-5: AI 助手按钮（非 chat tab 时显示） */}
            {showAssistantButton && (
              <button
                onClick={() => setAssistantOpen(!assistantOpen)}
                aria-pressed={assistantOpen}
                aria-label={assistantOpen ? 'AI 助手（已展开，点击关闭）' : (isHkSolution ? '展開 AI 助手' : '展开 AI 助手')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${assistantOpen ? 'bg-primary/15 text-primary' : 'bg-muted/40 hover:bg-muted/70 text-muted-foreground'}`}
              >
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{isLawFirm ? '问律师' : solution?.id === 'investment-research' ? '问分析师' : isHkSolution ? '問專家' : '问专家'}</span>
              </button>
            )}
            <NotificationBell />
            <ConnectivityBadge />
          </div>
        </header>

        {/* 内容区 + AI 助手侧面板 */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <PanelErrorBoundary name={activeTab}>
              <ActivePanel tab={activeTab} />
            </PanelErrorBoundary>
          </div>
          {/* P1-5: AI 助手侧面板（滑出式） */}
          {assistantOpen && showAssistantButton && (
            <aside
              className="w-80 border-l border-border/50 flex flex-col bg-card shrink-0 animate-slide-in-right"
              aria-label="AI 助手面板"
              role="complementary"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
                <span className="text-xs font-medium text-foreground" id="ai-assistant-title">AI 助手</span>
                <button
                  onClick={() => setAssistantOpen(false)}
                  aria-label="关闭 AI 助手面板"
                  className="p-1 hover:bg-muted/50 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1 flex flex-col overflow-hidden">
                <ChatPanel />
              </div>
            </aside>
          )}
        </div>
      </main>
      <ToastContainer />
      <UndoToast />
      {showOnboarding && solution && (
        <OnboardingDialog
          solution={solution}
          onComplete={() => {
            setShowOnboarding(false)
            localStorage.setItem(`${ONBOARDING_PREFIX}${solution.id}`, '1')
          }}
        />
      )}
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
      if (solution.id === 'law-firm') return <CaseDocumentsPanel solution={solution} />
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
    case 'design-engine':
      return <DesignEnginePanel solution={solution} />
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
    case 'pipeline':
      return <SalesPipelinePanel solution={solution} />
    case 'brands':
      return <BrandsPanel solution={solution} />
    case 'erp-sync':
      return <ERPSyncPanel solution={solution} />
    // QuickBooks 任务导向 tab — 财税 + 律所 + 劳务派遣 + 投研
    case 'today':
      if (solution.id === 'law-firm') return <LawTodayPanel solution={solution} />
      if (solution.id === 'labor-dispatch') return <LaborTodayPanel solution={solution} />
      if (solution.id === 'investment-research') return <InvestTodayPanel solution={solution} />
      if (solution.id === 'hk-finance-tax') return <HkFinanceTodayPanel solution={solution} />
      return <TodayPanel solution={solution} />
    case 'bookkeeping':
      return <TaskContextPanel solution={solution} taskId="bookkeeping" />
    case 'invoices':
      return <TaskContextPanel solution={solution} taskId="invoices" />
    case 'tax-filing':
      return <TaskContextPanel solution={solution} taskId="tax-filing" />
    case 'reports':
      return <TaskContextPanel solution={solution} taskId="reports" />
    case 'tax-planning':
      return <TaskContextPanel solution={solution} taskId="tax-planning" />
    case 'business-plan':
      return <TaskContextPanel solution={solution} taskId="business-plan" />
    // 律所专属任务 tab
    case 'cases':
      return <TaskContextPanel solution={solution} taskId="cases" />
    case 'contracts':
      return <TaskContextPanel solution={solution} taskId="contracts" />
    case 'legal-docs':
      return <TaskContextPanel solution={solution} taskId="legal-docs" />
    case 'billing':
      return <TaskContextPanel solution={solution} taskId="billing" />
    // 劳务派遣专属任务 tab
    case 'employees':
      return <TaskContextPanel solution={solution} taskId="employees" />
    case 'payroll':
      return <TaskContextPanel solution={solution} taskId="payroll" />
    case 'compliance':
      return <TaskContextPanel solution={solution} taskId="compliance" />
    case 'disputes':
      return <TaskContextPanel solution={solution} taskId="disputes" />
    // 投研方案专属任务 tab
    case 'research':
      return <TaskContextPanel solution={solution} taskId="research" />
    case 'portfolio':
      return <TaskContextPanel solution={solution} taskId="portfolio" />
    case 'macro':
      return <TaskContextPanel solution={solution} taskId="macro" />
    case 'compliance-pub':
      return <TaskContextPanel solution={solution} taskId="compliance-pub" />
    case 'mises-export':
      return <MisesExportPanel solution={solution} />
    // 财税方案专属任务 tab
    case 'consolidated':
      return <ConsolidatedReportPanel solution={solution} />
    case 'ipo-prep':
      return <IPOPrepPanel solution={solution} />
    case 'audit-report':
      return <AuditReportFullPanel solution={solution} />
    case 'neeq':
      return <NEEQPanel solution={solution} />
    case 'knowledge-graph':
      return <KnowledgeGraphPanel />
    default:
      return <ChatPanel />
  }
}

