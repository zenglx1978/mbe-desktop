/**
 * KB Graph Data — 知识图谱数据模型与扫描器
 *
 * 两种数据来源：
 *   1. 静态注册表（AGENT_KB_REGISTRY）— 离线可用，编译时确定
 *   2. 动态 API（/api/{agent}/kb/graph）— 运行时获取实际文件统计
 *
 * 节点类型：agent / knowledge / rule / solution
 * 边类型：owns（agent→file）/ references（rule→knowledge）/ belongs（solution→knowledge）
 */

// ── 图数据类型 ──

export type KGNodeType = 'agent' | 'knowledge' | 'rule' | 'solution'

export interface KGNode {
  id: string
  label: string
  type: KGNodeType
  agentId: string
  /** 被引用次数（用于节点大小） */
  refCount: number
  /** 文件大小（kb），可选 */
  sizeKb?: number
  /** 最后修改时间 ISO，可选（用于新鲜度/dithering） */
  lastModified?: string
  /** 分类标签 */
  category?: string
  /** 触发词（仅 rule） */
  triggers?: string[]
  // 力导向布局计算用
  x: number
  y: number
  vx: number
  vy: number
}

export type KGEdgeType = 'owns' | 'references' | 'belongs'

export interface KGEdge {
  source: string
  target: string
  type: KGEdgeType
}

export interface KGGraphData {
  nodes: KGNode[]
  edges: KGEdge[]
}

// ── 静态注册表 ──

interface AgentKBInfo {
  id: string
  name: string
  color: string
  mdCount: number
  ruleCount: number
  solutionCount: number
  categories: string[]
  /** 规则→知识映射（来自 rules/INDEX.json 的 knowledge_files） */
  ruleKnowledgeLinks: { rule: string; knowledgeFiles: string[] }[]
}

