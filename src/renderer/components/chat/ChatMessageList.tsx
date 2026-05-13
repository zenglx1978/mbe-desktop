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

/** 判断容器是否滚动到接近底部（60px 容差） */
function isNearBottom(el: HTMLElement | null, threshold = 60): boolean {
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

function VirtualizedMessages({ messages, messagesEndRef }: { messages: ChatMessage[]; messagesEndRef: RefObject<HTMLDivElement | null> }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(messages.length)
  const isStreamingRef = useRef(false)
  const userScrolledUpRef = useRef(false)

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
    userScrolledUpRef.current = false
    virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior })
  }, [virtualizer, messages.length])

  // 用户滚动时检测是否离开底部
  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    const onScroll = () => {
      userScrolledUpRef.current = !isNearBottom(el)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // 新消息到达时，仅在用户未手动上滚时自动滚到底部
  useEffect(() => {
    if (messages.length > prevCountRef.current && !userScrolledUpRef.current) {
      requestAnimationFrame(() => scrollToBottom('smooth'))
    }
    prevCountRef.current = messages.length
  }, [messages.length, scrollToBottom])

  // 流式输出时跟踪底部，但用户上滚后停止
  useEffect(() => {
    if (!isStreamingRef.current) return
    const timer = setInterval(() => {
      if (isStreamingRef.current && !userScrolledUpRef.current) {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' })
      }
    }, 300)
    return () => clearInterval(timer)
  }, [lastMsg?.streaming, virtualizer, messages.length])

  // 初始加载滚到底部
  useEffect(() => {
    requestAnimationFrame(() => scrollToBottom('auto'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        <div ref={messagesEndRef as React.RefObject<HTMLDivElement>} />
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
  const containerRef = useRef<HTMLDivElement>(null)
  const userScrolledUpRef = useRef(false)
  const prevCountRef = useRef(messages.length)

  const lastMsg = messages[messages.length - 1]
  const isStreaming = !!lastMsg?.streaming

  const scrollToEnd = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = containerRef.current
    if (!el) return
    if (behavior === 'auto') {
      el.scrollTop = el.scrollHeight
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior })
    }
  }, [])

  // 用户滚动时检测是否离开底部
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      userScrolledUpRef.current = !isNearBottom(el)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // 新消息到达时滚到底部（仅在用户未手动上滚时触发）
  useEffect(() => {
    if (messages.length > prevCountRef.current && !userScrolledUpRef.current) {
      requestAnimationFrame(() => scrollToEnd('smooth'))
    }
    prevCountRef.current = messages.length
  }, [messages.length, scrollToEnd])

  // 流式输出期间定时跟踪底部，用户上滚后停止
  useEffect(() => {
    if (!isStreaming) return
    const timer = setInterval(() => {
      if (!userScrolledUpRef.current) {
        scrollToEnd('smooth')
      }
    }, 300)
    return () => clearInterval(timer)
  }, [isStreaming, scrollToEnd])

  // 初始加载滚到底部
  useEffect(() => {
    requestAnimationFrame(() => scrollToEnd('auto'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-4" role="log" aria-label="对话消息">
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
    return <VirtualizedMessages messages={messages} messagesEndRef={messagesEndRef} />
  }

  return <PlainMessages messages={messages} messagesEndRef={messagesEndRef} />
}
