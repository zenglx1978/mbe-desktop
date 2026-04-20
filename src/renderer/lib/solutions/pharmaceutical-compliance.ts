/**
 * 自动拆分自 solution-registry-data.ts。
 * 请勿手工编辑“结构”——如需改方案内容，请直接改本文件字段即可。
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const pharmaceuticalComplianceSolution: SolutionConfig = {
  id: 'pharmaceutical-compliance',
  name: '医药合规方案',
  icon: '💊',
  color: '#059669',
  tagline: '注册申报效率翻 3 倍，GMP 合规零死角',
  description: '药品注册 + GMP 合规 + 药物警戒 + 医药财税 + 合同管理全链路。',
  entrepreneurPurpose: '加速药品注册上市、确保合规零失误、降低监管风险',
  profitMetrics: ['注册文件编写加速 3 倍', 'GMP 偏差处理效率提升 70%', '合规审查自动化'],
  agents: [
    agent('legal', 8003, '医药法规专家', '药品注册法、GMP 合规、药物警戒、临床试验法规'),
    agent('finance', 8002, '医药财务专家', '研发费加计扣除、药品定价、成本核算'),
  ],
  localScripts: ['calc_iit', 'calc_vat'],
  knowledgeCache: [],
  theme: { primary: '160 84% 39%', accent: '160 84% 39%' },
  enabledTabs: ['chat', 'tools', 'documents', 'workflows', 'knowledge-graph'],
  tools: [],
  slashCommands: [],
  workflows: [],
  scenarios: [
    { id: 'gmp_check', label: 'GMP 合规检查', icon: '✅', prompt: '检查这项操作的 GMP 合规性', expectedOutcome: '合规结论 + 偏差风险评级 + CAPA 建议', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '避免 GMP 违规停产损失 100 万+' } },
  ],
}

export default pharmaceuticalComplianceSolution
