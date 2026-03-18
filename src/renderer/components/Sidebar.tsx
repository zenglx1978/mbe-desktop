import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { useToolStore } from '@/stores/tool-store'
import { useAuthStore } from '@/stores/auth-store'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'
import { getTabMeta, SIDEBAR_ACTIONS } from '@/lib/tab-icons'
import { Sparkles } from 'lucide-react'
import type { WorkbenchTab } from '@/lib/solution-router'

const api = (window as any).electronAPI

export default function Sidebar() {
  const navigate = useNavigate()
  const { currentSolution, sidebarExpanded, toggleSidebar, solutionId } = useAppStore()
  const { activeTab, setActiveTab } = useToolStore()
  const { trackTabSwitch, getRecommendedTabOrder } = useAdaptiveUIStore()
  const user = useAuthStore((s) => s.user)
  const solution = currentSolution()

  if (!solution) return null

  const baseTabs = [...solution.enabledTabs] as WorkbenchTab[]
  if (!baseTabs.includes('approvals')) baseTabs.push('approvals')
  if (!baseTabs.includes('costs')) baseTabs.push('costs')
  if (!baseTabs.includes('efficiency')) baseTabs.push('efficiency')

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

  const SettingsIcon = SIDEBAR_ACTIONS.settings.icon
  const LogoutIcon = SIDEBAR_ACTIONS.logout.icon
  const CollapseIcon = sidebarExpanded ? SIDEBAR_ACTIONS.collapse.icon : SIDEBAR_ACTIONS.expand.icon

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[hsl(var(--background))] border-r border-border/50 flex flex-col transition-all duration-200 z-20 ${
        sidebarExpanded ? 'w-64' : 'w-16'
      }`}
    >
      {/* 用户信息 */}
      <div className={`shrink-0 border-b border-border/50 ${sidebarExpanded ? 'px-4 py-3' : 'px-2 py-3 flex justify-center'}`}>
        {sidebarExpanded ? (
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: color }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.name || '未登录'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || ''}
              </p>
            </div>
          </div>
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white cursor-default"
            style={{ backgroundColor: color }}
            title={user?.email || '未登录'}
          >
            {initials}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {enabledTabs.map((tab) => {
          const meta = getTabMeta(tab)
          const Icon = meta.icon
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                if (solutionId) trackTabSwitch(solutionId, tab)
              }}
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
          title={sidebarExpanded ? undefined : 'AI 副驾驶 (Ctrl+Shift+Space)'}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          {sidebarExpanded && <span>AI 副驾驶</span>}
        </button>
        <button
          onClick={() => navigate('/settings')}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors ${
            sidebarExpanded ? '' : 'justify-center px-2'
          }`}
          title={sidebarExpanded ? undefined : '设置'}
        >
          <SettingsIcon className="w-4 h-4 shrink-0" />
          {sidebarExpanded && <span>设置</span>}
        </button>
        <button
          onClick={() => {
            useAuthStore.getState().logout()
            navigate('/auth', { replace: true })
          }}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors ${
            sidebarExpanded ? '' : 'justify-center px-2'
          }`}
          title={sidebarExpanded ? undefined : '退出登录'}
        >
          <LogoutIcon className="w-4 h-4 shrink-0" />
          {sidebarExpanded && <span>退出登录</span>}
        </button>
        <button
          onClick={toggleSidebar}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors ${
            sidebarExpanded ? '' : 'justify-center px-2'
          }`}
          title={sidebarExpanded ? '收起' : '展开'}
        >
          <CollapseIcon className="w-4 h-4 shrink-0" />
          {sidebarExpanded && <span>{sidebarExpanded ? '收起' : '展开'}</span>}
        </button>
      </div>
    </aside>
  )
}
