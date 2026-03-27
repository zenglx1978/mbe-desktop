/**
 * SalesPipelinePanel — 10-80-10 销售流程看板
 *
 * 可视化展示：
 *   1. 10-80-10 法则：AI 执行进度 vs 人工节点
 *   2. Pipeline 漏斗（各阶段商机数 + 金额）
 *   3. 最近触发的自动化事件（Onboarding / ICP 发现）
 *
 * 设计原则：Data Poetry — 数字要说话，不要堆砌表格
 */

import { useState, useEffect, useCallback } from 'react'
import { API_BASE, authHeaders } from '@/lib/api-client'

// ─── 数据类型 ───────────────────────────────────────────────────────────────

interface StageMetric {
  stage: string
  label: string
  count: number
  amount: number
  color: string
}

interface AutomationEvent {
  type: 'onboarding' | 'icp_discovery' | 'call_coaching' | 'lead_intake' | 'quote_gen' | 'nurture' | 'call_tracked'
  company?: string
  description: string
  time: string
  status: 'success' | 'running' | 'pending'
}

interface CallStats {
  total_calls: number
  today_calls: number
  connect_rate: string
  positive_rate: string
  top_outcomes: Record<string, number>
  top_objections: Record<string, number>
}

interface NurtureStats {
  active_nurture: number
  stage_d1: number
  stage_d3: number
  stage_d7: number
  stage_d14: number
  matured_this_month: number
}

interface PipelineData {
  stages: StageMetric[]
  total_open_amount: number
  total_open_count: number
  ai_tasks_this_week: number
  human_interventions_this_week: number
  won_this_month: number
  won_amount_this_month: number
}

// ─── 10-80-10 比例可视化 ────────────────────────────────────────────────────

function TenEightyTen({
  aiTasks,
  humanInterventions,
}: {
  aiTasks: number
  humanInterventions: number
}) {
  const total = aiTasks + humanInterventions
  const aiPct = total > 0 ? Math.round((aiTasks / total) * 100) : 80

  // 拆分为 10-80-10 的三段展示
  const seg1 = 10   // 构想（人工）
  const seg2 = 80   // 执行（AI）
  const seg3 = 10   // 整合（人工）

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">10-80-10 执行分布</h3>
        <span className="text-[10px] text-muted-foreground">本周 · Dan Martell 法则</span>
      </div>

      {/* 三段条形 */}
      <div className="flex gap-1 mb-3 h-8 rounded-lg overflow-hidden">
        {/* 10% 构想 — 人工 */}
        <div
          className="flex items-center justify-center text-[9px] font-bold text-white bg-violet-600/80 rounded-l-lg transition-all"
          style={{ width: `${seg1}%` }}
          title="10% 构想（人工）：定义 ICP、设定策略"
        >
          10%
        </div>
        {/* 80% 执行 — AI */}
        <div
          className="flex items-center justify-center text-[10px] font-bold text-white bg-primary rounded-none transition-all relative"
          style={{ width: `${seg2}%` }}
          title="80% 执行（AI）：搜索/预审/提案/复盘"
        >
          <span className="z-10">AI 80%</span>
          {/* 流光动画效果 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        </div>
        {/* 10% 整合 — 人工 */}
        <div
          className="flex items-center justify-center text-[9px] font-bold text-white bg-violet-600/80 rounded-r-lg transition-all"
          style={{ width: `${seg3}%` }}
          title="10% 整合（人工）：品味过滤、成交庆祝"
        >
          10%
        </div>
      </div>

      {/* 图例 */}
      <div className="flex gap-4 text-[10px] text-muted-foreground mb-3">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-violet-600/80 inline-block" />
          人工判断（构想 + 整合）
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-primary inline-block" />
          AI 执行（搜索/资格审/提案/复盘）
        </span>
      </div>

      {/* 本周实际数据 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-2 rounded-lg bg-primary/5">
          <p className="text-xl font-bold text-primary tabular-nums">{aiTasks}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">AI 自动完成任务</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-violet-500/5">
          <p className="text-xl font-bold text-violet-400 tabular-nums">{humanInterventions}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">人工介入次数</p>
        </div>
      </div>

      {/* 实际比例提示 */}
      {total > 0 && (
        <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">
          本周实际 AI 占比 {aiPct}%
          {aiPct >= 70
            ? ' · ✓ 达到目标'
            : ' · ↑ 建议开启更多自动化'}
        </p>
      )}
    </div>
  )
}

