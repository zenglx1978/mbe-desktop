import { DashboardMarketplaceSearch } from './DashboardFilters'
import { safeFixed, safeLocale } from '@/lib/safe-num'
import {
  installFromMarketplace,
  type AnalyticsOverview,
  type AnalyticsRecommendation,
  type MarketplaceCard,
  type ROIPredictionData,
} from '@/lib/workflow-os-service'

export interface DashboardChartsProps {
  agentName: string
  mktQuery: string
  mktItems: MarketplaceCard[]
  onMktQueryChange: (value: string) => void
  onMarketplaceSearch: (query: string) => void
  anlOverview: AnalyticsOverview | null
  anlRecs: AnalyticsRecommendation[]
  roiPred: ROIPredictionData | null
}

export function DashboardCharts({
  agentName,
  mktQuery,
  mktItems,
  onMktQueryChange,
  onMarketplaceSearch,
  anlOverview,
  anlRecs,
  roiPred,
}: DashboardChartsProps) {
  return (
    <>
      <div className="bg-white dark:bg-neutral-800 rounded-xl p-5 border border-neutral-200 dark:border-neutral-700">
        <DashboardMarketplaceSearch
          mktQuery={mktQuery}
          onQueryChange={(v) => {
            onMktQueryChange(v)
            onMarketplaceSearch(v)
          }}
        />
        {mktItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">暂无模板</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {mktItems.map((item) => (
              <div key={item.listing_id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.icon || '\u{1F4CB}'}</span>
                  <span className="text-xs font-medium truncate flex-1">{item.title}</span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{item.description}</p>
                <div className="flex items-center justify-between mt-auto pt-1">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{item.avg_rating > 0 ? `${'★'.repeat(Math.round(item.avg_rating))} ${item.avg_rating}` : '暂无评分'}</span>
                    <span>{item.install_count} 次安装</span>
                  </div>
                  <button
                    className="text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                    onClick={async () => {
                      const ok = await installFromMarketplace(agentName, item.listing_id)
                      if (ok) alert('安装成功')
                    }}
                  >
                    安装
                  </button>
                </div>
                {item.is_fork && <span className="text-[9px] text-amber-600 dark:text-amber-400">衍生版</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {anlOverview && anlOverview.total_executions > 0 && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl p-5 border border-neutral-200 dark:border-neutral-700">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
            工作流分析
          </h3>
          <div className="grid grid-cols-4 gap-3 mb-3">
            {[
              { label: '执行', value: anlOverview.total_executions },
              { label: '成功率', value: `${safeFixed(anlOverview.success_rate * 100, 0)}%` },
              { label: '活跃流程', value: anlOverview.active_workflows },
              { label: 'ROI', value: `¥${safeLocale(anlOverview.total_roi_saved)}` },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{s.value}</div>
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {roiPred && roiPred.predicted_next_month > 0 && (
            <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-800 dark:text-emerald-300 mb-3">
              <span className="font-medium">ROI 预测</span>：下月 ¥{safeLocale(roiPred.predicted_next_month)}
              {roiPred.growth_rate !== 0 && (
                <span className={roiPred.growth_rate > 0 ? 'text-emerald-600' : 'text-red-500'}>
                  {' '}({roiPred.growth_rate > 0 ? '+' : ''}{safeFixed(roiPred.growth_rate * 100, 0)}%)
                </span>
              )}
              <span className="text-muted-foreground ml-1">置信度 {safeFixed(roiPred.confidence * 100, 0)}%</span>
            </div>
          )}

          {anlRecs.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300">智能推荐</div>
              {anlRecs.map((r) => (
                <div key={r.rec_id} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${
                    r.impact === 'high' ? 'bg-red-500' : r.impact === 'medium' ? 'bg-amber-500' : 'bg-blue-400'
                  }`} />
                  <div>
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">{r.title}</div>
                    <div className="text-muted-foreground">{r.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
