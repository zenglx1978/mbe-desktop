import { useEffect, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  CheckCircle2,
  FolderKanban,
  Gauge,
  Landmark,
  Lightbulb,
  Loader2,
  Plus,
  Radar,
  Search,
  Target,
  TrendingUp,
} from 'lucide-react'
import { API_BASE, authFetch } from '@/lib/api-client'
import { useToastStore } from '@/components/ToastContainer'
import { useToolStore } from '@/stores/tool-store'

type ApiRecord = Record<string, unknown>

const INVEST_BASE = `${API_BASE}/api/invest`

async function apiGet<T = unknown>(path: string): Promise<T> {
  const resp = await authFetch(`${INVEST_BASE}${path}`)
  return readResponse<T>(resp)
}

async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const resp = await authFetch(`${INVEST_BASE}${path}`, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return readResponse<T>(resp)
}

async function readResponse<T>(resp: Response): Promise<T> {
  const payload = await resp.json().catch(() => ({ detail: resp.statusText })) as T & ApiRecord
  if (!resp.ok) {
    throw new Error(readApiError(payload, resp.statusText || '请求失败'))
  }
  return unwrapData(payload) as T
}

function readApiError(payload: ApiRecord, fallback: string): string {
  const detail = payload.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    const record = detail as ApiRecord
    const message = record.message ?? record.hint ?? record.error
    if (typeof message === 'string') return message
  }
  const error = payload.error
  if (typeof error === 'string') return error
  return fallback
}

function unwrapData(value: unknown): unknown {
  if (value && typeof value === 'object' && 'data' in value) {
    const record = value as ApiRecord
    if (record.data !== undefined) return record.data
  }
  return value
}

function asArray(value: unknown): ApiRecord[] {
  const data = unwrapData(value)
  if (Array.isArray(data)) return data.filter((item): item is ApiRecord => item !== null && typeof item === 'object')
  if (data && typeof data === 'object') {
    const record = data as ApiRecord
    for (const key of ['items', 'results', 'opportunities', 'portfolios', 'predictions', 'funds', 'signals', 'watchlist', 'trackers', 'candidates', 'topics', 'quadrants', 'layers', 'allocations', 'consensus']) {
      const nested = record[key]
      if (Array.isArray(nested)) return nested.filter((item): item is ApiRecord => item !== null && typeof item === 'object')
    }
  }
  return []
}

const NON_TICKER_WORDS = new Set([
  'AI', 'ALPHA', 'CORP', 'INC', 'LTD', 'PLC', 'LLC', 'GROUP', 'HOLDINGS', 'COMPANY',
])

function isTickerCode(value: string) {
  const code = value.trim().toUpperCase()
  if (!code || NON_TICKER_WORDS.has(code)) return false
  return /^[A-Z0-9]{1,6}(\.[A-Z]{1,3})?$/.test(code) || /^\d{6}\.(SH|SZ|BJ|HK)$/.test(code)
}

function normalizeTickerCode(value: string) {
  return value.trim().toUpperCase()
}

function text(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback
  if (Array.isArray(value)) {
    const parts = value.map((item) => text(item, '')).filter(Boolean)
    return parts.length ? parts.slice(0, 4).join('、') : fallback
  }
  if (typeof value === 'object') return objectText(value as ApiRecord, fallback)
  return String(value)
}

function objectText(value: ApiRecord, fallback = '—'): string {
  const label = value.label ?? value.name ?? value.title ?? value.type
  const start = value.start
  const peak = value.peak
  const complete = value.complete
  if (start || peak || complete) {
    return [
      start ? `开始 ${text(start)}` : '',
      peak ? `高峰 ${text(peak)}` : '',
      complete ? `完成 ${text(complete)}` : '',
    ].filter(Boolean).join(' / ') || fallback
  }
  if (label) {
    const detail = value.detail ?? value.count ?? value.status ?? value.required
    return detail === undefined ? text(label, fallback) : `${text(label)}：${text(detail)}`
  }
  const entries = Object.entries(value)
    .filter(([, item]) => item !== null && item !== undefined && item !== '')
    .slice(0, 3)
    .map(([key, item]) => `${key}: ${typeof item === 'object' ? text(item) : String(item)}`)
  return entries.length ? entries.join('；') : fallback
}

