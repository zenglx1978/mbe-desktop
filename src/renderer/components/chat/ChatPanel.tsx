import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useChatStore } from '@/stores/chat-store'
import { useToolStore } from '@/stores/tool-store'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'
import { sendMessage } from '@/lib/chat-service'
import { ChatMessageList } from './ChatMessageList'
import { ChatInputBar } from './ChatInputBar'
import SlashMenu from './SlashMenu'
import type { AttachedFile } from '@/components/io'
import type { SlashCommand } from '@/lib/solution-router'

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
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

  const slashCommands = useMemo(() => solution?.slashCommands ?? [], [solution])

  const handleAttach = useCallback((files: AttachedFile[]) => {
    setAttachedFiles(files)
  }, [])

  useEffect(() => {
    if (input.startsWith('/')) {
      setShowSlashMenu(true)
      setSlashQuery(input.slice(1))
    } else {
      setShowSlashMenu(false)
    }
  }, [input])

  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    setShowSlashMenu(false)
    if (cmd.toolId) {
      setInput('')
      handleSendDirect(cmd.description || cmd.label)
    } else {
      setInput(cmd.label + ' ')
    }
  }, [])

  // 从快捷操作跳转过来时自动发送 pendingPrompt
  const pendingPrompt = useToolStore((s) => s.pendingPrompt)
  useEffect(() => {
    if (!solution || !pendingPrompt) return
    const prompt = useToolStore.getState().consumePendingPrompt()
    if (!prompt) return
    const ac = new AbortController()
    sendAbortRef.current?.abort()
    sendAbortRef.current = ac
    if (solutionId) trackTabSwitch(solutionId, 'chat_send')
    sendMessage(prompt, solution, undefined, { signal: ac.signal })
      .catch(() => {
        const chatStore = useChatStore.getState()
        chatStore.setLoading(false)
      })
      .finally(() => textareaRef.current?.focus())
  }, [pendingPrompt, solution]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!solution) return null

  async function handleSendDirect(text: string) {
    if (!solution) return
    if (solutionId) trackTabSwitch(solutionId, 'chat_send')
    sendAbortRef.current?.abort()
    sendAbortRef.current = new AbortController()
    try {
      await sendMessage(text, solution, undefined, {
        signal: sendAbortRef.current.signal,
      })
    } catch {
      useChatStore.getState().setLoading(false)
    } finally {
      textareaRef.current?.focus()
    }
  }

  async function handleSend(text?: string) {
    if (!solution) return
    const toSend = (text ?? input.trim()) || ''
    const hasFiles = attachedFiles.length > 0
    if (!toSend && !hasFiles) return
    if (isLoading) return

    const fileNames = attachedFiles.map(f => f.name)
    const filesToSend = [...attachedFiles]

    setInput('')
    setAttachedFiles([])
    setShowSlashMenu(false)

    if (solutionId) trackTabSwitch(solutionId, 'chat_send')
    sendAbortRef.current?.abort()
    sendAbortRef.current = new AbortController()

    let messageText = toSend
    if (fileNames.length > 0) {
      const fileList = fileNames.map(n => `📎 ${n}`).join('\n')
      messageText = messageText
        ? `${messageText}\n\n${fileList}`
        : `请处理以下文件：\n${fileList}`
    }

    try {
      await sendMessage(messageText, solution, undefined, {
        signal: sendAbortRef.current.signal,
        files: filesToSend,
      })
    } catch {
      useChatStore.getState().setLoading(false)
    } finally {
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (showSlashMenu) return
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
      <div className="relative">
        {showSlashMenu && slashCommands.length > 0 && (
          <SlashMenu
            commands={slashCommands}
            query={slashQuery}
            onSelect={handleSlashSelect}
            onClose={() => setShowSlashMenu(false)}
          />
        )}
        <ChatInputBar
          input={input}
          setInput={setInput}
          textareaRef={textareaRef}
          onKeyDown={handleKeyDown}
          onSend={() => handleSend()}
          onAttach={handleAttach}
          attachedFiles={attachedFiles}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
