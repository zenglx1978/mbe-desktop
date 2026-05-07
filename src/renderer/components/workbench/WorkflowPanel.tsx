/**
 * 工作流可视化执行器
 * 步骤条 + 实时进度 + 每步结果展示（Markdown 渲染）
 * 可从 Chat Slash 命令 / WelcomeScreen / Sidebar 触发
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Copy, Play, ClipboardList as ClipboardListIcon } from 'lucide-react'
import type { SolutionConfig, WorkflowConfig, ScenarioConfig, ProfitImpact } from '@/lib/solution-router'
import {
  executeWorkflow, executeScenario,
  type StepStatus, type WorkflowResult,
} from '@/lib/workflow-service'
import { isAbortError } from '@/lib/chat-service'
import {
  getWorkflowIcon, STATUS_ICONS, ORCHESTRATION_META, PROFIT_DIM_META,
  DELIVERABLE_ICON, SUCCESS_ICON, EXPECTED_ICON,
} from '@/lib/workflow-icons'
import { useToolStore } from '@/stores/tool-store'

/** Markdown 渲染器，统一样式 */
function MarkdownContent({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div className={`prose prose-sm prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full text-xs border-collapse" {...props}>{children}</table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th className="px-3 py-1.5 text-left font-semibold border-b border-border/40 bg-secondary/20 text-muted-foreground" {...props}>{children}</th>
          ),
          td: ({ children, ...props }) => (
            <td className="px-3 py-1.5 border-b border-border/20" {...props}>{children}</td>
          ),
          h1: ({ children, ...props }) => <h2 className="text-base font-bold mt-4 mb-2" {...props}>{children}</h2>,
          h2: ({ children, ...props }) => <h3 className="text-sm font-bold mt-3 mb-1.5" {...props}>{children}</h3>,
          h3: ({ children, ...props }) => <h4 className="text-sm font-semibold mt-2 mb-1" {...props}>{children}</h4>,
          p: ({ children, ...props }) => <p className="text-sm leading-relaxed mb-2" {...props}>{children}</p>,
          li: ({ children, ...props }) => <li className="text-sm leading-relaxed" {...props}>{children}</li>,
          strong: ({ children, ...props }) => <strong className="text-primary font-semibold" {...props}>{children}</strong>,
          code: ({ children, className: cn, ...props }) => {
            const isInline = !cn
            return isInline
              ? <code className="px-1 py-0.5 rounded bg-secondary/40 text-xs font-mono" {...props}>{children}</code>
              : <code className={cn} {...props}>{children}</code>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

/** 将技术错误转为用户友好提示 */
function friendlyError(raw: string): { title: string; detail: string; suggestion: string } {
  if (raw.includes('401') || raw.includes('Authorization'))
    return { title: '认证未通过', detail: '当前会话可能已过期', suggestion: '请刷新页面后重试，或检查登录状态' }
  if (raw.includes('404') || raw.includes('not found'))
    return { title: '服务暂不可用', detail: '后端接口未部署或路径变更', suggestion: '请稍后重试，或联系技术支持' }
  if (raw.includes('timeout') || raw.includes('TIMEOUT'))
    return { title: '请求超时', detail: '后端处理时间过长', suggestion: '数据量较大时可能需要更长时间，请稍后重试' }
  if (raw.includes('500') || raw.includes('Internal'))
    return { title: '服务内部错误', detail: '后端处理异常', suggestion: '请稍后重试，问题将自动上报' }
  if (raw.includes('NetworkError') || raw.includes('fetch'))
    return { title: '网络连接失败', detail: '无法连接到后端服务', suggestion: '请检查网络连接，确认服务地址可达' }
  return { title: '执行失败', detail: raw.slice(0, 100), suggestion: '请重试或换一种方式提问' }
}

interface Props {
  solution: SolutionConfig
  initialWorkflow?: WorkflowConfig
  initialScenario?: ScenarioConfig
}

type ViewState = 'list' | 'input' | 'running' | 'done'

export default function WorkflowPanel({ solution, initialWorkflow, initialScenario }: Props) {
  const [view, setView] = useState<ViewState>(initialWorkflow || initialScenario ? 'input' : 'list')
  const [activeWf, setActiveWf] = useState<WorkflowConfig | null>(initialWorkflow || null)
  const [activeScenario, setActiveScenario] = useState<ScenarioConfig | null>(initialScenario || null)
  const [query, setQuery] = useState('')
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({})
  const [stepPartials, setStepPartials] = useState<Record<string, string>>({})
  const [result, setResult] = useState<WorkflowResult | null>(null)
  const [scenarioAnswer, setScenarioAnswer] = useState<string | null>(null)
  const [error, setError] = useState('')
  const runAbortRef = useRef<AbortController | null>(null)

  useEffect(() => () => {
    runAbortRef.current?.abort()
  }, [])

  const consumePendingWorkflowId = useToolStore((s) => s.consumePendingWorkflowId)
  const consumePendingScenarioId = useToolStore((s) => s.consumePendingScenarioId)
  const pendingWorkflowId = useToolStore((s) => s.pendingWorkflowId)
  const pendingScenarioId = useToolStore((s) => s.pendingScenarioId)

  const onProgress = useCallback((stepId: string, status: StepStatus, partial?: string) => {
    setStepStatuses(prev => ({ ...prev, [stepId]: status }))
    if (partial) setStepPartials(prev => ({ ...prev, [stepId]: partial }))
  }, [])

  const resetState = useCallback(() => {
    setStepStatuses({})
    setStepPartials({})
    setResult(null)
    setScenarioAnswer(null)
    setError('')
  }, [])

  const selectWorkflow = useCallback((wf: WorkflowConfig) => {
    setActiveWf(wf)
    setActiveScenario(null)
    setView('input')
    resetState()
  }, [resetState])

  const selectScenario = useCallback((sc: ScenarioConfig) => {
    setActiveScenario(sc)
    setActiveWf(null)
    setQuery('')
    setView('input')
    resetState()
  }, [resetState])

  useEffect(() => {
    if (pendingWorkflowId) {
      const wf = solution.workflows.find((w) => w.id === pendingWorkflowId)
      consumePendingWorkflowId()
      if (wf) selectWorkflow(wf)
    }
  }, [pendingWorkflowId, solution.workflows, consumePendingWorkflowId, selectWorkflow])

  useEffect(() => {
    if (pendingScenarioId) {
      const sc = (solution.scenarios ?? []).find((s) => s.id === pendingScenarioId)
      consumePendingScenarioId()
      if (sc) selectScenario(sc)
    }
  }, [pendingScenarioId, solution.scenarios, consumePendingScenarioId, selectScenario])

  const goToList = useCallback(() => {
    setView('list')
    resetState()
  }, [resetState])

  const goToInput = useCallback(() => {
    setView('input')
    resetState()
  }, [resetState])

  const { pillarScenarios, auxScenarios } = useMemo(() => {
    const all = solution.scenarios ?? []
    const pillar = all.filter((sc) => sc.id.startsWith('pillar_'))
    const aux = all.filter((sc) => !sc.id.startsWith('pillar_'))
    return { pillarScenarios: pillar, auxScenarios: aux }
  }, [solution.scenarios])

  const handleRun = useCallback(async () => {
    runAbortRef.current?.abort()
    runAbortRef.current = new AbortController()
    const { signal } = runAbortRef.current
    try {
      if (activeWf) {
        setView('running')
        setStepStatuses(Object.fromEntries(activeWf.steps.map(s => [s.id, 'pending' as StepStatus])))
        const res = await executeWorkflow(solution.id, activeWf, query, {}, onProgress)
        if (signal.aborted) return
        setResult(res)
        setView('done')
      } else if (activeScenario) {
        setView('running')
        setError('')
        const res = await executeScenario(solution.id, activeScenario, query, { signal })
        if (signal.aborted) return
        if (res.success) {
          setScenarioAnswer(res.answer || '')
        } else if (res.error) {
          setError(res.error)
        }
        setView('done')
      }
    } catch (e) {
      if (isAbortError(e)) return
      setError(e instanceof Error ? e.message : '执行失败')
      setView('done')
    }
  }, [activeWf, activeScenario, query, solution.id, onProgress])

  const copyMergedAnswer = useCallback(() => {
    if (result?.mergedAnswer) void navigator.clipboard.writeText(result.mergedAnswer)
  }, [result?.mergedAnswer])

  // ─── 列表视图 ───
  if (view === 'list') {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* 工作流 */}
          {solution.workflows.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                业务流程
              </h3>
              <div className="space-y-3">
                {solution.workflows.map(wf => {
                  const WfIcon = getWorkflowIcon(wf.icon ?? '')
                  return (
                    <button
                      key={wf.id}
                      type="button"
                      onClick={() => selectWorkflow(wf)}
                      className="w-full flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <WfIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold group-hover:text-primary transition-colors">
                          {wf.name}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{wf.description}</p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {wf.steps.map((s, i) => {
                            const ModeIcon = wf.mode ? ORCHESTRATION_META[wf.mode]?.icon : undefined
                            return (
                              <span key={s.id ?? i} className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                                {i > 0 && ModeIcon && <ModeIcon className="w-3 h-3" />}
                                {s.label}
                                {s.profitImpact && <ProfitBadge impact={s.profitImpact} />}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                      <OrchestrationBadge mode={wf.mode ?? 'sequential'} />
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* 快捷场景（四柱决策链 + 辅助） */}
          {(solution.scenarios ?? []).length > 0 && (
              <>
                {pillarScenarios.length > 0 && (
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      {(() => { const L = ORCHESTRATION_META.sequential.icon; return <L className="w-4 h-4" /> })()}
                      投资决策链 — 四步到买卖
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      每一步先走规则引擎和数据，确保结论可追溯。按顺序执行效果最佳。
                    </p>
                    <div className="space-y-2">
                      {pillarScenarios.map((sc, i) => {
                        const ScIcon = getWorkflowIcon(sc.icon)
                        return (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() => selectScenario(sc)}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                          >
                            <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                              style={{ backgroundColor: `${solution.color}20`, color: solution.color }}>
                              {i + 1}
                            </span>
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                              <ScIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold group-hover:text-primary transition-colors">
                                {sc.label}
                              </h4>
                              <p className="text-xs text-muted-foreground mt-0.5">{sc.expectedOutcome}</p>
                            </div>
                            {i < pillarScenarios.length - 1 && (
                              <span className="text-xs text-muted-foreground/40 shrink-0">→</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )}
                {auxScenarios.length > 0 && (
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      辅助工具
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {auxScenarios.map(sc => {
                        const ScIcon = getWorkflowIcon(sc.icon)
                        return (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() => selectScenario(sc)}
                            className="flex items-center gap-2.5 p-3 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-all text-left text-sm"
                          >
                            <ScIcon className="w-4 h-4 text-primary shrink-0" />
                            <span>{sc.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )}
              </>
          )}

          {solution.workflows.length === 0 && (solution.scenarios ?? []).length === 0 && (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-xl bg-muted/20 flex items-center justify-center mx-auto mb-4">
                {(() => { const R = STATUS_ICONS.running; return <R className="w-6 h-6 text-muted-foreground/30" /> })()}
              </div>
              <p className="text-sm text-muted-foreground">此方案暂未配置工作流</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── 输入视图 ───
  if (view === 'input') {
    const target = activeWf || activeScenario
    const TargetIcon = target && 'icon' in target
      ? getWorkflowIcon((target as any).icon)
      : STATUS_ICONS.running
    const Deliverable = DELIVERABLE_ICON
    const SuccessCheck = SUCCESS_ICON
    const Expected = EXPECTED_ICON

    return (
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-2xl mx-auto space-y-6">
          <button type="button" onClick={goToList}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <TargetIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {activeWf?.name || activeScenario?.label}
              </h2>
              {activeWf && <p className="text-xs text-muted-foreground">{activeWf.description}</p>}
            </div>
          </div>

          {/* 交付物和成功标准（工作流） */}
          {activeWf && (
            <div className="space-y-3">
              <div className="px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1.5">
                  <Deliverable className="w-3.5 h-3.5" /> 交付物
                </p>
                <p className="text-sm">{activeWf.deliverable}</p>
              </div>
              <div className="px-4 py-3 rounded-xl bg-secondary/20">
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <SuccessCheck className="w-3.5 h-3.5 text-green-500" /> 成功标准
                </p>
                <ul className="space-y-1">
                  {(activeWf.successCriteria ?? []).map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary/20 overflow-x-auto">
                  <OrchestrationBadge mode={activeWf.mode ?? 'sequential'} />
                  {activeWf.steps.map((s, i) => {
                    const ModeIcon = activeWf.mode ? ORCHESTRATION_META[activeWf.mode]?.icon : undefined
                    return (
                      <span key={s.id ?? i} className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                        {i > 0 && ModeIcon && <ModeIcon className="w-3 h-3 text-border" />}
                        <span className="w-5 h-5 rounded-full bg-secondary/40 flex items-center justify-center text-[10px] font-bold">
                          {i + 1}
                        </span>
                        {s.label}
                      </span>
                    )
                  })}
                </div>
                {activeWf.steps.some(s => s.profitImpact) && (
                  <div className="flex flex-wrap gap-2 px-4">
                    {activeWf.steps.filter(s => s.profitImpact).map((s, i) => (
                      <span key={s.id ?? i} className="text-[10px] text-muted-foreground">
                        {s.label}: <ProfitBadge impact={s.profitImpact} />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 期望输出（场景） */}
          {activeScenario && (
            <div className="px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1.5">
                <Expected className="w-3.5 h-3.5" /> 期望输出
              </p>
              <p className="text-sm">{activeScenario.expectedOutcome}</p>
            </div>
          )}

          {/* 输入区 */}
          <div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeScenario
                ? `补充说明（可选，场景已预设提问模板）`
                : `描述你的业务需求，AI 专家团队将按流程依次分析...`}
              rows={5}
              className="w-full px-4 py-3 rounded-xl border border-border/50 bg-secondary/20 text-sm resize-none outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={handleRun}
            disabled={!activeScenario && !query.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 hover:opacity-90"
            style={{ backgroundColor: solution.color }}
          >
            <Play className="w-4 h-4" />
            {activeWf ? `启动流程 — ${activeWf.steps.length} 步` : '开始'}
          </button>
        </div>
      </div>
    )
  }

  // ─── 运行中 / 完成视图 ───
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="max-w-2xl mx-auto space-y-6">
        {activeWf && (() => {
          const WfIcon = getWorkflowIcon(activeWf.icon ?? '')
          return (
            <>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <WfIcon className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold">{activeWf.name}</h2>
                <OrchestrationBadge mode={activeWf.mode ?? 'sequential'} />
                {view === 'running' && (
                  <span className="ml-auto text-xs px-2 py-1 rounded-full bg-primary/10 text-primary animate-pulse">
                    执行中…
                  </span>
                )}
                {view === 'done' && result?.success && (
                  <span className="ml-auto text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-500">
                    已完成 · {(result.totalDurationMs / 1000).toFixed(1)}秒
                  </span>
                )}
              </div>

              {/* 步骤进度条 */}
              <div className="space-y-3">
                {activeWf.steps.map((step, i) => {
                  const stepId = step.id ?? `step_${i}`
                  const status = stepStatuses[stepId] || 'pending'
                  const partial = stepPartials[stepId]
                  const sr = result?.steps.find(s => s.stepId === stepId)
                  return (
                    <StepCard
                      key={stepId}
                      index={i}
                      step={{ ...step, id: stepId }}
                      status={status}
                      answer={sr?.answer || partial}
                      error={sr?.error}
                      durationMs={sr?.durationMs}
                      color={solution.color}
                    />
                  )
                })}
              </div>

              {/* 合并结果 */}
              {view === 'done' && result?.mergedAnswer && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <ClipboardListIcon className="w-4 h-4 text-primary" /> 综合报告
                  </h3>
                  <div className="px-5 py-4 rounded-xl border border-border/40 bg-card max-h-[50vh] overflow-y-auto">
                    <MarkdownContent content={result.mergedAnswer} />
                  </div>
                  <button
                    type="button"
                    onClick={copyMergedAnswer}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" /> 复制报告
                  </button>
                </div>
              )}
            </>
          )
        })()}

        {activeScenario && (() => {
          const ScIcon = getWorkflowIcon(activeScenario.icon)
          return (
            <>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <ScIcon className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold">{activeScenario.label}</h2>
                {view === 'running' && (
                  <div
                    className="ml-auto w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: `${solution.color}40`, borderTopColor: solution.color }}
                  />
                )}
              </div>

              {view === 'done' && scenarioAnswer && (
                <div className="px-5 py-4 rounded-xl border border-border/40 bg-card max-h-[60vh] overflow-y-auto">
                  <MarkdownContent content={scenarioAnswer} />
                  {activeScenario?.apiEndpoint && (
                    <div className="mt-3 pt-2 border-t border-border/20 flex items-center gap-2 text-[10px] text-muted-foreground/50">
                      <span>数据来源：</span>
                      <code className="px-1 py-0.5 rounded bg-secondary/30 font-mono">
                        {activeScenario.apiEndpoint.split('?')[0]}
                      </code>
                      <span>（规则引擎 + 知识库）</span>
                    </div>
                  )}
                </div>
              )}

              {view === 'done' && error && (() => {
                const fe = friendlyError(error)
                return (
                  <div className="px-5 py-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-2">
                    <p className="text-sm font-semibold text-red-400 flex items-center gap-1.5">
                      {(() => { const X = STATUS_ICONS.error; return <X className="w-4 h-4" /> })()}
                      {fe.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{fe.detail}</p>
                    <p className="text-xs text-muted-foreground/80">{fe.suggestion}</p>
                  </div>
                )
              })()}
            </>
          )
        })()}

        {view === 'done' && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goToList}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border border-border/50 hover:bg-secondary/30 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> 返回列表
            </button>
            <button
              type="button"
              onClick={goToInput}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-white hover:opacity-90 transition-colors"
              style={{ backgroundColor: solution.color }}
            >
              <Play className="w-4 h-4" /> 再次执行
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ProfitBadge({ impact }: { impact?: ProfitImpact }) {
  if (!impact) return null
  const dim = PROFIT_DIM_META[impact.dimension] || PROFIT_DIM_META.revenue
  const DimIcon = dim.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] ${dim.cls} bg-secondary/30 rounded-full px-2 py-0.5`}>
      <DimIcon className="w-3 h-3" /> {dim.label}：{impact.amount}
    </span>
  )
}

