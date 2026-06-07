/**
 * 最近动态时间线
 */

import type { Activity } from '@/lib/dashboard-service'

interface Props {
  activities: Activity[]
}

export default function RecentActivity({ activities }: Props) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground/50">暂无动态，开始对话或创建任务吧</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card">
      <div className="px-5 py-3 border-b border-border/30">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          最近动态
        </h4>
      </div>

      <div className="divide-y divide-border/20 max-h-80 overflow-y-auto">
        {activities.map((act) => (
          <div key={act.id} className="flex items-start gap-3 px-5 py-3 hover:bg-secondary/10 transition-colors">
            <span className="text-base shrink-0 mt-0.5">{act.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{act.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {formatRelativeTime(act.timestamp)}
              </p>
            </div>
            <TypeBadge type={act.type} />
          </div>
        ))}
      </div>
    </div>
  )
}

function TypeBadge({ type }: { type: Activity['type'] }) {
  const meta: Record<string, { label: string; cls: string }> = {
    conversation: { label: '对话', cls: 'bg-blue-500/10 text-blue-400' },
    calculation: { label: '计算', cls: 'bg-emerald-500/10 text-emerald-400' },
    task: { label: '任务', cls: 'bg-amber-500/10 text-amber-400' },
  }
  const m = (meta[type] || meta.conversation)!
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded-md shrink-0 ${m.cls}`}>
      {m.label}
    </span>
  )
}

function formatRelativeTime(ts: string): string {
  if (!ts) return ''
  const now = Date.now()
  const then = new Date(ts).getTime()
  const diff = now - then

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`

  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
