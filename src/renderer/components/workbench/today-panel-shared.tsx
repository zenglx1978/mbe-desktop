/**
 * TodayPanel 共享原语 — 各方案"今日待办"仪表盘复用的基础组件
 *
 * 抽取自 TodayPanel / LaborTodayPanel / InvestTodayPanel / HkFinanceTodayPanel
 * 中逐字重复的子组件，消除 4× 复制粘贴。各面板的领域逻辑（截止日历、紧急提醒、
 * 快速开始列表）仍保留在各自文件中，仅共用以下与领域无关的原语。
 *
 * 注意：LawTodayPanel 的 StatCard/QuickAction 采用了不同的视觉变体，保留其本地实现，
 * 不强行统一以避免外观回归；但其 footer / 计算器 chip 与多数派一致，可复用此处。
 */
import { useState, useCallback } from 'react'
import type { SolutionConfig } from '@/lib/solution-router'
import { ChevronRight, ArrowRight, Zap, BookOpen, ChevronDown, ChevronUp, Keyboard, Lightbulb } from 'lucide-react'

// ── 各方案快速入门步骤（按 solution.id 映射）──
interface GuideStep {
  icon: string
  title: string
  desc: string
}

const SOLUTION_GUIDE_STEPS: Record<string, GuideStep[]> = {
  'investment-research': [
    { icon: '🌐', title: '宏观研判（第1步）', desc: '前往「宏观」tab → 运行四柱第1步，判断当前市场是否适合加仓（BUY / CASH）。' },
    { icon: '📊', title: '选股研究（第2步）', desc: '在「组合」tab 点击任意自选股卡片 → 自动跳转 stock_screening 工作流，query 自动预填。' },
    { icon: '🎯', title: 'MISES 五维评分', desc: '在「工具」tab 使用 MISES 评分计算器，对候选标的进行量化评估（M/I/S/E/S 五维）。' },
    { icon: '📄', title: '导出研报', desc: '工作流分析完成后点击「导出研报」CTA，生成可打印的 PDF 或可演示的 PPTX。' },
  ],
  'finance-tax-service': [
    { icon: '📋', title: '上传发票记账', desc: '前往「记账」tab，上传本月发票 → AI 自动归类、生成借贷凭证，无需手动录入。' },
    { icon: '🧮', title: '税务申报计算', desc: '前往「报税」tab，AI 计算增值税 / 个税 / 企业所得税应纳税额，自动核对截止日期。' },
    { icon: '📊', title: '生成财务报告', desc: '前往「报告」tab，一键生成资产负债表 + 利润表 + 现金流量表，自动勾稽校验。' },
    { icon: '🔍', title: '税务筹划', desc: '在「工具」使用计算器快速验算，或直接在 Chat 输入「/筹划」发起税务优化方案。' },
  ],
  'law-firm': [
    { icon: '⚖️', title: '创建案件', desc: '前往「案件」tab，建立案件看板 → 上传证据材料 → AI 协助 IRAC 法律分析。' },
    { icon: '📋', title: '合同审查', desc: '前往「合同」tab，粘贴或上传合同文本 → AI 逐条标注风险条款并给出修改建议。' },
    { icon: '💰', title: '收费核算', desc: '前往「收费」tab，按工时或风险代理自动计算律师费，生成收费清单。' },
    { icon: '📄', title: '法律文书起草', desc: '在「法律文书」tab 选择文书模板（起诉状 / 仲裁申请书 / 律师函），AI 辅助起草。' },
  ],
  'labor-dispatch': [
    { icon: '👷', title: '员工花名册', desc: '前往「员工」tab，查看派遣工看板，录入人员变动、合同续签提醒。' },
    { icon: '💰', title: '月度薪资结算', desc: '前往「薪资结算」tab，导入考勤 → AI 计算个税代扣 + 社保扣缴 + 实发工资。' },
    { icon: '🛡️', title: '合规检查', desc: '前往「合规检查」tab，一键检测用工比例（≤10%）、三性认定、同工同酬状态。' },
    { icon: '⚖️', title: '纠纷应对', desc: '在「纠纷处理」tab 输入情况 → AI 分析赔偿金额（N/N+1/2N）并给出应对策略。' },
  ],
  'hk-finance-tax': [
    { icon: '📋', title: '帳務處理', desc: '前往「帳務」tab，上傳銀行月結單 → AI 按 HKFRS 生成會計分錄，自動校驗科目。' },
    { icon: '🧮', title: '利得稅申報', desc: '前往「稅務申報」tab，計算利得稅 / 薪俸稅 / 物業稅，確認截止日期（4月）。' },
    { icon: '🌏', title: '跨境稅務規劃', desc: '在 Chat 輸入「分析 HK/內地 DTA 節稅機會」，AI 評估轉移定價合規風險。' },
    { icon: '📊', title: 'HKFRS 財務報告', desc: '前往「財務報告」tab，一鍵編制三大報表，自動檢查 HKFRS 披露要求。' },
  ],
}

