/**
 * OnboardingPage — 新用户首次引导页
 *
 * 流程：注册/首次登录 → /welcome（此页） → /pick（选行业方案）→ 工作台
 *
 * 目标：在 60 秒内让外部付费用户理解：
 *   1. MBE 是什么（AI 专业助理派遣平台）
 *   2. 三种计费方式各自适合谁
 *   3. 如何开始（选方案 → 工作台）
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { useAppStore } from '@/stores/app-store'
import { ArrowRight, Check } from 'lucide-react'

// ─── 三种计费模式说明 ───────────────────────────────────────────────────────

interface BillingCard {
  id: 'subscription' | 'pay-per-use' | 'revenue-share'
  emoji: string
  title: string
  subtitle: string
  description: string
  highlights: string[]
  color: string
  border: string
  badge: string
}

const BILLING_CARDS: BillingCard[] = [
  {
    id: 'subscription',
    emoji: '📅',
    title: '订阅制',
    subtitle: '每月固定费用，按月付费',
    description: '适合高频使用场景。支付固定月费后，AI 专家服务不限次数调用，预算清晰可控。',
    highlights: ['月度固定预算', '无限次使用', '多方案自由切换'],
    color: 'from-blue-500/10 to-blue-600/5',
    border: 'border-blue-500/30',
    badge: '最受欢迎',
  },
  {
    id: 'pay-per-use',
    emoji: '💰',
    title: '计件制',
    subtitle: '按实际用量计费',
    description: '适合低频或测试阶段。每次 AI 专家咨询按调用次数或 Token 用量计费，用多少付多少。',
    highlights: ['零固定成本', '按需使用', '随时开通/暂停'],
    color: 'from-emerald-500/10 to-emerald-600/5',
    border: 'border-emerald-500/30',
    badge: '灵活入门',
  },
  {
    id: 'revenue-share',
    emoji: '🤝',
    title: '分成制',
    subtitle: '按节约的人工费用分成',
    description: '适合规模化部署。AI 员工替代人工岗位，按实际节约的人工成本的 30% 作为服务费，零预算风险。',
    highlights: ['无需预付费用', '节省越多分成越少', '适合团队级部署'],
    color: 'from-violet-500/10 to-violet-600/5',
    border: 'border-violet-500/30',
    badge: '零风险',
  },
]

// ─── 流程步骤示意 ─────────────────────────────────────────────────────────────

const STEPS = [
  { label: '选行业方案', icon: '🏢', desc: '从 14 个行业模板中选择最匹配的' },
  { label: 'AI 专家就位', icon: '🤖', desc: '领域 AI 团队自动配置完毕' },
  { label: '开始协作', icon: '⚡', desc: '对话、工作流、计算一键启动' },
]

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const markOnboardingDone = useAppStore((s) => s.markOnboardingDone)

  const [step, setStep] = useState<'billing' | 'workflow'>('billing')
  const [activeCard, setActiveCard] = useState<BillingCard['id'] | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // 淡入动画
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  const handleStart = () => {
    markOnboardingDone()
    navigate('/pick', { replace: true })
  }

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || '你好'

  return (
    <div
      className={`min-h-screen bg-background flex flex-col transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      role="main"
    >
      {/* ── 顶部品牌栏 ─────────────────────────────── */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-5 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center" aria-hidden="true">
            <span className="text-primary-foreground font-bold text-sm">M</span>
          </div>
          <span className="font-semibold text-sm tracking-tight">MBE Desktop</span>
        </div>
        <button
          type="button"
          onClick={handleStart}
          aria-label="跳过引导，直接进入方案选择"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          跳过引导 →
        </button>
      </header>

      <div className="flex-1 overflow-y-auto" id="main-content">
        {step === 'billing' ? (
          <BillingStep
            firstName={firstName}
            activeCard={activeCard}
            onSelectCard={setActiveCard}
            onNext={() => setStep('workflow')}
          />
        ) : (
          <WorkflowStep onStart={handleStart} />
        )}
      </div>

      {/* ── 底部进度指示 ─────────────────────────────── */}
      <footer className="flex items-center justify-center gap-2 py-5 border-t border-border/30">
        <nav aria-label="引导步骤进度">
          <ol className="flex items-center gap-2 list-none m-0 p-0">
            {([
              { key: 'billing', label: '第 1 步：了解计费方式' },
              { key: 'workflow', label: '第 2 步：了解使用流程' },
            ] as const).map(({ key, label }) => (
              <li key={key}>
                <span
                  role="img"
                  aria-label={step === key ? `${label}（当前步骤）` : label}
                  className={`block rounded-full transition-all duration-300 ${
                    step === key ? 'bg-primary w-5 h-2' : 'bg-border w-2 h-2'
                  }`}
                />
              </li>
            ))}
          </ol>
        </nav>
      </footer>
    </div>
  )
}

