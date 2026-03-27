import { StatCard, UsageBar } from './dashboard-panel-widgets'
import type { BillingUsage, DashboardData, ROISummary, SLADashboardData } from '@/lib/workflow-os-service'
import { useBrandStore } from '@/stores/brand-store'
import { useAppStore } from '@/stores/app-store'

export interface DashboardStatCardsProps {
  dashboard: DashboardData
  roi: ROISummary | null
  billing: BillingUsage | null
  slaDash: SLADashboardData | null
}

function BrandOverviewCards() {
  const { brands, settlements, activeBrandId, setActiveBrand } = useBrandStore()
  const fmt = (n: number) => `¥${n >= 10000 ? `${(n / 10000).toFixed(1)}万` : n.toLocaleString()}`

  if (brands.length === 0) return null

  const filtered = activeBrandId
    ? settlements.filter((s) => s.brandId === activeBrandId)
    : settlements
  const filteredBrands = activeBrandId
    ? brands.filter((b) => b.id === activeBrandId)
    : brands
  const activeBrandsCount = filteredBrands.filter((b) => b.status === 'active').length
  const totalGmv = filtered.reduce((sum, s) => sum + s.gmv, 0)
  const receivable = filtered.filter((s) => s.status !== 'paid').reduce((sum, s) => sum + s.totalAmount, 0)
  const paid = filtered.filter((s) => s.status === 'paid').reduce((sum, s) => sum + s.totalAmount, 0)
  const selectedName = activeBrandId ? brands.find((b) => b.id === activeBrandId)?.name : null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {selectedName ? `${selectedName} 经营概览` : '品牌经营概览'}
        </h3>
        <select
          value={activeBrandId || ''}
          onChange={(e) => setActiveBrand(e.target.value || null)}
          className="text-xs px-2 py-1 rounded-lg border border-border/50 bg-secondary/20 outline-none cursor-pointer"
        >
          <option value="">全部品牌</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label={activeBrandId ? '状态' : '管理品牌'} value={activeBrandId ? (filteredBrands[0]?.status === 'active' ? '运营中' : '其他') : activeBrandsCount} icon="🏪" accent="#e11d48" suffix={activeBrandId ? '' : `/${brands.length}`} />
        <StatCard label="累计 GMV" value={fmt(totalGmv)} icon="📈" accent="#22c55e" />
        <StatCard label="应收佣金" value={fmt(receivable)} icon="⏳" accent="#f59e0b" />
        <StatCard label="已收佣金" value={fmt(paid)} icon="✅" accent="#22c55e" />
      </div>
    </div>
  )
}

export function DashboardStatCards({ dashboard, roi, billing, slaDash }: DashboardStatCardsProps) {
  const solutionId = useAppStore((s) => s.solutionId)
  const isEcommerce = solutionId === 'ecommerce-brand-service'

  return (
    <>
      {(roi?.total_workflows_completed ?? 0) > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4">
          <p className="text-lg font-semibold text-foreground">
            {roi?.headline || 'AI 效率飞轮正在加速'}
          </p>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
            <span>
              <span className="text-primary font-bold text-base">{roi!.total_human_hours_saved}</span> 小时节省
            </span>
            <span>
              <span className="text-green-500 font-bold text-base">¥{roi!.total_cost_saved_yuan.toLocaleString()}</span> 成本节省
            </span>
            <span>
              <span className="text-amber-500 font-bold text-base">{roi!.avg_acceleration_ratio}x</span> 加速比
            </span>
            <span>
              <span className="text-purple-500 font-bold text-base">{roi!.total_workflows_completed}</span> 个工作流
            </span>
          </div>
        </div>
      )}

      {isEcommerce && <BrandOverviewCards />}

      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          工作流概览
        </h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="进行中" value={dashboard.summary.active} icon="🔄" accent="#3b82f6" />
          <StatCard label="今日完成" value={dashboard.summary.completed_today} icon="✅" accent="#22c55e" />
          <StatCard label="节省工时" value={dashboard.data_flywheel.total_hours_saved || 0} icon="⏱️" accent="#f59e0b" suffix="h" />
          <StatCard label="待审批" value={dashboard.summary.pending_approval} icon="🛡️" accent="#f97316" />
        </div>
      </div>

      {billing && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl p-5 border border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {billing.plan_name}
            </h3>
            {billing.price_yuan > 0 && (
              <span className="text-xs text-neutral-500">
                ¥{billing.price_yuan}/月
              </span>
            )}
          </div>
          <UsageBar
            label="工作流"
            used={billing.usage.workflows}
            limit={billing.limits.workflows}
            percent={billing.usage_percent.workflows}
          />
          <UsageBar
            label="交付物"
            used={billing.usage.deliverables}
            limit={billing.limits.deliverables}
            percent={billing.usage_percent.deliverables}
          />
          {billing.usage.billable_total > 0 && (
            <div className="mt-2 text-xs text-neutral-500">
              本月计费: ¥{billing.usage.billable_total.toFixed(2)}
            </div>
          )}
        </div>
      )}

      {slaDash && slaDash.active_trackers > 0 && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl p-5 border border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              SLA 监控
            </h3>
            <div className="flex items-center gap-2 text-xs">
              {slaDash.health.green > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{slaDash.health.green}</span>}
              {slaDash.health.yellow > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{slaDash.health.yellow}</span>}
              {slaDash.health.red > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{slaDash.health.red}</span>}
              {slaDash.health.black > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neutral-900 dark:bg-neutral-400" />{slaDash.health.black}</span>}
            </div>
          </div>
          {slaDash.active_breaches > 0 && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs">
              {slaDash.active_breaches} 个步骤超时
            </div>
          )}
          <div className="space-y-2">
            {slaDash.trackers.slice(0, 5).map((t) => (
              <div key={`${t.instance_id}-${t.step_id}`} className="flex items-center gap-3 text-xs">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  t.health === 'green' ? 'bg-emerald-500' :
                  t.health === 'yellow' ? 'bg-amber-500' :
                  t.health === 'red' ? 'bg-red-500' : 'bg-neutral-900 dark:bg-neutral-400'
                }`} />
                <span className="truncate flex-1 text-neutral-700 dark:text-neutral-300">{t.step_id}</span>
                <span className="text-muted-foreground shrink-0">
                  {t.elapsed_minutes.toFixed(0)}m / {t.deadline_minutes}m
                </span>
                {t.circuit_broken && <span className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-[9px]">熔断</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
