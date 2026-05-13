/**
 * ChartSpec 通用渲染器 — 根据 ChartSpec JSON 选择对应图表组件
 *
 * 支持的图表类型：
 * - line, bar, pie, scatter: Recharts 渲染
 * - heatmap: HeatmapChart 组件
 * - table: HTML table
 * - gauge, radar, treemap, sankey: 占位（未来扩展）
 *
 * 遵循 MBE_VISUALIZATION_STRATEGY.md 5.1 选型规范
 */

import { useMemo } from 'react'
import type { ChartSpec } from './ChartSpec'
import HeatmapChart, { type HeatmapCell } from './HeatmapChart'

interface ChartRendererProps {
  spec: ChartSpec
  className?: string
}

// ── 简单 CSS 柱状图（不依赖 Recharts 的降级方案） ──

function SimpleBarChart({ spec }: { spec: ChartSpec }) {
  const maxVal = useMemo(() => {
    let m = 0
    for (const s of spec.series) {
      for (const v of s.data) if (v > m) m = v
    }
    return m || 1
  }, [spec.series])

  return (
    <div className="space-y-2">
      {spec.x_axis?.map((label, i) => {
        const value = spec.series[0]?.data[i] ?? 0
        const pct = (value / maxVal) * 100
        return (
          <div key={label} className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-20 text-right truncate">{label}</span>
            <div className="flex-1 h-5 bg-muted/30 rounded-sm overflow-hidden">
              <div
                className="h-full bg-primary/60 rounded-sm transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-foreground/70 w-12 text-right">
              {value.toLocaleString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function SimplePieChart({ spec }: { spec: ChartSpec }) {
  const items = spec.series[0]?.data?.map((v, i) => ({
    name: spec.x_axis?.[i] || `#${i + 1}`,
    value: v,
  })) || []
  const total = items.reduce((s, d) => s + d.value, 0) || 1
  const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

  return (
    <div className="flex items-center gap-6">
      {/* 环形图（纯 CSS） */}
      <div className="relative shrink-0 w-24 h-24">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          {items.reduce((acc, item, i) => {
            const pct = (item.value / total) * 100
            const offset = acc.offset
            acc.elements.push(
              <circle
                key={i}
                cx="18" cy="18" r="15.9"
                fill="transparent"
                stroke={colors[i % colors.length]}
                strokeWidth="3"
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeDashoffset={`${-offset}`}
              />,
            )
            acc.offset += pct
            return acc
          }, { elements: [] as JSX.Element[], offset: 0 }).elements}
        </svg>
      </div>
      {/* 图例 */}
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-[11px] text-foreground/70">{item.name}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground ml-auto">
              {((item.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SimpleLineChart({ spec }: { spec: ChartSpec }) {
  const series = spec.series[0]
  if (!series || series.data.length === 0) return <p className="text-xs text-muted-foreground">无数据</p>

  const maxVal = Math.max(...series.data, 1)
  const minVal = Math.min(...series.data, 0)
  const range = maxVal - minVal || 1
  const w = 100
  const h = 40

  const points = series.data.map((v, i) => {
    const x = series.data.length > 1 ? (i / (series.data.length - 1)) * w : w / 2
    const y = h - ((v - minVal) / range) * h
    return `${x},${y}`
  }).join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h + 4}`} className="w-full h-auto" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
      {spec.x_axis && (
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-muted-foreground">{spec.x_axis[0]}</span>
          <span className="text-[9px] text-muted-foreground">{spec.x_axis[spec.x_axis.length - 1]}</span>
        </div>
      )}
    </div>
  )
}

function SimpleTable({ spec }: { spec: ChartSpec }) {
  const headers = spec.x_axis || spec.series.map(s => s.name)
  const rows = spec.data?.rows as string[][] | undefined
  return (
    <div className="overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} className="text-left py-1.5 px-2 border-b border-border font-medium text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows?.map((row, i) => (
            <tr key={i} className="hover:bg-muted/30">
              {row.map((cell, j) => (
                <td key={j} className="py-1.5 px-2 border-b border-border/50">{cell}</td>
              ))}
            </tr>
          )) || (
            <tr><td colSpan={headers.length} className="py-4 text-center text-muted-foreground">无数据</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function HeatmapAdapter({ spec }: { spec: ChartSpec }) {
  const { cells, rows, cols } = useMemo(() => {
    const heatData = spec.data?.heatmap as Record<string, Record<string, number>> | undefined
    if (!heatData) return { cells: [] as HeatmapCell[], rows: [] as string[], cols: [] as string[] }

    const rowSet = new Set<string>()
    const colSet = new Set<string>()
    const cells: HeatmapCell[] = []

    for (const [row, colVals] of Object.entries(heatData)) {
      rowSet.add(row)
      for (const [col, value] of Object.entries(colVals)) {
        colSet.add(col)
        cells.push({ row, col, value: Number(value), label: String(value) })
      }
    }

    return { cells, rows: Array.from(rowSet), cols: Array.from(colSet) }
  }, [spec.data])

  if (cells.length === 0) return <PlaceholderChart spec={spec} />

  return (
    <HeatmapChart
      data={cells}
      rows={rows}
      cols={cols}
      min={spec.options?.min as number ?? 0}
      max={spec.options?.max as number ?? 5}
    />
  )
}

function PlaceholderChart({ spec }: { spec: ChartSpec }) {
  return (
    <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-border">
      <p className="text-xs text-muted-foreground">
        {spec.chart_type} 图表类型即将支持
      </p>
    </div>
  )
}

// ── 主渲染器 ──

const RENDERERS: Record<string, React.ComponentType<{ spec: ChartSpec }>> = {
  bar: SimpleBarChart,
  line: SimpleLineChart,
  pie: SimplePieChart,
  heatmap: HeatmapAdapter,
  table: SimpleTable,
}

export default function ChartRenderer({ spec, className = '' }: ChartRendererProps) {
  const Renderer = RENDERERS[spec.chart_type] || PlaceholderChart

  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      {(spec.title || spec.subtitle) && (
        <div className="mb-3">
          {spec.title && <h3 className="text-sm font-semibold">{spec.title}</h3>}
          {spec.subtitle && <p className="text-[11px] text-muted-foreground">{spec.subtitle}</p>}
        </div>
      )}
      <Renderer spec={spec} />
      {spec.y_axis_label && (
        <p className="mt-2 text-[9px] text-muted-foreground text-right">{spec.y_axis_label}</p>
      )}
    </div>
  )
}
