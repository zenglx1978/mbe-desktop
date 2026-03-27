// ── Scheduler 结果展示 ──

export interface SchedulerJobOutput {
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

export interface MemoryRecallOutput {
  recalled: boolean
  summary: {
    profile?: Record<string, string>
    preferences?: Record<string, unknown>
    recentFacts?: { key: string; value: string; category: string; confidence: number }[]
    topParams?: { toolId: string; paramKey: string; paramValue: string; usageCount: number }[]
  }
}

export function MemorySaveResultView({ action, result }: { action: { params?: Record<string, unknown> }; result: Record<string, unknown> }) {
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
      {!!result.saved && (
        <p className="text-[10px] text-emerald-500/60 mt-1">下次对话时会自动使用这个信息</p>
      )}
    </div>
  )
}

export function MemoryRecallResultView({ result }: { result: MemoryRecallOutput }) {
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

export interface OfflineInferenceOutput {
  offline: boolean
  text: string
  source: 'calc' | 'knowledge' | 'pattern' | 'fallback'
  confidence: number
  references?: string[]
  suggestOnline?: boolean
}

export function OfflineInferenceResultView({ result }: { result: OfflineInferenceOutput }) {
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

export function SchedulerResultView({ result, actionType }: { result: SchedulerJobOutput; actionType: string }) {
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
          {({ active: '运行中', failed: '失败', paused: '已暂停', completed: '已完成' } as Record<string, string>)[result.status ?? 'active'] || result.status || '运行中'}
        </span>
      </div>

      <p className="text-xs text-violet-600/80 dark:text-violet-400/80 mt-1">
        {result.label}
      </p>

      <div className="mt-2 space-y-1 text-[11px] text-gray-600 dark:text-gray-400">
        {result.cronExpr && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">🕐</span>
            <span>定时表达式：<code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs">{result.cronExpr}</code></span>
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
