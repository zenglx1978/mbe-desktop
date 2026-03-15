/**
 * 自适应 UI Store（Bitter Lesson: 从交互数据学习最优布局）
 *
 * 核心逻辑:
 * 1. 追踪用户交互模式（Tab 偏好、工具使用、活跃时段）
 * 2. 持久化 UI 偏好（Expert 索引、侧边栏、默认 Tab）
 * 3. 基于使用频率推荐最可能的操作
 */

import { create } from 'zustand'

interface UIPreferences {
  /** 每个方案的默认 Expert 索引 */
  defaultAgentPerSolution: Record<string, number>
  /** 每个方案的默认工作台 Tab */
  defaultTabPerSolution: Record<string, string>
  /** 最常用工具 Top5 */
  frequentTools: string[]
  /** 侧边栏展开偏好 */
  sidebarExpanded: boolean
}

interface AdaptiveUIState {
  preferences: UIPreferences
  loaded: boolean

  /** 记录 Tab 切换 */
  trackTabSwitch: (solutionId: string, tabId: string) => void
  /** 记录 Expert 切换 */
  trackAgentSwitch: (solutionId: string, agentIndex: number, agentRole: string) => void
  /** 记录工具使用 */
  trackToolUse: (solutionId: string, toolId: string) => void
  /** 从历史数据学习偏好 */
  learnPreferences: (solutionId: string) => Promise<void>
  /** 获取推荐默认 Expert 索引 */
  getRecommendedAgent: (solutionId: string) => number
  /** 获取推荐默认 Tab */
  getRecommendedTab: (solutionId: string) => string
  /** 加载持久化偏好 */
  loadPreferences: () => Promise<void>
  /** 保存偏好 */
  savePreferences: () => Promise<void>
  /** Phase 10.4: 应用云端 UI 提示（推荐 Expert/Tab/工具） */
  applyCloudHints: (solutionId: string, hints: Record<string, unknown>) => void
}

function api() {
  return (window as any).electronAPI
}

const DEFAULT_PREFS: UIPreferences = {
  defaultAgentPerSolution: {},
  defaultTabPerSolution: {},
  frequentTools: [],
  sidebarExpanded: true,
}

export const useAdaptiveUIStore = create<AdaptiveUIState>((set, get) => ({
  preferences: { ...DEFAULT_PREFS },
  loaded: false,

  trackTabSwitch: (solutionId, tabId) => {
    try {
      api()?.db?.usage?.track({ eventType: 'tab_switch', solutionId, tabId })
    } catch { /* 非 Electron */ }
  },

  trackAgentSwitch: (solutionId, agentIndex, agentRole) => {
    try {
      api()?.db?.usage?.track({
        eventType: 'agent_switch',
        solutionId,
        agentRole,
        metadata: { agentIndex },
      })
    } catch { /* 非 Electron */ }
  },

  trackToolUse: (solutionId, toolId) => {
    try {
      api()?.db?.usage?.track({ eventType: 'tool_use', solutionId, toolId })
    } catch { /* 非 Electron */ }
  },

  learnPreferences: async (solutionId) => {
    try {
      const stats = await api()?.db?.usage?.stats(solutionId, 30)
      if (!stats) return

      const prefs = { ...get().preferences }

      // 最常用 Expert → 默认 Expert
      if (stats.agentStats?.length > 0) {
        const topAgent = stats.agentStats[0]
        const meta = await api()?.db?.usage?.stats(solutionId, 7)
        const recentTop = meta?.agentStats?.[0]
        // 短期偏好优先于长期，体现学习动态性
        if (recentTop) {
          const agentEvents = await getAgentIndexFromRole(solutionId, recentTop.agent_role)
          if (agentEvents >= 0) prefs.defaultAgentPerSolution[solutionId] = agentEvents
        } else {
          const idx = await getAgentIndexFromRole(solutionId, topAgent.agent_role)
          if (idx >= 0) prefs.defaultAgentPerSolution[solutionId] = idx
        }
      }

      // 最常用 Tab → 默认 Tab
      if (stats.tabStats?.length > 0) {
        prefs.defaultTabPerSolution[solutionId] = stats.tabStats[0].tab_id
      }

      // 最常用工具
      if (stats.toolStats?.length > 0) {
        prefs.frequentTools = stats.toolStats.slice(0, 5).map((t: any) => t.tool_id)
      }

      set({ preferences: prefs })
      get().savePreferences()
    } catch { /* 数据不足时保持默认 */ }
  },

  getRecommendedAgent: (solutionId) => {
    return get().preferences.defaultAgentPerSolution[solutionId] ?? 0
  },

  getRecommendedTab: (solutionId) => {
    return get().preferences.defaultTabPerSolution[solutionId] ?? 'chat'
  },

  loadPreferences: async () => {
    try {
      const raw = await api()?.session?.get('adaptiveUIPrefs')
      if (raw) {
        set({ preferences: { ...DEFAULT_PREFS, ...raw }, loaded: true })
      } else {
        set({ loaded: true })
      }
    } catch {
      set({ loaded: true })
    }
  },

  savePreferences: async () => {
    try {
      await api()?.session?.set('adaptiveUIPrefs', get().preferences)
    } catch { /* 非 Electron */ }
  },

  applyCloudHints: (solutionId, hints) => {
    const prefs = { ...get().preferences }
    let changed = false

    // 仅在本地无偏好时使用云端推荐
    if (hints.recommended_expert && !(solutionId in prefs.defaultAgentPerSolution)) {
      getAgentIndexFromRole(solutionId, hints.recommended_expert as string)
        .then(idx => {
          if (idx >= 0) {
            const p = { ...get().preferences }
            p.defaultAgentPerSolution[solutionId] = idx
            set({ preferences: p })
            get().savePreferences()
          }
        })
        .catch(() => {})
    }

    if (hints.recommended_tab && !(solutionId in prefs.defaultTabPerSolution)) {
      prefs.defaultTabPerSolution[solutionId] = hints.recommended_tab as string
      changed = true
    }

    if (hints.popular_tools && Array.isArray(hints.popular_tools) && prefs.frequentTools.length === 0) {
      prefs.frequentTools = hints.popular_tools as string[]
      changed = true
    }

    if (changed) {
      set({ preferences: prefs })
      get().savePreferences()
    }
  },
}))

/** 从 solution-router 解析 agentRole → agentIndex */
async function getAgentIndexFromRole(solutionId: string, agentRole: string): Promise<number> {
  try {
    const { getSolution } = await import('@/lib/solution-router')
    const solution = getSolution(solutionId)
    if (!solution) return -1
    return solution.agents.findIndex(a => a.role === agentRole)
  } catch {
    return -1
  }
}
