import type { Dispatch, SetStateAction } from 'react'
import { getTemplateIcon } from './DashboardTemplateCard'
import { deleteWebhook, type CrossAgentWorkflowDef } from '@/lib/workflow-os-service'
import type { ROISummary } from '@/lib/workflow-os-service'
import type { ScheduleEntry } from '@/lib/workflow-os-service'
import type { WebhookDef } from '@/lib/workflow-os-service'
export interface DashboardExtendedSectionsProps {
  schedules: ScheduleEntry[]
  crossWorkflows: CrossAgentWorkflowDef[]
  agentName: string
  startingCross: string | null
  onStartCrossAgent: (wf: CrossAgentWorkflowDef) => void
  roi: ROISummary | null
  webhooks: WebhookDef[]
  setWebhooks: Dispatch<SetStateAction<WebhookDef[]>>
}

export function DashboardExtendedSections({
  schedules,
  crossWorkflows,
  agentName,
  startingCross,
  onStartCrossAgent,
  roi,
  webhooks,
  setWebhooks,
}: DashboardExtendedSectionsProps) {
  return (
    <>
      {schedules.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            定时工作流 <span className="text-xs font-normal">— AI 主动替你干活</span>
          </h3>
          <div className="space-y-1.5">
            {schedules.map((s) => (
              <div
                key={s.template_id}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/20 bg-card/20"
              >
                <span className="text-lg">{getTemplateIcon(s.template_id)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {s.schedule_description || s.schedule}
                  </p>
                </div>
                {s.next_run && (
                  <span className="text-[11px] text-primary font-mono shrink-0">
                    下次 {new Date(s.next_run).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {crossWorkflows.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            跨 Agent 编排 <span className="text-xs font-normal">— 多 Agent 协作完成复杂任务</span>
          </h3>
          <div className="grid gap-2">
            {crossWorkflows.map((wf) => {
              const key = `${wf.solution_id}/${wf.id}`
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
                >
                  <span className="text-lg">🌐</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{wf.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {wf.description || `${wf.mode} · ${wf.steps.length} 步`}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {[...new Set(wf.steps.map((s) => s.agent))].map((a) => (
                        <span key={a} className="px-1.5 py-0.5 text-[9px] rounded bg-secondary text-secondary-foreground">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => onStartCrossAgent(wf)}
                    disabled={startingCross === key}
                    className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shrink-0"
                  >
                    {startingCross === key ? '启动中…' : '启动'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {roi && Object.keys(roi.solution_breakdown).length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            效率飞轮 · 方案 ROI 分布
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(roi.solution_breakdown).map(([sid, data]) => (
              <div key={sid} className="rounded-lg border border-border/40 bg-card/50 p-3">
                <p className="text-sm font-medium truncate">{sid}</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">
                    <span className="text-primary font-semibold">{data.workflows}</span> 个工作流
                  </span>
                  <span className="text-xs text-muted-foreground">
                    省 <span className="text-green-500 font-semibold">{data.hours_saved}h</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ¥<span className="text-amber-500 font-semibold">{data.cost_saved.toLocaleString()}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {webhooks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Webhook 触发器 <span className="text-xs font-normal">— 外部系统自动启动工作流</span>
          </h3>
          <div className="grid gap-2">
            {webhooks.map((wh) => (
              <div
                key={wh.hook_id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/40 bg-card/50"
              >
                <span className="text-lg">{wh.enabled ? '🔗' : '🔒'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{wh.name}</p>
                    {wh.source && (
                      <span className="px-1.5 py-0.5 text-[9px] rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {wh.source}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {wh.endpoint} → {wh.template_id}
                    {wh.trigger_count > 0 && ` · 已触发 ${wh.trigger_count} 次`}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (confirm(`确认删除 Webhook "${wh.name}"？`)) {
                      await deleteWebhook(agentName, wh.hook_id)
                      setWebhooks((prev) => prev.filter((h) => h.hook_id !== wh.hook_id))
                    }
                  }}
                  className="px-2 py-1 text-[11px] rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950 shrink-0"
                  title="删除"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
