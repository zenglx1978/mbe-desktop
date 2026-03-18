import { useChatStore } from '@/stores/chat-store'

export default function ConversationList() {
  const { messages, clearMessages } = useChatStore()

  return (
    <div className="flex flex-col">
      <button
        onClick={clearMessages}
        className="mx-2 mb-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
      >
        <span>+</span> 新对话
      </button>
      {messages.length === 0 ? (
        <div className="px-4 py-2 text-xs text-muted-foreground/50">暂无对话记录</div>
      ) : (
        <div className="px-4 py-2 text-xs text-muted-foreground">
          当前对话 · {messages.length} 条消息
        </div>
      )}
    </div>
  )
}
