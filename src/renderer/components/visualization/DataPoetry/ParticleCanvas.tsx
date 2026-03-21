/**
 * 粒子星系画布 — Canvas 2D 粒子系统
 *
 * 首页 Data Poetry 效果：每个 Solution 是一个"星系"，Expert 是"行星"，
 * 进行中的工作流是"流星"划过。粒子密度和亮度映射到实时活跃度。
 *
 * 技术选型：Canvas 2D（不需要 Three.js 重依赖）
 * 数据源：WorkflowOS.get_dashboard() → active_instances / recent_completed
 */

import { useRef, useEffect, useCallback } from 'react'
import type { SolutionNode, ExpertOrbit, WorkflowMeteor } from '../types'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
  color: string
  life: number
  maxLife: number
}

interface ParticleCanvasProps {
  solutions: SolutionNode[]
  orbits?: ExpertOrbit[]
  meteors?: WorkflowMeteor[]
  width?: number
  height?: number
  className?: string
  /** 粒子总密度（每 100px^2 粒子数） */
  density?: number
  /** 暗色主题 */
  dark?: boolean
}

const SOLUTION_COLORS: Record<string, string> = {
  'labor-dispatch': '#10b981',
  'law-firm': '#6366f1',
  'finance-tax-service': '#f59e0b',
  'construction-cost': '#ef4444',
  'clinic-respiratory': '#06b6d4',
  'smb-operations': '#8b5cf6',
  'ecommerce-brand-service': '#ec4899',
  'insurance-operations': '#14b8a6',
  'study-abroad-consulting': '#f97316',
  'education-training': '#84cc16',
  'investment-research': '#3b82f6',
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function createParticle(cx: number, cy: number, color: string, spread: number): Particle {
  const angle = Math.random() * Math.PI * 2
  const dist = Math.random() * spread
  return {
    x: cx + Math.cos(angle) * dist,
    y: cy + Math.sin(angle) * dist,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    radius: Math.random() * 1.5 + 0.5,
    opacity: Math.random() * 0.6 + 0.2,
    color,
    life: 0,
    maxLife: 200 + Math.random() * 300,
  }
}

export function ParticleCanvas({
  solutions,
  meteors = [],
  width: propWidth,
  height: propHeight,
  className = '',
  density = 0.8,
  dark = false,
}: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const getSize = useCallback(() => {
    if (propWidth && propHeight) return { w: propWidth, h: propHeight }
    const el = containerRef.current
    if (!el) return { w: 800, h: 400 }
    return { w: el.clientWidth, h: el.clientHeight }
  }, [propWidth, propHeight])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { w, h } = getSize()
    const dpr = window.devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.scale(dpr, dpr)

    const maxParticles = Math.floor((w * h / 10000) * density)

    const solutionPositions = solutions.map((sol, i) => {
      const cols = Math.ceil(Math.sqrt(solutions.length))
      const rows = Math.ceil(solutions.length / cols)
      const cellW = w / cols
      const cellH = h / rows
      const col = i % cols
      const row = Math.floor(i / cols)
      return {
        cx: cellW * col + cellW / 2 + (Math.random() - 0.5) * cellW * 0.2,
        cy: cellH * row + cellH / 2 + (Math.random() - 0.5) * cellH * 0.2,
        color: SOLUTION_COLORS[sol.id] || sol.color || '#6366f1',
        spread: Math.min(cellW, cellH) * 0.35,
        activity: sol.active_workflows + sol.completed_today,
      }
    })

    particlesRef.current = []
    for (const sp of solutionPositions) {
      const count = Math.max(5, Math.floor((sp.activity + 3) * density * 8))
      for (let j = 0; j < Math.min(count, maxParticles / solutions.length); j++) {
        particlesRef.current.push(createParticle(sp.cx, sp.cy, sp.color, sp.spread))
      }
    }

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)

      // 背景光晕
      for (const sp of solutionPositions) {
        const gradient = ctx.createRadialGradient(sp.cx, sp.cy, 0, sp.cx, sp.cy, sp.spread * 1.2)
        gradient.addColorStop(0, hexToRgba(sp.color, dark ? 0.08 : 0.05))
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, w, h)
      }

      const particles = particlesRef.current
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.life++

        const lifeRatio = p.life / p.maxLife
        const fadeIn = Math.min(1, p.life / 30)
        const fadeOut = lifeRatio > 0.7 ? 1 - (lifeRatio - 0.7) / 0.3 : 1
        const alpha = p.opacity * fadeIn * fadeOut

        if (p.life >= p.maxLife || alpha <= 0) {
          const sp = solutionPositions[Math.floor(Math.random() * solutionPositions.length)]
          particles[i] = createParticle(sp.cx, sp.cy, sp.color, sp.spread)
          continue
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = hexToRgba(p.color, alpha)
        ctx.fill()
      }

      // 流星效果（活跃工作流）
      for (const m of meteors) {
        if (solutionPositions.length < 2) continue
        const from = solutionPositions[0]
        const to = solutionPositions[1]
        const mx = from.cx + (to.cx - from.cx) * m.progress
        const my = from.cy + (to.cy - from.cy) * m.progress

        ctx.beginPath()
        ctx.arc(mx, my, 3, 0, Math.PI * 2)
        ctx.fillStyle = hexToRgba('#ffffff', m.opacity * 0.8)
        ctx.fill()

        const gradient = ctx.createRadialGradient(mx, my, 0, mx, my, 12)
        gradient.addColorStop(0, hexToRgba('#ffffff', m.opacity * 0.3))
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.fillRect(mx - 12, my - 12, 24, 24)
      }

      // 星系间连线（微弱）
      for (let i = 0; i < solutionPositions.length; i++) {
        for (let j = i + 1; j < solutionPositions.length; j++) {
          const a = solutionPositions[i]
          const b = solutionPositions[j]
          const dist = Math.hypot(a.cx - b.cx, a.cy - b.cy)
          if (dist < Math.max(w, h) * 0.6) {
            ctx.beginPath()
            ctx.moveTo(a.cx, a.cy)
            ctx.lineTo(b.cx, b.cy)
            ctx.strokeStyle = dark
              ? `rgba(255,255,255,${0.03 * (1 - dist / (Math.max(w, h) * 0.6))})`
              : `rgba(0,0,0,${0.02 * (1 - dist / (Math.max(w, h) * 0.6))})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [solutions, meteors, density, dark, getSize])

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        aria-label={`MBE 平台今日 ${solutions.reduce((s, n) => s + n.completed_today, 0)} 个任务完成`}
      />
    </div>
  )
}
