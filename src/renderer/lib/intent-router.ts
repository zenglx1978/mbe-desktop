/**
 * Intent Router — 根据用户消息自动匹配最合适的 AI 专家
 *
 * 纯前端关键词匹配，无需网络请求，离线可用。
 * 每个 Agent 后端有各自的 expert 细分路由，这里只负责选对 Agent。
 *
 * 路由策略：
 * 1. 对用户消息做关键词评分，每个 agent 独立打分
 * 2. 得分最高的 agent 作为路由目标
 * 3. 如果最高分 ≤ 0（无任何命中），保持用户当前选择
 * 4. 多个 agent 得分接近时，可提示用户确认（暂用最高分）
 */

import type { AgentEndpoint, SolutionConfig } from './solution-router'
import { useLocalFeedbackStore } from '@/stores/local-feedback-store'

interface AgentKeywords {
  /** agent.id — 如 legal, finance, cost */
  agentId: string
  /** 强匹配关键词（+3 分） */
  strong: string[]
  /** 弱匹配关键词（+1 分） */
  weak: string[]
}

const KEYWORD_RULES: AgentKeywords[] = [
  {
    agentId: 'legal',
    strong: [
      '合同', '诉讼', '法律', '法规', '判决', '赔偿', '纠纷', '侵权', '民法', '刑法',
      '劳动法', '仲裁', '起诉', '律师', '法院', '合规', '违约', '证据', '补偿金',
      'N+1', '2N', '经济补偿', '索赔', '诉讼费', '法务', '签证', '变更签证',
      '工伤', '辞退', '解聘', '劳动合同', '竞业', '保密协议', '知识产权', '专利',
      '消费者权益', '消保', '退保', '理赔纠纷', '保险法',
    ],
    weak: [
      '风险', '审查', '条款', '权利', '义务', '责任', '期限', '时效', '争议',
      '协议', '违法', '维权', '举证', '管辖', '判例',
    ],
  },
  {
    agentId: 'finance',
    strong: [
      '发票', '记账', '报税', '纳税', '增值税', '个税', '所得税', '税率', '税务',
      '凭证', '分录', '会计', '财务', '审计', '报表', '资产', '负债', '折旧',
      '利润', '现金流', '成本', '预算', '开票', '进项', '销项', '抵扣', '免税',
      '小规模', '一般纳税人', '税负', '税收优惠', '退税', '筹划',
      '工资', '社保', '公积金', '薪酬', '个税专项', '年终奖', '佣金', '结算',
    ],
    weak: [
      '收入', '支出', '账', '款', '费用', '核算', '申报', '缴纳', '计算',
      '对账', '冲销', '挂账', '坏账',
    ],
  },
  {
    agentId: 'cost',
    strong: [
      '定额', '清单', '造价', '工程量', '概预算', '招标', '投标', '结算',
      '取费', '施工', '建筑', '市政', '安装', '装修', '材料价',
      '综合单价', '直接费', '间接费', '管理费', '规费', '信息价',
      '钢筋', '混凝土', '土方', '管道', '轨道交通',
    ],
    weak: [
      '工程', '建设', '图纸', '面积', '平米', '平方', '层', '楼',
    ],
  },
  {
    agentId: 'pulmonary',
    strong: [
      'COPD', 'FEV1', 'FVC', '肺功能', 'CURB-65', 'CAT', 'mMRC', 'GOLD',
      '呼吸机', 'PEEP', '潮气量', 'SOFA', 'Light', '胸腔积液',
      '哮喘', '肺炎', '支气管', '吸氧', '通气', '弥散', '血气',
      '肺栓塞', 'Wells', 'BODE', '肺功能报告',
    ],
    weak: [
      '呼吸', '咳嗽', '气促', '胸闷', '痰', '感染', '抗生素', '吸入',
    ],
  },
  {
    agentId: 'hr',
    strong: [
      '招聘', '面试', '绩效', 'KPI', 'OKR', '入职', '离职', '考勤',
      '排班', '调岗', '培训', '员工关系', '人力', '薪酬体系', '编制',
    ],
    weak: [
      '员工', '岗位', '部门', '人事', '考核',
    ],
  },
  {
    agentId: 'sales',
    strong: [
      '客户画像', '线索', '商机', '成交', '报价', '谈判', 'Pipeline',
      '跟进', '客户分析', 'CRM', '销售预测', '竞品', 'BD', '渠道',
      '团险', '大客户',
    ],
    weak: [
      '客户', '销售', '签约', '续费', '转化',
    ],
  },
  {
    agentId: 'cs',
    strong: [
      '工单', '投诉', 'SLA', 'FAQ', '满意度', 'CSAT', 'NPS', '客服',
      '话术', '知识库问答', '多品牌', 'BPO',
    ],
    weak: [
      '咨询', '服务', '回复', '响应',
    ],
  },
  {
    agentId: 'education',
    strong: [
      '留学', '雅思', '托福', 'GRE', 'GMAT', '选校', '申请', '备考',
      '课程', '学情', '成绩', '学费', '退费', '排课', '继续教育',
    ],
    weak: [
      '学习', '考试', '辅导', '学生', '教学',
    ],
  },
  {
    agentId: 'invest',
    strong: [
      '估值', '选股', '研报', 'MISES', '行业研究', '多空', '仓位',
      '宏观', '产业链', 'DCF', 'PE', 'PB', '市盈率', '股票',
    ],
    weak: [
      '投资', '基金', '上市', '市场', '收益',
    ],
  },
  {
    agentId: 'insurance_cs',
    strong: [
      '理赔', '报案', '定损', '核赔', '速赔', '保单', '退保',
      '保费', '投保', '承保', '车险', '交强险', '商业险',
    ],
    weak: [
      '保险', '续保', '保障',
    ],
  },
  {
    agentId: 'growth',
    strong: [
      '裂变', '留存', 'DAU', 'MAU', 'LTV', 'CAC', 'ROI', 'A/B测试',
      '漏斗', '激活', '拉新', '复购', '转介', '内容营销', 'SEO',
      '私域', '社群', '小红书', '抖音', '短视频',
    ],
    weak: [
      '运营', '推广', '流量', '用户', '营销', '增长',
    ],
  },
]

