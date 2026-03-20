import { useRef, useEffect, useCallback } from 'react'
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling'
import { useClientChatStore, type ClientMsg } from '@/stores/client-chat-store'
import { Search, X, Lock } from 'lucide-react'
import { formatTime } from './shared'

export default function ClientMessageList() {
  const {
    messages, activeChannel,
    showSearch, searchQuery, setSearchQuery, searchResults,
    searchMessages, closeSearchPanel, clearSearch,
  } = useClientChatStore()

  const msgEndRef = useRef<HTMLDivElement>(null)

  useVisibilityPolling(
    useCallback(() => {
      useClientChatStore.getState().fetchMessages()
    }, []),
    3000,
    !!activeChannel,
  )

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <>
      {showSearch && (
        <div className="border-b border-border bg-muted/30 p-2">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/60"
              placeholder="搜索消息..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  searchMessages(searchQuery.trim(), activeChannel || undefined)
                } else if (e.key === 'Escape') {
                  closeSearchPanel(); clearSearch()
                }
              }}
              autoFocus
            />
            {searchResults.length > 0 && (
              <span className="text-[10px] text-muted-foreground shrink-0">{searchResults.length} 条结果</span>
            )}
            <button onClick={() => { closeSearchPanel(); clearSearch() }} className="p-1 hover:bg-muted rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {searchResults.map(r => (
                <div key={r.message_id} className="p-2 rounded bg-background/80 hover:bg-background cursor-pointer text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary">{r.sender_name}</span>
                    <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    {r.channel_name && <span className="text-muted-foreground/60">#{r.channel_name}</span>}
                  </div>
                  <p className="mt-0.5 text-foreground/80" dangerouslySetInnerHTML={{
                    __html: r.content.replace(
                      new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                      '<mark class="bg-yellow-300/50 text-foreground rounded px-0.5">$1</mark>'
                    )
                  }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(m => (
          <MsgBubble key={m.message_id} msg={m} />
        ))}
        <div ref={msgEndRef} />
      </div>
    </>
  )
}

function MsgBubble({ msg }: { msg: ClientMsg }) {
  const isClient = msg.sender_type === 'client'
  const isSystem = msg.sender_type === 'system'
  const isFile = msg.message_type === 'file' && msg.file_id

  if (isSystem) {
    return (
      <div className="text-center text-xs text-muted-foreground py-1">
        {msg.content}
      </div>
    )
  }

  const BASE = import.meta.env.DEV ? '' : 'https://mbe.hi-maker.com'

  return (
    <div className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[75%] rounded-xl px-3.5 py-2 text-sm ${
          isClient
            ? 'bg-muted text-foreground rounded-bl-sm'
            : 'bg-primary/15 text-foreground rounded-br-sm'
        }`}
      >
        <div className="text-[11px] text-muted-foreground mb-0.5 flex items-center gap-1">
          <span>{msg.sender_name}</span>
          {msg.sender_title && (
            <span className="text-[10px] opacity-60">({msg.sender_title})</span>
          )}
        </div>
        {isFile ? (
          <a
            href={`${BASE}/api/v1/client-portal/files/${msg.file_id}`}
            target="_blank"
            rel="noopener"
            className="text-primary underline"
          >
            {msg.file_name || '文件'}
          </a>
        ) : (
          <div className="whitespace-pre-wrap">{msg.content}</div>
        )}
        <div className="text-[10px] text-muted-foreground/60 mt-1 text-right flex items-center justify-end gap-1">
          {msg.visible_to && msg.visible_to !== 'all' && (
            <Lock className="w-2.5 h-2.5 text-amber-400 inline" />
          )}
          {formatTime(msg.created_at)}
        </div>
      </div>
    </div>
  )
}
