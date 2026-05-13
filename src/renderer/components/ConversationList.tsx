import { useEffect, useCallback, useState } from 'react'
import { useConversationStore, type ConversationRecord } from '@/stores/conversation-store'

interface Props {
  solutionId: string
  onClose?: () => void
}

export default function ConversationList({ solutionId, onClose }: Props) {
  const {
    conversations,
    currentConversationId,
    loadConversations,
    resumeConversation,
    deleteConversation,
    startNewConversation,
  } = useConversationStore()

  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadConversations(solutionId)
  }, [solutionId, loadConversations])

  const handleResume = useCallback(
    async (conv: ConversationRecord) => {
      await resumeConversation(conv.id)
      onClose?.()
    },
    [resumeConversation, onClose],
  )

  const handleDelete = useCallback(
    async (e: React.MouseEvent, convId: string) => {
      e.stopPropagation()
      setDeletingId(convId)
      await deleteConversation(convId)
      setDeletingId(null)
    },
    [deleteConversation],
  )

  const handleNew = useCallback(() => {
    startNewConversation()
    onClose?.()
  }, [startNewConversation, onClose])

  const formatTime = (iso?: string) => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      const now = new Date()
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      }
      return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    } catch {
      return ''
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <span className="text-xs font-medium text-foreground">对话记录</span>
        {onClose && (
          <button
            onClick={onClose}
            className="p-0.5 hover:bg-muted/50 rounded text-muted-foreground hover:text-foreground transition-colors"
            aria-label="关闭"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <button
        onClick={handleNew}
        className="mx-2 mt-2 mb-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted/30 transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        新对话
      </button>

      <div className="flex-1 overflow-y-auto px-1 py-1">
        {conversations.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground/50">
            暂无对话记录
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === currentConversationId
            const isDeleting = conv.id === deletingId
            return (
              <button
                key={conv.id}
                onClick={() => handleResume(conv)}
                disabled={isDeleting}
                className={`group w-full text-left px-3 py-2 mx-1 mb-0.5 rounded-lg text-xs transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-foreground border border-primary/20'
                    : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground border border-transparent'
                } ${isDeleting ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate flex-1 font-medium">
                    {conv.title || '新对话'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] text-muted-foreground/60">
                      {formatTime(conv.createdAt)}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, conv.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                      aria-label="删除对话"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                      </svg>
                    </button>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
