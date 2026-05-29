import { useState } from 'react'
import {
  Plus, Trash2, Activity, Play, Loader2,
  Zap, History,
} from 'lucide-react'
import type { PipelineItem, PipelineRunItem } from '@/stores/schedule-store'

interface DraftStep {
  id: string
  agent_name: string
  expert_id: string
  prompt: string
  inject_prev_result: boolean
  failure_policy: 'abort' | 'skip' | 'retry'
}

const AVAILABLE_EXPERTS = [
  { agent: 'finance', experts: ['tax_consultant', 'finance_accountant'], label: '财务' },
  { agent: 'legal', experts: ['dynamic_civil_lawyer', 'contract_reviewer'], label: '法律' },
  { agent: 'hr', experts: ['hr_consultant'], label: '人力资源' },
  { agent: 'cost', experts: ['cost_engineer'], label: '造价' },
  { agent: 'cs', experts: ['cs_consultant'], label: '客服' },
  { agent: 'sales', experts: ['sales_strategist'], label: '销售' },
  { agent: 'growth', experts: ['growth_consultant', 'content_creator'], label: '增长' },
  { agent: 'invest', experts: ['investment_analyst'], label: '投资' },
  { agent: 'pulmonary', experts: ['pulmonary_physician'], label: '肺科' },
]

interface PipelinePanelProps {
  pipelines: PipelineItem[]
  presets: Array<{ id: string; name: string; description: string; steps: Array<Record<string, unknown>> }>
  runs: PipelineRunItem[]
  loading: boolean
  error: string | null
  selectedId: string | null
  color: string
  agentName: string
  onSelect: (id: string) => void
  onRun: (id: string) => void
  onDelete: (id: string) => void
  onCreateFromPreset: (presetId: string) => void
  onCreatePipeline: (data: Record<string, unknown>) => Promise<unknown>
}

