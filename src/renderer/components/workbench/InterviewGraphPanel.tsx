import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  GitBranch,
  Loader2,
  Mic,
  Network,
  SearchCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { API_BASE, authFetch } from '@/lib/api-client'
import { useToolStore } from '@/stores/tool-store'
import { useToastStore } from '@/components/ToastContainer'

type SeedType = 'person' | 'source' | 'company' | 'episode' | 'topic'

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  detail?: unknown
  error?: unknown
}

interface SubmittedInput {
  seed_type: SeedType
  seed_value: string
  industry: string
  scope: string
  source_url?: string
  generated_at: string
}

interface ExpansionStep {
  node_name: string
  node_type: string
  expanded_at: string
}

interface InterviewGraphNode {
  node_name?: string
  node_type?: string
  organization?: string
  why_relevant?: string
  confidence?: string
  needs_source_check?: boolean
  source_url?: string | null
  [key: string]: unknown
}

interface InterviewGraphSignal {
  signal_id?: string
  value_chain_layer?: string
  signal_grade?: string
  consensus_status?: string
  core_claim?: string
  investment_implication?: string
  counter_evidence?: string
  source?: string
  source_url?: string | null
  confidence?: string
  related_nodes?: string[]
  supporting_questions?: string[]
  [key: string]: unknown
}

interface InterviewGraphVerificationItem {
  signal_id?: string
  value_chain_layer?: string
  verification_metric?: string
  data_source_type?: string
  next_check_date?: string
  owner_role?: string
  pass_condition?: string
  [key: string]: unknown
}

interface InterviewGraphSourceCandidate {
  source_name?: string
  host_or_author?: string
  platform?: string
  url?: string
  why_relevant?: string
  value_chain_layers?: string[]
  quality_score?: number
  quality_label?: string
  suggested_seed?: string
  suggested_seed_type?: SeedType
  needs_human_confirm?: boolean
  [key: string]: unknown
}

interface InterviewGraphSourceDiscoveryResult {
  sources?: InterviewGraphSourceCandidate[]
  search_queries?: string[]
  note?: string
  [key: string]: unknown
}

interface InterviewGraphStockCandidate {
  ticker?: string
  company_name?: string
  market?: string
  relevance_score?: number
  matched_from?: string
  related_layers?: string[]
  rationale?: string
  next_research_action?: string
  risk_note?: string
  [key: string]: unknown
}

interface InterviewGraphStockCandidateResult {
  candidates?: InterviewGraphStockCandidate[]
  market_scope?: string
  watchlist_size?: number
  method?: string
  note?: string
  [key: string]: unknown
}

interface InterviewGraphResult {
  tracker_id?: string
  seed?: Record<string, unknown>
  source_quality?: Record<string, unknown>
  nodes?: InterviewGraphNode[]
  edges?: Record<string, unknown>[]
  questions?: Record<string, unknown>[]
  signals?: InterviewGraphSignal[]
  verification_plan?: InterviewGraphVerificationItem[]
  next_actions?: string[]
  quality_rules?: string[]
  disclaimer?: string
  [key: string]: unknown
}

const SEED_TYPES: { value: SeedType; label: string }[] = [
  { value: 'person', label: '人物' },
  { value: 'source', label: '信源/博客' },
  { value: 'company', label: '公司' },
  { value: 'episode', label: '单期访谈' },
  { value: 'topic', label: '主题' },
]

const SAMPLE_SEEDS = [
  {
    label: 'AI · Dwarkesh × 黄仁勋',
    seedType: 'person' as SeedType,
    seed: 'Dwarkesh Patel 访谈黄仁勋 Jensen Huang NVIDIA',
    industry: 'AI产业链',
    scope: 'global',
  },
  {
    label: '半导体 · 供应链访谈',
    seedType: 'source' as SeedType,
    seed: 'SemiAnalysis AI data center and GPU supply chain interviews',
    industry: '半导体',
    scope: 'global',
  },
  {
    label: '机器人 · 创始人长访谈',
    seedType: 'topic' as SeedType,
    seed: '机器人行业创始人长访谈网络',
    industry: '机器人',
    scope: 'global',
  },
  {
    label: '新能源 · 储能/光伏访谈',
    seedType: 'topic' as SeedType,
    seed: '新能源 储能 光伏 电动车 高质量访谈网络',
    industry: '新能源',
    scope: 'global',
  },
]

