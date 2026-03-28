import { useState, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowUpRight } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { useChatStore, type ChatMessage, type WorkflowSuggestion } from '@/stores/chat-store'
import { startFromChat } from '@/lib/workflow-os-service'
import { WorkflowInstanceTimeline, WorkflowSuggestionTimeline } from '@/components/WorkflowTimeline'
import OrchestrationPanel from '@/components/OrchestrationPanel'
import SourcePanel from '@/components/SourcePanel'
import ConfidenceBadge, { getConfidenceCssClass } from '@/components/ConfidenceBadge'
import { ChatLocalActionCards } from './ChatLocalActionCards'
import { ExportToolbar } from '@/components/io'
import { ChatMarkdownLink } from './WorkflowActionLink'

const UPGRADE_PATTERN = /\n*💡\s*当前为.+版[，,]回答内容有限。升级.+[。.]/
const QUOTA_PATTERN = /您今日的免费咨询次数已用完.+升级套餐可获得.+[。.]/

function extractUpgradeHint(content: string): { body: string; hint: string | null } {
  for (const pat of [UPGRADE_PATTERN, QUOTA_PATTERN]) {
    const m = content.match(pat)
    if (m) {
      return { body: content.slice(0, m.index!).trimEnd(), hint: m[0].replace(/^\n+/, '') }
    }
  }
  return { body: content, hint: null }
}

function UpgradeBanner({ hint }: { hint: string }) {
  const handleClick = () => {
    window.open('https://mbe.hi-maker.com/pricing', '_blank')
  }
  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3">
      <div className="flex-1 text-xs text-amber-700 dark:text-amber-400">{hint}</div>
      <button
        type="button"
        onClick={handleClick}
        className="shrink-0 flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        升级套餐
        <ArrowUpRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export interface ChatMessageBubbleProps {
  message: ChatMessage
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user'
  const confidenceClass = !isUser ? getConfidenceCssClass(message.confidence) : ''

  const { body, hint } = useMemo(
    () => (isUser || message.streaming ? { body: message.content, hint: null } : extractUpgradeHint(message.content)),
    [isUser, message.content, message.streaming],
  )

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        <div
          className={`px-4 py-3 rounded-xl text-sm leading-relaxed ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : `bg-secondary/50 text-foreground rounded-bl-sm ${confidenceClass}`
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{ a: ChatMarkdownLink }}
              >
                {body}
              </ReactMarkdown>
            </div>
          )}
          {message.streaming && (
            <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
          )}
        </div>
        {hint && <UpgradeBanner hint={hint} />}
        {!isUser &&
          message.orchestration &&
          (message.orchestration.experts?.length ?? 0) > 0 && (
            <OrchestrationPanel orchestration={message.orchestration} />
          )}
        {!isUser && message.confidence != null && (
          <ConfidenceBadge confidence={message.confidence} />
        )}
        {!isUser && !message.streaming && message.content.length > 50 && (
          <ExportToolbar content={message.content} className="mt-1" />
        )}
        {message.sources && message.sources.length > 0 && (
          <SourcePanel sources={message.sources} />
        )}
        {message.workflowInstance && (
          <WorkflowInstanceTimeline instance={message.workflowInstance} />
        )}
        {message.workflowSuggestion && !message.workflowInstance && (
          <WorkflowSuggestionTimelineWrapper
            suggestion={message.workflowSuggestion}
            messageId={message.id}
          />
        )}
        {message.localActions && message.localActions.length > 0 && !message.streaming && (
          <ChatLocalActionCards
            actions={message.localActions}
            messageId={message.id}
            actionStatus={message.localActionStatus}
          />
        )}
      </div>
    </div>
  )
}

export interface WorkflowSuggestionTimelineWrapperProps {
  suggestion: WorkflowSuggestion
  messageId: string
}

export function WorkflowSuggestionTimelineWrapper({ suggestion, messageId }: WorkflowSuggestionTimelineWrapperProps) {
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
          steps: (result.steps || suggestion.steps).map((s: Record<string, unknown>) => ({
            id: String(s.step_id || s.id || ''),
            name: String(s.step_name || s.name || ''),
            status: String(s.status || 'pending'),
          })),
        },
      })
    }

    setStarting(false)
  }, [starting, solution, suggestion, messageId, updateMessage])

  return (
    <WorkflowSuggestionTimeline
      suggestion={suggestion}
      onStart={handleStart}
      starting={starting}
    />
  )
}
