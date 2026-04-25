/**
 * IPO 准备面板 — 板块评估 / 项目管理 / 合规自检 / 招股书 / 尽调清单 / 股权架构图
 *
 * 对接 /api/finance/ipo/...
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Plus, ChevronRight, BarChart3, CheckSquare, FileText,
  Download, Loader2, RefreshCw, AlertCircle, CheckCircle2,
  ArrowLeft, TrendingUp, ClipboardList, Search, Play,
  Building2, Users, Sparkles, ShieldCheck, Info,
} from 'lucide-react'
import type { SolutionConfig } from '@/lib/solution-router'
import { API_BASE, authHeaders } from '@/lib/api-client'

interface Props {
  solution: SolutionConfig
}

// ── 类型定义 ───────────────────────────────────────────────────────────────

interface IPOProject {
  id: string
  name: string
  company_name?: string
  target_board: string
  status: string
  sponsor?: string
  auditor?: string
  lawyer?: string
  created_at?: string
}

interface BoardResult {
  board: string
  board_label: string
  eligible: boolean
  met_conditions: string[]
  unmet_conditions: string[]
  recommendation: string
}

interface ComplianceItem {
  id: string
  category: string
  item_name?: string
  title?: string
  status: string
  severity?: string
  finding?: string
  recommendation?: string
}

interface ProspectusSection {
  id: string
  chapter_no: number
  title: string
  status: string
  content?: string
}

interface DDItem {
  id: string
  module_id: string
  module_name: string
  responsible: string
  item: string
  priority: string
  output: string
  status: string
}

interface Dashboard {
  project_id: string
  name: string
  target_board: string
  status: string
  compliance: { total: number; pass_rate: number; by_status: Record<string, number> }
  prospectus: { total: number; approved_rate: number; by_status: Record<string, number> }
  milestones: { total: number; completed_rate: number; by_status: Record<string, number> }
  filing_materials: { total: number; upload_rate: number; by_status: Record<string, number> }
}

type View =
  | 'list'
  | 'create'
  | 'assessment'
  | 'dashboard'
  | 'compliance'
  | 'prospectus'
  | 'dd'
  | 'equity-chart'
  | 'audit-report'

const BOARD_OPTIONS = [
  { value: 'main_board', label: '沪深主板' },
  { value: 'chinext', label: '创业板' },
  { value: 'star_market', label: '科创板' },
  { value: 'bse', label: '北交所' },
]

const STATUS_COLOR: Record<string, string> = {
  pass: 'text-green-600 bg-green-50',
  fail: 'text-red-600 bg-red-50',
  pending: 'text-yellow-600 bg-yellow-50',
  issue: 'text-orange-600 bg-orange-50',
  final: 'text-blue-600 bg-blue-50',
  reviewed: 'text-purple-600 bg-purple-50',
}

// ── 主组件 ──────────────────────────────────────────────────────────────────

export default function IPOPrepPanel({ solution: _solution }: Props) {
  const [view, setView] = useState<View>('list')
  const [projects, setProjects] = useState<IPOProject[]>([])
  const [project, setProject] = useState<IPOProject | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const BASE = `${API_BASE}/api/finance/ipo`

  const msg = (s: string | null) => {
    setSuccess(s)
    if (s) setTimeout(() => setSuccess(null), 4000)
  }

  const loadProjects = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`${BASE}/projects`, { headers: authHeaders() })
      if (!r.ok) throw new Error(`${r.status}`)
      const d = await r.json()
      setProjects(Array.isArray(d) ? d : (d.projects || []))
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally { setLoading(false) }
  }, [BASE])

  useEffect(() => { loadProjects() }, [loadProjects])

  const openProject = (p: IPOProject) => {
    setProject(p)
    setView('dashboard')
  }

  const back = () => {
    setView('list')
    setProject(null)
  }

  // ── 视图路由 ──
  const renderView = () => {
    switch (view) {
      case 'assessment': return <BoardAssessment BASE={BASE} onBack={() => setView('list')} />
      case 'create':
        return <CreateProjectForm BASE={BASE} onCreated={(p) => { setProject(p); setView('dashboard'); loadProjects() }} onBack={() => setView('list')} />
      case 'dashboard':
        return project
          ? <ProjectDashboard project={project} BASE={BASE} onBack={back}
              onGoCompliance={() => setView('compliance')}
              onGoProspectus={() => setView('prospectus')}
              onGoDD={() => setView('dd')}
              onGoEquityChart={() => setView('equity-chart')}
              onGoAuditReport={() => setView('audit-report')} />
          : null
      case 'compliance':
        return project ? <CompliancePanel project={project} BASE={BASE} onBack={() => setView('dashboard')} msg={msg} /> : null
      case 'prospectus':
        return project ? <ProspectusPanel project={project} BASE={BASE} onBack={() => setView('dashboard')} msg={msg} /> : null
      case 'dd':
        return project ? <DDPanel project={project} BASE={BASE} onBack={() => setView('dashboard')} msg={msg} /> : null
      case 'equity-chart':
        return project ? <EquityChartPanel project={project} BASE={BASE} onBack={() => setView('dashboard')} /> : null
      case 'audit-report':
        return project ? <AuditReportPanel project={project} BASE={BASE} onBack={() => setView('dashboard')} /> : null
      default: return <ProjectList projects={projects} loading={loading} onSelect={openProject}
          onCreateNew={() => setView('create')}
          onAssessment={() => setView('assessment')} />
    }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 全局提示 */}
      {error && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-destructive/10 text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-green-500/10 text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{success}
        </div>
      )}
      <div className="flex-1 overflow-auto p-4">
        {renderView()}
      </div>
    </div>
  )
}

