/**
 * 仪表盘指标卡片
 */

interface Props {
  icon: string
  label: string
  value: number | string
  sub?: string
  color?: string
  trend?: 'up' | 'down' | 'flat'
}

export default function StatCard({ icon, label, value, sub, color, trend }: Props) {
  return (
    <div className="px-5 py-4 rounded-xl border border-border/40 bg-card hover:border-primary/20 transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-bold tracking-tight" style={color ? { color } : undefined}>
            {value}
          </p>
          {sub && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {trend === 'up' && <span className="text-green-500">↑</span>}
              {trend === 'down' && <span className="text-red-400">↓</span>}
              {sub}
            </p>
          )}
        </div>
        <span className="text-2xl opacity-60">{icon}</span>
      </div>
    </div>
  )
}
