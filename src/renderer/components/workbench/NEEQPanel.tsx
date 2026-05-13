/**
 * 新三板面板 — 挂牌评估 / 创新层评分 / 北交所转板 / 年报指引 / 财税问答
 *
 * 对接 /api/finance/neeq/...
 */
import { useState } from 'react'
import {
  TrendingUp, BarChart3, Building2, FileText, MessageSquare,
  Loader2, CheckCircle2, AlertCircle, ChevronRight, ArrowLeft,
  Sparkles, Info,
} from 'lucide-react'
import type { SolutionConfig } from '@/lib/solution-router'
import { API_BASE, authHeaders } from '@/lib/api-client'

interface Props { solution: SolutionConfig }

type View = 'menu' | 'listing' | 'innovation' | 'bse' | 'annual' | 'advisory'

const MENU_ITEMS = [
  {
    id: 'listing' as View,
    icon: <Building2 className="w-5 h-5 text-blue-600" />,
    color: 'bg-blue-500/10',
    title: '挂牌条件评估',
    desc: '基础层 / 创新层资格核查 + AI 整改建议',
  },
  {
    id: 'innovation' as View,
    icon: <TrendingUp className="w-5 h-5 text-emerald-600" />,
    color: 'bg-emerald-500/10',
    title: '创新层评分',
    desc: '盈利型 / 成长型 / 市值型三套标准核算',
  },
  {
    id: 'bse' as View,
    icon: <BarChart3 className="w-5 h-5 text-purple-600" />,
    color: 'bg-purple-500/10',
    title: '北交所转板评估',
    desc: '四套财务标准 + 准备度打分 + 行动计划',
  },
  {
    id: 'annual' as View,
    icon: <FileText className="w-5 h-5 text-amber-600" />,
    color: 'bg-amber-500/10',
    title: '年报编制指引',
    desc: 'AI 生成基础层 / 创新层年报合规检查清单',
  },
  {
    id: 'advisory' as View,
    icon: <MessageSquare className="w-5 h-5 text-rose-600" />,
    color: 'bg-rose-500/10',
    title: '财税专项问答',
    desc: '股权融资税务 / 分红 / 股权激励 / 关联交易',
  },
]

// ── 通用小组件 ────────────────────────────────────────────

function BackBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
        <ArrowLeft className="w-4 h-4" />
      </button>
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className="w-full h-8 px-2 rounded-lg border border-border/50 bg-background text-xs focus:outline-none" />
  )
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select {...props}
      className="w-full h-8 px-2 rounded-lg border border-border/50 bg-background text-xs focus:outline-none">
      {children}
    </select>
  )
}

function SubmitBtn({ loading, disabled, children }: { loading: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={loading || disabled}
      className="w-full h-9 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      {loading ? 'AI 分析中…' : children}
    </button>
  )
}

function ResultBox({ title, content }: { title?: string; content: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1">
      {title && <p className="text-xs font-semibold">{title}</p>}
      <pre className="text-xs whitespace-pre-wrap leading-relaxed font-sans">{content}</pre>
    </div>
  )
}

// ── 1. 挂牌条件评估 ───────────────────────────────────────

