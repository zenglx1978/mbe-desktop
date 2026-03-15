import { useConnectivityStore, type ConnectivityMode } from '@/stores/connectivity-store'

const MODE_CONFIG: Record<ConnectivityMode, { dot: string; label: string; desc: string }> = {
  online: {
    dot: 'bg-emerald-500',
    label: '在线',
    desc: 'AI 对话和本地计算均可用',
  },
  degraded: {
    dot: 'bg-amber-500',
    label: '降级',
    desc: '网络不稳定，AI 对话可能受限',
  },
  offline: {
    dot: 'bg-red-500',
    label: '离线',
    desc: '本地计算可用，AI 对话暂不可用',
  },
}

export default function ConnectivityBadge() {
  const { mode, pythonAvailable, availableScripts } = useConnectivityStore()
  const config = MODE_CONFIG[mode]

  return (
    <div className="group relative">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-default">
        <div className={`w-2 h-2 rounded-full ${config.dot} ${mode === 'online' ? 'animate-pulse' : ''}`} />
        <span>{config.label}</span>
      </div>

      {/* Tooltip */}
      <div className="absolute right-0 top-full mt-2 w-56 p-3 rounded-lg bg-card border border-border shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
        <p className="text-xs font-medium mb-2">{config.desc}</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>本地 Python</span>
            <span>{pythonAvailable ? '✓ 可用' : '✗ 未安装'}</span>
          </div>
          <div className="flex justify-between">
            <span>本地计算</span>
            <span>{availableScripts.length} 项可用</span>
          </div>
        </div>
        {mode === 'offline' && availableScripts.length > 0 && (
          <p className="text-xs text-primary mt-2">
            输入 /calc 使用离线计算
          </p>
        )}
      </div>
    </div>
  )
}
