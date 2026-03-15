/**
 * 审批面板 — Approvals Tab
 *
 * 左侧：待审批列表（按风险等级排序）
 * 右侧：审批详情 + 批准/拒绝操作
 *
 * 布局参照 DocumentsPanel：左侧列表 + 右侧详情。
 */

import { useState, useEffect } from 'react'
import { useApprovalStore } from '@/stores/approval-store'
import { RISK_META, getTimeRemaining, type ApprovalItem } from '@/lib/approval-service'
import AuditPanel from './AuditPanel'

type ApprovalView = 'pending' | 'audit'

export default function ApprovalPanel() {
  const [view, setView] = useState<ApprovalView>('pending')

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 子 Tab 切换 */}
      <div className="px-4 py-2 border-b border-border/30 flex items-center gap-1 shrink-0">
        <SubTab active={view === 'pending'} onClick={() => setView('pending')}>
          🛡 待审批
        </SubTab>
        <SubTab active={view === 'audit'} onClick={() => setView('audit')}>
          📋 审计日志
        </SubTab>
      </div>

      {view === 'pending' ? <PendingView /> : <AuditPanel />}
    </div>
  )
}

function SubTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
      }`}
    >
      {children}
    </button>
  )
}

function PendingView() {
  const { items, pendingCount, loading, selectedId, select, decide, refresh, lastRefreshed, wsConnected } = useApprovalStore()
  const [decisionNote, setDecisionNote] = useState('')
  const [deciding, setDeciding] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  const selected = selectedId ? items.find(i => i.id === selectedId) : null

  async function handleDecide(status: 'approved' | 'rejected') {
    if (!selected || deciding) return
    setDeciding(true)
    const ok = await decide(selected.id, selected.agent_name, {
      status,
      decided_by: 'desktop_user',
      decision_note: decisionNote,
    })
    setDeciding(false)
    if (ok) {
      select(null)
      setDecisionNote('')
    }
  }

  if (pendingCount === 0 && !loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-base font-medium mb-1">暂无待审批事项</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          高风险操作（如税务筹划、医疗处方）需人工确认后才会执行。审批请求到达时会在这里显示。
        </p>
        <ConnectionStatus wsConnected={wsConnected} lastRefreshed={lastRefreshed} />
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* 左侧列表 */}
      <div className="w-72 border-r border-border/50 flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">待审批</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/10 text-orange-500">
                  {pendingCount}
                </span>
              )}
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {loading ? '...' : '刷新'}
            </button>
          </div>
          <ConnectionStatus wsConnected={wsConnected} lastRefreshed={lastRefreshed} compact />
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.map(item => {
            const risk = RISK_META[item.risk_level] || RISK_META.medium
            const isSelected = item.id === selectedId
            return (
              <button
                key={item.id}
                onClick={() => select(item.id)}
                className={`w-full text-left px-4 py-3 border-b border-border/20 transition-colors ${
                  isSelected
                    ? 'bg-primary/5 border-l-2 border-l-primary'
                    : 'hover:bg-secondary/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${risk.color} ${risk.bg}`}>
                    {risk.label}风险
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 ml-auto">
                    {item.agent_name}
                  </span>
                </div>
                <div className="text-xs font-medium truncate">{item.action}</div>
                {item.reason && (
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">{item.reason}</div>
                )}
                <div className="text-[10px] text-muted-foreground/50 mt-1">
                  剩余 {getTimeRemaining(item.created_at, item.expire_minutes)}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 右侧详情 */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <ApprovalDetail
            item={selected}
            decisionNote={decisionNote}
            setDecisionNote={setDecisionNote}
            onDecide={handleDecide}
            deciding={deciding}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center h-full text-center">
            <div>
              <div className="text-3xl mb-2">👈</div>
              <p className="text-xs text-muted-foreground">选择一个审批项查看详情</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


function ApprovalDetail({
  item,
  decisionNote,
  setDecisionNote,
  onDecide,
  deciding,
}: {
  item: ApprovalItem
  decisionNote: string
  setDecisionNote: (v: string) => void
  onDecide: (status: 'approved' | 'rejected') => void
  deciding: boolean
}) {
  const risk = RISK_META[item.risk_level] || RISK_META.medium

  return (
    <div className="p-6 max-w-2xl">
      {/* 标题 */}
      <div className="flex items-start gap-3 mb-6">
        <div className={`mt-1 w-3 h-3 rounded-full shrink-0 ${
          item.risk_level === 'critical' ? 'bg-red-500' :
          item.risk_level === 'high' ? 'bg-orange-500' :
          item.risk_level === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
        }`} />
        <div>
          <h2 className="text-base font-semibold">{item.action}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {item.agent_name} · {risk.label}风险 · 剩余 {getTimeRemaining(item.created_at, item.expire_minutes)}
          </p>
        </div>
      </div>

      {/* 原因 */}
      {item.reason && (
        <div className="mb-4">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">审批原因</label>
          <p className="text-sm mt-1 p-3 rounded-lg bg-secondary/30">{item.reason}</p>
        </div>
      )}

      {/* 关联信息 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {item.expert_id && (
          <InfoField label="专家" value={item.expert_id} />
        )}
        {item.solution_id && (
          <InfoField label="方案" value={item.solution_id} />
        )}
        {item.user_id && (
          <InfoField label="发起人" value={item.user_id} />
        )}
        <InfoField label="发起时间" value={new Date(item.created_at).toLocaleString()} />
      </div>

      {/* 上下文详情 */}
      {item.context && Object.keys(item.context).length > 0 && (
        <div className="mb-6">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">操作上下文</label>
          <div className="mt-1 p-3 rounded-lg bg-secondary/20 text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">
            {Object.entries(item.context).map(([k, v]) => (
              <div key={k} className="flex gap-2 py-0.5">
                <span className="text-muted-foreground shrink-0">{k}:</span>
                <span className="break-all">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 决策区 */}
      <div className="border-t border-border/30 pt-4">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          审批备注（可选）
        </label>
        <textarea
          value={decisionNote}
          onChange={e => setDecisionNote(e.target.value)}
          placeholder="输入审批备注..."
          rows={2}
          className="w-full mt-1 px-3 py-2 rounded-lg border border-border/50 bg-background text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
        />

        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={() => onDecide('approved')}
            disabled={deciding}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-emerald-500/90 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {deciding ? '处理中...' : '✓ 批准执行'}
          </button>
          <button
            onClick={() => onDecide('rejected')}
            disabled={deciding}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {deciding ? '处理中...' : '✕ 拒绝'}
          </button>
        </div>
      </div>
    </div>
  )
}


function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-lg bg-secondary/20">
      <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{label}</div>
      <div className="text-xs font-medium mt-0.5 truncate">{value}</div>
    </div>
  )
}

function ConnectionStatus({ wsConnected, lastRefreshed, compact }: { wsConnected: boolean; lastRefreshed: number; compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
        <span className="text-[10px] text-muted-foreground/60">
          {wsConnected ? '实时推送' : '轮询模式'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 mt-4">
      <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
      <span className="text-[10px] text-muted-foreground/50">
        {wsConnected ? '实时推送已连接' : '轮询模式（WS 未连接）'}
        {lastRefreshed > 0 && ` · 上次检查：${new Date(lastRefreshed).toLocaleTimeString()}`}
      </span>
    </div>
  )
}
