/**
 * WorkbenchTabs — progressive complexity, QuickBooks-inspired
 *
 * - First N tabs shown directly (responsive)
 * - Overflow collapsed into "more" dropdown
 * - Badge/count support
 * - A2/B2/C10: ARIA tablist, keyboard nav, aria-haspopup/aria-expanded
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { getTabMetaForSolution } from '@/lib/tab-icons'
import type { WorkbenchTab } from '@/lib/solution-router'

interface Props {
  activeTab: string
  enabledTabs: WorkbenchTab[]
  color: string
  onTabChange: (tab: string) => void
  solutionId?: string
}

const MAX_VISIBLE = 6

export default function WorkbenchTabs({ activeTab, enabledTabs, color, onTabChange, solutionId }: Props) {
  const [overflowOpen, setOverflowOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuListRef = useRef<HTMLDivElement>(null)

  const visible = enabledTabs.slice(0, MAX_VISIBLE)
  const overflow = enabledTabs.slice(MAX_VISIBLE)
  const activeInOverflow = overflow.includes(activeTab as WorkbenchTab)

  useEffect(() => {
    if (!overflowOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOverflowOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [overflowOpen])

  // B2: focus first menu item when dropdown opens; Escape to close
  useEffect(() => {
    if (!overflowOpen) return
    const firstItem = menuListRef.current?.querySelector('button') as HTMLButtonElement | null
    firstItem?.focus()

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverflowOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [overflowOpen])

  const selectTab = useCallback((tab: string) => {
    onTabChange(tab)
    setOverflowOpen(false)
  }, [onTabChange])

  return (
    // A2: role="tablist" on container
    <div role="tablist" aria-label="workbench-tabs" className="flex items-center gap-0.5 py-1">
      {visible.map((tab) => {
        const meta = getTabMetaForSolution(tab, solutionId)
        const Icon = meta.icon
        const isActive = activeTab === tab
        return (
          // A2: role="tab" + aria-selected on each tab button
          <button
            key={tab}
            role="tab"
            aria-selected={isActive}
            aria-label={meta.label}
            type="button"
            onClick={() => selectTab(tab)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
              ${isActive
                ? 'text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }
            `}
            style={isActive ? { backgroundColor: color } : undefined}
          >
            <Icon className="w-3.5 h-3.5" />
            {meta.label}
          </button>
        )
      })}

      {/* overflow menu */}
      {overflow.length > 0 && (
        <div className="relative" ref={menuRef}>
          {/* C10: aria-haspopup + aria-expanded */}
          <button
            type="button"
            aria-label="more-tabs"
            aria-haspopup="listbox"
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen(!overflowOpen)}
            className={`
              flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
              ${activeInOverflow
                ? 'text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }
            `}
            style={activeInOverflow ? { backgroundColor: color } : undefined}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
            {activeInOverflow && (
              <span>{getTabMetaForSolution(activeTab, solutionId).label}</span>
            )}
          </button>

          {overflowOpen && (
            <div
              ref={menuListRef}
              role="listbox"
              className="absolute top-full left-0 mt-1 py-1 min-w-[140px] bg-popover border border-border rounded-lg shadow-lg z-50"
            >
              {overflow.map((tab) => {
                const meta = getTabMetaForSolution(tab, solutionId)
                const Icon = meta.icon
                const isActive = activeTab === tab
                return (
                  <button
                    key={tab}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => selectTab(tab)}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors
                      ${isActive ? 'text-primary bg-primary/5 font-medium' : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'}
                    `}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {meta.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
