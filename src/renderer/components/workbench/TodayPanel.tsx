/**
 * TodayPanel — QuickBooks 风格"今日待办"仪表盘
 *
 * P0-2: 首屏不是抽象 workflow 卡片，而是"今天有什么要做的"
 * P0-3: 发票检查/税负测算/年审准备 提升为主要入口
 * P2-11: 常用计算器内联到操作流中
 *
 * 设计参考 QuickBooks Dashboard: 待处理 → 异常提醒 → 申报倒计时 → 快捷操作
 */
import { useState, useCallback } from 'react'
import { useToolStore } from '@/stores/tool-store'
import type { SolutionConfig, WorkbenchTab } from '@/lib/solution-router'
import {
  AlertTriangle, FileText, Receipt, Calculator,
  TrendingUp, ChevronRight, CheckCircle2,
  CalendarClock,
} from 'lucide-react'
import { StatCard, QuickAction, CalculatorChips, ProfitImpactFooter, HelpGuideSection } from './today-panel-shared'

interface Props {
  solution: SolutionConfig
}

interface TaxDeadline {
  name: string
  date: string
  daysLeft: number
  urgent: boolean
}

function getUpcomingDeadlines(): TaxDeadline[] {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const deadlines: TaxDeadline[] = []

  const vatDate = new Date(year, month, 15)
  if (vatDate <= now) vatDate.setMonth(vatDate.getMonth() + 1)
  const vatDays = Math.ceil((vatDate.getTime() - now.getTime()) / 86400000)
  deadlines.push({ name: '稅務申報', date: `${vatDate.getMonth() + 1}月${vatDate.getDate()}日`, daysLeft: vatDays, urgent: vatDays <= 3 })

  const citDate = new Date(year, month + 1 - (month % 3 === 0 ? 0 : month % 3), 15)
  if (citDate <= now) citDate.setMonth(citDate.getMonth() + 3)
  const citDays = Math.ceil((citDate.getTime() - now.getTime()) / 86400000)
  deadlines.push({ name: '企业所得税季度预缴', date: `${citDate.getMonth() + 1}月${citDate.getDate()}日`, daysLeft: citDays, urgent: citDays <= 5 })

  const iitDate = new Date(year, month, 15)
  if (iitDate <= now) iitDate.setMonth(iitDate.getMonth() + 1)
  const iitDays = Math.ceil((iitDate.getTime() - now.getTime()) / 86400000)
  deadlines.push({ name: '个税代扣代缴', date: `${iitDate.getMonth() + 1}月${iitDate.getDate()}日`, daysLeft: iitDays, urgent: iitDays <= 3 })

  return deadlines.sort((a, b) => a.daysLeft - b.daysLeft)
}

export default function TodayPanel({ solution }: Props) {
  const { setActiveTab, navigateToChat } = useToolStore()
  const [deadlines] = useState<TaxDeadline[]>(getUpcomingDeadlines)

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

        {/* 状态卡片网格 — 类似 QuickBooks 顶部统计 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Receipt className="w-5 h-5" />}
            label="待记账凭证"
            value="12"
            sub="本月新增发票"
            color="text-blue-500"
            bgColor="bg-blue-500/10"
            onClick={() => goToTab('bookkeeping' as WorkbenchTab)}
          />
          <StatCard
            icon={<AlertTriangle className="w-5 h-5" />}
            label="异常待处理"
            value="3"
            sub="发票/余额异常"
            color="text-amber-500"
            bgColor="bg-amber-500/10"
            onClick={() => goToTab('invoices' as WorkbenchTab)}
          />
          <StatCard
            icon={<CalendarClock className="w-5 h-5" />}
            label="即将到期申报"
            value={String(urgentDeadlines.length)}
            sub="3天内截止"
            color="text-red-500"
            bgColor="bg-red-500/10"
            onClick={() => goToTab('tax-filing' as WorkbenchTab)}
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="本月已完成"
            value="8"
            sub="任务 / 流程"
            color="text-emerald-500"
            bgColor="bg-emerald-500/10"
          />
        </div>

        {/* 申报日历 — 倒计时 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">📅 申报倒计时</h3>
            <button
              onClick={() => goToTab('tax-filing' as WorkbenchTab)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              查看全部 <ChevronRight className="w-3 h-3" />
            </button>
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
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.urgent ? 'bg-red-500/10 text-red-500' : d.daysLeft <= 7 ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
                  {d.urgent ? '紧急' : d.daysLeft <= 7 ? '即将到期' : '正常'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* P0-3: 高频任务直达 — 从辅助工具提升为主要场景 */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">⚡ 快速开始</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <QuickAction
              icon={<Receipt className="w-5 h-5" />}
              title="录入发票"
              desc="上传发票图片，AI 自动生成凭证"
              onClick={() => goToTab('bookkeeping' as WorkbenchTab)}
              color="text-blue-500"
            />
            <QuickAction
              icon={<FileText className="w-5 h-5" />}
              title="审查合同"
              desc="上传合同，AI 逐条审查风险"
              onClick={() => navigateToChat('帮我审查合同，标注风险条款并给出修改建议')}
              color="text-violet-500"
            />
            <QuickAction
              icon={<Calculator className="w-5 h-5" />}
              title="算税"
              desc="個稅 / 薪俸稅 / 印花稅 / 利得稅"
              onClick={() => goToTab('tools')}
              color="text-emerald-500"
            />
            <QuickAction
              icon={<TrendingUp className="w-5 h-5" />}
              title="税负分析"
              desc="测算企业综合税负率，对标行业"
              onClick={() => goToTab('tax-planning' as WorkbenchTab)}
              color="text-amber-500"
            />
            <QuickAction
              icon={<AlertTriangle className="w-5 h-5" />}
              title="发票合规检查"
              desc="批量检查发票合规性，标注异常"
              onClick={() => goToTab('invoices' as WorkbenchTab)}
              color="text-red-500"
            />
            <QuickAction
              icon={<FileText className="w-5 h-5" />}
              title="年审准备"
              desc="生成审计材料清单 + 异常预警"
              onClick={() => goToTab('reports' as WorkbenchTab)}
              color="text-cyan-500"
            />
          </div>
        </section>

        {/* P2-11: 内联计算器 */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">🧮 常用计算器</h3>
          <div className="flex flex-wrap gap-2">
            <CalculatorChips solution={solution} onOpenTools={() => goToTab('tools')} />
          </div>
        </section>

        {/* 快速入门帮助 */}
        <HelpGuideSection solution={solution} />

        {/* 利润影响提示 */}
        <ProfitImpactFooter solution={solution} />
      </div>
    </div>
  )
}
