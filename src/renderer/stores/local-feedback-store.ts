import { create } from 'zustand'

interface ExpertScore {
  agentRole: string
  score: number
  confidence: number
  totalInteractions: number
}

interface LocalFeedbackState {
  scores: Record<string, ExpertScore[]>
  loadScores: () => void
  computeScores: (solutionId: string) => void
  recordSwitch: (solutionId: string, fromAgent: string, toAgent: string, queryText?: string) => void
  recordTimeout: (solutionId: string, agentRole: string, responseTimeMs: number) => void
  recordPositive: (solutionId: string, agentRole: string, queryText?: string) => void
  recordNegative: (solutionId: string, agentRole: string, queryText?: string) => void
  getLocalRanking: (solutionId: string) => ExpertScore[]
  getBoostFactor: (solutionId: string, agentRole: string) => number
  applyCloudRankings: (solutionId: string, rankings: Record<string, { score: number; confidence: number; sample_count: number }>) => void
}

function getApi() {
  return (window as any).electronAPI
}

async function recordFeedback(
  solutionId: string,
  feedbackType: 'positive' | 'negative' | 'switch' | 'timeout',
  agentRole: string,
  extra: Record<string, string | number | undefined> = {}
) {
  try {
    const api = getApi()
    if (api?.db?.feedback?.add) {
      await api.db.feedback.add({
        solutionId,
        agentRole,
        feedbackType,
        queryText: extra.queryText as string | undefined,
        fromAgent: extra.fromAgent as string | undefined,
        toAgent: extra.toAgent as string | undefined,
        responseTimeMs: extra.responseTimeMs as number | undefined,
      })
    }
  } catch {
    // 反馈记录失败不阻塞 UI
  }
}

export const useLocalFeedbackStore = create<LocalFeedbackState>((set, get) => ({
  scores: {},

  loadScores: () => {},

  computeScores: async (solutionId) => {
    try {
      const api = getApi()
      if (!api?.db?.feedback?.stats) return

      const stats = await api.db.feedback.stats(solutionId)
      if (!stats || !Array.isArray(stats)) return

      const scoreMap: Record<string, { pos: number; neg: number; switches: number; total: number }> = {}

      for (const entry of stats) {
        const role = entry.agent_role
        if (!role) continue
        if (!scoreMap[role]) scoreMap[role] = { pos: 0, neg: 0, switches: 0, total: 0 }
        scoreMap[role].total += entry.count || 0
        if (entry.feedback_type === 'positive') scoreMap[role].pos += entry.count || 0
        if (entry.feedback_type === 'negative') scoreMap[role].neg += entry.count || 0
        if (entry.feedback_type === 'switch') scoreMap[role].switches += entry.count || 0
      }

      const result: ExpertScore[] = Object.entries(scoreMap).map(([role, data]) => ({
        agentRole: role,
        score: data.total > 0 ? (data.pos - data.neg * 2 - data.switches * 0.5) / data.total : 0,
        confidence: Math.min(data.total / 20, 1),
        totalInteractions: data.total,
      })).sort((a, b) => b.score - a.score)

      set((s) => ({ scores: { ...s.scores, [solutionId]: result } }))
    } catch {
      // ignore
    }
  },

  recordSwitch: (solutionId, fromAgent, toAgent, queryText) => {
    recordFeedback(solutionId, 'switch', fromAgent, { fromAgent, toAgent: toAgent, queryText })
  },

  recordTimeout: (solutionId, agentRole, responseTimeMs) => {
    recordFeedback(solutionId, 'timeout', agentRole, { responseTimeMs })
  },

  recordPositive: (solutionId, agentRole, queryText) => {
    recordFeedback(solutionId, 'positive', agentRole, { queryText })
  },

  recordNegative: (solutionId, agentRole, queryText) => {
    recordFeedback(solutionId, 'negative', agentRole, { queryText })
  },

  getLocalRanking: (solutionId) => get().scores[solutionId] || [],

  getBoostFactor: (solutionId, agentRole) => {
    const rankings = get().scores[solutionId] || []
    const entry = rankings.find((r) => r.agentRole === agentRole)
    if (!entry || entry.confidence < 0.3) return 1
    return 1 + entry.score * 0.3
  },

  applyCloudRankings: (solutionId, rankings) => {
    const result: ExpertScore[] = Object.entries(rankings).map(([role, data]) => ({
      agentRole: role,
      score: data.score,
      confidence: data.confidence,
      totalInteractions: data.sample_count,
    })).sort((a, b) => b.score - a.score)
    set((s) => ({ scores: { ...s.scores, [solutionId]: result } }))
  },
}))

let syncInterval: ReturnType<typeof setInterval> | null = null

export function startFeedbackSync(solutionId: string): () => void {
  if (syncInterval) clearInterval(syncInterval)

  syncInterval = setInterval(() => {
    useLocalFeedbackStore.getState().computeScores(solutionId)
  }, 5 * 60 * 1000)

  return () => {
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null }
  }
}
