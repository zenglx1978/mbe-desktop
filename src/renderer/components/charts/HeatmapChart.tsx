/**
 * 通用热力图组件 — 基于 SVG 的网格热力图
 *
 * 支持：行列标签 + 色标 + Tooltip + 点击回调
 * 适用场景：法律风险分布、AI 产业链冲击图、瓶颈评分图
 */
import { useState, useMemo, useCallback } from 'react'

export interface HeatmapCell {
  row: string
  col: string
  value: number
  label?: string
}

interface Props {
  data: HeatmapCell[]
  rows: string[]
  cols: string[]
  /** 色标低值颜色 (HSL) */
  colorLow?: string
  /** 色标高值颜色 (HSL) */
  colorHigh?: string
  /** 最小值（未传则自动） */
  min?: number
  /** 最大值（未传则自动） */
  max?: number
  cellSize?: number
  className?: string
  onCellClick?: (cell: HeatmapCell) => void
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

function hslToStr(h: number, s: number, l: number, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

function parseHSL(hsl: string): [number, number, number] {
  const m = hsl.match(/[\d.]+/g)
  if (!m || m.length < 3) return [0, 0, 0]
  return [parseFloat(m[0]), parseFloat(m[1]), parseFloat(m[2])]
}

export default function HeatmapChart({
  data,
  rows,
  cols,
  colorLow = '210 80% 92%',
  colorHigh = '0 85% 45%',
  min: propMin,
  max: propMax,
  cellSize = 36,
  className = '',
  onCellClick,
}: Props) {
  const [hover, setHover] = useState<{ row: string; col: string } | null>(null)

  const cellMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>()
    data.forEach(c => map.set(`${c.row}|${c.col}`, c))
    return map
  }, [data])

  const [lo, hi] = useMemo(() => {
    const vals = data.map(d => d.value)
    return [propMin ?? Math.min(...vals, 0), propMax ?? Math.max(...vals, 1)]
  }, [data, propMin, propMax])

  const lowHSL = useMemo(() => parseHSL(colorLow), [colorLow])
  const highHSL = useMemo(() => parseHSL(colorHigh), [colorHigh])

  const getCellColor = useCallback((val: number) => {
    const t = hi === lo ? 0.5 : (val - lo) / (hi - lo)
    return hslToStr(
      lerp(lowHSL[0], highHSL[0], t),
      lerp(lowHSL[1], highHSL[1], t),
      lerp(lowHSL[2], highHSL[2], t),
    )
  }, [lo, hi, lowHSL, highHSL])

  const labelWidth = 100
  const topLabelHeight = 40
  const svgW = labelWidth + cols.length * cellSize
  const svgH = topLabelHeight + rows.length * cellSize

  return (
    <div className={`overflow-x-auto ${className}`}>
      <svg width={svgW} height={svgH} className="select-none">
        {/* 列标签 */}
        {cols.map((col, ci) => (
          <text
            key={`col-${ci}`}
            x={labelWidth + ci * cellSize + cellSize / 2}
            y={topLabelHeight - 8}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 10 }}
          >
            {col.length > 6 ? col.slice(0, 6) + '…' : col}
          </text>
        ))}

        {/* 行标签 + 格子 */}
        {rows.map((row, ri) => (
          <g key={`row-${ri}`}>
            <text
              x={labelWidth - 6}
              y={topLabelHeight + ri * cellSize + cellSize / 2 + 4}
              textAnchor="end"
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {row.length > 10 ? row.slice(0, 10) + '…' : row}
            </text>
            {cols.map((col, ci) => {
              const cell = cellMap.get(`${row}|${col}`)
              const val = cell?.value ?? 0
              const isHover = hover?.row === row && hover?.col === col
              return (
                <g key={`${ri}-${ci}`}>
                  <rect
                    x={labelWidth + ci * cellSize + 1}
                    y={topLabelHeight + ri * cellSize + 1}
                    width={cellSize - 2}
                    height={cellSize - 2}
                    rx={3}
                    fill={getCellColor(val)}
                    stroke={isHover ? 'hsl(var(--primary))' : 'transparent'}
                    strokeWidth={isHover ? 2 : 0}
                    className="cursor-pointer transition-colors"
                    onMouseEnter={() => setHover({ row, col })}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => cell && onCellClick?.(cell)}
                  />
                  {cellSize >= 28 && (
                    <text
                      x={labelWidth + ci * cellSize + cellSize / 2}
                      y={topLabelHeight + ri * cellSize + cellSize / 2 + 4}
                      textAnchor="middle"
                      style={{ fontSize: 9, fill: val > (lo + hi) / 2 ? '#fff' : '#333', pointerEvents: 'none' }}
                    >
                      {cell?.label ?? val.toFixed(1)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {hover && (() => {
        const cell = cellMap.get(`${hover.row}|${hover.col}`)
        if (!cell) return null
        return (
          <div className="mt-2 inline-flex items-center gap-3 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
            <span className="font-medium">{hover.row}</span>
            <span className="text-muted-foreground">×</span>
            <span className="font-medium">{hover.col}</span>
            <span className="text-primary font-bold">{cell.label ?? cell.value.toFixed(2)}</span>
          </div>
        )
      })()}

      {/* 色标图例 */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] text-muted-foreground">{lo.toFixed(1)}</span>
        <div
          className="h-2 flex-1 rounded-full max-w-[200px]"
          style={{
            background: `linear-gradient(to right, ${getCellColor(lo)}, ${getCellColor((lo + hi) / 2)}, ${getCellColor(hi)})`,
          }}
        />
        <span className="text-[10px] text-muted-foreground">{hi.toFixed(1)}</span>
      </div>
    </div>
  )
}
