import { useToolStore } from '@/stores/tool-store'
import { useAppStore } from '@/stores/app-store'

export interface ToolCardData {
  type: 'calc-result' | 'tool-suggest'
  toolId: string
  toolName: string
  toolIcon: string
  /** calc-result: 计算结果键值对 */
  items?: { label: string; value: string }[]
  /** calc-result: 来源 */
  source?: 'local' | 'remote'
  /** calc-result: 置信度 */
  confidence?: string
  /** tool-suggest: 建议文案 */
  suggestion?: string
}

export default function InlineToolCard({ card }: { card: ToolCardData }) {
  const { navigateToTool } = useToolStore()
  const { currentSolution } = useAppStore()
  const solution = currentSolution()

  function handleOpenTool() {
    if (!solution) return
    const tool = solution.tools.find(t => t.id === card.toolId)
    if (tool) navigateToTool(tool)
  }

  if (card.type === 'calc-result') {
    return (
      <div className="mt-2 rounded-lg border border-border/50 overflow-hidden bg-card/50">
        <div className="px-3 py-2 bg-secondary/30 flex items-center gap-2">
          <span>{card.toolIcon}</span>
          <span className="text-xs font-medium">{card.toolName}</span>
          {card.confidence && (
            <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
              {card.confidence}
            </span>
          )}
        </div>
        {card.items && card.items.length > 0 && (
          <div className="px-3 py-2 space-y-1">
            {card.items.map((item, i) => (
              <div key={i} className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        )}
        <div className="px-3 py-2 border-t border-border/30 flex items-center gap-2">
          <button
            onClick={handleOpenTool}
            className="text-[11px] text-primary hover:underline"
          >
            打开 {card.toolName} →
          </button>
          {card.source && (
            <span className="ml-auto text-[11px] text-muted-foreground/50">
              {card.source === 'local' ? '📱 本地' : '☁️ 云端'}
            </span>
          )}
        </div>
      </div>
    )
  }

  if (card.type === 'tool-suggest') {
    return (
      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/20 bg-primary/5">
        <span>{card.toolIcon}</span>
        <span className="text-xs text-foreground/80 flex-1">
          {card.suggestion || `试试 ${card.toolName}，获取精确结果`}
        </span>
        <button
          onClick={handleOpenTool}
          className="text-xs px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          打开工具
        </button>
      </div>
    )
  }

  return null
}
