import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface UpdateInfo {
  status: 'available' | 'downloading' | 'installing' | 'error' | string
  version?: string
  progress?: number
  error?: string
  bytesPerSecond?: number
  transferred?: number
  total?: number
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.updater?.onStatus) return

    const cleanup = api.updater.onStatus((data: UpdateInfo) => {
      setInfo(data)
      if (data.status !== 'error') setDismissed(false)
    })
    return cleanup
  }, [])

  const handleRetry = useCallback(() => {
    const api = (window as any).electronAPI
    api?.updater?.check()
    setInfo(null)
    setDismissed(false)
  }, [])

  if (!info || dismissed) return null

  if (info.status === 'installing') {
    return (
      <div className="fixed bottom-0 inset-x-0 z-[100] h-8 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        正在安装 v{info.version}，即将重启...
      </div>
    )
  }

  if (info.status === 'downloading') {
    const pct = info.progress ?? 0
    const speedText = info.bytesPerSecond ? `${formatBytes(info.bytesPerSecond)}/s` : ''
    const sizeText = info.total ? `${formatBytes(info.transferred ?? 0)} / ${formatBytes(info.total)}` : ''
    return (
      <div className="fixed bottom-0 inset-x-0 z-[100] h-8 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>正在下载 v{info.version}... {pct}%</span>
        {sizeText && <span className="opacity-70">{sizeText}</span>}
        {speedText && <span className="opacity-70">{speedText}</span>}
      </div>
    )
  }

  if (info.status === 'error') {
    return (
      <div className="fixed bottom-0 inset-x-0 z-[100] h-8 bg-destructive text-destructive-foreground flex items-center justify-center gap-3 text-xs">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>更新失败: {info.error || '未知错误'}</span>
        <button
          onClick={handleRetry}
          className="px-3 py-0.5 rounded border border-white/40 hover:bg-white/10 transition-colors"
        >
          重试
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="px-2 py-0.5 rounded hover:bg-white/10 transition-colors opacity-70"
        >
          关闭
        </button>
      </div>
    )
  }

  if (info.status === 'available') {
    return (
      <div className="fixed bottom-0 inset-x-0 z-[100] h-8 bg-primary text-primary-foreground flex items-center justify-center gap-3 text-xs">
        <span>新版本 v{info.version} 可用</span>
        <button
          onClick={() => setDismissed(true)}
          className="px-3 py-0.5 rounded border border-white/40 hover:bg-white/10 transition-colors"
        >
          稍后
        </button>
        <button
          onClick={() => {
            const api = (window as any).electronAPI
            api?.updater?.download()
            setInfo({ ...info, status: 'downloading', progress: 0 })
          }}
          className="px-3 py-0.5 rounded bg-primary-foreground text-primary font-medium hover:opacity-90 transition-colors"
        >
          立即安装
        </button>
      </div>
    )
  }

  return null
}
