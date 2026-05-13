/**
 * 账户面板 — 合同签约 + 订阅管理（套餐对比 + 升级 + 加油包）+ 发票记录
 */
import { useState, useEffect, useCallback } from 'react'
import {
  FileSignature, CreditCard, Receipt, RefreshCw, ExternalLink,
  Clock, CheckCircle, AlertCircle, XCircle, ArrowUpCircle,
  Zap, ShoppingCart, Check, Star,
} from 'lucide-react'
import { API_BASE, authHeaders } from '@/lib/api-client'
import { useTokenQuota } from '@/hooks/useTokenQuota'
import type { TokenQuota } from '@/stores/token-quota-store'

type SubTab = 'contracts' | 'subscription' | 'invoices'

interface Contract {
  id: string
  contract_no: string
  customer_name: string
  status: string
  total_amount: number
  created_at: string
  sign_url?: string
}

interface Subscription {
  id: string
  plan_name: string
  status: string
  started_at: string
  expires_at: string
  auto_renew: boolean
  monthly_quota: number
  used_quota: number
}

interface Invoice {
  id: string
  invoice_no: string
  amount: number
  status: string
  issued_at: string
  pdf_url?: string
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  active: { icon: CheckCircle, color: 'text-green-600', label: '生效中' },
  signed: { icon: CheckCircle, color: 'text-green-600', label: '已签约' },
  pending: { icon: Clock, color: 'text-yellow-600', label: '待处理' },
  draft: { icon: Clock, color: 'text-muted-foreground', label: '草稿' },
  sent: { icon: AlertCircle, color: 'text-blue-600', label: '待签约' },
  expired: { icon: XCircle, color: 'text-red-600', label: '已过期' },
  cancelled: { icon: XCircle, color: 'text-muted-foreground', label: '已取消' },
  paid: { icon: CheckCircle, color: 'text-green-600', label: '已支付' },
  issued: { icon: CheckCircle, color: 'text-blue-600', label: '已开具' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  )
}

export default function AccountPanel() {
  const [tab, setTab] = useState<SubTab>('contracts')
  const [contracts, setContracts] = useState<Contract[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const { quota } = useTokenQuota()

  const fetchContracts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/v1/account/contracts`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setContracts(data.contracts ?? data.items ?? [])
      }
    } catch { /* 静默 */ }
    setLoading(false)
  }, [])

  const fetchSubscription = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/v1/account/subscription`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setSubscription(data.subscription ?? data)
      }
    } catch { /* 静默 */ }
    setLoading(false)
  }, [])

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/v1/account/invoices`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices ?? data.items ?? [])
      }
    } catch { /* 静默 */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (tab === 'contracts') fetchContracts()
    else if (tab === 'subscription') fetchSubscription()
    else if (tab === 'invoices') fetchInvoices()
  }, [tab, fetchContracts, fetchSubscription, fetchInvoices])

  const fmt = (v: number) => `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('zh-CN') } catch { return iso }
  }

  const tabs: { key: SubTab; label: string; icon: typeof FileSignature }[] = [
    { key: 'contracts', label: '合同签约', icon: FileSignature },
    { key: 'subscription', label: '订阅管理', icon: CreditCard },
    { key: 'invoices', label: '发票记录', icon: Receipt },
  ]

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center gap-4 px-4 py-3 border-b">
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          )
        })}
        <button
          onClick={() => {
            if (tab === 'contracts') fetchContracts()
            else if (tab === 'subscription') fetchSubscription()
            else fetchInvoices()
          }}
          className="ml-auto p-1.5 rounded-md hover:bg-muted"
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'contracts' && (
          <ContractList contracts={contracts} loading={loading} fmt={fmt} fmtDate={fmtDate} />
        )}
        {tab === 'subscription' && (
          <SubscriptionView sub={subscription} loading={loading} fmt={fmt} fmtDate={fmtDate} quota={quota} />
        )}
        {tab === 'invoices' && (
          <InvoiceList invoices={invoices} loading={loading} fmt={fmt} fmtDate={fmtDate} />
        )}
      </div>
    </div>
  )
}

