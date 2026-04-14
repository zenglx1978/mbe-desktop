/**
 * HkFinanceTodayPanel — 香港財稅方案 QuickBooks 風格"今日待辦"儀表盤
 *
 * 適配香港稅制：利得稅(Profits Tax)、薪俸稅(Salaries Tax)、物業稅(Property Tax)
 * 無增值稅/發票體系，使用銀行月結單、審計報告、IRD 表格為核心業務對象
 *
 * 設計參考 QuickBooks Dashboard: 待處理 → 異常提醒 → 申報倒計時 → 快捷操作
 */
import { useState, useCallback } from 'react'
import { useToolStore } from '@/stores/tool-store'
import type { SolutionConfig, WorkbenchTab } from '@/lib/solution-router'
import {
  AlertTriangle, FileText, Landmark, Calculator,
  TrendingUp, ChevronRight, CheckCircle2,
  CalendarClock, Zap, ArrowRight, Shield, Globe,
} from 'lucide-react'

interface Props {
  solution: SolutionConfig
}

interface TaxDeadline {
  name: string
  date: string
  daysLeft: number
  urgent: boolean
}

function getHkTaxDeadlines(): TaxDeadline[] {
  const now = new Date()
  const year = now.getFullYear()
  const deadlines: TaxDeadline[] = []

  const profitsTaxDate = new Date(year, 3, 1)
  if (profitsTaxDate <= now) profitsTaxDate.setFullYear(profitsTaxDate.getFullYear() + 1)
  const ptDays = Math.ceil((profitsTaxDate.getTime() - now.getTime()) / 86400000)
  deadlines.push({
    name: '利得稅報稅表 (BIR51/52)',
    date: `${profitsTaxDate.getFullYear()}年4月1日`,
    daysLeft: ptDays,
    urgent: ptDays <= 14,
  })

  const employerReturnDate = new Date(year, 4, 31)
  if (employerReturnDate <= now) employerReturnDate.setFullYear(employerReturnDate.getFullYear() + 1)
  const erDays = Math.ceil((employerReturnDate.getTime() - now.getTime()) / 86400000)
  deadlines.push({
    name: '僱主報稅表 (BIR56A)',
    date: `${employerReturnDate.getFullYear()}年5月31日`,
    daysLeft: erDays,
    urgent: erDays <= 14,
  })

  const salariesTaxDate = new Date(year, 6, 2)
  if (salariesTaxDate <= now) salariesTaxDate.setFullYear(salariesTaxDate.getFullYear() + 1)
  const stDays = Math.ceil((salariesTaxDate.getTime() - now.getTime()) / 86400000)
  deadlines.push({
    name: '個別人士報稅表 (BIR60)',
    date: `${salariesTaxDate.getFullYear()}年7月2日`,
    daysLeft: stDays,
    urgent: stDays <= 14,
  })

  const bizRegDate = new Date(year, 2, 31)
  if (bizRegDate <= now) bizRegDate.setFullYear(bizRegDate.getFullYear() + 1)
  const brDays = Math.ceil((bizRegDate.getTime() - now.getTime()) / 86400000)
  deadlines.push({
    name: '商業登記證續期',
    date: `${bizRegDate.getFullYear()}年3月31日`,
    daysLeft: brDays,
    urgent: brDays <= 14,
  })

  return deadlines.sort((a, b) => a.daysLeft - b.daysLeft)
}