const LAYER_LABELS: Record<string, string> = {
  energy: '能源',
  solar: '光伏',
  battery_storage: '储能/电池',
  grid: '电网/消纳',
  ev: '电动车',
  chip: '芯片',
  infrastructure: '基础设施',
  data: '数据',
  model: '模型',
  application: '应用',
  regulatory: '监管',
}

function seedTypeFromNode(nodeType: string): SeedType {
  const normalized = nodeType.toLowerCase()
  if (normalized === 'source' || normalized === 'host_or_author') return 'source'
  if (normalized === 'guest' || normalized === 'person') return 'person'
  if (normalized === 'company' || normalized === 'organization') return 'company'
  if (normalized === 'episode') return 'episode'
  return 'topic'
}

async function postEnvelope<T>(path: string, body: unknown): Promise<ApiEnvelope<T>> {
  const resp = await authFetch(`${API_BASE}/api/invest${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const payload = await resp.json().catch(() => ({ detail: resp.statusText })) as ApiEnvelope<T>
  if (!resp.ok) {
    throw new Error(readApiError(payload, '请求失败'))
  }
  return payload
}

function readApiError(payload: ApiEnvelope<unknown>, fallback: string): string {
  const detail = payload.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    const record = detail as Record<string, unknown>
    const message = record.message ?? record.hint ?? record.error
    if (typeof message === 'string') return message
  }
  if (typeof payload.error === 'string') return payload.error
  if (payload.error && typeof payload.error === 'object') {
    const record = payload.error as Record<string, unknown>
    const message = record.message ?? record.hint
    if (typeof message === 'string') return message
  }
  return fallback
}

function marketFromCandidate(market?: string): 'A' | 'HK' | 'US' {
  const normalized = String(market ?? '').trim().toUpperCase()
  if (normalized.includes('HK') || normalized.includes('港') || normalized.includes('HONG KONG')) return 'HK'
  if (
    normalized.includes('US') ||
    normalized.includes('美') ||
    normalized.includes('NASDAQ') ||
    normalized.includes('NYSE') ||
    normalized.includes('AMEX') ||
    normalized.includes('.US')
  ) return 'US'
  return 'A'
}

export default function InterviewGraphPanel() {
  const addToast = useToastStore((s) => s.addToast)
  const selectStockAndResearch = useToolStore((s) => s.selectStockAndResearch)
  const [seedType, setSeedType] = useState<SeedType>('person')
  const [seed, setSeed] = useState('Dwarkesh Patel 访谈黄仁勋 Jensen Huang NVIDIA')
  const [industry, setIndustry] = useState('AI产业链')
  const [scope, setScope] = useState('global')
  const [sourceUrl, setSourceUrl] = useState('')
  const [maxDepth, setMaxDepth] = useState(2)
  const [loading, setLoading] = useState(false)
  const [sourceLoading, setSourceLoading] = useState(false)
  const [stockLoading, setStockLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [result, setResult] = useState<InterviewGraphResult | null>(null)
  const [submittedInput, setSubmittedInput] = useState<SubmittedInput | null>(null)
  const [sourceDiscovery, setSourceDiscovery] = useState<InterviewGraphSourceDiscoveryResult | null>(null)
  const [stockCandidates, setStockCandidates] = useState<InterviewGraphStockCandidateResult | null>(null)
  const [expansionTrail, setExpansionTrail] = useState<ExpansionStep[]>([])

  const nodes = result?.nodes ?? []
  const signals = result?.signals ?? []
  const verificationPlan = result?.verification_plan ?? []
  const sourceQuality = result?.source_quality ?? {}
  const layerCount = useMemo(
    () => new Set(signals.map((s) => s.value_chain_layer).filter(Boolean)).size,
    [signals],
  )

  async function runDiscoverSources() {
    if (sourceLoading) return
    setSourceLoading(true)
    setErrorMessage('')
    try {
      const resp = await postEnvelope<InterviewGraphSourceDiscoveryResult>('/interview-graph/discover-sources', {
        industry: industry.trim() || 'AI产业链',
        scope: scope.trim() || 'global',
        limit: 8,
      })
      if (resp.success === false || !resp.data) throw new Error('访谈信源发现失败')
      setSourceDiscovery(resp.data)
      addToast('已生成候选信源名单。', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : '访谈信源发现失败'
      setErrorMessage(message)
      addToast(message, 'error')
    } finally {
      setSourceLoading(false)
    }
  }

  function applySourceCandidate(candidate: InterviewGraphSourceCandidate) {
    setSeedType(candidate.suggested_seed_type ?? 'source')
    setSeed(String(candidate.suggested_seed || candidate.source_name || candidate.host_or_author || ''))
    setSourceUrl(typeof candidate.url === 'string' ? candidate.url : '')
    addToast('已填入候选信源，可继续生成图谱。', 'success')
  }

  async function runGenerateWithInput(requestInput: SubmittedInput) {
    if (!requestInput.seed_value.trim() || loading) return
    setLoading(true)
    setErrorMessage('')
    setResult(null)
    try {
      const resp = await postEnvelope<InterviewGraphResult>('/interview-graph/generate', {
        seed_type: requestInput.seed_type,
        seed_value: requestInput.seed_value,
        industry: requestInput.industry,
        scope: requestInput.scope,
        source_url: requestInput.source_url,
        max_depth: maxDepth,
        include_verification: true,
      })
      if (resp.success === false || !resp.data) throw new Error('访谈图谱返回为空')
      setResult(resp.data)
      setSubmittedInput(requestInput)
      setStockCandidates(null)
      addToast('访谈图谱情报已生成。', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : '访谈图谱生成失败'
      setErrorMessage(message)
      addToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function runGenerate() {
    const requestInput: SubmittedInput = {
      seed_type: seedType,
      seed_value: seed.trim(),
      industry: industry.trim() || 'AI',
      scope: scope.trim() || 'global',
      source_url: sourceUrl.trim() || undefined,
      generated_at: new Date().toLocaleString(),
    }
    setExpansionTrail([])
    await runGenerateWithInput(requestInput)
  }

  async function expandFromNode(node: InterviewGraphNode) {
    const nodeName = String(node.node_name ?? '').trim()
    if (!nodeName || loading) return
    const nextSeedType = seedTypeFromNode(String(node.node_type ?? 'topic'))
    const nextSourceUrl = typeof node.source_url === 'string' ? node.source_url : ''
    const requestInput: SubmittedInput = {
      seed_type: nextSeedType,
      seed_value: nodeName,
      industry: industry.trim() || 'AI',
      scope: scope.trim() || 'global',
      source_url: nextSourceUrl || undefined,
      generated_at: new Date().toLocaleString(),
    }
    setSeedType(nextSeedType)
    setSeed(nodeName)
    setSourceUrl(nextSourceUrl)
    setExpansionTrail((prev) => [
      ...prev.slice(-5),
      { node_name: nodeName, node_type: String(node.node_type ?? 'node'), expanded_at: requestInput.generated_at },
    ])
    await runGenerateWithInput(requestInput)
  }

  async function runStockCandidates() {
    if (!result || stockLoading) return
    setStockLoading(true)
    setErrorMessage('')
    try {
      const resp = await postEnvelope<InterviewGraphStockCandidateResult>('/interview-graph/stock-candidates', {
        graph_result: result,
        market_scope: scope.trim() || 'global',
        limit: 8,
      })
      if (resp.success === false || !resp.data) throw new Error('选股线索返回为空')
      setStockCandidates(resp.data)
      addToast('已生成相关股票候选。', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : '选股线索生成失败'
      setErrorMessage(message)
      addToast(message, 'error')
    } finally {
      setStockLoading(false)
    }
  }

  function sendToResearch(candidate: InterviewGraphStockCandidate) {
    const ticker = String(candidate.ticker ?? '').trim()
    if (!ticker) return
    selectStockAndResearch({
      ticker,
      name: String(candidate.company_name || ticker),
      market: marketFromCandidate(candidate.market),
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">访谈图谱情报</h2>
              <p className="text-sm text-muted-foreground">
                从高质量访谈网络追踪人物、公司、关键问题和产业链信号，并生成股票候选。
              </p>
            </div>
          </div>
        </header>

        {errorMessage && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-5">
          <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
            <SectionTitle icon={<Sparkles className="w-4 h-4" />} title="输入线索" />
            <div className="flex flex-wrap gap-2">
              {SAMPLE_SEEDS.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => {
                    setSeedType(sample.seedType)
                    setSeed(sample.seed)
                    setIndustry(sample.industry)
                    setScope(sample.scope)
                    setSourceUrl('')
                  }}
                  className="rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
                >
                  {sample.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                种子类型
                <select value={seedType} onChange={(e) => setSeedType(e.target.value as SeedType)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                  {SEED_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                展开深度
                <select value={maxDepth} onChange={(e) => setMaxDepth(Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                  {[1, 2, 3].map((value) => <option key={value} value={value}>{value} 层</option>)}
                </select>
              </label>
            </div>
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground block">
              访谈/人物/公司/主题
              <textarea value={seed} onChange={(e) => setSeed(e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                行业
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                范围/市场
                <input value={scope} onChange={(e) => setScope(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="global / A股 / 美股" />
              </label>
            </div>
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground block">
              来源链接（可选）
              <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="YouTube / 博客 / 播客链接" />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button" onClick={runDiscoverSources} disabled={sourceLoading} className="rounded-xl border border-primary/35 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/15 disabled:opacity-50">
                {sourceLoading ? <InlineLoading label="发现信源中" /> : '1. 自动发现信源'}
              </button>
              <button type="button" onClick={runGenerate} disabled={loading || !seed.trim()} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {loading ? <InlineLoading label="构建图谱中" /> : '2. 构建访谈图谱'}
              </button>
            </div>
            {submittedInput && (
              <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">最近生成</p>
                <p>{submittedInput.seed_value}</p>
                <p>{submittedInput.industry} · {submittedInput.scope} · {submittedInput.generated_at}</p>
              </div>
            )}
          </section>

          <section className="space-y-4">
            {sourceDiscovery?.sources?.length ? (
              <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
                <SectionTitle icon={<SearchCheck className="w-4 h-4" />} title="候选信源" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sourceDiscovery.sources.slice(0, 6).map((source, index) => (
                    <button key={`${source.source_name ?? 'source'}-${index}`} type="button" onClick={() => applySourceCandidate(source)} className="rounded-xl border border-border/60 bg-background/70 p-3 text-left hover:border-primary/40">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{source.source_name || source.host_or_author || '候选信源'}</p>
                        {typeof source.quality_score === 'number' && <span className="text-xs text-primary">{source.quality_score}</span>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{source.why_relevant || source.platform || '点击填入为新线索'}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {result ? (
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="节点" value={nodes.length} />
                <MetricCard label="产业层级" value={layerCount} />
                <MetricCard label="验证项" value={verificationPlan.length} />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center">
                <Network className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold">等待访谈图谱</p>
                <p className="mt-1 text-xs text-muted-foreground">先发现信源或直接输入线索构建图谱。</p>
              </div>
            )}

            {result && (
              <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <SectionTitle icon={<GitBranch className="w-4 h-4" />} title="图谱节点" />
                  <button type="button" onClick={runStockCandidates} disabled={stockLoading} className="rounded-lg border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50">
                    {stockLoading ? '生成中...' : '生成选股线索'}
                  </button>
                </div>
                {expansionTrail.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {expansionTrail.map((step, index) => (
                      <span key={`${step.node_name}-${index}`} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                        {step.node_name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {nodes.slice(0, 8).map((node, index) => (
                    <NodeCard key={`${node.node_name ?? 'node'}-${index}`} node={node} onExpand={() => expandFromNode(node)} loading={loading} />
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {stockCandidates?.candidates?.length ? (
          <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
            <SectionTitle icon={<CheckCircle2 className="w-4 h-4" />} title="相关股票候选" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {stockCandidates.candidates.map((candidate, index) => (
                <StockCandidateCard key={`${candidate.ticker ?? 'candidate'}-${index}`} candidate={candidate} onResearch={() => sendToResearch(candidate)} />
              ))}
            </div>
          </section>
        ) : null}

        {signals.length > 0 && (
          <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
            <SectionTitle icon={<ShieldCheck className="w-4 h-4" />} title="产业链信号与验证" />
            <div className="space-y-3">
              {signals.slice(0, 6).map((signal, index) => (
                <SignalCard key={signal.signal_id ?? index} signal={signal} verification={verificationPlan.find((item) => item.signal_id === signal.signal_id)} />
              ))}
            </div>
          </section>
        )}

        {Object.keys(sourceQuality).length > 0 && (
          <p className="text-xs text-muted-foreground">
            信源质量：{Object.entries(sourceQuality).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
          </p>
        )}
      </div>
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      <span className="text-primary">{icon}</span>
      <span>{title}</span>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

function InlineLoading({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      {label}
    </span>
  )
}

function NodeCard({ node, onExpand, loading }: { node: InterviewGraphNode; onExpand: () => void; loading: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{node.node_name || '未命名节点'}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{node.node_type || 'node'}{node.organization ? ` · ${node.organization}` : ''}</p>
        </div>
        <button type="button" onClick={onExpand} disabled={loading} className="rounded-lg border border-primary/30 px-2 py-1 text-xs text-primary disabled:opacity-50">
          展开
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{node.why_relevant || '可沿此线索继续扩展访谈网络。'}</p>
    </div>
  )
}

function SignalCard({ signal, verification }: { signal: InterviewGraphSignal; verification?: InterviewGraphVerificationItem }) {
  const layer = signal.value_chain_layer ? (LAYER_LABELS[signal.value_chain_layer] ?? signal.value_chain_layer) : '未分层'
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{layer}</span>
        {signal.signal_grade && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-500">{signal.signal_grade}</span>}
        {signal.consensus_status && <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{signal.consensus_status}</span>}
      </div>
      <p className="mt-3 text-sm font-semibold">{signal.core_claim || '访谈信号'}</p>
      {signal.investment_implication && <p className="mt-1 text-xs text-muted-foreground">{signal.investment_implication}</p>}
      {verification && (
        <p className="mt-2 text-xs text-primary">
          验证：{verification.verification_metric || verification.pass_condition || '待补充指标'}
        </p>
      )}
    </div>
  )
}

function StockCandidateCard({ candidate, onResearch }: { candidate: InterviewGraphStockCandidate; onResearch: () => void }) {
  const ticker = String(candidate.ticker ?? '').trim()
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{candidate.company_name || ticker || '候选公司'}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{ticker || '待补 ticker'} · {candidate.market || 'market'}</p>
        </div>
        {typeof candidate.relevance_score === 'number' && (
          <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{candidate.relevance_score}</span>
        )}
      </div>
      {candidate.rationale && <p className="mt-3 text-xs text-muted-foreground line-clamp-3">{candidate.rationale}</p>}
      {candidate.related_layers?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {candidate.related_layers.map((layer) => (
            <span key={layer} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {LAYER_LABELS[layer] ?? layer}
            </span>
          ))}
        </div>
      ) : null}
      <button type="button" onClick={onResearch} disabled={!ticker} className="mt-4 w-full rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50">
        进入投研工作流
      </button>
    </div>
  )
}
