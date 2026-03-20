/**
 * 第二幕：AI 专家团队登场
 *
 * 头像依次亮起（灰色 → 彩色），模拟 Agent 协作热力图效果。
 */

import { subProgress, easeOut } from '@/hooks/useScrollytelling'
import ParticleField from '@/components/ParticleField'

interface AgentDef {
  name: string
  description: string
}

interface Props {
  progress: number
  solutionName: string
  agents: AgentDef[]
  entrepreneurPurpose: string
}

const AGENT_COLORS = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-emerald-600',
  'from-amber-500 to-amber-600',
  'from-violet-500 to-violet-600',
  'from-rose-500 to-rose-600',
  'from-cyan-500 to-cyan-600',
  'from-orange-500 to-orange-600',
]

export default function ExpertsChapter({
  progress,
  solutionName,
  agents,
  entrepreneurPurpose,
}: Props) {
  const titleP = subProgress(progress, 0.05, 0.2)
  const agentCount = agents.length

  return (
    <div className="space-y-8">
      {/* 标题 */}
      <div className="text-center" style={{ opacity: titleP }}>
        <p className="text-xs text-primary/60 tracking-widest uppercase mb-2">
          AI 专家团队
        </p>
        <h2 className="text-2xl font-bold text-foreground/90">
          {solutionName} — {agentCount} 位 AI 专家到位
        </h2>
        <p className="text-sm text-muted-foreground/60 mt-2 max-w-lg mx-auto">
          {entrepreneurPurpose}
        </p>
      </div>

      {/* 专家头像矩阵 */}
      <div className="flex flex-wrap justify-center gap-6 mt-8">
        {agents.map((agent, i) => {
          const agentP = subProgress(progress, 0.15 + (i / agentCount) * 0.5, 0.3 + (i / agentCount) * 0.5)
          const isActive = agentP > 0.3
          const colorIdx = i % AGENT_COLORS.length

          return (
            <div
              key={i}
              className="flex flex-col items-center gap-2 w-24"
              style={{
                opacity: Math.max(0.15, agentP),
                transform: `scale(${0.8 + easeOut(agentP) * 0.2})`,
                transition: 'filter 0.3s',
                filter: isActive ? 'grayscale(0)' : 'grayscale(1)',
              }}
            >
              {/* 头像圆 */}
              <div className="relative">
                <div
                  className={`w-14 h-14 rounded-full bg-gradient-to-br ${AGENT_COLORS[colorIdx]} flex items-center justify-center text-white text-lg font-bold shadow-lg`}
                  style={{
                    boxShadow: isActive
                      ? `0 0 ${20 * agentP}px hsl(var(--primary) / ${0.3 * agentP})`
                      : 'none',
                  }}
                >
                  {agent.name.charAt(0)}
                </div>
                {/* 脉冲环 */}
                {isActive && agentP < 0.9 && (
                  <div
                    className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping"
                    style={{ animationDuration: '1.5s' }}
                  />
                )}
              </div>

              {/* 名称 */}
              <span
                className={`text-[11px] font-medium text-center leading-tight ${
                  isActive ? 'text-foreground/90' : 'text-muted-foreground/40'
                }`}
              >
                {agent.name}
              </span>

              {/* 描述 */}
              <span
                className="text-[9px] text-muted-foreground/40 text-center leading-tight"
                style={{ opacity: agentP > 0.5 ? (agentP - 0.5) * 2 : 0 }}
              >
                {agent.description}
              </span>
            </div>
          )
        })}
      </div>

      {/* 粒子协作动效（滚动到 60%+ 时显现） */}
      <div
        className="relative h-24 mt-4 rounded-lg overflow-hidden"
        style={{ opacity: subProgress(progress, 0.55, 0.75) }}
      >
        <ParticleField
          accentColor="hsl(var(--primary))"
          nodeCount={agentCount}
          particleDensity={Math.min(50, agentCount * 8)}
          className="absolute inset-0"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground/40 bg-background/60 px-3 py-1 rounded-full">
            AI 专家协作中
          </span>
        </div>
      </div>
    </div>
  )
}
