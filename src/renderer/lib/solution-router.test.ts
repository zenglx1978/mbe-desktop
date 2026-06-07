/**
 * solution-router 单元测试
 *
 * 测试方案注册表查询、状态过滤、主题注入、状态重置
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// mock api-client（避免 import.meta.env 在 Node 环境不可用）
vi.mock('@/lib/api-client', () => ({
  API_BASE: '',
  authHeaders: () => ({ 'Content-Type': 'application/json' }),
}))

// mock solution-registry-data（控制注册表内容）
vi.mock('@/lib/solution-registry-data', () => ({
  SOLUTION_REGISTRY: [
    {
      id: 'law-firm',
      name: '律所运营方案',
      status: 'available',
      agents: [{ id: 'legal', role: '诉讼分析专家', handles: 'legal', baseUrl: '/api/legal', wsUrl: '/api/legal/ws' }],
      theme: { primary: '215 91% 55%', accent: '215 91% 55%' },
    },
    {
      id: 'finance',
      name: '财税专业服务方案',
      status: 'available',
      agents: [{ id: 'finance', role: '税务专家', handles: 'finance', baseUrl: '/api/finance', wsUrl: '/api/finance/ws' }],
      theme: { primary: '142 71% 45%', accent: '142 71% 45%' },
    },
    {
      id: 'beta-only',
      name: '内测方案',
      status: 'coming_soon',
      agents: [],
      theme: { primary: '0 0% 50%', accent: '0 0% 50%' },
    },
  ],
}))

import {
  getSolution,
  getAvailableSolutions,
  getDefaultAgent,
  resetSolutionStatuses,
  getEffectiveStatus,
  isStatusSynced,
} from '@/lib/solution-router'

describe('getSolution', () => {
  it('返回已知方案', () => {
    const sol = getSolution('law-firm')
    expect(sol).toBeDefined()
    expect(sol?.name).toBe('律所运营方案')
  })

  it('未知 ID 返回 undefined', () => {
    expect(getSolution('nonexistent')).toBeUndefined()
  })
})

describe('getAvailableSolutions', () => {
  beforeEach(() => {
    resetSolutionStatuses()
  })

  it('返回本地注册表中 status=available 的方案', () => {
    const available = getAvailableSolutions()
    const ids = available.map(s => s.id)
    expect(ids).toContain('law-firm')
    expect(ids).toContain('finance')
  })

  it('排除 coming_soon 方案', () => {
    const available = getAvailableSolutions()
    expect(available.find(s => s.id === 'beta-only')).toBeUndefined()
  })
})

describe('getDefaultAgent', () => {
  it('返回方案第一个 Agent', () => {
    const sol = getSolution('law-firm')!
    const agent = getDefaultAgent(sol)
    expect(agent.id).toBe('legal')
    expect(agent.wsUrl).toBe('/api/legal/ws')
  })
})

describe('getEffectiveStatus — 离线模式（未同步）', () => {
  beforeEach(() => {
    resetSolutionStatuses()
  })

  it('未同步时回退本地注册表状态', () => {
    expect(isStatusSynced()).toBe(false)
    expect(getEffectiveStatus('law-firm')).toBe('available')
    expect(getEffectiveStatus('beta-only')).toBe('coming_soon')
  })

  it('未知方案返回 available（兜底）', () => {
    expect(getEffectiveStatus('ghost-solution')).toBe('available')
  })
})

describe('resetSolutionStatuses', () => {
  it('重置后 isStatusSynced 返回 false', () => {
    resetSolutionStatuses()
    expect(isStatusSynced()).toBe(false)
  })
})
