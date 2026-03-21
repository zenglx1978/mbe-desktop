import { useConnectivityStore } from '@/stores/connectivity-store'

export default function OfflineBanner() {
  const { mode } = useConnectivityStore()

  if (mode === 'online') return null

  const isDegraded = mode === 'degraded'
  const bgClass = isDegraded
    ? 'bg-amber-500/15 border-amber-500/30 text-amber-200'
    : 'bg-red-500/15 border-red-500/30 text-red-200'

  const message = isDegraded
    ? '网络连接不稳定 — AI 对话可能不可用，本地计算和已缓存数据仍可使用'
    : '当前处于离线模式 — 仅本地计算和已缓存数据可用'

  return (
    <div
      className={`shrink-0 px-4 py-2 text-xs border-b flex items-center gap-2 ${bgClass}`}
      role="status"
      aria-live="polite"
    >
      <svg
        className="w-4 h-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        {isDegraded ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
        )}
      </svg>
      <span>{message}</span>
      <button
        onClick={() => useConnectivityStore.getState().checkConnectivity()}
        className="ml-auto text-xs underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
      >
        重新检测
      </button>
    </div>
  )
}
