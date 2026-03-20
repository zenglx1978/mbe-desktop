import {
  getStatusDisplay,
  getDeliverableIcon,
  getExportUrl,
  type WorkflowInstanceSummary,
  type WorkflowInstanceDetail,
  type DeliverableItem,
} from '@/lib/workflow-os-service'

/* ── 通知图标 ────────────────────────────── */

export function NotifIcon({ type, priority }: { type: string; priority: string }) {
  const icons: Record<string, string> = {
    workflow_completed: '✅',
    workflow_failed: '❌',
    approval_pending: '⏳',
    approval_resolved: '👍',
    deliverable_ready: '📄',
    quota_warning: '⚠️',
    quota_exceeded: '🚫',
    role_changed: '🔑',
    system_alert: '🔔',
  }
  const ring = priority === 'urgent' ? 'ring-2 ring-red-400' : priority === 'high' ? 'ring-1 ring-amber-400' : ''
  return (
    <span className={`text-base shrink-0 rounded-full p-0.5 ${ring}`}>
      {icons[type] || '📋'}
    </span>
  )
}

/* ── 审计图标 ────────────────────────────── */

export function AuditIcon({ action }: { action: string }) {
  const iconMap: Record<string, string> = {
    'workflow.created': '➕',
    'workflow.completed': '✅',
    'workflow.failed': '❌',
    'workflow.cancelled': '🚫',
    'deliverable.added': '📄',
    'approval.approved': '👍',
    'approval.rejected': '👎',
    'rbac.role_assigned': '🔑',
    'rbac.role_revoked': '🔒',
    'billing.plan_changed': '💳',
  }
  return <span className="text-sm">{iconMap[action] || '📋'}</span>
}

/* ── 角色徽章 ────────────────────────────── */

export function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    operator: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    viewer: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
    auditor: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  }
  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${styles[role] || styles.viewer}`}>
      {role}
    </span>
  )
}

/* ── 用量进度条 ────────────────────────────── */

export function UsageBar({ label, used, limit, percent }: {
  label: string; used: number; limit: number; percent: number
}) {
  const color =
    percent >= 90 ? 'bg-red-500' :
    percent >= 70 ? 'bg-amber-500' :
    'bg-emerald-500'

  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
        <span className="text-neutral-500">
          {used}{limit > 0 ? ` / ${limit}` : ' (不限)'}
        </span>
      </div>
      {limit > 0 && (
        <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      )}
    </div>
  )
}

/* ── 统计卡片 ────────────────────────────── */

export function StatCard({ label, value, icon, accent, suffix }: {
  label: string; value: number | string; icon: string; accent?: string; suffix?: string
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xl font-bold" style={accent ? { color: accent } : undefined}>
          {value}{suffix && <span className="text-sm font-normal ml-0.5">{suffix}</span>}
        </p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

/* ── 实例行（可点击展开） ────────────────── */

export function InstanceRow({ inst, isSelected, onClick }: {
  inst: WorkflowInstanceSummary; isSelected: boolean; onClick: () => void
}) {
  const s = getStatusDisplay(inst.status)
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        isSelected
          ? 'border-primary/40 bg-primary/5'
          : 'border-border/30 bg-card/30 hover:border-primary/20'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{inst.workflow_name}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {inst.completed_steps}/{inst.total_steps} 步
          {inst.total_elapsed_ms > 0 && ` · ${(inst.total_elapsed_ms / 1000).toFixed(1)}s`}
        </p>
      </div>
      <div className="w-24">
        <div className="h-1.5 rounded-full bg-secondary/30 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${inst.progress_percent}%`, backgroundColor: s.color }}
          />
        </div>
      </div>
      <span
        className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
        style={{ color: s.color, backgroundColor: `${s.color}15` }}
      >
        {s.text}
      </span>
      {inst.deliverable_count > 0 && (
        <span className="text-[10px] text-muted-foreground shrink-0">
          {inst.deliverable_count} 交付物
        </span>
      )}
      <span className="text-muted-foreground/40 text-xs">{isSelected ? '▾' : '▸'}</span>
    </button>
  )
}

/* ── 实例详情面板 ────────────────────────── */

