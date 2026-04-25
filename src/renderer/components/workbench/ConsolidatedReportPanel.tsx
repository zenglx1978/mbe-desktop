/**
 * 集团合并报表面板 — 项目管理 + 主体录入 + 计算 + 报表查看
 *
 * 对接 GET|POST /api/finance/consolidated/...
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Trash2, Play, Download, ChevronRight, ChevronDown,
  Building2, AlertCircle, CheckCircle2, Loader2, RefreshCw,
  FileBarChart, ArrowLeft, Info,
} from 'lucide-react'
import type { SolutionConfig } from '@/lib/solution-router'
import { API_BASE, authHeaders } from '@/lib/api-client'

interface Props {
  solution: SolutionConfig
}

// ── API 响应类型 ────────────────────────────────────────────────────────────

interface Project {
  id: string
  name: string
  group_name: string
  reporting_currency: string
  reporting_standard: string
  period_label: string
  period_year: number
  period_month?: number
  status: string
  entity_count?: number
  created_at?: string
  consolidated_bs?: Record<string, unknown>
  consolidated_pl?: Record<string, unknown>
}

interface Entity {
  id: string
  entity_name: string
  entity_code: string
  entity_type: 'parent' | 'subsidiary' | 'associate'
  ownership_pct: number
  reporting_currency: string
}

type View = 'list' | 'create' | 'detail' | 'add-entity' | 'report'

// ── 数字格式化 ──────────────────────────────────────────────────────────────
const fmt = (v: unknown) => {
  if (v == null) return '—'
  const n = Number(v)
  if (isNaN(n)) return String(v)
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ── 主组件 ──────────────────────────────────────────────────────────────────
export default function ConsolidatedReportPanel({ solution: _solution }: Props) {
  const [view, setView] = useState<View>('list')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(false)
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const BASE = `${API_BASE}/api/finance/consolidated`

  // ── 获取项目列表 ──
  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(BASE, { headers: authHeaders() })
      if (!r.ok) throw new Error(`${r.status}`)
      setProjects(await r.json() as Project[])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [BASE])

  useEffect(() => { loadProjects() }, [loadProjects])

  // ── 选中项目并进入详情 ──
  const openProject = async (p: Project) => {
    setSelectedProject(p)
    setView('detail')
    setError(null)
    try {
      const r = await fetch(`${BASE}/${p.id}/entities`, { headers: authHeaders() })
      if (r.ok) setEntities(await r.json() as Entity[])
    } catch { /* ignore */ }
  }

  // ── 触发合并计算 ──
  const compute = async () => {
    if (!selectedProject) return
    setComputing(true)
    setError(null)
    try {
      const r = await fetch(`${BASE}/${selectedProject.id}/compute`, {
        method: 'POST',
        headers: authHeaders(),
        signal: AbortSignal.timeout(60000),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({})) as { detail?: string }
        throw new Error(d.detail ?? `错误 ${r.status}`)
      }
      const result = await r.json() as Project
      setSelectedProject(result)
      setSuccessMsg('合并计算完成！')
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : '计算失败')
    } finally {
      setComputing(false)
    }
  }

  // ── 删除项目 ──
  const deleteProject = async (id: string) => {
    if (!confirm('确定删除该项目？此操作不可撤销。')) return
    try {
      await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders() })
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  // ── 下载报表 JSON ──
  const downloadReport = () => {
    if (!selectedProject) return
    const data = {
      project: selectedProject,
      entities,
      generated_at: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedProject.group_name}_合并报表_${selectedProject.period_label}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── 渲染：列表视图 ──
  if (view === 'list') {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <FileBarChart className="w-5 h-5 text-emerald-500" />
                集团合并报表
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                管理合并报表项目，录入主体数据，自动计算抵消分录。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setView('create')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建项目
            </button>
          </div>

          {error && <ErrorBanner msg={error} />}

          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />加载中…
            </div>
          ) : projects.length === 0 ? (
            <EmptyState onNew={() => setView('create')} />
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <div key={p.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card hover:border-border transition-all group">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold truncate">{p.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.group_name} · {p.period_label} · {p.reporting_currency} · {p.reporting_standard}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => openProject(p)}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => deleteProject(p.id)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── 渲染：新建项目 ──
  if (view === 'create') {
    return (
      <CreateProjectForm
        onBack={() => setView('list')}
        onCreated={(p) => { setProjects((prev) => [p, ...prev]); openProject(p) }}
        base={BASE}
      />
    )
  }

  // ── 渲染：项目详情 ──
  if (view === 'detail' && selectedProject) {
    const hasReport = !!(selectedProject.consolidated_bs)
    return (
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* 顶部 */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => { setView('list'); loadProjects() }}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1">
              <h2 className="text-base font-bold">{selectedProject.name}</h2>
              <p className="text-xs text-muted-foreground">{selectedProject.group_name} · {selectedProject.period_label}</p>
            </div>
            <StatusBadge status={selectedProject.status} />
          </div>

          {error && <ErrorBanner msg={error} />}
          {successMsg && <SuccessBanner msg={successMsg} />}

          {/* 主体列表 */}
          <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-card">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">合并主体（{entities.length}）</h3>
              <button type="button" onClick={() => setView('add-entity')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors">
                <Plus className="w-3.5 h-3.5" />添加主体
              </button>
            </div>
            {entities.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">暂无主体，请添加母公司和子公司。</p>
            ) : (
              <div className="space-y-2">
                {entities.map((e) => (
                  <EntityRow key={e.id} entity={e}
                    onDelete={async () => {
                      await fetch(`${BASE}/${selectedProject.id}/entities/${e.id}`,
                        { method: 'DELETE', headers: authHeaders() })
                      setEntities((prev) => prev.filter((x) => x.id !== e.id))
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 操作 */}
          <div className="grid grid-cols-2 gap-3">
            <button type="button"
              onClick={compute}
              disabled={computing || entities.length === 0}
              className="flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {computing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {computing ? '计算中…' : '触发合并计算'}
            </button>

            <button type="button"
              onClick={() => setView('report')}
              disabled={!hasReport}
              className="flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold border border-border/60 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FileBarChart className="w-4 h-4" />
              查看合并报表
            </button>
          </div>

          {!hasReport && entities.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/30">
              <Info className="w-3.5 h-3.5 shrink-0" />
              请先添加主体数据，然后点击「触发合并计算」生成合并报表。
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── 渲染：添加主体 ──
  if (view === 'add-entity' && selectedProject) {
    return (
      <AddEntityForm
        projectId={selectedProject.id}
        base={BASE}
        onBack={() => setView('detail')}
        onAdded={(e) => { setEntities((prev) => [...prev, e]); setView('detail') }}
      />
    )
  }

  // ── 渲染：报表查看 ──
  if (view === 'report' && selectedProject) {
    return (
      <ReportView
        project={selectedProject}
        entities={entities}
        onBack={() => setView('detail')}
        onDownload={downloadReport}
      />
    )
  }

  return null
}

// ── 子组件 ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:    { label: '草稿', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
    computed: { label: '已计算', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    finalized: { label: '已定稿', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    archived: { label: '已归档', cls: 'bg-gray-100 text-gray-400' },
  }
  const m = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>{m.label}</span>
}

function EntityRow({ entity: e, onDelete }: { entity: Entity; onDelete: () => void }) {
  const typeLabel = { parent: '母公司', subsidiary: '子公司', associate: '联营企业' }[e.entity_type] ?? e.entity_type
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 group transition-colors">
      <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{e.entity_name}</span>
        <span className="text-xs text-muted-foreground ml-2">{e.entity_code}</span>
      </div>
      <span className="text-xs text-muted-foreground">{typeLabel}</span>
      {e.entity_type !== 'parent' && (
        <span className="text-xs text-muted-foreground">{e.ownership_pct}%</span>
      )}
      <button type="button" onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
      <AlertCircle className="w-4 h-4 shrink-0" />{msg}
    </div>
  )
}

function SuccessBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="w-4 h-4 shrink-0" />{msg}
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
        <FileBarChart className="w-8 h-8 text-emerald-500" />
      </div>
      <div>
        <h3 className="font-semibold">暂无合并报表项目</h3>
        <p className="text-sm text-muted-foreground mt-1">创建第一个项目，开始合并计算。</p>
      </div>
      <button type="button" onClick={onNew}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors">
        <Plus className="w-4 h-4" />新建项目
      </button>
    </div>
  )
}

// ── 新建项目表单 ────────────────────────────────────────────────────────────
function CreateProjectForm({
  onBack, onCreated, base,
}: { onBack: () => void; onCreated: (p: Project) => void; base: string }) {
  const [form, setForm] = useState({
    name: '', group_name: '', reporting_currency: 'CNY',
    reporting_standard: 'CAS', period_year: new Date().getFullYear(),
    period_month: '', period_label: '', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name || !form.group_name) { setError('项目名称和集团名称不能为空'); return }
    setLoading(true)
    setError(null)
    try {
      const body = {
        ...form,
        period_year: Number(form.period_year),
        period_month: form.period_month ? Number(form.period_month) : null,
        period_label: form.period_label || `${form.period_year}年度`,
      }
      const r = await fetch(base, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({})) as { detail?: string }
        throw new Error(d.detail ?? `错误 ${r.status}`)
      }
      onCreated(await r.json() as Project)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="max-w-lg mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-bold">新建合并报表项目</h2>
        </div>

        {error && <ErrorBanner msg={error} />}

        <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-card">
          <Field label="项目名称 *" value={form.name} onChange={(v) => set('name', v)} placeholder="如：2024年度集团合并报表" />
          <Field label="集团名称 *" value={form.group_name} onChange={(v) => set('group_name', v)} placeholder="如：XX控股集团" />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="报表货币" value={form.reporting_currency} onChange={(v) => set('reporting_currency', v)}
              options={[{ value: 'CNY', label: '人民币 CNY' }, { value: 'USD', label: '美元 USD' }, { value: 'HKD', label: '港元 HKD' }]} />
            <SelectField label="会计准则" value={form.reporting_standard} onChange={(v) => set('reporting_standard', v)}
              options={[{ value: 'CAS', label: '中国 CAS' }, { value: 'IFRS', label: '国际 IFRS' }, { value: 'US-GAAP', label: '美国 GAAP' }]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="报告年度" value={String(form.period_year)} onChange={(v) => set('period_year', v)} placeholder="2024" />
            <Field label="报告月份（可选）" value={form.period_month} onChange={(v) => set('period_month', v)} placeholder="留空=年度报表" />
          </div>
          <Field label="报告期标签" value={form.period_label} onChange={(v) => set('period_label', v)} placeholder="如 2024年度（留空自动生成）" />
          <Field label="备注" value={form.notes} onChange={(v) => set('notes', v)} placeholder="可选" />
        </div>

        <button type="button" onClick={submit} disabled={loading}
          className="w-full h-10 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-colors">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {loading ? '创建中…' : '创建项目'}
        </button>
      </div>
    </div>
  )
}

// ── 添加主体表单 ────────────────────────────────────────────────────────────
function AddEntityForm({
  projectId, base, onBack, onAdded,
}: { projectId: string; base: string; onBack: () => void; onAdded: (e: Entity) => void }) {
  const [form, setForm] = useState({
    entity_name: '', entity_code: '', entity_type: 'subsidiary',
    ownership_pct: '100', reporting_currency: 'CNY',
    // 简单财务数据
    total_assets: '', total_liabilities: '', equity: '',
    revenue: '', net_profit: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.entity_name || !form.entity_code) { setError('主体名称和代码不能为空'); return }
    setLoading(true)
    setError(null)
    try {
      const body = {
        entity_name: form.entity_name,
        entity_code: form.entity_code,
        entity_type: form.entity_type,
        ownership_pct: Number(form.ownership_pct),
        reporting_currency: form.reporting_currency,
        balance_sheet: {
          total_assets: Number(form.total_assets) || 0,
          total_liabilities: Number(form.total_liabilities) || 0,
          equity: Number(form.equity) || 0,
        },
        income_statement: {
          revenue: Number(form.revenue) || 0,
          net_profit: Number(form.net_profit) || 0,
        },
      }
      const r = await fetch(`${base}/${projectId}/entities`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({})) as { detail?: string }
        throw new Error(d.detail ?? `错误 ${r.status}`)
      }
      onAdded(await r.json() as Entity)
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="max-w-lg mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-bold">添加合并主体</h2>
        </div>

        {error && <ErrorBanner msg={error} />}

        <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-card">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">主体信息</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="主体名称 *" value={form.entity_name} onChange={(v) => set('entity_name', v)} placeholder="如：XX子公司" />
            <Field label="主体代码 *" value={form.entity_code} onChange={(v) => set('entity_code', v)} placeholder="如：SUB01" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="主体类型" value={form.entity_type} onChange={(v) => set('entity_type', v)}
              options={[{ value: 'parent', label: '母公司' }, { value: 'subsidiary', label: '子公司' }, { value: 'associate', label: '联营企业' }]} />
            <Field label="持股比例（%）" value={form.ownership_pct} onChange={(v) => set('ownership_pct', v)} placeholder="100" />
          </div>
        </div>

        <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-card">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">单体财务数据（万元）</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="总资产" value={form.total_assets} onChange={(v) => set('total_assets', v)} placeholder="0" />
            <Field label="总负债" value={form.total_liabilities} onChange={(v) => set('total_liabilities', v)} placeholder="0" />
            <Field label="股东权益" value={form.equity} onChange={(v) => set('equity', v)} placeholder="0" />
            <Field label="营业收入" value={form.revenue} onChange={(v) => set('revenue', v)} placeholder="0" />
            <Field label="净利润" value={form.net_profit} onChange={(v) => set('net_profit', v)} placeholder="0" />
          </div>
        </div>

        <button type="button" onClick={submit} disabled={loading}
          className="w-full h-10 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-colors">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {loading ? '添加中…' : '添加主体'}
        </button>
      </div>
    </div>
  )
}

// ── 报表查看 ────────────────────────────────────────────────────────────────
function ReportView({ project, entities, onBack, onDownload }: {
  project: Project
  entities: Entity[]
  onBack: () => void
  onDownload: () => void
}) {
  const [expanded, setExpanded] = useState<'bs' | 'pl' | null>('bs')
  const bs = project.consolidated_bs as Record<string, unknown> | undefined
  const pl = project.consolidated_pl as Record<string, unknown> | undefined

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h2 className="text-base font-bold">{project.group_name} 合并报表</h2>
            <p className="text-xs text-muted-foreground">{project.period_label} · {project.reporting_currency} · {project.reporting_standard}</p>
          </div>
          <button type="button" onClick={onDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border/60 hover:bg-muted transition-colors">
            <Download className="w-3.5 h-3.5" />下载 JSON
          </button>
          <button type="button" onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* 摘要卡片 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '合并主体数', value: entities.length, unit: '家' },
            { label: '合并总资产', value: bs ? fmt(bs['total_assets']) : '—', unit: '' },
            { label: '合并净利润', value: pl ? fmt(pl['net_profit']) : '—', unit: '' },
          ].map(({ label, value, unit }) => (
            <div key={label} className="p-3 rounded-xl border border-border/60 bg-card text-center">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-bold mt-1">{value}{unit}</p>
            </div>
          ))}
        </div>

        {/* 合并资产负债表 */}
        {bs && (
          <ReportSection
            title="合并资产负债表"
            expanded={expanded === 'bs'}
            onToggle={() => setExpanded(expanded === 'bs' ? null : 'bs')}
            data={bs}
          />
        )}

        {/* 合并利润表 */}
        {pl && (
          <ReportSection
            title="合并利润表"
            expanded={expanded === 'pl'}
            onToggle={() => setExpanded(expanded === 'pl' ? null : 'pl')}
            data={pl}
          />
        )}

        {!bs && !pl && (
          <div className="text-center py-10 text-sm text-muted-foreground">
            暂无报表数据，请先触发合并计算。
          </div>
        )}
      </div>
    </div>
  )
}

function ReportSection({ title, expanded, onToggle, data }: {
  title: string; expanded: boolean; onToggle: () => void; data: Record<string, unknown>
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
        <span className="text-sm font-semibold">{title}</span>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="border-t border-border/40 divide-y divide-border/30">
          {Object.entries(data).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-muted/20 transition-colors">
              <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</span>
              <span className="font-medium tabular-nums">{fmt(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 通用表单控件 ────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all" />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
