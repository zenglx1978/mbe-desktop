import { create } from 'zustand'
import { type SolutionConfig, SOLUTION_REGISTRY, getSolution } from '@/lib/solution-router'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'

interface AppState {
  /** 当前选中的行业方案 ID */
  currentSolutionId: string | null
  /** 当前选中的专家索引（在方案的 agents 列表中） */
  currentAgentIndex: number
  /** 是否已完成首次方案选择 */
  hasPickedSolution: boolean
  /** 侧边栏是否展开 */
  sidebarExpanded: boolean

  /** 获取当前方案配置 */
  currentSolution: () => SolutionConfig | undefined
  /** 选择行业方案 */
  pickSolution: (id: string) => void
  /** 切换方案 */
  switchSolution: (id: string) => void
  /** 切换当前专家 */
  switchAgent: (index: number) => void
  /** 切换侧边栏 */
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  currentSolutionId: null,
  currentAgentIndex: 0,
  hasPickedSolution: false,
  sidebarExpanded: true,

  currentSolution: () => {
    const id = get().currentSolutionId
    return id ? getSolution(id) : undefined
  },

  pickSolution: (id: string) => {
    const adaptive = useAdaptiveUIStore.getState()
    const recommendedAgent = adaptive.getRecommendedAgent(id)
    set({ currentSolutionId: id, currentAgentIndex: recommendedAgent, hasPickedSolution: true })
    persistSolution(id)
    adaptive.learnPreferences(id)
  },

  switchSolution: (id: string) => {
    const adaptive = useAdaptiveUIStore.getState()
    const recommendedAgent = adaptive.getRecommendedAgent(id)
    set({ currentSolutionId: id, currentAgentIndex: recommendedAgent })
    persistSolution(id)
    adaptive.learnPreferences(id)
  },

  switchAgent: (index: number) => {
    set({ currentAgentIndex: index })
  },

  toggleSidebar: () => {
    set(s => ({ sidebarExpanded: !s.sidebarExpanded }))
  },
}))

/** 持久化到 Electron session */
async function persistSolution(solutionId: string) {
  try {
    const api = (window as any).electronAPI
    if (api?.session?.set) {
      await api.session.set('lastSolutionId', solutionId)
    }
  } catch {
    // 非 Electron 环境（浏览器开发模式）
    localStorage.setItem('lastSolutionId', solutionId)
  }
}

/** 启动时恢复上次选择的方案 */
export async function restoreSolution(): Promise<string | null> {
  try {
    const api = (window as any).electronAPI
    if (api?.session?.get) {
      return await api.session.get('lastSolutionId')
    }
  } catch {
    // fallback
  }
  return localStorage.getItem('lastSolutionId')
}

export { SOLUTION_REGISTRY }
