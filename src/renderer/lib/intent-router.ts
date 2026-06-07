/**
 * 意图路由 — 根据用户消息内容自动匹配最合适的 Agent 专家
 *
 * Phase 7 增强：加权关键词 + 领域互斥 + 离线意图分类复用
 */
import type { SolutionConfig, AgentEndpoint } from '@/lib/solution-router'

export interface RouteResult {
  agent: AgentEndpoint
  agentIndex: number
  autoRouted: boolean
  confidence: number
  /** Phase 7: 匹配到的关键词（用于 UI 展示） */
  matchedKeywords?: string[]
}

/**
 * 加权关键词表
 * 权重说明：3 = 强领域指示词, 2 = 中等, 1 = 弱/跨领域
 */
const AGENT_WEIGHTED_KEYWORDS: Record<string, [string, number][]> = {
  invest: [
    ['股票', 3], ['行情', 2], ['行业分析', 3], ['板块', 2.5], ['估值', 3],
    ['MISES', 2], ['四柱', 2], ['宏观', 2], ['热点', 1.5], ['产业链', 2.5],
    ['选股', 3], ['研报', 2.5], ['WorldMonitor', 2], ['持仓', 2.5], ['PE', 2],
    ['PB', 2], ['市盈率', 2.5], ['止损', 2.5], ['止盈', 2],
  ],
  finance: [
    ['财务', 2], ['财报', 2.5], ['利润', 1.5], ['营收', 1.5], ['税', 2],
    ['会计', 2.5], ['资产', 1.5], ['负债', 1.5], ['现金流', 2], ['杜邦', 2],
    ['ROE', 2], ['毛利', 2], ['审计', 2.5], ['个税', 3], ['VAT', 3],
    ['企业所得税', 3], ['发票', 2.5], ['记账', 2.5], ['分录', 2.5],
    ['纳税', 2.5], ['折旧', 2], ['社保', 1.5], ['五险一金', 2],
  ],
  legal: [
    ['合同', 2], ['诉讼', 3], ['法律', 2], ['法规', 2], ['起诉', 3],
    ['律师', 2], ['仲裁', 2.5], ['赔偿', 2], ['违约', 2.5], ['侵权', 2.5],
    ['劳动法', 3], ['民法典', 3], ['经济补偿', 3], ['N+1', 3], ['2N', 3],
    ['诉讼费', 3], ['劳动仲裁', 3], ['辞退', 2.5], ['解雇', 2.5],
    ['离婚', 2], ['继承', 2], ['工伤', 2], ['交通事故', 2],
  ],
  cost: [
    ['造价', 3], ['定额', 3], ['取费', 3], ['工程量', 3], ['清单', 2],
    ['招投标', 2.5], ['建安', 2.5], ['单方造价', 3], ['综合单价', 3],
    ['预算', 2], ['结算', 2], ['措施费', 2.5], ['规费', 2.5],
  ],
  hr: [
    ['招聘', 2.5], ['绩效', 2.5], ['薪酬', 2.5], ['人力', 2], ['HR', 2.5],
    ['社保', 1.5], ['公积金', 1.5], ['KPI', 2.5], ['OKR', 2.5],
    ['入职', 2], ['离职', 2], ['试用期', 2.5], ['年假', 2.5], ['加班', 2],
  ],
  pulmonary: [
    ['COPD', 3], ['肺', 2], ['呼吸', 2], ['FEV1', 3], ['哮喘', 3],
    ['肺功能', 3], ['呼吸机', 3], ['PEEP', 3], ['SpO2', 2.5], ['血气', 2.5],
    ['CURB-65', 3], ['CAT', 2], ['mMRC', 3], ['BODE', 3], ['肺炎', 2.5],
  ],
  education: [
    ['留学', 3], ['雅思', 3], ['托福', 3], ['IELTS', 3], ['TOEFL', 3],
    ['高考', 2.5], ['考研', 2.5], ['课程', 1.5], ['教育', 1.5], ['GPA', 2.5],
  ],
  cs: [
    ['客服', 3], ['投诉', 2.5], ['SLA', 3], ['工单', 3], ['NPS', 2.5],
    ['满意度', 2], ['退款', 2], ['响应时间', 2],
  ],
  growth: [
    ['增长', 2], ['留存', 2.5], ['激活', 2], ['DAU', 3], ['MAU', 2.5],
    ['A/B', 2.5], ['ROI', 2], ['裂变', 3], ['营销', 2], ['LTV', 2.5],
    ['CAC', 2.5], ['转化率', 2.5], ['获客', 2.5],
  ],
  sales: [
    ['销售', 2], ['客户', 1.5], ['Pipeline', 3], ['报价', 2.5], ['成交', 2.5],
    ['大客户', 2.5], ['线索', 2.5], ['BANT', 3], ['MEDDIC', 3],
  ],
  insurance_cs: [
    ['保险', 3], ['理赔', 3], ['保单', 3], ['保费', 2.5], ['续保', 2.5],
    ['团险', 2.5], ['承保', 2.5], ['核保', 2.5],
  ],
}

