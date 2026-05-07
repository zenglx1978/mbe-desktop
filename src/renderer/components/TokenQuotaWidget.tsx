/**
 * Sidebar 紧凑型 Token 额度组件（重设计版）
 *
 * 展开态新增：
 *  - 剩余额度百分比 + 精确数字
 *  - 月度重置倒计时
 *  - 使用率 ≥ 70%：「升级套餐」按钮跳转到账户面板
 *  - 超额使用：金额警告
 *
 * 折叠态：小色点 + title tooltip（不变）
 */
import { useCallback } from 'react'
import { useTokenQuota } from '@/hooks/useTokenQuota'
import { useToolStore } from '@/stores/tool-store'
import type { WorkbenchTab } from '@/lib/solution-router'
import { Zap, ArrowUpCircle, AlertTriangle } from 'lucide-react'

// ─── 格式化工具 ───────────────────────────────────────────────────────────────

function fmtTokens(n: number): string {
  if (n < 0) return '∞'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

/** 将 ISO 日期字符串换算为"还有 N 天"，最大 31 天 */
function daysUntil(iso: string): number | null {
  if (!iso) return null
  try {
    const ms = new Date(iso).getTime() - Date.now()
    const days = Math.ceil(ms / 86_400_000)
    return days > 0 ? days : 0
  } catch {
    return null
  }
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export default function TokenQuotaWidget({ expanded }: { expanded: boolean }) {
  const { quota, loading } = useTokenQuota()
  const setActiveTab = useToolStore((s) => s.setActiveTab)

  const goToAccount = useCallback(() => {
    setActiveTab('account' as WorkbenchTab)
  }, [setActiveTab])

  // ── 加载中骨架 ──────────────────────────────────────────────────────────────

  if (!quota && loading) {
    return expanded ? (
      <div className="px-4 py-2">
        <div className="h-2 bg-muted rounded-full animate-pulse" />
      </div>
    ) : null
  }

  if (!quota) return null

  const {
    monthlyUsed,
    monthlyLimit,
    monthlyRemaining,
    usagePercent,
    planName,
    isUnlimited,
    overageTokens,
    overageCostYuan,
    allowOverage,
    resetAt,
  } = quota

  const pct = isUnlimited ? 0 : Math.min(100, usagePercent)
  const remainPct = Math.max(0, 100 - pct)
  const daysLeft = daysUntil(resetAt)

  // 配色：90% → 红，70% → 橙，其他 → 绿
  const urgency: 'critical' | 'warning' | 'ok' =
    pct >= 90 ? 'critical' : pct >= 70 ? 'warning' : 'ok'

  const barColor =
    urgency === 'critical' ? 'bg-red-500' :
    urgency === 'warning' ? 'bg-amber-500' :
    'bg-emerald-500'

  const dotColor =
    urgency === 'critical' ? 'bg-red-500' :
    urgency === 'warning' ? 'bg-amber-500' :
    isUnlimited ? 'bg-blue-400' :
    'bg-emerald-500'

  const tooltipText = isUnlimited
    ? `${fmtTokens(monthlyUsed)} 已用（不限量）`
    : `已用 ${fmtTokens(monthlyUsed)} / ${fmtTokens(monthlyLimit)} · 剩余 ${fmtTokens(monthlyRemaining)}`

  // ── 折叠态：小色点 ─────────────────────────────────────────────────────────

  if (!expanded) {
    return (
      <div className="flex justify-center py-2" title={tooltipText}>
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor} ${urgency === 'critical' ? 'animate-pulse' : ''}`} />
      </div>
    )
  }

  // ── 展开态 ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-3 py-2 space-y-2">
      {/* 套餐名 + 图标 */}
      <div className="flex items-center gap-1.5">
        <Zap className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="text-[11px] text-muted-foreground font-medium truncate">
          {planName || 'AI 用量'}
        </span>
        {isUnlimited && (
          <span className="ml-auto text-[10px] text-blue-500 font-medium">不限量</span>
        )}
      </div>

      {/* 进度条 + 剩余百分比 */}
      {!isUnlimited && (
        <>
          <div className="space-y-1">
            {/* 数字行 */}
            <div className="flex items-end justify-between text-[10px]">
              <span className="text-muted-foreground/70 tabular-nums">
                已用 <span className="text-foreground font-medium">{fmtTokens(monthlyUsed)}</span>
              </span>
              <span className={`font-semibold tabular-nums ${
                urgency === 'critical' ? 'text-red-500' :
                urgency === 'warning' ? 'text-amber-500' :
                'text-emerald-600'
              }`}>
                {fmtTokens(monthlyRemaining >= 0 ? monthlyRemaining : 0)} 剩余
              </span>
            </div>

            {/* 进度条：剩余部分右端高亮 */}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden flex-row-reverse" title={`${pct.toFixed(0)}% 已使用`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* 剩余 % + 重置倒计时 */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
              <span>{remainPct.toFixed(0)}% 剩余</span>
              {daysLeft !== null && (
                <span>{daysLeft} 天后重置</span>
              )}
            </div>
          </div>
        </>
      )}

      {/* 不限量套餐：仅显示已用量 */}
      {isUnlimited && (
        <div className="text-[10px] text-muted-foreground/60 tabular-nums">
          本月已用 {fmtTokens(monthlyUsed)}
        </div>
      )}

      {/* 超额警告 */}
      {overageTokens > 0 && allowOverage && (
        <div className="flex items-center gap-1 text-[10px] text-amber-500">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>超额 {fmtTokens(overageTokens)}（¥{overageCostYuan.toFixed(2)}）</span>
        </div>
      )}

      {/* 升级按钮 — 使用率 ≥ 70% 或有超额时展示 */}
      {!isUnlimited && (urgency !== 'ok' || overageTokens > 0) && (
        <button
          type="button"
          onClick={goToAccount}
          className={`
            w-full flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium
            transition-all active:scale-95
            ${urgency === 'critical'
              ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
              : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/20'
            }
          `}
          title="前往账户 → 订阅管理"
        >
          <ArrowUpCircle className="w-3 h-3 shrink-0" />
          {urgency === 'critical' ? '立即升级 · 额度告急' : '升级套餐'}
        </button>
      )}
    </div>
  )
}
