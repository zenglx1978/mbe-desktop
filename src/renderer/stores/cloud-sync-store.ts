/**
 * 云端配置同步 Store — Bitter Lesson Phase 10.4
 *
 * 联邦学习闭环：服务端学习 → 快照打包 → Desktop 拉取 → 应用到本地 Store
 *
 * 数据流:
 *   服务端(HOPE/Telemetry/AutoExp) → generate_snapshot()
 *   → GET /api/v1/config-snapshot/{solution_id}
 *   → Desktop pull → 保存到 SQLite → 分发到 LocalFeedback/SmartCache/AdaptiveUI
 */

import { create } from 'zustand'
import { API_BASE, isElectron } from '@/lib/api-client'

interface ExpertRanking {
  score: number
  confidence: number
  sample_count: number
  success_rate?: number
  avg_quality?: number
  hope_preference?: number
}

interface CacheWarmupHint {
  key: string
  workflow_id?: string
  priority: number
  ttl_hours: number
}

interface CloudSnapshot {
  version: number
  solution_id: string
  generated_at: string
  expert_rankings: Record<string, ExpertRanking>
  routing_weights: Record<string, number>
  cache_warmup: CacheWarmupHint[]
  ui_hints: Record<string, unknown>
  config_overrides: Record<string, unknown>
  knowledge_warnings: string[]
}

interface CloudSyncState {
  lastSyncAt: string | null
  lastVersion: number
  syncInProgress: boolean
  lastError: string | null
  currentSnapshot: CloudSnapshot | null

  pullSnapshot: (solutionId: string) => Promise<boolean>
  applySnapshot: (solutionId: string) => Promise<void>
  checkVersion: (solutionId: string) => Promise<number>
  loadCachedSnapshot: (solutionId: string) => Promise<void>
  getSnapshot: () => CloudSnapshot | null
}

function api() {
  return (window as any).electronAPI
}

export const useCloudSyncStore = create<CloudSyncState>((set, get) => ({
  lastSyncAt: null,
  lastVersion: 0,
  syncInProgress: false,
  lastError: null,
  currentSnapshot: null,

  checkVersion: async (solutionId: string) => {
    if (!isElectron()) return 0
    try {
      const resp = await fetch(
        `${API_BASE}/api/v1/config-snapshot/${solutionId}/version`,
        { signal: AbortSignal.timeout(5000) },
      )
      if (!resp.ok) return 0
      const data = await resp.json()
      return data.version ?? 0
    } catch {
      return 0
    }
  },

  pullSnapshot: async (solutionId: string) => {
    if (get().syncInProgress) return false
    set({ syncInProgress: true, lastError: null })

    try {
      const localVersion = await api()?.db?.snapshot?.version(solutionId) ?? 0

      const resp = await fetch(
        `${API_BASE}/api/v1/config-snapshot/${solutionId}?since_version=${localVersion}`,
        { signal: AbortSignal.timeout(15000) },
      )

      if (!resp.ok) {
        set({ syncInProgress: false, lastError: `HTTP ${resp.status}` })
        return false
      }

      const data = await resp.json()

      if (data.status === 'up_to_date') {
        set({
          syncInProgress: false,
          lastSyncAt: new Date().toISOString(),
          lastVersion: data.version,
        })
        return false
      }

      // 保存到本地 SQLite
      const snapshot = data as CloudSnapshot
      await api()?.db?.snapshot?.save(
        solutionId,
        snapshot.version,
        JSON.stringify(snapshot),
      )

      set({
        syncInProgress: false,
        lastSyncAt: new Date().toISOString(),
        lastVersion: snapshot.version,
        currentSnapshot: snapshot,
      })

      return true
    } catch (err: any) {
      set({
        syncInProgress: false,
        lastError: err?.message || 'sync failed',
      })
      return false
    }
  },

  applySnapshot: async (solutionId: string) => {
    const snapshot = get().currentSnapshot
    if (!snapshot || snapshot.solution_id !== solutionId) return

    // 1. 应用到 LocalFeedback Store
    try {
      const { useLocalFeedbackStore } = await import('./local-feedback-store')
      const feedbackStore = useLocalFeedbackStore.getState()
      if (typeof feedbackStore.applyCloudRankings === 'function') {
        feedbackStore.applyCloudRankings(solutionId, snapshot.expert_rankings)
      }
    } catch { /* store 未加载时静默忽略 */ }

    // 2. 应用到 SmartCache Store（缓存预热）
    try {
      const { useSmartCacheStore } = await import('./smart-cache-store')
      const cacheStore = useSmartCacheStore.getState()
      if (typeof cacheStore.applyCacheWarmup === 'function') {
        cacheStore.applyCacheWarmup(solutionId, snapshot.cache_warmup)
      }
    } catch { /* store 未加载时静默忽略 */ }

    // 3. 应用到 AdaptiveUI Store
    try {
      const { useAdaptiveUIStore } = await import('./adaptive-ui-store')
      const uiStore = useAdaptiveUIStore.getState()
      if (typeof uiStore.applyCloudHints === 'function') {
        uiStore.applyCloudHints(solutionId, snapshot.ui_hints)
      }
    } catch { /* store 未加载时静默忽略 */ }
  },

  loadCachedSnapshot: async (solutionId: string) => {
    try {
      const row = await api()?.db?.snapshot?.latest(solutionId)
      if (row?.snapshot_json) {
        const snapshot = JSON.parse(row.snapshot_json) as CloudSnapshot
        set({
          currentSnapshot: snapshot,
          lastVersion: snapshot.version,
          lastSyncAt: row.applied_at,
        })
      }
    } catch { /* 数据库不可用时静默 */ }
  },

  getSnapshot: () => get().currentSnapshot,
}))


// ── 自动同步调度器 ──

export function startCloudSync(_solutionId: string): () => void {
  // config-snapshot 端点尚未部署，跳过避免 403/404 控制台噪音
  // TODO: 服务端部署 /api/v1/config-snapshot 后恢复以下逻辑
  return () => {}

  /*
  const SYNC_INTERVAL_MS = 30 * 60 * 1000 // 30 分钟
  let syncTimer: ReturnType<typeof setInterval> | null = null

  if (syncTimer) clearInterval(syncTimer)

  const doSync = async () => {
    const store = useCloudSyncStore.getState()
    const hasNew = await store.pullSnapshot(_solutionId)
    if (hasNew) {
      await store.applySnapshot(_solutionId)
    }
  }

  const initialTimeout = setTimeout(doSync, 10_000)
  syncTimer = setInterval(doSync, SYNC_INTERVAL_MS)

  return () => {
    clearTimeout(initialTimeout)
    if (syncTimer) {
      clearInterval(syncTimer)
      syncTimer = null
    }
  }
  */
}