// ─── 步骤 1：计费模式说明 ─────────────────────────────────────────────────────

function BillingStep({
  firstName,
  activeCard,
  onSelectCard,
  onNext,
}: {
  firstName: string
  activeCard: BillingCard['id'] | null
  onSelectCard: (id: BillingCard['id']) => void
  onNext: () => void
}) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      {/* 欢迎文案 */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <span>✨</span>
          <span>欢迎加入 MBE</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          你好，{firstName} 👋
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
          MBE 是 AI 员工派遣平台，为你的行业配备专业 AI 团队。<br />
          在开始之前，了解一下我们的三种合作方式：
        </p>
      </div>

      {/* 计费卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" role="group" aria-label="选择计费方式">
        {BILLING_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectCard(card.id)}
            aria-pressed={activeCard === card.id}
            aria-label={`${card.title}：${card.subtitle}${activeCard === card.id ? '（已选择）' : ''}`}
            className={`
              relative text-left rounded-xl border p-5 transition-all duration-200
              bg-gradient-to-br ${card.color}
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
              ${activeCard === card.id
                ? `${card.border} ring-2 ring-offset-1 ring-offset-background shadow-md scale-[1.02]`
                : 'border-border/50 hover:border-border hover:scale-[1.01]'
              }
            `}
          >
            {/* 角标 */}
            <span className="absolute top-3 right-3 text-[11px] px-2 py-0.5 rounded-full bg-background/70 text-muted-foreground border border-border/40">
              {card.badge}
            </span>

            <div className="text-3xl mb-3">{card.emoji}</div>
            <div className="font-semibold text-base mb-0.5">{card.title}</div>
            <div className="text-xs text-muted-foreground mb-3">{card.subtitle}</div>
            <p className="text-xs text-muted-foreground/80 leading-relaxed mb-4">
              {card.description}
            </p>

            <ul className="space-y-1.5">
              {card.highlights.map((h) => (
                <li key={h} className="flex items-center gap-1.5 text-xs">
                  <Check className="w-3 h-3 text-primary shrink-0" aria-hidden="true" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>

            {activeCard === card.id && (
              <div className="mt-4 pt-3 border-t border-border/30 text-xs text-primary font-medium">
                ✓ 已选择此方案
              </div>
            )}
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground/60">
        你的具体计费方式由账号合同决定，以上为模式说明。如有疑问请联系客服。
      </p>

      {/* CTA */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-all active:scale-95 shadow-sm"
        >
          了解了，看看如何使用
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── 步骤 2：使用流程说明 ─────────────────────────────────────────────────────

function WorkflowStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-10">
      {/* 标题 */}
      <div className="text-center space-y-3">
        <h2 className="text-2xl font-bold tracking-tight">三步开始 AI 专家协作</h2>
        <p className="text-muted-foreground text-sm">
          从选方案到第一次 AI 回答，只需不到 1 分钟。
        </p>
      </div>

      {/* 步骤流程 */}
      <div className="space-y-0">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex gap-4">
            {/* 左侧时间线 */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xl shrink-0">
                {s.icon}
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-px flex-1 bg-border/40 my-1 min-h-[32px]" />
              )}
            </div>

            {/* 右侧内容 */}
            <div className="pb-8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-muted-foreground">步骤 {i + 1}</span>
              </div>
              <div className="font-semibold text-sm mb-1">{s.label}</div>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 功能亮点快速提示 */}
      <div className="rounded-xl border border-border/50 bg-muted/20 p-5 space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">你可以随时</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: '💬', text: '对话提问' },
            { icon: '⚙️', text: '运行自动化工作流' },
            { icon: '📊', text: '查看用量与账单' },
            { icon: '🔄', text: '切换行业方案' },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-base">{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 主 CTA */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onStart}
          className="flex items-center gap-2 px-10 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-all active:scale-95 shadow-md"
        >
          选择我的行业方案
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-xs text-muted-foreground/50">可随时在「账户 → 订阅管理」查看计费详情</p>
      </div>
    </div>
  )
}
