/**
 * 遗留系统 AI 化方案 — Desktop 配置
 * 对应 solutions/legacy-erp-ai/solution.yaml v1.0.0
 * 核心定位：金蝶/用友 ERP 只读 Connector + AI 决策层，不替换 ERP 本身
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const legacyErpAiSolution: SolutionConfig = {
  id: 'legacy-erp-ai',
  name: '遗留系统 AI 化',
  icon: '🔌',
  color: '#475569',
  tagline: '金蝶/用友 ERP 上加 AI 大脑，旧数据产生新价值，不替换现有系统',
  description:
    '通过只读 Connector 接入金蝶/用友/SAP 数据，部署 Finance + Legal + HR 三路 AI 决策层，' +
    '实现财务智能审计、合同批量风险扫描、增值税申报底稿生成、薪酬合规审查，' +
    '无需改造现有 ERP，2 小时完成 3 天的工作量。',
  entrepreneurPurpose: '不动金蝶/用友一行代码，在旧 ERP 上加一层 AI 大脑',
  profitMetrics: [
    '财务审计底稿：3-5 天 → 8 小时，省外部审计费 5-15 万/次',
    '合同风险批量扫描：2 天/批次 → 1 小时，高风险遗漏率降至 0',
    '增值税申报准备：3 天人工整理 → 2 小时 AI 自动生成，差错率 0.1%',
    '薪酬合规审查：季度抽查 → 月度自动扫描，避免劳动仲裁损失',
  ],
  valueEquivalent: { humanHours: 200, mbeMinutes: 60, acceleration: '200x' },
  agents: [
    agent('finance', 8002, '企业财务', '财务审计 / 增值税申报 / 成本核算 / 税务分析'),
    agent('legal',   8003, '企业法务', '合同风险评分 / 合规审查 / 纠纷处理'),
    agent('hr',      8010, '人力资源', '薪酬合规 / 社保核查 / 加班费审查'),
    agent('cost',    8007, '造价成本', '工程成本审计 / 采购价格分析'),
  ],
  tools: [
    {
      id: 'vat-calc', type: 'calculator', name: '增值税应纳税额计算', icon: '🧾',
      agent: 'finance', apiPath: '/api/finance/calc/vat',
      description: '计算销项税额、进项抵扣、应纳税额 / 留抵税额',
      fields: [
        { key: 'output_tax',  label: '销项税额（元）', type: 'currency', required: true },
        { key: 'input_tax',   label: '可抵扣进项税额（元）', type: 'currency', required: true },
        { key: 'carryover',   label: '上期留抵税额（元）', type: 'currency', default: 0 },
        { key: 'transfer_out',label: '进项税额转出（元）', type: 'currency', default: 0 },
      ],
    },
    {
      id: 'salary-check', type: 'calculator', name: '薪酬合规快查', icon: '💰',
      agent: 'hr', apiPath: '/api/hr/calc/salary-compliance',
      description: '快速核查最低工资 / 加班费 / 社保基数',
      fields: [
        { key: 'city',         label: '所在城市', type: 'select', required: true,
          options: [
            { value: 'beijing', label: '北京（最低工资 2420 元）' },
            { value: 'shanghai', label: '上海（最低工资 2690 元）' },
            { value: 'guangzhou', label: '广州（最低工资 2300 元）' },
            { value: 'shenzhen', label: '深圳（最低工资 2360 元）' },
          ] },
        { key: 'base_salary',  label: '基本月薪（元）', type: 'currency', required: true },
        { key: 'overtime_h',   label: '本月加班小时数', type: 'number', default: 0 },
        { key: 'si_base',      label: '社保缴费基数（元）', type: 'currency', required: true },
      ],
    },
  ],
  slashCommands: [
    { command: '/audit',        label: '财务智能审计',      workflowId: 'finance_smart_audit' },
    { command: '/contracts',    label: '合同风险批量扫描',  workflowId: 'contract_risk_scan' },
    { command: '/vat',          label: '增值税申报底稿',    workflowId: 'vat_return_draft' },
    { command: '/salary',       label: '薪酬合规审查',      workflowId: 'salary_compliance_check' },
    { command: '/erp-connect',  label: '配置 ERP 连接器',   workflowId: 'finance_smart_audit' },
    { command: '/cost-alert',   label: '成本超支预警',      workflowId: 'finance_smart_audit' },
  ],
  safetyRules: [
    { id: 'readonly_erp',  label: 'ERP 只读',    level: 'hard', description: '禁止写入 ERP 业务数据，仅允许写备注/自定义字段' },
    { id: 'pii_masking',   label: 'PII 脱敏',    level: 'hard', description: '员工姓名/身份证/银行卡自动脱敏' },
    { id: 'large_hitl',    label: '大额 HITL',   level: 'hard', description: '单笔凭证超 100 万强制人工确认' },
    { id: 'audit_trail',   label: '审计追踪',    level: 'hard', description: '所有 ERP API 调用完整记录到 governance 日志' },
    { id: 'no_tax_submit', label: '不直连税务',  level: 'hard', description: '申报数据仅生成底稿，不直接连接税务系统' },
    { id: 'data_ttl',      label: '数据 TTL',    level: 'soft', description: 'ERP 拉取数据会话结束后自动清除，不持久化员工明细' },
  ],
  quickActions: [
    {
      id: 'start-audit',
      icon: '🔍',
      label: '开始财务审计',
      description: '从 ERP 拉取凭证，AI 自动检测异常，生成审计底稿',
      workflowId: 'finance_smart_audit',
    },
    {
      id: 'scan-contracts',
      icon: '⚖️',
      label: '扫描合同风险',
      description: '批量拉取 ERP 合同模块，AI 风险评分排序（RED/YELLOW/GREEN）',
      workflowId: 'contract_risk_scan',
    },
    {
      id: 'vat-return',
      icon: '🧾',
      label: '准备增值税申报',
      description: 'AI 从 ERP 拉取销项/进项，自动生成申报底稿，标注异常',
      workflowId: 'vat_return_draft',
    },
    {
      id: 'salary-check',
      icon: '💰',
      label: '薪酬合规检查',
      description: 'AI 审查本月薪酬数据，核查最低工资/社保/加班费/个税',
      workflowId: 'salary_compliance_check',
    },
  ],
  workflows: [
    {
      id: 'finance_smart_audit',
      name: '财务智能审计',
      description: '从金蝶/用友拉取期间凭证科目数据 → Finance Agent 异常检测 → HITL 财务总监审批 → 生成审计底稿报告',
      steps: [
        { label: 'ERP 数据拉取',  agent: 'finance', expert: 'finance_accountant', description: '从金蝶/用友拉取期间凭证、科目余额' },
        { label: '异常检测',      agent: 'finance', expert: 'finance_accountant', description: 'AI 检测大额异常、科目错配、未对账项' },
        { label: '合规核查',      agent: 'finance', expert: 'finance_accountant', description: '对照会计准则检查处理方式' },
        { label: '税务分析',      agent: 'finance', expert: 'tax_consultant',     description: '增值税/所得税申报数据核验' },
        { label: '人工审批',      mode: 'hitl',                                    description: '财务总监审批 AI 审计结论' },
        { label: '报告生成',      agent: 'finance', expert: 'finance_accountant', description: 'DocGen 生成审计底稿（XLSX+PDF）' },
      ],
    },
    {
      id: 'contract_risk_scan',
      name: '合同风险批量扫描',
      description: '从 ERP 合同模块批量拉取数据 → Legal Agent 逐份风险评分 → 风险排序 → 高风险合同推送法务审批',
      steps: [
        { label: '合同列表拉取',  agent: 'legal', expert: 'contract_reviewer', description: '从 ERP 拉取本期合同列表' },
        { label: '批量风险评分',  agent: 'legal', expert: 'contract_reviewer', description: 'parallel 模式并行审查所有合同' },
        { label: '风险排序',      agent: 'legal', expert: 'contract_reviewer', description: '按风险等级排序：RED/YELLOW/GREEN' },
        { label: '高风险推送',    agent: 'legal', expert: 'contract_reviewer', description: 'RED 合同推送法务审批队列' },
        { label: '法务审批',      mode: 'hitl',                                 description: '法务逐一确认高风险合同处理' },
        { label: '汇总报告',      agent: 'legal', expert: 'contract_reviewer', description: '生成本期合同风险扫描报告' },
      ],
    },
    {
      id: 'vat_return_draft',
      name: '增值税申报底稿生成',
      description: '从 ERP 拉取当期销项/进项数据 → tax_consultant 核算应纳税额 → 异常发票标注 → 财务确认 → 导出申报底稿',
      steps: [
        { label: '销项数据拉取',  agent: 'finance', expert: 'tax_consultant',     description: '从 ERP 拉取当期开票数据，发票异常检查' },
        { label: '进项数据拉取',  agent: 'finance', expert: 'tax_consultant',     description: '拉取认证进项发票，核查认证状态' },
        { label: '申报数据核算',  agent: 'finance', expert: 'tax_consultant',     description: 'AI 计算应纳税额 / 进项抵扣 / 留抵' },
        { label: '异常标注',      agent: 'finance', expert: 'finance_accountant', description: '标注异常发票、超期认证等风险项' },
        { label: '财务确认',      mode: 'hitl',                                   description: '财务核查数据准确性' },
        { label: '申报数据包导出',agent: 'finance', expert: 'tax_consultant',     description: '生成税务申报底稿 XLSX 和申报数据包' },
      ],
    },
    {
      id: 'salary_compliance_check',
      name: '薪酬合规审查',
      description: '从 ERP 薪酬模块拉取工资数据 → HR Agent 核查最低工资/社保基数/加班费 → 个税校验 → 合规报告',
      steps: [
        { label: '薪酬数据拉取',  agent: 'hr',      expert: 'hr_consultant',     description: '从 ERP 薪酬模块拉取当月工资明细（PII 脱敏）' },
        { label: '最低工资核查',  agent: 'hr',      expert: 'hr_consultant',     description: '对照属地最低工资标准逐人核查' },
        { label: '社保/公积金',   agent: 'hr',      expert: 'hr_consultant',     description: '核查缴费基数是否在合规区间' },
        { label: '加班费审查',    agent: 'hr',      expert: 'hr_consultant',     description: '核查 1.5/2/3 倍加班费计算准确性' },
        { label: '个税代扣校验',  agent: 'finance', expert: 'tax_consultant',    description: '累计预扣法重新计算，比对 ERP 差异' },
        { label: '合规报告 HITL', mode: 'hitl',                                  description: 'HR 确认 RED/YELLOW 整改清单' },
        { label: '整改清单导出',  agent: 'hr',      expert: 'hr_consultant',     description: '输出合规审查报告 + 整改清单（XLSX+PDF）' },
      ],
    },
  ],
}
