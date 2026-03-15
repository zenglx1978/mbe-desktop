/**
 * 工作流可视化执行器
 * 步骤条 + 实时进度 + 每步结果展示
 * 可从 Chat Slash 命令 / WelcomeScreen / Sidebar 触发
 */

import { useState, useCallback } from 'react'
import type { SolutionConfig, WorkflowConfig, ScenarioConfig } from '@/lib/solution-router'
import {
  executeWorkflow, executeScenario,
  type StepStatus, type WorkflowResult,
} from '@/lib/workflow-service'

interface Props {
  solution: SolutionConfig
  /** 初始选中的工作流（从外部触发进入） */
  initialWorkflow?: WorkflowConfig
  /** 初始选中的场景 */
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

  const onProgress = useCallback((stepId: string, status: StepStatus, partial?: string) => {
    setStepStatuses(prev => ({ ...prev, [stepId]: status }))
    if (partial) setStepPartials(prev => ({ ...prev, [stepId]: partial }))
  }, [])

  function selectWorkflow(wf: WorkflowConfig) {
    setActiveWf(wf)
    setActiveScenario(null)
    setView('input')
    resetState()
  }

  function selectScenario(sc: ScenarioConfig) {
    setActiveScenario(sc)
    setActiveWf(null)
    setQuery('')
    setView('input')
    resetState()
  }

  function resetState() {
    setStepStatuses({})
    setStepPartials({})
    setResult(null)
    setScenarioAnswer(null)
    setError('')
  }

