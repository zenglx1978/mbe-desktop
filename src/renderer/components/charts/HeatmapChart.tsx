/**
 * HeatmapChart — AnalyticsHeatmaps 页面使用的热力图组件
 *
 * 接口与 AnalyticsHeatmaps.tsx 的调用契约对齐：
 *   <HeatmapChart data={cells} rows={rowLabels} cols={colLabels}
 *     colorLow="210 70% 90%" colorHigh="0 85% 50%" min={0} max={5} cellSize={56} />
 *
 * HeatmapCell 用 row/col (string)，与 visualization/AgentHeatmap 的 row_id/col_id 不同。
 */

import { useState, useMemo } from 'react'

export interface HeatmapCell {
  row: string
  col: string
  value: number
  label?: string
}

interface HeatmapChartProps {
  data: HeatmapCell[]
  rows: string[]
  cols: string[]
  /** HSL 低值颜色, 如 "210 70% 90%" */
  colorLow?: string
  /** HSL 高值颜色, 如 "0 85% 50%" */
  colorHigh?: string
  min?: number
  max?: number
  cellSize?: number
  className?: string
}

function parseHSL(hsl: string): [number, number, number] {
  const parts = hsl.split(/[\s,%]+/).map(Number)
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

function lerpHSL(low: [number, number, number], high: [number, number, number], t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  const h = Math.round(low[0] + (high[0] - low[0]) * clamped)
  const s = Math.round(low[1] + (high[1] - low[1]) * clamped)
  const l = Math.round(low[2] + (high[2] - low[2]) * clamped)
  return `hsl(${h}, ${s}%, ${l}%)`
}

export default function HeatmapChart({
  data,
  rows,
  cols,
  colorLow = '210 70% 90%',
  colorHigh = '0 85% 50%',
  min = 0,
  max = 5,
  cellSize = 48,
  className = '',
}: HeatmapChartProps) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null)

  const low = useMemo(() => parseHSL(colorLow), [colorLow])
  const high = useMemo(() => parseHSL(colorHigh), [colorHigh])

  const cellMap = useMemo(() => {
    const m = new Map<string, HeatmapCell>()
    for (const c of data) m.set(`${c.row}:${c.col}`, c)
    return m
  }, [data])

  const normalize = (v: number) => {
    const range = max - min
    return range > 0 ? (v - min) / range : 0.5
  }

  return (
    <div className={`overflow-auto ${className}`}>
      <div
        className="inline-grid gap-[2px]"
        style={{
          gridTemplateColumns: `80px repeat(${cols.length}, ${cellSize}px)`,
          gridTemplateRows: `28px repeat(${rows.length}, ${cellSize}px)`,
        }}
      >
        {/* 左上角空白 */}
        <div />

        {/* 列头 */}
        {cols.map(col => (
          <div key={col} className="flex items-end justify-center pb-1 px-0.5">
            <span className="text-[11px] text-muted-foreground leading-tight text-center truncate max-w-full">
              {col}
            </span>
          </div>
        ))}

        {/* 行 */}
        {rows.map(row => (
          <>
            <div key={`h-${row}`} className="flex items-center pr-2">
              <span className="text-[11px] text-muted-foreground truncate">{row}</span>
            </div>
            {cols.map(col => {
              const cell = cellMap.get(`${row}:${col}`)
              const value = cell?.value ?? 0
              const t = normalize(value)
              const bg = lerpHSL(low, high, t)
              const isHovered = hovered?.row === row && hovered?.col === col

              return (
                <div
                  key={`${row}:${col}`}
                  className={`flex items-center justify-center rounded-sm transition-all cursor-default ${
                    isHovered ? 'ring-2 ring-foreground/30 scale-110 z-10' : ''
                  }`}
                  style={{ backgroundColor: bg }}
                  onMouseEnter={() => setHovered(cell || null)}
                  onMouseLeave={() => setHovered(null)}
                  title={`${row} × ${col}: ${cell?.label || value}`}
                >
                  <span className={`text-[11px] font-medium tabular-nums ${
                    t > 0.55 ? 'text-white' : 'text-foreground/70'
                  }`}>
                    {cell?.label ?? (value > 0 ? value.toFixed(1) : '')}
                  </span>
                </div>
              )
            })}
          </>
        ))}
      </div>

      {/* hover 提示 */}
      {hovered && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          {hovered.row} × {hovered.col}:
          <span className="ml-1 font-medium text-foreground">{hovered.label || hovered.value}</span>
        </div>
      )}

      {/* 色阶图例 */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[9px] text-muted-foreground">{min}</span>
        <div
          className="h-2 w-20 rounded-full"
          style={{
            background: `linear-gradient(90deg, hsl(${low[0]},${low[1]}%,${low[2]}%), hsl(${high[0]},${high[1]}%,${high[2]}%))`,
          }}
        />
        <span className="text-[9px] text-muted-foreground">{max}</span>
      </div>

      {/* 无障碍降级 */}
      <table className="sr-only">
        <thead>
          <tr><th />{cols.map(c => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row}>
              <th>{row}</th>
              {cols.map(col => {
                const cell = cellMap.get(`${row}:${col}`)
                return <td key={col}>{cell?.value ?? 0}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