/** 歧义消解：某些词同时出现在多个领域时的优先规则 */
const DISAMBIGUATION: { keywords: string[]; prefer: string; over: string[] }[] = [
  { keywords: ['劳动', '补偿', '辞退', '仲裁'], prefer: 'legal', over: ['hr'] },
  { keywords: ['社保', '公积金', '缴纳比例'], prefer: 'hr', over: ['finance'] },
  { keywords: ['利润', '营收', '税'], prefer: 'finance', over: ['invest'] },
]

export function routeMessage(
  text: string,
  solution: SolutionConfig,
  currentIndex: number,
): RouteResult {
  const defaultResult: RouteResult = {
    agent: solution.agents[currentIndex]!,
    agentIndex: currentIndex,
    autoRouted: false,
    confidence: 0.5,
  }

  if (!text || solution.agents.length <= 1) return defaultResult

  const scores: { idx: number; score: number; matched: string[] }[] = []

  for (let i = 0; i < solution.agents.length; i++) {
    const agentId = solution.agents[i]!.id
    const weightedKws = AGENT_WEIGHTED_KEYWORDS[agentId] || []
    let score = 0
    const matched: string[] = []

    for (const [kw, weight] of weightedKws) {
      if (text.includes(kw)) {
        score += weight
        matched.push(kw)
      }
    }

    if (score > 0) {
      scores.push({ idx: i, score, matched })
    }
  }

  if (scores.length === 0) return defaultResult

  // 歧义消解
  for (const rule of DISAMBIGUATION) {
    const ruleMatches = rule.keywords.filter(kw => text.includes(kw)).length
    if (ruleMatches >= 2) {
      const preferIdx = scores.find(s => solution.agents[s.idx]!.id === rule.prefer)
      if (preferIdx) {
        for (const overId of rule.over) {
          const overEntry = scores.find(s => solution.agents[s.idx]!.id === overId)
          if (overEntry) {
            overEntry.score *= 0.5
          }
        }
      }
    }
  }

  scores.sort((a, b) => b.score - a.score)
  const best = scores[0]!

  if (best.idx === currentIndex) return { ...defaultResult, matchedKeywords: best.matched }

  // 置信度：归一化到 0-1
  const maxWeight = AGENT_WEIGHTED_KEYWORDS[solution.agents[best.idx]!.id]?.reduce((s, [, w]) => s + w, 0) ?? 1
  const confidence = Math.min(best.score / (maxWeight * 0.12), 1.0)

  // 路由切换阈值：至少 0.3 置信度
  if (confidence < 0.3) return { ...defaultResult, matchedKeywords: best.matched }

  return {
    agent: solution.agents[best.idx]!,
    agentIndex: best.idx,
    autoRouted: true,
    confidence,
    matchedKeywords: best.matched,
  }
}
