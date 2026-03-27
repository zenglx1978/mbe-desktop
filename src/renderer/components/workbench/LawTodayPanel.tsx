/**
 * LawTodayPanel — 律所方案 QuickBooks 风格"今日待办"仪表盘
 *
 * P0-2: 首屏是"今天有什么要做的" — 案件截止日、合同待审、开庭提醒
 * P0-3: 合同审查/文书生成/诉讼费计算 提升为首屏快捷操作
 *
 * 数据来源对应 solution.yaml 的 memory.milestone_templates:
 *   court_hearing / filing_deadline / evidence_deadline / appeal_deadline / statute_expiry / contract_expiry
 * 优先从 Dashboard API 拉数据，降级使用本地 Mock。
 */
import { useState, useCallback, useEffect } from 'react'
import { useToolStore } from '@/stores/tool-store'
import type { SolutionConfig, WorkbenchTab } from '@/lib/solution-router'
import {
  AlertTriangle, FileSignature, Scale,
  ChevronRight,
  Zap, ArrowRight, Gavel,
  BadgeDollarSign, Clock, ScrollText,
} from 'lucide-react'

interface Props {
  solution: SolutionConfig
}

interface CaseDeadline {
  caseName: string
  type: string
  date: string
  daysLeft: number
  urgent: boolean
}

interface DashboardStatCard {
  id: string; label: string; value: string; sub: string; icon: string; tab: string
}

function getMockDeadlines(): CaseDeadline[] {
  const now = new Date()
  return [
    { caseName: '张某劳动仲裁案', type: '举证期限', date: `${now.getMonth() + 1}月${now.getDate() + 3}日`, daysLeft: 3, urgent: true },
    { caseName: 'XX建工合同纠纷', type: '开庭日期', date: `${now.getMonth() + 1}月${now.getDate() + 7}日`, daysLeft: 7, urgent: false },
    { caseName: 'YY债权纠纷', type: '答辩截止', date: `${now.getMonth() + 2}月${1}日`, daysLeft: 14, urgent: false },
    { caseName: 'ZZ侵权案', type: '诉讼时效', date: `${now.getMonth() + 2}月${15}日`, daysLeft: 28, urgent: false },
  ].sort((a, b) => a.daysLeft - b.daysLeft)
}

const FALLBACK_STAT_CARDS: DashboardStatCard[] = [
  { id: 'cases', label: '进行中案件', value: '8', sub: '其中 2 件本月开庭', icon: 'scale', tab: 'cases' },
  { id: 'contracts', label: '待审合同', value: '5', sub: '3 份本周到期', icon: 'file-signature', tab: 'contracts' },
  { id: 'deadlines', label: '紧急截止', value: '0', sub: '7 天内到期', icon: 'alert', tab: 'cases' },
  { id: 'billing', label: '本月创收', value: '12 万', sub: '已收 8 万 / 待收 4 万', icon: 'dollar', tab: 'billing' },
]

