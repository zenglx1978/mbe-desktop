/**
 * 自动拆分自 solution-registry-data.ts。
 * 请勿手工编辑“结构”——如需改方案内容，请直接改本文件字段即可。
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const logisticsSupplyChainSolution: SolutionConfig = {
  id: 'logistics-supply-chain',
  name: '物流与供应链管理方案',
  icon: '🚛',
  color: '#0f766e',
  tagline: '物流成本降 15%，供应链可视化实时追踪',
  description: '运输合同管理 + 物流成本核算 + 供应链合规 + 索赔处理全链路。',
  entrepreneurPurpose: '降低物流成本、提升供应链可视性、减少货损纠纷',
  profitMetrics: ['运输成本降低 15%', '合同审查自动化', '货损索赔处理 3 天→3 小时'],
  agents: [
    agent('legal', 8003, '物流法务专家', '运输合同、货损索赔、国际贸易法'),
    agent('finance', 8002, '物流财务专家', '运费核算、关税计算、成本分析'),
    agent('cs', 8004, '物流客服专家', '货物追踪、异常处理、客户沟通'),
  ],
  localScripts: ['calc_iit', 'calc_vat', 'calc_litigation_fee'],
  knowledgeCache: [],
  theme: { primary: '173 80% 26%', accent: '173 80% 26%' },
  enabledTabs: ['chat', 'tools', 'workflows', 'dashboard', 'knowledge-graph'],
  tools: [],
  slashCommands: [],
  workflows: [],
  scenarios: [
    { id: 'damage_claim', label: '货损索赔', icon: '📦', prompt: '货物运输中损坏，如何索赔', expectedOutcome: '索赔流程 + 赔偿金额计算 + 法律依据', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '快速索赔挽回货损 5-30 万' } },
  ],
}

export default logisticsSupplyChainSolution
