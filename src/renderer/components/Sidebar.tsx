import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { useToolStore } from '@/stores/tool-store'
import { useAuthStore } from '@/stores/auth-store'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'
import { getTabMetaForSolution, SIDEBAR_ACTIONS, getSidebarLabels } from '@/lib/tab-icons'
import { Sparkles, Power } from 'lucide-react'
import type { WorkbenchTab } from '@/lib/solution-router'
import TokenQuotaWidget from './TokenQuotaWidget'

const api = (window as any).electronAPI

const COLLAPSE_BREAKPOINT = 768

export default function Sidebar() {
  const navigate = useNavigate()
  const { currentSolution, sidebarExpanded, toggleSidebar, solutionId } = useAppStore()
  const { activeTab, setActiveTab } = useToolStore()
  const { trackTabSwitch, getRecommendedTabOrder } = useAdaptiveUIStore()
  const user = useAuthStore((s) => s.user)
  const solution = currentSolution()

  useEffect(() => {
    const onResize = () => {
      const store = useAppStore.getState()
      if (window.innerWidth < COLLAPSE_BREAKPOINT && store.sidebarExpanded) {
        store.toggleSidebar()
      }
    }
    window.addEventListener('resize', onResize)
    onResize()
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!solution) return null

  const baseTabs = [...(solution.enabledTabs ?? [])] as WorkbenchTab[]
  // 任务导向型方案（投研/财税/律所/劳务派遣）不注入运营类 tab，避免渲染不适用的面板
  const isTaskOriented = ['finance-tax-service', 'law-firm', 'labor-dispatch', 'investment-research'].includes(solution.id)
  if (!baseTabs.includes('approvals')) baseTabs.push('approvals')
  if (!isTaskOriented) {
    if (!baseTabs.includes('costs')) baseTabs.push('costs')
    if (!baseTabs.includes('efficiency')) baseTabs.push('efficiency')
  }
  if (!baseTabs.includes('design-engine')) baseTabs.push('design-engine')

  // 根据使用频率自动重排（高频 tab 靠前）
  const recommended = getRecommendedTabOrder()
  const enabledTabs = recommended && recommended.length > 0
    ? [...baseTabs].sort((a, b) => {
        const ai = recommended.indexOf(a)
        const bi = recommended.indexOf(b)
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      })
    : baseTabs

  const color = solution.color

  const initials = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'

  const SwitchIcon = SIDEBAR_ACTIONS.switchSolution.icon
  const SettingsIcon = SIDEBAR_ACTIONS.settings.icon
  const LogoutIcon = SIDEBAR_ACTIONS.logout.icon
  const CollapseIcon = sidebarExpanded ? SIDEBAR_ACTIONS.collapse.icon : SIDEBAR_ACTIONS.expand.icon

  const labels = getSidebarLabels(solutionId)

  return (
    <aside
      role="navigation"
      aria-label={labels.navLabel}
      className={`fixed left-0 top-0 h-full bg-[hsl(var(--background))] border-r border-border/50 flex flex-col transition-all duration-200 z-20 ${
        sidebarExpanded ? 'w-64' : 'w-16'
      }`}
    >
      {/* 用户信息 + 方案名快捷切换 */}
      <div className={`shrink-0 border-b border-border/50 ${sidebarExpanded ? 'px-4 py-3' : 'px-2 py-3 flex flex-col items-center gap-2'}`}>
        {sidebarExpanded ? (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: color }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.name || labels.notLoggedIn}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email || ''}
                </p>
              </div>
            </div>
            {/* 当前方案名 — 点击跳回方案选择器 */}
            <button
              type="button"
              onClick={() => {
                useAppStore.getState().clearSolution()
                navigate('/pick', { replace: true })
              }}
              className="mt-1 w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/40 transition-colors group"
              title="切换行业方案"
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-muted-foreground truncate flex-1 text-left">
                {solution.name}
              </span>
              <SwitchIcon className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
            </button>
          </>
        ) : (
          <>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white cursor-default"
              style={{ backgroundColor: color }}
              title={user?.email || labels.notLoggedIn}
            >
              {initials}
            </div>
            {/* 折叠态：方案色点 */}
            <button
              type="button"
              onClick={() => {
                useAppStore.getState().clearSolution()
                navigate('/pick', { replace: true })
              }}
              title={`${solution.name} · 点击切换方案`}
              className="w-5 h-5 rounded-full border-2 border-background/50 hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
            />
          </>
        )}
      </div>

      <TokenQuotaWidget expanded={sidebarExpanded} />

      <div className="flex-1 overflow-y-auto py-3">
        {enabledTabs.map((tab) => {
          const meta = getTabMetaForSolution(tab, solutionId)
          const Icon = meta.icon
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => {
                if (tab === 'scheduler') {
                  navigate('/schedules')
                  return
                }
                if (tab === 'dispatch-dashboard') {
                  navigate('/dispatch/dashboard')
                  return
                }
                setActiveTab(tab)
                if (solutionId) trackTabSwitch(solutionId, tab)
              }}
              aria-label={!sidebarExpanded ? meta.label : undefined}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors relative ${
                isActive
                  ? 'bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
              }`}
              style={isActive ? { color } : undefined}
              title={sidebarExpanded ? undefined : meta.label}
            >
              {isActive && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r"
                  style={{ backgroundColor: color }}
                />
              )}
              <Icon className="w-4 h-4 shrink-0" />
              {sidebarExpanded && <span className="truncate">{meta.label}</span>}
            </button>
          )
        })}
      </div>

      <div className="border-t border-border/50 p-3 space-y-1 shrink-0">
        <button
          onClick={() => api?.copilot?.toggle()}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors ${
            sidebarExpanded ? '' : 'justify-center px-2'
          }`}
          title={sidebarExpanded ? undefined : labels.copilotTitle}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          {sidebarExpanded && <span>{labels.copilot}</span>}
        </button>
        <button
          onClick={() => {
            useAppStore.getState().clearSolution()
            navigate('/pick', { replace: true })
          }}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors ${
            sidebarExpanded ? '' : 'justify-center px-2'
          }`}
          title={sidebarExpanded ? undefined : labels.switchSolution}
        >
          <SwitchIcon className="w-4 h-4 shrink-0" />
          {sidebarExpanded && <span>{labels.switchSolution}</span>}
        </button>
        <button
          onClick={() => navigate('/settings')}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors ${
            sidebarExpanded ? '' : 'justify-center px-2'
          }`}
          title={sidebarExpanded ? undefined : labels.settings}
        >
          <SettingsIcon className="w-4 h-4 shrink-0" />
          {sidebarExpanded && <span>{labels.settings}</span>}
        </button>
        <button
          onClick={() => {
            useAuthStore.getState().logout()
            navigate('/auth', { replace: true })
          }}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-orange-400 hover:bg-orange-500/10 transition-colors ${
            sidebarExpanded ? '' : 'justify-center px-2'
          }`}
          title={sidebarExpanded ? undefined : labels.logout}
        >
          <LogoutIcon className="w-4 h-4 shrink-0" />
          {sidebarExpanded && <span>{labels.logout}</span>}
        </button>
        <button
          onClick={() => api?.close()}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors ${
            sidebarExpanded ? '' : 'justify-center px-2'
          }`}
          title={sidebarExpanded ? undefined : labels.quit}
        >
          <Power className="w-4 h-4 shrink-0" />
          {sidebarExpanded && <span>{labels.quit}</span>}
        </button>
        <button
          onClick={toggleSidebar}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors ${
            sidebarExpanded ? '' : 'justify-center px-2'
          }`}
          title={sidebarExpanded ? labels.collapse : labels.expand}
        >
          <CollapseIcon className="w-4 h-4 shrink-0" />
          {sidebarExpanded && <span>{sidebarExpanded ? labels.collapse : labels.expand}</span>}
        </button>
      </div>
    </aside>
  )
}
