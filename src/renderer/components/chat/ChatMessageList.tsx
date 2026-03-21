import { useEffect, type RefObject } from 'react'
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

export function ChatMessageList({
  solution,
  messages,
  isEmpty,
  messagesEndRef,
  onScenarioClick,
}: ChatMessageListProps) {
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, messagesEndRef])

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {isEmpty ? (
        <ChatWelcomeScreen solution={solution} onScenarioClick={onScenarioClick} />
      ) : (
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef as React.RefObject<HTMLDivElement>} />
        </div>
      )}
    </div>
  )
}
