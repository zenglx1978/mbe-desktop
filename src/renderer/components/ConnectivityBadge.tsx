import { useConnectivityStore } from '@/stores/connectivity-store'

export default function ConnectivityBadge() {
  const { mode, browserOnline } = useConnectivityStore()
  const isOnline = mode === 'online' || (mode === 'degraded' && browserOnline)

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${
          isOnline ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      <span className="text-muted-foreground">{isOnline ? '在线' : '离线'}</span>
    </div>
  )
}
