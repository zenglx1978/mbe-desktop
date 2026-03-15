/**
 * 本地反馈路由 Store（Bitter Lesson: 从用户行为数据学习 Expert 偏好）
 *
 * 核心逻辑:
 * 1. 追踪 Expert 满意度信号（点赞/踩、切换、超时）
 * 2. 计算每个 Expert 的本地 ELO 分数
 * 3. 在 intent-router 之前叠加本地路由偏好
 *
 * 信号采集（无侵入式）:
 * - positive: 用户复制回答、继续追问同一 Expert
 * - negative: 用户中途切换 Expert、回答后清空重来
 * - switch: 系统路由到 A 但用户手动切到 B → A 扣分, B 加分
 * - timeout: 回答超时（>15s）→ 该 Expert 扣可靠性分
 */

import { create } from 'zustand'

interface ExpertScore {
  agentRole: string
  score: number
  confidence: number
  totalInteractions: number
}

interface CloudExpertRanking {
  score: number
  confidence: number
  sample_count: number
}

interface LocalFeedbackState {
  /** 每个方案下各 Expert 的得分 */
  scores: Record<string, ExpertScore[]>
  loaded: boolean
  /** 上次同步时间戳 */
  lastSyncTs: string | null
  /** 同步状态 */
  syncInProgress: boolean

  /** 记录正面反馈 */
  recordPositive: (solutionId: string, agentRole: string, queryText?: string) => void
  /** 记录负面反馈 */
  recordNegative: (solutionId: string, agentRole: string, queryText?: string) => void
  /** 记录用户手动切换（从 A 切到 B） */
  recordSwitch: (solutionId: string, fromAgent: string, toAgent: string, queryText?: string) => void
  /** 记录超时 */
  recordTimeout: (solutionId: string, agentRole: string, responseTimeMs: number) => void
  /** 从历史数据计算 ELO 分数 */
  computeScores: (solutionId: string) => Promise<void>
  /** 获取本地推荐的 Expert 排序 */
  getLocalRanking: (solutionId: string) => ExpertScore[]
  /** 获取指定 Expert 的本地加权因子 (0.5-1.5) */
  getBoostFactor: (solutionId: string, agentRole: string) => number
  /** 加载 */
  loadScores: () => Promise<void>
  /** Phase 10 闭环: 将本地反馈上报到服务端 HOPE 学习系统 */
  syncToServer: (solutionId: string) => Promise<{ synced: number; error?: string }>
  /** Phase 10.4: 应用云端 Expert 排名（作为本地分数的基线） */
  applyCloudRankings: (solutionId: string, rankings: Record<string, CloudExpertRanking>) => void
}

const BASE_SCORE = 1000
const K_FACTOR = 32
const SYNC_API_URL = 'https://mbe.hi-maker.com/admin/bitter-lesson/desktop-feedback-sync'
const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 分钟
let syncTimer: ReturnType<typeof setInterval> | null = null

function api() {
  return (window as any).electronAPI
}

