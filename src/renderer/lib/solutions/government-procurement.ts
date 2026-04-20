/**
 * 自动拆分自 solution-registry-data.ts。
 * 请勿手工编辑“结构”——如需改方案内容，请直接改本文件字段即可。
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const governmentProcurementSolution: SolutionConfig = {
  id: 'government-procurement',
  name: '政府采购与招投标方案',
  icon: '🏛️',
  color: '#1e40af',
  tagline: '采购合规零失误，标书效率翻 5 倍',
  description: '政府采购审查 + 招标文件编制 + 投标报价分析 + 合规风控全链路。',
  entrepreneurPurpose: '提高中标率、消除合规风险、缩短投标周期',
  profitMetrics: ['标书编制 3 天→半天', '合规审查自动化', '中标率提升 20%'],
  agents: [
    agent('legal', 8003, '采购合规专家', '招投标法审查、合同条款、质疑投诉'),
    agent('cost', 8007, '造价审核专家', '工程量清单、控制价审核、投标报价分析'),
    agent('finance', 8002, '财务核算专家', '预算编制、资金审核、税务处理'),
  ],
  localScripts: ['calc_cost_estimate', 'calc_cost_fee', 'calc_litigation_fee'],
  knowledgeCache: [],
  theme: { primary: '224 76% 48%', accent: '224 76% 48%' },
  enabledTabs: ['chat', 'tools', 'documents', 'workflows', 'knowledge-graph'],
  tools: [],
  slashCommands: [],
  workflows: [],
  scenarios: [
    { id: 'bid_review', label: '标书审查', icon: '📋', prompt: '审查这份招标/投标文件的合规性', expectedOutcome: '合规问题清单 + 改进建议 + 法规引用', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '避免废标损失 10-50 万' } },
  ],
}

export default governmentProcurementSolution
