import { create } from 'zustand'
import { API_BASE, authHeaders } from '@/lib/api-client'

export interface TokenQuota {
  dailyUsed: number
  dailyLimit: number
  dailyRemaining: number
  monthlyUsed: number
  monthlyLimit: number
  monthlyRemaining: number
  resetAt: string

  planCode: string | null
  planName: string | null
  usagePercent: number
  overageTokens: number
  overageCostYuan: number
  allowOverage: boolean
  isUnlimited: boolean
}

interface TokenQuotaState {
  quota: TokenQuota | null
  loading: boolean
  error: string | null

  fetch: () => Promise<void>
  clear: () => void
}


export const useTokenQuotaStore = create<TokenQuotaState>((set, get) => ({
  quota: null,
  loading: false,
  error: null,

  fetch: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const resp = await fetch(`${API_BASE}/api/v1/users/usage`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(8_000),
      })
      if (!resp.ok) {
        set({ loading: false, error: `HTTP ${resp.status}` })
        return
      }
      const raw = await resp.json()
      const q: TokenQuota = {
        dailyUsed: raw.daily_used ?? 0,
        dailyLimit: raw.daily_limit ?? -1,
        dailyRemaining: raw.daily_remaining ?? -1,
        monthlyUsed: raw.monthly_used ?? 0,
        monthlyLimit: raw.monthly_limit ?? 0,
        monthlyRemaining: raw.monthly_remaining ?? 0,
        resetAt: raw.reset_at ?? '',
        planCode: raw.plan_code ?? null,
        planName: raw.plan_name ?? null,
        usagePercent: raw.usage_percent ?? 0,
        overageTokens: raw.overage_tokens ?? 0,
        overageCostYuan: raw.overage_cost_yuan ?? 0,
        allowOverage: raw.allow_overage ?? false,
        isUnlimited: raw.is_unlimited ?? false,
      }
      set({ quota: q, loading: false })
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      set({ loading: false, error: err?.message || '获取额度失败' })
    }
  },

  clear: () => set({ quota: null, loading: false, error: null }),
}))
