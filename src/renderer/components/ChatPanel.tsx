import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAppStore } from '@/stores/app-store'
import { useChatStore, type ChatMessage } from '@/stores/chat-store'
import { useToolStore } from '@/stores/tool-store'
import { useLocalFeedbackStore } from '@/stores/local-feedback-store'
import { sendMessage } from '@/lib/chat-service'
import type { SolutionConfig, SlashCommand } from '@/lib/solution-router'
import SlashMenu from '@/components/chat/SlashMenu'
import InlineToolCard from '@/components/chat/InlineToolCard'

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const [showSlash, setShowSlash] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { currentSolution, currentAgentIndex } = useAppStore()
  const { messages, isLoading } = useChatStore()
  const { navigateToTool } = useToolStore()
  const solution = currentSolution()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 检测 Slash 命令输入
  useEffect(() => {
    if (input.startsWith('/') && solution) {
      setShowSlash(true)
      setSlashQuery(input)
    } else {
      setShowSlash(false)
    }
  }, [input, solution])

  if (!solution) return null

  function handleSlashSelect(cmd: SlashCommand) {
    setInput('')
    setShowSlash(false)
    if (cmd.toolId) {
      const tool = solution!.tools.find(t => t.id === cmd.toolId)
      if (tool) navigateToTool(tool)
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    setShowSlash(false)
    await sendMessage(text, solution!)
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (showSlash && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      return
    }
    if (showSlash && e.key === 'Enter') {
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isEmpty ? (
          <WelcomeScreen solution={solution} agentIndex={currentAgentIndex} onQuickAsk={(q) => {
            setInput(q)
            textareaRef.current?.focus()
          }} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} color={solution.color} solutionId={solution.id} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="border-t border-border/50 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            {/* Slash 命令菜单 */}
            {showSlash && solution.slashCommands.length > 0 && (
              <SlashMenu
                commands={solution.slashCommands}
                query={slashQuery}
                onSelect={handleSlashSelect}
                onClose={() => setShowSlash(false)}
              />
            )}
            <div className="flex items-end gap-3 bg-secondary/30 rounded-xl border border-border/50 px-4 py-3 focus-within:border-primary/50 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={solution.slashCommands.length > 0
                  ? '输入问题或 / 打开工具菜单...'
                  : '输入你的问题，AI 自动匹配专家回答...'}
                rows={1}
                className="flex-1 bg-transparent border-none outline-none resize-none text-sm leading-relaxed max-h-32 placeholder:text-muted-foreground/50"
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="shrink-0 w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              >
                {isLoading ? (
                  <span className="animate-spin text-xs">⏳</span>
                ) : (
                  <span className="text-sm">↑</span>
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/50 mt-2 text-center">
            {solution.slashCommands.length > 0
              ? `咨询免费 · 输入 / 打开工具 · 回答标注知识来源 · 数据存储在本地`
              : '咨询免费 · AI 自动匹配专家 · 回答标注知识来源 · 数据存储在本地'}
          </p>
        </div>
      </div>
    </div>
  )
}

function WelcomeScreen({ solution, agentIndex, onQuickAsk }: {
  solution: SolutionConfig
  agentIndex: number
  onQuickAsk: (q: string) => void
}) {
  const { navigateToTool } = useToolStore()
  const agent = solution.agents[agentIndex]
  const hasTools = solution.tools.length > 0

  const quickQuestions = [
    `${agent.role}能帮我做什么？`,
    `介绍一下${solution.name}的功能`,
  ]

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-lg space-y-6">
        <div className="text-5xl mb-2">{solution.icon}</div>
        <h2 className="text-2xl font-bold tracking-tight">{solution.name}</h2>
        <p className="text-muted-foreground">{solution.tagline}</p>

        <div className="text-left space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">
            你的 AI 专家团队
          </p>
          {solution.agents.map((a, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${
                i === agentIndex ? 'border-primary/30 bg-primary/5' : 'border-border/30'
              }`}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: solution.color }} />
              <span className="font-medium text-sm">{a.role}</span>
              <span className="text-xs text-muted-foreground">· {a.handles}</span>
            </div>
          ))}
        </div>

        {/* 快捷工具入口 */}
        {hasTools && (
          <div className="text-left space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">
              业务工具 · 精确计算 · 离线可用
            </p>
            <div className="grid grid-cols-2 gap-2">
              {solution.tools.slice(0, 4).map(tool => (
                <button
                  key={tool.id}
                  onClick={() => navigateToTool(tool)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all text-left"
                >
                  <span className="text-base">{tool.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{tool.name}</div>
                    {tool.localScript && (
                      <div className="text-[10px] text-emerald-500">离线可用</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 快捷场景入口 */}
        {solution.scenarios.length > 0 && (
          <div className="text-left space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">
              快捷场景 · 一键提问
            </p>
            <div className="grid grid-cols-2 gap-2">
              {solution.scenarios.slice(0, 4).map(sc => (
                <button
                  key={sc.id}
                  onClick={() => onQuickAsk(sc.prompt)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all text-left"
                >
                  <span className="text-base">{sc.icon}</span>
                  <span className="text-xs font-medium">{sc.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 工作流入口 */}
        {solution.workflows.length > 0 && (
          <div className="text-left space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">
              业务流程 · 多专家协作
            </p>
            <div className="space-y-2">
              {solution.workflows.slice(0, 3).map(wf => (
                <button
                  key={wf.id}
                  onClick={() => onQuickAsk(`[启动流程] ${wf.name}：`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all text-left"
                >
                  <span className="text-base">{wf.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium">{wf.name}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {wf.steps.map((s, i) => (
                        <span key={s.id} className="text-[10px] text-muted-foreground/50">
                          {i > 0 && '→ '}{s.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/40 text-muted-foreground shrink-0">
                    {wf.steps.length} 步
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 justify-center mt-4">
          {quickQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => onQuickAsk(q)}
              className="px-3 py-1.5 text-xs rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {(hasTools || solution.workflows.length > 0) && (
          <p className="text-xs text-muted-foreground/40">
            输入 <kbd className="px-1 py-0.5 rounded bg-secondary text-foreground/60 text-[10px]">/</kbd> 打开工具菜单
          </p>
        )}
      </div>
    </div>
  )
}

const LOW_CONFIDENCE_THRESHOLD = 0.6

function MessageBubble({ message, color, solutionId }: {
  message: ChatMessage
  color: string
  solutionId?: string
}) {
  const isUser = message.role === 'user'
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null)
  const feedback = useLocalFeedbackStore.getState()
  const isLowConfidence = !isUser && message.confidence != null && message.confidence < LOW_CONFIDENCE_THRESHOLD

  const handleFeedback = useCallback((type: 'up' | 'down') => {
    if (!solutionId || !message.agentRole) return
    setFeedbackGiven(type)
    if (type === 'up') {
      feedback.recordPositive(solutionId, message.agentRole, message.content.slice(0, 80))
    } else {
      feedback.recordTimeout(solutionId, message.agentRole, 0)
    }
  }, [solutionId, message.agentRole, message.content, feedback])

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold text-white"
          style={{ backgroundColor: color }}
        >
          AI
        </div>
      )}
      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        {!isUser && message.agentRole && (
          <p className="text-xs text-muted-foreground mb-1">{message.agentRole}</p>
        )}
        <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-secondary/50 text-foreground rounded-bl-sm'
        }`}>
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
          {message.streaming && (
            <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
          )}
        </div>

        {/* 低置信度警告 */}
        {isLowConfidence && !message.streaming && (
          <div className="mt-1 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-600 dark:text-amber-400">
            ⚠ 此回答置信度较低（{Math.round((message.confidence ?? 0) * 100)}%），建议结合专业意见参考使用
          </div>
        )}

        {/* 置信度指示器 */}
        {!isUser && message.confidence != null && !message.streaming && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground/50">
            <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  message.confidence >= 0.8 ? 'bg-green-500' :
                  message.confidence >= LOW_CONFIDENCE_THRESHOLD ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${message.confidence * 100}%` }}
              />
            </div>
            <span>{Math.round(message.confidence * 100)}%</span>
          </div>
        )}

        {message.toolCard && (
          <InlineToolCard card={message.toolCard} />
        )}

        {/* 知识来源溯源（source_citation） */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.sources.map((src, i) => (
              <div key={i} className="text-xs text-muted-foreground/60 flex items-start gap-1">
                <svg className="w-3 h-3 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                </svg>
                <span>{src.title}{src.confidence ? ` (${Math.round(src.confidence * 100)}%)` : ''}</span>
              </div>
            ))}
          </div>
        )}

        {/* 反馈按钮 */}
        {!isUser && !message.streaming && message.content.length > 20 && (
          <div className="mt-1.5 flex items-center gap-1">
            <button
              onClick={() => handleFeedback('up')}
              className={`p-1 rounded hover:bg-muted/50 transition-colors ${feedbackGiven === 'up' ? 'text-green-500' : 'text-muted-foreground/30'}`}
              title="有帮助"
            >
              <svg className="w-3.5 h-3.5" fill={feedbackGiven === 'up' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
              </svg>
            </button>
            <button
              onClick={() => handleFeedback('down')}
              className={`p-1 rounded hover:bg-muted/50 transition-colors ${feedbackGiven === 'down' ? 'text-red-500' : 'text-muted-foreground/30'}`}
              title="需要改进"
            >
              <svg className="w-3.5 h-3.5" fill={feedbackGiven === 'down' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