function ContractList({ contracts, loading, fmt, fmtDate }: {
  contracts: Contract[]; loading: boolean; fmt: (v: number) => string; fmtDate: (s: string) => string
}) {
  if (loading && contracts.length === 0) return <LoadingState />
  if (contracts.length === 0) return <EmptyState icon={FileSignature} text="暂无合同" sub="合同签约后将在此显示" />

  return (
    <div className="space-y-3">
      {contracts.map(c => (
        <div key={c.id} className="rounded-lg border p-4 hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{c.contract_no}</span>
            <StatusBadge status={c.status} />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>客户：{c.customer_name}</p>
            <div className="flex justify-between">
              <span>金额：{fmt(c.total_amount)}</span>
              <span>{fmtDate(c.created_at)}</span>
            </div>
          </div>
          {c.sign_url && c.status === 'sent' && (
            <a
              href={c.sign_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> 前往签约
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

function fmtTokens(n: number): string {
  if (n < 0) return '∞'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

// ─── 打开外部链接（Electron + Web 兼容） ─────────────────────────────────────

function openExternal(url: string) {
  try {
    const api = (window as any).electronAPI
    if (api?.shell?.openExternal) {
      api.shell.openExternal(url)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

// ─── 套餐定义（静态兜底，API 返回时以 API 数据为准） ────────────────────────

interface PlanTier {
  code: string
  name: string
  monthlyYuan: number | null
  tokensPerMonth: number
  features: string[]
  popular?: boolean
  enterprise?: boolean
}

const PLAN_TIERS: PlanTier[] = [
  {
    code: 'basic',
    name: '基础版',
    monthlyYuan: 299,
    tokensPerMonth: 100_000,
    features: ['100K Token/月', '单行业方案', '邮件支持', '基础工作流'],
  },
  {
    code: 'pro',
    name: '专业版',
    monthlyYuan: 799,
    tokensPerMonth: 500_000,
    features: ['500K Token/月', '全行业方案自由切换', '优先技术支持', '全部工作流 + 自动化', '发票/合同管理'],
    popular: true,
  },
  {
    code: 'enterprise',
    name: '企业版',
    monthlyYuan: null,
    tokensPerMonth: -1,
    features: ['无限 Token', '专属客户成功经理', 'SLA 保障', '私有化部署选项', '定制集成'],
    enterprise: true,
  },
]

const TOPUP_PACKS = [
  { tokens: 50_000, yuan: 99, label: '50K 加油包' },
  { tokens: 200_000, yuan: 299, label: '200K 加油包' },
  { tokens: 500_000, yuan: 599, label: '500K 加油包' },
]

// ─── 套餐对比 + 升级按钮 ─────────────────────────────────────────────────────

function PricingSection({ currentPlanCode }: { currentPlanCode: string | null }) {
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [topupLoading, setTopupLoading] = useState<number | null>(null)

  const handleUpgrade = useCallback(async (planCode: string) => {
    setUpgrading(planCode)
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/billing/upgrade-url?plan=${planCode}`,
        { headers: authHeaders(), signal: AbortSignal.timeout(8_000) },
      )
      if (res.ok) {
        const data = await res.json()
        if (data.url) { openExternal(data.url); return }
      }
    } catch { /* 静默 */ }
    // API 失败时跳官网定价页
    openExternal('https://mises.ai/pricing')
    setUpgrading(null)
  }, [])

  const handleTopup = useCallback(async (tokens: number) => {
    setTopupLoading(tokens)
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/billing/topup-url?tokens=${tokens}`,
        { headers: authHeaders(), signal: AbortSignal.timeout(8_000) },
      )
      if (res.ok) {
        const data = await res.json()
        if (data.url) { openExternal(data.url); return }
      }
    } catch { /* 静默 */ }
    openExternal('https://mises.ai/topup')
    setTopupLoading(null)
  }, [])

  const normalizedCode = (currentPlanCode ?? '').toLowerCase()

  return (
    <div className="space-y-6">
      {/* ── 套餐对比 ── */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-primary" />
          可用套餐
        </h4>
        <div className="space-y-2">
          {PLAN_TIERS.map((tier) => {
            const isCurrent = normalizedCode.includes(tier.code)
            const isDowngrade = !isCurrent && PLAN_TIERS.findIndex(t => t.code === normalizedCode) > PLAN_TIERS.findIndex(t => t.code === tier.code)
            return (
              <div
                key={tier.code}
                className={`rounded-xl border p-4 transition-all ${
                  isCurrent
                    ? 'border-primary bg-primary/5'
                    : tier.popular
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-border hover:border-border/80'
                }`}
              >
                {/* 标题行 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{tier.name}</span>
                    {isCurrent && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">当前套餐</span>
                    )}
                    {tier.popular && !isCurrent && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 font-medium">推荐</span>
                    )}
                  </div>
                  <div className="text-right">
                    {tier.monthlyYuan !== null ? (
                      <span className="font-bold text-sm">¥{tier.monthlyYuan}<span className="text-xs font-normal text-muted-foreground">/月</span></span>
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">联系销售</span>
                    )}
                  </div>
                </div>

                {/* 功能列表 */}
                <ul className="space-y-1 mb-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Check className="w-3 h-3 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* 升级按钮 */}
                {!isCurrent && !isDowngrade && (
                  <button
                    type="button"
                    onClick={() => tier.enterprise ? openExternal('https://mises.ai/contact') : handleUpgrade(tier.code)}
                    disabled={upgrading === tier.code}
                    className={`w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all active:scale-95 ${
                      tier.popular
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-primary text-primary-foreground hover:opacity-90'
                    }`}
                  >
                    {upgrading === tier.code ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <ArrowUpCircle className="w-3 h-3" />
                    )}
                    {tier.enterprise ? '联系销售团队' : `升级到${tier.name}`}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </button>
                )}
                {isCurrent && (
                  <div className="text-center text-[11px] text-primary/70">✓ 当前使用中</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 加油包 ── */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          加油包 <span className="text-xs text-muted-foreground font-normal">· 按需充值，当月有效</span>
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {TOPUP_PACKS.map((pack) => (
            <button
              key={pack.tokens}
              type="button"
              onClick={() => handleTopup(pack.tokens)}
              disabled={topupLoading === pack.tokens}
              className="flex flex-col items-center gap-1 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 p-3 text-center transition-all active:scale-95"
            >
              <ShoppingCart className={`w-4 h-4 ${topupLoading === pack.tokens ? 'animate-spin' : 'text-muted-foreground'}`} />
              <span className="text-xs font-semibold">{fmtTokens(pack.tokens)}</span>
              <span className="text-[11px] text-muted-foreground">¥{pack.yuan}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/50 mt-2 text-center">
          加油包在当前套餐基础上叠加使用，当月内有效
        </p>
      </div>
    </div>
  )
}

// ─── 订阅视图（用量概览 + 套餐/升级区） ─────────────────────────────────────

function SubscriptionView({ sub, loading, fmt: _fmt, fmtDate, quota }: {
  sub: Subscription | null; loading: boolean; fmt: (v: number) => string; fmtDate: (s: string) => string; quota: TokenQuota | null
}) {
  const [subView, setSubView] = useState<'usage' | 'plans'>('usage')

  if (loading && !sub) return <LoadingState />

  const used = quota?.monthlyUsed ?? sub?.used_quota ?? 0
  const limit = quota?.monthlyLimit ?? sub?.monthly_quota ?? 0
  const isUnlimited = quota?.isUnlimited ?? false
  const pct = isUnlimited ? 0 : (limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0)

  const barColor =
    pct >= 90 ? 'bg-red-500' :
    pct >= 70 ? 'bg-amber-500' :
    'bg-emerald-500'

  const planLabel = quota?.planName || sub?.plan_name || '—'
  const planCode = quota?.planCode || null

  return (
    <div className="space-y-4">
      {/* 内部视图切换 */}
      <div className="flex rounded-lg border border-border/50 p-0.5 gap-0.5 bg-muted/20">
        {(['usage', 'plans'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setSubView(v)}
            className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${
              subView === v ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v === 'usage' ? '用量与账单' : '升级套餐'}
          </button>
        ))}
      </div>

      {subView === 'usage' ? (
        <>
          {/* 当前订阅详情 */}
          {sub ? (
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm">{planLabel}</span>
                <StatusBadge status={sub.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">开始日期</p>
                  <p className="text-sm">{fmtDate(sub.started_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">到期日期</p>
                  <p className="text-sm">{fmtDate(sub.expires_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">自动续费</p>
                  <p className="text-sm">{sub.auto_renew ? '已开启' : '未开启'}</p>
                </div>
                {quota?.resetAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">额度重置</p>
                    <p className="text-sm">{fmtDate(quota.resetAt)}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-center">
              <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm text-muted-foreground">暂无订阅记录</p>
              <button
                type="button"
                onClick={() => setSubView('plans')}
                className="mt-2 text-xs text-primary hover:underline"
              >
                查看可用套餐 →
              </button>
            </div>
          )}

          {/* Token 用量 */}
          <div className="rounded-lg border p-4">
            <h4 className="text-sm font-medium mb-3">本月 Token 用量</h4>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="tabular-nums">
                {fmtTokens(used)} / {fmtTokens(limit)}
              </span>
              {!isUnlimited && (
                <span className={`font-medium ${pct >= 80 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {pct}%
                </span>
              )}
              {isUnlimited && (
                <span className="text-blue-500 text-xs font-medium">不限额</span>
              )}
            </div>
            {!isUnlimited && (
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}

            {quota && quota.overageTokens > 0 && quota.allowOverage && (
              <p className="text-xs text-amber-600 mt-2">
                超额使用 {fmtTokens(quota.overageTokens)}，费用 ¥{quota.overageCostYuan.toFixed(2)}
              </p>
            )}

            {!isUnlimited && pct >= 70 && (
              <button
                type="button"
                onClick={() => setSubView('plans')}
                className={`mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all active:scale-95 ${
                  pct >= 90
                    ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20'
                    : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/20'
                }`}
              >
                <ArrowUpCircle className="w-3 h-3" />
                {pct >= 90 ? '立即升级 · 额度告急' : '查看升级选项'}
              </button>
            )}
          </div>
        </>
      ) : (
        <PricingSection currentPlanCode={planCode} />
      )}
    </div>
  )
}

function InvoiceList({ invoices, loading, fmt, fmtDate }: {
  invoices: Invoice[]; loading: boolean; fmt: (v: number) => string; fmtDate: (s: string) => string
}) {
  if (loading && invoices.length === 0) return <LoadingState />
  if (invoices.length === 0) return <EmptyState icon={Receipt} text="暂无发票" sub="付款后系统将自动生成发票" />

  return (
    <div className="space-y-3">
      {invoices.map(inv => (
        <div key={inv.id} className="rounded-lg border p-4 hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{inv.invoice_no}</span>
            <StatusBadge status={inv.status} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>金额：{fmt(inv.amount)}</span>
            <span>{fmtDate(inv.issued_at)}</span>
          </div>
          {inv.pdf_url && (
            <a
              href={inv.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> 下载 PDF
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )
}

function EmptyState({ icon: Icon, text, sub }: { icon: typeof FileSignature; text: string; sub: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Icon className="w-10 h-10 mx-auto mb-3 opacity-20" />
      <p className="text-sm">{text}</p>
      <p className="text-xs mt-1">{sub}</p>
    </div>
  )
}
