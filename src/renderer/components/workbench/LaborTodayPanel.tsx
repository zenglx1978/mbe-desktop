/**
 * LaborTodayPanel — 劳务派遣方案"今日待办"仪表盘
 *
 * QuickBooks 风格：合同到期提醒 + 结算截止 + 合规预警 + 状态卡片 + 快速开始
 * 优先从 Dashboard API 拉数据，降级使用本地 Mock。
 */
import { useState, useCallback, useEffect } from 'react'
import { useToolStore } from '@/stores/tool-store'
import type { SolutionConfig, WorkbenchTab } from '@/lib/solution-router'
import {
  AlertTriangle, Users, Banknote, ShieldAlert,
  Gavel, FileText, UserPlus, Calculator,
} from 'lucide-react'
import { StatCard, QuickAction, CalculatorChips, ProfitImpactFooter } from './today-panel-shared'

interface Props {
  solution: SolutionConfig
}

interface DeadlineItem {
  name: string
  type: 'contract' | 'settlement' | 'compliance'
  date: string
  daysLeft: number
  urgent: boolean
}

interface DashboardStatCard {
  id: string
  label: string
  value: string
  sub: string
  icon: string
  tab: string
}

function getMockDeadlines(): DeadlineItem[] {
  const now = new Date()
  return [
    { name: '王某某劳动合同到期', type: 'contract', date: `${now.getMonth() + 1}月${now.getDate() + 3}日`, daysLeft: 3, urgent: true },
    { name: '3月薪资结算截止', type: 'settlement', date: `${now.getMonth() + 1}月${now.getDate() + 5}日`, daysLeft: 5, urgent: true },
    { name: '张某某试用期届满', type: 'contract', date: `${now.getMonth() + 1}月${now.getDate() + 7}日`, daysLeft: 7, urgent: false },
    { name: '季度派遣比例合规申报', type: 'compliance', date: `${now.getMonth() + 2}月15日`, daysLeft: 21, urgent: false },
    { name: '李某某社保转移截止', type: 'compliance', date: `${now.getMonth() + 2}月20日`, daysLeft: 26, urgent: false },
  ]
}

const FALLBACK_STAT_CARDS: DashboardStatCard[] = [
  { id: 'employees', label: '在岗派遣工', value: '156', sub: '5 人待入职', icon: 'users', tab: 'employees' },
  { id: 'payroll', label: '本月待结算', value: '¥48.6万', sub: '156 人薪资', icon: 'banknote', tab: 'payroll' },
  { id: 'compliance', label: '合规预警', value: '2', sub: '合同到期 / 比例超标', icon: 'shield', tab: 'compliance' },
  { id: 'disputes', label: '待处理纠纷', value: '1', sub: '仲裁阶段', icon: 'gavel', tab: 'disputes' },
]

