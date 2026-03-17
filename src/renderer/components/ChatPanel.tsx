import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAppStore } from '@/stores/app-store'
import { useChatStore, type ChatMessage, type WorkflowSuggestion } from '@/stores/chat-store'
import { sendMessage } from '@/lib/chat-service'
import { startFromChat, getStatusDisplay } from '@/lib/workflow-os-service'
import type { SolutionConfig, ScenarioConfig } from '@/lib/solution-router'

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { currentSolution } = useAppStore()
  const { messages, isLoading } = useChatStore()
  const solution = currentSolution()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!solution) return null

  async function handleSend(text?: string) {
    const toSend = (text ?? input.trim()) || ''
    if (!toSend || isLoading) return
    setInput('')
    await sendMessage(toSend, solution!)
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
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isEmpty ? (
          <WelcomeScreen solution={solution} onScenarioClick={(prompt) => handleSend(prompt)} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      <div className="border-t border-border/50 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 bg-secondary/30 rounded-xl border border-border/50 px-4 py-3 focus-within:border-primary/50 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题，或点击上方决策链快速开始..."
              rows={1}
              className="flex-1 bg-transparent border-none outline-none resize-none text-sm leading-relaxed max-h-32 placeholder:text-muted-foreground/50"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <button
              onClick={() => handleSend()}
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
      </div>
    </div>
  )
}