const AGENT_KB_REGISTRY: AgentKBInfo[] = [
  {
    id: 'finance', name: '财务', color: '#3b82f6',
    mdCount: 103, ruleCount: 19, solutionCount: 2,
    categories: ['增值税', '企业所得税', '个税', '会计准则', '审计', '税务筹划', '社保', '发票'],
    ruleKnowledgeLinks: [
      { rule: 'finance_tax_rates', knowledgeFiles: ['01_vat_rules', '02_corporate_income_tax', '04_iit_rules', '09_tax_planning_part1'] },
      { rule: 'finance_deduction_limits', knowledgeFiles: ['02_corporate_income_tax', '09_tax_planning_part1', '10_tax_planning_part2'] },
      { rule: 'finance_social_insurance', knowledgeFiles: ['06_social_insurance', '07_housing_fund'] },
      { rule: 'finance_voucher_workflow', knowledgeFiles: ['11_accounting_standards', '12_financial_statements'] },
      { rule: 'finance_financial_ratios', knowledgeFiles: ['12_financial_statements', '13_financial_analysis'] },
    ],
  },
  {
    id: 'legal', name: '法律', color: '#8b5cf6',
    mdCount: 79, ruleCount: 12, solutionCount: 2,
    categories: ['合同', '劳动', '侵权', '婚姻', '交通', '刑事', '行政', '诉讼程序'],
    ruleKnowledgeLinks: [
      { rule: 'legal_litigation_fee', knowledgeFiles: ['05_litigation_procedures', '31_litigation_practice'] },
      { rule: 'legal_labor_calc', knowledgeFiles: ['03_labor_law', '42_labor_nonlitigation'] },
      { rule: 'legal_compensation', knowledgeFiles: ['03_labor_law', '04_tort_liability'] },
      { rule: 'legal_statute_of_limitations', knowledgeFiles: ['01_civil_code_general', '05_litigation_procedures'] },
    ],
  },
  {
    id: 'cost', name: '造价', color: '#f59e0b',
    mdCount: 15, ruleCount: 7, solutionCount: 1,
    categories: ['定额', '取费', '清单', '材料调差', '变更签证'],
    ruleKnowledgeLinks: [
      { rule: 'cost_fee_rates', knowledgeFiles: ['01_gb50500', '02_quota_rules'] },
      { rule: 'cost_tax_calc', knowledgeFiles: ['03_construction_tax', '01_gb50500'] },
    ],
  },
  {
    id: 'pulmonary', name: '肺科', color: '#06b6d4',
    mdCount: 12, ruleCount: 7, solutionCount: 1,
    categories: ['COPD', '哮喘', '肺炎', '肺功能', '呼吸机', '药物'],
    ruleKnowledgeLinks: [
      { rule: 'pulmonary_scoring', knowledgeFiles: ['01_copd_guidelines', '02_asthma_guidelines'] },
      { rule: 'pulmonary_drug_dosing', knowledgeFiles: ['05_pharmacology', '06_drug_interactions'] },
    ],
  },
  {
    id: 'cs', name: '客服', color: '#ec4899',
    mdCount: 32, ruleCount: 10, solutionCount: 2,
    categories: ['工单', 'SLA', '质检', 'AI分类', '投诉', '话术'],
    ruleKnowledgeLinks: [
      { rule: 'cs_sla_standards', knowledgeFiles: ['01_sla_design', '02_ticket_workflow'] },
      { rule: 'cs_quality_scoring', knowledgeFiles: ['03_quality_management', '04_ai_classification'] },
    ],
  },
  {
    id: 'hr', name: '人力', color: '#10b981',
    mdCount: 10, ruleCount: 6, solutionCount: 0,
    categories: ['招聘', '绩效', '薪酬', '劳动法', '培训'],
    ruleKnowledgeLinks: [
      { rule: 'hr_compensation_rules', knowledgeFiles: ['01_labor_law_basics', '03_compensation'] },
    ],
  },
  {
    id: 'invest', name: '投资', color: '#ef4444',
    mdCount: 32, ruleCount: 12, solutionCount: 1,
    categories: ['宏观', '行业', '个股', '估值', '风控', 'AI产业链'],
    ruleKnowledgeLinks: [
      { rule: 'invest_mises_factors', knowledgeFiles: ['01_mises_framework', '02_valuation'] },
      { rule: 'invest_risk_control', knowledgeFiles: ['03_risk_management', '04_portfolio'] },
      { rule: 'invest_signal_fusion', knowledgeFiles: ['05_quant_signals', '01_mises_framework'] },
    ],
  },
  {
    id: 'sales', name: '销售', color: '#f97316',
    mdCount: 8, ruleCount: 7, solutionCount: 1,
    categories: ['线索', 'Pipeline', '报价', '异议处理', 'CRM'],
    ruleKnowledgeLinks: [
      { rule: 'sales_lead_scoring', knowledgeFiles: ['01_qualification', '02_pipeline'] },
    ],
  },
  {
    id: 'growth', name: '增长', color: '#a855f7',
    mdCount: 11, ruleCount: 10, solutionCount: 1,
    categories: ['激活', '留存', 'A/B测试', '内容', '渠道', 'ROI'],
    ruleKnowledgeLinks: [
      { rule: 'growth_activation_triggers', knowledgeFiles: ['01_activation', '02_retention'] },
      { rule: 'growth_campaign_rules', knowledgeFiles: ['03_campaigns', '04_channels'] },
    ],
  },
  {
    id: 'education', name: '教育', color: '#14b8a6',
    mdCount: 36, ruleCount: 14, solutionCount: 2,
    categories: ['留学', 'K12', '考试', '备考', '职业资格', '培训'],
    ruleKnowledgeLinks: [
      { rule: 'edu_exam_score_conversion', knowledgeFiles: ['01_ielts', '02_toefl'] },
      { rule: 'edu_cert_requirements', knowledgeFiles: ['05_certifications', '06_med_education'] },
    ],
  },
  {
    id: 'insurance_cs', name: '保险', color: '#0ea5e9',
    mdCount: 10, ruleCount: 6, solutionCount: 1,
    categories: ['理赔', '核赔', '合规', '续保', '车险'],
    ruleKnowledgeLinks: [
      { rule: 'claims_workflow', knowledgeFiles: ['01_claims_process', '02_assessment'] },
      { rule: 'compliance_rules', knowledgeFiles: ['03_regulatory', '04_anti_fraud'] },
    ],
  },
]

// ── 图数据构建 ──

