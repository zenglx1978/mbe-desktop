/**
 * 自动拆分自 solution-registry-data.ts。
 * 请勿手工编辑“结构”——如需改方案内容，请直接改本文件字段即可。
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const smbOperationsSolution: SolutionConfig = {
  id: 'smb-operations',
  name: '中小企业运营方案',
  icon: '🏢',
  color: '#8b5cf6',
  tagline: '四个人的活一个老板搞定，年省 40 万人力成本',
  description: '请法务+会计+销售+客服四个人年薪至少 40 万。MBE 派遣四位 AI 专家，成本不到 1/10，让你把省下来的钱投入真正赚钱的事。',
  entrepreneurPurpose: '一个人管好法务+财务+销售+客服，省下 40 万/年投入业务增长',
  profitMetrics: ['省下 4 个岗位 ≈ 40 万/年', '合同审查避免纠纷损失', '税务筹划年省 3-10 万'],
  valueEquivalent: { humanHours: 160, mbeMinutes: 30, acceleration: '320x' },
  agents: [
    agent('legal', 8003, '企业法务专家', '合同审查、劳动法咨询、风险防控'),
    agent('finance', 8002, '企业财务专家', '记账报税、发票管理、财务分析'),
    agent('sales', 8008, '销售顾问', '客户分析、商机评估、话术推荐'),
    agent('cs', 8004, '客服主管', '工单管理、FAQ 维护、满意度提升'),
  ],
  localScripts: ['calc_iit', 'calc_vat', 'calc_litigation_fee'],
  knowledgeCache: ['labor_law_basics', 'tax_law_basics'],
  theme: { primary: '263 70% 66%', accent: '263 70% 66%', sidebarBg: '263 15% 7%' },
  enabledTabs: ['chat', 'tools', 'workflows', 'dashboard', 'knowledge-graph'],
  tools: [
    { id: 'iit', type: 'calculator', name: '个税计算器', icon: '🧾',
      agent: 'finance', apiPath: '/api/finance/calc/iit', localScript: 'calc_iit',
      fields: [
        { key: 'salary', label: '税前月薪（元）', type: 'currency', required: true },
        { key: 'insurance', label: '五险一金（元）', type: 'currency', default: 0 },
      ],
    },
    { id: 'litigation-fee', type: 'calculator', name: '诉讼费计算器', icon: '⚖️',
      agent: 'legal', apiPath: '/api/legal/calc/litigation-fee', localScript: 'calc_litigation_fee',
      fields: [{ key: 'amount', label: '标的额（元）', type: 'currency', required: true }],
    },
  ],
  slashCommands: [
    { cmd: '/个税', label: '个税计算', icon: '🧾', toolId: 'iit' },
    { cmd: '/诉讼费', label: '诉讼费', icon: '⚖️', toolId: 'litigation-fee' },
    { cmd: '/月报', label: '月度经营体检', icon: '📊', description: '启动四专家月度经营诊断' },
    { cmd: '/合同', label: '合同全流程', icon: '📝', description: '启动合同审查+财务核算流程' },
    { cmd: '/辞退', label: '辞退方案', icon: '🚪', description: '合法辞退方案+补偿金计算' },
  ],
  safetyRules: [
    { id: 'tax-deadline-guard', label: '报税截止预警', trigger: '距纳税申报截止日 ≤ 3 天且未完成', action: '红色弹窗+推送通知老板，置顶报税任务' },
    { id: 'contract-amount-alert', label: '重大合同警告', trigger: '合同金额超过企业月均营收 50%', action: '标记为重大合同，强制法务+财务双审' },
    { id: 'labor-violation-block', label: '违法辞退拦截', trigger: '辞退方案未满足法定补偿要求', action: '提示违法辞退风险，给出合规替代方案' },
    { id: 'invoice-mismatch', label: '发票差异警告', trigger: '收入与开票金额差异超过 10%', action: '提示发票风险，建议核对进销存' },
    { id: 'complaint-escalation', label: '客诉升级', trigger: '客户投诉涉及工商/12315/法律诉讼', action: '自动升级为法务+客服联合处理' },
  ],
  quickActions: [
    { id: 'contract-check', label: '合同快审', icon: '📋', workflowId: 'contract_lifecycle', description: '上传合同，5 分钟获得风险审查+财务影响报告', cta: '上传审查' },
    { id: 'monthly-tax', label: '月度报税', icon: '🧾', description: '一键汇总票据、计算税额、生成申报表', cta: '开始报税' },
    { id: 'fire-plan', label: '辞退方案', icon: '🚪', description: '输入员工情况，AI 给出合法辞退方案+补偿金额', cta: '生成方案' },
    { id: 'complaint-handle', label: '客诉处理', icon: '📢', description: '录入投诉，AI 评估严重度并给出话术+解决方案', cta: '处理投诉' },
    { id: 'monthly-checkup', label: '月度体检', icon: '📊', workflowId: 'monthly_checkup', description: '四专家联合诊断月度经营报告', cta: '开始体检' },
  ],
  workflows: [
    {
      id: 'monthly_checkup', name: '月度经营体检', icon: '📊',
      description: '四位 AI 专家联合诊断：财务→法务→销售→客服，输出月度经营报告',
      mode: 'sequential',
      deliverable: '月度经营体检报告（财务健康 + 法律风险 + 销售漏斗 + 客户满意度）',
      successCriteria: [
        '财务报表含关键比率和同比趋势',
        '法律风险清单含优先级和建议',
        '销售漏斗含各阶段转化率',
        '客服满意度含改进建议',
      ],
      steps: [
        { id: 'finance_review', agent: 'finance', expert: 'finance_accountant', label: '财务健康诊断',
          goal: '分析本月收支、利润率和现金流状况',
          successCriteria: ['收入/支出/净利润同比变化', '应收账款账龄分析', '现金流预测'],
          profitImpact: { dimension: 'cost_saving', amount: '及时发现资金风险，避免现金流断裂' } },
        { id: 'legal_review', agent: 'legal', expert: 'civil_lawyer', label: '法律风险扫描',
          goal: '盘点本月合同、劳动关系和合规风险',
          successCriteria: ['到期合同清单', '劳动合规检查（社保/加班/休假）', '潜在纠纷预警'],
          profitImpact: { dimension: 'loss_avoidance', amount: '风险前置预警，避免纠纷损失 5-30 万' } },
        { id: 'sales_review', agent: 'sales', expert: 'sales_strategist', label: '销售漏斗分析',
          goal: '分析销售 Pipeline 和商机状态',
          successCriteria: ['各阶段商机数量和金额', '预计成交时间', '卡点商机行动建议'],
          profitImpact: { dimension: 'revenue', amount: '漏斗诊断提升成交率，月增收 2-5 万' } },
        { id: 'cs_review', agent: 'cs', expert: 'cs_consultant', label: '客服满意度总结',
          goal: '汇总客户反馈和满意度趋势',
          successCriteria: ['本月工单量和解决率', 'CSAT/NPS 趋势', '高频问题 TOP5 和改进建议'],
          profitImpact: { dimension: 'revenue', amount: '客户满意度提升降低流失，年保收 10 万+' } },
      ],
      triggerPhrases: ['月度体检', '经营诊断', '月报'],
    },
    {
      id: 'contract_lifecycle', name: '合同全流程', icon: '📝',
      description: '从合同审查到财务核算到执行跟踪，法务+财务联合把关',
      mode: 'sequential',
      deliverable: '合同风控报告（风险标注 + 修改建议 + 财务影响分析）',
      successCriteria: [
        '风险条款逐条标注且引用法律依据',
        '修改建议可直接使用',
        '财务影响含对利润和现金流的测算',
      ],
      steps: [
        { id: 'review', agent: 'legal', expert: 'civil_lawyer', label: '合同条款审查',
          goal: '审查合同法律风险并提供修改建议',
          successCriteria: ['高/中/低风险条款分级', '每条标注法律依据', '提供替代条款草案'],
          profitImpact: { dimension: 'loss_avoidance', amount: '拦截高风险条款，避免纠纷损失 5-30 万' } },
        { id: 'financial_impact', agent: 'finance', expert: 'finance_accountant', label: '财务影响分析',
          goal: '分析合同对企业财务的影响',
          successCriteria: ['收入确认时点和方式', '付款节奏对现金流的影响', '税务影响分析'],
          profitImpact: { dimension: 'cost_saving', amount: '优化付款条件和税务安排，每单省 0.5-3 万' } },
      ],
      triggerPhrases: ['审合同', '合同审查', '合同全流程'],
    },
  ],
  scenarios: [
    { id: 'contract_review', label: '合同快审', icon: '📋', prompt: '快速审查这份商业合同的风险点', expectedOutcome: '逐条风险标注 + 修改建议 + 民法典条款引用', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '避免合同纠纷损失 5-30 万' } },
    { id: 'tax_question', label: '税务快问', icon: '🧾', prompt: '解答这个税务问题', expectedOutcome: '准确税务结论 + 税法条款依据 + 对经营的影响分析', expert: 'finance.tax_consultant', profitImpact: { dimension: 'cost_saving', amount: '合法节税 3-10 万/年' } },
    { id: 'dismiss_plan', label: '辞退方案', icon: '🚪', prompt: '公司想辞退一名员工，需要怎么合法操作', expectedOutcome: '合法辞退方案 + N/2N 补偿金额 + 操作步骤 + 风险提示', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '避免违法辞退赔偿 2-8 万' } },
    { id: 'customer_value', label: '客户价值分析', icon: '👤', prompt: '分析这个客户的商业价值和跟进策略', expectedOutcome: '客户画像 + LTV 估算 + 推荐跟进方案 + 话术模板', expert: 'sales.sales_strategist', profitImpact: { dimension: 'revenue', amount: '高价值客户精准跟进，成交率 +30%' } },
  ],
}

export default smbOperationsSolution
