/**
 * 智能缓存 Store（Bitter Lesson: 从使用频率学习缓存策略）
 *
 * 核心逻辑:
 * 1. 追踪 API 请求频率 → 高频请求自动提升缓存优先级
 * 2. 离线时从本地缓存返回 → 降级而非拒绝服务
 * 3. 缓存淘汰由使用数据驱动 → 而非固定 LRU
 */

import { create } from 'zustand'

interface CacheStats {
  totalEntries: number
  hitCount: number
  missCount: number
  hitRate: number
}

interface CacheWarmupHint {
  key: string
  workflow_id?: string
  priority: number
  ttl_hours: number
}

interface SmartCacheState {
  stats: CacheStats
  enabled: boolean

  /** 带缓存的 fetch — 命中时直接返回，未命中时请求并缓存 */
  cachedFetch: (url: string, solutionId: string, options?: RequestInit, ttlMinutes?: number) => Promise<Response | null>
  /** 手动写入缓存 */
  writeCache: (key: string, solutionId: string, data: unknown, priority?: number) => Promise<void>
  /** 清理低优先级缓存 */
  prune: (maxEntries?: number) => Promise<number>
  /** 更新统计 */
  refreshStats: () => void
  /** Phase 10.4: 应用云端缓存预热提示 */
  applyCacheWarmup: (solutionId: string, hints: CacheWarmupHint[]) => Promise<void>
}

let _hitCount = 0
let _missCount = 0
let _totalEntries = 0

function api() {
  return (window as any).electronAPI
}

export const useSmartCacheStore = create<SmartCacheState>((set) => ({
  stats: { totalEntries: 0, hitCount: 0, missCount: 0, hitRate: 0 },
  enabled: true,

  cachedFetch: async (url, solutionId, options, ttlMinutes = 60) => {
    const cacheKey = `fetch:${url}:${JSON.stringify(options?.body ?? '')}`

    try {
      const cached = await api()?.db?.cache?.get(cacheKey)
      if (cached?.content_json) {
        _hitCount++
        set({ stats: { totalEntries: _totalEntries, hitCount: _hitCount, missCount: _missCount, hitRate: _hitCount / (_hitCount + _missCount) } })
        return new Response(cached.content_json, {
          headers: { 'content-type': 'application/json', 'x-cache': 'HIT' },
        })
      }
    } catch { /* 非 Electron 环境 */ }

    _missCount++

    try {
      const resp = await fetch(url, options)
      if (resp.ok) {
        const text = await resp.clone().text()
        const priority = Math.min(0.5 + (_hitCount * 0.01), 1.0)
        const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString()

        try {
          await api()?.db?.cache?.set({
            cacheKey,
            solutionId,
            contentJson: text,
            priority,
            expiresAt,
          })
          _totalEntries++
        } catch { /* 非 Electron */ }
      }

      set({ stats: { totalEntries: _totalEntries, hitCount: _hitCount, missCount: _missCount, hitRate: _hitCount / Math.max(_hitCount + _missCount, 1) } })
      return resp
    } catch {
      return null
    }
  },

  writeCache: async (key, solutionId, data, priority = 0.5) => {
    try {
      await api()?.db?.cache?.set({
        cacheKey: key,
        solutionId,
        contentJson: JSON.stringify(data),
        priority,
      })
    } catch { /* 非 Electron */ }
  },

  prune: async (maxEntries = 500) => {
    try {
      return (await api()?.db?.cache?.prune(maxEntries)) ?? 0
    } catch {
      return 0
    }
  },

  refreshStats: () => {
    set({ stats: { totalEntries: _totalEntries, hitCount: _hitCount, missCount: _missCount, hitRate: _hitCount / Math.max(_hitCount + _missCount, 1) } })
  },

  applyCacheWarmup: async (solutionId, hints) => {
    for (const hint of hints) {
      try {
        const expiresAt = new Date(Date.now() + hint.ttl_hours * 3600_000).toISOString()
        await api()?.db?.cache?.set({
          cacheKey: hint.key,
          solutionId,
          contentJson: JSON.stringify({ _warmup: true, workflow_id: hint.workflow_id }),
          priority: Math.min(hint.priority / 100, 1.0),
          expiresAt,
        })
      } catch { /* 非 Electron */ }
    }
  },
}))
