import { useState, useEffect, useCallback } from 'react'
import {
  Target, RefreshCw, Plus, Trophy, ChevronDown, ChevronUp,
  Building2, Users, TrendingDown, Cpu, Puzzle, Database, Wrench,
  ArrowRight, CheckCircle2, XCircle, Search,
} from 'lucide-react'
import { authFetch, API_BASE, isElectron } from '@/lib/api-client'

/* ── 类型定义 ────────────────────────────────────────── */

interface TargetScorecard {
  target_id: string
  company_name: string
  solution_id: string
  d1_decline: number
  d2_clients: number
  d3_ai_potential: number
  d4_solution_fit: number
  d5_data_assets: number
  d6_integration: number
  total_score: number
  grade: string
  estimated_valuation_wan: number
  valuation_multiple: string
  verdict: string
  key_risks: string[]
  action_items: string[]
  rollup_ready: boolean
}

interface TargetInput {
  company_name: string
  solution_id: string
  industry: string
  city: string
  founded_year: number
  founder_age: number
  employee_count: number
  annual_revenue_wan: number
  revenue_growth_yoy: number
  ebitda_wan: number
  profit_margin: number
  client_count: number
  avg_client_arpu_wan: number
  client_retention_rate: number
  top3_client_concentration: number
  has_license: boolean
  license_detail: string
  has_digital_system: boolean
  source_system: string
  data_years: number
  seller_motivation: string
  asking_price_wan: number
  notes: string
}

interface TargetRecord {
  target_id: string
  input: TargetInput
  scorecard: TargetScorecard | null
  status: string
  created_at: string
}

interface LeaderboardItem {
  rank: number
  target_id: string
  company_name: string
  solution_id: string
  solution_name: string
  score: number
  grade: string
  estimated_valuation_wan: number
  rollup_ready: boolean
  verdict: string
}

interface Profile {
  solution_name: string
  ideal_target: string
  client_range: [number, number]
  valuation_range_wan: [number, number]
  valuation_multiple: string
  key_assets: string[]
  rollup_priority: string
}

/* ── 常量 ────────────────────────────────────────────── */

const SOLUTIONS = [
  { id: 'finance-tax-service', label: '财税服务' },
  { id: 'law-firm', label: '律所运营' },
  { id: 'labor-dispatch', label: '劳务派遣' },
  { id: 'construction-cost', label: '工程造价' },
  { id: 'ecommerce-brand-service', label: '品牌电商' },
  { id: 'insurance-operations', label: '保险运营' },
  { id: 'smb-operations', label: '中小企业' },
  { id: 'clinic-respiratory', label: '呼吸专科' },
  { id: 'study-abroad-consulting', label: '留学咨询' },
  { id: 'education-training', label: '教育培训' },
  { id: 'investment-research', label: '投研机构' },
]

const MOTIVATIONS = [
  { value: 'retirement', label: '退休' },
  { value: 'burnout', label: '疲惫' },
  { value: 'financial', label: '资金困难' },
  { value: 'pivot', label: '转型' },
  { value: 'unknown', label: '未知' },
]

