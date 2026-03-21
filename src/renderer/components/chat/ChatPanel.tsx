import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useChatStore } from '@/stores/chat-store'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'
import { sendMessage } from '@/lib/chat-service'
import { ChatMessageList } from './ChatMessageList'
import { ChatInputBar } from './ChatInputBar'

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sendAbortRef = useRef<AbortController | null>(null)

  useEffect(() => () => {
    sendAbortRef.current?.abort()
  }, [])
  const { currentSolution, solutionId } = useAppStore()
  const { messages, isLoading } = useChatStore()
  const { trackTabSwitch } = useAdaptiveUIStore()
  const solution = currentSolution()

  if (!solution) return null

  async function handleSend(text?: string) {
    if (!solution) return
    const toSend = (text ?? input.trim()) || ''
    if (!toSend || isLoading) return
    setInput('')
    if (solutionId) trackTabSwitch(solutionId, 'chat_send')
    sendAbortRef.current?.abort()
    sendAbortRef.current = new AbortController()
    await sendMessage(toSend, solution, undefined, { signal: sendAbortRef.current.signal })
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ChatMessageList
        solution={solution}
        messages={messages}
        isEmpty={isEmpty}
        messagesEndRef={messagesEndRef}
        onScenarioClick={(prompt) => handleSend(prompt)}
      />
      <ChatInputBar
        input={input}
        setInput={setInput}
        textareaRef={textareaRef}
        onKeyDown={handleKeyDown}
        onSend={() => handleSend()}
        isLoading={isLoading}
      />
    </div>
  )
}
