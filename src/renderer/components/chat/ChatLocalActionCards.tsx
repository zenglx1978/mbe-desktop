import { useState, useCallback } from 'react'
import { useChatStore, type LocalActionInfo } from '@/stores/chat-store'
import {
  executeActions,
  getManualActions,
  isElectronAvailable,
  getActionIcon,
  type LocalAction,
} from '@/lib/local-action-executor'
import { CopilotReplyActionCard } from '@/components/CopilotReplyCard'
import {
  DirScanResultView,
  BatchAnalyzeResultView,
  PipelineResultView,
  type DirScanOutput,
  type BatchAnalyzeOutput,
  type PipelineOutput,
} from './ChatActionPipelineViews'
import {
  MemorySaveResultView,
  MemoryRecallResultView,
  OfflineInferenceResultView,
  SchedulerResultView,
  type SchedulerJobOutput,
  type MemoryRecallOutput,
  type OfflineInferenceOutput,
} from './ChatActionMiscResultViews'

export interface ChatLocalActionCardsProps {
  actions: LocalActionInfo[]
  messageId: string
  actionStatus?: Record<number, string>
}

export function ChatLocalActionCards({ actions, messageId, actionStatus }: ChatLocalActionCardsProps) {
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
