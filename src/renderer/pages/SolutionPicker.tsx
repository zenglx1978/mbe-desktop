import { useNavigate } from 'react-router-dom'
import { SOLUTION_REGISTRY, type SolutionConfig } from '@/lib/solution-router'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { LogOut, Zap, Briefcase } from 'lucide-react'
import { getSolutionIcon } from '@/lib/solution-icons'

/* ── K5: 行业分类引导 ── */
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

export default function SolutionPicker() {
  const navigate = useNavigate()
  const setSolution = useAppStore((s) => s.setSolution)
  const user = useAuthStore((s) => s.user)

  function handlePick(id: string) {
    setSolution(id)
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* ── 顶部用户栏 ── */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">选择行业方案</h1>
            <p className="text-muted-foreground text-sm">
              每个方案为你派遣一支 AI 专家团队 — 选一个开始省钱
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              {/* N2: 退出按钮增强可供性 */}
              <button
                onClick={() => {
                  useAuthStore.getState().logout()
                  navigate('/auth', { replace: true })
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors px-3 py-1.5 rounded-md border border-border/50 hover:border-red-400/30 hover:bg-red-500/10"
                aria-label="退出登录"
              >
                <LogOut className="w-3.5 h-3.5" />
                退出
              </button>
            </div>
          )}
        </div>

        {/* ── D8: 空状态 ── */}
        {SOLUTION_REGISTRY.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Briefcase className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">暂无可用方案</p>
            <p className="text-muted-foreground/60 text-sm mt-1">请联系管理员配置行业方案</p>
          </div>
        ) : (
          <div className="space-y-8">
            {CATEGORIES.map((cat) => {
              const solutions = cat.ids
                .map(findSolution)
                .filter((s): s is SolutionConfig => !!s)
              if (solutions.length === 0) return null
              return (
                <section key={cat.label} aria-label={cat.label}>
                  {/* K5: 分类标题 */}
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pl-1">
                    {cat.label}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {solutions.map((s) => {
                      const Icon = getSolutionIcon(s.id)
                      return (
                        <button
                          key={s.id}
                          onClick={() => handlePick(s.id)}
                          aria-label={`选择${s.name}`}
                          className="group flex flex-col p-5 rounded-xl bg-card border border-border hover:border-primary/50 transition-all text-left hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <div className="flex items-start justify-between mb-3">
                            {/* MBE-P2: SVG 图标 + 主色背景 */}
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                              <Icon className="w-5 h-5" />
                            </div>
                            {/* A4 + D4: 效率标签语义化 + 色盲友好（图标+文字） */}
                            {s.valueEquivalent && (
                              <span
                                className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                                title={`人工 ${s.valueEquivalent.humanHours} 小时的工作，MBE 仅需 ${s.valueEquivalent.mbeMinutes} 分钟`}
                                aria-label={`效率提升：人工 ${s.valueEquivalent.humanHours} 小时缩短为 ${s.valueEquivalent.mbeMinutes} 分钟`}
                              >
                                <Zap className="w-3 h-3 shrink-0" />
                                {s.valueEquivalent.humanHours}h→{s.valueEquivalent.mbeMinutes}min
                              </span>
                            )}
                          </div>
                          {/* T1: 字体层级修正 */}
                          <span className="font-semibold text-foreground leading-tight">{s.name}</span>
                          <span className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                            {s.tagline}
                          </span>
                          {s.profitMetrics.length > 0 && (
                            <span className="text-xs text-primary/80 mt-3 pt-3 border-t border-border/50 leading-relaxed line-clamp-1">
                              {s.profitMetrics[0]}
                            </span>
                          )}
                        </button>
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
