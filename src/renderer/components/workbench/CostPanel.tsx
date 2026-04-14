import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  DollarSign,
  TrendingUp,
  Activity,
  RefreshCw,
  BarChart3,
  Layers,
  Zap,
  CreditCard,
  ExternalLink,
  Copy,
  Loader2,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { SolutionConfig } from '@/lib/solution-router'
import {
  loadCostData,
  type AggregatedCostData,
  type CostDimension,
  type CostPeriod,
} from '@/lib/cost-service'
import { useAuthStore } from '@/stores/auth-store'
import { isElectron } from '@/lib/api-client'
import {
  fetchSubscriptionPlans,
  createPaymentOrder,
  toAbsoluteSiteUrl,
  billingPageUrl,
  type BillingPlan,
  type PaymentCreateResult,
} from '@/lib/billing-service'

interface Props {
  solution: SolutionConfig
}

const PERIOD_OPTIONS: { value: CostPeriod; label: string }[] = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'all', label: '全部' },
]

const DIMENSION_OPTIONS: { value: CostDimension; label: string; icon: typeof Layers }[] = [
  { value: 'expert_id', label: '按专家', icon: Layers },
  { value: 'action', label: '按操作', icon: Zap },
  { value: 'workflow_step', label: '按工作流', icon: BarChart3 },
]

function openExternalSafe(url: string) {
  const abs = toAbsoluteSiteUrl(url)
  const api = window.electronAPI
  if (api?.openExternal) {
    api.openExternal(abs)
  } else {
    window.open(abs, '_blank', 'noopener,noreferrer')
  }
}