function record(value: unknown): ApiRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ApiRecord : null
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => text(item, '')).filter(Boolean)
}

function numberText(value: unknown, fallback = '—'): string {
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString() : fallback
}

function pctText(value: unknown, fallback = '—'): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return `${Math.abs(n) <= 1 ? (n * 100).toFixed(1) : n.toFixed(1)}%`
}

function tickerFromRecord(item: ApiRecord): string {
  const candidates: string[] = []
  function add(code: unknown) {
    if (typeof code === 'string' && isTickerCode(code)) candidates.push(normalizeTickerCode(code))
  }

  add(item.ticker ?? item.symbol ?? item.code ?? item.stock_code)
  const raw = item.related_tickers ?? item.tickers
  if (Array.isArray(raw)) {
    raw.forEach((entry) => {
      if (typeof entry === 'string') add(entry)
      else if (entry && typeof entry === 'object') {
        const record = entry as ApiRecord
        add(record.ticker ?? record.symbol ?? record.code)
      }
    })
  } else if (raw && typeof raw === 'object') {
    Object.entries(raw as ApiRecord).forEach(([key, value]) => {
      add(key)
      if (value && typeof value === 'object') {
        const record = value as ApiRecord
        add(record.ticker ?? record.symbol ?? record.code)
      }
    })
  } else if (typeof raw === 'string') {
    raw.split(/[,，\s]+/).forEach(add)
  }

  const fromTitle = String(item.title ?? item.opportunity_title ?? '').match(/\b[A-Z]{1,6}(?:\.[A-Z]{1,3})?\b/g) ?? []
  fromTitle.forEach(add)
  return [...new Set(candidates)][0] ?? ''
}

function titleFromRecord(item: ApiRecord): string {
  return text(item.title ?? item.opportunity_title ?? item.name ?? item.company_name ?? item.theme ?? item.ticker, '未命名')
}

function marketFromTicker(ticker: string): 'A' | 'HK' | 'US' {
  const normalized = ticker.toUpperCase()
  if (normalized.includes('.HK') || normalized.startsWith('0') && normalized.length === 5) return 'HK'
  if (/^\d{6}(\.(SH|SZ|BJ))?$/.test(normalized)) return 'A'
  return 'US'
}

