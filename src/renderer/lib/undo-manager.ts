/**
 * 撤销/重做管理器 — QuickBooks "Void/Undo" 对标
 *
 * 维护操作历史栈，支持 undo/redo，带 soft-delete 和 toast 通知。
 * 最多保留 50 条操作记录。
 */

export interface UndoAction {
  id: string
  label: string
  timestamp: number
  doFn: () => void
  undoFn: () => void
}

const MAX_HISTORY = 50

let undoStack: UndoAction[] = []
let redoStack: UndoAction[] = []
let listeners: Array<() => void> = []

function notify() {
  listeners.forEach((fn) => fn())
}

export function subscribe(fn: () => void): () => void {
  listeners.push(fn)
  return () => { listeners = listeners.filter((l) => l !== fn) }
}

export function getUndoStack(): readonly UndoAction[] {
  return undoStack
}

export function getRedoStack(): readonly UndoAction[] {
  return redoStack
}

export function canUndo(): boolean {
  return undoStack.length > 0
}

export function canRedo(): boolean {
  return redoStack.length > 0
}

export function execute(action: UndoAction) {
  action.doFn()
  undoStack = [action, ...undoStack].slice(0, MAX_HISTORY)
  redoStack = []
  notify()
}

export function undo(): UndoAction | null {
  if (undoStack.length === 0) return null
  const action = undoStack[0]
  undoStack = undoStack.slice(1)
  action.undoFn()
  redoStack = [action, ...redoStack]
  notify()
  return action
}

export function redo(): UndoAction | null {
  if (redoStack.length === 0) return null
  const action = redoStack[0]
  redoStack = redoStack.slice(1)
  action.doFn()
  undoStack = [action, ...undoStack]
  notify()
  return action
}

export function clearHistory() {
  undoStack = []
  redoStack = []
  notify()
}

// ─── Soft Delete 支持 ───

const TRASH_KEY = 'mbe-soft-delete-trash'
const TRASH_RETENTION_DAYS = 30

export interface TrashedItem {
  id: string
  type: 'brand' | 'settlement'
  data: any
  deletedAt: number
  deletedBy: string
}

export function loadTrash(): TrashedItem[] {
  try {
    const stored = localStorage.getItem(TRASH_KEY)
    if (!stored) return []
    const items: TrashedItem[] = JSON.parse(stored)
    const cutoff = Date.now() - TRASH_RETENTION_DAYS * 86400000
    return items.filter((item) => item.deletedAt > cutoff)
  } catch {
    return []
  }
}

export function moveToTrash(item: TrashedItem) {
  const trash = loadTrash()
  trash.unshift(item)
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash))
}

export function restoreFromTrash(id: string): TrashedItem | null {
  const trash = loadTrash()
  const idx = trash.findIndex((t) => t.id === id)
  if (idx === -1) return null
  const item = trash.splice(idx, 1)[0]
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash))
  return item
}

export function permanentlyDelete(id: string) {
  const trash = loadTrash().filter((t) => t.id !== id)
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash))
}

export function emptyTrash() {
  localStorage.removeItem(TRASH_KEY)
}
