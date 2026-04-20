/**
 * 自动拆分自 solution-registry-data.ts。
 * 请勿手工编辑“结构”——如需改方案内容，请直接改本文件字段即可。
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const realEstateManagementSolution: SolutionConfig = {
  id: 'real-estate-management',
  name: '房地产经纪与物业方案',
  icon: '🏘️',
  color: '#9333ea',
  tagline: '经纪人产能翻 3 倍，物业投诉处理效率提升 80%',
  description: '房产交易合规 + 租赁管理 + 物业财务 + 业主纠纷处理全链路。',
  entrepreneurPurpose: '提升经纪人人效和物业服务满意度，降低纠纷成本',
  profitMetrics: ['合同审查 2h→5min', '物业投诉响应提速 80%', '纠纷赔偿降低 50%'],
  agents: [
    agent('legal', 8003, '房产法务专家', '买卖合同、租赁纠纷、物业管理法'),
    agent('finance', 8002, '房产财务专家', '佣金结算、物业收费、税务处理'),
    agent('cs', 8004, '物业客服专家', '业主投诉、报修工单、满意度管理'),
  ],
  localScripts: ['calc_iit', 'calc_litigation_fee'],
  knowledgeCache: [],
  theme: { primary: '270 70% 55%', accent: '270 70% 55%' },
  enabledTabs: ['chat', 'tools', 'workflows', 'dashboard', 'knowledge-graph'],
  tools: [],
  slashCommands: [],
  workflows: [],
  scenarios: [
    { id: 'lease_review', label: '租赁合同审查', icon: '📋', prompt: '审查这份租赁合同的风险点', expectedOutcome: '风险条款标注 + 修改建议 + 法规引用', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '避免租赁纠纷损失 3-15 万' } },
  ],
}

export default realEstateManagementSolution
