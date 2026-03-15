/**
 * ToastContainer — 轻量 Toast 通知系统
 *
 * 基于 Zustand + Tailwind 实现，无外部依赖。
 * 支持多条并存、自动消失、手动关闭、风险等级色彩。
 */

import { useEffect, useCallback, useMemo } from 'react'
import { create } from 'zustand'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

export interface ToastItem {
  id: string
  title: string
  message: string
  variant: 'info' | 'success' | 'warning' | 'error'
  /** 点击 Toast 时的回调 */
  onClick?: () => void
  /** 自动消失时间（ms），0 表示不自动消失 */
  duration: number
  createdAt: number
}

interface ToastState {
  toasts: ToastItem[]
  push: (toast: Omit<ToastItem, 'id' | 'createdAt'>) => string
  dismiss: (id: string) => void
  clear: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const item: ToastItem = { ...toast, id, createdAt: Date.now() }
    set((state) => ({
      toasts: [...state.toasts.slice(-4), item],
    }))
    return id
  },

  dismiss: (id) => {
    set((state) => ({
      toasts: state.toasts.filter(t => t.id !== id),
    }))
  },

  clear: () => set({ toasts: [] }),
}))

const VARIANT_STYLES: Record<ToastItem['variant'], { bg: string; border: string; icon: string }> = {
  info: { bg: 'bg-blue-900/90', border: 'border-blue-500/40', icon: 'ℹ️' },
  success: { bg: 'bg-green-900/90', border: 'border-green-500/40', icon: '✅' },
  warning: { bg: 'bg-yellow-900/90', border: 'border-yellow-500/40', icon: '⚠️' },
  error: { bg: 'bg-red-900/90', border: 'border-red-500/40', icon: '🚨' },
}

function SingleToast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const style = VARIANT_STYLES[toast.variant]

  useEffect(() => {
    if (toast.duration <= 0) return
    const timer = setTimeout(onDismiss, toast.duration)
    return () => clearTimeout(timer)
  }, [toast.duration, onDismiss])

  return (
    <div
      className={clsx(
        'pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-2xl',
        'backdrop-blur-sm transition-all duration-300 animate-slide-in-right',
        'max-w-sm cursor-pointer',
        style.bg,
        style.border,
      )}
      onClick={(e) => {
        e.stopPropagation()
        toast.onClick?.()
        onDismiss()
      }}
      role="alert"
    >
      <span className="text-lg flex-shrink-0 mt-0.5">{style.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{toast.title}</p>
        <p className="text-xs text-white/70 mt-0.5 line-clamp-2">{toast.message}</p>
      </div>
      <button
        className="text-white/50 hover:text-white flex-shrink-0 mt-0.5"
        onClick={(e) => { e.stopPropagation(); onDismiss() }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  const handleDismiss = useCallback((id: string) => () => dismiss(id), [dismiss])

  const renderedToasts = useMemo(() =>
    toasts.map(t => (
      <SingleToast key={t.id} toast={t} onDismiss={handleDismiss(t.id)} />
    )),
    [toasts, handleDismiss]
  )

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {renderedToasts}
    </div>
  )
}