// ── 项目列表 ────────────────────────────────────────────────────────────────

function ProjectList({
  projects, loading, onSelect, onCreateNew, onAssessment
}: {
  projects: IPOProject[]
  loading: boolean
  onSelect: (p: IPOProject) => void
  onCreateNew: () => void
  onAssessment: () => void
}) {
  const BOARD_LABEL: Record<string, string> = {
    main_board: '主板', chinext: '创业板', star_market: '科创板', bse: '北交所',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">IPO 准备工作台</h2>
          <p className="text-xs text-muted-foreground mt-0.5">招股书 · 合规自检 · 尽职调查 · 股权架构图</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onAssessment}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border/50 hover:bg-muted transition-colors">
            <Search className="w-3.5 h-3.5" />板块评估
          </button>
          <button onClick={onCreateNew}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" />新建项目
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />加载中…
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center gap-3 text-muted-foreground">
          <TrendingUp className="w-10 h-10 opacity-30" />
          <p className="text-sm">暂无 IPO 项目</p>
          <p className="text-xs">先做「板块评估」了解上市条件，再新建项目</p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <button key={p.id} onClick={() => onSelect(p)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/80 hover:bg-accent/30 transition-colors text-left">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold truncate">{p.company_name || p.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">
                    {BOARD_LABEL[p.target_board] || p.target_board}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.sponsor && `保荐: ${p.sponsor}`}{p.sponsor && p.auditor ? ' · ' : ''}{p.auditor && `审计: ${p.auditor}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {p.status}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 板块适配性评估（无需项目） ─────────────────────────────────────────────

function BoardAssessment({ BASE, onBack }: { BASE: string; onBack: () => void }) {
  const [form, setForm] = useState({
    net_profit_last_year: '', net_profit_prev_year: '',
    revenue_last_year: '', net_assets: '',
    total_market_cap_estimate: '', rd_ratio: '',
  })
  const [result, setResult] = useState<{ results: BoardResult[]; best_fit: string | null; summary: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const body: Record<string, number | null> = {}
      for (const [k, v] of Object.entries(form)) {
        body[k] = v ? parseFloat(v) : null
      }
      body.net_profit_last_year ??= 0
      body.net_profit_prev_year ??= 0
      body.revenue_last_year ??= 0
      body.net_assets ??= 0
      const r = await fetch(`${BASE}/board-assessment`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(`${r.status}`)
      setResult(await r.json())
    } catch (e) { setError(e instanceof Error ? e.message : '评估失败') }
    finally { setLoading(false) }
  }

  const fields = [
    { key: 'net_profit_last_year', label: '最近一年净利润（万元）', required: true },
    { key: 'net_profit_prev_year', label: '前一年净利润（万元）', required: true },
    { key: 'revenue_last_year', label: '最近一年营业收入（万元）', required: true },
    { key: 'net_assets', label: '净资产（万元）', required: true },
    { key: 'total_market_cap_estimate', label: '预计市值（万元）', required: false },
    { key: 'rd_ratio', label: '研发投入占比（%）', required: false },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold">上市板块适配性评估</h2>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/80 p-4 space-y-3">
        <p className="text-xs text-muted-foreground">输入企业财务指标，自动匹配主板/创业板/科创板/北交所上市条件</p>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-xs text-muted-foreground">{f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}</label>
              <input
                type="number"
                value={form[f.key as keyof typeof form]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="mt-1 w-full h-8 px-2 rounded-lg border border-border/50 bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="0"
              />
            </div>
          ))}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button onClick={submit} disabled={loading}
          className="w-full h-9 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
          开始评估
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border/50 bg-blue-50/50 dark:bg-blue-900/10 p-3">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">{result.summary}</p>
          </div>
          {result.results.map(r => (
            <div key={r.board} className={`rounded-xl border p-3 ${r.eligible ? 'border-green-300 bg-green-50/50' : 'border-border/50 bg-card/80'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">{r.board_label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.eligible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {r.eligible ? '✓ 符合条件' : '✗ 暂不符合'}
                </span>
              </div>
              {r.met_conditions.length > 0 && (
                <div className="mb-1.5">
                  {r.met_conditions.map((c, i) => (
                    <p key={i} className="text-xs text-green-700 flex items-start gap-1"><CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" />{c}</p>
                  ))}
                </div>
              )}
              {r.unmet_conditions.map((c, i) => (
                <p key={i} className="text-xs text-red-600 flex items-start gap-1"><AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />{c}</p>
              ))}
              {r.recommendation && <p className="text-xs text-muted-foreground mt-1.5 italic">{r.recommendation}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 新建项目 ────────────────────────────────────────────────────────────────

function CreateProjectForm({
  BASE, onCreated, onBack
}: {
  BASE: string
  onCreated: (p: IPOProject) => void
  onBack: () => void
}) {
  const [form, setForm] = useState({
    name: '', company_name: '', target_board: 'star_market',
    sponsor: '', auditor: '', lawyer: '', industry: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!form.name || !form.company_name) { setError('项目名称和公司名称为必填'); return }
    setLoading(true); setError(null)
    try {
      const r = await fetch(`${BASE}/projects`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: 'preparation' }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || `${r.status}`) }
      onCreated(await r.json())
    } catch (e) { setError(e instanceof Error ? e.message : '创建失败') }
    finally { setLoading(false) }
  }

  const fields = [
    { key: 'name', label: '项目名称', required: true, placeholder: '例：XX科技 IPO 辅导项目' },
    { key: 'company_name', label: '拟上市公司名称', required: true, placeholder: '完整公司名称' },
    { key: 'industry', label: '所属行业', required: false, placeholder: '例：半导体/医疗器械' },
    { key: 'sponsor', label: '保荐机构', required: false, placeholder: '例：中信证券' },
    { key: 'auditor', label: '审计机构', required: false, placeholder: '例：普华永道' },
    { key: 'lawyer', label: '律师事务所', required: false, placeholder: '例：君合所' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold">新建 IPO 项目</h2>
      </div>
      <div className="rounded-xl border border-border/50 bg-card/80 p-4 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">目标板块 <span className="text-red-500">*</span></label>
          <div className="mt-1 grid grid-cols-4 gap-1.5">
            {BOARD_OPTIONS.map(b => (
              <button key={b.value} type="button"
                onClick={() => setForm(p => ({ ...p, target_board: b.value }))}
                className={`h-8 rounded-lg text-xs font-medium border transition-colors ${form.target_board === b.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border/50 hover:bg-muted'}`}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-xs text-muted-foreground">{f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}</label>
              <input
                value={form[f.key as keyof typeof form]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="mt-1 w-full h-8 px-2 rounded-lg border border-border/50 bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button onClick={submit} disabled={loading}
          className="w-full h-9 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          创建项目
        </button>
      </div>
    </div>
  )
}

// ── 项目仪表盘 ───────────────────────────────────────────────────────────────

function ProjectDashboard({
  project, BASE, onBack,
  onGoCompliance, onGoProspectus, onGoDD, onGoEquityChart, onGoAuditReport,
}: {
  project: IPOProject; BASE: string; onBack: () => void
  onGoCompliance: () => void; onGoProspectus: () => void
  onGoDD: () => void; onGoEquityChart: () => void; onGoAuditReport: () => void
}) {
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [initLoading, setInitLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const loadDash = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/projects/${project.id}/dashboard`, { headers: authHeaders() })
      if (r.ok) setDash(await r.json())
    } catch {}
  }, [BASE, project.id])

  useEffect(() => { loadDash() }, [loadDash])

  const initSection = async (section: 'compliance/diagnose' | 'prospectus/init' | 'due-diligence/init' | 'init-milestones') => {
    setInitLoading(p => ({ ...p, [section]: true }))
    setError(null)
    try {
      const isPost = section !== 'init-milestones'
      const url = section === 'init-milestones'
        ? `${BASE}/projects/${project.id}/init-milestones`
        : `${BASE}/projects/${project.id}/${section}`
      const r = await fetch(url, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwrite: false }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || `${r.status}`) }
      await loadDash()
    } catch (e) { setError(e instanceof Error ? e.message : '初始化失败') }
    finally { setInitLoading(p => ({ ...p, [section]: false })) }
  }

  const BOARD_LABEL: Record<string, string> = {
    main_board: '沪深主板', chinext: '创业板', star_market: '科创板', bse: '北交所',
  }

  const tiles = [
    {
      label: '合规自检', icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
      color: 'bg-blue-500/10',
      stat: dash ? `${dash.compliance.pass_rate}% 通过` : '—',
      total: dash?.compliance.total,
      onGo: onGoCompliance,
      initKey: 'compliance/diagnose' as const,
    },
    {
      label: '招股书章节', icon: <FileText className="w-5 h-5 text-purple-600" />,
      color: 'bg-purple-500/10',
      stat: dash ? `${dash.prospectus.approved_rate}% 完成` : '—',
      total: dash?.prospectus.total,
      onGo: onGoProspectus,
      initKey: 'prospectus/init' as const,
    },
    {
      label: '尽职调查', icon: <ClipboardList className="w-5 h-5 text-green-600" />,
      color: 'bg-green-500/10',
      stat: '点击查看',
      total: undefined,
      onGo: onGoDD,
      initKey: 'due-diligence/init' as const,
    },
    {
      label: '股权架构图', icon: <Users className="w-5 h-5 text-amber-600" />,
      color: 'bg-amber-500/10',
      stat: '生成 SVG',
      total: undefined,
      onGo: onGoEquityChart,
      initKey: null,
    },
    {
      label: '审计报告', icon: <FileText className="w-5 h-5 text-rose-600" />,
      color: 'bg-rose-500/10',
      stat: 'AI 起草 + 导出',
      total: undefined,
      onGo: onGoAuditReport,
      initKey: null,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-base font-semibold">{project.company_name || project.name}</h2>
          <p className="text-xs text-muted-foreground">
            {BOARD_LABEL[project.target_board] || project.target_board}
            {project.sponsor ? ` · 保荐：${project.sponsor}` : ''}
          </p>
        </div>
        <button onClick={loadDash} className="ml-auto p-1.5 rounded-lg hover:bg-muted transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        {tiles.map(t => (
          <div key={t.label} className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${t.color} flex items-center justify-center shrink-0`}>{t.icon}</div>
              <div>
                <p className="text-xs font-semibold">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.total !== undefined ? `共 ${t.total} 项 · ` : ''}{t.stat}</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={t.onGo}
                className="flex-1 h-7 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center justify-center gap-1">
                <ChevronRight className="w-3 h-3" />查看
              </button>
              {t.initKey && (
                <button onClick={() => initSection(t.initKey!)} disabled={!!initLoading[t.initKey!]}
                  className="flex-1 h-7 rounded-lg text-xs font-medium border border-border/50 hover:bg-muted disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                  {initLoading[t.initKey!] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}初始化
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 里程碑快速初始化 */}
      <div className="rounded-xl border border-border/50 bg-card/80 p-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold">IPO 时间线（里程碑）</p>
          <p className="text-xs text-muted-foreground">
            {dash ? `共 ${dash.milestones.total} 个里程碑 · ${dash.milestones.completed_rate}% 完成` : '未初始化'}
          </p>
        </div>
        <button onClick={() => initSection('init-milestones')} disabled={!!initLoading['init-milestones']}
          className="h-7 px-3 rounded-lg text-xs font-medium border border-border/50 hover:bg-muted disabled:opacity-50 transition-colors flex items-center gap-1">
          {initLoading['init-milestones'] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          生成时间线
        </button>
      </div>

      {/* AI 综合诊断 */}
      <AIQuickActions project={project} BASE={BASE} />
    </div>
  )
}

// ── AI 快速操作 ──────────────────────────────────────────────────────────────

function AIQuickActions({ project, BASE }: { project: IPOProject; BASE: string }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const runDiagnosis = async () => {
    setLoading('diagnosis'); setResult(null)
    try {
      const r = await fetch(`${BASE}/projects/${project.id}/ai-diagnosis`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus_areas: [] }),
      })
      const d = await r.json()
      setResult(d.diagnosis || JSON.stringify(d, null, 2))
    } catch { setResult('诊断失败，请重试') }
    finally { setLoading(null) }
  }

  const runReadiness = async () => {
    setLoading('readiness'); setResult(null)
    try {
      const r = await fetch(`${BASE}/projects/${project.id}/review-readiness`, { headers: authHeaders() })
      const d = await r.json()
      setResult(`**审核就绪度评分：${d.readiness_score ?? 'N/A'} 分**\n\n${d.ai_summary || ''}`)
    } catch { setResult('评估失败，请重试') }
    finally { setLoading(null) }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <p className="text-xs font-semibold">AI 快速操作</p>
      </div>
      <div className="flex gap-2">
        <button onClick={runDiagnosis} disabled={loading !== null}
          className="flex-1 h-8 rounded-lg text-xs font-medium border border-border/50 hover:bg-muted disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
          {loading === 'diagnosis' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          AI 综合诊断
        </button>
        <button onClick={runReadiness} disabled={loading !== null}
          className="flex-1 h-8 rounded-lg text-xs font-medium border border-border/50 hover:bg-muted disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
          {loading === 'readiness' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
          审核就绪度
        </button>
      </div>
      {result && (
        <div className="mt-2 p-2 rounded-lg bg-muted/50 text-xs whitespace-pre-wrap max-h-48 overflow-auto">
          {result}
        </div>
      )}
    </div>
  )
}

// ── 合规检查面板 ─────────────────────────────────────────────────────────────

function CompliancePanel({
  project, BASE, onBack, msg
}: {
  project: IPOProject; BASE: string; onBack: () => void; msg: (s: string) => void
}) {
  const [items, setItems] = useState<ComplianceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterCat) params.set('category', filterCat)
      if (filterStatus) params.set('status', filterStatus)
      const r = await fetch(`${BASE}/projects/${project.id}/compliance?${params}`, { headers: authHeaders() })
      if (r.ok) {
        const d = await r.json()
        setItems(d.items || d)
      }
    } finally { setLoading(false) }
  }, [BASE, project.id, filterCat, filterStatus])

  useEffect(() => { load() }, [load])

  const aiScore = async () => {
    setScoring(true)
    try {
      const r = await fetch(`${BASE}/projects/${project.id}/ai-score/compliance`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (r.ok) { msg('AI 评分完成'); await load() }
    } finally { setScoring(false) }
  }

  const categories = [...new Set(items.map(i => i.category))].sort()

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-4 h-4" /></button>
        <h3 className="text-sm font-semibold">合规检查项</h3>
        <span className="text-xs text-muted-foreground ml-auto">{items.length} 项</span>
        <button onClick={aiScore} disabled={scoring}
          className="h-7 px-2 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 disabled:opacity-50 transition-colors flex items-center gap-1">
          {scoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}AI 评分
        </button>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-muted"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>

      <div className="flex gap-2">
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="h-7 px-2 rounded-lg border border-border/50 bg-background text-xs flex-1 focus:outline-none">
          <option value="">全部类别</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="h-7 px-2 rounded-lg border border-border/50 bg-background text-xs focus:outline-none">
          <option value="">全部状态</option>
          <option value="pending">待核查</option>
          <option value="pass">通过</option>
          <option value="issue">有问题</option>
          <option value="fail">未通过</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-24 text-muted-foreground text-xs">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />加载中…
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-8">暂无数据，请先在项目仪表盘点击「初始化」生成检查项</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-border/50 bg-card/80">
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${STATUS_COLOR[item.status] || 'bg-muted text-muted-foreground'}`}>
                {item.status}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs">{item.item_name || item.title}</p>
                <p className="text-xs text-muted-foreground">{item.category}</p>
                {item.finding && <p className="text-xs text-orange-600 mt-0.5">⚠ {item.finding}</p>}
              </div>
              {item.severity && (
                <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${item.severity === 'critical' ? 'bg-red-100 text-red-700' : item.severity === 'major' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {item.severity}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 招股书章节面板 ────────────────────────────────────────────────────────────

function ProspectusPanel({
  project, BASE, onBack, msg
}: {
  project: IPOProject; BASE: string; onBack: () => void; msg: (s: string) => void
}) {
  const [sections, setSections] = useState<ProspectusSection[]>([])
  const [loading, setLoading] = useState(false)
  const [draftLoading, setDraftLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${BASE}/projects/${project.id}/prospectus`, { headers: authHeaders() })
      if (r.ok) { const d = await r.json(); setSections(d.sections || d) }
    } finally { setLoading(false) }
  }, [BASE, project.id])

  useEffect(() => { load() }, [load])

  const draftSection = async (sec: ProspectusSection) => {
    setDraftLoading(sec.id)
    try {
      const r = await fetch(`${BASE}/projects/${project.id}/ai-draft/prospectus`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_title: sec.title, section_key: String(sec.chapter_no), context: '' }),
      })
      if (r.ok) { msg(`第${sec.chapter_no}章 AI 草稿生成成功`); await load() }
    } finally { setDraftLoading(null) }
  }

  const completed = sections.filter(s => ['final', 'reviewed', 'completed', 'approved'].includes(s.status)).length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <h3 className="text-sm font-semibold">招股书章节</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {completed}/{sections.length} 章完成
        </span>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-muted"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>

      {/* 进度条 */}
      {sections.length > 0 && (
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${(completed / sections.length) * 100}%` }} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-24 text-muted-foreground text-xs">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />加载中…
        </div>
      ) : sections.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-8">暂无章节，请先在项目仪表盘点击「招股书初始化」</p>
      ) : (
        <div className="space-y-1.5">
          {sections.map(s => (
            <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-card/80">
              <span className="text-xs text-muted-foreground w-6 shrink-0">{s.chapter_no}</span>
              <p className="flex-1 text-xs truncate">{s.title}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${STATUS_COLOR[s.status] || 'bg-muted text-muted-foreground'}`}>
                {s.status}
              </span>
              {!['final', 'reviewed', 'approved'].includes(s.status) && (
                <button onClick={() => draftSection(s)} disabled={draftLoading === s.id}
                  className="h-6 px-2 rounded text-xs font-medium bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1">
                  {draftLoading === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}AI
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 尽调清单面板 ─────────────────────────────────────────────────────────────

function DDPanel({
  project, BASE, onBack, msg
}: {
  project: IPOProject; BASE: string; onBack: () => void; msg: (s: string) => void
}) {
  const [items, setItems] = useState<DDItem[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 })
  const [loading, setLoading] = useState(false)
  const [initLoading, setInitLoading] = useState(false)
  const [filterMod, setFilterMod] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterMod) params.set('module_id', filterMod)
      const r = await fetch(`${BASE}/projects/${project.id}/due-diligence?${params}`, { headers: authHeaders() })
      if (r.ok) {
        const d = await r.json()
        setItems(d.items || [])
        setStats({ total: d.total || 0, pending: d.pending || 0, completed: d.completed || 0 })
      }
    } finally { setLoading(false) }
  }, [BASE, project.id, filterMod])

  useEffect(() => { load() }, [load])

  const initDD = async () => {
    setInitLoading(true)
    try {
      const r = await fetch(`${BASE}/projects/${project.id}/due-diligence/init`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwrite: false }),
      })
      const d = await r.json()
      msg(d.message || '尽调清单初始化完成')
      await load()
    } finally { setInitLoading(false) }
  }

  const modules = [...new Set(items.map(i => i.module_id))]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <h3 className="text-sm font-semibold">尽职调查清单</h3>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{stats.total} 项 · {stats.completed} 完成</span>
          <button onClick={initDD} disabled={initLoading}
            className="h-7 px-2 rounded-lg text-xs font-medium border border-border/50 hover:bg-muted disabled:opacity-50 flex items-center gap-1">
            {initLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}初始化
          </button>
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-muted"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {modules.length > 1 && (
        <select value={filterMod} onChange={e => setFilterMod(e.target.value)}
          className="h-7 px-2 rounded-lg border border-border/50 bg-background text-xs w-full focus:outline-none">
          <option value="">全部模块</option>
          {modules.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-24 text-muted-foreground text-xs">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />加载中…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-center gap-2 text-muted-foreground">
          <ClipboardList className="w-8 h-8 opacity-30" />
          <p className="text-xs">尚无尽调清单，点击「初始化」生成 8 模块完整清单</p>
          <div className="flex gap-1 flex-wrap justify-center text-xs">
            {['法律', '财务', '业务', '税务', '知识产权', '人力', '环保', '数据合规'].map(m => (
              <span key={m} className="px-1.5 py-0.5 rounded bg-muted">{m}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-border/50 bg-card/80">
              <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${STATUS_COLOR[item.status] || 'bg-muted text-muted-foreground'}`}>
                {item.status}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs">{item.item.replace(/^\[.*?\]\s*/, '')}</p>
                <p className="text-xs text-muted-foreground">{item.module_id.replace('DD::', '')} · 产出：{item.output}</p>
              </div>
              {item.priority === 'high' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 shrink-0">必查</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 股权架构图面板 ────────────────────────────────────────────────────────────

function EquityChartPanel({ project, BASE, onBack }: { project: IPOProject; BASE: string; onBack: () => void }) {
  const [shareholders, setShareholders] = useState([
    { name: '实际控制人', ratio: '0.35', type: 'natural' },
    { name: '核心管理层', ratio: '0.15', type: 'natural' },
    { name: '外部投资方', ratio: '0.30', type: 'fund' },
    { name: '其他股东', ratio: '0.20', type: 'company' },
  ])
  const [fmt, setFmt] = useState<'svg' | 'png'>('svg')
  const [loading, setLoading] = useState(false)
  const [chartUrl, setChartUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const addRow = () => setShareholders(p => [...p, { name: '', ratio: '0', type: 'natural' }])
  const removeRow = (i: number) => setShareholders(p => p.filter((_, idx) => idx !== i))
  const updateRow = (i: number, key: string, value: string) =>
    setShareholders(p => p.map((r, idx) => idx === i ? { ...r, [key]: value } : r))

  const generate = async () => {
    setLoading(true); setError(null)
    if (chartUrl) { URL.revokeObjectURL(chartUrl); setChartUrl(null) }
    try {
      const body = {
        company_name: project.company_name || project.name,
        fmt,
        shareholders: shareholders.map(s => ({ name: s.name, ratio: parseFloat(s.ratio) || 0, type: s.type })),
      }
      const r = await fetch(`${BASE}/projects/${project.id}/equity-chart`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || `${r.status}`) }
      const blob = await r.blob()
      setChartUrl(URL.createObjectURL(blob))
    } catch (e) { setError(e instanceof Error ? e.message : '生成失败') }
    finally { setLoading(false) }
  }

  const download = () => {
    if (!chartUrl) return
    const a = document.createElement('a')
    a.href = chartUrl
    a.download = `${project.company_name || project.name}_equity.${fmt}`
    a.click()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <h3 className="text-sm font-semibold">股权架构图</h3>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">股东信息</p>
          <button onClick={addRow} className="flex items-center gap-1 h-6 px-2 rounded text-xs border border-border/50 hover:bg-muted">
            <Plus className="w-3 h-3" />添加
          </button>
        </div>
        <div className="space-y-1.5">
          {shareholders.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input value={s.name} onChange={e => updateRow(i, 'name', e.target.value)}
                placeholder="股东名称" className="flex-1 h-7 px-2 rounded border border-border/50 bg-background text-xs focus:outline-none" />
              <input value={s.ratio} onChange={e => updateRow(i, 'ratio', e.target.value)}
                placeholder="比例" type="number" min="0" max="1" step="0.01"
                className="w-16 h-7 px-2 rounded border border-border/50 bg-background text-xs focus:outline-none" />
              <select value={s.type} onChange={e => updateRow(i, 'type', e.target.value)}
                className="w-20 h-7 px-1.5 rounded border border-border/50 bg-background text-xs focus:outline-none">
                <option value="natural">自然人</option>
                <option value="company">公司</option>
                <option value="fund">基金</option>
              </select>
              <button onClick={() => removeRow(i)} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <div className="flex gap-1">
            {(['svg', 'png'] as const).map(f => (
              <button key={f} onClick={() => setFmt(f)}
                className={`h-7 px-3 rounded-lg text-xs font-medium border transition-colors ${fmt === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border/50 hover:bg-muted'}`}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <button onClick={generate} disabled={loading}
            className="flex-1 h-7 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            生成图表
          </button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="text-xs text-muted-foreground flex items-start gap-1">
          <Info className="w-3 h-3 shrink-0 mt-0.5" />
          持股比例合计应为 1（100%）；图表通过 MBE Design Engine 生成矢量图
        </div>
      </div>

      {chartUrl && (
        <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">预览</p>
            <button onClick={download}
              className="flex items-center gap-1 h-7 px-3 rounded-lg text-xs font-medium bg-green-500/10 text-green-700 hover:bg-green-500/20 transition-colors">
              <Download className="w-3 h-3" />下载 {fmt.toUpperCase()}
            </button>
          </div>
          {fmt === 'svg' ? (
            <object data={chartUrl} type="image/svg+xml" className="w-full rounded-lg bg-white" style={{ minHeight: 300 }}>
              <p className="text-xs text-muted-foreground text-center py-4">SVG 预览不可用，请点击下载</p>
            </object>
          ) : (
            <img src={chartUrl} alt="股权架构图" className="w-full rounded-lg" />
          )}
        </div>
      )}
    </div>
  )
}

// ── 审计报告面板 ─────────────────────────────────────────────────────────────

interface AuditProject {
  id: string
  name: string
  audit_type: string
  fiscal_year: number
  status: string
}

function AuditReportPanel({ project, BASE, onBack }: { project: IPOProject; BASE: string; onBack: () => void }) {
  const AUDIT_BASE = BASE.replace('/ipo', '/audit')

  const [auditProjects, setAuditProjects] = useState<AuditProject[]>([])
  const [selectedAudit, setSelectedAudit] = useState<AuditProject | null>(null)
  const [opinionType, setOpinionType] = useState<'unqualified' | 'qualified' | 'adverse' | 'disclaimer'>('unqualified')
  const [cpaFirm, setCpaFirm] = useState('')
  const [cpaNames, setCpaNames] = useState('')
  const [includeKAM, setIncludeKAM] = useState(true)
  const [drafting, setDrafting] = useState(false)
  const [reportContent, setReportContent] = useState('')
  const [exportLoading, setExportLoading] = useState<'docx' | 'pdf' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 覆盖度核查
  const [coverage, setCoverage] = useState<{ summary: string; all_covered: boolean; missing_years: number[]; coverage: { fiscal_year: number; covered: boolean; status?: string }[] } | null>(null)
  const [checkingCoverage, setCheckingCoverage] = useState(false)

  const loadAuditProjects = useCallback(async () => {
    try {
      const r = await fetch(`${AUDIT_BASE}/projects`, { headers: authHeaders() })
      if (r.ok) {
        const d = await r.json()
        const list: AuditProject[] = (d.projects || d).filter((p: AuditProject) =>
          ['external', 'annual', 'ipo'].includes(p.audit_type)
        )
        setAuditProjects(list)
        if (list.length > 0 && !selectedAudit) setSelectedAudit(list[0])
      }
    } catch {}
  }, [AUDIT_BASE])

  useEffect(() => { loadAuditProjects() }, [loadAuditProjects])

  const checkCoverage = async () => {
    setCheckingCoverage(true); setError(null)
    try {
      const r = await fetch(`${AUDIT_BASE}/ipo-coverage-check`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: project.id }),
      })
      if (r.ok) setCoverage(await r.json())
      else throw new Error(`${r.status}`)
    } catch (e) { setError(e instanceof Error ? e.message : '核查失败') }
    finally { setCheckingCoverage(false) }
  }

  const draftReport = async () => {
    if (!selectedAudit) { setError('请先选择审计项目'); return }
    setDrafting(true); setError(null); setReportContent('')
    try {
      const r = await fetch(`${AUDIT_BASE}/projects/${selectedAudit.id}/draft-report`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opinion_type: opinionType,
          cpa_firm: cpaFirm || undefined,
          cpa_names: cpaNames ? cpaNames.split('、').map(s => s.trim()) : undefined,
          include_key_audit_matters: includeKAM,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || `${r.status}`)
      setReportContent(d.report_content || '')
    } catch (e) { setError(e instanceof Error ? e.message : '起草失败') }
    finally { setDrafting(false) }
  }

  const exportReport = async (fmt: 'docx' | 'pdf') => {
    if (!reportContent || !selectedAudit) return
    setExportLoading(fmt); setError(null)
    try {
      const r = await fetch(`${AUDIT_BASE}/projects/${selectedAudit.id}/export-report`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_content: reportContent, fmt, cpa_firm: cpaFirm || undefined }),
      })
      if (!r.ok) throw new Error(`${r.status}`)
      const blob = await r.blob()
      const ext = fmt === 'docx' ? 'docx' : 'pdf'
      const filename = `审计报告_${selectedAudit.fiscal_year}.${ext}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setError(e instanceof Error ? e.message : '导出失败') }
    finally { setExportLoading(null) }
  }

  const OPINION_OPTIONS = [
    { value: 'unqualified', label: '无保留意见（标准意见）' },
    { value: 'qualified', label: '保留意见' },
    { value: 'adverse', label: '否定意见' },
    { value: 'disclaimer', label: '无法表示意见' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <h3 className="text-sm font-semibold">审计报告</h3>
        <span className="text-xs text-muted-foreground ml-1">IPO 近三年一期</span>
      </div>

      {/* IPO 年审覆盖度核查 */}
      <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">IPO 年审覆盖度核查</p>
          <button onClick={checkCoverage} disabled={checkingCoverage}
            className="h-7 px-3 rounded-lg text-xs font-medium border border-border/50 hover:bg-muted disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {checkingCoverage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            检查覆盖度
          </button>
        </div>
        {coverage && (
          <div>
            <p className={`text-xs mb-2 ${coverage.all_covered ? 'text-green-700' : 'text-orange-600'}`}>
              {coverage.summary}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {coverage.coverage.map(c => (
                <div key={c.fiscal_year}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${c.covered ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {c.covered ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {c.fiscal_year}年
                  {c.covered && c.status && <span className="opacity-60">·{c.status}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 审计报告起草 */}
      <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-3">
        <p className="text-xs font-semibold">AI 起草审计报告</p>

        {/* 选择审计项目 */}
        <div>
          <label className="text-xs text-muted-foreground">审计项目（外部年报审计）</label>
          <select value={selectedAudit?.id || ''}
            onChange={e => setSelectedAudit(auditProjects.find(p => p.id === e.target.value) || null)}
            className="mt-1 w-full h-8 px-2 rounded-lg border border-border/50 bg-background text-xs focus:outline-none">
            <option value="">— 选择审计项目 —</option>
            {auditProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name}（{p.fiscal_year}年）</option>
            ))}
          </select>
          {auditProjects.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              暂无外部/年报审计项目，请在「审计」模块创建类型为 external/annual/ipo 的项目
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">意见类型</label>
            <select value={opinionType} onChange={e => setOpinionType(e.target.value as typeof opinionType)}
              className="mt-1 w-full h-8 px-2 rounded-lg border border-border/50 bg-background text-xs focus:outline-none">
              {OPINION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">会计师事务所</label>
            <input value={cpaFirm} onChange={e => setCpaFirm(e.target.value)}
              placeholder="例：普华永道" className="mt-1 w-full h-8 px-2 rounded-lg border border-border/50 bg-background text-xs focus:outline-none" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">签字注册会计师（用「、」分隔）</label>
            <input value={cpaNames} onChange={e => setCpaNames(e.target.value)}
              placeholder="张三、李四" className="mt-1 w-full h-8 px-2 rounded-lg border border-border/50 bg-background text-xs focus:outline-none" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="kam" checked={includeKAM} onChange={e => setIncludeKAM(e.target.checked)}
            className="w-3.5 h-3.5 rounded" />
          <label htmlFor="kam" className="text-xs text-muted-foreground cursor-pointer">
            包含关键审计事项（CAS 1504，IPO/上市公司要求）
          </label>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <button onClick={draftReport} disabled={drafting || !selectedAudit}
          className="w-full h-9 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          AI 起草审计报告
        </button>
      </div>

      {/* 报告内容 + 导出 */}
      {reportContent && (
        <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">审计报告草稿</p>
            <div className="flex gap-1.5">
              <button onClick={() => exportReport('docx')} disabled={!!exportLoading}
                className="flex items-center gap-1 h-7 px-3 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 disabled:opacity-50 transition-colors">
                {exportLoading === 'docx' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                Word
              </button>
              <button onClick={() => exportReport('pdf')} disabled={!!exportLoading}
                className="flex items-center gap-1 h-7 px-3 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 disabled:opacity-50 transition-colors">
                {exportLoading === 'pdf' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                PDF
              </button>
            </div>
          </div>
          <textarea
            value={reportContent}
            onChange={e => setReportContent(e.target.value)}
            className="w-full rounded-lg border border-border/50 bg-background text-xs p-2 focus:outline-none resize-none"
            rows={16}
          />
          <p className="text-xs text-muted-foreground">可直接编辑上方文本，修改完成后导出</p>
        </div>
      )}
    </div>
  )
}
