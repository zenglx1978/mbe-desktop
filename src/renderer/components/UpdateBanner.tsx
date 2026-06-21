import { useState, useEffect, useCallback, type ReactNode } from 'react'
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

function BannerShell({
  tone = 'primary',
  children,
}: {
  tone?: 'primary' | 'danger'
  children: ReactNode
}) {
  const toneClass = tone === 'danger'
    ? 'bg-destructive text-destructive-foreground'
    : 'bg-primary text-primary-foreground'
  return (
    <div className={`fixed bottom-5 left-1/2 z-[100] w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl px-4 py-4 text-xs shadow-2xl ${toneClass}`}>
      <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        {children}
      </div>
    </div>
  )
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
      <BannerShell>
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>正在安装 v{info.version}，即将重启...</span>
      </BannerShell>
    )
  }

  if (info.status === 'downloading') {
    const pct = info.progress ?? 0
    const speedText = info.bytesPerSecond ? `${formatBytes(info.bytesPerSecond)}/s` : ''
    const sizeText = info.total ? `${formatBytes(info.transferred ?? 0)} / ${formatBytes(info.total)}` : ''
    return (
      <BannerShell>
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>正在下载 v{info.version}... {pct}%</span>
        {sizeText && <span className="opacity-70">{sizeText}</span>}
        {speedText && <span className="opacity-70">{speedText}</span>}
      </BannerShell>
    )
  }

  if (info.status === 'error') {
    return (
      <BannerShell tone="danger">
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
      </BannerShell>
    )
  }

  if (info.status === 'available') {
    return (
      <BannerShell>
        <span className="text-center font-medium sm:flex-1 sm:text-left">新版本 v{info.version} 可用</span>
        <button
          onClick={() => {
            const api = (window as any).electronAPI
            api?.updater?.download()
            setInfo({ ...info, status: 'downloading', progress: 0 })
          }}
          className="min-h-10 rounded-xl bg-primary-foreground px-5 py-2 text-sm font-bold text-primary shadow-sm hover:opacity-90 transition-colors"
        >
          立即安装
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="min-h-10 rounded-xl border border-white/50 px-5 py-2 text-sm font-semibold hover:bg-white/10 transition-colors"
        >
          稍后
        </button>
      </BannerShell>
    )
  }

  return null
}
