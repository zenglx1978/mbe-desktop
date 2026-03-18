import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'error'
}

interface ToastState {
  toasts: Toast[]
  addToast: (message: string, type?: Toast['type']) => void
  removeToast: (id: string) => void
}

let toastId = 0
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = `toast_${Date.now()}_${++toastId}`
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast }: { toast: Toast; onClose: () => void }) {
  const bg =
    toast.type === 'success'
      ? 'bg-green-500/20 border-green-500/40'
      : toast.type === 'error'
        ? 'bg-red-500/20 border-red-500/40'
        : 'bg-secondary/80 border-border/50'

  return (
    <div
      className={`px-4 py-3 rounded-lg border text-sm shadow-lg ${bg}`}
      role="alert"
    >
      {toast.message}
    </div>
  )
}