const ICON_MAP: Record<string, typeof Scale> = {
  scale: Scale, 'file-signature': FileSignature, alert: AlertTriangle, dollar: BadgeDollarSign,
}
const COLOR_MAP: Record<string, { color: string; bg: string }> = {
  scale: { color: 'text-blue-500', bg: 'bg-blue-500/10' },
  'file-signature': { color: 'text-violet-500', bg: 'bg-violet-500/10' },
  alert: { color: 'text-red-500', bg: 'bg-red-500/10' },
  dollar: { color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
}

export default function LawTodayPanel({ solution }: Props) {
  const { setActiveTab } = useToolStore()
  const [deadlines, setDeadlines] = useState<CaseDeadline[]>(getMockDeadlines)
  const [statCards, setStatCards] = useState<DashboardStatCard[]>(FALLBACK_STAT_CARDS)
  const [dataSource, setDataSource] = useState<'api' | 'mock'>('mock')

  useEffect(() => {
    let cancelled = false
    async function fetchDashboard() {
      try {
        const base = solution.agents[0]?.baseUrl?.replace(/\/api\/\w+$/, '') || ''
        const res = await fetch(`${base}/api/v1/solutions/law-firm/dashboard`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data.stat_cards?.length) {
          const hasRealData = data.stat_cards.some((c: DashboardStatCard) => c.value !== '--')
          if (hasRealData) {
            setStatCards(data.stat_cards)
            setDataSource('api')
          }
        }
        if (data.deadlines?.length) setDeadlines(data.deadlines)
      } catch { /* 降级使用 Mock */ }
    }
    fetchDashboard()
    return () => { cancelled = true }
  }, [solution])

  const goToTab = useCallback((tab: WorkbenchTab) => {
    setActiveTab(tab)
  }, [setActiveTab])

  const urgentDeadlines = deadlines.filter(d => d.urgent)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* 问候 + 概览 */}
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {new Date().getHours() < 12 ? '早上好' : new Date().getHours() < 18 ? '下午好' : '晚上好'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            以下是今天的案件动态和重要截止日
          </p>
        </div>

        {/* 紧急提醒 */}
        {urgentDeadlines.length > 0 && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-semibold text-red-500">紧急截止</span>
            </div>
            <div className="space-y-2">
              {urgentDeadlines.map((d) => (
                <div key={d.caseName + d.type} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">
                    {d.caseName} — <span className="font-medium">{d.type}</span>
                  </span>
                  <span className="text-xs font-medium text-red-500">
                    还剩 {d.daysLeft} 天（{d.date}截止）
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 状态卡片网格 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => {
            const IconComp = ICON_MAP[card.icon] || Scale
            const colors = COLOR_MAP[card.icon] || { color: 'text-blue-500', bg: 'bg-blue-500/10' }
            return (
              <StatCard
                key={card.id}
                icon={<IconComp className="w-5 h-5" />}
                label={card.label}
                value={card.id === 'deadlines' && dataSource === 'mock' ? String(urgentDeadlines.length) : card.value}
                sub={card.sub}
                color={colors.color}
                bgColor={colors.bg}
                onClick={() => goToTab(card.tab as WorkbenchTab)}
              />
            )
          })}
        </div>
        {dataSource === 'mock' && (
          <p className="text-[10px] text-muted-foreground/50 text-center -mt-3">数据为演示值，连接后端后自动刷新</p>
        )}

        {/* 案件日历 — 截止日倒计时 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">📅 案件日历</h3>
            <button
              onClick={() => goToTab('cases' as WorkbenchTab)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              查看全部 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {deadlines.map((d) => (
              <div
                key={d.caseName + d.type}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:border-primary/30 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${d.urgent ? 'bg-red-500/15 text-red-500' : d.daysLeft <= 7 ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                  {d.daysLeft}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{d.caseName}</div>
                  <div className="text-xs text-muted-foreground">{d.type} · 截止 {d.date}</div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.urgent ? 'bg-red-500/10 text-red-500' : d.daysLeft <= 7 ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
                  {d.urgent ? '紧急' : d.daysLeft <= 7 ? '即将到期' : '正常'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* P0-3: 高频任务直达 */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">⚡ 快速开始</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <QuickAction
              icon={<FileSignature className="w-5 h-5" />}
              title="审查合同"
              desc="拖入合同，AI 逐条审查风险标注"
              onClick={() => goToTab('contracts' as WorkbenchTab)}
              color="text-violet-500"
            />
            <QuickAction
              icon={<Scale className="w-5 h-5" />}
              title="新建案件"
              desc="案件立案 → 证据分析 → 策略制定 → 费用预算"
              onClick={() => goToTab('cases' as WorkbenchTab)}
              color="text-blue-500"
            />
            <QuickAction
              icon={<ScrollText className="w-5 h-5" />}
              title="起草律师函"
              desc="输入事实，AI 生成可直接发送的律师函"
              onClick={() => goToTab('legal-docs' as WorkbenchTab)}
              color="text-cyan-500"
            />
            <QuickAction
              icon={<BadgeDollarSign className="w-5 h-5" />}
              title="计算诉讼费"
              desc="输入标的额，精确计算案件受理费"
              onClick={() => goToTab('billing' as WorkbenchTab)}
              color="text-emerald-500"
            />
            <QuickAction
              icon={<Clock className="w-5 h-5" />}
              title="查诉讼时效"
              desc="一般民事 3 年 / 劳动争议 1 年 / 人身损害"
              onClick={() => goToTab('tools')}
              color="text-amber-500"
            />
            <QuickAction
              icon={<Gavel className="w-5 h-5" />}
              title="庭审转写"
              desc="上传录音 → Whisper 本地转写 → 法律要点提取"
              onClick={() => goToTab('chat')}
              color="text-rose-500"
            />
          </div>
        </section>

        {/* 常用计算器 */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">🧮 常用计算器</h3>
          <div className="flex flex-wrap gap-2">
            {solution.tools.filter(t => t.type === 'calculator').map((tool) => (
              <button
                key={tool.id}
                onClick={() => goToTab('tools')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-card text-sm hover:border-primary/30 hover:bg-primary/5 transition-colors"
              >
                <span>{tool.icon}</span>
                <span className="text-foreground">{tool.name}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
              </button>
            ))}
          </div>
        </section>

        {/* 利润影响提示 */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-foreground mb-1">{solution.entrepreneurPurpose}</div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {solution.profitMetrics.map((m, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{m}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, color, bgColor, onClick }: {
  icon: React.ReactNode; label: string; value: string; sub: string
  color: string; bgColor: string; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-sm transition-all group"
    >
      <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center ${color} mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-foreground tracking-tight">{value}</div>
      <div className="text-xs font-medium text-foreground/80 mt-0.5">{label}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>
    </button>
  )
}

function QuickAction({ icon, title, desc, color, onClick }: {
  icon: React.ReactNode; title: string; desc: string; color: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-sm transition-all text-left group"
    >
      <div className={`w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center ${color} group-hover:bg-primary/10 transition-colors shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{desc}</div>
      </div>
    </button>
  )
}
