import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

interface UpdateInfo {
  status: 'available' | 'downloading' | 'installing' | string
  version?: string
  progress?: number
}

export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.updater?.onStatus) return

    const cleanup = api.updater.onStatus((data: UpdateInfo) => {
      setInfo(data)
      setDismissed(false)
    })
    return cleanup
  }, [])

  if (!info || dismissed) return null

  if (info.status === 'installing') {
    return (
      <div className="fixed bottom-0 inset-x-0 z-[100] h-8 bg-[#007acc] text-white flex items-center justify-center gap-2 text-xs">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        正在安装 v{info.version}，即将重启...
      </div>
    )
  }

  if (info.status === 'downloading') {
    return (
      <div className="fixed bottom-0 inset-x-0 z-[100] h-8 bg-[#007acc] text-white flex items-center justify-center gap-2 text-xs">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        正在下载更新 v{info.version}...
      </div>
    )
  }

  if (info.status === 'available') {
    return (
      <div className="fixed bottom-0 inset-x-0 z-[100] h-8 bg-[#007acc] text-white flex items-center justify-center gap-3 text-xs">
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
            setInfo({ ...info, status: 'downloading' })
          }}
          className="px-3 py-0.5 rounded bg-white text-[#007acc] font-medium hover:bg-white/90 transition-colors"
        >
          立即安装
        </button>
      </div>
    )
  }

  return null
}
