import { useConnectivityStore } from '@/stores/connectivity-store'

export default function ConnectivityBadge() {
  const { mode, browserOnline } = useConnectivityStore()
  const isOnline = mode === 'online' || (mode === 'degraded' && browserOnline)

  const label = isOnline ? '在线' : mode === 'degraded' ? '不稳定' : '离线'

  return (
    <div
      className="flex items-center gap-1.5 text-xs"
      role="status"
      aria-label={`网络状态: ${label}`}
    >
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${
          isOnline ? 'bg-green-500' : mode === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
        }`}
        aria-hidden="true"
      />
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}
