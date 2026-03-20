import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, DollarSign, Users, RefreshCw, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { authFetch, API_BASE } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'

interface RoleROI {
  role: string
  role_display: string
  revenue: number
  cost: number
  profit: number
  roi_percent: number
  user_count: number
}

interface ROISummary {
  total_revenue: number
  total_cost: number
  total_profit: number
  overall_roi: number
  roles: RoleROI[]
  period: string
}

export default function ROIPanel() {
  const [data, setData] = useState<ROISummary | null>(null)
  const [loading, setLoading] = useState(false)
  const solutionId = useAppStore(s => s.solutionId)

  const fetchROI = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await authFetch(`${API_BASE}/api/v1/admin/entrepreneur-roi/dashboard`)
      if (resp.ok) {
        const json = await resp.json()
        if (json?.success) setData(json.data)
      } else {
        throw new Error('dashboard API failed')
      }
    } catch {
      try {
        const resp = await authFetch(`${API_BASE}/api/v1/admin/entrepreneur-roi/my`)
        if (resp.ok) {
          const json = await resp.json()
          if (json?.success) {
            const d = json.data
            setData({
              total_revenue: d.revenue || 0,
              total_cost: d.cost || 0,
              total_profit: d.profit || 0,
              overall_roi: d.roi_percent || 0,
              roles: [],
              period: d.period || '',
            })
          }
        }
      } catch {
        setData(null)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchROI() }, [fetchROI])

  const fmt = (v: number) => {
    if (Math.abs(v) >= 10000) return `¥${(v / 10000).toFixed(1)}万`
    return `¥${v.toFixed(0)}`
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
                  {data.overall_roi.toFixed(1)}%
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
                        {role.roi_percent.toFixed(1)}%
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
