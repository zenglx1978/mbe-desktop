/**
 * 工作台 Tab 栏 — QuickBooks 渐进复杂度对标
 *
 * - 前 N 个 tab 直接显示（窄屏自适应）
 * - 溢出部分折叠到「更多」下拉菜单
 * - 未读/数字角标支持
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { getTabMeta } from '@/lib/tab-icons'
import type { WorkbenchTab } from '@/lib/solution-router'

interface Props {
  activeTab: string
  enabledTabs: WorkbenchTab[]
  color: string
  onTabChange: (tab: string) => void
}

const MAX_VISIBLE = 6

export default function WorkbenchTabs({ activeTab, enabledTabs, color, onTabChange }: Props) {
  const [overflowOpen, setOverflowOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  const selectTab = useCallback((tab: string) => {
    onTabChange(tab)
    setOverflowOpen(false)
  }, [onTabChange])

  return (
    <div className="flex items-center gap-0.5 py-1">
      {visible.map((tab) => {
        const meta = getTabMeta(tab)
        const Icon = meta.icon
        const isActive = activeTab === tab
        return (
          <button
            key={tab}
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

      {/* 溢出菜单 */}
      {overflow.length > 0 && (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
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
              <span>{getTabMeta(activeTab).label}</span>
            )}
          </button>

          {overflowOpen && (
            <div className="absolute top-full left-0 mt-1 py-1 min-w-[140px] bg-popover border border-border rounded-lg shadow-lg z-50">
              {overflow.map((tab) => {
                const meta = getTabMeta(tab)
                const Icon = meta.icon
                const isActive = activeTab === tab
                return (
                  <button
                    key={tab}
                    type="button"
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
