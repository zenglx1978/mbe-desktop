/**
 * 自动拆分自 solution-registry-data.ts。
 * 请勿手工编辑“结构”——如需改方案内容，请直接改本文件字段即可。
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const constructionCostSolution: SolutionConfig = {
  id: 'construction-cost',
  name: '工程造价咨询方案',
  icon: '🏗️',
  color: '#ea580c',
  tagline: '一个造价师年产值翻 3 倍，审核更准利润更高',
  description: 'AI 把翻定额、算工程量、核取费加速 10 倍。一个造价师过去年做 20 个项目，现在能做 60 个。',
  entrepreneurPurpose: '同样团队承接 3 倍项目，每个项目审核零差错',
  profitMetrics: ['定额查询 2h→10s，每个项目省 40+ 小时', '年产值 50 万→150 万/人', '核减遗漏降低 90%'],
  valueEquivalent: { humanHours: 80, mbeMinutes: 10, acceleration: '480x' },
  agents: [
    agent('cost', 8007, '造价工程专家', '定额查询、工程量计算、清单编制'),
    agent('cost', 8007, '取费审核专家', '取费计算、税金计算、造价估算'),
    agent('legal', 8003, '合同合规专家', '施工合同审查、变更签证、索赔分析'),
  ],
  localScripts: ['calc_cost_estimate', 'calc_cost_fee', 'calc_cost_tax'],
  knowledgeCache: ['cost_standards'],
  theme: { primary: '21 90% 48%', accent: '21 90% 48%', sidebarBg: '20 15% 6%' },
  enabledTabs: ['chat', 'tools', 'workflows', 'dashboard', 'knowledge-graph'],
  tools: [
    { id: 'cost-fee', type: 'calculator', name: '取费计算器', icon: '🧮',
      agent: 'cost', apiPath: '/api/cost/calc/fee', localScript: 'calc_cost_fee',
      fields: [
        { key: 'project_type', label: '工程类型', type: 'select', required: true,
          options: [
            { value: 'building', label: '建筑工程' }, { value: 'municipal', label: '市政工程' },
            { value: 'decoration', label: '装修工程' }, { value: 'installation', label: '安装工程' },
          ] },
        { key: 'base_cost', label: '直接费（元）', type: 'currency', required: true },
      ],
    },
    { id: 'cost-tax', type: 'calculator', name: '工程税金计算', icon: '🏗️',
      agent: 'cost', apiPath: '/api/cost/calc/tax', localScript: 'calc_cost_tax',
      fields: [
        { key: 'amount', label: '税前造价（元）', type: 'currency', required: true },
        { key: 'tax_rate', label: '税率', type: 'select', required: true,
          options: [{ value: '0.09', label: '9%（一般）' }, { value: '0.03', label: '3%（简易）' }] },
      ],
    },
    { id: 'cost-estimate', type: 'calculator', name: '造价估算', icon: '📐',
      agent: 'cost', apiPath: '/api/cost/calc/estimate', localScript: 'calc_cost_estimate',
      fields: [
        { key: 'area', label: '建筑面积（㎡）', type: 'number', required: true },
        { key: 'structure', label: '结构形式', type: 'select', required: true,
          options: [
            { value: 'frame', label: '框架结构' }, { value: 'shear_wall', label: '剪力墙结构' },
            { value: 'steel', label: '钢结构' },
          ] },
      ],
    },
    {
      id: 'quota-lookup', type: 'calculator', name: '定额查询', icon: '📖',
      agent: 'cost', apiPath: '/api/cost/calc/quota-lookup',
      description: '按定额编号或关键词查询定额子目（含人工/材料/机械组价明细）',
      fields: [
        { key: 'quota_code', label: '定额编号（如 1-15）', type: 'text' },
        { key: 'keyword', label: '关键词（如 "C30 混凝土"）', type: 'text' },
        { key: 'region', label: '适用地区', type: 'select', default: 'national',
          options: [
            { value: 'national', label: '全国统一定额' }, { value: 'beijing', label: '北京市' },
            { value: 'shanghai', label: '上海市' }, { value: 'guangdong', label: '广东省' },
            { value: 'zhejiang', label: '浙江省' }, { value: 'jiangsu', label: '江苏省' },
          ] },
      ],
    },
  ],
  slashCommands: [
    { cmd: '/取费', label: '取费计算', icon: '🧮', toolId: 'cost-fee' },
    { cmd: '/税金', label: '工程税金', icon: '🏗️', toolId: 'cost-tax' },
    { cmd: '/估算', label: '造价估算', icon: '📐', toolId: 'cost-estimate' },
    { cmd: '/定额', label: '定额查询', icon: '📖', toolId: 'quota-lookup' },
  ],
  workflows: [
    {
      id: 'settlement_audit', name: '结算审核流程', icon: '📋',
      description: '输出结算审核报告，确保工程量准确、单价合理、取费合规',
      mode: 'sequential',
      deliverable: '结算审核报告（含核减明细 + 争议分析）',
      successCriteria: [
        '工程量差异逐项列出，标注依据',
        '综合单价引用定额编号',
        '取费费率符合当地标准文件',
      ],
      steps: [
        { id: 'quantity', agent: 'cost', expert: 'cost_engineer', label: '工程量复核',
          goal: '逐项核实工程量，标注偏差和依据', successCriteria: ['核减/核增项逐条列出', '引用图纸编号或签证单号'],
          profitImpact: { dimension: 'revenue', amount: '核减遗漏降低 90%，审核更可信，客户续约率 +30%' } },
        { id: 'price', agent: 'cost', expert: 'cost_engineer', label: '综合单价审核',
          goal: '验证单价组成合理性', successCriteria: ['主材价格对比信息价', '人工机械单价引用定额基价'],
          profitImpact: { dimension: 'loss_avoidance', amount: '发现单价虚高，每项目避损 2-10 万' } },
        { id: 'fee', agent: 'cost', expert: 'cost_engineer', label: '取费与税金审核',
          goal: '确认取费费率和税金计算正确', successCriteria: ['费率引用当地文件编号', '税金计算方式（一般/简易）正确'],
          profitImpact: { dimension: 'loss_avoidance', amount: '取费准确，避免审核回退返工 1-3 天' } },
      ],
      triggerPhrases: ['结算审核', '审核结算', '工程结算'],
    },
  ],
  safetyRules: [
    { id: 'price-abnormal-alert', label: '单价异常报警', trigger: '综合单价偏离信息价或定额基价 ≥ 20%', action: '橙色预警，标注异常项并要求核实依据' },
    { id: 'tax-method-check', label: '计税方式校验', trigger: '一般计税/简易计税选择与合同不一致', action: '阻止计算，提示核对合同约定' },
    { id: 'settlement-over-contract', label: '结算超合同价预警', trigger: '结算金额超过合同价 15% 以上', action: '红色预警，列出主要增量项和变更依据' },
    { id: 'quota-region-mismatch', label: '定额地区不匹配', trigger: '使用的定额标准与项目所在地区不一致', action: '阻止套价，提示选择正确地区定额' },
    { id: 'bid-deadline-guard', label: '投标截止倒计时', trigger: '距投标截止日 ≤ 3 天', action: '红色弹窗+置顶任务，提醒完成标书' },
  ],
  quickActions: [
    { id: 'quick-estimate', label: '快速造价估算', icon: '📐', workflowId: 'budget_compilation', description: '输入面积和结构形式，秒出造价估算', cta: '开始估算' },
    { id: 'fee-calc', label: '取费计算', icon: '🧮', description: '输入直接费，自动按 GB50500 计算全部取费', cta: '开始计算' },
    { id: 'settlement-review', label: '结算审核', icon: '📋', workflowId: 'settlement_audit', description: '启动结算审核全流程', cta: '开始审核' },
    { id: 'material-adjust', label: '材料调差', icon: '📦', description: '价差法/指数法/FIDIC 公式计算材料调差', cta: '计算调差' },
    { id: 'quota-search', label: '定额查询', icon: '📖', description: '按关键词或编号查询定额子目和单价', cta: '查询定额' },
  ],
  scenarios: [
    { id: 'quota_lookup', label: '定额查询', icon: '📖', prompt: '查询这项施工内容的定额子目和单价', expectedOutcome: '定额编号 + 子目名称 + 含量 + 基价', expert: 'cost.cost_engineer', profitImpact: { dimension: 'cost_saving', amount: '定额查询 2h→10s，每项目省 40+ 小时' } },
    { id: 'change_order', label: '变更签证', icon: '📝', prompt: '分析这份变更签证的造价影响', expectedOutcome: '变更金额（增/减）+ 计算依据 + 合同条款引用', expert: 'cost.cost_engineer', profitImpact: { dimension: 'revenue', amount: '审核更准确，单项多收审核费 1-3 万' } },
  ],
}

export default constructionCostSolution
