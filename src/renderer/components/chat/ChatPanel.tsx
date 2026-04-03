import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useChatStore } from '@/stores/chat-store'
import { useToolStore } from '@/stores/tool-store'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'
import { useConversationStore } from '@/stores/conversation-store'
import { sendMessage } from '@/lib/chat-service'
import { authFetch, API_BASE } from '@/lib/api-client'
import { getDefaultAgent } from '@/lib/solution-router'
import { ChatMessageList } from './ChatMessageList'
import { ChatInputBar } from './ChatInputBar'
import SlashMenu from './SlashMenu'
import ConversationList from '@/components/ConversationList'
import type { AttachedFile } from '@/components/io'
import type { SlashCommand } from '@/lib/solution-router'

const GLOBAL_COMMANDS: SlashCommand[] = [
  {
    cmd: '/doctor',
    label: '运行诊断',
    icon: '🩺',
    description: '检查 Agent 连接、知识库、MCP 等健康状态',
  },
]

function formatDoctorReport(data: Record<string, unknown>): string {
  const statusIcon = (s: string) =>
    s === 'ok' ? '✅' : s === 'warn' ? '⚠️' : '❌'
  const checks = (data.checks ?? []) as Array<{
    name: string; status: string; message: string; duration_ms: number
  }>
  const lines: string[] = [
    `## 🩺 诊断报告 — ${data.agent}`,
    '',
    `**整体状态：** ${statusIcon(data.overall as string)} ${(data.overall as string ?? '').toUpperCase()}　|　**耗时：** ${Number(data.duration_ms ?? 0).toFixed(0)}ms`,
    '',
    '| 检查项 | 状态 | 耗时 | 信息 |',
    '|--------|------|------|------|',
  ]
  for (const c of checks) {
    lines.push(
      `| ${c.name} | ${statusIcon(c.status)} ${c.status} | ${c.duration_ms.toFixed(0)}ms | ${c.message} |`,
    )
  }
  lines.push('', `> ${data.summary}`)
  return lines.join('\n')
}

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sendAbortRef = useRef<AbortController | null>(null)

  useEffect(() => () => {
    sendAbortRef.current?.abort()
  }, [])
  const { currentSolution, solutionId } = useAppStore()
  const { messages, isLoading } = useChatStore()
  const { trackTabSwitch } = useAdaptiveUIStore()
  const { currentConversationId } = useConversationStore()
  const solution = currentSolution()

  const allCommands = useMemo(
    () => [...GLOBAL_COMMANDS, ...(solution?.slashCommands ?? [])],
    [solution],
  )

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

  const runDoctor = useCallback(async () => {
    const sol = useAppStore.getState().currentSolution()
    const store = useChatStore.getState()
    if (!sol) return

    store.addMessage({ role: 'user', content: '/doctor' })
    const assistantId = store.addMessage({
      role: 'assistant',
      content: '🩺 正在运行诊断…',
      streaming: true,
    })

    try {
      const agent = getDefaultAgent(sol)
      const url = `${API_BASE}/api/${agent.id}/doctor`
      const res = await authFetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      store.updateMessage(assistantId, {
        content: formatDoctorReport(data),
        streaming: false,
      })
    } catch (err) {
      store.updateMessage(assistantId, {
        content: `❌ 诊断失败：${err instanceof Error ? err.message : String(err)}`,
        streaming: false,
      })
    }
  }, [])

  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    setShowSlashMenu(false)
    if (cmd.cmd === '/doctor') {
      setInput('')
      runDoctor()
      return
    }
    if (cmd.toolId) {
      setInput('')
      handleSendDirect(cmd.description || cmd.label)
    } else {
      setInput(cmd.label + ' ')
    }
  }, [runDoctor]) // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* 顶部工具栏：对话历史切换 + 新对话 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shrink-0">
        <button
          onClick={() => setShowHistory(v => !v)}
          className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-colors ${
            showHistory
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}
          title="对话记录"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          对话记录
        </button>
        {currentConversationId && (
          <button
            onClick={() => {
              useConversationStore.getState().startNewConversation()
              setShowHistory(false)
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded-md transition-colors"
            title="新对话"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            新对话
          </button>
        )}
      </div>

      {/* 主体区域：可选的对话历史侧面板 + 聊天区域 */}
      <div className="flex-1 flex min-h-0">
        {showHistory && solution && (
          <div className="w-64 border-r border-gray-200 dark:border-gray-700 shrink-0 overflow-hidden">
            <ConversationList
              solutionId={solution.id}
              onClose={() => setShowHistory(false)}
            />
          </div>
        )}
        <div className="flex-1 flex flex-col min-h-0">
          <ChatMessageList
            solution={solution}
            messages={messages}
            isEmpty={isEmpty}
            messagesEndRef={messagesEndRef}
            onScenarioClick={(prompt) => handleSend(prompt)}
          />
          <div className="relative">
            {showSlashMenu && allCommands.length > 0 && (
              <SlashMenu
                commands={allCommands}
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
      </div>
    </div>
  )
}
