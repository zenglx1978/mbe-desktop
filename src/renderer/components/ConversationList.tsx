import { useEffect } from 'react'
import { useConversationStore, type Conversation } from '@/stores/conversation-store'
import { useChatStore } from '@/stores/chat-store'
import { useAppStore } from '@/stores/app-store'

export default function ConversationList() {
  const { currentSolutionId, currentSolution } = useAppStore()
  const solution = currentSolution()
  const {
    conversations, currentConversationId, loading,
    loadConversations, createConversation, selectConversation, deleteConversation, loadMessages,
  } = useConversationStore()
  const { clearMessages, addMessage } = useChatStore()

  useEffect(() => {
    if (currentSolutionId) {
      loadConversations(currentSolutionId)
    }
  }, [currentSolutionId])

  async function handleNewConversation() {
    if (!currentSolutionId || !solution) return
    clearMessages()
    await createConversation(currentSolutionId, solution.agents[0]?.role)
  }

  async function handleSelectConversation(conv: Conversation) {
    selectConversation(conv.id)
    clearMessages()
    const msgs = await loadMessages(conv.id)
    for (const msg of msgs) {
      addMessage({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        agentRole: msg.agent_role || undefined,
        sources: msg.sources ? JSON.parse(msg.sources) : undefined,
      })
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await deleteConversation(id)
    if (currentConversationId === id) {
      clearMessages()
    }
  }

  return (
    <div className="flex flex-col">
      <button
        onClick={handleNewConversation}
        className="mx-2 mb-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
      >
        <span>+</span> 新对话
      </button>

      {loading ? (
        <div className="px-4 py-2 text-xs text-muted-foreground">加载中...</div>
      ) : conversations.length === 0 ? (
        <div className="px-4 py-2 text-xs text-muted-foreground/50">暂无对话记录</div>
      ) : (
        <div className="space-y-0.5 px-2 overflow-y-auto max-h-48">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => handleSelectConversation(conv)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                currentConversationId === conv.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <span className="truncate flex-1">{conv.title}</span>
              <button
                onClick={(e) => handleDelete(e, conv.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                title="删除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
