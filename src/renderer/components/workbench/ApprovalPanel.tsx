import { useState, useEffect, useCallback } from 'react'
import { Shield, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { useApprovalStore, connectApprovalWs, stopApprovalPolling } from '@/stores/approval-store'
import { RISK_META, getTimeRemaining, type ApprovalItem } from '@/lib/approval-service'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: '待审批', cls: 'text-yellow-500' },
  approved: { label: '已通过', cls: 'text-green-500' },
  rejected: { label: '已拒绝', cls: 'text-red-500' },
  expired: { label: '已过期', cls: 'text-muted-foreground' },
  auto_approved: { label: '自动通过', cls: 'text-blue-500' },
}

export default function ApprovalPanel() {
  const { items, pendingCount, loading, lastRefreshed, wsConnected, refresh, select, selectedId: _selectedId, decide } = useApprovalStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deciding, setDeciding] = useState<string | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    refresh()
    connectApprovalWs()
    return () => stopApprovalPolling()
  }, [refresh])

  const handleDecide = useCallback(async (item: ApprovalItem, status: 'approved' | 'rejected') => {
    setDeciding(item.id)
    const ok = await decide(item.id, item.agent_name, {
      status,
      decided_by: 'desktop_user',
      decision_note: note || (status === 'approved' ? '通过' : '拒绝'),
    })
    setDeciding(null)
    if (ok) {
      setExpandedId(null)
      setNote('')
    }
  }, [decide, note])

  const riskIcon = (level: string) => {
    if (level === 'critical' || level === 'high') return <AlertTriangle className="w-4 h-4" />
    return <Shield className="w-4 h-4" />
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">审批管理</h2>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">
                {pendingCount} 待处理
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 text-[11px] ${wsConnected ? 'text-green-500' : 'text-muted-foreground'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-muted-foreground/50'}`} />
              {wsConnected ? '实时' : '轮询'}
            </span>
            <button
              onClick={() => refresh()}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-secondary/30 hover:bg-secondary/50 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>

        {/* 统计 */}
        <div className="grid grid-cols-4 gap-3">
          {(['critical', 'high', 'medium', 'low'] as const).map(level => {
            const meta = RISK_META[level]
            const count = items.filter(i => i.risk_level === level).length
            return (
              <div key={level} className={`rounded-xl border border-border/40 bg-card/50 p-3 flex items-center gap-2`}>
                <span className={meta.color}>{riskIcon(level)}</span>
                <div>
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-[11px] text-muted-foreground">{meta.label}风险</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* 审批列表 */}
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map(item => {
              const risk = RISK_META[item.risk_level] || RISK_META.medium
              const statusMeta = STATUS_META[item.status] || STATUS_META.pending
              const isExpanded = expandedId === item.id
              const remaining = getTimeRemaining(item.created_at, item.expire_minutes)
              const isUrgent = remaining === '已过期' || remaining.includes('分钟')

              return (
                <div key={item.id}>
                  <button
                    onClick={() => { setExpandedId(isExpanded ? null : item.id); select(item.id) }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                      isExpanded ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-card/50 hover:border-primary/20'
                    }`}
                  >
                    <span className={risk.color}>{riskIcon(item.risk_level)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.action}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">{item.agent_name}</span>
                        {item.expert_id && <span className="text-[11px] text-muted-foreground">· {item.expert_id}</span>}
                        <span className={`text-[11px] flex items-center gap-0.5 ${isUrgent ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                          <Clock className="w-3 h-3" /> {remaining}
                        </span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] ${risk.bg} ${risk.color}`}>
                      {risk.label}
                    </span>
                    <span className={`text-[11px] ${statusMeta.cls}`}>{statusMeta.label}</span>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="ml-6 mt-1 mb-3 rounded-xl border border-border/20 bg-card/30 p-4 space-y-4">
                      {/* 详情 */}
                      <div className="space-y-2 text-sm">
                        {item.reason && (
                          <div>
                            <span className="text-muted-foreground text-xs">原因：</span>
                            <p className="mt-0.5">{item.reason}</p>
                          </div>
                        )}
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>创建：{new Date(item.created_at).toLocaleString('zh-CN')}</span>
                          <span>过期：{item.expire_minutes} 分钟</span>
                          {item.solution_id && <span>方案：{item.solution_id}</span>}
                        </div>
                      </div>

                      {/* 审批操作 */}
                      {item.status === 'pending' && (
                        <div className="space-y-3 pt-2 border-t border-border/20">
                          <input
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="审批备注（可选）"
                            className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border/50 text-sm outline-none focus:border-primary/50"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDecide(item, 'approved')}
                              disabled={deciding === item.id}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {deciding === item.id ? '处理中...' : '通过'}
                            </button>
                            <button
                              onClick={() => handleDecide(item, 'rejected')}
                              disabled={deciding === item.id}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                              拒绝
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16 space-y-4">
            <div className="text-5xl">🛡️</div>
            <div>
              <p className="text-lg font-semibold text-foreground">暂无待审批事项</p>
              <p className="text-sm text-muted-foreground mt-1">
                高风险操作（如数据删除、批量修改）将自动触发审批流程
              </p>
            </div>
            {lastRefreshed > 0 && (
              <p className="text-[11px] text-muted-foreground">
                上次检查：{new Date(lastRefreshed).toLocaleTimeString('zh-CN')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