const STAT_ICON_MAP: Record<string, typeof Users> = {
  users: Users, banknote: Banknote, shield: ShieldAlert, gavel: Gavel,
}
const STAT_COLOR_MAP: Record<string, { color: string; bg: string }> = {
  users: { color: 'text-blue-500', bg: 'bg-blue-500/10' },
  banknote: { color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  shield: { color: 'text-amber-500', bg: 'bg-amber-500/10' },
  gavel: { color: 'text-red-500', bg: 'bg-red-500/10' },
}

export default function LaborTodayPanel({ solution }: Props) {
  const { setActiveTab } = useToolStore()
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>(getMockDeadlines)
  const [statCards, setStatCards] = useState<DashboardStatCard[]>(FALLBACK_STAT_CARDS)
  const [dataSource, setDataSource] = useState<'api' | 'mock'>('mock')

  useEffect(() => {
    let cancelled = false
    async function fetchDashboard() {
      try {
        const base = solution.agents[0]?.baseUrl?.replace(/\/api\/\w+$/, '') || ''
        const res = await fetch(`${base}/api/v1/solutions/labor-dispatch/dashboard`)
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

        {/* 问候 */}
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {new Date().getHours() < 12 ? '早上好' : new Date().getHours() < 18 ? '下午好' : '晚上好'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            以下是今天的待办事项和重要提醒
          </p>
        </div>

        {/* 紧急提醒 */}
        {urgentDeadlines.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-500">紧急提醒</span>
            </div>
            <div className="space-y-2">
              {urgentDeadlines.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{d.name}</span>
                  <span className="text-xs font-medium text-amber-500">
                    还剩 {d.daysLeft} 天（{d.date}截止）
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 状态卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => {
            const IconComp = STAT_ICON_MAP[card.icon] || Users
            const colors = STAT_COLOR_MAP[card.icon] || { color: 'text-blue-500', bg: 'bg-blue-500/10' }
            return (
              <StatCard
                key={card.id}
                icon={<IconComp className="w-5 h-5" />}
                label={card.label}
                value={card.value}
                sub={card.sub}
                color={colors.color}
                bgColor={colors.bg}
                onClick={() => goToTab(card.tab as WorkbenchTab)}
              />
            )
          })}
        </div>
        {dataSource === 'mock' && (
          <p className="text-[11px] text-muted-foreground/50 text-center -mt-3">数据为演示值，连接后端后自动刷新</p>
        )}

        {/* 截止日历 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">📅 截止日历</h3>
          </div>
          <div className="space-y-2">
            {deadlines.map((d) => (
              <div
                key={d.name}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:border-primary/30 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${d.urgent ? 'bg-red-500/15 text-red-500' : d.daysLeft <= 7 ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                  {d.daysLeft}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{d.name}</div>
                  <div className="text-xs text-muted-foreground">截止日: {d.date}</div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${d.type === 'contract' ? 'bg-blue-500/10 text-blue-500' : d.type === 'settlement' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-violet-500/10 text-violet-500'}`}>
                  {d.type === 'contract' ? '合同' : d.type === 'settlement' ? '结算' : '合规'}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.urgent ? 'bg-red-500/10 text-red-500' : d.daysLeft <= 7 ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
                  {d.urgent ? '紧急' : d.daysLeft <= 7 ? '即将到期' : '正常'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 快速开始 */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">⚡ 快速开始</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <QuickAction icon={<UserPlus className="w-5 h-5" />} title="新员工入职" desc="入职流程：招聘→签合同→社保增员" onClick={() => goToTab('employees' as WorkbenchTab)} color="text-blue-500" />
            <QuickAction icon={<Banknote className="w-5 h-5" />} title="薪资结算" desc="考勤→工资→社保→个税→发放" onClick={() => goToTab('payroll' as WorkbenchTab)} color="text-emerald-500" />
            <QuickAction icon={<FileText className="w-5 h-5" />} title="审查合同" desc="上传派遣协议，AI 逐条审查风险" onClick={() => goToTab('compliance' as WorkbenchTab)} color="text-violet-500" />
            <QuickAction icon={<Calculator className="w-5 h-5" />} title="赔偿计算" desc="经济补偿 N/N+1/2N 精确计算" onClick={() => goToTab('tools')} color="text-amber-500" />
            <QuickAction icon={<ShieldAlert className="w-5 h-5" />} title="派遣比例检测" desc="检查用工比例是否超过 10% 上限" onClick={() => goToTab('compliance' as WorkbenchTab)} color="text-red-500" />
            <QuickAction icon={<Gavel className="w-5 h-5" />} title="纠纷处理" desc="辞退方案 + 赔偿金额 + 仲裁应对" onClick={() => goToTab('disputes' as WorkbenchTab)} color="text-orange-500" />
          </div>
        </section>

        {/* 常用计算器 */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">🧮 常用计算器</h3>
          <div className="flex flex-wrap gap-2">
            <CalculatorChips solution={solution} onOpenTools={() => goToTab('tools')} />
          </div>
        </section>

        {/* 利润影响 */}
        <ProfitImpactFooter solution={solution} />
      </div>
    </div>
  )
}
