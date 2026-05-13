/**
 * 审计报告面板（独立版）— 适用于年审、专项审计、内审结项等所有场景
 *
 * 不依赖 IPO 项目上下文，直接列所有审计项目，支持：
 *   - IPO 年审覆盖度核查（三年一期）
 *   - AI 起草标准审计报告（CAS 格式，四种意见类型）
 *   - Word / PDF 导出
 *
 * 对接 /api/finance/audit/...
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, Search, CheckCircle2, AlertCircle,
  Download, Sparkles, RefreshCw, FileText, ClipboardCheck,
} from 'lucide-react'
import type { SolutionConfig } from '@/lib/solution-router'
import { API_BASE, authHeaders } from '@/lib/api-client'

interface Props {
  solution: SolutionConfig
}

interface AuditProjectItem {
  id: string
  name: string
  audit_type: string
  fiscal_year: number
  status: string
  scope?: string
  materiality_amount?: string | number
}

interface CoverageItem {
  fiscal_year: number
  covered: boolean
  project_id?: string
  project_name?: string
  status?: string
}

interface CoverageResult {
  summary: string
  all_covered: boolean
  missing_years: number[]
  coverage: CoverageItem[]
}

type OpinionType = 'unqualified' | 'qualified' | 'adverse' | 'disclaimer'

const OPINION_OPTIONS: { value: OpinionType; label: string; color: string }[] = [
  { value: 'unqualified', label: '无保留意见（标准意见）', color: 'text-green-700' },
  { value: 'qualified',   label: '保留意见',               color: 'text-yellow-700' },
  { value: 'adverse',     label: '否定意见',               color: 'text-red-700'    },
  { value: 'disclaimer',  label: '无法表示意见',           color: 'text-gray-600'   },
]

const AUDIT_TYPE_LABEL: Record<string, string> = {
  internal: '内部审计',
  external: '外部审计',
  annual:   '年度审计',
  ipo:      'IPO 审计',
  expense:  '经费审计',
}

const STATUS_COLOR: Record<string, string> = {
  planning:   'bg-blue-100 text-blue-700',
  fieldwork:  'bg-amber-100 text-amber-700',
  reporting:  'bg-purple-100 text-purple-700',
  completed:  'bg-green-100 text-green-700',
}

export default function AuditReportFullPanel({ solution: _solution }: Props) {
  const BASE = `${API_BASE}/api/finance/audit`

  const [projects, setProjects] = useState<AuditProjectItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<AuditProjectItem | null>(null)

  // IPO 覆盖度
  const [companyId, setCompanyId] = useState('')
  const [coverage, setCoverage] = useState<CoverageResult | null>(null)
  const [checkingCoverage, setCheckingCoverage] = useState(false)

  // 起草参数
  const [opinionType, setOpinionType] = useState<OpinionType>('unqualified')
  const [cpaFirm, setCpaFirm] = useState('')
  const [cpaNames, setCpaNames] = useState('')
  const [includeKAM, setIncludeKAM] = useState(false)
  const [context, setContext] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [reportContent, setReportContent] = useState('')
  const [reportMeta, setReportMeta] = useState<{ key_findings_count: number; high_risk_count: number; placeholders: string[] } | null>(null)

  // 导出
  const [exportLoading, setExportLoading] = useState<'docx' | 'pdf' | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${BASE}/projects`, { headers: authHeaders() })
      if (r.ok) {
        const d = await r.json()
        setProjects(d.projects || d || [])
      }
    } catch {}
    setLoading(false)
  }, [BASE])

  useEffect(() => { loadProjects() }, [loadProjects])

  const msg = (text: string, isError = false) => {
    if (isError) { setError(text); setTimeout(() => setError(null), 6000) }
    else { setSuccess(text); setTimeout(() => setSuccess(null), 4000) }
  }

  const checkCoverage = async () => {
    if (!companyId.trim()) { msg('请先填写企业 ID', true); return }
    setCheckingCoverage(true)
    try {
      const r = await fetch(`${BASE}/ipo-coverage-check`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId }),
      })
      if (r.ok) setCoverage(await r.json())
      else throw new Error(`${r.status}`)
    } catch (e) { msg(e instanceof Error ? e.message : '核查失败', true) }
    finally { setCheckingCoverage(false) }
  }

  const draftReport = async () => {
    if (!selected) { msg('请先选择审计项目', true); return }
    setDrafting(true); setError(null); setReportContent(''); setReportMeta(null)
    try {
      const r = await fetch(`${BASE}/projects/${selected.id}/draft-report`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opinion_type: opinionType,
          cpa_firm: cpaFirm || undefined,
          cpa_names: cpaNames ? cpaNames.split('、').map(s => s.trim()).filter(Boolean) : undefined,
          include_key_audit_matters: includeKAM,
          context: context || undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || `${r.status}`)
      setReportContent(d.report_content || '')
      setReportMeta({
        key_findings_count: d.key_findings_count ?? 0,
        high_risk_count: d.high_risk_count ?? 0,
        placeholders: d.placeholders ?? [],
      })
      msg('审计报告草稿已生成')
    } catch (e) { msg(e instanceof Error ? e.message : '起草失败', true) }
    finally { setDrafting(false) }
  }

  const exportReport = async (fmt: 'docx' | 'pdf') => {
    if (!reportContent || !selected) return
    setExportLoading(fmt)
    try {
      const r = await fetch(`${BASE}/projects/${selected.id}/export-report`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_content: reportContent, fmt, cpa_firm: cpaFirm || undefined }),
      })
      if (!r.ok) throw new Error(`${r.status}`)
      const blob = await r.blob()
      const ext = fmt === 'docx' ? 'docx' : 'pdf'
      const filename = `${selected.name}_${selected.fiscal_year}审计报告.${ext}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      msg(`已下载 ${filename}`)
    } catch (e) { msg(e instanceof Error ? e.message : '导出失败', true) }
    finally { setExportLoading(null) }
  }

  const selectedOpinion = OPINION_OPTIONS.find(o => o.value === opinionType)

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toast */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-700 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{success}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-4">

        {/* ── 标题栏 ───────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10">
              <ClipboardCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">审计报告</h2>
              <p className="text-xs text-muted-foreground">AI 起草 · Word/PDF 导出 · IPO 年审覆盖核查</p>
            </div>
          </div>
          <button onClick={loadProjects} disabled={loading}
            className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-50 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* ── IPO 年审覆盖度核查（可折叠区域） ─────────── */}
        <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-2">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            IPO 年审覆盖度核查（三年一期）
          </p>
          <div className="flex gap-2">
            <input
              value={companyId}
              onChange={e => setCompanyId(e.target.value)}
              placeholder="企业 UUID（在「今日」→「企业信息」中查看）"
              className="flex-1 h-8 px-2 rounded-lg border border-border/50 bg-background text-xs focus:outline-none"
            />
            <button onClick={checkCoverage} disabled={checkingCoverage}
              className="h-8 px-3 rounded-lg text-xs font-medium border border-border/50 hover:bg-muted disabled:opacity-50 transition-colors flex items-center gap-1.5">
              {checkingCoverage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              检查
            </button>
          </div>
          {coverage && (
            <div className="space-y-1.5">
              <p className={`text-xs font-medium ${coverage.all_covered ? 'text-green-700' : 'text-orange-600'}`}>
                {coverage.summary}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {coverage.coverage.map(c => (
                  <div key={c.fiscal_year}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs ${c.covered ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {c.covered ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {c.fiscal_year}年
                    {c.covered && c.status && <span className="opacity-60 text-[11px]">·{c.status}</span>}
                  </div>
                ))}
              </div>
              {coverage.missing_years.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  缺失年度需委托会计师事务所补充年审，并在「审计」模块中创建对应项目（类型选 external/annual）后，此处即可显示覆盖。
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── 选择审计项目 ────────────────────────────── */}
        <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">选择审计项目</p>
            <span className="text-xs text-muted-foreground">{projects.length} 个项目</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">暂无审计项目</p>
              <p className="text-xs mt-1">请在「工具」→「审计项目」中创建</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelected(p); setReportContent(''); setReportMeta(null) }}
                  className={`w-full flex items-start gap-2 p-2 rounded-lg border text-left transition-colors
                    ${selected?.id === p.id
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border/30 hover:bg-muted/50'}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">{p.fiscal_year}年</span>
                      <span className="text-[11px] text-muted-foreground">{AUDIT_TYPE_LABEL[p.audit_type] ?? p.audit_type}</span>
                    </div>
                  </div>
                  <span className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded-md ${STATUS_COLOR[p.status] ?? 'bg-muted text-muted-foreground'}`}>
                    {p.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── 起草参数 ──────────────────────────────── */}
        <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-3">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            AI 起草审计报告
            {selected && <span className="font-normal text-muted-foreground">— {selected.name}（{selected.fiscal_year}年）</span>}
          </p>

          <div className="grid grid-cols-2 gap-2">
            {/* 意见类型 */}
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">意见类型</label>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {OPINION_OPTIONS.map(o => (
                  <button key={o.value}
                    onClick={() => setOpinionType(o.value)}
                    className={`text-xs px-2 py-1.5 rounded-lg border transition-colors text-left
                      ${opinionType === o.value
                        ? 'border-primary bg-primary/5 font-medium'
                        : 'border-border/40 hover:bg-muted/50'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              {selectedOpinion && opinionType !== 'unqualified' && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠ {opinionType === 'qualified' ? '保留意见将影响 IPO 申报合规性，请提前与交易所沟通。' :
                      opinionType === 'adverse' ? '否定意见通常导致 IPO 申请被否决，需重新审视财务数据。' :
                      '无法表示意见属于最严重情形，企业需全面整改后重新审计。'}
                </p>
              )}
            </div>

            {/* 事务所 */}
            <div>
              <label className="text-xs text-muted-foreground">会计师事务所</label>
              <input value={cpaFirm} onChange={e => setCpaFirm(e.target.value)}
                placeholder="例：普华永道"
                className="mt-1 w-full h-8 px-2 rounded-lg border border-border/50 bg-background text-xs focus:outline-none" />
            </div>

            {/* 签字 CPA */}
            <div>
              <label className="text-xs text-muted-foreground">签字注册会计师</label>
              <input value={cpaNames} onChange={e => setCpaNames(e.target.value)}
                placeholder="张三、李四（用「、」分隔）"
                className="mt-1 w-full h-8 px-2 rounded-lg border border-border/50 bg-background text-xs focus:outline-none" />
            </div>

            {/* 额外背景 */}
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">额外说明（可选，如核查发现摘要）</label>
              <textarea value={context} onChange={e => setContext(e.target.value)} rows={2}
                placeholder="例：本次审计发现应收账款核销政策变更，已与管理层充分沟通..."
                className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border/50 bg-background text-xs focus:outline-none resize-none" />
            </div>
          </div>

          {/* 关键审计事项开关 */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="kam-full" checked={includeKAM} onChange={e => setIncludeKAM(e.target.checked)}
              className="w-3.5 h-3.5 rounded" />
            <label htmlFor="kam-full" className="text-xs cursor-pointer">
              包含关键审计事项段（CAS 1504）
              <span className="text-muted-foreground ml-1">— 上市公司 / IPO 申报必选</span>
            </label>
          </div>

          <button onClick={draftReport} disabled={drafting || !selected}
            className="w-full h-9 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {drafting ? 'AI 起草中…' : 'AI 起草审计报告'}
          </button>
        </div>

        {/* ── 报告草稿 + 导出 ──────────────────────── */}
        {reportContent && (
          <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">审计报告草稿</p>
                {reportMeta && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    发现 {reportMeta.key_findings_count} 项（高风险 {reportMeta.high_risk_count} 项）
                    {reportMeta.placeholders.length > 0 && `，${reportMeta.placeholders.length} 处待补充`}
                  </p>
                )}
              </div>
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

            {reportMeta && reportMeta.placeholders.length > 0 && (
              <div className="px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs font-medium text-amber-700 mb-1">需补充内容：</p>
                <div className="flex flex-wrap gap-1">
                  {reportMeta.placeholders.map((p, i) => (
                    <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{p}</span>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={reportContent}
              onChange={e => setReportContent(e.target.value)}
              className="w-full rounded-lg border border-border/50 bg-background text-xs p-2 focus:outline-none resize-none font-mono leading-relaxed"
              rows={20}
            />
            <p className="text-xs text-muted-foreground">
              可直接在文本框中编辑，修改完成后点击导出。【待补充：xxx】为需企业方填写的信息。
            </p>
          </div>
        )}

        {/* 底部提示 */}
        {!reportContent && !drafting && (
          <div className="rounded-xl border border-dashed border-border/50 p-6 text-center text-muted-foreground space-y-2">
            <ClipboardCheck className="w-8 h-8 mx-auto opacity-20" />
            <p className="text-xs">选择审计项目后，点击「AI 起草审计报告」</p>
            <p className="text-xs opacity-70">支持无保留/保留/否定/无法表示四种意见类型，符合中国审计准则（CAS）</p>
          </div>
        )}

      </div>
    </div>
  )
}