/** 微信 Native 返回 code_url 时：桌面端展示说明 + 复制支付链接 */
function WechatNativeModal({
  codeUrl,
  orderId,
  onClose,
}: {
  codeUrl: string
  orderId: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [copyErr, setCopyErr] = useState<string | null>(null)
  const copy = async () => {
    setCopyErr(null)
    try {
      await navigator.clipboard.writeText(codeUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyErr('复制失败，请手动选中上方链接复制')
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wechat-pay-title"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-lg max-w-md w-full p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="wechat-pay-title" className="text-sm font-semibold">
          微信扫码支付
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          请使用微信「扫一扫」扫描下方二维码完成支付。
        </p>
        {orderId ? (
          <p className="text-[11px] text-muted-foreground">订单号：{orderId}</p>
        ) : null}
        <div className="flex justify-center py-2">
          <div className="bg-white p-3 rounded-lg">
            <QRCodeSVG value={codeUrl} size={200} level="M" />
          </div>
        </div>
        <details className="text-[10px] text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">无法扫码？复制支付链接</summary>
          <div className="mt-1 rounded-lg bg-secondary/40 p-2 font-mono break-all max-h-20 overflow-y-auto border border-border/50 select-all">
            {codeUrl}
          </div>
        </details>
        {copyErr ? <p className="text-[11px] text-destructive">{copyErr}</p> : null}
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-secondary/50"
            onClick={onClose}
          >
            关闭
          </button>
          <button
            type="button"
            className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground inline-flex items-center gap-1"
            onClick={copy}
          >
            <Copy className="w-3 h-3 shrink-0" />
            {copied ? '已复制' : '复制链接'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CostPanel({ solution }: Props) {
  const token = useAuthStore((s) => s.token)
  const loggedIn = Boolean(token)

  const [data, setData] = useState<AggregatedCostData | null>(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<CostPeriod>('month')
  const [dimension, setDimension] = useState<CostDimension>('expert_id')

  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [planCurrency, setPlanCurrency] = useState('CNY')
  const [plansLoading, setPlansLoading] = useState(false)
  const [plansError, setPlansError] = useState<string | null>(null)
  const [billingMsg, setBillingMsg] = useState<string | null>(null)
  const [purchaseKey, setPurchaseKey] = useState<string | null>(null)
  const [subPeriod, setSubPeriod] = useState<'month' | 'year'>('month')
  const [tokenRechargeYuan, setTokenRechargeYuan] = useState('50')
  const [tokenLoading, setTokenLoading] = useState(false)
  const [wechatModal, setWechatModal] = useState<{ codeUrl: string; orderId: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await loadCostData(solution, period, dimension, 7)
      setData(result)
    } catch (e) {
      // Expected: 成本聚合 API 或 IPC 失败；清空图表
      console.warn('[CostPanel] loadCostData:', e)
      setData(null)
    }
    setLoading(false)
  }, [solution, period, dimension])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setPlansLoading(true)
      setPlansError(null)
      try {
        const { plans: list, currency } = await fetchSubscriptionPlans()
        if (!cancelled) {
          setPlans(list)
          setPlanCurrency(currency)
        }
      } catch (e) {
        if (!cancelled) {
          setPlansError(e instanceof Error ? e.message : '加载套餐失败')
          setPlans([])
        }
      } finally {
        if (!cancelled) setPlansLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handlePaymentResult = useCallback((result: PaymentCreateResult) => {
    setBillingMsg(null)
    if (!result.success) {
      setBillingMsg(result.error || '创建订单失败')
      return
    }
    if (result.pay_url) {
      openExternalSafe(result.pay_url)
      setBillingMsg('已在浏览器中打开支付页')
      return
    }
    if (result.h5_url) {
      openExternalSafe(result.h5_url)
      setBillingMsg('已在浏览器中打开支付页')
      return
    }
    if (result.code_url) {
      setWechatModal({
        codeUrl: result.code_url,
        orderId: result.order_id || '',
      })
      return
    }
    if (result.qr_code) {
      if (/^https?:\/\//i.test(result.qr_code)) {
        openExternalSafe(result.qr_code)
      } else {
        setBillingMsg('请使用支付宝扫码完成支付（二维码数据已返回）')
      }
      return
    }
    setBillingMsg('订单已创建，请在「网页管理账单」中查看状态')
  }, [])

  const buyPlan = useCallback(
    async (plan: BillingPlan) => {
      if (!loggedIn) {
        setBillingMsg('请先登录后再购买套餐')
        return
      }
      const amount =
        subPeriod === 'year' && plan.price_yearly > 0
          ? plan.price_yearly
          : plan.price
      if (!(amount > 0)) {
        setBillingMsg('该套餐暂无有效价格')
        return
      }
      const key = `${plan.code}-${subPeriod}`
      setPurchaseKey(key)
      setBillingMsg(null)
      try {
        const desc =
          subPeriod === 'year'
            ? `${plan.name}（年付）`
            : `${plan.name}（月付）`
        const result = await createPaymentOrder({
          amount,
          provider: 'wechat',
          pay_type: 'native',
          plan: plan.code,
          product_type: 'subscription',
          description: desc,
        })
        handlePaymentResult(result)
      } catch (e) {
        setBillingMsg(e instanceof Error ? e.message : '下单失败')
      } finally {
        setPurchaseKey(null)
      }
    },
    [loggedIn, subPeriod, handlePaymentResult],
  )

  const rechargeTokens = useCallback(async () => {
    if (!loggedIn) {
      setBillingMsg('请先登录后再充值')
      return
    }
    const yuan = Number.parseFloat(tokenRechargeYuan.replace(/,/g, ''))
    if (!Number.isFinite(yuan) || yuan <= 0 || yuan > 100_000) {
      setBillingMsg('请输入有效金额（0.01～100000 元）')
      return
    }
    setTokenLoading(true)
    setBillingMsg(null)
    try {
      const result = await createPaymentOrder({
        amount: Math.round(yuan * 100) / 100,
        provider: 'wechat',
        pay_type: 'native',
        plan: '',
        product_type: 'token',
        description: `Token 充值 ¥${yuan}`,
      })
      handlePaymentResult(result)
    } catch (e) {
      setBillingMsg(e instanceof Error ? e.message : '充值下单失败')
    } finally {
      setTokenLoading(false)
    }
  }, [loggedIn, tokenRechargeYuan, handlePaymentResult])

  const periodClickHandlers = useMemo(
    () =>
      Object.fromEntries(
        PERIOD_OPTIONS.map((opt) => [opt.value, () => setPeriod(opt.value)]),
      ) as Record<CostPeriod, () => void>,
    [],
  )

  const dimensionClickHandlers = useMemo(
    () =>
      Object.fromEntries(
        DIMENSION_OPTIONS.map((opt) => [opt.value, () => setDimension(opt.value)]),
      ) as Record<CostDimension, () => void>,
    [],
  )

  const breakdownChartData = useMemo(
    () =>
      data?.mergedBreakdown.map((item) => ({
        name: item.dimension || '未分类',
        cost: item.cost_yuan,
        calls: item.call_count,
        tokens: item.total_tokens,
        pct: item.percentage,
      })) ?? [],
    [data],
  )

  const trendChartData = useMemo(
    () => data?.trend.map((p) => ({ date: p.date.slice(5), cost: p.cost_yuan })) ?? [],
    [data],
  )

  const dimensionSectionLabel = useMemo(
    () => DIMENSION_OPTIONS.find((d) => d.value === dimension)?.label ?? '',
    [dimension],
  )

  const formatCost = (yuan: number) => {
    if (yuan >= 10000) return `¥${(yuan / 10000).toFixed(2)}万`
    if (yuan >= 100) return `¥${yuan.toFixed(0)}`
    return `¥${yuan.toFixed(2)}`
  }

  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
    return `${tokens}`
  }

  const isEmpty = !data || (data.totalCalls === 0 && data.mergedBreakdown.length === 0)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">费用追踪</h2>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-secondary/30 hover:bg-secondary/50 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {/* 筛选条件 */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-secondary/30 rounded-lg p-1">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={periodClickHandlers[opt.value]}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                  period === opt.value ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 bg-secondary/30 rounded-lg p-1">
            {DIMENSION_OPTIONS.map(opt => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={dimensionClickHandlers[opt.value]}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
                    dimension === opt.value ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 总览卡片 */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<DollarSign className="w-4 h-4" />}
            label="总费用"
            value={data ? formatCost(data.totalCostYuan) : '—'}
            cls="text-amber-500"
          />
          <StatCard
            icon={<Activity className="w-4 h-4" />}
            label="调用次数"
            value={data ? `${data.totalCalls}` : '—'}
            cls="text-blue-500"
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Token 消耗"
            value={data ? formatTokens(data.totalTokens) : '—'}
            cls="text-purple-500"
          />
        </div>

        {/* 套餐与充值（_build-api /api/payment） */}
        <div className="rounded-xl border border-border/40 bg-card/50 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              套餐与充值
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex rounded-lg bg-secondary/40 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSubPeriod('month')}
                  className={`px-2 py-0.5 rounded-md ${subPeriod === 'month' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
                >
                  月付
                </button>
                <button
                  type="button"
                  onClick={() => setSubPeriod('year')}
                  className={`px-2 py-0.5 rounded-md ${subPeriod === 'year' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
                >
                  年付
                </button>
              </div>
              <button
                type="button"
                onClick={() => openExternalSafe(billingPageUrl())}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                网页管理账单
              </button>
            </div>
          </div>

          {!loggedIn && (
            <p className="text-xs text-amber-600 dark:text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2">
              未登录：无法创建支付订单。请先完成登录。
            </p>
          )}

          {billingMsg && (
            <p className="text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">{billingMsg}</p>
          )}

          {plansLoading && (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              加载套餐中…
            </p>
          )}
          {plansError && !plansLoading && (
            <p className="text-xs text-destructive">{plansError}</p>
          )}

          {plans.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((p) => {
                const yearlyOk = p.price_yearly > 0
                const amount =
                  subPeriod === 'year' && yearlyOk ? p.price_yearly : p.price
                const periodLabel =
                  subPeriod === 'year' && yearlyOk ? '/年' : `/${p.period || '月'}`
                const disabled =
                  !loggedIn ||
                  !(amount > 0) ||
                  (subPeriod === 'year' && !yearlyOk) ||
                  purchaseKey !== null
                const busy = purchaseKey === `${p.code}-${subPeriod}`
                return (
                  <div
                    key={p.code}
                    className={`relative rounded-lg border p-3 flex flex-col gap-2 ${
                      p.popular ? 'border-primary/50 bg-primary/5' : 'border-border/50'
                    }`}
                  >
                    {p.popular && (
                      <span className="absolute -top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                        推荐
                      </span>
                    )}
                    <div className="font-medium text-sm">{p.name}</div>
                    {p.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{p.description}</p>
                    )}
                    <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {planCurrency === 'CNY' ? '¥' : `${planCurrency} `}
                      {amount > 0 ? amount.toFixed(amount % 1 ? 2 : 0) : '—'}
                      <span className="text-xs font-normal text-muted-foreground ml-0.5">{periodLabel}</span>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => buyPlan(p)}
                      className="mt-auto text-xs py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      购买
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="pt-2 border-t border-border/40 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Token 充值（元）</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0.01}
                max={100000}
                step={0.01}
                value={tokenRechargeYuan}
                onChange={(e) => setTokenRechargeYuan(e.target.value)}
                disabled={!loggedIn || tokenLoading}
                className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={!loggedIn || tokenLoading || purchaseKey !== null}
                onClick={rechargeTokens}
                className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 disabled:opacity-40 flex items-center gap-1"
              >
                {tokenLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                充值下单
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              支付走统一网关（微信 Native 等）；桌面端将打开系统浏览器或使用扫码链接。
              {isElectron() ? '' : ' （当前非 Electron 环境，将使用新窗口打开链接。）'}
            </p>
          </div>
        </div>

        {wechatModal && (
          <WechatNativeModal
            codeUrl={wechatModal.codeUrl}
            orderId={wechatModal.orderId}
            onClose={() => setWechatModal(null)}
          />
        )}

        {/* 费用明细 — recharts 横向柱状图 */}
        {!isEmpty && data!.mergedBreakdown.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              费用明细（{dimensionSectionLabel}）
            </h3>
            <div className="rounded-xl border border-border/40 bg-card/50 p-4">
              <ResponsiveContainer width="100%" height={Math.max(120, data!.mergedBreakdown.length * 44)}>
                <BarChart
                  data={breakdownChartData}
                  layout="vertical"
                  margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.[0]) return null
                      const d = payload[0].payload as { name: string; cost: number; calls: number; tokens: number; pct: number }
                      return (
                        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                          <p className="font-medium">{d.name}</p>
                          <p className="text-amber-500 font-bold">{formatCost(d.cost)}</p>
                          <p className="text-muted-foreground">{d.calls} 次 · {formatTokens(d.tokens)} tokens · {d.pct}%</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="cost" radius={[0, 4, 4, 0]} barSize={18}>
                    {data!.mergedBreakdown.map((_, i) => (
                      <Cell key={i} fill={`hsl(var(--primary) / ${0.35 + (0.45 * (1 - i / Math.max(data!.mergedBreakdown.length - 1, 1)))})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <EmptyCost loading={loading} />
        )}

        {/* 趋势图 — recharts 柱状图 */}
        {data && data.trend.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">近 7 日趋势</h3>
            <div className="rounded-xl border border-border/40 bg-card/50 p-4">
              <ResponsiveContainer width="100%" height={100}>
                <BarChart
                  data={trendChartData}
                  margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
                >
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.[0]) return null
                      const d = payload[0].payload as { date: string; cost: number }
                      return (
                        <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-lg">
                          <span className="text-muted-foreground">{d.date}</span>{' '}
                          <span className="font-bold text-amber-500">{formatCost(d.cost)}</span>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="cost" fill="hsl(var(--primary) / 0.5)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, cls }: { icon: React.ReactNode; label: string; value: string; cls: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-3 flex items-center gap-3">
      <div className={cls}>{icon}</div>
      <div>
        <p className="text-lg font-bold">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function EmptyCost({ loading }: { loading: boolean }) {
  return (
    <div className="text-center py-16 space-y-4">
      <div className="text-5xl">💰</div>
      <div>
        <p className="text-lg font-semibold text-foreground">
          {loading ? '加载中...' : '暂无费用数据'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {loading
            ? '正在从各 Agent 后端获取成本归因数据'
            : '使用 AI 专家咨询和工作流后，费用数据会自动在此显示'}
        </p>
      </div>
    </div>
  )
}