export function InstanceDetail({ detail, loading, agentName }: { detail: WorkflowInstanceDetail | null; loading: boolean; agentName: string }) {
  if (loading) {
    return <div className="px-4 py-3 text-xs text-muted-foreground">加载详情...</div>
  }
  if (!detail) return null

  const s = getStatusDisplay(detail.status)

  return (
    <div className="ml-6 mt-1 mb-3 rounded-xl border border-border/20 bg-card/30 p-4 space-y-4">
      {(detail.status === 'completed' || detail.deliverables.length > 0) && (
        <div className="flex gap-2">
          <a
            href={getExportUrl(agentName, detail.instance_id, 'html')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-[10px] rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            📄 HTML
          </a>
          <a
            href={getExportUrl(agentName, detail.instance_id, 'excel')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-[10px] rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
          >
            📊 Excel
          </a>
          <a
            href={getExportUrl(agentName, detail.instance_id, 'pdf')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-[10px] rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
          >
            📕 PDF
          </a>
          <a
            href={getExportUrl(agentName, detail.instance_id, 'zip')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-[10px] rounded-md bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 transition-colors"
          >
            📦 ZIP 全包
          </a>
          <a
            href={getExportUrl(agentName, detail.instance_id, 'markdown')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-[10px] rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            📝 MD
          </a>
        </div>
      )}

      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">步骤进度</p>
        <div className="space-y-1.5">
          {detail.steps.map((step, i) => {
            const ss = getStatusDisplay(step.status)
            return (
              <div key={step.step_id} className="flex items-center gap-2 text-xs">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0"
                  style={{ backgroundColor: `${ss.color}20`, color: ss.color }}
                >
                  {step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : i + 1}
                </span>
                <span className="flex-1 truncate">{step.step_name}</span>
                <span className="text-[10px] shrink-0" style={{ color: ss.color }}>{ss.text}</span>
                {step.elapsed_ms > 0 && (
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {(step.elapsed_ms / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {detail.deliverables.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">交付物</p>
          <div className="space-y-1">
            {detail.deliverables.map((d) => (
              <div key={d.deliverable_id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg bg-card/20">
                <span>{getDeliverableIcon(d.type)}</span>
                <span className="flex-1 truncate">{d.title}</span>
                {d.billable && d.billable_amount > 0 && (
                  <span className="text-primary font-mono text-[10px]">¥{d.billable_amount}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.error && (
        <div className="text-xs text-red-400 bg-red-500/5 px-3 py-2 rounded-lg">
          {detail.error}
        </div>
      )}

      {detail.total_elapsed_ms > 0 && (
        <p className="text-[10px] text-muted-foreground">
          总耗时 {(detail.total_elapsed_ms / 1000).toFixed(1)}s ·
          状态 <span style={{ color: s.color }}>{s.text}</span>
        </p>
      )}
    </div>
  )
}

/* ── 交付物行 ────────────────────────────── */

export function DeliverableRow({ d }: { d: DeliverableItem }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border/20 bg-card/20">
      <span className="text-lg">{getDeliverableIcon(d.type)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{d.title}</p>
        {d.description && (
          <p className="text-[10px] text-muted-foreground truncate">{d.description}</p>
        )}
      </div>
      {d.billable && d.billable_amount > 0 && (
        <span className="text-[10px] text-primary font-mono">¥{d.billable_amount}</span>
      )}
    </div>
  )
}

/* ── 空状态 ──────────────────────────────── */

export function EmptyState({ onStartChat }: { onStartChat: () => void }) {
  return (
    <div className="text-center py-12 space-y-4">
      <div className="text-5xl">🚀</div>
      <div>
        <p className="text-lg font-semibold text-foreground">还没有工作流</p>
        <p className="text-sm text-muted-foreground mt-1">
          在对话中告诉 AI 你要做什么，它会自动创建工作流并交付结果。
        </p>
        <p className="text-xs text-muted-foreground/60 mt-2 italic">
          "Everybody wants two things: to be richer and lazier."
        </p>
      </div>
      <button
        onClick={onStartChat}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
      >
        💬 开始对话
      </button>
    </div>
  )
}
