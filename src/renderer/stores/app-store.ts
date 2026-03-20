import { create } from 'zustand'
import { getSolution, type SolutionConfig } from '@/lib/solution-router'

/** 计费归因上下文 — 随每次 LLM 调用传递到后端 */
export interface BillingContext {
  solutionId: string
  solutionRole: string
  subAccountId: string
}

interface AppState {
  solutionId: string | null
  currentSolutionId: string | null
  hasPickedSolution: boolean
  sidebarExpanded: boolean
  currentAgentIndex: number

  /** 当前用户在当前方案下的角色与子账号（成本归因用） */
  billingContext: BillingContext | null
  _billingCacheKey: string

  setSolution: (id: string) => void
  switchAgent: (index: number) => void
  toggleSidebar: () => void
  currentSolution: () => SolutionConfig | undefined
  initFromStorage: () => Promise<void>
  /** 从后端拉取当前用户的方案角色（切换方案时自动调用） */
  fetchBillingContext: (solutionId: string) => Promise<void>
  getBillingContext: () => BillingContext | null
}

const STORAGE_KEY = 'lastSolutionId'

function persist(id: string) {
  try {
    const api = (window as any).electronAPI
    if (api?.session?.set) {
      api.session.set(STORAGE_KEY, id).catch(() => localStorage.setItem(STORAGE_KEY, id))
    } else {
      localStorage.setItem(STORAGE_KEY, id)
    }
  } catch {
    localStorage.setItem(STORAGE_KEY, id)
  }
}

export const useAppStore = create<AppState>((set, get) => {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  return {
    solutionId: stored,
    currentSolutionId: stored,
    hasPickedSolution: !!stored,
    sidebarExpanded: true,
    currentAgentIndex: 0,
    billingContext: null,
    _billingCacheKey: '',

    setSolution: (id) => {
      set({ solutionId: id, currentSolutionId: id, hasPickedSolution: true, currentAgentIndex: 0 })
      persist(id)
      get().fetchBillingContext(id)
    },

    switchAgent: (index) => set({ currentAgentIndex: index }),

    toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),

    currentSolution: () => {
      const id = get().solutionId
      return id ? getSolution(id) : undefined
    },

    getBillingContext: () => get().billingContext,

    fetchBillingContext: async (solutionId: string) => {
      const { useAuthStore } = await import('@/stores/auth-store')
      const auth = useAuthStore.getState()
      const userId = auth.user?.userId || ''
      const cacheKey = `${userId}:${solutionId}`
      if (get()._billingCacheKey === cacheKey && get().billingContext) return

      const ctx: BillingContext = {
        solutionId,
        solutionRole: auth.user?.solutionRole || '',
        subAccountId: auth.user?.subAccountId || '',
      }

      if (userId && auth.token) {
        try {
          const { API_BASE, authHeaders } = await import('@/lib/api-client')
          const resp = await fetch(
            `${API_BASE}/api/v1/users/me/solution-role?solution_id=${solutionId}`,
            { headers: authHeaders() },
          )
          if (resp.ok) {
            const data = await resp.json()
            ctx.solutionRole = data.solution_role || ''
            ctx.subAccountId = data.sub_account_id || ''
          }
        } catch {
          // 查询失败时使用 auth store 中的缓存值
        }
      }

      set({ billingContext: ctx, _billingCacheKey: cacheKey })
    },

    initFromStorage: async () => {
      try {
        const api = (window as any).electronAPI
        if (api?.session?.get) {
          const id = await api.session.get(STORAGE_KEY)
          if (id && typeof id === 'string') {
            set({ solutionId: id, currentSolutionId: id, hasPickedSolution: true })
            get().fetchBillingContext(id)
            return
          }
        }
      } catch {
        // fallback
      }
      const id = localStorage.getItem(STORAGE_KEY)
      if (id) {
        set({ solutionId: id, currentSolutionId: id, hasPickedSolution: true })
        get().fetchBillingContext(id)
      }
    },
  }
})
