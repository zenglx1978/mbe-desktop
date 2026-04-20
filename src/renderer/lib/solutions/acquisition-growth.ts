/**
 * 自动拆分自 solution-registry-data.ts。
 * 请勿手工编辑“结构”——如需改方案内容，请直接改本文件字段即可。
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const acquisitionGrowthSolution: SolutionConfig = {
  id: 'acquisition-growth',
  name: '并购增长方案',
  icon: '🏢',
  color: '#1d4ed8',
  tagline: '买→换→赚：收购后 AI 替代 60-80% 人力，利润率跃升至 65%',
  description: '将 Invest + Finance + Legal + Sales + Growth + HR 六大 Agent 编排为并购增长全链路方案。收购专业服务机构 → AI 替代人力 → 交叉销售扩展价值。',
  entrepreneurPurpose: '收购代账公司后 AI 替代 8/10 名会计，利润率从 15% 跃升至 65%',
  profitMetrics: ['尽调命中率 30%→70%', 'AI 替代省人力 ¥50-100万/标的', '单客月收入 ¥300→¥800'],
  valueEquivalent: { humanHours: 2000, mbeMinutes: 120, acceleration: '1000x' },
  agents: [
    agent('invest', 8011, '投资分析专家', '标的筛选、多维评分、估值建模'),
    agent('finance', 8002, '财务尽调专家', '三表审查、税务架构、整合成本'),
    agent('legal', 8003, '并购法律专家', 'M&A 合同、竞业限制、劳动安置'),
    agent('sales', 8008, '渠道拓展专家', '标的发现、客户分析、交叉销售'),
    agent('growth', 8009, '激活运营专家', '存量客户 RFM 分群、交叉销售文案'),
    agent('hr', 8010, 'HR 整合专家', '团队优化、劳动关系、员工安置'),
  ],
  localScripts: ['calc_iit', 'calc_vat', 'calc_litigation_fee'],
  knowledgeCache: [],
  theme: { primary: '224 70% 53%', accent: '224 70% 53%' },
  enabledTabs: ['chat', 'tools', 'workflows', 'dashboard', 'knowledge-graph'],
  tools: [
    {
      id: 'target-scorer', type: 'calculator', name: '标的评分器', icon: '🎯',
      agent: 'invest', apiPath: '/api/invest/calc/target-score',
      description: '多维评分（客户数/续费率/AI替代比例/地域），输出收购优先级',
      fields: [
        { key: 'client_count', label: '客户数', type: 'number', required: true },
        { key: 'monthly_revenue', label: '月均收入（万元）', type: 'currency', required: true },
        { key: 'retention_rate', label: '续费率（%）', type: 'number', required: true },
        { key: 'staff_count', label: '员工数', type: 'number', required: true },
        { key: 'target_type', label: '标的类型', type: 'select', required: true,
          options: [
            { value: 'accounting', label: '代账公司' }, { value: 'law_firm', label: '律所' },
            { value: 'hr_outsource', label: 'HR 外包' }, { value: 'insurance', label: '保险代理' },
          ] },
      ],
    },
    {
      id: 'ma-valuation', type: 'calculator', name: '并购估值计算器', icon: '💹',
      agent: 'invest', apiPath: '/api/invest/calc/ma-valuation',
      description: '客户基估值 + 收益法 + AI 增值空间，输出收购价区间',
      fields: [
        { key: 'monthly_revenue', label: '月均收入（万元）', type: 'currency', required: true },
        { key: 'client_count', label: '客户数', type: 'number', required: true },
        { key: 'avg_client_ltv', label: '单客 LTV（万元）', type: 'currency', required: true },
        { key: 'ai_replacement', label: 'AI 可替代比例（%）', type: 'number', default: 60 },
      ],
    },
  ],
  slashCommands: [
    { cmd: '/评分', label: '标的评分', icon: '🎯', toolId: 'target-scorer' },
    { cmd: '/估值', label: '并购估值', icon: '💹', toolId: 'ma-valuation' },
  ],
  safetyRules: [
    { id: 'ma-confidentiality', label: '并购保密义务', trigger: '对话涉及未公开的并购标的信息或谈判细节', action: '红色阻断，禁止在非授权会话中讨论并购标的' },
    { id: 'labor-law-compliance', label: '劳动法合规检查', trigger: '员工安置方案涉及裁员/转岗/降薪', action: '自动检查劳动法合规性，提示 N+1 补偿义务' },
    { id: 'client-migration-loss', label: '客户流失预警', trigger: '迁移期间客户流失率超过 5%', action: '红色预警，暂停迁移并启动客户挽留方案' },
    { id: 'valuation-sanity', label: '估值合理性检查', trigger: '估值倍数偏离行业均值超过 50%', action: '橙色预警，要求补充解释并二次验证' },
    { id: 'antitrust-screening', label: '反垄断筛查', trigger: '收购后市场份额可能超过区域 25%', action: '橙色预警，提示申报义务和反垄断风险' },
    { id: 'financial-data-isolation', label: '标的财务数据隔离', trigger: '不同标的的财务数据出现在同一会话', action: '红色阻断，确保标的间数据严格隔离' },
  ],
  quickActions: [
    { id: 'quick-target-score', label: '标的快速评分', icon: '🎯', workflowId: 'target_screening', description: '输入标的基本信息，AI 秒出多维评分', cta: '立即评分' },
    { id: 'quick-valuation', label: '快速估值', icon: '💹', workflowId: 'due_diligence', description: '输入客户数/收入/员工数，AI 估算收购价区间', cta: '开始估值' },
    { id: 'quick-dd-checklist', label: '尽调清单', icon: '📋', workflowId: 'due_diligence', description: '一键生成财务/法律/业务三维尽调 checklist', cta: '生成清单' },
    { id: 'quick-cross-sell', label: '交叉销售分析', icon: '🔗', workflowId: 'client_activation', description: '输入客户数据，AI 输出交叉销售机会和预期增收', cta: '分析机会' },
    { id: 'quick-integration', label: '整合计划生成', icon: '📊', workflowId: 'integration_migration', description: '一键生成账套迁移+团队整合+客户通知全套方案', cta: '生成计划' },
  ],
  workflows: [
    {
      id: 'target_screening', name: '标的筛选与评分', icon: '🔍',
      description: '行业扫描 → 候选名单 → 多维评分 → 排名推荐',
      mode: 'parallel',
      deliverable: '标的评分排名报告（含 AI 替代空间分析）',
      successCriteria: ['评分维度覆盖客户/财务/AI/地域', '标的排名有清晰逻辑'],
      steps: [
        { id: 'scan', agent: 'sales', expert: 'customer_analyst', label: '行业扫描与候选',
          goal: 'AI 扫描目标地区市场，生成候选名单', successCriteria: ['候选 ≥ 10 家', '含基本信息'],
          profitImpact: { dimension: 'cost_saving', amount: '标的筛选时间从 1 周缩至 3 小时' } },
        { id: 'score', agent: 'invest', expert: 'investment_analyst', label: '多维评分',
          goal: '对标的进行多维评分和排名', successCriteria: ['评分公式透明', '排名可解释'],
          profitImpact: { dimension: 'revenue', amount: '尽调命中率从 30% 提升到 70%' } },
      ],
      triggerPhrases: ['标的筛选', '找标的', '收购对象'],
    },
    {
      id: 'due_diligence', name: '尽调与估值', icon: '📊',
      description: '财务尽调 ∥ 法律尽调 ∥ 业务评估 → 综合估值报告',
      mode: 'parallel',
      deliverable: '综合尽调报告（财务+法律+业务+估值区间）',
      successCriteria: ['三维尽调完整覆盖', '估值 ≥ 2 种方法交叉验证'],
      steps: [
        { id: 'finance_dd', agent: 'finance', expert: 'finance_accountant', label: '财务尽调',
          goal: '审查三表/税务/现金流', successCriteria: ['异常标注', '现金流预测'],
          profitImpact: { dimension: 'loss_avoidance', amount: '识别财务风险避免踩雷' } },
        { id: 'legal_dd', agent: 'legal', expert: 'civil_lawyer', label: '法律尽调',
          goal: '审查合同/劳动/合规风险', successCriteria: ['风险清单', '整改建议'],
          profitImpact: { dimension: 'loss_avoidance', amount: '识别法律风险避免纠纷' } },
        { id: 'valuation', agent: 'invest', expert: 'investment_analyst', label: '综合估值',
          goal: '客户基+收益法+AI 增值估值', successCriteria: ['估值区间', 'AI 增值空间'],
          profitImpact: { dimension: 'revenue', amount: '精准估值节省 20-30% 收购溢价' } },
      ],
      triggerPhrases: ['尽调', '估值', '尽职调查'],
    },
  ],
  scenarios: [
    { id: 'target_scoring', label: '标的筛选评分', icon: '🎯', prompt: '帮我筛选和评分可收购的标的', expectedOutcome: '多维评分排名 + 收购优先级 + AI 替代空间分析', workflowId: 'target_screening', profitImpact: { dimension: 'cost_saving', amount: '节省 60% 尽调成本' } },
    { id: 'valuation', label: '标的估值', icon: '💹', prompt: '对目标标的进行估值分析', expectedOutcome: '客户基/收益法/AI 增值三种估值 + 建议收购价', workflowId: 'due_diligence', profitImpact: { dimension: 'revenue', amount: '精准估值避免 20-30% 溢价' } },
    { id: 'ma_contract', label: '并购合同审查', icon: '📋', prompt: '审查/起草收购合同', expectedOutcome: '合同条款审查 + 风险点 + 修改建议', expert: 'legal.contract_reviewer', profitImpact: { dimension: 'loss_avoidance', amount: '避免合同条款风险损失' } },
    { id: 'integration_plan', label: '整合迁移计划', icon: '📊', prompt: '制定收购后整合迁移方案', expectedOutcome: '账套迁移+客户通知+团队优化+交叉销售全套方案', workflowId: 'integration_migration', profitImpact: { dimension: 'cost_saving', amount: '客户流失率从 30% 降至 5%' } },
    { id: 'cross_sell', label: '交叉销售分析', icon: '🔗', prompt: '分析存量客户交叉销售机会', expectedOutcome: '客户分群 + 交叉服务推荐 + 预期增收', workflowId: 'client_activation', profitImpact: { dimension: 'revenue', amount: '单客月收入 ¥300→¥800（+167%）' } },
  ],
}

export default acquisitionGrowthSolution