export function PipelinePanel({
  pipelines, presets, runs, loading, error,
  selectedId, color,
  onSelect, onRun, onDelete, onCreateFromPreset, onCreatePipeline,
}: PipelinePanelProps) {
  const [showPresets, setShowPresets] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editorName, setEditorName] = useState('')
  const [editorDesc, setEditorDesc] = useState('')
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([])
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const selected = pipelines.find((p) => p.pipeline_id === selectedId)

  const STATUS_COLORS: Record<string, string> = {
    idle: '#6b7280', running: '#3b82f6', completed: '#22c55e',
    failed: '#ef4444', partial: '#f59e0b',
  }

  return (
    <>
      {/* 左列 */}
      <div className="w-[420px] border-r border-border/50 overflow-y-auto p-4 space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-2 flex-1 text-left px-3 py-2 rounded-lg border border-dashed border-primary/30 hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-4 h-4" style={{ color }} />
            <span className="text-sm font-medium">从模板</span>
          </button>
          <button
            onClick={() => { setShowEditor(!showEditor); setShowPresets(false) }}
            className="flex items-center gap-2 flex-1 text-left px-3 py-2 rounded-lg border border-dashed border-blue-500/30 hover:bg-blue-500/5 transition-colors"
          >
            <Activity className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">可视化编辑</span>
          </button>
        </div>

        {showEditor && (
          <div className="space-y-3 p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 animate-in slide-in-from-top-2">
            <div className="space-y-2">
              <input
                className="w-full text-sm bg-background border border-border/50 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                placeholder="Pipeline 名称"
                value={editorName}
                onChange={(e) => setEditorName(e.target.value)}
              />
              <input
                className="w-full text-xs bg-background border border-border/50 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                placeholder="描述（可选）"
                value={editorDesc}
                onChange={(e) => setEditorDesc(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground">步骤（拖拽排序）</p>
              {draftSteps.map((step, i) => (
                <div
                  key={step.id}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx !== null && dragIdx !== i) {
                      setDraftSteps((prev) => {
                        const arr = [...prev]
                        const [moved] = arr.splice(dragIdx, 1)
                        arr.splice(i, 0, moved)
                        return arr
                      })
                    }
                    setDragIdx(null)
                  }}
                  className={`flex items-start gap-2 p-2 rounded-lg border bg-background transition-all ${
                    dragIdx === i ? 'border-blue-500 opacity-50' : 'border-border/30'
                  }`}
                >
                  <div className="cursor-grab mt-1 text-muted-foreground hover:text-foreground">⋮⋮</div>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex gap-2">
                      <select
                        className="text-xs bg-background border border-border/50 rounded px-1.5 py-1"
                        value={`${step.agent_name}/${step.expert_id}`}
                        onChange={(e) => {
                          const [a, x] = e.target.value.split('/')
                          setDraftSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, agent_name: a, expert_id: x } : s))
                        }}
                      >
                        {AVAILABLE_EXPERTS.flatMap((g) =>
                          g.experts.map((x) => (
                            <option key={`${g.agent}/${x}`} value={`${g.agent}/${x}`}>
                              {g.label} / {x}
                            </option>
                          )),
                        )}
                      </select>
                      <select
                        className="text-[11px] bg-background border border-border/50 rounded px-1 py-0.5"
                        value={step.failure_policy}
                        onChange={(e) => setDraftSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, failure_policy: e.target.value as DraftStep['failure_policy'] } : s))}
                      >
                        <option value="abort">失败终止</option>
                        <option value="skip">跳过继续</option>
                        <option value="retry">自动重试</option>
                      </select>
                    </div>
                    <input
                      className="w-full text-[11px] bg-background border border-border/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                      placeholder="该步骤的提示词"
                      value={step.prompt}
                      onChange={(e) => setDraftSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, prompt: e.target.value } : s))}
                    />
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={step.inject_prev_result}
                        onChange={(e) => setDraftSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, inject_prev_result: e.target.checked } : s))}
                      />
                      接收上一步结果
                    </label>
                  </div>
                  <button
                    onClick={() => setDraftSteps((prev) => prev.filter((s) => s.id !== step.id))}
                    className="text-red-400 hover:text-red-500 mt-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => setDraftSteps((prev) => [...prev, {
                  id: `step-${Date.now()}`,
                  agent_name: 'finance',
                  expert_id: 'tax_consultant',
                  prompt: '',
                  inject_prev_result: prev.length > 0,
                  failure_policy: 'abort',
                }])}
                className="w-full text-xs text-blue-500 hover:bg-blue-500/5 rounded-lg py-1.5 transition-colors border border-dashed border-blue-500/20"
              >
                + 添加步骤
              </button>
            </div>

            {draftSteps.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap text-[11px]">
                <span className="text-muted-foreground">预览:</span>
                {draftSteps.map((s, i) => (
                  <span key={s.id} className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">
                      {s.agent_name}/{s.expert_id}
                    </span>
                    {i < draftSteps.length - 1 && <span className="text-muted-foreground">→</span>}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={async () => {
                  if (!editorName.trim() || draftSteps.length === 0) return
                  await onCreatePipeline({
                    name: editorName.trim(),
                    description: editorDesc.trim(),
                    steps: draftSteps.map((s, i) => ({
                      order: i + 1,
                      agent_name: s.agent_name,
                      expert_id: s.expert_id,
                      prompt: s.prompt,
                      inject_prev_result: s.inject_prev_result,
                      failure_policy: s.failure_policy,
                    })),
                  })
                  setShowEditor(false)
                  setEditorName('')
                  setEditorDesc('')
                  setDraftSteps([])
                }}
                disabled={!editorName.trim() || draftSteps.length === 0}
                className="flex-1 text-xs bg-blue-500 text-white rounded-lg py-1.5 disabled:opacity-40 hover:bg-blue-600 transition-colors"
              >
                创建 Pipeline ({draftSteps.length} 步)
              </button>
              <button
                onClick={() => { setShowEditor(false); setDraftSteps([]) }}
                className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {showPresets && presets.length > 0 && (
          <div className="space-y-2 animate-in slide-in-from-top-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => { onCreateFromPreset(preset.id); setShowPresets(false) }}
                className="w-full text-left p-3 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all group"
              >
                <p className="text-sm font-medium group-hover:text-foreground">{preset.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {(preset.steps || []).length} 步 · {(preset.steps || []).map((s: Record<string, unknown>) => s.agent_name as string).filter(Boolean).join(' → ')}
                </p>
              </button>
            ))}
          </div>
        )}

        {loading && pipelines.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && <div className="text-xs text-red-500 px-2">{error}</div>}

        {pipelines.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">暂无 Pipeline</p>
            <p className="text-xs mt-1">从模板创建，串联多个 AI 专家</p>
          </div>
        )}

        {pipelines.map((p) => (
          <div
            key={p.pipeline_id}
            onClick={() => onSelect(p.pipeline_id)}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              selectedId === p.pipeline_id
                ? 'border-primary/40 bg-primary/5 shadow-sm'
                : 'border-border/50 hover:border-border hover:bg-muted/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{p.name}</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onRun(p.pipeline_id) }}
                  className="p-1 hover:bg-green-500/10 rounded-md transition-colors"
                  title="执行 Pipeline"
                >
                  <Play className="w-3.5 h-3.5 text-green-500" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(p.pipeline_id) }}
                  className="p-1 hover:bg-red-500/10 rounded-md transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            </div>
            {p.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>
            )}

            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {p.steps.map((step, i) => (
                <div key={step.step_id} className="flex items-center gap-1">
                  <div
                    className="px-2 py-0.5 rounded-md text-[11px] font-medium border"
                    style={{ borderColor: `${color}40`, color }}
                  >
                    {step.agent_name}/{step.expert_id}
                  </div>
                  {i < p.steps.length - 1 && (
                    <span className="text-muted-foreground text-[11px]">→</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
              <span>累计 {p.total_runs} 次</span>
              {p.total_runs > 0 && (
                <span>成功率{Math.round((p.success_runs / p.total_runs) * 100)}%</span>
              )}
              {p.last_run_at && (
                <span>上次 {new Date(p.last_run_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 右列：Pipeline 详情 & 执行历史 */}
      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">{selected.name}</h2>
              {selected.description && (
                <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                执行流程（{selected.steps.length} 步串行）
              </h3>
              <div className="space-y-2">
                {selected.steps.map((step, i) => (
                  <div key={step.step_id} className="relative">
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-muted/10">
                      <div
                        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: color }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{step.agent_name}/{step.expert_id}</span>
                          {step.inject_prev_result && i > 0 && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                              接收上一步结果
                            </span>
                          )}
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {step.failure_policy}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">
                          {step.prompt}
                        </p>
                      </div>
                    </div>
                    {i < selected.steps.length - 1 && (
                      <div className="absolute left-[26px] -bottom-2 w-0.5 h-2 bg-border/50" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                执行历史
              </h3>
              {runs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">暂无执行记录</p>
              ) : (
                <div className="space-y-3">
                  {runs.slice().reverse().map((run) => (
                    <div
                      key={run.run_id}
                      className="p-3 rounded-xl border border-border/50 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: STATUS_COLORS[run.status] || '#6b7280' }}
                          />
                          <span className="text-sm font-medium">{run.status}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(run.triggered_at).toLocaleString('zh-CN')}
                        </span>
                      </div>

                      {run.error && (
                        <p className="text-xs text-red-500">{run.error}</p>
                      )}

                      <div className="space-y-1">
                        {(run.step_results as Array<Record<string, unknown>>).map((sr, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <div
                              className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                background: sr.status === 'completed' ? '#22c55e'
                                  : sr.status === 'failed' ? '#ef4444'
                                  : '#6b7280',
                              }}
                            />
                            <div className="min-w-0">
                              <span className="font-medium">{sr.agent_name as string}/{sr.expert_id as string}</span>
                              {!!sr.summary && (
                                <p className="text-muted-foreground mt-0.5 line-clamp-2">{String(sr.summary)}</p>
                              )}
                              {!!sr.error && (
                                <p className="text-red-500 mt-0.5">{String(sr.error)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1">
                        <span>Token: {run.total_tokens_in + run.total_tokens_out}</span>
                        {run.total_cost_rmb > 0 && <span>费用: ¥{run.total_cost_rmb.toFixed(2)}</span>}
                        {run.completed_at && (
                          <span>
                            耗时: {((new Date(run.completed_at).getTime() - new Date(run.triggered_at).getTime()) / 1000).toFixed(0)}s
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">选择左侧 Pipeline 查看详情</p>
              <p className="text-xs mt-1 text-muted-foreground/60">
                Pipeline 可串联多个 AI 专家，前一步结果自动注入后一步
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
