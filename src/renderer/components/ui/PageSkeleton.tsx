/**
 * 页面级加载骨架屏 — 用于 lazy 页面 + 数据加载阶段
 */
export default function PageSkeleton({ lines = 5, title }: { lines?: number; title?: string }) {
  return (
    <div className="flex-1 p-6 space-y-4 animate-pulse" role="status" aria-label="加载中">
      {title && (
        <div className="h-7 bg-secondary/60 rounded w-48" />
      )}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-secondary/40 rounded"
            style={{ width: `${Math.max(30, 100 - i * 12)}%` }}
          />
        ))}
      </div>
      <span className="sr-only">正在加载内容…</span>
    </div>
  )
}
