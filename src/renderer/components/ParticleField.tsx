/**
 * ParticleField — 轻量粒子动效（"AI 专家在工作"的感觉）
 *
 * 零第三方依赖，纯 Canvas 2D + requestAnimationFrame。
 *
 * 视觉语言：
 *   - 固定 Agent 节点（淡色圆圈，呼吸脉冲）
 *   - 粒子沿节点间的弧线流动，模拟数据/知识传递
 *   - 偶尔闪烁的微光点，模拟"灵感涌现"
 *
 * 性能预算：< 2ms/frame，不影响主线程。
 */

import { useRef, useEffect, useCallback } from 'react'

interface ParticleFieldProps {
  /** 主题色 CSS 颜色值 */
  accentColor?: string
  /** 节点数量（Agent 数），默认 5 */
  nodeCount?: number
  /** 粒子密度，默认 40 */
  particleDensity?: number
  className?: string
}

// ── 类型 ──

interface Node {
  x: number
  y: number
  radius: number
  phase: number       // 呼吸动画相位
  speed: number       // 呼吸速度
}

interface Particle {
  fromIdx: number
  toIdx: number
  t: number           // 0-1 沿路径的进度
  speed: number
  size: number
  opacity: number
}

interface Spark {
  x: number
  y: number
  life: number        // 0-1，递减
  size: number
}

// ── 工具 ──

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

function quadBezier(
  x0: number, y0: number,
  cx: number, cy: number,
  x1: number, y1: number,
  t: number,
): [number, number] {
  const u = 1 - t
  return [
    u * u * x0 + 2 * u * t * cx + t * t * x1,
    u * u * y0 + 2 * u * t * cy + t * t * y1,
  ]
}

function randomBetween(a: number, b: number) { return a + Math.random() * (b - a) }

/**
 * 将可能包含 CSS 变量的颜色值解析为 Canvas 可用的 RGBA 值。
 * Canvas 2D API 不支持 `var(--xxx)` 语法，必须先通过 DOM 解析。
 */
function resolveColor(raw: string): { r: number; g: number; b: number } {
  const el = document.createElement('div')
  el.style.color = raw
  document.body.appendChild(el)
  const computed = getComputedStyle(el).color
  document.body.removeChild(el)
  const m = computed.match(/(\d+)/g)
  if (m && m.length >= 3) return { r: +m[0], g: +m[1], b: +m[2] }
  return { r: 100, g: 160, b: 220 }
}