/** 路由结果 */
export interface RouteResult {
  /** 最匹配的专家（在 solution.agents 中的索引） */
  agentIndex: number
  /** 匹配的 agent endpoint */
  agent: AgentEndpoint
  /** 最高得分 */
  score: number
  /** 是否为自动路由（true）还是保持用户选择（false） */
  autoRouted: boolean
  /** 各 agent 的得分明细（调试用） */
  scores: { agentId: string; role: string; score: number }[]
}

/**
 * 根据用户消息内容，在当前方案的专家列表中选择最匹配的专家
 */
export function routeMessage(
  text: string,
  solution: SolutionConfig,
  currentIndex: number,
): RouteResult {
  const agents = solution.agents
  const scores: { agentId: string; role: string; score: number }[] = []
  const feedbackStore = useLocalFeedbackStore.getState()

  for (const ag of agents) {
    const rules = KEYWORD_RULES.find(r => r.agentId === ag.id)
    if (!rules) {
      scores.push({ agentId: ag.id, role: ag.role, score: 0 })
      continue
    }

    let score = 0
    const lower = text.toLowerCase()

    for (const kw of rules.strong) {
      if (lower.includes(kw.toLowerCase())) {
        score += 3
      }
    }
    for (const kw of rules.weak) {
      if (lower.includes(kw.toLowerCase())) {
        score += 1
      }
    }

    // Bitter Lesson: 本地反馈加权（从用户行为数据学习路由偏好）
    if (score > 0) {
      const boost = feedbackStore.getBoostFactor(solution.id, ag.role)
      score = Math.round(score * boost)
    }

    scores.push({ agentId: ag.id, role: ag.role, score })
  }

  const maxScore = Math.max(...scores.map(s => s.score))

  if (maxScore <= 0) {
    return {
      agentIndex: currentIndex,
      agent: agents[currentIndex],
      score: 0,
      autoRouted: false,
      scores,
    }
  }

  const bestIdx = scores.findIndex(s => s.score === maxScore)
  const currentScore = scores[currentIndex]?.score ?? 0

  // 当前专家得分与最高分差距不大（≤2），不强制切换，避免频繁跳转
  if (currentScore > 0 && maxScore - currentScore <= 2) {
    return {
      agentIndex: currentIndex,
      agent: agents[currentIndex],
      score: currentScore,
      autoRouted: false,
      scores,
    }
  }

  return {
    agentIndex: bestIdx,
    agent: agents[bestIdx],
    score: maxScore,
    autoRouted: true,
    scores,
  }
}
