import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { SOLUTION_REGISTRY, type SolutionConfig } from '@/lib/solution-router'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { LogOut, Zap, Briefcase, Search, Users, Wrench, Workflow, Sparkles, Scan, ArrowRight, ChevronDown } from 'lucide-react'
import { getSolutionIcon } from '@/lib/solution-icons'
import { API_BASE, authHeaders } from '@/lib/api-client'
import UpdateBanner from '@/components/UpdateBanner'

interface IndustryGuess {
  industry: string
  confidence: number
  matchedApps: string[]
  suggestedSolution: string
}

interface IntakeResult {
  id: string
  name: string
  icon: string
  tagline: string
  color: string
  confidence: number
  match_reasons: string[]
  ai_team_summary: string[]
  top_scenario?: { title: string; question: string } | null
}

const CATEGORIES: { label: string; ids: string[] }[] = [
  { label: '专业服务', ids: ['labor-dispatch', 'law-firm', 'finance-tax-service'] },
  { label: '工程 · 医疗', ids: ['construction-cost', 'clinic-respiratory'] },
  { label: '企业经营', ids: ['smb-operations', 'ecommerce-brand-service'] },
  { label: '教育培训', ids: ['study-abroad-consulting', 'education-training'] },
  { label: '金融保险', ids: ['insurance-operations', 'investment-research'] },
]

function findSolution(id: string): SolutionConfig | undefined {
  return SOLUTION_REGISTRY.find((s) => s.id === id)
}

function SolutionCard({ solution, index, onPick }: {
  solution: SolutionConfig
  index: number
  onPick: (id: string) => void
}) {
  const Icon = getSolutionIcon(solution.id)
  const color = solution.color

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget
    el.style.borderColor = color + '50'
    el.style.boxShadow = `0 0 0 1px ${color}15, 0 20px 40px -8px ${color}12`
  }, [color])

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget
    el.style.borderColor = ''
    el.style.boxShadow = ''
  }, [])

  return (
    <button
      onClick={() => onPick(solution.id)}
      aria-label={`选择${solution.name}`}
      className="solution-card group relative flex flex-col p-5 rounded-xl bg-card border border-border/50 text-left hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background animate-fade-in-up"
      style={{ animationDelay: `${index * 50}ms` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 顶部渐变高光 — hover 时显现，强化方案色彩身份 */}
      <div
        className="absolute top-0 left-5 right-5 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${color}50, transparent)` }}
      />

      <div className="flex items-start justify-between mb-3">
        {/* 方案独立色彩图标 — 每个方案有视觉身份 */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: color + '15', color }}
        >
          <Icon className="w-5 h-5" />
        </div>
        {/* 效率标签 — 用方案色着色 */}
        {solution.valueEquivalent && (
          <span
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ backgroundColor: color + '12', color }}
            title={`人工 ${solution.valueEquivalent.humanHours} 小时 → MBE ${solution.valueEquivalent.mbeMinutes} 分钟`}
            aria-label={`效率提升：${solution.valueEquivalent.humanHours}h→${solution.valueEquivalent.mbeMinutes}min`}
          >
            <Zap className="w-3 h-3 shrink-0" />
            {solution.valueEquivalent.humanHours}h→{solution.valueEquivalent.mbeMinutes}min
          </span>
        )}
      </div>

      <span className="font-semibold text-foreground leading-tight">{solution.name}</span>
      <span className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
        {solution.tagline}
      </span>

      {/* 利润指标 — 方案色彩强调 */}
      {solution.profitMetrics.length > 0 && (
        <span
          className="text-xs mt-3 pt-3 border-t border-border/30 leading-relaxed line-clamp-1"
          style={{ color: color + 'cc' }}
        >
          {solution.profitMetrics[0]}
        </span>
      )}

      {/* 底部元数据 — 渐进披露：专家数 · 工具数 · 流程数 */}
      <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {solution.agents.length} 位专家
        </span>
        {solution.tools.length > 0 && (
          <span className="flex items-center gap-1">
            <Wrench className="w-3 h-3" />
            {solution.tools.length} 工具
          </span>
        )}
        {solution.workflows.length > 0 && (
          <span className="flex items-center gap-1">
            <Workflow className="w-3 h-3" />
            {solution.workflows.length} 流程
          </span>
        )}
      </div>
    </button>
  )
}

