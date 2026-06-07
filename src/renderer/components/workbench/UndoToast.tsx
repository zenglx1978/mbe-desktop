/**
 * 撤销通知 Toast — QuickBooks "Undo" 体验
 *
 * 执行操作后底部浮出 toast，提供 5 秒内撤销的机会。
 */
import { useState, useEffect, useCallback } from 'react'
import { Undo2, RotateCcw } from 'lucide-react'
import { subscribe, canUndo, canRedo, undo, redo, getUndoStack } from '@/lib/undo-manager'

const TOAST_DURATION = 5000

export default function UndoToast() {
  const [lastAction, setLastAction] = useState<{ label: string; id: string } | null>(null)
  const [visible, setVisible] = useState(false)
  const [undoable, setUndoable] = useState(false)
  const [redoable, setRedoable] = useState(false)

  useEffect(() => {
    const unsub = subscribe(() => {
      setUndoable(canUndo())
      setRedoable(canRedo())

      const stack = getUndoStack()
      if (stack.length > 0) {
        const latest = stack[0]!
        setLastAction({ label: latest.label, id: latest.id })
        setVisible(true)
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => setVisible(false), TOAST_DURATION)
    return () => clearTimeout(timer)
  }, [visible, lastAction?.id])

  const handleUndo = useCallback(() => {
    const action = undo()
    if (action) {
      setLastAction({ label: `已撤销: ${action.label}`, id: `undo-${action.id}` })
    }
  }, [])

  const handleRedo = useCallback(() => {
    const action = redo()
    if (action) {
      setLastAction({ label: `已重做: ${action.label}`, id: `redo-${action.id}` })
    }
  }, [])

  if (!visible && !undoable && !redoable) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
      {/* Toast 弹出 */}
      {visible && lastAction && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-xl shadow-lg text-sm animate-in slide-in-from-bottom-4 duration-200">
          <span>{lastAction.label}</span>
          {undoable && (
            <button
              onClick={handleUndo}
              className="flex items-center gap-1 px-2 py-0.5 bg-background/20 hover:bg-background/30 rounded-md text-xs font-medium transition-colors"
            >
              <Undo2 className="w-3 h-3" /> 撤销
            </button>
          )}
        </div>
      )}

      {/* 持久化 undo/redo 按钮组 */}
      {!visible && (undoable || redoable) && (
        <div className="flex items-center gap-1 px-2 py-1.5 bg-card border border-border/40 rounded-xl shadow-md">
          <button
            onClick={handleUndo}
            disabled={!undoable}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={!redoable}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="重做 (Ctrl+Shift+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
