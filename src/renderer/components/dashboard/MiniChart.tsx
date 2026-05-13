/**
 * 迷你趋势图 — 纯 SVG，无外部依赖
 * 显示近 7 天的活动趋势。
 */

import type { DailyPoint } from '@/lib/dashboard-service'

interface Props {
  data: DailyPoint[]
  color: string
}

const W = 320
const H = 100
const PAD = 20

export default function MiniChart({ data, color }: Props) {
  if (data.length === 0) {
    return <div className="text-xs text-muted-foreground/40 text-center py-4">暂无数据</div>
  }

  const totals = data.map(d => d.conversations + d.calculations + d.tasks)
  const max = Math.max(...totals, 1)

  const points = totals.map((v, i) => {
    const x = PAD + (i / Math.max(data.length - 1, 1)) * (W - 2 * PAD)
    const y = H - PAD - (v / max) * (H - 2 * PAD)
    return { x, y, v }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${H - PAD} L ${points[0].x} ${H - PAD} Z`

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          近 7 天活动趋势
        </h4>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>💬 对话</span>
          <span>🧮 计算</span>
          <span>📋 任务</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
        {/* 网格线 */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = H - PAD - ratio * (H - 2 * PAD)
          return (
            <line
              key={ratio}
              x1={PAD} y1={y} x2={W - PAD} y2={y}
              stroke="currentColor" strokeOpacity={0.06}
            />
          )
        })}

        {/* 面积 */}
        <path d={areaPath} fill={color} fillOpacity={0.08} />

        {/* 折线 */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* 数据点 */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill={color} />
            <text
              x={p.x}
              y={H - 4}
              textAnchor="middle"
              fontSize={8}
              fill="currentColor"
              fillOpacity={0.3}
            >
              {data[i].date.slice(5)}
            </text>
            {p.v > 0 && (
              <text
                x={p.x}
                y={p.y - 8}
                textAnchor="middle"
                fontSize={9}
                fill={color}
                fontWeight="bold"
              >
                {p.v}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