export const useLocalFeedbackStore = create<LocalFeedbackState>((set, get) => ({
  scores: {},
  loaded: false,
  lastSyncTs: null,
  syncInProgress: false,

  recordPositive: (solutionId, agentRole, queryText) => {
    try {
      api()?.db?.feedback?.add({
        solutionId, agentRole, feedbackType: 'positive', queryText,
      })
      updateLocalScore(get, set, solutionId, agentRole, K_FACTOR * 0.5)
    } catch { /* 非 Electron */ }
  },

  recordNegative: (solutionId, agentRole, queryText) => {
    try {
      api()?.db?.feedback?.add({
        solutionId, agentRole, feedbackType: 'negative', queryText,
      })
      updateLocalScore(get, set, solutionId, agentRole, -K_FACTOR * 0.3)
    } catch { /* 非 Electron */ }
  },

  recordSwitch: (solutionId, fromAgent, toAgent, queryText) => {
    try {
      api()?.db?.feedback?.add({
        solutionId, agentRole: toAgent, feedbackType: 'switch',
        fromAgent, toAgent, queryText,
      })
      updateLocalScore(get, set, solutionId, fromAgent, -K_FACTOR * 0.2)
      updateLocalScore(get, set, solutionId, toAgent, K_FACTOR * 0.3)
    } catch { /* 非 Electron */ }
  },

  recordTimeout: (solutionId, agentRole, responseTimeMs) => {
    try {
      api()?.db?.feedback?.add({
        solutionId, agentRole, feedbackType: 'timeout', responseTimeMs,
      })
      updateLocalScore(get, set, solutionId, agentRole, -K_FACTOR * 0.15)
    } catch { /* 非 Electron */ }
  },

  computeScores: async (solutionId) => {
    try {
      const stats = await api()?.db?.feedback?.stats(solutionId)
      if (!stats?.perAgent) return

      const computed: ExpertScore[] = stats.perAgent.map((a: any) => {
        const winRate = a.total > 0 ? a.positive / a.total : 0.5
        const score = BASE_SCORE + (winRate - 0.5) * K_FACTOR * Math.min(a.total, 100)
        const confidence = Math.min(a.total / 20, 1.0)
        return {
          agentRole: a.agent_role,
          score: Math.round(score),
          confidence,
          totalInteractions: a.total,
        }
      })

      computed.sort((a, b) => b.score - a.score)
      set(s => ({ scores: { ...s.scores, [solutionId]: computed } }))
    } catch { /* 数据不足 */ }
  },

  getLocalRanking: (solutionId) => {
    return get().scores[solutionId] ?? []
  },

  getBoostFactor: (solutionId, agentRole) => {
    const scores = get().scores[solutionId]
    if (!scores?.length) return 1.0
    const expert = scores.find(s => s.agentRole === agentRole)
    if (!expert || expert.confidence < 0.3) return 1.0
    // 将 ELO [800, 1200] 映射到 [0.7, 1.3]
    const normalized = Math.max(800, Math.min(1200, expert.score))
    return 0.7 + (normalized - 800) / (1200 - 800) * 0.6
  },

  loadScores: async () => {
    try {
      const raw = await api()?.session?.get('localFeedbackScores')
      const lastSync = await api()?.session?.get('feedbackLastSyncTs')
      if (raw) {
        set({ scores: raw, loaded: true, lastSyncTs: lastSync || null })
      } else {
        set({ loaded: true, lastSyncTs: lastSync || null })
      }
    } catch {
      set({ loaded: true })
    }
  },

  syncToServer: async (solutionId) => {
    if (get().syncInProgress) return { synced: 0, error: 'sync_in_progress' }
    set({ syncInProgress: true })

    try {
      const sinceTs = get().lastSyncTs || undefined
      const rows = await api()?.db?.feedback?.export(solutionId, sinceTs)
      if (!rows?.length) {
        set({ syncInProgress: false })
        return { synced: 0 }
      }

      const payload = {
        solution_id: solutionId,
        device_id: await getDeviceId(),
        feedbacks: rows.map((r: any) => ({
          agent_role: r.agent_role,
          feedback_type: r.feedback_type,
          query_text: r.query_text,
          from_agent: r.from_agent,
          to_agent: r.to_agent,
          response_time_ms: r.response_time_ms,
          created_at: r.created_at,
        })),
      }

      const resp = await fetch(SYNC_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (resp.ok) {
        const ids = rows.map((r: any) => r.id)
        await api()?.db?.feedback?.markSynced(ids)

        const now = new Date().toISOString()
        set({ lastSyncTs: now, syncInProgress: false })
        await api()?.session?.set('feedbackLastSyncTs', now)

        return { synced: rows.length }
      }

      set({ syncInProgress: false })
      return { synced: 0, error: `HTTP ${resp.status}` }
    } catch (e: any) {
      set({ syncInProgress: false })
      return { synced: 0, error: e?.message || 'network_error' }
    }
  },

  applyCloudRankings: (solutionId, rankings) => {
    set(s => {
      const local = s.scores[solutionId] ?? []
      const merged: ExpertScore[] = []
      const seen = new Set<string>()

      // 本地分数优先（有足够交互数据时）
      for (const ls of local) {
        seen.add(ls.agentRole)
        const cloud = rankings[ls.agentRole]
        if (!cloud || ls.totalInteractions >= 10) {
          merged.push(ls)
        } else {
          // 混合：云端基线 × 0.6 + 本地 × 0.4
          merged.push({
            ...ls,
            score: Math.round(cloud.score * 0.6 + ls.score * 0.4),
            confidence: Math.max(ls.confidence, cloud.confidence * 0.5),
          })
        }
      }

      // 补充云端有但本地没有的 Expert
      for (const [eid, cr] of Object.entries(rankings)) {
        if (!seen.has(eid)) {
          merged.push({
            agentRole: eid,
            score: cr.score,
            confidence: cr.confidence * 0.5,
            totalInteractions: 0,
          })
        }
      }

      merged.sort((a, b) => b.score - a.score)
      return { scores: { ...s.scores, [solutionId]: merged } }
    })

    try {
      api()?.session?.set('localFeedbackScores', get().scores)
    } catch { /* 非 Electron */ }
  },
}))

async function getDeviceId(): Promise<string> {
  try {
    let deviceId = await api()?.session?.get('mbeDeviceId')
    if (!deviceId) {
      deviceId = `desktop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      await api()?.session?.set('mbeDeviceId', deviceId)
    }
    return deviceId
  } catch {
    return 'unknown'
  }
}

/** 启动定时同步（在 Workspace 初始化时调用） */
export function startFeedbackSync(solutionId: string): () => void {
  if (syncTimer) clearInterval(syncTimer)

  const doSync = () => {
    useLocalFeedbackStore.getState().syncToServer(solutionId).catch(() => {})
  }

  // 首次延迟 30 秒后执行
  const initialTimeout = setTimeout(doSync, 30_000)
  syncTimer = setInterval(doSync, SYNC_INTERVAL_MS)

  return () => {
    clearTimeout(initialTimeout)
    if (syncTimer) {
      clearInterval(syncTimer)
      syncTimer = null
    }
  }
}

function updateLocalScore(
  get: () => LocalFeedbackState,
  set: (fn: (s: LocalFeedbackState) => Partial<LocalFeedbackState>) => void,
  solutionId: string,
  agentRole: string,
  delta: number,
) {
  set(s => {
    const current = s.scores[solutionId] ?? []
    const idx = current.findIndex(e => e.agentRole === agentRole)

    if (idx >= 0) {
      const updated = [...current]
      updated[idx] = {
        ...updated[idx],
        score: Math.round(updated[idx].score + delta),
        totalInteractions: updated[idx].totalInteractions + 1,
        confidence: Math.min((updated[idx].totalInteractions + 1) / 20, 1.0),
      }
      return { scores: { ...s.scores, [solutionId]: updated } }
    }

    return {
      scores: {
        ...s.scores,
        [solutionId]: [...current, {
          agentRole,
          score: Math.round(BASE_SCORE + delta),
          confidence: 0.05,
          totalInteractions: 1,
        }],
      },
    }
  })

  // 异步持久化到 session
  try {
    api()?.session?.set('localFeedbackScores', get().scores)
  } catch { /* 非 Electron */ }
}