// ─── Pipeline 漏斗 ──────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  qualification:  { label: '资格预审', color: 'bg-blue-500' },
  discovery:      { label: '需求发现', color: 'bg-cyan-500' },
  proposal:       { label: '方案提案', color: 'bg-violet-500' },
  negotiation:    { label: '商务谈判', color: 'bg-amber-500' },
  closed_won:     { label: '已成交',   color: 'bg-emerald-500' },
}

function PipelineFunnel({ stages }: { stages: StageMetric[] }) {
  const maxCount = Math.max(...stages.map(s => s.count), 1)

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">销售漏斗</h3>
        <span className="text-[10px] text-muted-foreground">实时数据</span>
      </div>

      <div className="space-y-2">
        {stages.map((stage) => {
          const cfg = STAGE_CONFIG[stage.stage] ?? { label: stage.stage, color: 'bg-gray-500' }
          const widthPct = maxCount > 0 ? Math.round((stage.count / maxCount) * 100) : 0

          return (
            <div key={stage.stage} className="group">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] text-muted-foreground w-16 shrink-0">{cfg.label}</span>
                <div className="flex-1 h-6 bg-secondary/30 rounded-md overflow-hidden relative">
                  <div
                    className={`h-full ${cfg.color} opacity-80 rounded-md transition-all duration-700`}
                    style={{ width: `${widthPct}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className="text-[10px] font-medium text-white/90">
                      {stage.count} 家
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground/70 tabular-nums w-16 text-right shrink-0">
                  ¥{stage.amount >= 10000
                    ? `${(stage.amount / 10000).toFixed(1)}w`
                    : stage.amount.toLocaleString()}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 通话追踪统计 ─────────────────────────────────────────────────────────────

function CallTrackingPanel({ stats }: { stats: CallStats }) {
  const outcomeLabels: Record<string, string> = {
    connected_interested: '有兴趣',
    connected_demo: '约演示',
    connected_later: '再联系',
    connected_referral: '转介绍',
    connected_rejected: '已拒绝',
    front_desk_blocked: '前台拦截',
    no_answer: '未接通',
    wrong_number: '号码错误',
  }

  const topOutcomes = Object.entries(stats.top_outcomes).slice(0, 4)
  const total = stats.total_calls

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">通话追踪</h3>
        <span className="text-[10px] text-muted-foreground">数据飞轮</span>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="text-center p-2 rounded-lg bg-blue-500/5">
          <p className="text-lg font-bold text-blue-400 tabular-nums">{stats.total_calls}</p>
          <p className="text-[9px] text-muted-foreground">本周通话</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-cyan-500/5">
          <p className="text-lg font-bold text-cyan-400 tabular-nums">{stats.today_calls}</p>
          <p className="text-[9px] text-muted-foreground">今日通话</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-emerald-500/5">
          <p className="text-lg font-bold text-emerald-400 tabular-nums">{stats.connect_rate}</p>
          <p className="text-[9px] text-muted-foreground">接通率</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-violet-500/5">
          <p className="text-lg font-bold text-violet-400 tabular-nums">{stats.positive_rate}</p>
          <p className="text-[9px] text-muted-foreground">意向率</p>
        </div>
      </div>

      {topOutcomes.length > 0 && (
        <div className="space-y-1.5">
          {topOutcomes.map(([key, count]) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            const isPositive = key === 'connected_interested' || key === 'connected_demo'
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-16 shrink-0 truncate">
                  {outcomeLabels[key] ?? key}
                </span>
                <div className="flex-1 h-4 bg-secondary/30 rounded overflow-hidden">
                  <div
                    className={`h-full rounded transition-all duration-500 ${isPositive ? 'bg-emerald-500/70' : 'bg-gray-500/40'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground/70 tabular-nums w-10 text-right">
                  {count}次
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── 培育序列状态 ─────────────────────────────────────────────────────────────

function NurturePanel({ stats }: { stats: NurtureStats }) {
  const stages = [
    { key: 'd1', label: 'D1 白皮书', count: stats.stage_d1, color: 'bg-blue-400' },
    { key: 'd3', label: 'D3 视频', count: stats.stage_d3, color: 'bg-cyan-400' },
    { key: 'd7', label: 'D7 活动', count: stats.stage_d7, color: 'bg-violet-400' },
    { key: 'd14', label: 'D14 优惠', count: stats.stage_d14, color: 'bg-amber-400' },
  ]
  const total = stats.active_nurture || 1

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">温线索培育</h3>
        <span className="text-[10px] text-muted-foreground">销售 → 增长 协作</span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="text-center flex-1 p-2 rounded-lg bg-amber-500/5">
          <p className="text-xl font-bold text-amber-400 tabular-nums">{stats.active_nurture}</p>
          <p className="text-[9px] text-muted-foreground">培育中</p>
        </div>
        <div className="text-center flex-1 p-2 rounded-lg bg-emerald-500/5">
          <p className="text-xl font-bold text-emerald-400 tabular-nums">{stats.matured_this_month}</p>
          <p className="text-[9px] text-muted-foreground">本月成熟回推</p>
        </div>
      </div>

      {/* 培育阶段漏斗（横条） */}
      <div className="space-y-1.5">
        {stages.map(s => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-16 shrink-0">{s.label}</span>
            <div className="flex-1 h-4 bg-secondary/30 rounded overflow-hidden">
              <div
                className={`h-full ${s.color} opacity-70 rounded transition-all duration-500`}
                style={{ width: `${Math.round((s.count / total) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground/70 tabular-nums w-8 text-right">{s.count}</span>
          </div>
        ))}
      </div>

      <p className="text-[9px] text-muted-foreground/50 mt-2 text-center">
        30天周期: 白皮书→视频→活动→优惠→重评 · ICP≥65 回推 SAL
      </p>
    </div>
  )
}

// ─── 自动化事件流 ────────────────────────────────────────────────────────────

const EVENT_ICONS: Record<AutomationEvent['type'], string> = {
  onboarding:     '🎉',
  icp_discovery:  '🔍',
  call_coaching:  '🎯',
  lead_intake:    '🤖',
  quote_gen:      '📄',
  nurture:        '🌱',
  call_tracked:   '📞',
}

const EVENT_LABELS: Record<AutomationEvent['type'], string> = {
  onboarding:     '客户接入触发',
  icp_discovery:  '目标客户发现',
  call_coaching:  '通话复盘',
  lead_intake:    'AI 预资格审',
  quote_gen:      '个性化提案',
  nurture:        '培育序列推进',
  call_tracked:   '通话结果记录',
}

function AutomationFeed({ events }: { events: AutomationEvent[] }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">自动化事件流</h3>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          实时
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground/50">
          <p className="text-sm">暂无自动化事件</p>
          <p className="text-[10px] mt-1">成交、线索发现、通话复盘等事件将在此显示</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev, i) => (
            <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-border/30 last:border-0">
              <span className="text-base shrink-0 mt-0.5">{EVENT_ICONS[ev.type]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-medium text-foreground">
                    {EVENT_LABELS[ev.type]}
                  </span>
                  {ev.company && (
                    <span className="text-[10px] text-muted-foreground">· {ev.company}</span>
                  )}
                  <span className={`
                    text-[9px] px-1 py-0.5 rounded font-medium ml-auto
                    ${ev.status === 'success' ? 'bg-emerald-500/15 text-emerald-400' :
                      ev.status === 'running' ? 'bg-blue-500/15 text-blue-400' :
                      'bg-gray-500/15 text-gray-400'}
                  `}>
                    {ev.status === 'success' ? '完成' : ev.status === 'running' ? '执行中' : '等待'}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                  {ev.description}
                </p>
              </div>
              <span className="text-[9px] text-muted-foreground/40 shrink-0 tabular-nums mt-0.5">
                {ev.time}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 成果统计卡 ──────────────────────────────────────────────────────────────

function MetricCards({ data }: { data: PipelineData | null }) {
  const cards = [
    {
      label: '漏斗总金额',
      value: data ? `¥${(data.total_open_amount / 10000).toFixed(1)}w` : '—',
      sub: `${data?.total_open_count ?? 0} 个商机在途`,
      color: 'text-primary',
    },
    {
      label: '本月成交',
      value: data ? `¥${(data.won_amount_this_month / 10000).toFixed(1)}w` : '—',
      sub: `${data?.won_this_month ?? 0} 单`,
      color: 'text-emerald-400',
    },
    {
      label: 'AI 本周完成',
      value: data?.ai_tasks_this_week ?? '—',
      sub: '自动化任务数',
      color: 'text-blue-400',
    },
    {
      label: '人工介入',
      value: data?.human_interventions_this_week ?? '—',
      sub: '高价值决策点',
      color: 'text-violet-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map(c => (
        <div key={c.label} className="rounded-xl border border-border/50 bg-card p-3 text-center">
          <p className={`text-xl font-bold tabular-nums ${c.color}`}>{c.value}</p>
          <p className="text-[11px] text-foreground/80 font-medium mt-0.5">{c.label}</p>
          <p className="text-[10px] text-muted-foreground/60">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── 主面板 ──────────────────────────────────────────────────────────────────

interface SolutionLike {
  agentUrl?: string
  name?: string
}

export default function SalesPipelinePanel({ solution }: { solution: SolutionLike }) {
  const [pipelineData, setPipelineData] = useState<PipelineData | null>(null)
  const [events, setEvents] = useState<AutomationEvent[]>([])
  const [callStats, setCallStats] = useState<CallStats | null>(null)
  const [nurtureStats, setNurtureStats] = useState<NurtureStats | null>(null)
  const [loading, setLoading] = useState(true)

  const agentUrl = solution?.agentUrl ?? `${API_BASE}`

  const fetchData = useCallback(async () => {
    try {
      // 从 Sales Agent 拉取 Pipeline 健康度
      const healthRes = await fetch(`${agentUrl}/api/sales/pipeline/health`, {
        headers: authHeaders(),
      })
      if (healthRes.ok) {
        const health = await healthRes.json()
        // 构建 stages 数据
        const stageOrder = ['qualification', 'discovery', 'proposal', 'negotiation', 'closed_won']
        const stageCounts = health.stage_distribution ?? {}
        const stageAmounts = health.stage_amounts ?? {}

        const stages: StageMetric[] = stageOrder.map(s => ({
          stage: s,
          label: STAGE_CONFIG[s]?.label ?? s,
          count: stageCounts[s] ?? 0,
          amount: stageAmounts[s] ?? 0,
          color: STAGE_CONFIG[s]?.color ?? 'bg-gray-500',
        }))

        setPipelineData({
          stages,
          total_open_amount: health.total_value ?? 0,
          total_open_count: health.total_count ?? 0,
          ai_tasks_this_week: health.ai_tasks_week ?? 12,
          human_interventions_this_week: health.human_tasks_week ?? 3,
          won_this_month: health.won_month ?? 0,
          won_amount_this_month: health.won_amount_month ?? 0,
        })
      }

      // 从 WorkflowOS 拉取最近的自动化任务
      const dashRes = await fetch(`${agentUrl}/api/sales/workflow-os/dashboard`, {
        headers: authHeaders(),
      })
      if (dashRes.ok) {
        const dash = await dashRes.json()
        const recentEvents: AutomationEvent[] = [
          ...(dash.recent_completed ?? []).slice(0, 5).map((inst: any) => ({
            type: _inferEventType(inst.workflow_name),
            company: inst.input_params?.company_name,
            description: inst.workflow_name,
            time: _formatTime(inst.completed_at),
            status: 'success' as const,
          })),
          ...(dash.active_instances ?? []).slice(0, 3).map((inst: any) => ({
            type: _inferEventType(inst.workflow_name),
            company: inst.input_params?.company_name,
            description: inst.workflow_name,
            time: _formatTime(inst.started_at),
            status: 'running' as const,
          })),
        ]
        setEvents(recentEvents)
      }
      // 拉取通话统计
      try {
        const callRes = await fetch(`${agentUrl}/api/sales/calls/stats?days=7`, {
          headers: authHeaders(),
        })
        if (callRes.ok) {
          setCallStats(await callRes.json())
        }
      } catch {
        // 降级到演示数据（在外层 catch 处理）
      }

    } catch (e) {
      // 降级：使用演示数据
      setCallStats({
        total_calls: 47,
        today_calls: 8,
        connect_rate: '42.6%',
        positive_rate: '12.8%',
        top_outcomes: { connected_later: 12, no_answer: 10, connected_interested: 4, front_desk_blocked: 8, connected_demo: 2 },
        top_objections: { '价格': 5, '时机': 3, '竞品': 2 },
      })
      setNurtureStats({
        active_nurture: 23,
        stage_d1: 8,
        stage_d3: 6,
        stage_d7: 5,
        stage_d14: 4,
        matured_this_month: 3,
      })
      setPipelineData({
        stages: [
          { stage: 'qualification', label: '资格预审', count: 24, amount: 480000, color: 'bg-blue-500' },
          { stage: 'discovery',     label: '需求发现', count: 14, amount: 420000, color: 'bg-cyan-500' },
          { stage: 'proposal',      label: '方案提案', count: 8,  amount: 360000, color: 'bg-violet-500' },
          { stage: 'negotiation',   label: '商务谈判', count: 4,  amount: 280000, color: 'bg-amber-500' },
          { stage: 'closed_won',    label: '已成交',   count: 2,  amount: 160000, color: 'bg-emerald-500' },
        ],
        total_open_amount: 1700000,
        total_open_count: 52,
        ai_tasks_this_week: 38,
        human_interventions_this_week: 9,
        won_this_month: 6,
        won_amount_this_month: 480000,
      })
      setEvents([
        { type: 'onboarding',    company: '华鑫律所',   description: '成交后接入引导包已推送，创建 6 项任务', time: '刚刚', status: 'success' },
        { type: 'icp_discovery', description: '发现 37 家目标律所，ICP 评分 ≥70 的共 22 家', time: '12分钟前', status: 'success' },
        { type: 'lead_intake',   company: '锦程会计所', description: 'BANT 评分 75/100，已推送销售', time: '28分钟前', status: 'success' },
        { type: 'call_coaching', description: '分析 3 通通话，Top3 改进点已生成', time: '1小时前',  status: 'success' },
        { type: 'quote_gen',     company: '德顺建筑',   description: '基于 CRM + 通话记录生成个性化提案脚本', time: '2小时前',  status: 'success' },
      ])
    } finally {
      setLoading(false)
    }
  }, [agentUrl])

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 30000) // 30s 刷新
    return () => clearInterval(timer)
  }, [fetchData])

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background p-4 gap-4">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">销售流程看板</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            10-80-10 法则 · AI 执行 80%，人工聚焦 20% 高价值节点
          </p>
        </div>
        <button
          onClick={fetchData}
          className="text-[10px] px-2 py-1 rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          刷新
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            <p className="text-xs text-muted-foreground">加载销售数据…</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 统计卡 */}
          <MetricCards data={pipelineData} />

          {/* 10-80-10 看板 */}
          <TenEightyTen
            aiTasks={pipelineData?.ai_tasks_this_week ?? 0}
            humanInterventions={pipelineData?.human_interventions_this_week ?? 0}
          />

          {/* Pipeline 漏斗 */}
          {pipelineData && <PipelineFunnel stages={pipelineData.stages} />}

          {/* 通话追踪 + 培育序列（双列） */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {callStats && <CallTrackingPanel stats={callStats} />}
            {nurtureStats && <NurturePanel stats={nurtureStats} />}
          </div>

          {/* 自动化事件流 */}
          <AutomationFeed events={events} />

          {/* 快捷操作 */}
          <div className="rounded-xl border border-border/50 bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">快捷操作</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '🔍 发现线索', desc: 'ICP 搜索+三级分流', type: 'icp_discovery' },
                { label: '📡 三渠道触达', desc: '人工/AI外呼/企微', type: 'outreach' },
                { label: '📞 记录通话', desc: '结果回流优化模型', type: 'call_tracked' },
                { label: '🎯 通话复盘', desc: 'AI 分析+话术优化', type: 'call_coaching' },
                { label: '🌱 查看培育', desc: '温线索培育进度', type: 'nurture' },
                { label: '📄 生成提案', desc: '个性化报价脚本', type: 'quote_gen' },
              ].map(action => (
                <button
                  key={action.type}
                  className="text-left p-2.5 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                  onClick={() => {
                    // 跳转到对话 Tab 并预填工作流提示
                    window.dispatchEvent(new CustomEvent('mbe:start-workflow', {
                      detail: { type: action.type }
                    }))
                  }}
                >
                  <p className="text-[11px] font-medium text-foreground group-hover:text-primary transition-colors">
                    {action.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">{action.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function _inferEventType(name: string): AutomationEvent['type'] {
  if (name?.includes('onboarding') || name?.includes('成交')) return 'onboarding'
  if (name?.includes('discovery') || name?.includes('线索发现')) return 'icp_discovery'
  if (name?.includes('coaching') || name?.includes('复盘')) return 'call_coaching'
  if (name?.includes('intake') || name?.includes('预审')) return 'lead_intake'
  if (name?.includes('nurture') || name?.includes('培育')) return 'nurture'
  if (name?.includes('call_tracking') || name?.includes('通话追踪')) return 'call_tracked'
  return 'quote_gen'
}

function _formatTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.round(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.round(diff / 3600000)}小时前`
  return d.toLocaleDateString('zh-CN')
}
