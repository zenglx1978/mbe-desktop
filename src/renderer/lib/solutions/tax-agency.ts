/**
 * 自动拆分自 solution-registry-data.ts。
 * 请勿手工编辑“结构”——如需改方案内容，请直接改本文件字段即可。
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const taxAgencySolution: SolutionConfig = {
  id: 'tax-agency',
  name: '税务代理方案',
  icon: '🧾',
  color: '#b45309',
  tagline: '税务师人效翻 3 倍，涉税风险零遗漏',
  description: '代理记账 + 税务申报 + 汇算清缴 + 税务稽查应对 + 筹划方案全链路。',
  entrepreneurPurpose: '同样团队服务 3 倍客户，每个客户税务风险零遗漏',
  profitMetrics: ['申报效率翻 3 倍', '汇算清缴 3 天→半天', '稽查风险提前预警'],
  agents: [
    agent('finance', 8002, '税务代理专家', '纳税申报、汇算清缴、税务筹划、稽查应对'),
    agent('legal', 8003, '税法合规专家', '税务行政复议、税务争议、合规审查'),
  ],
  localScripts: ['calc_iit', 'calc_vat'],
  knowledgeCache: ['tax_law_basics'],
  theme: { primary: '28 80% 35%', accent: '28 80% 35%' },
  enabledTabs: ['chat', 'tools', 'workflows', 'dashboard', 'knowledge-graph'],
  tools: [
    { id: 'iit', type: 'calculator', name: '个税计算器', icon: '🧾',
      agent: 'finance', apiPath: '/api/finance/calc/iit', localScript: 'calc_iit',
      fields: [
        { key: 'salary', label: '税前月薪（元）', type: 'currency', required: true },
        { key: 'insurance', label: '五险一金（元）', type: 'currency', default: 0 },
      ],
    },
    { id: 'vat', type: 'calculator', name: 'VAT 計算器', icon: '📊',
      agent: 'finance', apiPath: '/api/finance/calc/vat', localScript: 'calc_vat',
      fields: [
        { key: 'amount', label: '含税金额（元）', type: 'currency', required: true },
        { key: 'rate', label: '税率', type: 'select', required: true,
          options: [
            { value: '0.13', label: '13%' }, { value: '0.09', label: '9%' },
            { value: '0.06', label: '6%' }, { value: '0.03', label: '3%' },
          ] },
      ],
    },
  ],
  slashCommands: [
    { cmd: '/个税', label: '个税计算', icon: '🧾', toolId: 'iit' },
    { cmd: '/VAT', label: 'VAT 計算', icon: '📊', toolId: 'vat' },
  ],
  workflows: [],
  scenarios: [
    { id: 'tax_filing', label: '纳税申报', icon: '📊', prompt: '协助完成本期纳税申报', expectedOutcome: '各税种应纳税额 + 申报数据 + 注意事项', expert: 'finance.tax_consultant', profitImpact: { dimension: 'cost_saving', amount: '申报效率翻 3 倍，月省人力 5 天' } },
    { id: 'audit_defense', label: '稽查应对', icon: '🛡️', prompt: '税务稽查通知如何应对', expectedOutcome: '材料准备清单 + 应对策略 + 风险评估', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '避免稽查补税罚款 10-100 万' } },
  ],
}

export default taxAgencySolution