export default function HkFinanceTodayPanel({ solution }: Props) {
  const { setActiveTab, navigateToChat } = useToolStore()
  const [deadlines] = useState<TaxDeadline[]>(getHkTaxDeadlines)

  const goToTab = useCallback((tab: WorkbenchTab) => {
    setActiveTab(tab)
  }, [setActiveTab])

  const urgentDeadlines = deadlines.filter(d => d.urgent)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* 問候 + 概覽 */}
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {new Date().getHours() < 12 ? '早晨好' : new Date().getHours() < 18 ? '午安' : '晚上好'}
            <span className="text-sm font-normal text-muted-foreground ml-2">🇭🇰 香港財稅工作台</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            以下是近期的稅務申報截止日和待辦事項
          </p>
        </div>

        {/* 緊急提醒 */}
        {urgentDeadlines.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-500">緊急提醒</span>
            </div>
            <div className="space-y-2">
              {urgentDeadlines.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{d.name}</span>
                  <span className="text-xs font-medium text-amber-500">
                    還剩 {d.daysLeft} 天（{d.date}截止）
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 狀態卡片網格 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Landmark className="w-5 h-5" />}
            label="月結單待處理"
            value="6"
            sub="本月新收銀行對賬單"
            color="text-blue-500"
            bgColor="bg-blue-500/10"
            onClick={() => navigateToChat('幫我整理本月銀行月結單，解析交易記錄')}
          />
          <StatCard
            icon={<AlertTriangle className="w-5 h-5" />}
            label="可疑交易"
            value="2"
            sub="待 AML 合規審查"
            color="text-amber-500"
            bgColor="bg-amber-500/10"
            onClick={() => navigateToChat('幫我進行 AML/KYC 客戶篩查')}
          />
          <StatCard
            icon={<CalendarClock className="w-5 h-5" />}
            label="即將到期申報"
            value={String(urgentDeadlines.length)}
            sub="14天內截止"
            color="text-red-500"
            bgColor="bg-red-500/10"
            onClick={() => goToTab('tax-filing' as WorkbenchTab)}
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="本月已完成"
            value="5"
            sub="稅務 / 合規任務"
            color="text-emerald-500"
            bgColor="bg-emerald-500/10"
          />
        </div>

        {/* 申報日曆 — 倒計時 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">📅 IRD 申報倒計時</h3>
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
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${d.urgent ? 'bg-red-500/15 text-red-500' : d.daysLeft <= 30 ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                  {d.daysLeft}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{d.name}</div>
                  <div className="text-xs text-muted-foreground">截止日: {d.date}</div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.urgent ? 'bg-red-500/10 text-red-500' : d.daysLeft <= 30 ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
                  {d.urgent ? '緊急' : d.daysLeft <= 30 ? '即將到期' : '正常'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 快速開始 — 香港業務場景 */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">⚡ 快速開始</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <QuickAction
              icon={<Calculator className="w-5 h-5" />}
              title="利得稅計算"
              desc="兩級稅率：首 HKD 200 萬 @ 8.25%，餘額 @ 16.5%"
              onClick={() => navigateToChat('我的香港有限公司 2024/25 年度帳面利潤 HKD 500 萬，請計算應繳利得稅及暫繳稅')}
              color="text-blue-500"
            />
            <QuickAction
              icon={<Landmark className="w-5 h-5" />}
              title="銀行月結單整理"
              desc="上傳港銀月結單，AI 自動解析交易"
              onClick={() => navigateToChat('幫我整理銀行月結單，解析交易記錄並標記可疑交易')}
              color="text-violet-500"
            />
            <QuickAction
              icon={<Globe className="w-5 h-5" />}
              title="離岸豁免評估"
              desc="評估離岸收入是否符合豁免條件"
              onClick={() => navigateToChat('我公司有一筆來自海外客戶的收入，請評估是否符合離岸豁免條件')}
              color="text-emerald-500"
            />
            <QuickAction
              icon={<TrendingUp className="w-5 h-5" />}
              title="轉移定價分析"
              desc="關聯交易獨立交易原則 (ALP) 分析"
              onClick={() => navigateToChat('我們與關聯公司之間有交易，請幫我做轉移定價可比性分析')}
              color="text-amber-500"
            />
            <QuickAction
              icon={<Shield className="w-5 h-5" />}
              title="AML/KYC 篩查"
              desc="客戶盡職調查與合規篩查"
              onClick={() => navigateToChat('幫我對一位新客戶進行 AML/KYC 盡職調查')}
              color="text-red-500"
            />
            <QuickAction
              icon={<FileText className="w-5 h-5" />}
              title="年度審計準備"
              desc="生成審計材料清單 + 合規預警"
              onClick={() => navigateToChat('幫我準備年度審計所需材料清單，檢查是否有合規風險')}
              color="text-cyan-500"
            />
          </div>
        </section>

        {/* 常用計算器 */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">🧮 常用計算器</h3>
          <div className="flex flex-wrap gap-2">
            {solution.tools.filter(t => t.type === 'calculator').length > 0
              ? solution.tools.filter(t => t.type === 'calculator').map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => goToTab('tools')}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-card text-sm hover:border-primary/30 hover:bg-primary/5 transition-colors"
                  >
                    <span>{tool.icon}</span>
                    <span className="text-foreground">{tool.name}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  </button>
                ))
              : (
                  <>
                    <CalcButton label="利得稅計算" icon="🧮" onClick={() => navigateToChat('/利得稅')} />
                    <CalcButton label="薪俸稅估算" icon="💰" onClick={() => navigateToChat('幫我估算香港薪俸稅')} />
                    <CalcButton label="印花稅計算" icon="🏠" onClick={() => navigateToChat('幫我計算香港物業印花稅')} />
                    <CalcButton label="暫繳稅計算" icon="📊" onClick={() => navigateToChat('幫我計算暫繳利得稅金額')} />
                  </>
                )
            }
          </div>
        </section>

        {/* 利潤影響提示 */}
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
      className="flex flex-col p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-sm transition-all text-left"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bgColor} ${color}`}>
          {icon}
        </div>
        {onClick && <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
      </div>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-xs font-medium text-foreground mt-1">{label}</span>
      <span className="text-[11px] text-muted-foreground">{sub}</span>
    </button>
  )
}

function QuickAction({ icon, title, desc, onClick, color }: {
  icon: React.ReactNode; title: string; desc: string
  onClick: () => void; color: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-sm transition-all text-left group"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-muted/50 ${color} shrink-0 group-hover:scale-105 transition-transform`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{desc}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0 mt-1 group-hover:text-primary transition-colors" />
    </button>
  )
}

function CalcButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-card text-sm hover:border-primary/30 hover:bg-primary/5 transition-colors"
    >
      <span>{icon}</span>
      <span className="text-foreground">{label}</span>
      <ArrowRight className="w-3 h-3 text-muted-foreground" />
    </button>
  )
}
