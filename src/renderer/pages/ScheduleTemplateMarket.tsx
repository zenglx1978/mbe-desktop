import { useState } from 'react'
import { Zap, RefreshCw, Loader2, Database } from 'lucide-react'
import type { MarketTemplate } from '@/stores/schedule-store'

interface TemplateMarketPanelProps {
  templates: MarketTemplate[]
  loading: boolean
  error: string | null
  color: string
  onInstall: (templateId: string) => Promise<void>
  onRefresh: () => void
}

export function TemplateMarketPanel({
  templates, loading, error, color,
  onInstall, onRefresh,
}: TemplateMarketPanelProps) {
  const [filter, setFilter] = useState<'all' | 'schedule' | 'pipeline'>('all')
  const [installing, setInstalling] = useState<string | null>(null)

  const filtered = templates.filter((t) =>
    filter === 'all' ? true : t.type === filter,
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5" style={{ color }} />
            模板市场
          </h2>
          <button onClick={onRefresh} className="p-1.5 hover:bg-muted/50 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          浏览社区分享的 Schedule 与 Pipeline 模板，一键安装到您的 AI 专家
        </p>

        <div className="flex gap-2">
          {(['all', 'schedule', 'pipeline'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filter === f
                  ? 'text-white'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
              }`}
              style={filter === f ? { backgroundColor: color } : undefined}
            >
              {f === 'all' ? '全部' : f === 'schedule' ? '定时任务' : 'Pipeline'}
            </button>
          ))}
        </div>

        {error && <div className="text-xs text-red-500 p-2">{error}</div>}

        {loading && templates.length === 0 && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Database className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">暂无模板</p>
            <p className="text-xs mt-1">
              您可以将自己的 Schedule/Pipeline 通过导出功能分享到市场
            </p>
          </div>
        )}

        <div className="grid gap-3">
          {filtered.map((tpl) => (
            <div
              key={tpl.template_id}
              className="p-4 rounded-xl border border-border/30 bg-card hover:border-border/60 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: tpl.type === 'pipeline' ? '#3b82f615' : `${color}15`,
                        color: tpl.type === 'pipeline' ? '#3b82f6' : color,
                      }}
                    >
                      {tpl.type === 'pipeline' ? 'Pipeline' : 'Schedule'}
                    </span>
                    <span className="text-xs text-muted-foreground">{tpl.agent_name}</span>
                    <span className="text-xs text-muted-foreground">by {tpl.author}</span>
                  </div>
                  <h3 className="text-sm font-medium mt-1">
                    {(tpl.data as Record<string, unknown>)?.name as string || tpl.description || tpl.template_id}
                  </h3>
                  {tpl.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {tpl.tags.map((tag) => (
                      <span key={tag} className="text-[11px] px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                    <span className="text-[11px] text-muted-foreground">{tpl.installs} 次安装</span>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setInstalling(tpl.template_id)
                    await onInstall(tpl.template_id)
                    setInstalling(null)
                  }}
                  disabled={installing === tpl.template_id}
                  className="shrink-0 px-3 py-1.5 text-xs rounded-lg border transition-colors hover:bg-primary/5"
                  style={{ borderColor: `${color}40`, color }}
                >
                  {installing === tpl.template_id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    '安装'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
