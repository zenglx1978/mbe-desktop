/**
 * 自动拆分自 solution-registry-data.ts。
 * 请勿手工编辑“结构”——如需改方案内容，请直接改本文件字段即可。
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const ipAgencySolution: SolutionConfig = {
  id: 'ip-agency',
  name: '知识产权代理方案',
  icon: '💡',
  color: '#0369a1',
  tagline: '专利代理效率翻 5 倍，驳回率降到最低',
  description: '专利检索 + 撰写辅助 + 商标注册 + 侵权分析 + 年费管理全链路。',
  entrepreneurPurpose: '提高代理人产能和客户服务质量，降低驳回率',
  profitMetrics: ['专利检索 2 天→30min', '权利要求撰写效率翻 5 倍', '驳回率降低 30%'],
  agents: [
    agent('legal', 8003, '专利代理专家', '前案检索、可专利性评估、权利要求撰写、FTO 分析'),
    agent('finance', 8002, '代理财务专家', '代理费核算、年费管理、发票处理'),
  ],
  localScripts: ['calc_litigation_fee', 'calc_iit'],
  knowledgeCache: [],
  theme: { primary: '201 96% 32%', accent: '201 96% 32%' },
  enabledTabs: ['chat', 'tools', 'documents', 'workflows', 'knowledge-graph'],
  tools: [],
  slashCommands: [],
  workflows: [],
  scenarios: [
    { id: 'patent_search', label: '前案检索', icon: '🔍', prompt: '对这项技术方案进行专利前案检索', expectedOutcome: '相关专利清单 + 技术对比 + 可专利性初步评估', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'revenue', amount: '检索加速节省代理人时间，月多接 10 单' } },
  ],
}

export default ipAgencySolution
