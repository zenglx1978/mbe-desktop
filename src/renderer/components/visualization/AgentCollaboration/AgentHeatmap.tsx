/**
 * Agent 活动热力图 — 矩阵式热力图组件
 *
 * 可用于：
 * - Expert × 时间段 活动热力图（谁在什么时候最忙）
 * - Solution × Expert 协作频次热力图
 * - 法律风险 / 投资瓶颈 / 产业链 热力图（后端已有端点）
 *
 * 纯 CSS Grid 实现，不依赖 D3/recharts
 * 颜色映射支持 green/blue/red/diverging 四种色阶
 */

import React, { useState, useMemo } from 'react'
import type { HeatmapData, HeatmapCell } from '../types'

interface AgentHeatmapProps {
  data: HeatmapData
  className?: string
  /** 是否显示数值标签 */
  showValues?: boolean
  /** 单元格尺寸 */
  cellSize?: number
  /** 点击单元格回调 */
  onCellClick?: (cell: HeatmapCell) => void
}

const COLOR_SCALES: Record<string, { stops: [number, string][] }> = {
  green: {
    stops: [
      [0, '#f0fdf4'],
      [0.25, '#bbf7d0'],
      [0.5, '#4ade80'],
      [0.75, '#16a34a'],
      [1, '#15803d'],
    ],
  },
  blue: {
    stops: [
      [0, '#eff6ff'],
      [0.25, '#bfdbfe'],
      [0.5, '#60a5fa'],
      [0.75, '#2563eb'],
      [1, '#1d4ed8'],
    ],
  },
  red: {
    stops: [
      [0, '#fef2f2'],
      [0.25, '#fecaca'],
      [0.5, '#f87171'],
      [0.75, '#dc2626'],
      [1, '#b91c1c'],
    ],
  },
  diverging: {
    stops: [
      [0, '#dc2626'],
      [0.25, '#fecaca'],
      [0.5, '#f5f5f5'],
      [0.75, '#bbf7d0'],
      [1, '#16a34a'],
    ],
  },
}

function interpolateColor(stops: [number, string][], t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  let lower = stops[0]!
  let upper = stops[stops.length - 1]!
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i]![0] && clamped <= stops[i + 1]![0]) {
      lower = stops[i]!
      upper = stops[i + 1]!
      break
    }
  }
  const range = upper[0] - lower[0]
  const ratio = range > 0 ? (clamped - lower[0]) / range : 0

  const lc = lower[1]
  const uc = upper[1]
  const r = Math.round(parseInt(lc.slice(1, 3), 16) * (1 - ratio) + parseInt(uc.slice(1, 3), 16) * ratio)
  const g = Math.round(parseInt(lc.slice(3, 5), 16) * (1 - ratio) + parseInt(uc.slice(3, 5), 16) * ratio)
  const b = Math.round(parseInt(lc.slice(5, 7), 16) * (1 - ratio) + parseInt(uc.slice(5, 7), 16) * ratio)
  return `rgb(${r},${g},${b})`
}

export function AgentHeatmap({
  data,
  className = '',
  showValues = true,
  cellSize = 48,
  onCellClick,
}: AgentHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null)

  const scale = (COLOR_SCALES[data.color_scale] || COLOR_SCALES.green)!
  const cellMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>()
    for (const cell of data.cells) {
      map.set(`${cell.row_id}:${cell.col_id}`, cell)
    }
    return map
  }, [data.cells])

  const normalize = (value: number) => {
    const range = data.max_value - data.min_value
    return range > 0 ? (value - data.min_value) / range : 0.5
  }

  return (
    <div className={`rounded-xl border border-gray-100 dark:border-[#3c3c3c] bg-white dark:bg-[#1e1e1e] p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">{data.title}</h3>
        {/* 色阶图例 */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-gray-400">{data.min_value}</span>
          <div
            className="h-2 w-24 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${scale.stops.map(([t, c]) => `${c} ${t * 100}%`).join(', ')})`,
            }}
          />
          <span className="text-[9px] text-gray-400">{data.max_value}</span>
        </div>
      </div>

      {/* 热力图矩阵 */}
      <div className="overflow-auto">
        <div
          className="inline-grid gap-px"
          style={{
            gridTemplateColumns: `80px repeat(${data.col_labels.length}, ${cellSize}px)`,
            gridTemplateRows: `24px repeat(${data.row_labels.length}, ${cellSize}px)`,
          }}
        >
          {/* 左上角空白 */}
          <div />

          {/* 列头 */}
          {data.col_labels.map(col => (
            <div key={col.id} className="flex items-end justify-center pb-1">
              <span className="text-[9px] text-gray-500 truncate max-w-[44px] -rotate-45 origin-bottom-left">
                {col.name}
              </span>
            </div>
          ))}

          {/* 行 */}
          {data.row_labels.map(row => (
            <React.Fragment key={row.id}>
              {/* 行头 */}
              <div className="flex items-center pr-2">
                <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate">{row.name}</span>
              </div>

              {/* 单元格 */}
              {data.col_labels.map(col => {
                const cell = cellMap.get(`${row.id}:${col.id}`)
                const value = cell?.value ?? 0
                const t = normalize(value)
                const bgColor = interpolateColor(scale.stops, t)
                const isHovered = hoveredCell?.row_id === row.id && hoveredCell?.col_id === col.id

                return (
                  <div
                    key={`${row.id}:${col.id}`}
                    className={`flex items-center justify-center rounded-sm cursor-pointer transition-all ${
                      isHovered ? 'ring-2 ring-gray-400 dark:ring-gray-500 scale-110 z-10' : ''
                    }`}
                    style={{ backgroundColor: bgColor }}
                    onMouseEnter={() => setHoveredCell(cell || null)}
                    onMouseLeave={() => setHoveredCell(null)}
                    onClick={() => cell && onCellClick?.(cell)}
                    title={`${row.name} × ${col.name}: ${cell?.label || value}`}
                  >
                    {showValues && (
                      <span className={`text-[9px] font-medium tabular-nums ${
                        t > 0.6 ? 'text-white' : 'text-gray-700'
                      }`}>
                        {cell?.label || (value > 0 ? value : '')}
                      </span>
                    )}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Hover 提示 */}
      {hoveredCell && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
          <span>
            {data.row_labels.find(r => r.id === hoveredCell.row_id)?.name}
            {' × '}
            {data.col_labels.find(c => c.id === hoveredCell.col_id)?.name}
          </span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {hoveredCell.label || hoveredCell.value}
          </span>
        </div>
      )}

      {/* 无障碍降级 */}
      <table className="sr-only">
        <caption>{data.title}</caption>
        <thead>
          <tr>
            <th />
            {data.col_labels.map(c => <th key={c.id}>{c.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.row_labels.map(row => (
            <tr key={row.id}>
              <th>{row.name}</th>
              {data.col_labels.map(col => {
                const cell = cellMap.get(`${row.id}:${col.id}`)
                return <td key={col.id}>{cell?.value ?? 0}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
