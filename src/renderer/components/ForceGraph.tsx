/**
 * ForceGraph — 力导向知识图谱渲染器
 *
 * Canvas 2D，零依赖实现：
 *   - 弹簧力 + 排斥力 + 中心引力
 *   - 鼠标滚轮缩放 + 拖拽平移
 *   - hover 高亮 + 点击选中
 *   - 节点类型视觉编码（颜色/形状/大小）
 *   - Dithering 效果标识知识新鲜度
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import type { KGNode, KGEdge, KGNodeType } from '@/lib/kb-graph-data'

interface ForceGraphProps {
  nodes: KGNode[]
  edges: KGEdge[]
  width: number
  height: number
  onNodeClick?: (node: KGNode | null) => void
  onNodeHover?: (node: KGNode | null) => void
  /** 高亮的 Agent ID（用于筛选） */
  highlightAgent?: string | null
  className?: string
}

// ── 视觉常量 ──

const NODE_COLORS: Record<KGNodeType, string> = {
  agent: '#6366f1',
  knowledge: '#3b82f6',
  rule: '#f59e0b',
  solution: '#10b981',
}

const NODE_BASE_RADIUS: Record<KGNodeType, number> = {
  agent: 20,
  knowledge: 8,
  rule: 10,
  solution: 12,
}

// ── 力学常量 ──

const REPULSION = 800
const SPRING_K = 0.005
const SPRING_REST = 80
const CENTER_GRAVITY = 0.01
const DAMPING = 0.92
const MAX_VELOCITY = 4

// ── 组件 ──

