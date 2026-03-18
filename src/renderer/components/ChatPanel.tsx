import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAppStore } from '@/stores/app-store'
import { useChatStore, type ChatMessage, type WorkflowSuggestion, type LocalActionInfo } from '@/stores/chat-store'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'
import { sendMessage } from '@/lib/chat-service'
import { startFromChat, getStatusDisplay } from '@/lib/workflow-os-service'
import {
  executeActions,
  getManualActions,
  isElectronAvailable,
  getActionIcon,
  type LocalAction,
} from '@/lib/local-action-executor'
import { CopilotReplyActionCard } from '@/components/CopilotReplyCard'
import type { SolutionConfig, ScenarioConfig } from '@/lib/solution-router'
import { getSolutionIcon } from '@/lib/solution-icons'
import { Coins, Zap, ShieldCheck } from 'lucide-react'

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { currentSolution, solutionId } = useAppStore()
  const { messages, isLoading } = useChatStore()
  const { trackTabSwitch } = useAdaptiveUIStore()
  const solution = currentSolution()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!solution) return null

  async function handleSend(text?: string) {
    const toSend = (text ?? input.trim()) || ''
    if (!toSend || isLoading) return
    setInput('')
    if (solutionId) trackTabSwitch(solutionId, 'chat_send')
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
        {(() => {
          const Icon = getSolutionIcon(solution.id)
          return (
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-3">
              <Icon className="w-7 h-7" />
            </div>
          )
        })()}
        <h2 className="text-2xl font-bold tracking-tight">{solution.name}</h2>
        <p className="text-muted-foreground mt-1">{solution.tagline}</p>
        {solution.entrepreneurPurpose && (
          <p className="text-xs text-primary/80 mt-2">{solution.entrepreneurPurpose}</p>
        )}
      </div>

      {solution.profitMetrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {solution.profitMetrics.map((metric, i) => {
            const MetricIcon = [Coins, Zap, ShieldCheck][i] ?? Zap
            return (
              <div
                key={i}
                className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl border border-primary/15 bg-primary/5"
              >
                <MetricIcon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span className="text-xs leading-relaxed text-foreground/80">{metric}</span>
              </div>
            )
          })}
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
            <span className="inline-flex items-center gap-1 ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary normal-case">
              <Zap className="w-3 h-3" />
              {solution.valueEquivalent.humanHours}h→{solution.valueEquivalent.mbeMinutes}min
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
        {message.localActions && message.localActions.length > 0 && !message.streaming && (
          <LocalActionCards
            actions={message.localActions}
            messageId={message.id}
            actionStatus={message.localActionStatus}
          />
        )}
      </div>
    </div>
  )
}


