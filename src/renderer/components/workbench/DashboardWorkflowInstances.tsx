import {
  InstanceRow,
  InstanceDetail,
  DeliverableRow,
} from './dashboard-panel-widgets'
import type { DashboardData, PendingApproval, WorkflowInstanceDetail } from '@/lib/workflow-os-service'

export interface DashboardWorkflowInstancesProps {
  dashboard: DashboardData
  agentName: string
  approvals: PendingApproval[]
  decidingApproval: string | null
  onApproval: (a: PendingApproval, approved: boolean) => void
  selectedInstanceId: string | null
  instanceDetail: WorkflowInstanceDetail | null
  detailLoading: boolean
  onToggleInstance: (id: string) => void
}

export function DashboardWorkflowInstances({
  dashboard,
  agentName,
  approvals,
  decidingApproval,
  onApproval,
  selectedInstanceId,
  instanceDetail,
  detailLoading,
  onToggleInstance,
}: DashboardWorkflowInstancesProps) {
  return (
    <>
      {approvals.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-amber-500 uppercase tracking-wider mb-3">
            ⚠ 待审批 ({approvals.length})
          </h3>
          <div className="space-y-2">
            {approvals.map((a) => {
              const key = `${a.instance_id}/${a.step_id}`
              const deciding = decidingApproval === key
              return (
                <div
                  key={key}
                  className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🔐</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{a.workflow_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        步骤「{a.step_name}」需要您的审批确认
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 mt-1">
                        {a.created_at && new Date(a.created_at).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => onApproval(a, true)}
                      disabled={deciding}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                    >
                      {deciding ? '处理中...' : '✓ 批准执行'}
                    </button>
                    <button
                      onClick={() => onApproval(a, false)}
                      disabled={deciding}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/80 text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                    >
                      {deciding ? '处理中...' : '✕ 驳回'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {dashboard.active_instances.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              活跃工作流
            </h3>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          </div>
          <div className="space-y-2">
            {dashboard.active_instances.map((inst) => (
              <div key={inst.instance_id}>
                <InstanceRow
                  inst={inst}
                  isSelected={selectedInstanceId === inst.instance_id}
                  onClick={() => onToggleInstance(inst.instance_id)}
                />
                {selectedInstanceId === inst.instance_id && (
                  <InstanceDetail detail={instanceDetail} loading={detailLoading} agentName={agentName} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {dashboard.recent_completed.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            最近完成
          </h3>
          <div className="space-y-2">
            {dashboard.recent_completed.slice(0, 5).map((inst) => (
              <div key={inst.instance_id}>
                <InstanceRow
                  inst={inst}
                  isSelected={selectedInstanceId === inst.instance_id}
                  onClick={() => onToggleInstance(inst.instance_id)}
                />
                {selectedInstanceId === inst.instance_id && (
                  <InstanceDetail detail={instanceDetail} loading={detailLoading} agentName={agentName} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {dashboard.recent_deliverables.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            最近交付物
          </h3>
          <div className="space-y-1.5">
            {dashboard.recent_deliverables.map((d) => (
              <DeliverableRow key={d.deliverable_id} d={d} />
            ))}
          </div>
        </div>
      )}

      {dashboard.data_flywheel.total_instances > 0 && (
        <div className="px-4 py-3 rounded-xl border border-primary/10 bg-primary/5">
          <p className="text-xs font-semibold text-primary mb-1">数据飞轮</p>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span>{dashboard.data_flywheel.total_instances} 个工作流</span>
            <span>·</span>
            <span>{dashboard.data_flywheel.total_deliverables} 个交付物</span>
            <span>·</span>
            <span>{dashboard.data_flywheel.total_steps_executed} 步操作</span>
            {dashboard.data_flywheel.avg_completion_ms > 0 && (
              <>
                <span>·</span>
                <span>平均 {(dashboard.data_flywheel.avg_completion_ms / 1000).toFixed(1)}s/流程</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-1">
            每个工作流的数据沉淀让 AI 越来越懂你的业务。
          </p>
        </div>
      )}
    </>
  )
}