export default function ForceGraph({
  nodes: inputNodes,
  edges,
  width,
  height,
  onNodeClick,
  onNodeHover,
  highlightAgent,
  className = '',
}: ForceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  // 摄像机状态
  const camRef = useRef({ x: 0, y: 0, zoom: 1 })
  const dragRef = useRef<{ dragging: boolean; lastX: number; lastY: number }>({
    dragging: false, lastX: 0, lastY: 0,
  })

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 节点的可变引用（避免每帧重建）
  const nodesRef = useRef<KGNode[]>([])

  // 初始化节点位置
  useEffect(() => {
    const cx = width / 2
    const cy = height / 2
    nodesRef.current = inputNodes.map((n, i) => {
      const angle = (i / inputNodes.length) * Math.PI * 2
      const r = n.type === 'agent' ? 50 : 150 + Math.random() * 100
      return {
        ...n,
        x: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 40,
        y: cy + Math.sin(angle) * r + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
      }
    })
  }, [inputNodes, width, height])

  // 构建邻接表
  const adjRef = useRef<Map<string, Set<string>>>(new Map())
  useEffect(() => {
    const adj = new Map<string, Set<string>>()
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, new Set())
      if (!adj.has(e.target)) adj.set(e.target, new Set())
      adj.get(e.source)!.add(e.target)
      adj.get(e.target)!.add(e.source)
    }
    adjRef.current = adj
  }, [edges])

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const cam = camRef.current
    return {
      x: (sx - width / 2) / cam.zoom + cam.x,
      y: (sy - height / 2) / cam.zoom + cam.y,
    }
  }, [width, height])

  const findNodeAt = useCallback((wx: number, wy: number): KGNode | null => {
    const nodes = nodesRef.current
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]!
      const r = getNodeRadius(n)
      const dx = n.x - wx
      const dy = n.y - wy
      if (dx * dx + dy * dy < r * r * 1.5) return n
    }
    return null
  }, [])

  // 动画循环
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const nodes = nodesRef.current
    const cam = camRef.current
    const dpr = window.devicePixelRatio || 1

    // ── 力学模拟 ──
    const nodeMap = new Map<string, KGNode>()
    for (const n of nodes) nodeMap.set(n.id, n)

    // 排斥力
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!
        const b = nodes[j]!
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = REPULSION / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        a.vx -= fx
        a.vy -= fy
        b.vx += fx
        b.vy += fy
      }
    }

    // 弹簧力（沿边）
    for (const e of edges) {
      const a = nodeMap.get(e.source)
      const b = nodeMap.get(e.target)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = (dist - SPRING_REST) * SPRING_K
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }

    // 中心引力 + 速度衰减
    const cx = width / 2
    const cy = height / 2
    for (const n of nodes) {
      n.vx += (cx - n.x) * CENTER_GRAVITY
      n.vy += (cy - n.y) * CENTER_GRAVITY
      n.vx *= DAMPING
      n.vy *= DAMPING
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy)
      if (speed > MAX_VELOCITY) {
        n.vx = (n.vx / speed) * MAX_VELOCITY
        n.vy = (n.vy / speed) * MAX_VELOCITY
      }
      n.x += n.vx
      n.y += n.vy
    }

    // ── 渲染 ──
    ctx.clearRect(0, 0, width * dpr, height * dpr)
    ctx.save()
    ctx.scale(dpr, dpr)

    // 摄像机变换
    ctx.translate(width / 2, height / 2)
    ctx.scale(cam.zoom, cam.zoom)
    ctx.translate(-cam.x, -cam.y)

    const hoveredNeighbors = hoveredId ? adjRef.current.get(hoveredId) : null
    const selectedNeighbors = selectedId ? adjRef.current.get(selectedId) : null

    // 画边
    for (const e of edges) {
      const a = nodeMap.get(e.source)
      const b = nodeMap.get(e.target)
      if (!a || !b) continue

      const isHighlighted =
        hoveredId === e.source || hoveredId === e.target ||
        selectedId === e.source || selectedId === e.target
      const isDimmed = highlightAgent && a.agentId !== highlightAgent && b.agentId !== highlightAgent

      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = isDimmed
        ? 'rgba(128,128,128,0.03)'
        : isHighlighted
          ? 'rgba(99,102,241,0.4)'
          : e.type === 'references'
            ? 'rgba(245,158,11,0.12)'
            : 'rgba(128,128,128,0.08)'
      ctx.lineWidth = isHighlighted ? 1.5 : 0.5
      ctx.stroke()
    }

    // 画节点
    for (const n of nodes) {
      const r = getNodeRadius(n)
      const color = n.type === 'agent'
        ? (AGENT_KB_REGISTRY_COLORS[n.agentId] ?? NODE_COLORS.agent)
        : NODE_COLORS[n.type]

      const isHovered = n.id === hoveredId
      const isSelected = n.id === selectedId
      const isNeighbor = hoveredNeighbors?.has(n.id) || selectedNeighbors?.has(n.id)
      const isDimmed = highlightAgent && n.agentId !== highlightAgent

      let alpha = isDimmed ? 0.08 : 0.7
      if (isHovered || isSelected) alpha = 1
      else if (isNeighbor) alpha = 0.9

      // 强调环（agent 和 selected，用低透明度描边替代发光效果）
      if ((n.type === 'agent' || isSelected) && !isDimmed) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2)
        ctx.strokeStyle = colorWithAlpha(color, 0.25)
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // 节点形状
      ctx.beginPath()
      if (n.type === 'rule') {
        drawDiamond(ctx, n.x, n.y, r)
      } else if (n.type === 'solution') {
        drawHexagon(ctx, n.x, n.y, r)
      } else {
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
      }
      ctx.fillStyle = colorWithAlpha(color, alpha)
      ctx.fill()

      if (isHovered || isSelected) {
        ctx.strokeStyle = colorWithAlpha(color, 1)
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // 标签
      if (n.type === 'agent' || isHovered || isSelected || (cam.zoom > 1.2 && !isDimmed)) {
        ctx.fillStyle = isDimmed ? 'rgba(160,160,160,0.2)' : 'rgba(240,240,240,0.85)'
        ctx.font = n.type === 'agent' ? 'bold 11px system-ui' : '9px system-ui'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(n.label, n.x, n.y + r + 3)
      }
    }

    ctx.restore()
    animRef.current = requestAnimationFrame(render)
  }, [edges, width, height, hoveredId, selectedId, highlightAgent])

  // 启动/停止渲染
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    animRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animRef.current)
  }, [render, width, height])

  // 页面不可见时暂停
  useEffect(() => {
    const h = () => {
      if (document.hidden) cancelAnimationFrame(animRef.current)
      else animRef.current = requestAnimationFrame(render)
    }
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [render])

  // ── 交互 ──

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const cam = camRef.current
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    cam.zoom = Math.max(0.3, Math.min(5, cam.zoom * factor))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const drag = dragRef.current
    if (drag.dragging) {
      const cam = camRef.current
      cam.x -= (e.clientX - drag.lastX) / cam.zoom
      cam.y -= (e.clientY - drag.lastY) / cam.zoom
      drag.lastX = e.clientX
      drag.lastY = e.clientY
    } else {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const { x, y } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
      const node = findNodeAt(x, y)
      setHoveredId(node?.id ?? null)
      onNodeHover?.(node)
      if (canvasRef.current) {
        canvasRef.current.style.cursor = node ? 'pointer' : 'grab'
      }
    }
  }, [screenToWorld, findNodeAt, onNodeHover])

  const handleMouseUp = useCallback(() => {
    dragRef.current.dragging = false
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const { x, y } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    const node = findNodeAt(x, y)
    setSelectedId(node?.id ?? null)
    onNodeClick?.(node)
  }, [screenToWorld, findNodeAt, onNodeClick])

  return (
    <canvas
      ref={canvasRef}
      className={`${className}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
    />
  )
}

// ── 辅助 ──

const AGENT_KB_REGISTRY_COLORS: Record<string, string> = {
  finance: '#3b82f6', legal: '#8b5cf6', cost: '#f59e0b', pulmonary: '#06b6d4',
  cs: '#ec4899', hr: '#10b981', invest: '#ef4444', sales: '#f97316',
  growth: '#a855f7', education: '#14b8a6', insurance_cs: '#0ea5e9',
}

function getNodeRadius(n: KGNode): number {
  const base = NODE_BASE_RADIUS[n.type]
  return base + Math.min(8, n.refCount * 0.8)
}

function colorWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.moveTo(x, y - r)
  ctx.lineTo(x + r, y)
  ctx.lineTo(x, y + r)
  ctx.lineTo(x - r, y)
  ctx.closePath()
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    const px = x + r * Math.cos(angle)
    const py = y + r * Math.sin(angle)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}