function rgbaStr(c: { r: number; g: number; b: number }, alpha: number): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`
}

// ── 组件 ──

export default function ParticleField({
  accentColor = 'hsl(210, 60%, 55%)',
  nodeCount = 5,
  particleDensity = 40,
  className = '',
}: ParticleFieldProps) {
  // C2: respect prefers-reduced-motion
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return null
  }
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const colorRef = useRef<{ r: number; g: number; b: number }>({ r: 100, g: 160, b: 220 })
  const stateRef = useRef<{
    nodes: Node[]
    particles: Particle[]
    sparks: Spark[]
    w: number
    h: number
    dpr: number
  }>({ nodes: [], particles: [], sparks: [], w: 0, h: 0, dpr: 1 })

  const initScene = useCallback((w: number, h: number) => {
    const s = stateRef.current
    s.w = w
    s.h = h

    // 在画布上均匀分布节点（避开边缘 15%）
    const margin = 0.15
    s.nodes = Array.from({ length: nodeCount }, () => ({
      x: lerp(w * margin, w * (1 - margin), Math.random()),
      y: lerp(h * margin, h * (1 - margin), Math.random()),
      radius: randomBetween(2, 4),
      phase: Math.random() * Math.PI * 2,
      speed: randomBetween(0.3, 0.8),
    }))

    // 初始化粒子
    s.particles = Array.from({ length: particleDensity }, () => {
      const fromIdx = Math.floor(Math.random() * nodeCount)
      let toIdx = Math.floor(Math.random() * nodeCount)
      if (toIdx === fromIdx) toIdx = (toIdx + 1) % nodeCount
      return {
        fromIdx,
        toIdx,
        t: Math.random(),
        speed: randomBetween(0.002, 0.006),
        size: randomBetween(0.8, 2),
        opacity: randomBetween(0.15, 0.5),
      }
    })

    s.sparks = []
  }, [nodeCount, particleDensity])

  // accentColor 变化时解析为 Canvas 可用的 RGB
  useEffect(() => {
    colorRef.current = resolveColor(accentColor)
  }, [accentColor])

  const draw = useCallback((ctx: CanvasRenderingContext2D, _time: number) => {
    const c = colorRef.current
    const s = stateRef.current
    const { w, h, nodes, particles, sparks, dpr } = s

    ctx.clearRect(0, 0, w * dpr, h * dpr)
    ctx.save()
    ctx.scale(dpr, dpr)

    // ── 画节点间的连线（极淡） ──
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        const maxDist = Math.max(w, h) * 0.5
        if (dist > maxDist) continue
        const alpha = (1 - dist / maxDist) * 0.06
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        // 弧线控制点偏移
        const cx = (a.x + b.x) / 2 + (a.y - b.y) * 0.15
        const cy = (a.y + b.y) / 2 + (b.x - a.x) * 0.15
        ctx.quadraticCurveTo(cx, cy, b.x, b.y)
        ctx.strokeStyle = rgbaStr(c, alpha)
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }

    // ── 画节点（呼吸脉冲） ──
    for (const node of nodes) {
      node.phase += node.speed * 0.016
      const breathe = 1 + Math.sin(node.phase) * 0.3
      const r = node.radius * breathe

      // 光晕
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 4)
      gradient.addColorStop(0, rgbaStr(c, 0.12))
      gradient.addColorStop(1, rgbaStr(c, 0))
      ctx.beginPath()
      ctx.arc(node.x, node.y, r * 4, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // 实心点
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.fillStyle = rgbaStr(c, 0.25)
      ctx.fill()
    }

    // ── 画粒子（沿弧线流动） ──
    for (const p of particles) {
      p.t += p.speed
      if (p.t > 1) {
        p.t = 0
        p.fromIdx = p.toIdx
        p.toIdx = Math.floor(Math.random() * nodes.length)
        if (p.toIdx === p.fromIdx) p.toIdx = (p.toIdx + 1) % nodes.length
        p.speed = randomBetween(0.002, 0.006)
        p.opacity = randomBetween(0.15, 0.5)

        // 到达时偶尔产生 spark
        if (Math.random() < 0.3) {
          const dest = nodes[p.fromIdx]
          sparks.push({
            x: dest.x + randomBetween(-8, 8),
            y: dest.y + randomBetween(-8, 8),
            life: 1,
            size: randomBetween(1.5, 3),
          })
        }
      }

      const from = nodes[p.fromIdx]
      const to = nodes[p.toIdx]
      if (!from || !to) continue

      const cx = (from.x + to.x) / 2 + (from.y - to.y) * 0.15
      const cy = (from.y + to.y) / 2 + (to.x - from.x) * 0.15
      const [px, py] = quadBezier(from.x, from.y, cx, cy, to.x, to.y, p.t)

      // 拖尾
      const fadeAlpha = Math.sin(p.t * Math.PI) * p.opacity
      ctx.beginPath()
      ctx.arc(px, py, p.size, 0, Math.PI * 2)
      ctx.fillStyle = rgbaStr(c, fadeAlpha)
      ctx.fill()
    }

    // ── 画火花（灵感闪烁） ──
    for (let i = sparks.length - 1; i >= 0; i--) {
      const spark = sparks[i]
      spark.life -= 0.02
      if (spark.life <= 0) {
        sparks.splice(i, 1)
        continue
      }
      const sa = spark.life * 0.6
      ctx.beginPath()
      ctx.arc(spark.x, spark.y, spark.size * spark.life, 0, Math.PI * 2)
      ctx.fillStyle = rgbaStr(c, sa)
      ctx.fill()
    }

    ctx.restore()

    animRef.current = requestAnimationFrame((t) => draw(ctx, t))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (!rect) return
      const dpr = window.devicePixelRatio || 1
      stateRef.current.dpr = dpr
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      initScene(rect.width, rect.height)
    }

    resize()
    const observer = new ResizeObserver(resize)
    if (canvas.parentElement) observer.observe(canvas.parentElement)

    animRef.current = requestAnimationFrame((t) => draw(ctx, t))

    return () => {
      cancelAnimationFrame(animRef.current)
      observer.disconnect()
    }
  }, [initScene, draw])

  // 页面不可见时暂停动画
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animRef.current)
      } else {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (ctx) animRef.current = requestAnimationFrame((t) => draw(ctx, t))
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none ${className}`}
      aria-hidden="true"
    />
  )
}