function PanelShell({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function LoadingBox({ label = '加载中...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card p-8 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" />
      {label}
    </div>
  )
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        {icon ? <span className="text-primary">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-card p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

export function InvestDashboardPanel() {
  const addToast = useToastStore((s) => s.addToast)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bottleneck, setBottleneck] = useState<ApiRecord | null>(null)
  const [fourPillar, setFourPillar] = useState<ApiRecord | null>(null)
  const [metrics, setMetrics] = useState<ApiRecord | null>(null)
  const [scheduler, setScheduler] = useState<ApiRecord | null>(null)
  const [hotTopics, setHotTopics] = useState<ApiRecord[]>([])
  const [chinaQuadrant, setChinaQuadrant] = useState<ApiRecord[]>([])

  async function load() {
    setLoading(true)
    setError('')
    const results = await Promise.allSettled([
      apiGet('/bottleneck/latest'),
      apiGet('/four-pillar/dashboard'),
      apiGet('/four-pillar/paper-loop/metrics'),
      apiGet('/scheduler/status'),
      apiGet('/picker/hot-topics'),
      apiGet('/picker/china-quadrant'),
    ])
    const failed = results.find((item) => item.status === 'rejected')
    if (failed?.status === 'rejected') {
      setError(failed.reason instanceof Error ? failed.reason.message : '效果复盘数据加载失败')
    }
    if (results[0]?.status === 'fulfilled') setBottleneck(results[0].value as ApiRecord)
    if (results[1]?.status === 'fulfilled') setFourPillar(results[1].value as ApiRecord)
    if (results[2]?.status === 'fulfilled') setMetrics(results[2].value as ApiRecord)
    if (results[3]?.status === 'fulfilled') setScheduler(results[3].value as ApiRecord)
    if (results[4]?.status === 'fulfilled') setHotTopics(asArray(results[4].value))
    if (results[5]?.status === 'fulfilled') setChinaQuadrant(asArray(results[5].value))
    setLoading(false)
  }

  async function runSchedulerNow() {
    try {
      await apiPost('/scheduler/paper-loop-mark/run-now')
      addToast('已触发 Paper Loop 立即 Mark。', 'success')
      await load()
    } catch (err) {
      addToast(err instanceof Error ? err.message : '触发失败', 'error')
    }
  }

  useEffect(() => { void load() }, [])

  const metricSource = metrics ?? fourPillar ?? {}
  return (
    <PanelShell title="效果复盘" subtitle="把机会发现、个股决策和 Paper Loop 结果连成闭环。" icon={<BarChart3 className="w-5 h-5" />}>
      {error ? <ErrorBox message={error} /> : null}
      {loading ? <LoadingBox /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Paper Loop 胜率" value={pctText(metricSource.win_rate ?? metricSource.accuracy)} sub="来自四柱复盘指标" icon={<Target className="w-4 h-4" />} />
            <StatCard label="超额收益" value={pctText(metricSource.excess_return_pct ?? metricSource.avg_excess_return)} sub="相对基准表现" icon={<TrendingUp className="w-4 h-4" />} />
            <StatCard label="最大瓶颈" value={text(bottleneck?.max_layer ?? bottleneck?.layer ?? bottleneck?.bottleneck_layer)} sub={text(bottleneck?.pressure_index ?? bottleneck?.score, '压力指数待返回')} icon={<Gauge className="w-4 h-4" />} />
            <StatCard label="调度器" value={text(scheduler?.status ?? scheduler?.state, '未知')} sub={text(scheduler?.last_run_at ?? scheduler?.next_run_at, '等待调度信息')} icon={<CheckCircle2 className="w-4 h-4" />} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">热点主题</h3>
                <button onClick={runSchedulerNow} className="rounded-lg border border-primary/30 px-3 py-1.5 text-xs text-primary hover:bg-primary/10">立即 Mark</button>
              </div>
              {hotTopics.length ? (
                <div className="space-y-2">
                  {hotTopics.slice(0, 8).map((item, index) => (
                    <div key={text(item.id, String(index))} className="flex items-center justify-between gap-3 rounded-lg bg-background/70 p-3">
                      <span className="text-sm font-medium">{titleFromRecord(item)}</span>
                      <span className="text-xs text-muted-foreground">{text(item.score ?? item.heat ?? item.category)}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyBox message="暂无热点主题数据。" />}
            </section>
            <section className="rounded-xl border border-border/60 bg-card p-4">
              <h3 className="text-sm font-semibold mb-3">中国象限 / 四柱归因</h3>
              {chinaQuadrant.length ? (
                <div className="space-y-2">
                  {chinaQuadrant.slice(0, 8).map((item, index) => (
                    <div key={text(item.id, String(index))} className="rounded-lg bg-background/70 p-3">
                      <p className="text-sm font-medium">{titleFromRecord(item)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{text(item.quadrant ?? item.reason ?? item.summary)}</p>
                    </div>
                  ))}
                </div>
              ) : <pre className="whitespace-pre-wrap rounded-lg bg-background/70 p-3 text-xs text-muted-foreground">{JSON.stringify(fourPillar ?? {}, null, 2).slice(0, 1200) || '暂无四柱 dashboard 数据。'}</pre>}
            </section>
          </div>
        </>
      )}
    </PanelShell>
  )
}

const CATEGORIES = ['all', 'bottleneck_shift', 'disruption_alpha', 'asset_revalue']
const CATEGORY_LABELS: Record<string, string> = {
  all: '全部',
  bottleneck_shift: '瓶颈迁移',
  disruption_alpha: '颠覆价差',
  asset_revalue: '资产重估',
}
const SUGGESTED_TOPICS = ['AI 算力供给瓶颈', '机器人产业链', '端侧 AI 换机', '电力资产重估']

export function InvestDiscoveryPanel() {
  const addToast = useToastStore((s) => s.addToast)
  const selectStockAndResearch = useToolStore((s) => s.selectStockAndResearch)
  const [category, setCategory] = useState('all')
  const [keywords, setKeywords] = useState('')
  const [items, setItems] = useState<ApiRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadList(nextCategory = category) {
    setLoading(true)
    setError('')
    try {
      const params = nextCategory === 'all' ? '?limit=20' : `?category=${encodeURIComponent(nextCategory)}&limit=20`
      setItems(asArray(await apiGet(`/discovery/opportunities${params}`)))
    } catch (err) {
      setError(err instanceof Error ? err.message : '机会池加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function searchTopic(topic = keywords) {
    if (!topic.trim()) return
    setLoading(true)
    setError('')
    try {
      const payload = { keywords: topic.trim(), category: category === 'all' ? undefined : category }
      setItems(asArray(await apiPost('/discovery/search', payload)))
    } catch (err) {
      setError(err instanceof Error ? err.message : '机会搜索失败')
    } finally {
      setLoading(false)
    }
  }

  async function refreshLoop() {
    setLoading(true)
    try {
      const result = await apiPost('/discovery/research-loop/refresh', {
        keywords: keywords.trim() || 'AI 产业链机会',
        category: category === 'all' ? undefined : category,
        external_sources: ['rss'],
        include_existing_sources: true,
        limit: 8,
      })
      const refreshed = asArray(result)
      if (refreshed.length) setItems(refreshed)
      addToast(`研究机会已刷新：${numberText((result as ApiRecord).total ?? refreshed.length)} 条`, 'success')
      await loadList()
    } catch (err) {
      addToast(err instanceof Error ? err.message : '刷新研究机会失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadList(category) }, [category])

  return (
    <PanelShell title="机会池" subtitle="先发现主题和标的，再进入个股研究与 Paper Loop 验证。" icon={<Lightbulb className="w-5 h-5" />}>
      {error ? <ErrorBox message={error} /> : null}
      <section className="rounded-xl border border-primary/20 bg-card p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_TOPICS.map((topic) => (
            <button key={topic} onClick={() => { setKeywords(topic); void searchTopic(topic) }} className="rounded-full bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/15">
              {topic}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 flex-1 rounded-lg border border-border bg-background px-3">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void searchTopic()} placeholder="输入主题，如 AI 算力替代、新能源瓶颈" className="flex-1 bg-transparent py-2 text-sm outline-none" />
          </div>
          <button onClick={() => void searchTopic()} disabled={!keywords.trim() || loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {loading ? '搜索中...' : '发现机会'}
          </button>
          <button onClick={refreshLoop} disabled={loading} className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50">
            刷新研究机会
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((item) => (
            <button key={item} onClick={() => setCategory(item)} className={`rounded-full px-3 py-1 text-xs ${category === item ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {CATEGORY_LABELS[item] ?? item}
            </button>
          ))}
        </div>
      </section>
      {loading ? <LoadingBox label="机会池加载中..." /> : items.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item, index) => {
            const ticker = tickerFromRecord(item)
            return (
              <article key={text(item.id, String(index))} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold">{titleFromRecord(item)}</h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{text(item.confidence_level ?? item.confidence ?? item.category, '待验证')}</span>
                </div>
                <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{text(item.description ?? item.hypothesis ?? item.thesis, '系统识别到该主题可能存在结构性变化。')}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">相关标的：{ticker || text(item.related_tickers ?? item.tickers, '待挖掘')}</span>
                  {ticker ? (
                    <button onClick={() => selectStockAndResearch({ ticker, name: titleFromRecord(item), market: marketFromTicker(ticker) })} className="rounded-lg border border-primary/30 px-2.5 py-1 text-xs text-primary">
                      进入选股流程
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      ) : <EmptyBox message="暂无机会。输入关键词或点击上方主题生成机会池。" />}
    </PanelShell>
  )
}

function getHoldingCount(portfolio: ApiRecord) {
  const explicitCount = Number(portfolio.holdings_count)
  if (Number.isFinite(explicitCount) && explicitCount > 0) return explicitCount
  return Array.isArray(portfolio.holdings) ? portfolio.holdings.length : 0
}

export function InvestPortfolioPanel() {
  const addToast = useToastStore((s) => s.addToast)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState('')
  const [portfolios, setPortfolios] = useState<ApiRecord[]>([])
  const [suggestion, setSuggestion] = useState<ApiRecord | null>(null)
  const [form, setForm] = useState({ name: '', strategy: 'long_short', risk_level: 'moderate', initial_capital: '' })

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await apiGet('/portfolio')
      const next = asArray(data)
      setPortfolios(next)
      const totalHoldings = next.reduce((sum, item) => sum + getHoldingCount(item), 0)
      if (totalHoldings > 0) {
        setSuggestion(await apiPost<ApiRecord>('/portfolio/suggest', { strategy: 'long_short', risk_level: 'moderate' }))
      } else {
        setSuggestion(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '投资组合加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function create() {
    if (!form.name.trim()) return
    setCreating(true)
    try {
      await apiPost('/portfolio', {
        name: form.name.trim(),
        strategy: form.strategy,
        risk_level: form.risk_level,
        initial_capital: form.initial_capital ? Number(form.initial_capital) : undefined,
      })
      addToast('组合已创建。', 'success')
      setShowCreate(false)
      setForm({ name: '', strategy: 'long_short', risk_level: 'moderate', initial_capital: '' })
      await load()
    } catch (err) {
      addToast(err instanceof Error ? err.message : '组合创建失败', 'error')
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => { void load() }, [])

  const longSuggestions = asArray(suggestion?.long_positions ?? suggestion?.long)
  const shortSuggestions = asArray(suggestion?.short_positions ?? suggestion?.short)

  return (
    <PanelShell title="组合参考" subtitle="读取真实组合和持仓建议，让机会与研究结果进入组合层。" icon={<FolderKanban className="w-5 h-5" />}>
      {error ? <ErrorBox message={error} /> : null}
      <div className="flex justify-end">
        <button onClick={() => setShowCreate((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="w-4 h-4" /> 新建组合
        </button>
      </div>
      {showCreate ? (
        <section className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="组合名称" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={form.initial_capital} onChange={(e) => setForm((p) => ({ ...p, initial_capital: e.target.value }))} type="number" placeholder="初始资金" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <select value={form.strategy} onChange={(e) => setForm((p) => ({ ...p, strategy: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="long_short">多空对冲</option>
              <option value="long_only">纯多头</option>
              <option value="short_only">纯空头</option>
              <option value="market_neutral">市场中性</option>
            </select>
            <select value={form.risk_level} onChange={(e) => setForm((p) => ({ ...p, risk_level: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="conservative">保守</option>
              <option value="moderate">稳健</option>
              <option value="aggressive">激进</option>
            </select>
          </div>
          <button onClick={create} disabled={!form.name.trim() || creating} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {creating ? '创建中...' : '创建'}
          </button>
        </section>
      ) : null}
      {loading ? <LoadingBox /> : (
        <>
          {suggestion ? (
            <section className="rounded-xl border border-primary/20 bg-card p-4">
              <h3 className="text-sm font-semibold text-primary">AI 组合建议</h3>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <SuggestionList title="多头 / 继续持有" items={longSuggestions} tone="green" />
                <SuggestionList title="空头 / 降仓防御" items={shortSuggestions} tone="red" />
              </div>
            </section>
          ) : null}
          {portfolios.length ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {portfolios.map((item, index) => (
                <article key={text(item.id, String(index))} className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold">{titleFromRecord(item)}</h3>
                    <span className="text-xs text-muted-foreground">{text(item.strategy)}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>风险：<b className="text-foreground">{text(item.risk_level)}</b></span>
                    <span>持仓：<b className="text-foreground">{getHoldingCount(item)}</b></span>
                    <span>资金：<b className="text-foreground">{numberText(item.initial_capital ?? item.capital)}</b></span>
                    <span>状态：<b className="text-foreground">{text(item.status, 'active')}</b></span>
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyBox message="暂无组合。先新建组合，再把研究结论沉淀为持仓。" />}
        </>
      )}
    </PanelShell>
  )
}

function SuggestionList({ title, items, tone }: { title: string; items: ApiRecord[]; tone: 'green' | 'red' }) {
  const cls = tone === 'green' ? 'text-green-500' : 'text-red-500'
  return (
    <div className="rounded-lg bg-background/70 p-3">
      <p className={`text-xs font-semibold ${cls}`}>{title}</p>
      {items.length ? (
        <div className="mt-2 space-y-1.5">
          {items.slice(0, 5).map((item, index) => (
            <div key={text(item.ticker ?? item.theme, String(index))} className="flex items-center justify-between gap-2 text-xs">
              <span className="font-mono">{text(item.ticker ?? item.theme ?? item.name)}</span>
              <span className="text-muted-foreground">{text(item.weight_pct ?? item.reason ?? item.action)}</span>
            </div>
          ))}
        </div>
      ) : <p className="mt-2 text-xs text-muted-foreground">暂无建议。</p>}
    </div>
  )
}

export function InvestRiskPanel() {
  const [view, setView] = useState<'assess' | 'shorts' | 'longs'>('assess')
  const [target, setTarget] = useState('NVIDIA')
  const [ticker, setTicker] = useState('NVDA')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [assessment, setAssessment] = useState<ApiRecord | null>(null)
  const [shortSignals, setShortSignals] = useState<ApiRecord[]>([])
  const [shortCandidates, setShortCandidates] = useState<ApiRecord[]>([])
  const [longOpportunities, setLongOpportunities] = useState<ApiRecord[]>([])

  async function assess() {
    setLoading(true)
    setError('')
    setAssessment(null)
    try {
      setAssessment(await apiPost<ApiRecord>('/disruption/assess', { target_name: target, target_type: 'company', ticker: ticker || undefined }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '颠覆评估失败')
    } finally {
      setLoading(false)
    }
  }

  async function loadLists() {
    setLoading(true)
    setError('')
    const results = await Promise.allSettled([
      apiGet('/shorts/signals'),
      apiGet('/disruption/short-candidates'),
      apiGet('/disruption/long-opportunities'),
    ])
    if (results[0]?.status === 'fulfilled') setShortSignals(asArray(results[0].value))
    if (results[1]?.status === 'fulfilled') setShortCandidates(asArray(results[1].value))
    if (results[2]?.status === 'fulfilled') setLongOpportunities(asArray(results[2].value))
    const failed = results.find((item) => item.status === 'rejected')
    if (failed?.status === 'rejected') setError(failed.reason instanceof Error ? failed.reason.message : '风险数据加载失败')
    setLoading(false)
  }

  useEffect(() => { void loadLists() }, [])

  const riskValidation = record(assessment?.risk_validation)
  const positionGuardrails = record(riskValidation?.position_guardrails)
  const validationItems = Array.isArray(riskValidation?.validation_items)
    ? riskValidation.validation_items.filter((item): item is ApiRecord => item !== null && typeof item === 'object')
    : []

  return (
    <PanelShell title="风险验证" subtitle="综合验证 AI 颠覆、估值、产业链、政策和财务兑现风险，不把单一分数当成买卖依据。" icon={<Radar className="w-5 h-5" />}>
      {error ? <ErrorBox message={error} /> : null}
      <div className="flex flex-wrap gap-2">
        {[
          ['assess', '综合验证'],
          ['shorts', '风险/做空'],
          ['longs', '做多机会'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setView(id as 'assess' | 'shorts' | 'longs')} className={`rounded-full px-3 py-1.5 text-xs ${view === id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {label}
          </button>
        ))}
      </div>
      {view === 'assess' ? (
        <section className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-3">
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="公司/业务名称" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="Ticker" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <button onClick={assess} disabled={!target.trim() || loading} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">评估</button>
          </div>
          {loading ? <LoadingBox label="评估中..." /> : assessment ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <StatCard label="综合结论" value={text(riskValidation?.overall_status ?? assessment.verdict ?? '待验证')} sub={text(riskValidation?.summary ?? assessment.reasoning ?? assessment.summary)} icon={<CheckCircle2 className="w-4 h-4" />} />
                <StatCard label="AI 颠覆风险" value={`${numberText(assessment.disruption_score ?? assessment.score)}/100`} sub="仅代表被 AI 替代风险，不代表股票综合风险" icon={<Radar className="w-4 h-4" />} />
                <StatCard label="仓位约束" value={pctText(positionGuardrails?.suggested_max_position)} sub={text(positionGuardrails?.stop_loss_reference ?? '按风险验证结果控制仓位')} />
              </div>
              {validationItems.length ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {validationItems.map((item, index) => (
                    <RiskValidationCard key={text(item.category ?? item.label, String(index))} item={item} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-500">
                  当前后端尚未返回综合风险验证结构，仅显示旧版颠覆评估字段。
                </div>
              )}
            </div>
          ) : <EmptyBox message="输入标的后评估 AI 颠覆风险。" />}
        </section>
      ) : view === 'shorts' ? (
        <RiskList items={[...shortCandidates, ...shortSignals]} empty="暂无做空/风险信号。" />
      ) : (
        <RiskList items={longOpportunities} empty="暂无做多机会。" />
      )}
    </PanelShell>
  )
}

function RiskValidationCard({ item }: { item: ApiRecord }) {
  const status = text(item.status)
  const severity = text(item.severity)
  const metrics = stringList(item.key_metrics)
  const questions = stringList(item.verification_questions)
  const evidence = Array.isArray(item.evidence_sources)
    ? item.evidence_sources.map(evidenceSourceText).filter(Boolean)
    : stringList(item.sources)
  return (
    <article className="rounded-xl border border-border/60 bg-background/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{text(item.label ?? item.category)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{text(item.conclusion)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(status)}`}>{status}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] ${severityClass(severity)}`}>{severity}</span>
        </div>
      </div>
      {metrics.length ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-muted-foreground">验证指标</p>
          <ul className="mt-1 space-y-1 text-xs text-foreground/85">
            {metrics.slice(0, 5).map((metric) => <li key={metric}>• {metric}</li>)}
          </ul>
        </div>
      ) : null}
      {questions.length ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-muted-foreground">需要回答的问题</p>
          <ul className="mt-1 space-y-1 text-xs text-foreground/85">
            {questions.slice(0, 3).map((question) => <li key={question}>• {question}</li>)}
          </ul>
        </div>
      ) : null}
      {evidence.length ? (
        <div className="mt-3 rounded-lg bg-card px-3 py-2">
          <p className="text-[11px] font-semibold text-muted-foreground">证据来源</p>
          <p className="mt-1 text-xs text-muted-foreground">{evidence.slice(0, 4).join('；')}</p>
        </div>
      ) : null}
    </article>
  )
}

function evidenceSourceText(source: unknown): string {
  const sourceRecord = record(source)
  if (!sourceRecord) return text(source, '')
  const name = text(sourceRecord.name ?? sourceRecord.type, '')
  const detail = text(sourceRecord.detail ?? sourceRecord.pattern ?? sourceRecord.updated ?? sourceRecord.count, '')
  const required = sourceRecord.required === true ? '必需复核' : ''
  return [name, detail, required].filter(Boolean).join(' · ')
}

function statusClass(status: string) {
  if (status.includes('警报')) return 'bg-red-500/10 text-red-500'
  if (status.includes('通过')) return 'bg-green-500/10 text-green-500'
  return 'bg-amber-500/10 text-amber-500'
}

function severityClass(severity: string) {
  if (severity === 'critical' || severity === 'high') return 'bg-red-500/10 text-red-500'
  if (severity === 'medium') return 'bg-amber-500/10 text-amber-500'
  return 'bg-muted text-muted-foreground'
}

function RiskList({ items, empty }: { items: ApiRecord[]; empty: string }) {
  if (!items.length) return <EmptyBox message={empty} />
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.slice(0, 12).map((item, index) => (
        <article key={text(item.id ?? item.ticker, String(index))} className="rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold">{titleFromRecord(item)}</h3>
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-500">{text(item.signal_type ?? item.strength ?? item.score, 'signal')}</span>
          </div>
          <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{text(item.reason ?? item.rationale ?? item.summary ?? item.description)}</p>
        </article>
      ))}
    </div>
  )
}

export function InvestInstitutionPredictionPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [funds, setFunds] = useState<ApiRecord[]>([])
  const [consensus, setConsensus] = useState<ApiRecord[]>([])
  const [layers, setLayers] = useState<ApiRecord[]>([])
  const [predictions, setPredictions] = useState<ApiRecord[]>([])
  const [accuracy, setAccuracy] = useState<ApiRecord | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    const results = await Promise.allSettled([
      apiGet('/funds/13f'),
      apiGet('/funds/13f/consensus'),
      apiGet('/funds/13f/layers'),
      apiGet('/predictions?limit=30'),
      apiGet('/predictions/accuracy'),
    ])
    if (results[0]?.status === 'fulfilled') setFunds(asArray(results[0].value))
    if (results[1]?.status === 'fulfilled') setConsensus(asArray(results[1].value))
    if (results[2]?.status === 'fulfilled') setLayers(asArray(results[2].value))
    if (results[3]?.status === 'fulfilled') setPredictions(asArray(results[3].value))
    if (results[4]?.status === 'fulfilled') setAccuracy(results[4].value as ApiRecord)
    const failed = results.find((item) => item.status === 'rejected')
    if (failed?.status === 'rejected') setError(failed.reason instanceof Error ? failed.reason.message : '机构/预测数据加载失败')
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  return (
    <PanelShell title="机构/预测" subtitle="把 13F 机构持仓、共识信号和预测准确率放到验证层。" icon={<Landmark className="w-5 h-5" />}>
      {error ? <ErrorBox message={error} /> : null}
      {loading ? <LoadingBox /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="机构记录" value={numberText(funds.length)} sub="13F / 披露列表" icon={<Briefcase className="w-4 h-4" />} />
            <StatCard label="共识信号" value={numberText(consensus.length)} sub="多空共识" icon={<TrendingUp className="w-4 h-4" />} />
            <StatCard label="预测准确率" value={pctText(accuracy?.accuracy ?? accuracy?.overall_accuracy)} sub={`${numberText(accuracy?.verified_count)} 已验证`} icon={<Target className="w-4 h-4" />} />
            <StatCard label="产业层级" value={numberText(layers.length)} sub="持仓分布" icon={<BarChart3 className="w-4 h-4" />} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RecordList title="机构持仓" items={funds} />
            <RecordList title="预测追踪" items={predictions} />
            <RecordList title="机构共识" items={consensus} />
            <RecordList title="产业链分布" items={layers} />
          </div>
        </>
      )}
    </PanelShell>
  )
}

function RecordList({ title, items }: { title: string; items: ApiRecord[] }) {
  return (
    <section className="rounded-xl border border-border/60 bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {items.length ? (
        <div className="space-y-2">
          {items.slice(0, 8).map((item, index) => (
            <div key={text(item.id ?? item.ticker ?? item.name, String(index))} className="rounded-lg bg-background/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{titleFromRecord(item)}</p>
                <span className="text-xs text-muted-foreground">{text(item.ticker ?? item.status ?? item.weight_pct ?? item.allocation_pct)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{text(item.reason ?? item.summary ?? item.signal ?? item.description ?? item.thesis)}</p>
            </div>
          ))}
        </div>
      ) : <EmptyBox message={`${title}暂无数据。`} />}
    </section>
  )
}