  async function handleRun() {
    if (activeWf) {
      setView('running')
      setStepStatuses(Object.fromEntries(activeWf.steps.map(s => [s.id, 'pending' as StepStatus])))
      const res = await executeWorkflow(solution.id, activeWf, query, {}, onProgress)
      setResult(res)
      setView('done')
    } else if (activeScenario) {
      setView('running')
      setError('')
      const res = await executeScenario(solution.id, activeScenario, query)
      if (res.success) {
        setScenarioAnswer(res.answer || '')
      } else {
        setError(res.error || '执行失败')
      }
      setView('done')
    }
  }

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
                {solution.workflows.map(wf => (
                  <button
                    key={wf.id}
                    onClick={() => selectWorkflow(wf)}
                    className="w-full flex items-start gap-4 p-4 rounded-xl border border-border/40 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                  >
                    <span className="text-2xl shrink-0">{wf.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold group-hover:text-primary transition-colors">
                        {wf.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{wf.description}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        {wf.steps.map((s, i) => (
                          <span key={s.id} className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                            {i > 0 && <span>→</span>}
                            {s.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-lg bg-secondary/30 text-muted-foreground shrink-0">
                      {wf.mode === 'sequential' ? '流水线' : '并行'}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 快捷场景 */}
          {solution.scenarios.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                快捷场景
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {solution.scenarios.map(sc => (
                  <button
                    key={sc.id}
                    onClick={() => selectScenario(sc)}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-all text-left text-sm"
                  >
                    <span className="text-lg">{sc.icon}</span>
                    <span>{sc.label}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {solution.workflows.length === 0 && solution.scenarios.length === 0 && (
            <div className="text-center py-12">
              <span className="text-5xl block mb-4">🔄</span>
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
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-2xl mx-auto space-y-6">
          <button onClick={() => { setView('list'); resetState() }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 返回
          </button>

          <div className="flex items-center gap-3">
            <span className="text-3xl">{target && 'icon' in target ? (target as any).icon : '🔄'}</span>
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
                <p className="text-xs font-semibold text-primary mb-1">📦 交付物</p>
                <p className="text-sm">{activeWf.deliverable}</p>
              </div>
              <div className="px-4 py-3 rounded-xl bg-secondary/20">
                <p className="text-xs font-semibold text-muted-foreground mb-2">✅ 成功标准</p>
                <ul className="space-y-1">
                  {activeWf.successCriteria.map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary/20 overflow-x-auto">
                {activeWf.steps.map((s, i) => (
                  <span key={s.id} className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    {i > 0 && <span className="text-border">→</span>}
                    <span className="w-5 h-5 rounded-full bg-secondary/40 flex items-center justify-center text-[10px] font-bold">
                      {i + 1}
                    </span>
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 期望输出（场景） */}
          {activeScenario && (
            <div className="px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-xs font-semibold text-primary mb-1">🎯 期望输出</p>
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
            onClick={handleRun}
            disabled={!activeScenario && !query.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 hover:opacity-90"
            style={{ backgroundColor: solution.color }}
          >
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
        {activeWf && (
          <>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{activeWf.icon}</span>
              <h2 className="text-base font-bold">{activeWf.name}</h2>
              {view === 'running' && (
                <span className="ml-auto text-xs px-2 py-1 rounded-full bg-primary/10 text-primary animate-pulse">
                  执行中…
                </span>
              )}
              {view === 'done' && result?.success && (
                <span className="ml-auto text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-500">
                  已完成 · {(result.totalDurationMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>

            {/* 步骤进度条 */}
            <div className="space-y-3">
              {activeWf.steps.map((step, i) => {
                const status = stepStatuses[step.id] || 'pending'
                const partial = stepPartials[step.id]
                const sr = result?.steps.find(s => s.stepId === step.id)
                return (
                  <StepCard
                    key={step.id}
                    index={i}
                    step={step}
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
                <h3 className="text-sm font-semibold">📋 综合报告</h3>
                <div className="px-5 py-4 rounded-xl border border-border/40 bg-card text-sm whitespace-pre-wrap max-h-[50vh] overflow-y-auto leading-relaxed">
                  {result.mergedAnswer}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(result.mergedAnswer || '')}
                  className="px-3 py-1.5 rounded-lg text-xs border border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  📋 复制报告
                </button>
              </div>
            )}
          </>
        )}

        {activeScenario && (
          <>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{activeScenario.icon}</span>
              <h2 className="text-base font-bold">{activeScenario.label}</h2>
              {view === 'running' && (
                <div
                  className="ml-auto w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: `${solution.color}40`, borderTopColor: solution.color }}
                />
              )}
            </div>

            {view === 'done' && scenarioAnswer && (
              <div className="px-5 py-4 rounded-xl border border-border/40 bg-card text-sm whitespace-pre-wrap max-h-[60vh] overflow-y-auto leading-relaxed">
                {scenarioAnswer}
              </div>
            )}

            {view === 'done' && error && (
              <div className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-sm text-red-400">
                {error}
              </div>
            )}
          </>
        )}

        {view === 'done' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setView('list'); resetState() }}
              className="px-4 py-2 rounded-xl text-sm border border-border/50 hover:bg-secondary/30 transition-colors"
            >
              ← 返回列表
            </button>
            <button
              onClick={() => { setView('input'); resetState() }}
              className="px-4 py-2 rounded-xl text-sm text-white hover:opacity-90 transition-colors"
              style={{ backgroundColor: solution.color }}
            >
              再次执行
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const STATUS_ICON: Record<StepStatus, string> = {
  pending: '⏳', running: '🔄', done: '✅', error: '❌',
}

function StepCard({ index, step, status, answer, error, durationMs, color }: {
  index: number
  step: { id: string; label: string; agent: string; expert: string }
  status: StepStatus
  answer?: string
  error?: string
  durationMs?: number
  color: string
}) {
  const [expanded, setExpanded] = useState(status === 'done' || status === 'error')

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
            <span>{STATUS_ICON[status]}</span>
          )}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            第 {index + 1} 步 · {step.label}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {step.agent}.{step.expert}
          </p>
        </div>

        {durationMs != null && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {(durationMs / 1000).toFixed(1)}s
          </span>
        )}

        {(status === 'done' || status === 'error') && (
          <span className="text-xs text-muted-foreground/50">{expanded ? '▲' : '▼'}</span>
        )}
      </button>

      {expanded && answer && (
        <div className="px-4 pb-3 border-t border-border/20">
          <div className="text-sm whitespace-pre-wrap max-h-48 overflow-y-auto mt-3 leading-relaxed">
            {answer}
          </div>
        </div>
      )}

      {expanded && error && (
        <div className="px-4 pb-3 border-t border-red-500/10">
          <p className="text-sm text-red-400 mt-3">{error}</p>
        </div>
      )}
    </div>
  )
}
