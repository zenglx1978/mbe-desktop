import { create } from 'zustand'

interface UsageStats {
  agentStats: { agent_role: string; count: number }[]
  toolStats: { tool_id: string; count: number }[]
  tabStats: { tab_id: string; count: number }[]
  hourStats: { hour: number; count: number }[]
}

interface DefaultParams {
  [toolId: string]: Record<string, string>
}

interface AdaptiveUIState {
  tabOrder: string[] | null
  defaultExpert: number
  defaultParams: DefaultParams
  pinnedTools: string[]
  hiddenTabs: string[]
  usageLoaded: boolean

  loadPreferences: (solutionId: string) => Promise<void>
  trackTabSwitch: (solutionId: string, tabId: string) => void
  trackAgentSwitch: (solutionId: string, agentIndex: number, agentRole: string) => void
  trackToolUse: (solutionId: string, toolId: string, params?: Record<string, string>) => void
  trackWorkflowTiming: (solutionId: string, workflowName: string, durationMs: number, assisted: boolean) => void
  getRecommendedTabOrder: () => string[] | null
  getRecommendedAgent: () => number
  getDefaultParams: (toolId: string) => Record<string, string>
  learnPreferences: (solutionId: string) => Promise<void>
  applyCloudHints: (solutionId: string, hints: Record<string, unknown>) => void
}

function getApi() {
  return (window as any).electronAPI
}

async function track(eventType: string, solutionId: string, extra: Record<string, string | undefined> = {}) {
  try {
    const api = getApi()
    if (api?.db?.usage?.track) {
      await api.db.usage.track({
        eventType,
        solutionId,
        agentRole: extra.agentRole,
        toolId: extra.toolId,
        tabId: extra.tabId,
        metadata: extra.metadata ? JSON.parse(extra.metadata) : undefined,
      })
    }
  } catch {
    // 埋点失败不阻塞 UI
  }
}

async function fetchStats(solutionId: string, days = 30): Promise<UsageStats | null> {
  try {
    const api = getApi()
    if (api?.db?.usage?.stats) {
      return await api.db.usage.stats(solutionId, days)
    }
  } catch {
    // ignore
  }
  return null
}

export const useAdaptiveUIStore = create<AdaptiveUIState>((set, get) => ({
  tabOrder: null,
  defaultExpert: 0,
  defaultParams: {},
  pinnedTools: [],
  hiddenTabs: [],
  usageLoaded: false,

  loadPreferences: async (solutionId: string) => {
    const stats = await fetchStats(solutionId, 30)
    if (!stats) { set({ usageLoaded: true }); return }

    const tabOrder = stats.tabStats
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((t) => t.tab_id)

    const topAgent = stats.agentStats
      .sort((a, b) => b.count - a.count)[0]

    const defaultExpert = topAgent ? parseInt(topAgent.agent_role, 10) || 0 : 0

    const pinnedTools = stats.toolStats
      .filter((t) => t.count >= 3)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((t) => t.tool_id)

    // 读取已保存的默认参数
    let defaultParams: DefaultParams = {}
    try {
      const api = getApi()
      if (api?.session?.get) {
        const saved = await api.session.get(`adaptive_params_${solutionId}`)
        if (saved && typeof saved === 'string') {
          defaultParams = JSON.parse(saved)
        }
      }
    } catch { /* ignore */ }

    set({ tabOrder: tabOrder.length > 0 ? tabOrder : null, defaultExpert, pinnedTools, defaultParams, usageLoaded: true })
  },

  trackTabSwitch: (solutionId, tabId) => {
    track('tab_switch', solutionId, { tabId })
  },

  trackAgentSwitch: (solutionId, agentIndex, agentRole) => {
    track('agent_switch', solutionId, { agentRole: agentRole || String(agentIndex) })
  },

  trackToolUse: (solutionId, toolId, params) => {
    track('tool_use', solutionId, { toolId })

    if (params && Object.keys(params).length > 0) {
      const { defaultParams } = get()
      const existing = defaultParams[toolId] || {}
      const merged = { ...existing }
      for (const [k, v] of Object.entries(params)) {
        if (v && v.trim()) merged[k] = v
      }
      const updated = { ...defaultParams, [toolId]: merged }
      set({ defaultParams: updated })

      try {
        const api = getApi()
        if (api?.session?.set) {
          api.session.set(`adaptive_params_${solutionId}`, JSON.stringify(updated)).catch(() => {})
        }
      } catch { /* ignore */ }
    }
  },

  trackWorkflowTiming: (solutionId, workflowName, durationMs, assisted) => {
    track('workflow_timing', solutionId, {
      toolId: workflowName,
      metadata: JSON.stringify({ durationMs, assisted }),
    })
  },

  getRecommendedTabOrder: () => get().tabOrder,

  getRecommendedAgent: () => get().defaultExpert,

  getDefaultParams: (toolId) => get().defaultParams[toolId] || {},

  learnPreferences: async (solutionId) => {
    await get().loadPreferences(solutionId)
  },

  applyCloudHints: (_solutionId, hints) => {
    if (hints.tabOrder && Array.isArray(hints.tabOrder)) {
      set({ tabOrder: hints.tabOrder as string[] })
    }
    if (typeof hints.defaultExpert === 'number') {
      set({ defaultExpert: hints.defaultExpert })
    }
  },
}))