function LocalActionCards({ actions, messageId, actionStatus }: {
  actions: LocalActionInfo[]
  messageId: string
  actionStatus?: Record<number, string>
}) {
  const [executing, setExecuting] = useState<number | null>(null)
  const [runningAll, setRunningAll] = useState(false)
  const { updateMessage } = useChatStore()
  const msg = useChatStore.getState().messages.find(m => m.id === messageId)
  const actionResults = msg?.localActionResults ?? {}

  const isChain = actions.some(a => a.depends_on != null)
  const manualActions = isElectronAvailable()
    ? getManualActions(actions as LocalAction[])
    : actions as LocalAction[]
  const autoCompleted = actions.filter((_a, i) => actionStatus?.[i] === 'auto_done')
  const allDone = actions.every((_a, i) =>
    actionStatus?.[i] === 'auto_done' || actionStatus?.[i] === 'user_done')

  if (manualActions.length === 0 && autoCompleted.length === 0) return null

  const completedCount = Object.values(actionStatus ?? {}).filter(
    s => s === 'auto_done' || s === 'user_done',
  ).length
  const progressPercent = actions.length > 0 ? Math.round((completedCount / actions.length) * 100) : 0

  const handleExecute = useCallback(async (action: LocalAction, index: number) => {
    if (executing !== null || runningAll) return
    setExecuting(index)
    const results = await executeActions([action])
    const result = results[0]
    const currentMsg = useChatStore.getState().messages.find(m => m.id === messageId)
    updateMessage(messageId, {
      localActionStatus: {
        ...currentMsg?.localActionStatus,
        [index]: result?.status === 'completed' ? 'user_done' : 'failed',
      },
      localActionResults: {
        ...currentMsg?.localActionResults,
        [index]: result?.output,
      },
    })
    setExecuting(null)
  }, [executing, runningAll, messageId, updateMessage])

  const handleExecuteAll = useCallback(async () => {
    if (runningAll || !isElectronAvailable()) return
    setRunningAll(true)

    const results = await executeActions(manualActions as LocalAction[], (result) => {
      const globalIdx = actions.indexOf(manualActions[result.index] as LocalActionInfo)
      const currentStatus = useChatStore.getState().messages.find(m => m.id === messageId)?.localActionStatus
      updateMessage(messageId, {
        localActionStatus: {
          ...currentStatus,
          [globalIdx]: result.status === 'completed' ? 'user_done'
            : result.status === 'failed' ? 'failed' : 'pending',
        },
      })
    })

    const ok = results.filter(r => r.status === 'completed').length
    const fail = results.filter(r => r.status === 'failed').length
    if (ok > 0 || fail > 0) {
      const summary = `${ok} 项完成${fail > 0 ? `，${fail} 项失败` : ''}`
      const currentMsg = useChatStore.getState().messages.find(m => m.id === messageId)
      if (currentMsg && !currentMsg.content.includes('操作完成')) {
        useChatStore.getState().appendToMessage(messageId, `\n\n---\n⚡ 操作完成：${summary}`)
      }
    }
    setRunningAll(false)
  }, [runningAll, manualActions, actions, messageId, updateMessage])

  return (
    <div className="mt-3 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
          <span>⚡</span>
          <span>{isChain ? '操作链' : '可执行操作'}</span>
          {isChain && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-200 dark:bg-violet-800 text-violet-600 dark:text-violet-300">
              {actions.length} 步
            </span>
          )}
        </div>
        {manualActions.length > 1 && !allDone && isElectronAvailable() && (
          <button
            onClick={handleExecuteAll}
            disabled={runningAll}
            className="text-[10px] px-2 py-1 rounded bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {runningAll ? '执行中...' : '全部执行'}
          </button>
        )}
      </div>

      {isChain && actions.length > 1 && (
        <div className="mb-2">
          <div className="h-1.5 rounded-full bg-violet-100 dark:bg-violet-900/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-violet-500/70 mt-1">
            {completedCount}/{actions.length} 步完成
          </p>
        </div>
      )}

      {/* 操作链模式：顺序展示每一步 */}
      {isChain ? (
        <div className="space-y-1.5">
          {actions.map((action, idx) => {
            const status = actionStatus?.[idx]
            const isDone = status === 'user_done' || status === 'auto_done'
            const isFailed = status === 'failed'
            const isRunning = executing === idx || (runningAll && !isDone && !isFailed)
            const icon = getActionIcon(action.type as LocalAction['type'])

            return (
              <div
                key={idx}
                className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${
                  isDone ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                    : isFailed ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                    : isRunning ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                    : 'text-violet-600/70 dark:text-violet-400/70'
                }`}
              >
                <span className="w-4 text-center shrink-0">
                  {isDone ? '✓' : isFailed ? '✗' : isRunning ? '◉' : `${idx + 1}`}
                </span>
                <span className={isRunning ? 'animate-pulse' : ''}>{icon} {action.label}</span>
                {action.depends_on != null && (
                  <span className="text-[9px] text-violet-400/50 ml-auto">← 步骤 {(action.depends_on ?? 0) + 1}</span>
                )}
                {!isDone && !isRunning && !runningAll && isElectronAvailable() && (
                  <button
                    onClick={() => handleExecute(action as LocalAction, idx)}
                    className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-violet-200 dark:bg-violet-800 hover:bg-violet-300 dark:hover:bg-violet-700 transition-colors"
                  >
                    执行
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <>
          {autoCompleted.length > 0 && (
            <div className="space-y-1 mb-2">
              {autoCompleted.map((a, i) => (
                <div key={`auto-${i}`} className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <span>✓</span>
                  <span>{getActionIcon(a.type as LocalAction['type'])} {a.label}</span>
                </div>
              ))}
            </div>
          )}
          {manualActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {manualActions.map((action, idx) => {
                const globalIdx = actions.indexOf(action as LocalActionInfo)
                const status = actionStatus?.[globalIdx]
                const isDone = status === 'user_done' || status === 'auto_done'
                const isFailed = status === 'failed'
                const isRunning = executing === globalIdx

                return (
                  <button
                    key={idx}
                    onClick={() => handleExecute(action, globalIdx)}
                    disabled={isDone || isRunning || !isElectronAvailable()}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${
                      isDone
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 cursor-default'
                        : isFailed
                          ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                          : 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800/60'
                    } disabled:opacity-50`}
                  >
                    <span>{isDone ? '✓' : isFailed ? '✗' : getActionIcon(action.type as LocalAction['type'])}</span>
                    <span>{isRunning ? '执行中...' : action.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {allDone && actions.length > 0 && (
        <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <span>✓</span> 全部操作已完成
        </div>
      )}

      {/* Copilot 回复卡片 */}
      {actions.map((action, idx) => {
        if (action.type === 'show_copilot_card') {
          return (
            <div key={`copilot-${idx}`} className="mt-2">
              <CopilotReplyActionCard
                text={(action.params as Record<string, unknown>)?.text as string ?? ''}
                customerName={(action.params as Record<string, unknown>)?.customer_name as string}
                customerQuery={(action.params as Record<string, unknown>)?.customer_query as string}
                confidence={(action.params as Record<string, unknown>)?.confidence as number}
                sourceApp={(action.params as Record<string, unknown>)?.source_app as string}
              />
            </div>
          )
        }
        return null
      })}

      {/* FileIntel 结果展示 */}
      {actions.map((action, idx) => {
        const result = actionResults[idx]
        if (!result) return null

        if (action.type === 'dir_scan' && typeof result === 'object' && result !== null) {
          return <DirScanResultView key={`scan-${idx}`} result={result as DirScanOutput} />
        }
        if (action.type === 'batch_analyze' && typeof result === 'object' && result !== null) {
          return <BatchAnalyzeResultView key={`batch-${idx}`} result={result as BatchAnalyzeOutput} />
        }
        if (action.type === 'pipeline' && typeof result === 'object' && result !== null) {
          return <PipelineResultView key={`pipe-${idx}`} result={result as PipelineOutput} />
        }
        if ((action.type === 'schedule' || action.type === 'watch') && typeof result === 'object' && result !== null) {
          return <SchedulerResultView key={`sched-${idx}`} result={result as SchedulerJobOutput} actionType={action.type} />
        }
        if (action.type === 'memory_save' && typeof result === 'object' && result !== null) {
          return <MemorySaveResultView key={`mem-${idx}`} action={action} result={result as Record<string, unknown>} />
        }
        if (action.type === 'memory_recall' && typeof result === 'object' && result !== null) {
          return <MemoryRecallResultView key={`recall-${idx}`} result={result as MemoryRecallOutput} />
        }
        if (action.type === 'offline_hint' && typeof result === 'object' && result !== null) {
          return <OfflineInferenceResultView key={`offline-${idx}`} result={result as OfflineInferenceOutput} />
        }
        return null
      })}

      {!isElectronAvailable() && (
        <p className="text-[10px] text-violet-500/60 mt-1">需在桌面端运行才能执行本地操作</p>
      )}
    </div>
  )
}


// ── FileIntel 结果类型 ──

interface DirScanFile {
  name: string
  path: string
  type: string
  sizeHuman: string
  lastModified: string
}

interface DirScanOutput {
  success?: boolean
  files?: DirScanFile[]
  totalFiles?: number
  totalSizeHuman?: string
  typeSummary?: Record<string, number>
  scanTimeMs?: number
}

function DirScanResultView({ result }: { result: DirScanOutput }) {
  const [expanded, setExpanded] = useState(false)
  if (!result.success || !result.files?.length) return null

  const typeIcons: Record<string, string> = {
    excel: '📊', csv: '📋', word: '📝', pdf: '📕', text: '📄',
    image: '🖼️', ppt: '📎', other: '📁',
  }
  const visibleFiles = expanded ? result.files : result.files.slice(0, 8)

  return (
    <div className="mt-2 rounded border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20 p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
          🔍 扫描结果：{result.totalFiles} 个文件（{result.totalSizeHuman}）
        </span>
        {result.scanTimeMs && (
          <span className="text-[9px] text-blue-400">{result.scanTimeMs}ms</span>
        )}
      </div>
      {result.typeSummary && Object.keys(result.typeSummary).length > 1 && (
        <div className="flex gap-2 mb-1.5 flex-wrap">
          {Object.entries(result.typeSummary).map(([type, count]) => (
            <span key={type} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
              {typeIcons[type] ?? '📁'} {type} {count}
            </span>
          ))}
        </div>
      )}
      <div className="space-y-0.5">
        {visibleFiles.map((file, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px] text-blue-600/80 dark:text-blue-400/80 py-0.5">
            <span>{typeIcons[file.type] ?? '📁'}</span>
            <span className="truncate flex-1" title={file.path}>{file.name}</span>
            <span className="shrink-0 text-blue-400/60">{file.sizeHuman}</span>
          </div>
        ))}
      </div>
      {result.files.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-[10px] text-blue-500 hover:text-blue-700 transition-colors"
        >
          {expanded ? '收起' : `显示全部 ${result.files.length} 个文件`}
        </button>
      )}
    </div>
  )
}


interface BatchFileItem {
  fileName: string
  fileType: string
  status: string
  classification?: string
  summary?: string
  error?: string
}

interface BatchAnalyzeOutput {
  success?: boolean
  totalFiles?: number
  processedFiles?: number
  results?: BatchFileItem[]
  totalTimeMs?: number
}

function BatchAnalyzeResultView({ result }: { result: BatchAnalyzeOutput }) {
  const [expanded, setExpanded] = useState(false)
  if (!result.success || !result.results?.length) return null

  const grouped: Record<string, BatchFileItem[]> = {}
  for (const item of result.results) {
    const cat = item.classification ?? item.fileType ?? '其他'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }

  const doneCount = result.results.filter(r => r.status === 'done').length
  const errorCount = result.results.filter(r => r.status === 'error').length
  const visible = expanded ? result.results : result.results.slice(0, 10)

  return (
    <div className="mt-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20 p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
          📊 批量分析：{doneCount}/{result.totalFiles} 完成
          {errorCount > 0 && <span className="text-red-500 ml-1">（{errorCount} 失败）</span>}
        </span>
        {result.totalTimeMs && (
          <span className="text-[9px] text-amber-400">{(result.totalTimeMs / 1000).toFixed(1)}s</span>
        )}
      </div>

      {Object.keys(grouped).length > 1 && (
        <div className="flex gap-2 mb-1.5 flex-wrap">
          {Object.entries(grouped).map(([cat, items]) => (
            <span key={cat} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300">
              {cat} ({items.length})
            </span>
          ))}
        </div>
      )}

      <div className="space-y-1">
        {visible.map((item, i) => (
          <div key={i} className={`text-[10px] px-1.5 py-1 rounded ${
            item.status === 'done'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300'
          }`}>
            <div className="flex items-center gap-1.5">
              <span>{item.status === 'done' ? '✓' : '✗'}</span>
              <span className="font-medium truncate">{item.fileName}</span>
              {item.classification && (
                <span className="shrink-0 px-1 py-0.5 rounded bg-amber-200/50 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300">
                  {item.classification}
                </span>
              )}
            </div>
            {item.summary && (
              <p className="mt-0.5 text-[9px] opacity-70 line-clamp-2 pl-4">{item.summary}</p>
            )}
            {item.error && (
              <p className="mt-0.5 text-[9px] text-red-500 pl-4">{item.error}</p>
            )}
          </div>
        ))}
      </div>

      {result.results.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-[10px] text-amber-500 hover:text-amber-700 transition-colors"
        >
          {expanded ? '收起' : `显示全部 ${result.results.length} 个文件`}
        </button>
      )}
    </div>
  )
}


// ── Phase 4: 跨应用数据管道结果 ──

interface PipelineStepOutput {
  stepIndex: number
  type: string
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
  output?: unknown
  error?: string
  durationMs?: number
  itemProgress?: { current: number; total: number }
}

interface PipelineOutput {
  success?: boolean
  name?: string
  totalSteps?: number
  completedSteps?: number
  stepResults?: PipelineStepOutput[]
  outputFiles?: string[]
  totalDurationMs?: number
  error?: string
}

function PipelineResultView({ result }: { result: PipelineOutput }) {
  const [expanded, setExpanded] = useState(false)

  if (!result.stepResults?.length && !result.error) return null

  const stepTypeIcons: Record<string, string> = {
    read: '📖', read_dir: '📂', ai_process: '🤖', ai_each: '🧠',
    transform: '🔄', generate: '📄', open: '🚀',
  }

  const completedSteps = result.completedSteps ?? 0
  const totalSteps = result.totalSteps ?? 0
  const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  const borderColor = result.success ? 'border-indigo-200 dark:border-indigo-800'
    : result.error ? 'border-red-200 dark:border-red-800' : 'border-purple-200 dark:border-purple-800'
  const bgColor = result.success ? 'bg-indigo-50/30 dark:bg-indigo-950/20'
    : result.error ? 'bg-red-50/30 dark:bg-red-950/20' : 'bg-purple-50/30 dark:bg-purple-950/20'

  return (
    <div className={`mt-2 rounded border ${borderColor} ${bgColor} p-2`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
          🔗 {result.name ?? '数据管道'} — {completedSteps}/{totalSteps} 步
          {result.success && ' ✓'}
        </span>
        {result.totalDurationMs && (
          <span className="text-[9px] text-indigo-400">{(result.totalDurationMs / 1000).toFixed(1)}s</span>
        )}
      </div>

      {/* 进度条 */}
      <div className="h-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            result.error ? 'bg-red-500' : result.success ? 'bg-indigo-500' : 'bg-purple-500 animate-pulse'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* 步骤列表 */}
      {result.stepResults && (
        <div className="space-y-0.5">
          {(expanded ? result.stepResults : result.stepResults.slice(0, 5)).map((step) => (
            <div
              key={step.stepIndex}
              className={`flex items-center gap-1.5 text-[10px] px-1.5 py-1 rounded ${
                step.status === 'done'
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                  : step.status === 'running'
                    ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 animate-pulse'
                    : step.status === 'error'
                      ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300'
                      : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <span>{stepTypeIcons[step.type] ?? '⚡'}</span>
              <span className={`${step.status === 'done' ? '' : 'font-medium'}`}>
                {step.status === 'done' ? '✓' : step.status === 'running' ? '◉' : step.status === 'error' ? '✗' : '○'}
              </span>
              <span className="truncate flex-1">{step.label}</span>
              {step.itemProgress && step.status === 'running' && (
                <span className="shrink-0 text-blue-400">
                  {step.itemProgress.current}/{step.itemProgress.total}
                </span>
              )}
              {step.durationMs != null && step.status === 'done' && (
                <span className="shrink-0 opacity-50">{(step.durationMs / 1000).toFixed(1)}s</span>
              )}
            </div>
          ))}
        </div>
      )}

      {result.stepResults && result.stepResults.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-[10px] text-indigo-500 hover:text-indigo-700 transition-colors"
        >
          {expanded ? '收起' : `显示全部 ${result.stepResults.length} 个步骤`}
        </button>
      )}

      {/* 输出文件 */}
      {result.outputFiles && result.outputFiles.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-indigo-200/50 dark:border-indigo-800/50">
          <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">输出文件：</span>
          {result.outputFiles.map((f, i) => {
            const fileName = f.split(/[/\\]/).pop() ?? f
            return (
              <span key={i} className="text-[10px] text-indigo-500 dark:text-indigo-400 ml-1.5">
                📄 {fileName}
              </span>
            )
          })}
        </div>
      )}

      {/* 错误信息 */}
      {result.error && (
        <div className="mt-1.5 text-[10px] text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/30 rounded px-2 py-1">
          ⚠ {result.error}
        </div>
      )}
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


// ── Scheduler 结果展示 ──

interface SchedulerJobOutput {
  id?: string
  type?: string
  label?: string
  status?: string
  cronExpr?: string
  watchPath?: string
  watchFileTypes?: string[]
  createdAt?: string
}

// ── Phase 6: 记忆结果展示 ──

interface MemoryRecallOutput {
  recalled: boolean
  summary: {
    profile?: Record<string, string>
    preferences?: Record<string, unknown>
    recentFacts?: { key: string; value: string; category: string; confidence: number }[]
    topParams?: { toolId: string; paramKey: string; paramValue: string; usageCount: number }[]
  }
}

function MemorySaveResultView({ action, result }: { action: { params?: Record<string, unknown> }; result: Record<string, unknown> }) {
  const key = action.params?.key as string ?? '信息'
  const value = action.params?.value as string ?? ''
  return (
    <div className="mt-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
        <span>🧠</span>
        <span>已记住</span>
      </div>
      <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
        {key}: {value}
      </p>
      {result.saved && (
        <p className="text-[10px] text-emerald-500/60 mt-1">下次对话时会自动使用这个信息</p>
      )}
    </div>
  )
}

function MemoryRecallResultView({ result }: { result: MemoryRecallOutput }) {
  const { summary } = result
  if (!summary) return null

  const profileEntries = Object.entries(summary.profile ?? {}).filter(([, v]) => v)
  const facts = summary.recentFacts?.filter(f => f.confidence >= 0.5) ?? []
  const hasContent = profileEntries.length > 0 || facts.length > 0

  if (!hasContent) {
    return (
      <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>💭</span>
          <span>还没有记住任何用户信息</span>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">在对话中告诉我你的信息，我会自动记住</p>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
        <span>💭</span>
        <span>用户记忆</span>
      </div>
      {profileEntries.length > 0 && (
        <div className="mt-2 space-y-1 text-[11px] text-blue-600/80 dark:text-blue-400/80">
          {profileEntries.map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="text-blue-400">•</span>
              <span>{k}: {v}</span>
            </div>
          ))}
        </div>
      )}
      {facts.length > 0 && (
        <div className="mt-2 space-y-1 text-[11px] text-blue-600/80 dark:text-blue-400/80">
          {facts.slice(0, 8).map(f => (
            <div key={f.key} className="flex items-center gap-1.5">
              <span className="text-blue-400">•</span>
              <span>{f.key}: {f.value}</span>
              <span className="text-[9px] text-blue-400/50 ml-1">({Math.round(f.confidence * 100)}%)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Phase 7: 离线推理结果展示 ──

interface OfflineInferenceOutput {
  offline: boolean
  text: string
  source: 'calc' | 'knowledge' | 'pattern' | 'fallback'
  confidence: number
  references?: string[]
  suggestOnline?: boolean
}

function OfflineInferenceResultView({ result }: { result: OfflineInferenceOutput }) {
  const sourceLabels: Record<string, { icon: string; label: string; color: string }> = {
    calc: { icon: '🔢', label: '本地计算', color: 'text-emerald-600 dark:text-emerald-400' },
    knowledge: { icon: '📚', label: '内置知识', color: 'text-blue-600 dark:text-blue-400' },
    pattern: { icon: '🧠', label: '意图识别', color: 'text-violet-600 dark:text-violet-400' },
    fallback: { icon: '📡', label: '离线模式', color: 'text-gray-600 dark:text-gray-400' },
  }

  const sourceInfo = sourceLabels[result.source] ?? sourceLabels.fallback
  const confidencePct = Math.round(result.confidence * 100)

  return (
    <div className="mt-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
        <span>{sourceInfo.icon}</span>
        <span>离线推理 · {sourceInfo.label}</span>
        {confidencePct > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/50 dark:bg-amber-800/30 text-amber-600 dark:text-amber-400">
            置信度 {confidencePct}%
          </span>
        )}
      </div>
      {result.references && result.references.length > 0 && (
        <p className="text-[10px] text-amber-500/60 mt-1">
          参考：{result.references.join(', ')}
        </p>
      )}
      {result.suggestOnline && (
        <p className="text-[10px] text-amber-500/60 mt-1">
          💡 连接网络后可获得更完整的 AI 专家分析
        </p>
      )}
    </div>
  )
}

function SchedulerResultView({ result, actionType }: { result: SchedulerJobOutput; actionType: string }) {
  if (!result.id && !result.label) return null

  const icon = actionType === 'schedule' ? '⏰' : '👁'
  const typeLabel = actionType === 'schedule' ? '定时任务' : '文件监控'
  const statusColor = result.status === 'active'
    ? 'text-emerald-600 dark:text-emerald-400'
    : result.status === 'failed'
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-600 dark:text-gray-400'

  return (
    <div className="mt-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
        <span>{icon}</span>
        <span>{typeLabel}已创建</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor} bg-white/60 dark:bg-black/20`}>
          {result.status ?? 'active'}
        </span>
      </div>

      <p className="text-xs text-violet-600/80 dark:text-violet-400/80 mt-1">
        {result.label}
      </p>

      <div className="mt-2 space-y-1 text-[11px] text-gray-600 dark:text-gray-400">
        {result.cronExpr && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">🕐</span>
            <span>Cron: <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs">{result.cronExpr}</code></span>
          </div>
        )}
        {result.watchPath && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">📂</span>
            <span>监控: <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs">{result.watchPath}</code></span>
          </div>
        )}
        {result.watchFileTypes && result.watchFileTypes.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">📎</span>
            <span>文件类型: {result.watchFileTypes.join(', ')}</span>
          </div>
        )}
        {result.id && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">🆔</span>
            <span className="font-mono text-[10px] text-gray-400">{result.id.slice(0, 8)}...</span>
          </div>
        )}
      </div>
    </div>
  )
}