/** 通用快速入门步骤（兜底，找不到 solution.id 时使用） */
const DEFAULT_GUIDE_STEPS: GuideStep[] = [
  { icon: '🚀', title: '从今日概览开始', desc: '点击任意状态卡片跳转对应功能模块，完成当日最重要的任务。' },
  { icon: '⚡', title: '使用快捷操作', desc: '「我要...」区域中的快捷按钮可一键发起最常用的 AI 分析，无需手动输入。' },
  { icon: '🔧', title: '工具计算器', desc: '在「工具」tab 使用各类计算器，精确计算税额 / 赔偿金 / 造价等数值结果。' },
  { icon: '💬', title: 'Slash 命令', desc: '在任意 Chat 输入框中输入「/」，快速发起专业查询（如 /税率、/评分）。' },
]

/**
 * HelpGuideSection — 集成到"今日概览"的快速入门帮助区域
 *
 * - 默认折叠，点击展开
 * - 折叠状态持久化到 localStorage（方案级别，避免每次重复展示）
 * - 展示 4 个入门步骤 + Slash 命令快捷键
 */
export function HelpGuideSection({ solution }: { solution: SolutionConfig }) {
  const storageKey = `mbe-help-guide-open-${solution.id}`
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(storageKey) !== 'false' }
    catch { return true }
  })

  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev
      try { localStorage.setItem(storageKey, String(next)) } catch {}
      return next
    })
  }, [storageKey])

  const steps = SOLUTION_GUIDE_STEPS[solution.id] ?? DEFAULT_GUIDE_STEPS
  const slashCmds = solution.slashCommands ?? []

  return (
    <section className="rounded-xl border border-border/50 bg-card overflow-hidden">
      {/* 折叠标题栏 */}
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">快速入门指南</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {steps.length} 个步骤
          </span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/30">
          {/* 入门步骤 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
            {steps.map((step, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/40"
              >
                <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center text-base shrink-0 border border-border/40">
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold text-primary/60 uppercase tracking-wide">步骤 {i + 1}</span>
                  </div>
                  <div className="text-sm font-semibold text-foreground">{step.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Slash 命令 */}
          {slashCmds.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Keyboard className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">快捷命令（在 Chat 输入框中输入）</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {slashCmds.map((cmd) => (
                  <div
                    key={cmd.cmd}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 border border-border/40 text-xs"
                  >
                    <span className="font-mono font-bold text-primary">{cmd.cmd}</span>
                    <span className="text-muted-foreground">{cmd.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 提示 */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-2">
            <Lightbulb className="w-3.5 h-3.5 shrink-0 text-amber-500" />
            <span>每个 tab 的「我要...」区域列出了该模块最常用的操作，点击即可发起 AI 分析。</span>
          </div>
        </div>
      )}
    </section>
  )
}

/** 顶部统计卡片（多数派变体：图标+右上 chevron，下方大数字） */
export function StatCard({ icon, label, value, sub, color, bgColor, onClick }: {
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

/** 快速开始动作卡片（多数派变体：p-4，左图标右 chevron） */
export function QuickAction({ icon, title, desc, onClick, color }: {
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

/** 计算器 chip（emoji 图标 + 名称 + 箭头） */
export function CalcButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
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

/**
 * 计算器 chip 行：渲染 solution 中 type==='calculator' 的工具。
 * 无计算器工具且提供 fallback 时渲染 fallback（HkFinance 用到）。
 */
export function CalculatorChips({ solution, onOpenTools, fallback }: {
  solution: SolutionConfig; onOpenTools: () => void; fallback?: React.ReactNode
}) {
  const calcs = solution.tools.filter(t => t.type === 'calculator')
  if (calcs.length === 0 && fallback) return <>{fallback}</>
  return (
    <>
      {calcs.map((tool) => (
        <CalcButton key={tool.id} icon={tool.icon} label={tool.name} onClick={onOpenTools} />
      ))}
    </>
  )
}

/** 底部利润影响提示（entrepreneurPurpose + profitMetrics 徽章） */
export function ProfitImpactFooter({ solution }: { solution: SolutionConfig }) {
  return (
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
  )
}
