/**
 * 套餐与支付 — 统一走 _build-api（/api/payment/*）
 * 套餐列表为公开接口；创建订单需 JWT（桌面端已登录时由 authFetch 自动带 Bearer）
 */

import { API_BASE, EXTERNAL_SITE_BASE, authFetch } from '@/lib/api-client'

export interface BillingPlan {
  code: string
  name: string
  description: string
  price: number
  price_yearly: number
  period: string
  features: string[]
  popular: boolean
}

export interface PaymentCreateResult {
  success: boolean
  order_id?: string
  amount?: number
  provider?: string
  pay_type?: string
  code_url?: string | null
  h5_url?: string | null
  qr_code?: string | null
  pay_url?: string | null
  mock?: boolean
  sandbox?: boolean
  error?: string | null
}

export async function fetchSubscriptionPlans(): Promise<{
  plans: BillingPlan[]
  currency: string
}> {
  const res = await fetch(`${API_BASE}/api/payment/plans`)
  const data = (await res.json()) as {
    success?: boolean
    plans?: BillingPlan[]
    currency?: string
    detail?: string
    error?: string
  }
  if (!res.ok || !data.success || !Array.isArray(data.plans)) {
    throw new Error(
      typeof data.detail === 'string'
        ? data.detail
        : data.error || `获取套餐失败（${res.status}）`,
    )
  }
  return { plans: data.plans, currency: data.currency || 'CNY' }
}

export interface CreatePaymentBody {
  amount: number
  provider: 'wechat' | 'alipay' | 'stripe' | 'offline'
  pay_type: string
  plan?: string
  product_type?: 'subscription' | 'token' | 'expert'
  product_id?: string
  description?: string
}

export async function createPaymentOrder(
  body: CreatePaymentBody,
): Promise<PaymentCreateResult> {
  const res = await authFetch(`${API_BASE}/api/payment/create`, {
    method: 'POST',
    body: JSON.stringify({
      amount: body.amount,
      provider: body.provider,
      pay_type: body.pay_type,
      plan: body.plan ?? '',
      product_type: body.product_type ?? 'subscription',
      product_id: body.product_id ?? '',
      description: body.description ?? '',
    }),
  })
  const data = (await res.json()) as PaymentCreateResult & { detail?: unknown }
  if (!res.ok) {
    const msg =
      typeof data.detail === 'string'
        ? data.detail
        : data.error || `创建订单失败（${res.status}）`
    return { success: false, error: msg }
  }
  return data
}

/** 将相对路径支付页转为绝对 URL，供 shell.openExternal 使用 */
export function toAbsoluteSiteUrl(href: string): string {
  if (!href) return href
  if (/^https?:\/\//i.test(href)) return href
  const base = EXTERNAL_SITE_BASE.replace(/\/$/, '')
  const path = href.startsWith('/') ? href : `/${href}`
  return `${base}${path}`
}

/** 网页端账单（Cookie 会话）；桌面用户可在浏览器中继续管理 */
export function billingPageUrl(): string {
  return `${EXTERNAL_SITE_BASE.replace(/\/$/, '')}/user/billing`
}
