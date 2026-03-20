import { AuditIcon, RoleBadge } from './dashboard-panel-widgets'
import type { AuditEntryDef, RoleMemberDef } from '@/lib/workflow-os-service'

export interface DashboardTimelineProps {
  auditLogs: AuditEntryDef[]
  members: RoleMemberDef[]
}

/** 审计日志 + 团队成员（与原面板 DOM 顺序一致：Webhook 之后、模板目录之前） */
export function DashboardTimeline({ auditLogs, members }: DashboardTimelineProps) {
  return (
    <>
      {auditLogs.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            审计日志 <span className="text-xs font-normal">— 操作追溯</span>
          </h3>
          <div className="space-y-1">
            {auditLogs.map((log) => (
              <div
                key={log.entry_id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/30 bg-card/30 text-xs"
              >
                <AuditIcon action={log.action} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{log.description || log.action}</span>
                  <span className="text-muted-foreground ml-2">
                    {log.actor_id} · {log.resource_type}/{log.resource_id.slice(0, 12)}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(log.timestamp).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {members.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            团队成员 <span className="text-xs font-normal">— 角色权限</span>
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {members.map((m) => (
              <div
                key={m.assignment_id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border/40 bg-card/50"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {m.user_id.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.user_id}</p>
                  <p className="text-[10px] text-muted-foreground">{m.permissions.length} 项权限</p>
                </div>
                <RoleBadge role={m.role} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
