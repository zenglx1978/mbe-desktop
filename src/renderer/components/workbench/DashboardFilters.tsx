export interface DashboardMarketplaceSearchProps {
  mktQuery: string
  onQueryChange: (value: string) => void
}

/** 工作流市场标题 + 搜索框（筛选模板列表） */
export function DashboardMarketplaceSearch({ mktQuery, onQueryChange }: DashboardMarketplaceSearchProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        工作流市场
      </h3>
      <input
        className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 bg-transparent w-36"
        placeholder="搜索模板..."
        value={mktQuery}
        onChange={(e) => onQueryChange(e.target.value)}
      />
    </div>
  )
}
