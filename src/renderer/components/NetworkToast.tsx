/**
 * NetworkToast — 网络状态切换瞬态通知
 *
 * 当 connectivity mode 发生变化时，在右下角弹出自动消失的 toast。
 * - online：绿色 ✓ 已恢复连接
 * - degraded：橙色 ⚠ 网络不稳定
 * - offline：红色 ✕ 已离线
 *
 * 与 OfflineBanner（持久条）互补：Toast 负责变化瞬间的感知，
 * OfflineBanner 负责离线状态的持续提醒。
 */
import { useEffect, useState } from 'react'
import { useConnectivityStore, type ConnectivityMode } from '@/stores/connectivity-store'

interface ToastState {
  id: number
  mode: ConnectivityMode
  visible: boolean
}

const TOAST_DURATION = 3500 // 自动消失时间（ms）

const TOAST_CONFIG: Record<ConnectivityMode, { bg: string; border: string; text: string; icon: string; label: string }> = {
  online: {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    text: 'text-emerald-200',
    icon: '✓',
    label: '网络连接已恢复',
  },
  degraded: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    text: 'text-amber-200',
    icon: '⚠',
    label: '网络连接不稳定',
  },
  offline: {
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
    text: 'text-red-200',
    icon: '✕',
    label: '已进入离线模式',
  },
}

export default function NetworkToast() {
  const mode = useConnectivityStore((s) => s.mode)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [prevMode, setPrevMode] = useState<ConnectivityMode | null>(null)

  useEffect(() => {
    // 首次加载不弹 toast，只在后续模式切换时触发
    if (prevMode === null) {
      setPrevMode(mode)
      return
    }
    if (prevMode === mode) return

    setPrevMode(mode)

    const id = Date.now()
    setToast({ id, mode, visible: true })

    // 自动消失
    const timer = setTimeout(() => {
      setToast((t) => (t?.id === id ? { ...t, visible: false } : t))
    }, TOAST_DURATION)

    // 淡出动画后清除 DOM
    const cleanup = setTimeout(() => {
      setToast((t) => (t?.id === id ? null : t))
    }, TOAST_DURATION + 400)

    return () => {
      clearTimeout(timer)
      clearTimeout(cleanup)
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!toast) return null

  const cfg = TOAST_CONFIG[toast.mode]

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        fixed bottom-5 right-5 z-50
        flex items-center gap-2.5 px-4 py-2.5
        rounded-xl border text-xs font-medium
        shadow-lg backdrop-blur-sm
        transition-all duration-400
        ${cfg.bg} ${cfg.border} ${cfg.text}
        ${toast.visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2 pointer-events-none'
        }
      `}
    >
      <span className="text-sm">{cfg.icon}</span>
      <span>{cfg.label}</span>
    </div>
  )
}