function ListingView({ BASE, onBack }: { BASE: string; onBack: () => void }) {
  const [form, setForm] = useState({
    company_name: '', operating_years: '3', registered_capital: '500',
    shareholder_count: '50', is_joint_stock: false,
    revenue_y1: '', revenue_y2: '', net_profit_y1: '', net_profit_y2: '',
    net_assets: '', has_qualified_auditor: false, has_basic_governance: false,
    has_major_violation: false, extra_context: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await fetch(`${BASE}/listing-assessment`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          operating_years: parseFloat(form.operating_years) || 0,
          registered_capital: parseFloat(form.registered_capital) || 0,
          shareholder_count: parseInt(form.shareholder_count) || 0,
          revenue_y1: parseFloat(form.revenue_y1) || 0,
          revenue_y2: parseFloat(form.revenue_y2) || 0,
          net_profit_y1: parseFloat(form.net_profit_y1) || 0,
          net_profit_y2: parseFloat(form.net_profit_y2) || 0,
          net_assets: parseFloat(form.net_assets) || 0,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || `${r.status}`)
      setResult(d)
    } catch (e) { setError(e instanceof Error ? e.message : '请求失败') }
    finally { setLoading(false) }
  }

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(v => ({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  return (
    <div className="space-y-3">
      <BackBar title="挂牌条件评估（基础层 / 创新层）" onBack={onBack} />
      <form onSubmit={onSubmit} className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="企业名称">
            <Input value={form.company_name} onChange={f('company_name')} placeholder="例：XX 科技股份有限公司" required />
          </Field>
          <Field label="持续经营年数">
            <Input type="number" value={form.operating_years} onChange={f('operating_years')} step="0.5" />
          </Field>
          <Field label="注册资本（万元）">
            <Input type="number" value={form.registered_capital} onChange={f('registered_capital')} />
          </Field>
          <Field label="股东人数">
            <Input type="number" value={form.shareholder_count} onChange={f('shareholder_count')} />
          </Field>
        </div>

        <p className="text-xs font-medium text-muted-foreground border-t border-border/30 pt-2">财务数据（万元）</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['上上年营业收入', 'revenue_y1'], ['上年营业收入', 'revenue_y2'],
            ['上上年净利润', 'net_profit_y1'], ['上年净利润', 'net_profit_y2'],
            ['上年末净资产', 'net_assets'],
          ].map(([label, key]) => (
            <Field key={key} label={label as string}>
              <Input type="number" value={(form as any)[key]} onChange={f(key)} placeholder="0" />
            </Field>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {([
            ['is_joint_stock', '已完成股份制改造'],
            ['has_qualified_auditor', '已委托证券资格会计师所'],
            ['has_basic_governance', '已建立三会一层'],
            ['has_major_violation', '存在重大违法违规（风险项）'],
          ] as [string, string][]).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={(form as any)[key]} onChange={f(key)} className="w-3.5 h-3.5 rounded" />
              {label}
            </label>
          ))}
        </div>

        <Field label="其他背景说明（可选）">
          <input value={form.extra_context} onChange={f('extra_context')}
            className="w-full h-8 px-2 rounded-lg border border-border/50 bg-background text-xs focus:outline-none"
            placeholder="例：已取得高新企业认定、正在申请专精特新..." />
        </Field>

        {error && <p className="text-xs text-destructive">{error}</p>}
        <SubmitBtn loading={loading}>评估挂牌条件</SubmitBtn>
      </form>

      {result && (
        <div className="space-y-2">
          {/* 总结卡 */}
          <div className={`rounded-xl p-3 border ${result.any_financial_met && result.basic_eligibility ? 'border-green-500/30 bg-green-500/5' : 'border-orange-500/30 bg-orange-500/5'}`}>
            <p className={`text-xs font-semibold ${result.any_financial_met && result.basic_eligibility ? 'text-green-700' : 'text-orange-700'}`}>
              {result.summary}
            </p>
          </div>

          {/* 主体资格问题 */}
          {result.basic_issues.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-1">
              <p className="text-xs font-semibold flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 text-orange-500" />主体资格问题</p>
              {result.basic_issues.map((i: string, idx: number) => (
                <p key={idx} className="text-xs text-orange-700 pl-4">• {i}</p>
              ))}
            </div>
          )}

          {/* 财务条件核查 */}
          <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-1.5">
            <p className="text-xs font-semibold">财务条件核查（满足任一即可）</p>
            {result.financial_checks.map((c: any) => (
              <div key={c.condition_id} className={`flex items-start gap-2 text-xs p-1.5 rounded-lg ${c.met ? 'bg-green-100' : 'bg-muted/30'}`}>
                {c.met ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                <div>
                  <p className={`font-medium ${c.met ? 'text-green-700' : 'text-muted-foreground'}`}>{c.condition_id}. {c.condition_name}</p>
                  <p className="text-muted-foreground">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <ResultBox title="AI 整改建议" content={result.ai_remediation} />
        </div>
      )}
    </div>
  )
}

// ── 2. 创新层评分 ─────────────────────────────────────────

function InnovationView({ BASE, onBack }: { BASE: string; onBack: () => void }) {
  const [form, setForm] = useState({
    company_name: '', current_layer: 'basic',
    revenue_y1: '', revenue_y2: '', net_profit_y1: '', net_profit_y2: '',
    net_assets: '', registered_capital: '', avg_market_cap_3m: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(''); setResult(null)
    try {
      const r = await fetch(`${BASE}/innovation-score`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          revenue_y1: parseFloat(form.revenue_y1) || 0,
          revenue_y2: parseFloat(form.revenue_y2) || 0,
          net_profit_y1: parseFloat(form.net_profit_y1) || 0,
          net_profit_y2: parseFloat(form.net_profit_y2) || 0,
          net_assets: parseFloat(form.net_assets) || 0,
          registered_capital: parseFloat(form.registered_capital) || 0,
          avg_market_cap_3m: form.avg_market_cap_3m ? parseFloat(form.avg_market_cap_3m) : undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || `${r.status}`)
      setResult(d)
    } catch (e) { setError(e instanceof Error ? e.message : '请求失败') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <BackBar title="创新层升层 / 维持评分" onBack={onBack} />
      <form onSubmit={onSubmit} className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <Field label="企业名称">
              <Input value={form.company_name} onChange={f('company_name')} required />
            </Field>
          </div>
          <Field label="当前层次">
            <Select value={form.current_layer} onChange={f('current_layer')}>
              <option value="basic">基础层</option>
              <option value="innovation">创新层（评估维持条件）</option>
            </Select>
          </Field>
          <Field label="近3月日均市值（万元）">
            <Input type="number" value={form.avg_market_cap_3m} onChange={f('avg_market_cap_3m')} placeholder="做市/竞价公司填写" />
          </Field>
          {[
            ['上上年营业收入', 'revenue_y1'], ['上年营业收入', 'revenue_y2'],
            ['上上年净利润', 'net_profit_y1'], ['上年净利润', 'net_profit_y2'],
            ['上年末净资产', 'net_assets'], ['股本总额', 'registered_capital'],
          ].map(([label, key]) => (
            <Field key={key} label={`${label}（万元）`}>
              <Input type="number" value={(form as any)[key]} onChange={f(key)} placeholder="0" />
            </Field>
          ))}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <SubmitBtn loading={loading}>评分创新层资格</SubmitBtn>
      </form>

      {result && (
        <div className="space-y-2">
          <div className={`rounded-xl p-3 border ${result.can_enter_innovation || result.can_maintain_innovation ? 'border-green-500/30 bg-green-500/5' : 'border-orange-500/30 bg-orange-500/5'}`}>
            <p className="text-xs font-semibold">
              {result.can_enter_innovation || result.can_maintain_innovation
                ? `✓ 满足创新层条件（${result.eligible_standards.join(', ')}）`
                : '✗ 暂不满足创新层标准'}
            </p>
          </div>

          <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-1.5">
            <p className="text-xs font-semibold">三套标准详情</p>
            {result.standard_checks.map((c: any) => (
              <div key={c.standard_id} className={`text-xs p-2 rounded-lg flex items-start gap-2 ${c.eligible ? 'bg-green-100' : 'bg-muted/30'}`}>
                {c.eligible ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                <div>
                  <p className={`font-medium ${c.eligible ? 'text-green-700' : ''}`}>{c.standard_name}</p>
                  {!c.eligible && c.details && (
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      {Object.entries(c.details)
                        .filter(([k]) => !k.startsWith('required'))
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' | ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <ResultBox title="建议" content={result.recommendation} />
        </div>
      )}
    </div>
  )
}

// ── 3. 北交所转板评估 ─────────────────────────────────────

function BSEView({ BASE, onBack }: { BASE: string; onBack: () => void }) {
  const [form, setForm] = useState({
    company_name: '', months_in_innovation_layer: '0',
    avg_market_cap_wan: '', revenue_y1: '', revenue_y2: '',
    net_profit_y1: '', net_profit_y2: '', net_assets: '',
    is_zhuangjingtexin: false, has_internal_control_report: false, major_violations: false,
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(v => ({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(''); setResult(null)
    try {
      const r = await fetch(`${BASE}/bse-readiness`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          months_in_innovation_layer: parseInt(form.months_in_innovation_layer) || 0,
          avg_market_cap_wan: parseFloat(form.avg_market_cap_wan) || 0,
          revenue_y1: parseFloat(form.revenue_y1) || 0,
          revenue_y2: parseFloat(form.revenue_y2) || 0,
          net_profit_y1: parseFloat(form.net_profit_y1) || 0,
          net_profit_y2: parseFloat(form.net_profit_y2) || 0,
          net_assets: parseFloat(form.net_assets) || 0,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || `${r.status}`)
      setResult(d)
    } catch (e) { setError(e instanceof Error ? e.message : '请求失败') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <BackBar title="北交所转板准备度评估" onBack={onBack} />
      <form onSubmit={onSubmit} className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <Field label="企业名称"><Input value={form.company_name} onChange={f('company_name')} required /></Field>
          </div>
          <Field label="创新层挂牌月数">
            <Input type="number" value={form.months_in_innovation_layer} onChange={f('months_in_innovation_layer')} />
          </Field>
          <Field label="近期日均市值（万元）">
            <Input type="number" value={form.avg_market_cap_wan} onChange={f('avg_market_cap_wan')} />
          </Field>
          {[
            ['上上年营收', 'revenue_y1'], ['上年营收', 'revenue_y2'],
            ['上上年净利润', 'net_profit_y1'], ['上年净利润', 'net_profit_y2'],
            ['上年末净资产', 'net_assets'],
          ].map(([label, key]) => (
            <Field key={key} label={`${label}（万元）`}>
              <Input type="number" value={(form as any)[key]} onChange={f(key)} placeholder="0" />
            </Field>
          ))}
          <div className="col-span-2 grid grid-cols-3 gap-2 text-xs">
            {([
              ['is_zhuangjingtexin', '专精特新认定'],
              ['has_internal_control_report', '已出具内控评价报告'],
              ['major_violations', '存在重大违规'],
            ] as [string, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={(form as any)[key]} onChange={f(key)} className="w-3.5 h-3.5 rounded" />
                {label}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <SubmitBtn loading={loading}>评估北交所转板准备度</SubmitBtn>
      </form>

      {result && (
        <div className="space-y-2">
          <div className={`rounded-xl p-3 border ${result.overall_ready ? 'border-green-500/30 bg-green-500/5' : result.any_standard_met ? 'border-blue-500/30 bg-blue-500/5' : 'border-orange-500/30 bg-orange-500/5'}`}>
            <p className={`text-xs font-semibold ${result.overall_ready ? 'text-green-700' : result.any_standard_met ? 'text-blue-700' : 'text-orange-700'}`}>
              {result.overall_ready ? '✓ 具备北交所上市申报条件'
                : result.any_standard_met ? '◑ 财务标准已满足，前置条件待完善'
                : `✗ 尚不具备条件，预计差距约 ${result.estimated_gap_months} 个月`}
            </p>
            {result.base_condition_issues.map((i: string, idx: number) => (
              <p key={idx} className="text-xs text-orange-600 mt-1">• {i}</p>
            ))}
          </div>

          <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-1.5">
            <p className="text-xs font-semibold">四套财务标准</p>
            {result.standard_results.map((s: any) => (
              <div key={s.standard_id} className={`text-xs p-2 rounded-lg flex items-start gap-2 ${s.met ? 'bg-green-100' : 'bg-muted/30'}`}>
                {s.met ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" /> : <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                <div>
                  <p className={`font-medium ${s.met ? 'text-green-700' : ''}`}>{s.standard_name}</p>
                  {!s.met && <p className="text-muted-foreground text-[11px]">{s.gap_description}</p>}
                </div>
              </div>
            ))}
          </div>

          <ResultBox title="AI 行动计划" content={result.ai_action_plan} />
        </div>
      )}
    </div>
  )
}

// ── 4. 年报编制指引 ───────────────────────────────────────

function AnnualView({ BASE, onBack }: { BASE: string; onBack: () => void }) {
  const [form, setForm] = useState({ company_name: '', layer: 'basic', fiscal_year: '2025', industry: '', special_events: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(v => ({ ...v, [k]: e.target.value }))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(''); setResult(null)
    try {
      const r = await fetch(`${BASE}/annual-report-guide`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, fiscal_year: parseInt(form.fiscal_year) }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || `${r.status}`)
      setResult(d)
    } catch (e) { setError(e instanceof Error ? e.message : '请求失败') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <BackBar title="年报编制指引" onBack={onBack} />
      <form onSubmit={onSubmit} className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <Field label="企业名称"><Input value={form.company_name} onChange={f('company_name')} required /></Field>
          </div>
          <Field label="挂牌层次">
            <Select value={form.layer} onChange={f('layer')}>
              <option value="basic">基础层</option>
              <option value="innovation">创新层</option>
              <option value="bse">北交所</option>
            </Select>
          </Field>
          <Field label="报告年度">
            <Input type="number" value={form.fiscal_year} onChange={f('fiscal_year')} />
          </Field>
          <div className="col-span-2">
            <Field label="行业（可选）"><Input value={form.industry} onChange={f('industry')} placeholder="例：软件开发" /></Field>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">本年重大事项（可选）</label>
            <textarea value={form.special_events} onChange={f('special_events')} rows={2}
              placeholder="例：完成 A 轮定增 5,000 万元、收购子公司..."
              className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border/50 bg-background text-xs focus:outline-none resize-none" />
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <SubmitBtn loading={loading}>生成年报编制指引</SubmitBtn>
      </form>

      {result && (
        <div className="space-y-2">
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-2 text-xs text-blue-700">
            披露截止：{result.deadline} · 审计要求：{result.audit_requirement}
          </div>
          <ResultBox content={result.guide} />
        </div>
      )}
    </div>
  )
}

// ── 5. 财税专项问答 ───────────────────────────────────────

const QUICK_QUESTIONS = [
  '新三板挂牌后还能享受小微企业税收优惠吗？',
  '定向增发（定增）的税务处理是怎样的？',
  '挂牌公司分红给个人股东要缴多少税？',
  '股权激励（限制性股票）如何递延纳税？',
  '实际控制人低价转让股权有哪些税务风险？',
]

function AdvisoryView({ BASE, onBack }: { BASE: string; onBack: () => void }) {
  const [question, setQuestion] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')

  const ask = async (q: string) => {
    const finalQ = q || question
    if (!finalQ.trim()) return
    setLoading(true); setError(''); setAnswer('')
    try {
      const r = await fetch(`${BASE}/tax-advisory`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: finalQ, company_context: context || undefined }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.detail || `${r.status}`)
      setAnswer(d.answer || '')
    } catch (e) { setError(e instanceof Error ? e.message : '请求失败') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      <BackBar title="新三板财税专项问答" onBack={onBack} />

      <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-2">
        <p className="text-xs font-semibold">快速提问</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_QUESTIONS.map(q => (
            <button key={q} onClick={() => { setQuestion(q); ask(q) }}
              className="text-[11px] px-2 py-1 rounded-lg border border-border/40 hover:bg-muted transition-colors text-left">
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/80 p-3 space-y-2">
        <Field label="企业背景（可选，如：创新层/制造业/500人）">
          <Input value={context} onChange={e => setContext(e.target.value)} placeholder="例：创新层挂牌 2 年，主营软件服务" />
        </Field>
        <Field label="您的问题">
          <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={3}
            placeholder="输入具体财税问题，AI 引用全国股转系统规则和税法回答..."
            className="w-full px-2 py-1.5 rounded-lg border border-border/50 bg-background text-xs focus:outline-none resize-none" />
        </Field>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button onClick={() => ask(question)} disabled={loading || !question.trim()}
          className="w-full h-9 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? '咨询中…' : '提交咨询'}
        </button>
      </div>

      {answer && <ResultBox title="AI 回答" content={answer} />}
    </div>
  )
}

// ── 主面板 ────────────────────────────────────────────────

export default function NEEQPanel({ solution: _solution }: Props) {
  const [view, setView] = useState<View>('menu')
  const BASE = `${API_BASE}/api/finance/neeq`

  const renderView = () => {
    switch (view) {
      case 'listing':    return <ListingView BASE={BASE} onBack={() => setView('menu')} />
      case 'innovation': return <InnovationView BASE={BASE} onBack={() => setView('menu')} />
      case 'bse':        return <BSEView BASE={BASE} onBack={() => setView('menu')} />
      case 'annual':     return <AnnualView BASE={BASE} onBack={() => setView('menu')} />
      case 'advisory':   return <AdvisoryView BASE={BASE} onBack={() => setView('menu')} />
      default: return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10">
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">新三板财税服务</h2>
              <p className="text-xs text-muted-foreground">挂牌评估 · 创新层 · 北交所转板 · 年报 · 税务咨询</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {MENU_ITEMS.map(item => (
              <button key={item.id} onClick={() => setView(item.id)}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card/80 hover:bg-muted/50 transition-colors text-left group">
                <div className={`p-2 rounded-xl ${item.color} shrink-0`}>{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-dashed border-border/50 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">知识库覆盖（2026 年版）</p>
            <p>· 基础层/创新层挂牌条件 &nbsp;· 北交所四套财务标准</p>
            <p>· 定向增发税务 &nbsp;· 股权激励递延纳税 &nbsp;· 年报信披义务</p>
            <p>· 分红个税 &nbsp;· 专精特新认定加成 &nbsp;· 转板通道</p>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 overflow-auto p-4">{renderView()}</div>
    </div>
  )
}
