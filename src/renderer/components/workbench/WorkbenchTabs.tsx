import type { WorkbenchTab } from '@/lib/solution-router'
import { getTabMeta } from '@/lib/tab-icons'

interface Props {
  activeTab: WorkbenchTab
  enabledTabs: WorkbenchTab[]
  color: string
  onTabChange: (tab: WorkbenchTab) => void
}

export default function WorkbenchTabs({
  activeTab,
  enabledTabs,
  color,
  onTabChange,
}: Props) {
  return (
    <div className="flex items-center gap-1">
      {enabledTabs.map((tab) => {
        const meta = getTabMeta(tab)
        const Icon = meta.icon
        const isActive = activeTab === tab
        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive ? '' : 'text-muted-foreground hover:text-foreground'
            }`}
            style={isActive ? { color } : undefined}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{meta.label}</span>
            {isActive && (
              <div
                className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t"
                style={{ backgroundColor: color }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