const GRADE_STYLES: Record<string, string> = {
  S: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  A: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  B: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  C: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  D: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

const EMPTY_FORM: TargetInput = {
  company_name: '', solution_id: 'finance-tax-service', industry: '', city: '',
  founded_year: 0, founder_age: 0, employee_count: 0,
  annual_revenue_wan: 0, revenue_growth_yoy: 0, ebitda_wan: 0, profit_margin: 0,
  client_count: 0, avg_client_arpu_wan: 0, client_retention_rate: 0, top3_client_concentration: 0,
  has_license: false, license_detail: '', has_digital_system: false, source_system: '',
  data_years: 0, seller_motivation: 'unknown', asking_price_wan: 0, notes: '',
}

/* ── 主组件 ──────────────────────────────────────────── */

type ViewMode = 'leaderboard' | 'form' | 'profiles'

export default function ScoutPanel() {
  const [view, setView] = useState<ViewMode>('leaderboard')
  const [loading, setLoading] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [form, setForm] = useState<TargetInput>({ ...EMPTY_FORM })
  const [lastResult, setLastResult] = useState<TargetRecord | null>(null)
  const [expandedTarget, setExpandedTarget] = useState<string | null>(null)
  const [filterSolution, setFilterSolution] = useState<string>('')

  const fetchLeaderboard = useCallback(async () => {
    if (!isElectron()) return
    setLoading(true)
    try {
      const url = filterSolution
        ? `${API_BASE}/api/v1/scout/leaderboard?top_n=50&solution_id=${filterSolution}`
        : `${API_BASE}/api/v1/scout/leaderboard?top_n=50`
      const resp = await authFetch(url)
      if (resp.ok) {
        const data = await resp.json()
        setLeaderboard(data.leaderboard || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [filterSolution])

  const fetchProfiles = useCallback(async () => {
    if (!isElectron()) return
    try {
      const resp = await authFetch(`${API_BASE}/api/v1/scout/profiles`)
      if (resp.ok) setProfiles(await resp.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchLeaderboard() }, [fetchLeaderboard])
  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  const submitTarget = async () => {
    if (!form.company_name.trim()) return
    setLoading(true)
    try {
      const resp = await authFetch(`${API_BASE}/api/v1/scout/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (resp.ok) {
        const rec: TargetRecord = await resp.json()
        setLastResult(rec)
        setView('leaderboard')
        fetchLeaderboard()
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  const pushToRollup = async (targetId: string) => {
    try {
      const resp = await authFetch(`${API_BASE}/api/v1/scout/targets/${targetId}/to-rollup`, {
        method: 'POST',
      })
      if (resp.ok) fetchLeaderboard()
    } catch { /* ignore */ }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Acquisition Scout</span>
          <span className="text-xs text-muted-foreground">标的发现与评分</span>
        </div>
        <div className="flex items-center gap-1">
          {(['leaderboard', 'form', 'profiles'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                view === v ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v === 'leaderboard' ? '排行榜' : v === 'form' ? '录入标的' : '标的画像'}
            </button>
          ))}
          <button
            onClick={fetchLeaderboard}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-muted transition-colors ml-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ── 评分结果弹窗 ── */}
        {lastResult?.scorecard && (
          <ScorecardBanner
            scorecard={lastResult.scorecard}
            onDismiss={() => setLastResult(null)}
            onRollup={() => {
              pushToRollup(lastResult.target_id)
              setLastResult(null)
            }}
          />
        )}

        {/* ── 排行榜视图 ── */}
        {view === 'leaderboard' && (
          <>
            {/* 方案过滤 */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setFilterSolution('')}
                className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                  !filterSolution ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                全部
              </button>
              {SOLUTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setFilterSolution(s.id === filterSolution ? '' : s.id)}
                  className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                    filterSolution === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {leaderboard.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>暂无候选标的</p>
                <p className="text-xs mt-1">点击「录入标的」开始评估</p>
                <button
                  onClick={() => setView('form')}
                  className="mt-3 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-3 h-3 inline mr-1" />录入标的
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((item) => (
                  <LeaderboardCard
                    key={item.target_id}
                    item={item}
                    expanded={expandedTarget === item.target_id}
                    onToggle={() => setExpandedTarget(
                      expandedTarget === item.target_id ? null : item.target_id,
                    )}
                    onRollup={() => pushToRollup(item.target_id)}
                  />
                ))}
              </div>
            )}

            {/* 底部快捷入口 */}
            {leaderboard.length > 0 && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => setView('form')}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> 录入新标的
                </button>
              </div>
            )}
          </>
        )}

        {/* ── 录入表单视图 ── */}
        {view === 'form' && (
          <TargetForm
            form={form}
            onChange={setForm}
            onSubmit={submitTarget}
            onCancel={() => { setForm({ ...EMPTY_FORM }); setView('leaderboard') }}
            loading={loading}
            profiles={profiles}
          />
        )}

        {/* ── 标的画像视图 ── */}
        {view === 'profiles' && <ProfilesView profiles={profiles} onPickSolution={(sid) => {
          setForm({ ...EMPTY_FORM, solution_id: sid })
          setView('form')
        }} />}
      </div>
    </div>
  )
}

/* ── 评分结果横幅 ─────────────────────────────────── */

function ScorecardBanner({
  scorecard: sc, onDismiss, onRollup,
}: { scorecard: TargetScorecard; onDismiss: () => void; onRollup: () => void }) {
  return (
    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${GRADE_STYLES[sc.grade] || ''}`}>
            {sc.grade}
          </span>
          <span className="font-semibold text-sm">{sc.company_name}</span>
          <span className="text-xl font-bold text-primary">{sc.total_score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-6 gap-2 text-center">
        {[
          { label: '衰退度', val: sc.d1_decline, max: 20, icon: TrendingDown },
          { label: '客户', val: sc.d2_clients, max: 20, icon: Users },
          { label: 'AI潜力', val: sc.d3_ai_potential, max: 20, icon: Cpu },
          { label: '契合度', val: sc.d4_solution_fit, max: 20, icon: Puzzle },
          { label: '数据', val: sc.d5_data_assets, max: 10, icon: Database },
          { label: '整合', val: sc.d6_integration, max: 10, icon: Wrench },
        ].map(({ label, val, max, icon: Icon }) => (
          <div key={label} className="space-y-1">
            <Icon className="w-3 h-3 mx-auto text-muted-foreground" />
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-sm font-semibold">{val}/{max}</div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(val / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm">{sc.verdict}</p>

      {sc.rollup_ready && (
        <button
          onClick={onRollup}
          className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
        >
          推送到 Roll-up 批量导入 <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

/* ── 排行榜卡片 ──────────────────────────────────── */

function LeaderboardCard({
  item, expanded, onToggle, onRollup,
}: { item: LeaderboardItem; expanded: boolean; onToggle: () => void; onRollup: () => void }) {
  return (
    <div className="rounded-lg border hover:border-primary/30 transition-colors">
      <button onClick={onToggle} className="w-full p-3 flex items-center gap-3 text-left">
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold">
          {item.rank <= 3 ? <Trophy className={`w-3.5 h-3.5 ${
            item.rank === 1 ? 'text-yellow-500' : item.rank === 2 ? 'text-gray-400' : 'text-orange-400'
          }`} /> : item.rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{item.company_name}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${GRADE_STYLES[item.grade] || ''}`}>
              {item.grade}
            </span>
            {item.rollup_ready && (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
            <span>{item.solution_name}</span>
            <span>·</span>
            <span>{item.score} 分</span>
            <span>·</span>
            <span>估值 {item.estimated_valuation_wan} 万</span>
          </div>
        </div>

        {expanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-2 border-t">
          <p className="text-sm text-muted-foreground pt-2">{item.verdict}</p>
          {item.rollup_ready && (
            <button
              onClick={(e) => { e.stopPropagation(); onRollup() }}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs hover:opacity-90 transition-opacity flex items-center gap-1"
            >
              推送到 Roll-up <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── 录入表单 ────────────────────────────────────── */

function TargetForm({
  form, onChange, onSubmit, onCancel, loading, profiles,
}: {
  form: TargetInput
  onChange: (f: TargetInput) => void
  onSubmit: () => void
  onCancel: () => void
  loading: boolean
  profiles: Record<string, Profile>
}) {
  const set = <K extends keyof TargetInput>(k: K, v: TargetInput[K]) =>
    onChange({ ...form, [k]: v })

  const profile = profiles[form.solution_id]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Plus className="w-4 h-4 text-primary" />
        <span className="font-medium text-sm">录入候选收购标的</span>
      </div>

      {/* 方案选择 + 画像提示 */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">目标方案</label>
        <select
          value={form.solution_id}
          onChange={(e) => set('solution_id', e.target.value)}
          className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
        >
          {SOLUTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        {profile && (
          <div className="rounded-lg bg-muted/50 p-2.5 text-xs space-y-1">
            <div className="font-medium text-foreground">理想标的：{profile.ideal_target}</div>
            <div className="text-muted-foreground">
              客户范围 {profile.client_range[0]}-{profile.client_range[1]} · 估值 {profile.valuation_range_wan[0]}-{profile.valuation_range_wan[1]} 万 · {profile.valuation_multiple}
            </div>
          </div>
        )}
      </div>

      {/* 基本信息 */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Building2 className="w-3 h-3" /> 基本信息
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="公司名称 *" value={form.company_name} onChange={(v) => set('company_name', v)} />
          <FormField label="行业细分" value={form.industry} onChange={(v) => set('industry', v)} />
          <FormField label="城市" value={form.city} onChange={(v) => set('city', v)} />
          <FormNum label="成立年份" value={form.founded_year} onChange={(v) => set('founded_year', v)} />
          <FormNum label="创始人年龄" value={form.founder_age} onChange={(v) => set('founder_age', v)} />
          <FormNum label="员工人数" value={form.employee_count} onChange={(v) => set('employee_count', v)} />
        </div>
      </fieldset>

      {/* 财务指标 */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <TrendingDown className="w-3 h-3" /> 财务指标
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <FormNum label="年营收（万元）" value={form.annual_revenue_wan} onChange={(v) => set('annual_revenue_wan', v)} step={10} />
          <FormNum label="营收同比增长率" value={form.revenue_growth_yoy} onChange={(v) => set('revenue_growth_yoy', v)} step={0.01} hint="如 -0.15 表示下降 15%" />
          <FormNum label="EBITDA（万元）" value={form.ebitda_wan} onChange={(v) => set('ebitda_wan', v)} step={5} />
          <FormNum label="净利润率" value={form.profit_margin} onChange={(v) => set('profit_margin', v)} step={0.01} />
          <FormNum label="要价（万元）" value={form.asking_price_wan} onChange={(v) => set('asking_price_wan', v)} step={10} />
        </div>
      </fieldset>

      {/* 客户基础 */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Users className="w-3 h-3" /> 客户基础
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <FormNum label="客户数量" value={form.client_count} onChange={(v) => set('client_count', v)} />
          <FormNum label="客均年营收（万元）" value={form.avg_client_arpu_wan} onChange={(v) => set('avg_client_arpu_wan', v)} step={0.1} />
          <FormNum label="客户年留存率 (0-1)" value={form.client_retention_rate} onChange={(v) => set('client_retention_rate', v)} step={0.05} />
          <FormNum label="前3大客户占比 (0-1)" value={form.top3_client_concentration} onChange={(v) => set('top3_client_concentration', v)} step={0.05} />
        </div>
      </fieldset>

      {/* 资质与系统 */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Database className="w-3 h-3" /> 资质与数据
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <FormCheck label="持有行业资质/牌照" checked={form.has_license} onChange={(v) => set('has_license', v)} />
          <FormField label="资质详情" value={form.license_detail} onChange={(v) => set('license_detail', v)} />
          <FormCheck label="有数字化系统" checked={form.has_digital_system} onChange={(v) => set('has_digital_system', v)} />
          <FormField label="系统名称" value={form.source_system} onChange={(v) => set('source_system', v)} placeholder="如 kingdee_kis" />
          <FormNum label="数据积累年数" value={form.data_years} onChange={(v) => set('data_years', v)} />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">出售动机</label>
            <select
              value={form.seller_motivation}
              onChange={(e) => set('seller_motivation', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
            >
              {MOTIVATIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <FormField label="备注" value={form.notes} onChange={(v) => set('notes', v)} />
      </fieldset>

      {/* 操作按钮 */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onSubmit}
          disabled={loading || !form.company_name.trim()}
          className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          评估标的
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  )
}

/* ── 标的画像视图 ─────────────────────────────────── */

function ProfilesView({
  profiles, onPickSolution,
}: { profiles: Record<string, Profile>; onPickSolution: (sid: string) => void }) {
  if (!Object.keys(profiles).length) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-30" />
        加载中...
      </div>
    )
  }

  const priorityOrder = ['S', 'A', 'B', 'C']

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="w-4 h-4 text-primary" />
        <span className="font-medium text-sm">11 个行业方案理想收购标的</span>
      </div>
      {Object.entries(profiles)
        .sort(([, a], [, b]) => priorityOrder.indexOf(a.rollup_priority) - priorityOrder.indexOf(b.rollup_priority))
        .map(([sid, p]) => (
          <div key={sid} className="rounded-lg border p-3 hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${GRADE_STYLES[p.rollup_priority] || 'bg-muted'}`}>
                  {p.rollup_priority}
                </span>
                <span className="font-medium text-sm">{p.solution_name}</span>
              </div>
              <button
                onClick={() => onPickSolution(sid)}
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                录入标的 <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">{p.ideal_target}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
              <span>客户 {p.client_range[0]}-{p.client_range[1]}</span>
              <span>·</span>
              <span>估值 {p.valuation_range_wan[0]}-{p.valuation_range_wan[1]} 万</span>
              <span>·</span>
              <span>{p.valuation_multiple}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {p.key_assets.map((a) => (
                <span key={a} className="px-2 py-0.5 rounded-full bg-muted text-xs">{a}</span>
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}

/* ── 表单原子组件 ─────────────────────────────────── */

function FormField({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
      />
    </div>
  )
}

function FormNum({
  label, value, onChange, step = 1, hint,
}: { label: string; value: number; onChange: (v: number) => void; step?: number; hint?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        step={step}
        className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
      />
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  )
}

function FormCheck({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-2"
      />
      <label className="text-sm">{label}</label>
    </div>
  )
}
