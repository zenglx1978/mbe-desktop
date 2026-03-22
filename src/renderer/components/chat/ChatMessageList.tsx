import { useEffect, useRef, useCallback, memo, type RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { SolutionConfig } from '@/lib/solution-router'
import type { ChatMessage } from '@/stores/chat-store'
import { ChatWelcomeScreen } from './ChatWelcomeScreen'
import { ChatMessageBubble } from './ChatMessage'

export interface ChatMessageListProps {
  solution: SolutionConfig
  messages: ChatMessage[]
  isEmpty: boolean
  messagesEndRef: RefObject<HTMLDivElement | null>
  onScenarioClick: (prompt: string) => void
}

const MemoizedBubble = memo(ChatMessageBubble)

const VIRTUAL_THRESHOLD = 40

function VirtualizedMessages({ messages }: { messages: ChatMessage[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(messages.length)
  const isStreamingRef = useRef(false)

  const lastMsg = messages[messages.length - 1]
  isStreamingRef.current = !!lastMsg?.streaming

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 8,
    getItemKey: (index) => messages[index].id,
  })

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messages.length === 0) return
    virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior })
  }, [virtualizer, messages.length])

  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      requestAnimationFrame(() => scrollToBottom('smooth'))
    }
    prevCountRef.current = messages.length
  }, [messages.length, scrollToBottom])

  useEffect(() => {
    if (!isStreamingRef.current) return
    const timer = setInterval(() => {
      if (isStreamingRef.current) {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' })
      }
    }, 300)
    return () => clearInterval(timer)
  }, [lastMsg?.streaming, virtualizer, messages.length])

  useEffect(() => {
    requestAnimationFrame(() => scrollToBottom('auto'))
  }, [scrollToBottom])

  const items = virtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto px-6 py-4"
      role="log"
      aria-label="对话消息"
    >
      <div
        className="max-w-3xl mx-auto relative"
        style={{ height: virtualizer.getTotalSize() }}
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 right-0 pb-6"
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          >
            <MemoizedBubble message={messages[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PlainMessages({
  messages,
  messagesEndRef,
}: {
  messages: ChatMessage[]
  messagesEndRef: RefObject<HTMLDivElement | null>
}) {
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, messagesEndRef])

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4" role="log" aria-label="对话消息">
      <div className="max-w-3xl mx-auto space-y-6" aria-live="polite" aria-relevant="additions">
        {messages.map((msg) => (
          <MemoizedBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef as React.RefObject<HTMLDivElement>} />
      </div>
    </div>
  )
}

export function ChatMessageList({
  solution,
  messages,
  isEmpty,
  messagesEndRef,
  onScenarioClick,
}: ChatMessageListProps) {
  if (isEmpty) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-4" role="log" aria-label="对话消息">
        <ChatWelcomeScreen solution={solution} onScenarioClick={onScenarioClick} />
      </div>
    )
  }

  if (messages.length >= VIRTUAL_THRESHOLD) {
    return <VirtualizedMessages messages={messages} />
  }

  return <PlainMessages messages={messages} messagesEndRef={messagesEndRef} />
}
