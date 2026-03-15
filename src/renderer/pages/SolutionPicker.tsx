import { useNavigate } from 'react-router-dom'
import { useAppStore, SOLUTION_REGISTRY } from '@/stores/app-store'
import type { SolutionConfig } from '@/lib/solution-router'

export default function SolutionPicker() {
  const navigate = useNavigate()
  const { pickSolution } = useAppStore()

  function handlePick(solution: SolutionConfig) {
    pickSolution(solution.id)
    navigate('/workspace', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight">MBE Desktop</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            AI 专业服务
          </span>
        </div>
        <p className="text-sm text-muted-foreground">选择你的行业，AI 专家团队即刻到位</p>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center px-8 py-12">
        <div className="text-center mb-12 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            选择你的<span className="text-primary">行业方案</span>
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            每个方案包含一支 AI 专家团队，为你的行业量身组建。
            选择后可随时切换到其他方案。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl w-full">
          {SOLUTION_REGISTRY.map((sol) => (
            <SolutionCard key={sol.id} solution={sol} onPick={handlePick} />
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-10">
          数据存储在你的电脑上 · 断线后核心功能仍可用 · 咨询永远免费
        </p>
      </main>
    </div>
  )
}

function SolutionCard({ solution, onPick }: { solution: SolutionConfig; onPick: (s: SolutionConfig) => void }) {
  const agentCount = solution.agents.length

  return (
    <button
      onClick={() => onPick(solution)}
      className="group relative flex flex-col p-6 rounded-xl border border-border/50 bg-card hover:border-primary/50 hover:bg-card/80 transition-all duration-200 text-left cursor-pointer"
    >
      {/* 顶部色条 */}
      <div
        className="absolute top-0 left-6 right-6 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: solution.color }}
      />

      <div className="flex items-start justify-between mb-4">
        <span className="text-3xl">{solution.icon}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
          {agentCount} 位 AI 专家
        </span>
      </div>

      <h3 className="font-semibold text-lg mb-1.5 group-hover:text-primary transition-colors">
        {solution.name}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
        {solution.tagline}
      </p>

      {/* AI 专家列表 */}
      <div className="space-y-1.5">
        {solution.agents.map((agent, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: solution.color }} />
            <span className="font-medium text-foreground/80">{agent.role}</span>
            <span className="text-muted-foreground/60">· {agent.handles}</span>
          </div>
        ))}
      </div>

      {/* Hover 指示 */}
      <div className="mt-5 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        开始使用 →
      </div>
    </button>
  )
}
