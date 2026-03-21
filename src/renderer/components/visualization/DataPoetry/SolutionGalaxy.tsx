/**
 * Solution 星系展示 — 将 Solution API 数据映射为星系可视化
 *
 * 每个行业解决方案是一个星系，方案内的 Expert 是行星环绕。
 * 从 Workbench Registry API 和 WorkflowOS Dashboard 获取数据。
 */

import { useState, useEffect, useMemo } from 'react'
import { ParticleCanvas } from './ParticleCanvas'
import type { SolutionNode, WorkflowMeteor } from '../types'

interface SolutionGalaxyProps {
  /** /api/v1/solutions 或本地缓存 */
  apiBase?: string
  className?: string
  dark?: boolean
}

const FALLBACK_SOLUTIONS: SolutionNode[] = [
  { id: 'labor-dispatch', name: '劳务派遣', icon: '👷', expert_count: 3, active_workflows: 2, completed_today: 15, color: '#10b981' },
  { id: 'law-firm', name: '律所运营', icon: '⚖️', expert_count: 3, active_workflows: 1, completed_today: 8, color: '#6366f1' },
  { id: 'finance-tax-service', name: '财税服务', icon: '📊', expert_count: 4, active_workflows: 5, completed_today: 42, color: '#f59e0b' },
  { id: 'construction-cost', name: '工程造价', icon: '🏗️', expert_count: 3, active_workflows: 0, completed_today: 3, color: '#ef4444' },
  { id: 'clinic-respiratory', name: '呼吸科', icon: '🫁', expert_count: 1, active_workflows: 1, completed_today: 6, color: '#06b6d4' },
  { id: 'smb-operations', name: '中小企业运营', icon: '🏢', expert_count: 4, active_workflows: 3, completed_today: 22, color: '#8b5cf6' },
  { id: 'ecommerce-brand-service', name: '品牌电商', icon: '🛒', expert_count: 5, active_workflows: 4, completed_today: 35, color: '#ec4899' },
  { id: 'insurance-operations', name: '保险运营', icon: '🛡️', expert_count: 6, active_workflows: 2, completed_today: 18, color: '#14b8a6' },
  { id: 'study-abroad-consulting', name: '留学咨询', icon: '✈️', expert_count: 2, active_workflows: 1, completed_today: 5, color: '#f97316' },
  { id: 'education-training', name: '教育培训', icon: '📚', expert_count: 3, active_workflows: 2, completed_today: 12, color: '#84cc16' },
  { id: 'investment-research', name: '投研机构', icon: '📈', expert_count: 3, active_workflows: 1, completed_today: 7, color: '#3b82f6' },
]

export function SolutionGalaxy({ apiBase, className = '', dark = false }: SolutionGalaxyProps) {
  const [solutions, setSolutions] = useState<SolutionNode[]>(FALLBACK_SOLUTIONS)
  const [meteors, setMeteors] = useState<WorkflowMeteor[]>([])
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    if (!apiBase) return
    fetch(`${apiBase}/api/v1/solutions`)
      .then(r => r.json())
      .then(data => {
        // Solution Runtime API 返回 { solutions: [...] } 或直接数组
        const list = Array.isArray(data) ? data : data?.solutions
        if (!Array.isArray(list)) return

        setSolutions(list.map((s: any) => {
          const fallback = FALLBACK_SOLUTIONS.find(f => f.id === s.id)
          return {
            id: s.id,
            name: s.name,
            icon: s.icon || fallback?.icon || '🤖',
            expert_count: s.experts?.length || s.expert_count || fallback?.expert_count || 0,
            active_workflows: s.active_workflows ?? fallback?.active_workflows ?? 0,
            completed_today: s.completed_today ?? fallback?.completed_today ?? 0,
            color: fallback?.color || '#6366f1',
          }
        }))
      })
      .catch(() => {})
  }, [apiBase])

  // 模拟流星（进行中的工作流）
  useEffect(() => {
    const interval = setInterval(() => {
      setMeteors(prev => {
        const updated = prev
          .map(m => ({ ...m, progress: m.progress + 0.02, opacity: m.opacity * 0.98 }))
          .filter(m => m.progress < 1 && m.opacity > 0.05)

        if (Math.random() < 0.3 && updated.length < 5) {
          updated.push({
            id: `m-${Date.now()}`,
            from_expert: 'a',
            to_expert: 'b',
            progress: 0,
            opacity: 0.8,
          })
        }
        return updated
      })
    }, 50)
    return () => clearInterval(interval)
  }, [])

  const totalCompleted = useMemo(
    () => solutions.reduce((s, n) => s + n.completed_today, 0),
    [solutions],
  )
  const totalActive = useMemo(
    () => solutions.reduce((s, n) => s + n.active_workflows, 0),
    [solutions],
  )

  return (
    <div className={`relative ${className}`}>
      <ParticleCanvas
        solutions={solutions}
        meteors={meteors}
        density={0.6}
        dark={dark}
        className="min-h-[300px]"
      />

      {/* 方案标签叠加层 */}
      <div className="absolute inset-0 pointer-events-none flex flex-wrap items-center justify-center gap-3 p-6">
        {solutions.map(sol => (
          <div
            key={sol.id}
            className={`pointer-events-auto cursor-default rounded-xl px-3 py-2 backdrop-blur-sm transition-all
              ${hovered === sol.id
                ? 'bg-white/90 dark:bg-[#1e1e1e]/90 shadow-lg scale-105'
                : 'bg-white/40 dark:bg-[#1e1e1e]/40 hover:bg-white/70 dark:hover:bg-[#1e1e1e]/70'
              }`}
            onMouseEnter={() => setHovered(sol.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{sol.icon}</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {sol.name}
              </span>
            </div>
            {hovered === sol.id && (
              <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-500">
                <span>{sol.expert_count} 位专家</span>
                <span>{sol.active_workflows} 进行中</span>
                <span className="font-medium text-emerald-600">{sol.completed_today} 已完成</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 全局统计 */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-full bg-white/70 dark:bg-[#1e1e1e]/70 backdrop-blur-sm px-5 py-2">
        <div className="text-center">
          <p className="text-lg font-bold tabular-nums text-gray-800 dark:text-gray-200">{totalCompleted}</p>
          <p className="text-[10px] text-gray-500">今日完成</p>
        </div>
        <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />
        <div className="text-center">
          <p className="text-lg font-bold tabular-nums text-blue-600">{totalActive}</p>
          <p className="text-[10px] text-gray-500">进行中</p>
        </div>
        <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />
        <div className="text-center">
          <p className="text-lg font-bold tabular-nums text-gray-800 dark:text-gray-200">{solutions.length}</p>
          <p className="text-[10px] text-gray-500">行业方案</p>
        </div>
      </div>
    </div>
  )
}
