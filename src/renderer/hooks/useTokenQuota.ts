import { useEffect } from 'react'
import { useTokenQuotaStore } from '@/stores/token-quota-store'
import { useAuthStore } from '@/stores/auth-store'
import { useVisibilityPolling } from './useVisibilityPolling'

const POLL_INTERVAL_MS = 60_000

/**
 * 自动获取并轮询 Token 额度。
 * 仅在用户已认证时激活，页面不可见时暂停。
 */
export function useTokenQuota() {
  const isAuth = useAuthStore((s) => !!s.token)
  const { quota, loading, error, fetch: fetchQuota, clear } = useTokenQuotaStore()

  useEffect(() => {
    if (!isAuth) {
      clear()
      return
    }
    fetchQuota()
  }, [isAuth])

  useVisibilityPolling(fetchQuota, POLL_INTERVAL_MS, isAuth)

  return { quota, loading, error, refresh: fetchQuota }
}
