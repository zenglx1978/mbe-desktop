import { useState, useEffect, useRef } from 'react'
import type { SlashCommand } from '@/lib/solution-router'

interface Props {
  commands: SlashCommand[]
  query: string
  onSelect: (cmd: SlashCommand) => void
  onClose: () => void
}

export default function SlashMenu({ commands, query, onSelect, onClose }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const filtered = commands.filter(cmd =>
    (cmd.cmd ?? cmd.command ?? '').includes(query) || cmd.label.includes(query)
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault()
        onSelect(filtered[selectedIndex])
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [filtered, selectedIndex, onSelect, onClose])

  if (filtered.length === 0) return null

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-border/50 bg-card shadow-xl overflow-hidden z-50"
    >
      <div className="px-3 py-2 border-b border-border/30">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          快捷工具
        </p>
      </div>
      <div className="py-1 max-h-64 overflow-y-auto">
        {filtered.map((cmd, i) => (
          <button
            key={cmd.cmd}
            onClick={() => onSelect(cmd)}
            onMouseEnter={() => setSelectedIndex(i)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
              i === selectedIndex ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-secondary/50'
            }`}
          >
            <span className="text-lg w-7 text-center shrink-0">{cmd.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{cmd.label}</div>
              {cmd.description && (
                <div className="text-xs text-muted-foreground truncate">{cmd.description}</div>
              )}
            </div>
            <span className="text-xs text-muted-foreground/50 shrink-0">{cmd.cmd}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
