import type { WorkbenchTab } from '@/lib/solution-router'
import { useApprovalStore } from '@/stores/approval-store'

const TAB_META: Record<WorkbenchTab, { icon: string; label: string }> = {
  chat: { icon: '💬', label: '对话' },
  tools: { icon: '🔧', label: '工具' },
  documents: { icon: '📄', label: '文档' },
  tasks: { icon: '✅', label: '任务' },
  dashboard: { icon: '📊', label: '看板' },
  workflows: { icon: '🔄', label: '流程' },
  approvals: { icon: '🛡', label: '审批' },
  costs: { icon: '💰', label: '成本' },
}

interface Props {
  activeTab: WorkbenchTab
  enabledTabs: WorkbenchTab[]
  color: string
  onTabChange: (tab: WorkbenchTab) => void
}

export default function WorkbenchTabs({ activeTab, enabledTabs, color, onTabChange }: Props) {
  const pendingCount = useApprovalStore(s => s.pendingCount)

  return (
    <div className="flex items-center gap-1 px-2">
      {enabledTabs.map(tab => {
        const meta = TAB_META[tab]
        const isActive = tab === activeTab
        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              isActive
                ? 'text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
            style={isActive ? { backgroundColor: color } : undefined}
          >
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
            {tab === 'approvals' && pendingCount > 0 && !isActive && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