function WelcomeScreen({ solution, onScenarioClick }: {
  solution: SolutionConfig
  onScenarioClick: (prompt: string) => void
}) {
  const pillars = solution.scenarios.filter((s) => s.id.startsWith('pillar_'))
  const others = solution.scenarios.filter((s) => !s.id.startsWith('pillar_'))

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto py-6">
      <div className="text-center">
        <div className="text-5xl mb-2">{solution.icon}</div>
        <h2 className="text-2xl font-bold tracking-tight">{solution.name}</h2>
        <p className="text-muted-foreground mt-1">{solution.tagline}</p>
        {solution.entrepreneurPurpose && (
          <p className="text-xs text-primary/80 mt-2">{solution.entrepreneurPurpose}</p>
        )}
      </div>

      {solution.profitMetrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {solution.profitMetrics.map((metric, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl border border-primary/15 bg-primary/5"
            >
              <span className="text-primary text-sm mt-0.5 shrink-0">
                {i === 0 ? '💰' : i === 1 ? '⚡' : '🛡️'}
              </span>
              <span className="text-xs leading-relaxed text-foreground/80">{metric}</span>
            </div>
          ))}
        </div>
      )}

      {pillars.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            决策链
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {pillars.map((sc, i) => (
              <span key={sc.id} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted-foreground/50">→</span>}
                <ScenarioCard scenario={sc} onClick={() => onScenarioClick(sc.prompt)} />
              </span>
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            快捷场景
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {others.map((sc) => (
              <ScenarioCard key={sc.id} scenario={sc} onClick={() => onScenarioClick(sc.prompt)} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          AI 专家团队
          {solution.valueEquivalent && (
            <span className="ml-2 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary normal-case">
              效率 {solution.valueEquivalent.acceleration}
            </span>
          )}
        </h3>
        <div className="flex flex-wrap gap-2">
          {solution.agents.map((a) => (
            <div
              key={a.id}
              className="px-3 py-2 rounded-lg border border-border/30 bg-secondary/20 text-sm"
            >
              <span className="font-medium">{a.role}</span>
              <span className="text-muted-foreground text-xs ml-2">· {a.handles}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ScenarioCard({ scenario, onClick }: {
  scenario: ScenarioConfig
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all text-left"
    >
      <span className="text-base">{scenario.icon}</span>
      <span className="text-sm font-medium truncate">{scenario.label}</span>
    </button>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        <div
          className={`px-4 py-3 rounded-xl text-sm leading-relaxed ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-secondary/50 text-foreground rounded-bl-sm'
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}
          {message.streaming && (
            <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
          )}
        </div>
        {!isUser && message.confidence != null && message.confidence < 0.6 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span>当前回答置信度较低（{(message.confidence * 100).toFixed(0)}%），仅供参考，建议咨询专业人士</span>
          </div>
        )}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.sources.map((src, i) => (
              <div key={i} className="text-xs text-muted-foreground/60">
                {src.title}
                {src.snippet ? ` · ${src.snippet}` : ''}
              </div>
            ))}
          </div>
        )}
        {message.workflowInstance && (
          <WorkflowInstanceCard instance={message.workflowInstance} />
        )}
        {message.workflowSuggestion && !message.workflowInstance && (
          <WorkflowSuggestionCard
            suggestion={message.workflowSuggestion}
            messageId={message.id}
          />
        )}
      </div>
    </div>
  )
}


function WorkflowInstanceCard({ instance }: { instance: ChatMessage['workflowInstance'] }) {
  if (!instance) return null
  const statusDisplay = getStatusDisplay(instance.status)
  const percent = instance.progress_percent

  return (
    <div className="mt-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <span>⚡</span>
          <span>{instance.workflow_name}</span>
        </div>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
          style={{ color: statusDisplay.color, backgroundColor: statusDisplay.color + '18' }}
        >
          {statusDisplay.text}
        </span>
      </div>

      {/* 进度条 */}
      <div className="mt-2 h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* 步骤列表 */}
      {instance.steps.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {instance.steps.map((step) => (
            <span
              key={step.id}
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                step.status === 'completed'
                  ? 'bg-emerald-200 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200'
                  : step.status === 'running'
                    ? 'bg-blue-200 dark:bg-blue-800/60 text-blue-800 dark:text-blue-200 animate-pulse'
                    : step.status === 'failed'
                      ? 'bg-red-200 dark:bg-red-800/60 text-red-800 dark:text-red-200'
                      : 'bg-gray-100 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400'
              }`}
            >
              {step.status === 'completed' ? '✓ ' : step.status === 'running' ? '◉ ' : step.status === 'failed' ? '✗ ' : '○ '}
              {step.name}
            </span>
          ))}
        </div>
      )}

      <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/40 mt-1.5">
        ID: {instance.instance_id}
      </p>
    </div>
  )
}


function WorkflowSuggestionCard({ suggestion, messageId }: {
  suggestion: WorkflowSuggestion
  messageId: string
}) {
  const [starting, setStarting] = useState(false)
  const { currentSolution } = useAppStore()
  const { updateMessage } = useChatStore()
  const solution = currentSolution()

  const handleStart = useCallback(async () => {
    if (starting || !solution) return
    setStarting(true)

    const agentName = solution.agents[0]?.id?.split('.')[0] || solution.id
    const result = await startFromChat(agentName, {
      workflow_type: suggestion.suggested_task_type,
      workflow_name: suggestion.workflow_name,
      user_id: 'current_user',
      steps: suggestion.steps,
      description: suggestion.workflow_description,
      input_params: { from_chat: true },
    })

    if (result) {
      updateMessage(messageId, {
        workflowInstance: {
          instance_id: result.instance_id,
          workflow_name: result.workflow_name || suggestion.workflow_name,
          status: result.status || 'running',
          progress_percent: result.progress_percent ?? 0,
          total_steps: result.total_steps ?? suggestion.steps.length,
          steps: (result.steps || suggestion.steps).map((s: Record<string, string>) => ({
            id: s.step_id || s.id,
            name: s.step_name || s.name,
            status: s.status || 'pending',
          })),
        },
      })
    }

    setStarting(false)
  }, [starting, solution, suggestion, messageId, updateMessage])

  return (
    <div className="mt-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
        <span>⚡</span>
        <span>AI 可以直接帮你做</span>
        {suggestion.confidence === 'high' && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300">
            高匹配
          </span>
        )}
      </div>
      <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
        {suggestion.message}
      </p>
      {suggestion.steps.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {suggestion.steps.map((step, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              {step.name}
            </span>
          ))}
        </div>
      )}
      <button
        className="mt-2 text-xs px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        onClick={handleStart}
        disabled={starting}
      >
        {starting ? '启动中...' : '启动工作流 →'}
      </button>
    </div>
  )
}
