import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, DollarSign, Users, RefreshCw, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { authFetch, API_BASE } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { safeNum, safeFixed } from '@/lib/safe-num'
import { parseROISummary, type ROISummary } from '@/lib/api-schemas'

// ROISummary 类型统一从 api-schemas 导入，字段默认值由 Zod 保证。

export default function ROIPanel() {
  const [data, setData] = useState<ROISummary | null>(null)
  const [loading, setLoading] = useState(false)
  const user = useAuthStore((s) => s.user)
  const isInternal = user?.role === 'admin' || user?.role === 'mbe_staff'

  const fetchROI = useCallback(async () => {
    setLoading(true)
    try {
      // 外部付费用户始终走 /my（只看自己的数据）；内部员工才可访问 /dashboard 汇总视图
      const myResp = await authFetch(`${API_BASE}/api/v1/admin/entrepreneur-roi/my`)
      if (myResp.ok) {
        const json = await myResp.json()
        if (json?.success) {
          const d = json.data ?? {}
          setData(parseROISummary({
            total_revenue: d.revenue,
            total_cost:    d.cost,
            total_profit:  d.profit,
            overall_roi:   d.roi_percent,
            roles:         [],
            period:        d.period,
          }))
          setLoading(false)
          return
        }
      }
      // 仅内部员工 fallback 到汇总 dashboard
      if (isInternal) {
        const dashResp = await authFetch(`${API_BASE}/api/v1/admin/entrepreneur-roi/dashboard`)
        if (dashResp.ok) {
          const json = await dashResp.json()
          if (json?.success) setData(parseROISummary(json.data))
        }
      }
    } catch {
      setData(null)
    }
    setLoading(false)
  }, [isInternal])

  useEffect(() => { fetchROI() }, [fetchROI])

  const fmt = (v: unknown) => {
    const n = safeNum(v)
    if (Math.abs(n) >= 10000) return `¥${(n / 10000).toFixed(1)}万`
    return `¥${n.toFixed(0)}`
  }

  const roiColor = (roi: number) =>
    roi >= 100 ? 'text-green-600' : roi >= 0 ? 'text-yellow-600' : 'text-red-600'

  const RoiArrow = ({ roi }: { roi: number }) =>
    roi >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">企业家 ROI 仪表盘</span>
        </div>
        <button
          onClick={fetchROI}
          disabled={loading}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 总览卡片 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <DollarSign className="w-3 h-3" /> 总营收
            </div>
            <div className="text-lg font-semibold">
              {data ? fmt(data.total_revenue) : '—'}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <BarChart3 className="w-3 h-3" /> 总成本
            </div>
            <div className="text-lg font-semibold">
              {data ? fmt(data.total_cost) : '—'}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <TrendingUp className="w-3 h-3" /> 利润
            </div>
            <div className="text-lg font-semibold">
              {data ? fmt(data.total_profit) : '—'}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              ROI
            </div>
            <div className={`text-lg font-semibold flex items-center gap-1 ${data ? roiColor(data.overall_roi) : ''}`}>
              {data ? (
                <>
                  {safeFixed(data.overall_roi, 1)}%
                  <RoiArrow roi={data.overall_roi} />
                </>
              ) : '—'}
            </div>
          </div>
        </div>

        {/* 按角色 ROI */}
        {data?.roles && data.roles.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Users className="w-3 h-3" /> 按角色 ROI 分析
            </h3>
            <div className="space-y-2">
              {data.roles
                .sort((a, b) => b.roi_percent - a.roi_percent)
                .map((role) => (
                  <div key={role.role} className="rounded-lg border p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">{role.role_display || role.role}</span>
                      <span className={`text-sm font-semibold flex items-center gap-0.5 ${roiColor(role.roi_percent)}`}>
                        {safeFixed(role.roi_percent, 1)}%
                        <RoiArrow roi={role.roi_percent} />
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>营收 {fmt(role.revenue)}</span>
                      <span>成本 {fmt(role.cost)}</span>
                      <span>用户 {role.user_count}</span>
                    </div>
                    {/* 简易进度条 */}
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${role.roi_percent >= 100 ? 'bg-green-500' : role.roi_percent >= 0 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(Math.max(role.roi_percent, 0), 200) / 2}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {!loading && !data && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>暂无 ROI 数据</p>
            <p className="text-xs mt-1">数据将在用户产生消费后自动生成</p>
          </div>
        )}
      </div>
    </div>
  )
}
