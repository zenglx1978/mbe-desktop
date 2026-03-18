import { create } from 'zustand'
import { getSolution, type SolutionConfig } from '@/lib/solution-router'

interface AppState {
  solutionId: string | null
  currentSolutionId: string | null
  hasPickedSolution: boolean
  sidebarExpanded: boolean
  currentAgentIndex: number
  setSolution: (id: string) => void
  switchAgent: (index: number) => void
  toggleSidebar: () => void
  currentSolution: () => SolutionConfig | undefined
  initFromStorage: () => Promise<void>
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

    setSolution: (id) => {
      set({ solutionId: id, currentSolutionId: id, hasPickedSolution: true, currentAgentIndex: 0 })
      persist(id)
    },

    switchAgent: (index) => set({ currentAgentIndex: index }),

    toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),

    currentSolution: () => {
      const id = get().solutionId
      return id ? getSolution(id) : undefined
    },

    initFromStorage: async () => {
      try {
        const api = (window as any).electronAPI
        if (api?.session?.get) {
          const id = await api.session.get(STORAGE_KEY)
          if (id && typeof id === 'string') {
            set({ solutionId: id, currentSolutionId: id, hasPickedSolution: true })
            return
          }
        }
      } catch {
        // fallback
      }
      const id = localStorage.getItem(STORAGE_KEY)
      if (id) set({ solutionId: id, currentSolutionId: id, hasPickedSolution: true })
    },
  }
})
