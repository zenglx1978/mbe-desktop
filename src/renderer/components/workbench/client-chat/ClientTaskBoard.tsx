import { useState } from 'react'
import { type ChannelTask, type ChannelMember } from '@/stores/client-chat-store'
import { Plus, ListChecks } from 'lucide-react'

const PRIORITY_STYLES: Record<string, { dot: string; label: string }> = {
  high:   { dot: 'bg-red-500',    label: '高' },
  medium: { dot: 'bg-amber-400',  label: '中' },
  low:    { dot: 'bg-zinc-400',   label: '低' },
}

const TASK_COLUMNS = [
  { key: 'todo',        label: '待办',   color: 'text-muted-foreground' },
  { key: 'in_progress', label: '进行中', color: 'text-blue-400' },
  { key: 'done',        label: '已完成', color: 'text-green-400' },
] as const

interface ClientTaskBoardProps {
  channelId: string
  tasks: ChannelTask[]
  members: ChannelMember[]
  onCreate: (title: string, opts?: Record<string, unknown>) => Promise<void>
  onUpdate: (taskId: string, updates: Record<string, unknown>) => Promise<boolean>
}

export default function ClientTaskBoard({
  channelId: _channelId, tasks, members, onCreate, onUpdate,
}: ClientTaskBoardProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [newAssignee, setNewAssignee] = useState('')

  const pros = members.filter(m => m.role !== 'client')

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {tasks.filter(t => t.status !== 'cancelled').length} 个任务
        </span>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" /> 新建任务
        </button>
      </div>

      {showAdd && (
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-end gap-2">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newTitle.trim()) {
                onCreate(newTitle.trim(), { priority: newPriority, assignee_id: newAssignee, assignee_name: pros.find(p => p.user_id === newAssignee)?.display_name || '' })
                setNewTitle('')
                setShowAdd(false)
              }
            }}
            placeholder="任务标题"
            className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <select value={newPriority} onChange={e => setNewPriority(e.target.value as 'high' | 'medium' | 'low')}
            className="px-2 py-2 text-xs bg-background border border-border rounded-lg">
            <option value="high">高优</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
          <select value={newAssignee} onChange={e => setNewAssignee(e.target.value)}
            className="px-2 py-2 text-xs bg-background border border-border rounded-lg min-w-[80px]">
            <option value="">未指派</option>
            {pros.map(p => <option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}
          </select>
          <button
            onClick={() => {
              if (newTitle.trim()) {
                onCreate(newTitle.trim(), { priority: newPriority, assignee_id: newAssignee, assignee_name: pros.find(p => p.user_id === newAssignee)?.display_name || '' })
                setNewTitle('')
                setShowAdd(false)
              }
            }}
            disabled={!newTitle.trim()}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
          >
            创建
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {tasks.filter(t => t.status !== 'cancelled').length === 0 ? (
          <div className="flex items-center justify-center h-full py-16 text-center">
            <div>
              <ListChecks className="w-10 h-10 mx-auto mb-2 opacity-15" />
              <p className="text-sm text-muted-foreground">暂无任务</p>
              <p className="text-xs text-muted-foreground mt-1">从文档行动项或手动创建任务</p>
            </div>
          </div>
        ) : (
          <div className="p-3 grid grid-cols-3 gap-3 h-full">
            {TASK_COLUMNS.map(col => {
              const colTasks = tasks.filter(t => t.status === col.key)
              return (
                <div key={col.key} className="flex flex-col">
                  <div className={`text-xs font-medium mb-2 flex items-center gap-1.5 ${col.color}`}>
                    {col.label}
                    <span className="text-[11px] bg-muted px-1.5 rounded-full text-muted-foreground">{colTasks.length}</span>
                  </div>
                  <div className="flex-1 space-y-1.5 overflow-y-auto">
                    {colTasks.map(t => {
                      const pri = PRIORITY_STYLES[t.priority] ?? PRIORITY_STYLES.medium
                      return (
                        <div key={t.task_id} className="p-2.5 rounded-lg border border-border bg-background hover:border-primary/20 transition-colors">
                          <div className="flex items-start gap-1.5">
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pri.dot}`} title={pri.label} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium leading-snug">{t.title}</div>
                              {t.assignee_name && (
                                <div className="text-[11px] text-muted-foreground mt-0.5">👤 {t.assignee_name}</div>
                              )}
                              {t.due_date && (
                                <div className="text-[11px] text-muted-foreground">📅 {t.due_date}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-1.5">
                            {col.key === 'todo' && (
                              <button onClick={() => onUpdate(t.task_id, { status: 'in_progress' })}
                                className="text-[11px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25">
                                开始
                              </button>
                            )}
                            {col.key === 'in_progress' && (
                              <button onClick={() => onUpdate(t.task_id, { status: 'done' })}
                                className="text-[11px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25">
                                完成
                              </button>
                            )}
                            {col.key !== 'done' && (
                              <button onClick={() => onUpdate(t.task_id, { status: 'cancelled' })}
                                className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-500 hover:bg-zinc-500/20">
                                取消
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
