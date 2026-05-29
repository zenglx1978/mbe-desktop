import { useMemo } from 'react'
import { Database, CheckCircle2, Activity } from 'lucide-react'
import {
  type StateData, type Snapshot,
  detectWidgets, KpiCard, CountdownCard, ProgressRing,
  ActionList, TrendChart,
} from '@/components/workbench/StateWidgets'

export function ScheduleStatePanel({
  stateData,
  color,
}: {
  stateData: Record<string, unknown> | null
  color: string
}) {
  const snapshots = useMemo(
    () => (stateData ? ((stateData as StateData).snapshots || []) as Snapshot[] : []),
    [stateData],
  )

  const snapshotKeys = useMemo(() => {
    if (snapshots.length < 2) return []
    const allKeys = new Set<string>()
    snapshots.forEach((s) => { Object.keys(s.m || {}).forEach((k) => allKeys.add(k)) })
    return Array.from(allKeys)
  }, [snapshots])

  if (!stateData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Database className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm">暂无业务记忆</p>
        <p className="text-xs mt-1">Schedule 执行后会自动积累上下文</p>
      </div>
    )
  }

  const state = stateData as StateData
  const widgets = detectWidgets(state)
  const pendingActions = (state.pending_actions || []) as Array<Record<string, unknown>>
  const lastSummary = state.last_result_summary as string | undefined

  const kpiWidgets = widgets.filter((w) => w.type === 'kpi')
  const countdownWidgets = widgets.filter((w) => w.type === 'countdown')
  const progressWidgets = widgets.filter((w) => w.type === 'progress')
  const textWidgets = widgets.filter((w) => w.type === 'text' || w.type === 'list')

  const hasContent = widgets.length > 0 || snapshots.length > 0 || pendingActions.length > 0 || lastSummary

  if (!hasContent) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Database className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm">业务记忆为空</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold flex items-center gap-2">
        <Database className="w-4 h-4" style={{ color }} />
        业务记忆
      </h2>
      <p className="text-xs text-muted-foreground">
        AI 专家每次执行后积累的业务上下文，让下次执行更有连续性。
      </p>

      {lastSummary && (
        <div className="p-3 rounded-xl border border-border/30 bg-card">
          <p className="text-[11px] text-muted-foreground mb-1">上次执行摘要</p>
          <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{lastSummary}</p>
        </div>
      )}

      {kpiWidgets.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {kpiWidgets.map((w) => (
            <KpiCard
              key={w.key}
              label={w.label}
              value={w.value as number}
              trendData={w.trendData}
              color={color}
            />
          ))}
        </div>
      )}

      {countdownWidgets.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {countdownWidgets.map((w) => (
            <CountdownCard
              key={w.key}
              label={w.label}
              targetDate={String(w.value)}
              color={color}
            />
          ))}
        </div>
      )}

      {progressWidgets.length > 0 && (
        <div className="space-y-2">
          {progressWidgets.map((w) => {
            const val = w.value as number
            return (
              <div key={w.key} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card">
                <ProgressRing value={val} color={color} />
                <div>
                  <p className="text-xs font-medium">{w.label}</p>
                  <p className="text-[11px] text-muted-foreground">{val}%</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {snapshotKeys.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold flex items-center gap-1.5 text-muted-foreground">
            <Activity className="w-3.5 h-3.5" />
            指标趋势
          </h3>
          {snapshotKeys.map((key) => (
            <TrendChart
              key={key}
              snapshots={snapshots}
              metricKey={key}
              label={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              color={color}
            />
          ))}
        </div>
      )}

      {pendingActions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5" />
            待办事项（{pendingActions.filter((a) => a.status === 'pending').length} 项待处理）
          </h3>
          <ActionList actions={pendingActions} color={color} />
        </div>
      )}

      {textWidgets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground">其他上下文</h3>
          {textWidgets.map((w) => (
            <div key={w.key} className="p-3 rounded-xl border border-border/30 bg-card">
              <div className="text-[11px] font-mono text-muted-foreground mb-1">{w.key}</div>
              <div className="text-xs text-foreground/80 whitespace-pre-wrap break-all leading-relaxed">
                {typeof w.value === 'object' ? JSON.stringify(w.value, null, 2) : String(w.value)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