const POPULAR_TAGS = [
  { label: '劳务派遣', query: '我是劳务派遣公司' },
  { label: '律所', query: '我是律师事务所' },
  { label: '财税服务', query: '我需要记账报税' },
  { label: '电商品牌', query: '我做电商' },
  { label: '中小企业', query: '我是中小企业老板' },
  { label: '保险', query: '我做保险' },
  { label: '工程造价', query: '我做工程造价' },
  { label: '投资研究', query: '我做投资分析' },
  { label: '留学', query: '我要出国留学' },
]

export default function SolutionPicker() {
  const navigate = useNavigate()
  const setSolution = useAppStore((s) => s.setSolution)
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const [industryGuesses, setIndustryGuesses] = useState<IndustryGuess[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanDone, setScanDone] = useState(false)
  const [intakeResults, setIntakeResults] = useState<IntakeResult[]>([])
  const [intakeLoading, setIntakeLoading] = useState(false)
  const [intakeQuery, setIntakeQuery] = useState('')
  const [showAllSolutions, setShowAllSolutions] = useState(false)
  const intakeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.miner?.scan) return

    setScanning(true)
    api.miner.scan()
      .then((result: { industryGuesses: IndustryGuess[] }) => {
        if (result.industryGuesses?.length > 0) {
          setIndustryGuesses(result.industryGuesses.slice(0, 3))
        }
      })
      .catch(() => {})
      .finally(() => {
        setScanning(false)
        setScanDone(true)
      })
  }, [])

  const runIntake = useCallback(async (query: string) => {
    if (!query.trim()) return
    setIntakeLoading(true)
    setIntakeQuery(query)
    try {
      const res = await fetch(`${API_BASE}/api/v1/solutions/intake`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ query, limit: 3 }),
      })
      if (res.ok) {
        const data = await res.json()
        setIntakeResults(data.recommendations || [])
        setShowAllSolutions(false)
      }
    } catch {
      setIntakeResults([])
    } finally {
      setIntakeLoading(false)
    }
  }, [])

  const handleIntakeSubmit = useCallback(() => {
    runIntake(search)
  }, [search, runIntake])

  const handleTagClick = useCallback((query: string) => {
    setSearch(query)
    runIntake(query)
  }, [runIntake])

  const topRecommendation = industryGuesses[0]

  const filteredCategories = useMemo(() => {
    if (!search.trim() || intakeResults.length > 0) return CATEGORIES
    const q = search.toLowerCase()
    return CATEGORIES.map((cat) => ({
      ...cat,
      ids: cat.ids.filter((id) => {
        const s = findSolution(id)
        return s && (
          s.name.toLowerCase().includes(q) ||
          s.tagline.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
        )
      }),
    })).filter((cat) => cat.ids.length > 0)
  }, [search, intakeResults])

  const handlePick = useCallback((id: string) => {
    setSolution(id)
    navigate('/', { replace: true })
  }, [setSolution, navigate])

  const handleLogout = useCallback(() => {
    useAuthStore.getState().logout()
    navigate('/auth', { replace: true })
  }, [navigate])

  const totalExperts = useMemo(
    () => SOLUTION_REGISTRY.reduce((sum, s) => sum + s.agents.length, 0), []
  )
  const totalTools = useMemo(
    () => SOLUTION_REGISTRY.reduce((sum, s) => sum + s.tools.length, 0), []
  )

  let cardIndex = 0

  return (
    <div className="min-h-screen bg-background">
      <UpdateBanner />

      {/* ── Hero 区域 ── 渐变背景 + 标题 + 搜索 */}
      <div className="relative overflow-hidden">
        {/* 顶部渐变光晕 — 视觉深度暗示 */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/[0.03] rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 md:px-8 pt-8 pb-6">
          {/* 顶栏 — 品牌标识 + 用户信息 */}
          <div className="flex items-center justify-between mb-8 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <span className="text-primary font-bold text-sm tracking-tight">M</span>
              </div>
              <span className="text-sm font-medium text-muted-foreground/80">MBE Desktop</span>
            </div>
            {user && (
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors px-3 py-1.5 rounded-md border border-border/50 hover:border-red-400/30 hover:bg-red-500/10"
                  aria-label="退出登录"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  退出
                </button>
              </div>
            )}
          </div>

          {/* 标题 + 副标题 — 先问再选 */}
          <div className="max-w-2xl mb-6 animate-fade-in-up">
            <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">
              告诉我们你的行业
            </h1>
            <p className="text-muted-foreground text-[15px] leading-relaxed">
              一句话描述你做什么，AI 立刻为你匹配最合适的专家团队
            </p>
          </div>

          {/* Intake 输入框 + 发送按钮 */}
          <div className="flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground/50 pointer-events-none" />
              <input
                ref={intakeInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleIntakeSubmit()}
                placeholder="例如：我是律师事务所 / 我需要记账报税 / 我做电商..."
                className="w-full pl-11 pr-24 py-3.5 text-sm bg-card border border-border/40 rounded-xl text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all"
              />
              <button
                onClick={handleIntakeSubmit}
                disabled={!search.trim() || intakeLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {intakeLoading ? (
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                匹配
              </button>
            </div>

            {/* 热门标签 */}
            <div className="flex flex-wrap gap-2 max-w-xl">
              {POPULAR_TAGS.map((tag) => (
                <button
                  key={tag.label}
                  onClick={() => handleTagClick(tag.query)}
                  className="px-3 py-1.5 text-xs rounded-full border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  {tag.label}
                </button>
              ))}
            </div>

            {/* 统计 */}
            <div className="flex items-center gap-5 text-xs text-muted-foreground/60 mt-1">
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                {SOLUTION_REGISTRY.length} 个方案
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {totalExperts} 位专家
              </span>
              <span className="flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                {totalTools} 个工具
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 智能推荐横幅（基于已安装软件的行业推断） ── */}
      {(scanning || topRecommendation) && (
        <div className="max-w-6xl mx-auto px-6 md:px-8 mb-6">
          {scanning && !scanDone ? (
            <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-primary/20 bg-primary/5 animate-pulse">
              <Scan className="w-5 h-5 text-primary animate-spin" />
              <span className="text-sm text-primary/80">正在分析您的电脑环境，智能推荐最适合的方案...</span>
            </div>
          ) : topRecommendation ? (
            <div className="rounded-xl border border-primary/25 bg-gradient-to-r from-primary/[0.06] to-transparent p-5 animate-fade-in-up">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-foreground">为您智能推荐</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                      {Math.round(topRecommendation.confidence * 100)}% 匹配
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    检测到您的电脑安装了 <span className="text-foreground font-medium">{topRecommendation.matchedApps.slice(0, 3).join('、')}</span> 等软件，
                    您可能从事 <span className="text-primary font-medium">{topRecommendation.industry}</span> 相关工作
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {industryGuesses.map((guess) => {
                      const sol = findSolution(guess.suggestedSolution)
                      if (!sol) return null
                      return (
                        <button
                          key={guess.suggestedSolution}
                          onClick={() => handlePick(guess.suggestedSolution)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/20 bg-card hover:bg-primary/10 hover:border-primary/40 transition-all text-sm"
                        >
                          {(() => { const I = getSolutionIcon(sol.id); return <I className="w-4 h-4 text-primary" /> })()}
                          <span className="font-medium">{sol.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {Math.round(guess.confidence * 100)}%
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Intake 推荐结果 ── */}
      {intakeResults.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 md:px-8 mb-8 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              为「{intakeQuery}」推荐的方案
            </h2>
            <span className="text-xs text-muted-foreground/50">({intakeResults.length} 个匹配)</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {intakeResults.map((rec, i) => {
              const localSol = findSolution(rec.id)
              const Icon = localSol ? getSolutionIcon(localSol.id) : Briefcase
              const color = rec.color || localSol?.color || '#6366f1'
              return (
                <button
                  key={rec.id}
                  onClick={() => handlePick(rec.id)}
                  className="group relative flex flex-col p-5 rounded-xl bg-card border-2 text-left hover:-translate-y-0.5 transition-all animate-fade-in-up"
                  style={{
                    animationDelay: `${i * 80}ms`,
                    borderColor: color + '40',
                    boxShadow: `0 0 0 1px ${color}10, 0 8px 24px -4px ${color}15`,
                  }}
                >
                  <div
                    className="absolute top-0 left-5 right-5 h-0.5 rounded-full"
                    style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
                  />
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color + '15', color }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: color + '15', color }}
                    >
                      {Math.round(rec.confidence * 100)}% 匹配
                    </span>
                  </div>
                  <span className="font-semibold text-foreground text-base">{rec.name}</span>
                  <span className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                    {rec.tagline}
                  </span>
                  {rec.match_reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {rec.match_reasons.slice(0, 2).map((r, ri) => (
                        <span key={ri} className="text-[11px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                  {rec.ai_team_summary.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                        <Users className="w-3 h-3" />
                        {rec.ai_team_summary.slice(0, 3).join(' · ')}
                      </div>
                    </div>
                  )}
                  {rec.top_scenario && (
                    <div
                      className="mt-2 text-xs px-2.5 py-1.5 rounded-lg"
                      style={{ backgroundColor: color + '08', color: color + 'cc' }}
                    >
                      试试问：{rec.top_scenario.question}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* L3: 全部方案（默认折叠，需要用户主动展开） */}
      {!showAllSolutions && (
        <div className="text-center mb-6">
          <button
            onClick={() => setShowAllSolutions(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border/40 rounded-xl hover:border-border transition-all"
          >
            <ChevronDown className="w-4 h-4" />
            {intakeResults.length > 0 ? `不满意？浏览全部 ${SOLUTION_REGISTRY.length} 个方案` : `或者，浏览全部 ${SOLUTION_REGISTRY.length} 个行业方案`}
          </button>
        </div>
      )}
      <div className={`max-w-6xl mx-auto px-6 md:px-8 pb-12 ${!showAllSolutions ? 'hidden' : ''}`}>
        {SOLUTION_REGISTRY.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Briefcase className="w-12 h-12 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">暂无可用方案</p>
            <p className="text-muted-foreground/50 text-sm mt-1">请联系管理员配置行业方案</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
            <Search className="w-12 h-12 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">未找到匹配方案</p>
            <p className="text-muted-foreground/50 text-sm mt-1">试试其他关键词</p>
          </div>
        ) : (
          <div className="space-y-10">
            {filteredCategories.map((cat) => {
              const solutions = cat.ids
                .map(findSolution)
                .filter((s): s is SolutionConfig => !!s)
              if (solutions.length === 0) return null
              return (
                <section key={cat.label} aria-label={cat.label}>
                  {/* 分类标题 + 分隔线 — 清晰的视觉分组 */}
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider whitespace-nowrap">
                      {cat.label}
                    </h2>
                    <div className="flex-1 h-px bg-border/20" />
                    <span className="text-[11px] text-muted-foreground/40">{solutions.length} 个</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {solutions.map((s) => {
                      const idx = cardIndex++
                      return (
                        <SolutionCard
                          key={s.id}
                          solution={s}
                          index={idx}
                          onPick={handlePick}
                        />
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
