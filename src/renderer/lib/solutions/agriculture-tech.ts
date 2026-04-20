/**
 * 自动拆分自 solution-registry-data.ts。
 * 请勿手工编辑“结构”——如需改方案内容，请直接改本文件字段即可。
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const agricultureTechSolution: SolutionConfig = {
  id: 'agriculture-tech',
  name: '农业技术服务方案',
  icon: '🌾',
  color: '#15803d',
  tagline: '农技推广效率翻 3 倍，补贴申报零遗漏',
  description: '农技咨询 + 补贴政策匹配 + 农产品合规 + 财务核算一站式服务。',
  entrepreneurPurpose: '扩大服务覆盖面、提高补贴获取率、降低合规风险',
  profitMetrics: ['技术咨询效率翻 3 倍', '补贴命中率提升 40%', '合规审查自动化'],
  agents: [
    agent('finance', 8002, '农业财税专家', '农产品税收优惠、补贴申报、成本核算'),
    agent('legal', 8003, '农业合规专家', '土地法、农产品质量安全、合同管理'),
  ],
  localScripts: ['calc_iit', 'calc_vat'],
  knowledgeCache: [],
  theme: { primary: '142 72% 29%', accent: '142 72% 29%' },
  enabledTabs: ['chat', 'tools', 'workflows', 'knowledge-graph'],
  tools: [],
  slashCommands: [],
  workflows: [],
  scenarios: [
    { id: 'subsidy_match', label: '补贴政策匹配', icon: '💰', prompt: '查询适用的农业补贴政策', expectedOutcome: '可申报补贴清单 + 申报条件 + 截止日期', expert: 'finance.tax_consultant', profitImpact: { dimension: 'revenue', amount: '多获补贴 5-20 万/年' } },
  ],
}

export default agricultureTechSolution
