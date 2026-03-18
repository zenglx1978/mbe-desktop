import { create } from 'zustand'

interface CacheWarmupHint {
  key: string
  workflow_id?: string
  priority: number
  ttl_hours: number
}

interface SmartCacheState {
  prune: (maxEntries: number) => void
  applyCacheWarmup: (solutionId: string, hints: CacheWarmupHint[]) => void
}

export const useSmartCacheStore = create<SmartCacheState>(() => ({
  prune: () => {},
  applyCacheWarmup: () => {},
}))
