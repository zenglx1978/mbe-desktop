/**
 * InvestTodayPanel — 投研方案"今日待办"仪表盘
 *
 * QuickBooks 风格：盘前提醒 + 持仓异动 + 财报日历 + 研报截止 + 快速开始
 */
import { useState, useCallback } from 'react'
import { useToolStore } from '@/stores/tool-store'
import type { SolutionConfig, WorkbenchTab } from '@/lib/solution-router'
import {
  AlertTriangle, TrendingUp, Briefcase, Globe,
  Search, FileCheck, BarChart3, LineChart,
} from 'lucide-react'
import { StatCard, QuickAction, CalculatorChips, ProfitImpactFooter } from './today-panel-shared'

interface Props {
  solution: SolutionConfig
}

interface CalendarItem {
  name: string
  type: 'earnings' | 'report' | 'review' | 'macro'
  date: string
  daysLeft: number
  urgent: boolean
}

function getMockCalendar(): CalendarItem[] {
  const now = new Date()
  const m = now.getMonth() + 1
  const d = now.getDate()
  return [
    { name: '寒武纪(688256) 年报发布', type: 'earnings', date: `${m}月${d + 2}日`, daysLeft: 2, urgent: true },
    { name: '美联储议息结果公布', type: 'macro', date: `${m}月${d + 1}日`, daysLeft: 1, urgent: true },
    { name: 'AI算力行业深度研报 截止', type: 'report', date: `${m}月${d + 5}日`, daysLeft: 5, urgent: false },
    { name: '季度策略报告交付', type: 'report', date: `${m + 1}月8日`, daysLeft: 14, urgent: false },
    { name: '月度持仓检视', type: 'review', date: `${m + 1}月1日`, daysLeft: 7, urgent: false },
  ]
}

export default function InvestTodayPanel({ solution }: Props) {
  const { setActiveTab } = useToolStore()
  const [calendar] = useState<CalendarItem[]>(getMockCalendar)

  const goToTab = useCallback((tab: WorkbenchTab) => {
    setActiveTab(tab)
  }, [setActiveTab])

  const urgentItems = calendar.filter(c => c.urgent)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* 问候 */}
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {new Date().getHours() < 12 ? '早上好' : new Date().getHours() < 18 ? '下午好' : '晚上好'}，研究员
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            以下是今日市场要闻和待办事项
          </p>
        </div>

        {/* 盘前提醒 */}
        {urgentItems.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-500">盘前提醒</span>
            </div>
            <div className="space-y-2">
              {urgentItems.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{item.name}</span>
                  <span className="text-xs font-medium text-amber-500">
                    {item.daysLeft === 0 ? '今日' : item.daysLeft === 1 ? '明日' : `${item.daysLeft} 天后`}（{item.date}）
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 状态卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Briefcase className="w-5 h-5" />}
            label="持仓标的"
            value="12"
            sub="3 只近期有财报"
            color="text-blue-500"
            bgColor="bg-blue-500/10"
            onClick={() => goToTab('portfolio' as WorkbenchTab)}
          />
          <StatCard
            icon={<Search className="w-5 h-5" />}
            label="关注标的"
            value="25"
            sub="5 只估值进入区间"
            color="text-emerald-500"
            bgColor="bg-emerald-500/10"
            onClick={() => goToTab('research' as WorkbenchTab)}
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="市场信号"
            value="BUY"
            sub="MEI 综合评分 72"
            color="text-green-500"
            bgColor="bg-green-500/10"
            onClick={() => goToTab('macro' as WorkbenchTab)}
          />
          <StatCard
            icon={<FileCheck className="w-5 h-5" />}
            label="待发布研报"
            value="3"
            sub="1 篇待合规审查"
            color="text-violet-500"
            bgColor="bg-violet-500/10"
            onClick={() => goToTab('compliance-pub' as WorkbenchTab)}
          />
        </div>

        {/* 财报 & 研报日历 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">📅 财报 & 研报日历</h3>
          </div>
          <div className="space-y-2">
            {calendar.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:border-primary/30 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${item.urgent ? 'bg-red-500/15 text-red-500' : item.daysLeft <= 7 ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                  {item.daysLeft}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.date}</div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${item.type === 'earnings' ? 'bg-blue-500/10 text-blue-500' : item.type === 'report' ? 'bg-violet-500/10 text-violet-500' : item.type === 'macro' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  {item.type === 'earnings' ? '财报' : item.type === 'report' ? '研报' : item.type === 'macro' ? '宏观' : '检视'}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.urgent ? 'bg-red-500/10 text-red-500' : item.daysLeft <= 7 ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
                  {item.urgent ? '紧急' : item.daysLeft <= 7 ? '本周' : '正常'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 快速开始 */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">⚡ 快速开始</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <QuickAction icon={<Globe className="w-5 h-5" />} title="四柱研判" desc="宏观→行业→个股→操作，完整决策链" onClick={() => goToTab('macro' as WorkbenchTab)} color="text-blue-500" />
            <QuickAction icon={<Search className="w-5 h-5" />} title="个股深度" desc="行业定位+财务+估值+投资建议" onClick={() => goToTab('research' as WorkbenchTab)} color="text-emerald-500" />
            <QuickAction icon={<BarChart3 className="w-5 h-5" />} title="行业研究" desc="景气度+竞争格局+催化剂+核心标的" onClick={() => goToTab('research' as WorkbenchTab)} color="text-violet-500" />
            <QuickAction icon={<Briefcase className="w-5 h-5" />} title="组合检视" desc="持仓回顾+风险暴露+调仓建议" onClick={() => goToTab('portfolio' as WorkbenchTab)} color="text-amber-500" />
            <QuickAction icon={<LineChart className="w-5 h-5" />} title="全球宏观" desc="WorldMonitor 七大信号+BUY/CASH" onClick={() => goToTab('macro' as WorkbenchTab)} color="text-cyan-500" />
            <QuickAction icon={<FileCheck className="w-5 h-5" />} title="研报合规" desc="内容审查+利益冲突+免责声明" onClick={() => goToTab('compliance-pub' as WorkbenchTab)} color="text-red-500" />
          </div>
        </section>

        {/* 常用工具 */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">🧮 常用工具</h3>
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