function OrchestrationBadge({ mode }: { mode: string }) {
  const fallback = mode === 'parallel'
    ? ORCHESTRATION_META.parallel
    : ORCHESTRATION_META.sequential
  const info = ORCHESTRATION_META[mode] || fallback
  const ModeIcon = info.icon
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-secondary/30 text-muted-foreground"
      title={info.desc}>
      <ModeIcon className="w-3.5 h-3.5" /> {info.label}
    </span>
  )
}

function StepCard({ index, step, status, answer, error, durationMs, color }: {
  index: number
  step: { id: string; label: string; agent?: string; expert?: string; profitImpact?: ProfitImpact }
  status: StepStatus
  answer?: string
  error?: string
  durationMs?: number
  color: string
}) {
  const [expanded, setExpanded] = useState(status === 'done' || status === 'error')
  const StatusIcon = STATUS_ICONS[status] || STATUS_ICONS.pending

  return (
    <div className={`rounded-xl border transition-all ${
      status === 'running' ? 'border-primary/30 bg-primary/5' :
      status === 'done' ? 'border-green-500/20 bg-green-500/5' :
      status === 'error' ? 'border-red-500/20 bg-red-500/5' :
      'border-border/30 bg-secondary/10'
    }`}>
      <button
        onClick={() => (status === 'done' || status === 'error') && setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={status === 'running' ? { backgroundColor: `${color}20`, color } : undefined}
        >
          {status === 'running' ? (
            <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: `${color}40`, borderTopColor: color }} />
          ) : (
            <StatusIcon className={`w-4 h-4 ${
              status === 'done' ? 'text-green-500' :
              status === 'error' ? 'text-red-500' :
              'text-muted-foreground/50'
            }`} />
          )}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            第 {index + 1} 步 · {step.label}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {step.agent}.{step.expert}
          </p>
          {step.profitImpact && <ProfitBadge impact={step.profitImpact} />}
        </div>

        {durationMs != null && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {(durationMs / 1000).toFixed(1)}秒
          </span>
        )}

        {(status === 'done' || status === 'error') && (
          <span className="text-xs text-muted-foreground/50">{expanded ? '▲' : '▼'}</span>
        )}
      </button>

      {expanded && answer && (
        <div className="px-4 pb-3 border-t border-border/20 mt-1">
          <div className="max-h-48 overflow-y-auto mt-2">
            <MarkdownContent content={answer} />
          </div>
        </div>
      )}

      {expanded && error && (() => {
        const fe = friendlyError(error)
        return (
          <div className="px-4 pb-3 border-t border-red-500/10 mt-1">
            <p className="text-sm font-semibold text-red-400 mt-2 flex items-center gap-1.5">
              {(() => { const X = STATUS_ICONS.error; return <X className="w-4 h-4" /> })()}
              {fe.title}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{fe.detail}</p>
          </div>
        )
      })()}
    </div>
  )
}
