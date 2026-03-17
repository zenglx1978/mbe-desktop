import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { SOLUTION_REGISTRY, type SolutionConfig } from '@/lib/solution-router'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { LogOut, Zap, Briefcase, Search, Users, Wrench, Workflow } from 'lucide-react'
import { getSolutionIcon } from '@/lib/solution-icons'
import UpdateBanner from '@/components/UpdateBanner'

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

export default function SolutionPicker() {
  const navigate = useNavigate()
  const setSolution = useAppStore((s) => s.setSolution)
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return CATEGORIES
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
  }, [search])

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

          {/* 标题 + 副标题 */}
          <div className="max-w-2xl mb-6 animate-fade-in-up">
            <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">
              选择行业方案
            </h1>
            <p className="text-muted-foreground text-[15px] leading-relaxed">
              每个方案为你派遣一支 AI 专家团队 — 选一个开始省钱
            </p>
          </div>

          {/* 搜索 + 统计 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索方案名称或关键词..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-card border border-border/40 rounded-xl text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/15 transition-all"
              />
            </div>
            <div className="flex items-center gap-5 text-xs text-muted-foreground/60">
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

      {/* ── 方案网格 ── */}
      <div className="max-w-6xl mx-auto px-6 md:px-8 pb-12">
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
