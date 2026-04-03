import { useTokenQuota } from '@/hooks/useTokenQuota'

function fmtTokens(n: number): string {
  if (n < 0) return '∞'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

/**
 * Sidebar 紧凑型 Token 额度进度条。
 * expanded=true 时显示完整信息，false 时只显示一个小环形图标。
 */
export default function TokenQuotaWidget({ expanded }: { expanded: boolean }) {
  const { quota, loading } = useTokenQuota()

  if (!quota && !loading) return null

  if (!quota) {
    return expanded ? (
      <div className="px-4 py-2">
        <div className="h-2 bg-muted rounded-full animate-pulse" />
      </div>
    ) : null
  }

  const { monthlyUsed, monthlyLimit, usagePercent, planName, isUnlimited, overageTokens, overageCostYuan, allowOverage } = quota

  const pct = isUnlimited ? 0 : Math.min(100, usagePercent)
  const barColor =
    pct >= 90 ? 'bg-red-500' :
    pct >= 70 ? 'bg-amber-500' :
    'bg-emerald-500'

  const dotColor =
    pct >= 90 ? 'bg-red-500' :
    pct >= 70 ? 'bg-amber-500' :
    'bg-emerald-500'

  if (!expanded) {
    return (
      <div className="flex justify-center py-2" title={`${fmtTokens(monthlyUsed)} / ${fmtTokens(monthlyLimit)}`}>
        <div className={`w-2.5 h-2.5 rounded-full ${isUnlimited ? 'bg-blue-400' : dotColor}`} />
      </div>
    )
  }

  return (
    <div className="px-4 py-2 space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground truncate">{planName || 'Token 用量'}</span>
        <span className="text-muted-foreground tabular-nums">
          {isUnlimited ? `${fmtTokens(monthlyUsed)} (不限)` : `${fmtTokens(monthlyUsed)} / ${fmtTokens(monthlyLimit)}`}
        </span>
      </div>

      {!isUnlimited && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {overageTokens > 0 && allowOverage && (
        <p className="text-[10px] text-amber-500">
          超额 {fmtTokens(overageTokens)}（¥{overageCostYuan.toFixed(2)}）
        </p>
      )}

      {!isUnlimited && pct >= 90 && !allowOverage && (
        <p className="text-[10px] text-red-500">
          额度即将用完，建议升级套餐
        </p>
      )}
    </div>
  )
}
