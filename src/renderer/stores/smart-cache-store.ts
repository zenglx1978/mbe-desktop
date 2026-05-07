/**
 * SmartCache Store — 两级缓存（内存 LRU + SQLite 持久化）
 *
 * 职责：
 *   - prune(maxEntries)        — 内存 + DB 双层修剪，防止无限膨胀
 *   - applyCacheWarmup(...)    — 云端快照触发缓存预热，将高优先级条目拉入 SQLite
 *   - saveSnippet(...)         — 将在线 Agent 回答提取为知识片段，持久化供离线检索
 *
 * 设计原则：
 *   - 纯 renderer 层：通过 window.electronAPI IPC 访问 SQLite 和 local-inference
 *   - 内存层仅维护 key→timestamp 映射，实际数据在 SQLite
 *   - 所有操作非阻塞：warmup 异步批量执行，prune 异步触发 DB 裁剪
 *
 * 知识片段格式（与 local-inference loadCachedSnippets 兼容）：
 *   cache_key: 'kb_snippet_{id}'
 *   content_json: { patterns: string[], answer: string, category, confidence }
 */

import { create } from 'zustand'

export interface CacheWarmupHint {
  key: string
  workflow_id?: string
  priority: number
  ttl_hours: number
}

export interface KnowledgeSnippetInput {
  /** 唯一 ID（建议用 agentId + hash） */
  id: string
  /** 匹配模式（正则字符串，不带 / / 包裹） */
  patterns: string[]
  /** 回答文本 */
  answer: string
  /** 领域分类：finance / legal / cost / pulmonary / hr / ... */
  category: string
  /** 置信度 0-1 */
  confidence: number
  /** 归属方案 */
  solutionId: string
  /** 缓存有效期（小时），默认 720 = 30 天 */
  ttlHours?: number
}

interface SmartCacheState {
  /** 内存层：key → lastAccessedAt */
  _memIndex: Map<string, number>
  /** 当前待预热队列（按 priority 降序） */
  _warmupQueue: CacheWarmupHint[]

  prune: (maxEntries: number) => void
  applyCacheWarmup: (solutionId: string, hints: CacheWarmupHint[]) => void
  /** 将在线回答提取为知识片段，持久化供离线 TF-IDF 检索 */
  saveSnippet: (snippet: KnowledgeSnippetInput) => Promise<void>

  /** 内部：将一个条目写入 SQLite 缓存（供 warmup 使用） */
  _persistEntry: (key: string, solutionId: string, content: unknown, priorityScore: number, ttlHours: number) => Promise<void>
}

type ElectronAPI = {
  db?: {
    cache?: {
      get: (key: string) => Promise<{ success: boolean; data?: { content_json: string } }>
      set: (data: { cacheKey: string; solutionId: string; contentJson: string; priority?: number; expiresAt?: string }) => Promise<{ success: boolean }>
      prune: (maxEntries?: number) => Promise<{ success: boolean; deleted?: number }>
    }
  }
  inference?: {
    persistSnippet: (data: {
      id: string; patterns: string[]; answer: string
      category: string; confidence: number; solutionId: string; ttlHours?: number
    }) => Promise<{ success: boolean }>
  }
}

/** 安全访问 electronAPI，SSR / Web 模式下返回 null */
function getElectronAPI(): ElectronAPI | null {
  if (typeof window === 'undefined') return null
  return (window as Window & { electronAPI?: ElectronAPI }).electronAPI ?? null
}

function getCacheAPI() {
  return getElectronAPI()?.db?.cache ?? null
}

export const useSmartCacheStore = create<SmartCacheState>((set, get) => ({
  _memIndex: new Map(),
  _warmupQueue: [],

  prune(maxEntries: number) {
    const state = get()

    // 1. 内存层裁剪：移除最早访问的条目
    const memIndex = state._memIndex
    if (memIndex.size > maxEntries) {
      const sorted = [...memIndex.entries()].sort((a, b) => a[1] - b[1])
      const toRemove = sorted.slice(0, memIndex.size - maxEntries)
      const newIndex = new Map(memIndex)
      toRemove.forEach(([k]) => newIndex.delete(k))
      set({ _memIndex: newIndex })
    }

    // 2. SQLite 层裁剪（异步，不阻塞 UI）
    const api = getCacheAPI()
    if (api) {
      api.prune(maxEntries).catch(() => { /* 静默，DB 操作失败不影响 UI */ })
    }
  },

  applyCacheWarmup(solutionId: string, hints: CacheWarmupHint[]) {
    if (!hints || hints.length === 0) return

    // 按 priority 降序排列，高优先级先预热
    const sorted = [...hints].sort((a, b) => b.priority - a.priority)
    set({ _warmupQueue: sorted })

    const api = getCacheAPI()
    if (!api) return

    const state = get()

    // 异步批量预热：检查是否已缓存，未缓存则写入占位条目
    ;(async () => {
      for (const hint of sorted) {
        try {
          const existing = await api.get(hint.key)
          if (existing?.success && existing.data) {
            // 已在 SQLite 中，只更新内存索引
            state._memIndex.set(hint.key, Date.now())
            continue
          }

          // 未缓存：写入标记占位（content 为空对象），等待实际业务填充
          const expiresAt = new Date(Date.now() + hint.ttl_hours * 3600 * 1000).toISOString()
          await state._persistEntry(hint.key, solutionId, { _warmup: true, workflow_id: hint.workflow_id }, hint.priority, hint.ttl_hours)
          void expiresAt // 在 _persistEntry 内部使用
        } catch {
          /* 单条失败不影响后续 */
        }
      }
    })()
  },

  async _persistEntry(key: string, solutionId: string, content: unknown, priorityScore: number, ttlHours: number) {
    const api = getCacheAPI()
    if (!api) return

    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString()
    const result = await api.set({
      cacheKey: key,
      solutionId,
      contentJson: JSON.stringify(content),
      priority: priorityScore,
      expiresAt,
    })

    if (result?.success) {
      const state = get()
      const newIndex = new Map(state._memIndex)
      newIndex.set(key, Date.now())
      set({ _memIndex: newIndex })
    }
  },

  async saveSnippet(snippet: KnowledgeSnippetInput) {
    const electronAPI = getElectronAPI()
    if (!electronAPI?.inference?.persistSnippet) return

    try {
      await electronAPI.inference.persistSnippet({
        id: snippet.id,
        patterns: snippet.patterns,
        answer: snippet.answer,
        category: snippet.category,
        confidence: snippet.confidence,
        solutionId: snippet.solutionId,
        ttlHours: snippet.ttlHours ?? 720,
      })

      // 更新内存索引
      const state = get()
      const newIndex = new Map(state._memIndex)
      newIndex.set(`kb_snippet_${snippet.id}`, Date.now())
      set({ _memIndex: newIndex })
    } catch {
      /* 片段持久化失败不影响在线流程 */
    }
  },
}))