export function buildGraphFromRegistry(): KGGraphData {
  const nodes: KGNode[] = []
  const edges: KGEdge[] = []
  const refCountMap = new Map<string, number>()

  for (const agent of AGENT_KB_REGISTRY) {
    // Agent 节点
    nodes.push({
      id: `agent:${agent.id}`,
      label: agent.name,
      type: 'agent',
      agentId: agent.id,
      refCount: agent.mdCount + agent.ruleCount,
      x: 0, y: 0, vx: 0, vy: 0,
    })

    // 知识文件节点（简化为 category 级别，避免 500+ 节点太密）
    for (const cat of agent.categories) {
      const nodeId = `knowledge:${agent.id}:${cat}`
      nodes.push({
        id: nodeId,
        label: cat,
        type: 'knowledge',
        agentId: agent.id,
        refCount: 0,
        category: cat,
        x: 0, y: 0, vx: 0, vy: 0,
      })
      edges.push({ source: `agent:${agent.id}`, target: nodeId, type: 'owns' })
    }

    // 规则节点 + 规则→知识边
    for (const link of agent.ruleKnowledgeLinks) {
      const ruleNodeId = `rule:${agent.id}:${link.rule}`
      nodes.push({
        id: ruleNodeId,
        label: link.rule.replace(`${agent.id}_`, '').replace(/_/g, ' '),
        type: 'rule',
        agentId: agent.id,
        refCount: link.knowledgeFiles.length,
        x: 0, y: 0, vx: 0, vy: 0,
      })
      edges.push({ source: `agent:${agent.id}`, target: ruleNodeId, type: 'owns' })

      // 规则→知识类别映射（模糊匹配文件名到分类）
      for (const kf of link.knowledgeFiles) {
        const bestCat = findBestCategory(kf, agent.categories)
        if (bestCat) {
          const targetId = `knowledge:${agent.id}:${bestCat}`
          edges.push({ source: ruleNodeId, target: targetId, type: 'references' })
          refCountMap.set(targetId, (refCountMap.get(targetId) ?? 0) + 1)
        }
      }
    }

    // 解决方案节点
    if (agent.solutionCount > 0) {
      const solId = `solution:${agent.id}`
      nodes.push({
        id: solId,
        label: `${agent.name}方案`,
        type: 'solution',
        agentId: agent.id,
        refCount: agent.solutionCount,
        x: 0, y: 0, vx: 0, vy: 0,
      })
      edges.push({ source: `agent:${agent.id}`, target: solId, type: 'belongs' })
    }
  }

  // 回填引用计数
  for (const node of nodes) {
    node.refCount += refCountMap.get(node.id) ?? 0
  }

  return { nodes, edges }
}

function findBestCategory(filename: string, categories: string[]): string | null {
  const lower = filename.toLowerCase()
  const KEYWORD_MAP: Record<string, string[]> = {
    'vat': ['增值税'], 'tax': ['增值税', '企业所得税', '个税', '税务筹划'],
    'corporate': ['企业所得税'], 'iit': ['个税'], 'social_insurance': ['社保'],
    'accounting': ['会计准则'], 'financial': ['会计准则', '审计'], 'audit': ['审计'],
    'invoice': ['发票'], 'housing': ['社保'],
    'labor': ['劳动', '劳动法'], 'contract': ['合同'], 'tort': ['侵权'],
    'marriage': ['婚姻'], 'traffic': ['交通'], 'criminal': ['刑事'],
    'litigation': ['诉讼程序'], 'civil': ['合同'],
    'quota': ['定额'], 'fee': ['取费'], 'material': ['材料调差'],
    'change': ['变更签证'], 'gb50500': ['清单'],
    'copd': ['COPD'], 'asthma': ['哮喘'], 'pneumonia': ['肺炎'],
    'pft': ['肺功能'], 'ventilator': ['呼吸机'], 'drug': ['药物'], 'pharmacology': ['药物'],
    'sla': ['SLA'], 'ticket': ['工单'], 'quality': ['质检'], 'classification': ['AI分类'],
    'recruit': ['招聘'], 'performance': ['绩效'], 'compensation': ['薪酬'],
    'macro': ['宏观'], 'industry': ['行业'], 'stock': ['个股'],
    'valuation': ['估值'], 'risk': ['风控'], 'portfolio': ['风控'],
    'mises': ['估值'], 'quant': ['AI产业链'],
    'lead': ['线索'], 'pipeline': ['Pipeline'], 'pricing': ['报价'],
    'activation': ['激活'], 'retention': ['留存'], 'campaign': ['A/B测试'],
    'channel': ['渠道'], 'content': ['内容'],
    'ielts': ['留学'], 'toefl': ['留学'], 'cert': ['职业资格'],
    'k12': ['K12'], 'exam': ['考试'], 'med_education': ['培训'],
    'claims': ['理赔'], 'assessment': ['核赔'], 'regulatory': ['合规'],
    'fraud': ['合规'], 'renewal': ['续保'],
  }

  for (const [keyword, cats] of Object.entries(KEYWORD_MAP)) {
    if (lower.includes(keyword)) {
      const match = cats.find((c) => categories.includes(c))
      if (match) return match
    }
  }
  return categories[0] ?? null
}

/** 获取 Agent 注册表统计 */
export function getAgentKBStats() {
  return AGENT_KB_REGISTRY.map((a) => ({
    id: a.id,
    name: a.name,
    color: a.color,
    total: a.mdCount + a.ruleCount + a.solutionCount,
    mdCount: a.mdCount,
    ruleCount: a.ruleCount,
    solutionCount: a.solutionCount,
    categories: a.categories,
  }))
}

export { AGENT_KB_REGISTRY }
