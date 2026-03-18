/**
 * Solution Router — 行业方案 → Agent 后端映射
 *
 * 根据用户选择的行业方案，配置连接哪些 Agent 后端、
 * 显示哪些 AI 专家、启用哪些本地计算。
 * 方案切换不需要重启，热切换。
 */

export interface AgentEndpoint {
  id: string
  role: string
  handles: string
  baseUrl: string
  wsUrl: string
}

/** 方案级主题 — 借鉴 WorldMonitor 多变体仪表盘设计 */
export interface SolutionTheme {
  /** 主色调 HSL（写入 --primary / --ring） */
  primary: string
  /** 选区颜色 HSL */
  accent: string
  /** 侧边栏背景 HSL（可选，默认沿用全局 --card） */
  sidebarBg?: string
}

/** 工具表单字段定义 */
export interface ToolField {
  key: string
  label: string
  type: 'text' | 'number' | 'currency' | 'select' | 'date' | 'textarea' | 'file'
  placeholder?: string
  options?: { value: string; label: string }[]
  required?: boolean
  default?: string | number
}

/** 工具配置 — 配置驱动，不硬编码 */
export interface ToolConfig {
  id: string
  type: 'calculator' | 'document-ai' | 'doc-generator' | 'task-board' | 'batch-processor'
  name: string
  icon: string
  /** 对应的 Agent ID（用于 API 调用） */
  agent: string
  /** 远端 API 路径 */
  apiPath: string
  /** 本地 Python 脚本（离线可用） */
  localScript?: string
  /** 表单字段（calculator / doc-generator 用） */
  fields?: ToolField[]
  /** 接受的文件类型（document-ai 用） */
  acceptTypes?: string[]
  /** 工具描述 */
  description?: string
}

/** Slash 命令 */
export interface SlashCommand {
  cmd: string
  label: string
  icon: string
  /** 关联工具 ID（打开工具面板）或 null（发送消息） */
  toolId?: string
  description?: string
}

/** 仪表盘组件 */
export interface DashboardWidget {
  type: 'stat' | 'timeline' | 'chart'
  label: string
  source: string
  filter?: string
}

export type WorkbenchTab = 'chat' | 'tools' | 'documents' | 'tasks' | 'dashboard' | 'workflows' | 'approvals' | 'costs' | 'scheduler' | 'designer' | 'efficiency'

/** 利润影响标注 — 米塞斯 P2：企业的目的是获取利润 */
export interface ProfitImpact {
  /** 影响维度：增收 / 降本 / 避损 */
  dimension: 'revenue' | 'cost_saving' | 'loss_avoidance'
  /** 量化描述（如"省 2 小时/件"、"避免误赔 ¥5 万"） */
  amount: string
}

/** 工作流步骤 — 目标驱动，不硬编码过程 */
export interface WorkflowStep {
  id: string
  agent: string
  expert: string
  label: string
  /** 这一步要达成的目标（不是"怎么做"，而是"做到什么"） */
  goal: string
  /** 可衡量的成功标准（评估 AI 输出质量的依据） */
  successCriteria: string[]
  description?: string
  /** 此步骤对企业家利润的影响（米塞斯 P2） */
  profitImpact?: ProfitImpact
}

/** 工作流定义 — 目标驱动的多 Agent 编排 */
export interface WorkflowConfig {
  id: string
  name: string
  icon: string
  description: string
  /** sequential = 流水线（步骤间传递结果）, parallel = 并行合并 */
  mode: 'sequential' | 'parallel'
  /** 工作流的最终交付物（用户能拿到什么） */
  deliverable: string
  /** 整体成功标准（如何判定工作流完成） */
  successCriteria: string[]
  steps: WorkflowStep[]
  /** 触发词（Chat 自动匹配） */
  triggerPhrases?: string[]
}

/** 快捷场景 — 目标驱动的一键提问 */
export interface ScenarioConfig {
  id: string
  label: string
  icon: string
  /** 预置 prompt 模板（含 {placeholder}） */
  prompt: string
  /** 期望输出的类型和质量标准 */
  expectedOutcome: string
  /** 路由到的 Agent.Expert */
  expert?: string
  /** 路由到的工作流 ID（与 expert 二选一） */
  workflowId?: string
  /** 专用 API 端点（绕过通用 /consult，直调 Agent 特定接口） */
  apiEndpoint?: string
  /** HTTP 方法（默认 GET） */
  apiMethod?: 'GET' | 'POST'
  /** 此场景对企业家利润的影响（米塞斯 P2） */
  profitImpact?: ProfitImpact
}

export interface SolutionConfig {
  id: string
  name: string
  icon: string
  color: string
  tagline: string
  description: string
  /** 企业家的商业目的（米塞斯 P1：人的行为是有目的的） */
  entrepreneurPurpose: string
  /** 利润指标（米塞斯 P2：企业的目的是获取利润） */
  profitMetrics: string[]
  /** 人力等效数据（米塞斯 P3：帮企业家做经济计算） */
  valueEquivalent?: { humanHours: number; mbeMinutes: number; acceleration: string }
  agents: AgentEndpoint[]
  /** 本地可用的确定性计算脚本 */
  localScripts: string[]
  /** 离线可用的知识缓存 */
  knowledgeCache: string[]
  /** 行业方案专属主题（色彩差异化） */
  theme: SolutionTheme
  /** 业务工具配置 */
  tools: ToolConfig[]
  /** Slash 命令（Chat → 工具桥接） */
  slashCommands: SlashCommand[]
  /** 可用的 Tab 页 */
  enabledTabs: WorkbenchTab[]
  /** 仪表盘组件 */
  dashboardWidgets?: DashboardWidget[]
  /** 行业工作流（多 Agent 编排） */
  workflows: WorkflowConfig[]
  /** 快捷场景（一键提问） */
  scenarios: ScenarioConfig[]
}

import { API_BASE, WS_BASE } from '@/lib/api-client'

function agent(id: string, _port: number, role: string, handles: string): AgentEndpoint {
  return {
    id,
    role,
    handles,
    baseUrl: `${API_BASE}/api/${id}`,
    wsUrl: `${WS_BASE}/ws/${id}/chat`,
  }
}

export const SOLUTION_REGISTRY: SolutionConfig[] = [
  {
    id: 'labor-dispatch',
    name: '劳务派遣一站式方案',
    icon: '👷',
    color: '#f59e0b',
    tagline: '三个岗位的活一个老板管，人力成本省 60%',
    description: '过去需要法务 + 会计 + HR 三个专职岗位，MBE 派遣三位 AI 专家，用 1/3 的人力成本完成全部工作，释放出来的预算投入业务扩张。',
    entrepreneurPurpose: '用 1/3 的人力成本完成合规+结算+纠纷全链路，释放利润空间',
    profitMetrics: ['省下法务+会计+HR 三岗 ≈ 年省 30-50 万', '合规检查 40h→5min', '纠纷赔偿零差错，避免多赔'],
    valueEquivalent: { humanHours: 40, mbeMinutes: 5, acceleration: '480x' },
    agents: [
      agent('legal', 8003, '劳动法专家', '用工合规、合同审查、纠纷处理'),
      agent('finance', 8002, '薪酬财税专家', '工资计算、社保代缴、差额征税'),
      agent('hr', 8010, '人力资源专家', '招聘管理、考勤排班、入离职流程'),
    ],
    localScripts: ['calc_labor_compensation', 'calc_litigation_fee', 'calc_hr_overtime', 'calc_hr_annual_leave'],
    knowledgeCache: ['labor_law_basics', 'dispatch_regulations'],
    theme: { primary: '38 92% 50%', accent: '38 92% 50%' },
    enabledTabs: ['chat', 'tools', 'documents', 'tasks', 'workflows', 'dashboard'],
    tools: [
      {
        id: 'labor-compensation', type: 'calculator', name: '经济补偿计算器', icon: '💰',
        agent: 'legal', apiPath: '/api/legal/calc/compensation',
        localScript: 'calc_labor_compensation',
        description: '劳动经济补偿金精确计算（N/N+1/2N）',
        fields: [
          { key: 'monthly_salary', label: '月工资（元）', type: 'currency', required: true },
          { key: 'work_years', label: '工作年限', type: 'number', required: true },
          { key: 'dismissal_type', label: '解除类型', type: 'select', required: true,
            options: [
              { value: 'N', label: 'N（协商/裁员/客观变化）' },
              { value: 'N+1', label: 'N+1（未提前30天通知）' },
              { value: '2N', label: '2N（违法解除）' },
            ] },
        ],
      },
      {
        id: 'litigation-fee', type: 'calculator', name: '诉讼费计算器', icon: '⚖️',
        agent: 'legal', apiPath: '/api/legal/calc/litigation-fee',
        localScript: 'calc_litigation_fee',
        description: '法院案件受理费精确计算',
        fields: [
          { key: 'amount', label: '标的额（元）', type: 'currency', required: true },
        ],
      },
      {
        id: 'salary-tax', type: 'calculator', name: '个税计算器', icon: '🧾',
        agent: 'finance', apiPath: '/api/finance/calc/salary-tax',
        localScript: 'calc_iit',
        description: '工资薪金个人所得税计算',
        fields: [
          { key: 'salary', label: '税前月薪（元）', type: 'currency', required: true },
          { key: 'insurance', label: '五险一金（元）', type: 'currency', default: 0 },
          { key: 'deduction', label: '专项附加扣除（元）', type: 'currency', default: 0 },
        ],
      },
      {
        id: 'contract-review', type: 'document-ai', name: '劳动合同审查', icon: '📋',
        agent: 'legal', apiPath: '/api/legal/ai/contract-review',
        description: '上传劳动合同，AI 逐条审查风险',
        acceptTypes: ['.txt', '.pdf', '.docx', '.jpg', '.png'],
      },
      {
        id: 'overtime-calc', type: 'calculator', name: '加班费计算器', icon: '⏰',
        agent: 'hr', apiPath: '/api/hr/calc/overtime',
        localScript: 'calc_hr_overtime',
        description: '工作日/周末/法定假日加班费精确计算（1.5x/2x/3x）',
        fields: [
          { key: 'monthly_salary', label: '月工资（元）', type: 'currency', required: true },
          { key: 'hours', label: '加班小时数', type: 'number', required: true },
          { key: 'overtime_type', label: '加班类型', type: 'select', required: true,
            options: [
              { value: 'weekday', label: '工作日延长（1.5倍）' },
              { value: 'weekend', label: '休息日（2倍）' },
              { value: 'holiday', label: '法定节假日（3倍）' },
            ] },
        ],
      },
      {
        id: 'annual-leave', type: 'calculator', name: '年假天数计算', icon: '🏖️',
        agent: 'hr', apiPath: '/api/hr/calc/annual-leave',
        localScript: 'calc_hr_annual_leave',
        description: '根据累计工龄计算法定年休假天数',
        fields: [
          { key: 'years', label: '累计工作年限', type: 'number', required: true },
        ],
      },
      {
        id: 'probation-salary', type: 'calculator', name: '试用期工资下限', icon: '📊',
        agent: 'hr', apiPath: '/api/hr/calc/probation-salary',
        description: '试用期工资不得低于约定工资的80%（劳动合同法第20条）',
        fields: [
          { key: 'monthly_salary', label: '约定月工资（元）', type: 'currency', required: true },
        ],
      },
      {
        id: 'dispatch-ratio', type: 'calculator', name: '派遣比例合规检测', icon: '📊',
        agent: 'hr', apiPath: '/api/hr/calc/dispatch-ratio',
        description: '检测劳务派遣用工比例是否超过 10% 法定上限（劳务派遣暂行规定第 4 条）',
        fields: [
          { key: 'total_employees', label: '用工总量（含直雇+派遣+外包）', type: 'number', required: true },
          { key: 'dispatched_count', label: '被派遣劳动者数量', type: 'number', required: true },
        ],
      },
    ],
    slashCommands: [
      { cmd: '/计算', label: '赔偿计算', icon: '💰', toolId: 'labor-compensation' },
      { cmd: '/审查', label: '合同审查', icon: '📋', toolId: 'contract-review' },
      { cmd: '/个税', label: '个税计算', icon: '🧾', toolId: 'salary-tax' },
      { cmd: '/诉讼费', label: '诉讼费计算', icon: '⚖️', toolId: 'litigation-fee' },
      { cmd: '/加班费', label: '加班费计算', icon: '⏰', toolId: 'overtime-calc' },
      { cmd: '/年假', label: '年假天数', icon: '🏖️', toolId: 'annual-leave' },
      { cmd: '/派遣比例', label: '派遣比例检测', icon: '📊', toolId: 'dispatch-ratio' },
      { cmd: '/入职', label: '入职派遣流程', icon: '📋', description: '启动入职全流程' },
      { cmd: '/纠纷', label: '劳动纠纷处理', icon: '⚖️', description: '启动纠纷处理流程' },
    ],
    workflows: [
      {
        id: 'onboarding', name: '入职派遣流程', icon: '📋',
        description: '确保新派遣工合法合规上岗，用工风险可控、薪税方案最优',
        mode: 'sequential',
        deliverable: '入职派遣综合报告（含合规结论、合同审查结果、薪税方案）',
        successCriteria: [
          '明确用工形式合法性结论（派遣 vs 外包 vs 直雇）',
          '劳动合同风险条款 ≤ 0 项高危',
          '薪税方案含具体金额和法规依据',
        ],
        steps: [
          { id: 'recruitment', agent: 'hr', expert: 'hr_consultant', label: '招聘与录用评估',
            goal: '确认用工形式合法性，输出岗位匹配度评估',
            successCriteria: ['明确派遣比例是否超标', '列出岗位三性（临时/辅助/替代）判定依据'],
            profitImpact: { dimension: 'loss_avoidance', amount: '确保派遣比例合规，避免罚款 10-50 万' } },
          { id: 'contract', agent: 'legal', expert: 'civil_lawyer', label: '劳动合同审查',
            goal: '识别合同中全部法律风险并给出修改文本',
            successCriteria: ['逐条标注风险等级（高/中/低）', '每条高风险给出替代条款文本', '引用劳动合同法具体条款号'],
            profitImpact: { dimension: 'loss_avoidance', amount: '消除合同风险条款，避免纠纷损失 5-30 万' } },
          { id: 'tax', agent: 'finance', expert: 'tax_consultant', label: '薪税方案核算',
            goal: '输出个税最优方案和社保成本明细',
            successCriteria: ['含工资、社保、公积金、个税各项金额', '对比至少 2 种薪酬结构方案的税后差异'],
            profitImpact: { dimension: 'cost_saving', amount: '优选薪酬结构，每人每月省税 200-500 元' } },
        ],
        triggerPhrases: ['新员工入职', '派遣入职', '入职流程'],
      },
      {
        id: 'dispute_resolution', name: '劳动纠纷处理', icon: '⚖️',
        description: '输出可执行的纠纷应对方案，含法律分析、赔偿金额和操作步骤',
        mode: 'sequential',
        deliverable: '劳动纠纷处理方案（含法律意见、补偿金额、行动清单）',
        successCriteria: [
          '法律分析引用 ≥ 3 条具体法规条款',
          '补偿金额给出精确计算过程（含公式和数字）',
          '行动清单含时间节点和责任人',
        ],
        steps: [
          { id: 'fact_finding', agent: 'legal', expert: 'civil_lawyer', label: '事实认定与法律分析',
            goal: '厘清法律关系，判定违法/违约性质，评估胜诉概率',
            successCriteria: ['明确劳动关系类型', '列出适用法条（条款号）', '给出胜诉概率区间'],
            profitImpact: { dimension: 'loss_avoidance', amount: '精准定性避免败诉，减少赔偿 1-10 万' } },
          { id: 'compensation', agent: 'finance', expert: 'tax_consultant', label: '补偿金额核算',
            goal: '精确计算各类补偿/赔偿金额',
            successCriteria: ['N/N+1/2N 各项金额逐项列出', '含社保补缴、年假折算等附带金额', '计算过程可验证'],
            profitImpact: { dimension: 'loss_avoidance', amount: '精确计算避免多赔，每案省 0.5-3 万' } },
          { id: 'strategy', agent: 'hr', expert: 'hr_consultant', label: '应对策略与预防',
            goal: '输出可直接执行的应对方案和长效预防机制',
            successCriteria: ['方案含谈判话术要点', '含时间线（仲裁/诉讼截止日期）', '提出 ≥ 2 项预防改进措施'],
            profitImpact: { dimension: 'cost_saving', amount: '预防机制减少未来纠纷，年省 5-15 万' } },
        ],
        triggerPhrases: ['劳动纠纷', '员工辞退', '劳动仲裁', 'N+1'],
      },
      {
        id: 'payroll_settlement', name: '月度薪资结算', icon: '💰',
        description: '输出薪资发放明细和合规确认，确保零差错发放',
        mode: 'sequential',
        deliverable: '月度薪资结算单（含各项明细、合规确认、异常提示）',
        successCriteria: [
          '每人薪资含基本工资/加班费/社保/公积金/个税各项',
          '标注异常项（如超时加班、基数偏低）',
          '合规确认引用最低工资标准和社保基数文件',
        ],
        steps: [
          { id: 'attendance', agent: 'hr', expert: 'hr_consultant', label: '考勤与工时汇总',
            goal: '输出全员考勤统计，标注加班和异常',
            successCriteria: ['加班工时分类（工作日/休息日/法定假）', '标注超 36 小时月加班上限的员工'],
            profitImpact: { dimension: 'cost_saving', amount: '自动汇总省 2 天人工，月省 3000 元' } },
          { id: 'payroll', agent: 'finance', expert: 'tax_consultant', label: '薪资与社保计算',
            goal: '精确计算每人应发/实发金额',
            successCriteria: ['含五险一金各项基数和金额', '个税累计预扣法计算正确', '总额与上月差异 ≤ 5% 或标注原因'],
            profitImpact: { dimension: 'cost_saving', amount: '零差错批量计算，月省核算人力 1.5 天' } },
          { id: 'compliance', agent: 'legal', expert: 'civil_lawyer', label: '用工合规检查',
            goal: '确认发放方案无法律风险',
            successCriteria: ['最低工资标准达标确认', '加班费计算基数合规', '社保缴纳比例符合当地规定'],
            profitImpact: { dimension: 'loss_avoidance', amount: '确保发放合规，避免劳动监察处罚 5-20 万' } },
        ],
        triggerPhrases: ['薪资结算', '发工资', '社保核算'],
      },
    ],
    scenarios: [
      { id: 'dismiss', label: '员工辞退方案', icon: '🚪', prompt: '公司想辞退一名员工，请分析合法的辞退方案和经济补偿', expectedOutcome: '含法律依据的辞退方案 + N/2N 精确金额 + 操作时间线', workflowId: 'dispute_resolution', profitImpact: { dimension: 'loss_avoidance', amount: '避免违法辞退赔偿 2-8 万' } },
      { id: 'contract_check', label: '新合同审查', icon: '📋', prompt: '审查这份劳动合同的风险点', expectedOutcome: '逐条风险标注（高/中/低）+ 每条修改建议文本 + 引用法条', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '避免合同漏洞损失 5-30 万' } },
      { id: 'overtime_risk', label: '加班费风险', icon: '⏰', prompt: '分析加班费计算方式和潜在法律风险', expectedOutcome: '加班费计算公式 + 三种加班倍率 + 超时加班法律后果', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '避免加班费追诉损失 1-5 万' } },
      { id: 'social_insurance', label: '社保合规', icon: '🏥', prompt: '检查社保缴纳基数和比例是否合规', expectedOutcome: '当地社保基数上下限 + 各险种费率 + 差异金额', expert: 'finance.tax_consultant', profitImpact: { dimension: 'loss_avoidance', amount: '避免社保基数违规补缴 3-10 万' } },
      { id: 'batch_onboard', label: '批量入职', icon: '👥', prompt: '20 名新员工同时入职的流程和注意事项', expectedOutcome: '批量入职检查清单 + 时间排期 + 常见风险点', workflowId: 'onboarding', profitImpact: { dimension: 'cost_saving', amount: '批量入职省时 80%，月省人力 5000 元' } },
    ],
  },
  {
    id: 'law-firm',
    name: '律所智能运营方案',
    icon: '⚖️',
    color: '#3366cc',
    tagline: '同样 5 个律师，年营收翻倍 — 人均创收提升 200%',
    description: '律师 60% 时间花在非创收事务上。MBE 释放这些时间——同样 5 个律师，一年多接 3 倍案件，人均创收翻倍。',
    entrepreneurPurpose: '释放律师 60% 非创收时间，让每个律师年创收翻倍',
    profitMetrics: ['合同审查 16h→2min，每月多接 5-8 案', '文书效率 10 倍提升', '省下一个财务 ≈ 年省 8-12 万'],
    valueEquivalent: { humanHours: 16, mbeMinutes: 2, acceleration: '480x' },
    agents: [
      agent('legal', 8003, '诉讼分析专家', '案例检索、判决预测、诉讼策略'),
      agent('legal', 8003, '合同审查专家', '合同条款审查、风险识别、修改建议'),
      agent('finance', 8002, '律所财务专家', '案件收费、律师提成、税务申报'),
    ],
    localScripts: ['calc_litigation_fee', 'calc_labor_compensation', 'calc_statute'],
    knowledgeCache: ['civil_law_basics', 'contract_law'],
    theme: { primary: '220 65% 50%', accent: '220 65% 50%', sidebarBg: '220 15% 7%' },
    enabledTabs: ['chat', 'tools', 'documents', 'tasks', 'workflows', 'dashboard'],
    tools: [
      { id: 'compensation', type: 'calculator', name: '赔偿计算器', icon: '💰',
        agent: 'legal', apiPath: '/api/legal/calc/compensation', localScript: 'calc_labor_compensation',
        fields: [
          { key: 'monthly_salary', label: '月工资（元）', type: 'currency', required: true },
          { key: 'work_years', label: '工作年限', type: 'number', required: true },
          { key: 'dismissal_type', label: '解除类型', type: 'select', required: true,
            options: [
              { value: 'N', label: 'N（协商/裁员）' },
              { value: 'N+1', label: 'N+1（未提前通知）' },
              { value: '2N', label: '2N（违法解除）' },
            ] },
        ],
      },
      { id: 'litigation-fee', type: 'calculator', name: '诉讼费计算器', icon: '⚖️',
        agent: 'legal', apiPath: '/api/legal/calc/litigation-fee', localScript: 'calc_litigation_fee',
        fields: [{ key: 'amount', label: '标的额（元）', type: 'currency', required: true }],
      },
      { id: 'statute-check', type: 'calculator', name: '诉讼时效查询', icon: '⏰',
        agent: 'legal', apiPath: '/api/legal/calc/statute', localScript: 'calc_statute',
        fields: [
          { key: 'case_type', label: '案件类型', type: 'select', required: true,
            options: [
              { value: 'general', label: '一般民事（3年）' },
              { value: 'labor', label: '劳动争议（1年）' },
              { value: 'injury', label: '人身损害（1年）' },
            ] },
          { key: 'start_date', label: '起算日期', type: 'date', required: true },
        ],
      },
      { id: 'contract-review', type: 'document-ai', name: '合同审查', icon: '📋',
        agent: 'legal', apiPath: '/api/legal/ai/contract-review',
        acceptTypes: ['.txt', '.pdf', '.docx', '.jpg', '.png'],
      },
      { id: 'doc-gen', type: 'doc-generator', name: '法律文书生成', icon: '📄',
        agent: 'legal', apiPath: '/api/legal/documents/generate',
        fields: [
          { key: 'type', label: '文书类型', type: 'select', required: true,
            options: [
              { value: 'complaint', label: '起诉状' },
              { value: 'defense', label: '答辩状' },
              { value: 'appeal', label: '上诉状' },
              { value: 'lawyer-letter', label: '律师函' },
            ] },
          { key: 'facts', label: '事实与理由', type: 'textarea', required: true },
        ],
      },
    ],
    slashCommands: [
      { cmd: '/计算', label: '赔偿计算', icon: '💰', toolId: 'compensation' },
      { cmd: '/审查', label: '合同审查', icon: '📋', toolId: 'contract-review' },
      { cmd: '/文书', label: '生成文书', icon: '📄', toolId: 'doc-gen' },
      { cmd: '/诉讼费', label: '诉讼费', icon: '⚖️', toolId: 'litigation-fee' },
      { cmd: '/时效', label: '时效查询', icon: '⏰', toolId: 'statute-check' },
      { cmd: '/案件', label: '案件管理流程', icon: '📂', description: '启动案件全流程' },
    ],
    workflows: [
      {
        id: 'case_management', name: '案件管理全流程', icon: '📂',
        description: '输出可直接执行的诉讼方案，含法律分析、证据清单、策略和费用预算',
        mode: 'sequential',
        deliverable: '案件分析报告（法律意见 + 证据清单 + 诉讼策略 + 费用预算）',
        successCriteria: [
          '法律关系定性明确，引用 ≥ 3 条法律条文',
          '证据清单标注每项证据的证明目的和效力等级',
          '诉讼策略含胜诉概率区间和风险预案',
          '费用预算含受理费、律师费、鉴定费等各项明细',
        ],
        steps: [
          { id: 'case_filing', agent: 'legal', expert: 'civil_lawyer', label: '案件立案与事实梳理',
            goal: '定性法律关系，明确诉讼请求',
            successCriteria: ['确定案由', '列出原被告主体信息', '明确管辖法院依据'],
            profitImpact: { dimension: 'revenue', amount: '快速立案缩短周期，每案多赚代理费 0.5-2 万' } },
          { id: 'evidence', agent: 'legal', expert: 'civil_lawyer', label: '证据分析与法律检索',
            goal: '构建完整证据链，检索支撑判例',
            successCriteria: ['每项证据标注证明目的', '标注证据缺口和补救方案', '检索 ≥ 2 个类似判例'],
            profitImpact: { dimension: 'loss_avoidance', amount: '完整证据链提高胜率，避免败诉损失 5-30 万' } },
          { id: 'strategy', agent: 'legal', expert: 'civil_lawyer', label: '诉讼策略制定',
            goal: '输出最优诉讼路径和备选方案',
            successCriteria: ['给出胜诉概率区间', '含调解/仲裁/诉讼三种路径对比', '标注关键时间节点'],
            profitImpact: { dimension: 'revenue', amount: '最优路径节省 30% 时间，年多接 10+ 案件' } },
          { id: 'budget', agent: 'finance', expert: 'finance_accountant', label: '诉讼费用预算',
            goal: '精确计算全部诉讼成本',
            successCriteria: ['受理费按标的额精确计算', '律师费标注计算方式', '含保全费/鉴定费等可能费用'],
            profitImpact: { dimension: 'cost_saving', amount: '精确预算避免垫资风险，每案省 0.5-3 万' } },
        ],
        triggerPhrases: ['新案件', '案件立案', '打官司'],
      },
      {
        id: 'contract_lifecycle', name: '合同全生命周期', icon: '📝',
        description: '输出可直接使用的合同文本，风险已排除、谈判要点已标注',
        mode: 'sequential',
        deliverable: '合同终稿（含风险批注 + 谈判备忘录）',
        successCriteria: [
          '合同要素完整（主体/标的/价款/履行/违约/争议解决）',
          '零高风险条款（或已给出替代文本）',
          '谈判要点含底线和让步空间',
        ],
        steps: [
          { id: 'draft', agent: 'legal', expert: 'civil_lawyer', label: '合同起草/模板选择',
            goal: '生成符合交易场景的合同框架',
            successCriteria: ['覆盖六大必备要素', '条款结构符合行业惯例'],
            profitImpact: { dimension: 'revenue', amount: '合同起草 4h→30min，月多接 8-10 单' } },
          { id: 'review', agent: 'legal', expert: 'civil_lawyer', label: '条款风险审查',
            goal: '识别并消除全部高风险条款',
            successCriteria: ['逐条标注风险等级', '每条高风险给出替代文本', '引用民法典条款号'],
            profitImpact: { dimension: 'loss_avoidance', amount: '零高风险条款通过，避免违约损失 10-50 万' } },
          { id: 'advice', agent: 'legal', expert: 'civil_lawyer', label: '签约建议与谈判要点',
            goal: '输出谈判策略和签约注意事项',
            successCriteria: ['标注可让步条款和底线条款', '含签约前检查清单'],
            profitImpact: { dimension: 'revenue', amount: '谈判策略精准，成交率提升 20%' } },
        ],
        triggerPhrases: ['起草合同', '合同审查', '签合同'],
      },
    ],
    scenarios: [
      { id: 'case_assess', label: '案件胜率评估', icon: '⚖️', prompt: '评估这个案件的胜诉概率和风险', expectedOutcome: '胜诉概率区间 + 关键风险点 + 证据强弱分析', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'revenue', amount: '精选高胜率案件，月增收 5-15 万' } },
      { id: 'demand_letter', label: '律师函起草', icon: '📄', prompt: '根据以下情况起草一份律师函', expectedOutcome: '可直接发送的律师函全文 + 法律依据', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'revenue', amount: '文书效率 10 倍提升，每月多接 3-5 份' } },
      { id: 'statute_check', label: '诉讼时效查询', icon: '⏰', prompt: '查询这个案件的诉讼时效', expectedOutcome: '适用时效年限 + 起算日期 + 剩余天数 + 中断/中止情形', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '避免超时效丧失诉权，挽回标的 5-50 万' } },
      { id: 'case_cost', label: '诉讼费估算', icon: '💰', prompt: '估算这个案件的全部诉讼成本', expectedOutcome: '受理费 + 律师费 + 鉴定费等各项明细金额', workflowId: 'case_management', profitImpact: { dimension: 'cost_saving', amount: '精准费用预算，避免超支 1-5 万' } },
    ],
  },
  {
    id: 'finance-tax-service',
    name: '财税专业服务方案',
    icon: '📊',
    color: '#00d4aa',
    tagline: '一个会计服务 100 家客户 — 代账公司人效翻 3 倍',
    description: '一个会计过去只能服务 30 家客户，AI 接手 80% 重复工作后能服务 100 家。同样 5 个会计，客户从 150 家做到 500 家。',
    entrepreneurPurpose: '同样团队服务 3 倍客户，净利润率从 15% 提到 40%',
    profitMetrics: ['人效 30 家→100 家客户/会计', '凭证 2h→3min', '税务筹划提高客单价'],
    valueEquivalent: { humanHours: 24, mbeMinutes: 3, acceleration: '480x' },
    agents: [
      agent('finance', 8002, '记账报税专家', '发票识别、凭证生成、纳税申报'),
      agent('finance', 8002, '审计分析专家', '审计底稿、报表分析、异常检测'),
      agent('finance', 8002, '税务筹划专家', '税务方案设计、优惠政策匹配、风险评估'),
      agent('legal', 8003, '合规审查专家', '会计准则校验、税务合规、法规更新'),
    ],
    localScripts: ['calc_iit', 'calc_vat'],
    knowledgeCache: ['tax_law_basics', 'accounting_standards'],
    theme: { primary: '164 100% 42%', accent: '164 100% 42%' },
    enabledTabs: ['chat', 'tools', 'documents', 'workflows', 'dashboard'],
    tools: [
      { id: 'iit', type: 'calculator', name: '个税计算器', icon: '🧾',
        agent: 'finance', apiPath: '/api/finance/calc/iit', localScript: 'calc_iit',
        fields: [
          { key: 'salary', label: '税前月薪（元）', type: 'currency', required: true },
          { key: 'insurance', label: '五险一金（元）', type: 'currency', default: 0 },
          { key: 'deduction', label: '专项附加扣除（元）', type: 'currency', default: 0 },
        ],
      },
      { id: 'vat', type: 'calculator', name: '增值税计算器', icon: '📊',
        agent: 'finance', apiPath: '/api/finance/calc/vat', localScript: 'calc_vat',
        fields: [
          { key: 'amount', label: '含税金额（元）', type: 'currency', required: true },
          { key: 'rate', label: '税率', type: 'select', required: true,
            options: [
              { value: '0.13', label: '13%' }, { value: '0.09', label: '9%' },
              { value: '0.06', label: '6%' }, { value: '0.03', label: '3%（小规模）' },
            ] },
        ],
      },
      { id: 'stamp-tax', type: 'calculator', name: '印花税计算器', icon: '📌',
        agent: 'finance', apiPath: '/api/finance/calc/stamp-tax',
        description: '合同/凭证印花税精确计算（11类合同税率速查）',
        fields: [
          { key: 'contract_type', label: '合同类型', type: 'select', required: true,
            options: [
              { value: 'purchase_sale', label: '买卖合同（0.03%）' },
              { value: 'processing', label: '加工承揽（0.05%）' },
              { value: 'construction', label: '建设工程（0.03%）' },
              { value: 'transport', label: '运输合同（0.03%）' },
              { value: 'technology', label: '技术合同（0.03%）' },
              { value: 'lease', label: '租赁合同（0.1%）' },
              { value: 'warehouse', label: '仓储保管（0.1%）' },
              { value: 'loan', label: '借款合同（0.005%）' },
              { value: 'property_insurance', label: '财产保险（0.1%）' },
              { value: 'property_transfer', label: '产权转移（0.05%）' },
              { value: 'business_book', label: '营业账簿（0.025%）' },
            ] },
          { key: 'amount', label: '合同金额（元）', type: 'currency', required: true },
        ],
      },
      { id: 'cit-quarterly', type: 'calculator', name: '企业所得税预缴', icon: '🏢',
        agent: 'finance', apiPath: '/api/finance/calc/cit-quarterly',
        description: '季度企业所得税预缴计算（含小微企业优惠）',
        fields: [
          { key: 'quarterly_profit', label: '季度利润总额（元）', type: 'currency', required: true },
          { key: 'is_small_profit', label: '是否小微企业', type: 'select', default: 'false',
            options: [
              { value: 'true', label: '是（年应纳税所得额≤300万）' },
              { value: 'false', label: '否' },
            ] },
        ],
      },
      {
        id: 'voucher-gen', type: 'document-ai', name: '智能凭证生成', icon: '📒',
        agent: 'finance', apiPath: '/api/finance/ai/voucher-generate',
        description: '上传发票/银行回单，AI 自动识别并生成记账凭证（含借贷科目和金额）',
        acceptTypes: ['.jpg', '.png', '.pdf', '.xlsx'],
      },
    ],
    slashCommands: [
      { cmd: '/个税', label: '个税计算', icon: '🧾', toolId: 'iit' },
      { cmd: '/增值税', label: '增值税计算', icon: '📊', toolId: 'vat' },
      { cmd: '/印花税', label: '印花税计算', icon: '📌', toolId: 'stamp-tax' },
      { cmd: '/企业所得税', label: '企业所得税预缴', icon: '🏢', toolId: 'cit-quarterly' },
      { cmd: '/凭证', label: '智能凭证生成', icon: '📒', toolId: 'voucher-gen' },
      { cmd: '/记账', label: '月度记账流程', icon: '📒', description: '启动月度记账全流程' },
    ],
    workflows: [
      {
        id: 'monthly_bookkeeping', name: '月度记账报税', icon: '📒',
        description: '确保月度账务准确完整、报表合规、按时申报',
        mode: 'sequential',
        deliverable: '月度财务报表 + 纳税申报确认单',
        successCriteria: [
          '凭证与发票一一对应，无遗漏',
          '资产负债表平衡（借贷差 = 0）',
          '纳税申报数据与账务一致',
        ],
        steps: [
          { id: 'invoice', agent: 'finance', expert: 'finance_accountant', label: '发票归集与核验',
            goal: '确认全部发票真实、合规、已入账', successCriteria: ['列出发票总数和金额汇总', '标注异常发票（抬头/税号/金额不符）'],
            profitImpact: { dimension: 'loss_avoidance', amount: '拦截异常发票，避免税务风险 5-50 万' } },
          { id: 'voucher', agent: 'finance', expert: 'finance_accountant', label: '记账凭证生成',
            goal: '生成完整准确的会计凭证', successCriteria: ['每笔凭证含借贷科目和金额', '引用会计准则条款'],
            profitImpact: { dimension: 'cost_saving', amount: '凭证生成 2h→3min，月省会计人力 3 天' } },
          { id: 'report', agent: 'finance', expert: 'finance_accountant', label: '财务报表编制',
            goal: '编制三张主要报表并校验勾稽', successCriteria: ['资产=负债+所有者权益', '利润表与现金流量表交叉验证'],
            profitImpact: { dimension: 'cost_saving', amount: '报表自动编制，月省编表时间 2 天' } },
          { id: 'tax_filing', agent: 'finance', expert: 'tax_consultant', label: '纳税申报',
            goal: '确定各税种申报金额和截止日期', successCriteria: ['增值税/企业所得税/附加税各项金额明确', '标注申报截止日和注意事项'],
            profitImpact: { dimension: 'loss_avoidance', amount: '按时准确申报，避免滞纳金和罚款' } },
        ],
        triggerPhrases: ['月度记账', '记账报税', '月末结账'],
      },
      {
        id: 'tax_planning', name: '税务筹划方案', icon: '💡',
        description: '在合法合规前提下降低企业综合税负',
        mode: 'sequential',
        deliverable: '税务筹划方案书（现状 + 风险 + 方案 + 合规确认）',
        successCriteria: [
          '方案预计节税金额有精确测算',
          '每项筹划措施引用税法依据',
          '合规性经法律专家确认',
        ],
        steps: [
          { id: 'diagnosis', agent: 'finance', expert: 'tax_consultant', label: '税务现状诊断',
            goal: '摸清当前税负结构和优化空间', successCriteria: ['列出各税种实际税负率', '对标行业平均税负率'],
            profitImpact: { dimension: 'cost_saving', amount: '发现节税空间 3-15 万/年' } },
          { id: 'risk', agent: 'finance', expert: 'tax_consultant', label: '税务风险评估',
            goal: '识别现有税务操作中的风险点', successCriteria: ['逐项标注风险等级和金额影响', '含近三年税务稽查关注点'],
            profitImpact: { dimension: 'loss_avoidance', amount: '识别风险点避免稽查处罚 10-100 万' } },
          { id: 'plan', agent: 'finance', expert: 'tax_consultant', label: '筹划方案设计',
            goal: '输出 ≥ 2 套可行筹划方案并对比', successCriteria: ['每套方案含实施步骤和预期节税金额', '对比实施成本和风险'],
            profitImpact: { dimension: 'cost_saving', amount: '节税方案落地后年省 5-30 万' } },
          { id: 'compliance', agent: 'legal', expert: 'civil_lawyer', label: '合规性检查',
            goal: '确认筹划方案不触碰法律红线', successCriteria: ['逐方案给出合规/存疑/违规结论', '引用税法和刑法相关条款'],
            profitImpact: { dimension: 'loss_avoidance', amount: '合规把关避免偷逃税刑事风险' } },
        ],
        triggerPhrases: ['税务筹划', '节税方案', '合理避税'],
      },
    ],
    scenarios: [
      { id: 'invoice_check', label: '发票合规检查', icon: '🧾', prompt: '检查这批发票是否合规', expectedOutcome: '逐张发票合规/异常判定 + 异常原因 + 处理建议', expert: 'finance.finance_accountant', profitImpact: { dimension: 'loss_avoidance', amount: '避免虚开发票风险，防止稽查处罚 5-50 万' } },
      { id: 'tax_calc', label: '企业税负测算', icon: '📊', prompt: '测算当前企业整体税负率', expectedOutcome: '各税种税负率 + 综合税负率 + 行业对标', expert: 'finance.tax_consultant', profitImpact: { dimension: 'cost_saving', amount: '发现节税空间，年省 3-30 万' } },
      { id: 'annual_audit', label: '年审准备', icon: '📋', prompt: '准备年度审计需要的材料清单和注意事项', expectedOutcome: '完整材料清单（含科目余额表/银行对账单等）+ 常见问题预警', expert: 'finance.finance_accountant', profitImpact: { dimension: 'loss_avoidance', amount: '避免审计问题导致处罚，防损 5-20 万' } },
    ],
  },
  {
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
    enabledTabs: ['chat', 'tools', 'workflows', 'dashboard'],
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
    scenarios: [
      { id: 'quota_lookup', label: '定额查询', icon: '📖', prompt: '查询这项施工内容的定额子目和单价', expectedOutcome: '定额编号 + 子目名称 + 含量 + 基价', expert: 'cost.cost_engineer', profitImpact: { dimension: 'cost_saving', amount: '定额查询 2h→10s，每项目省 40+ 小时' } },
      { id: 'change_order', label: '变更签证', icon: '📝', prompt: '分析这份变更签证的造价影响', expectedOutcome: '变更金额（增/减）+ 计算依据 + 合同条款引用', expert: 'cost.cost_engineer', profitImpact: { dimension: 'revenue', amount: '审核更准确，单项多收审核费 1-3 万' } },
    ],
  },
  {
    id: 'clinic-respiratory',
    name: '呼吸专科经营方案',
    icon: '🫁',
    color: '#0d9488',
    tagline: '门诊效率翻倍，误诊风险降到最低，医保结算零差错',
    description: '呼吸科主任面临双重压力：临床质量要高、科室经营要好。AI 让医生看诊效率翻倍，标准化诊疗降低误诊赔偿风险。',
    entrepreneurPurpose: '提升日门诊量和床位周转率，降低误诊赔偿风险，确保医保结算零差错',
    profitMetrics: ['看诊效率 2 倍提升，日门诊量翻倍', '标准化诊疗降低误诊赔偿', '医保拒付率降低 50%+'],
    valueEquivalent: { humanHours: 8, mbeMinutes: 2, acceleration: '240x' },
    agents: [
      agent('pulmonary', 8005, '呼吸科诊疗专家', '临床评分、诊断分析、治疗方案'),
      agent('pulmonary', 8005, '肺功能解读专家', 'PFT 报告解读、通气功能评估'),
      agent('pulmonary', 8005, '重症监护专家', '呼吸机参数、SOFA 评分、预后评估'),
    ],
    localScripts: ['calc_clinical_score', 'calc_pft', 'calc_ventilator'],
    knowledgeCache: ['copd_guidelines', 'pneumonia_guidelines'],
    theme: { primary: '168 82% 32%', accent: '168 82% 32%' },
    enabledTabs: ['chat', 'tools', 'workflows', 'dashboard'],
    tools: [
      { id: 'clinical-score', type: 'calculator', name: '临床评分', icon: '🩺',
        agent: 'pulmonary', apiPath: '/api/pulmonary/calc/score', localScript: 'calc_clinical_score',
        fields: [
          { key: 'score_type', label: '评分量表', type: 'select', required: true,
            options: [
              { value: 'CURB65', label: 'CURB-65（肺炎严重度）' },
              { value: 'CAT', label: 'CAT（COPD评估）' },
              { value: 'mMRC', label: 'mMRC（呼吸困难）' },
              { value: 'SOFA', label: 'SOFA（器官衰竭）' },
            ] },
        ],
      },
      { id: 'pft', type: 'calculator', name: '肺功能解读', icon: '🫁',
        agent: 'pulmonary', apiPath: '/api/pulmonary/calc/pft', localScript: 'calc_pft',
        fields: [
          { key: 'fev1', label: 'FEV1（L）', type: 'number', required: true },
          { key: 'fvc', label: 'FVC（L）', type: 'number', required: true },
          { key: 'fev1_pred', label: 'FEV1 预计值%', type: 'number', required: true },
        ],
      },
      { id: 'ventilator', type: 'calculator', name: '呼吸机参数', icon: '💨',
        agent: 'pulmonary', apiPath: '/api/pulmonary/calc/ventilator', localScript: 'calc_ventilator',
        fields: [
          { key: 'weight', label: '理想体重（kg）', type: 'number', required: true },
          { key: 'mode', label: '通气模式', type: 'select', required: true,
            options: [
              { value: 'VC-AC', label: 'VC-AC' }, { value: 'PC-AC', label: 'PC-AC' },
              { value: 'PSV', label: 'PSV' },
            ] },
        ],
      },
    ],
    slashCommands: [
      { cmd: '/评分', label: '临床评分', icon: '🩺', toolId: 'clinical-score' },
      { cmd: '/肺功能', label: '肺功能解读', icon: '🫁', toolId: 'pft' },
      { cmd: '/呼吸机', label: '呼吸机参数', icon: '💨', toolId: 'ventilator' },
      { cmd: '/COPD', label: 'COPD 管理', icon: '🫁', description: '启动 COPD 综合管理流程' },
      { cmd: '/肺炎', label: '肺炎分诊', icon: '🩺', description: '启动肺炎分诊处置流程' },
    ],
    workflows: [
      {
        id: 'copd_management', name: 'COPD 综合管理', icon: '🫁',
        description: '从评分到治疗方案到用药审查的完整 COPD 管理流程',
        mode: 'sequential',
        deliverable: 'COPD 管理报告（GOLD 分级 + 治疗方案 + 用药审查 + 随访计划）',
        successCriteria: [
          'GOLD 分级有 CAT/mMRC 评分支撑',
          '治疗方案引用 GOLD 指南证据级别',
          '用药方案无禁忌和相互作用',
        ],
        steps: [
          { id: 'assess', agent: 'pulmonary', expert: 'pulmonary_physician', label: '综合评估与 GOLD 分级',
            goal: '完成 COPD 严重度分级和急性加重风险评估',
            successCriteria: ['CAT/mMRC 评分完成', 'GOLD 分级（A/B/E）明确', '急性加重史记录'],
            profitImpact: { dimension: 'revenue', amount: '标准化评估提升门诊效率，日多看 5-8 患者' } },
          { id: 'treatment', agent: 'pulmonary', expert: 'pulmonary_physician', label: '阶梯治疗方案',
            goal: '输出个体化治疗方案（含升降级策略）',
            successCriteria: ['初始用药方案含药名/剂量/频次', '引用 GOLD 证据级别', '含升降级触发条件'],
            profitImpact: { dimension: 'loss_avoidance', amount: '循证方案降低医疗纠纷风险 10-30 万' } },
          { id: 'drug_check', agent: 'pulmonary', expert: 'pulmonary_physician', label: '用药安全审查',
            goal: '排除药物禁忌和相互作用',
            successCriteria: ['与合并用药无相互作用', '无过敏/禁忌', '吸入装置选择适合患者'],
            profitImpact: { dimension: 'loss_avoidance', amount: '避免用药不良事件，防止赔偿 5-20 万' } },
        ],
        triggerPhrases: ['COPD', '慢阻肺', '慢性阻塞性肺疾病'],
      },
      {
        id: 'pneumonia_triage', name: '肺炎分诊处置', icon: '🩺',
        description: '快速评估肺炎严重度并输出标准化诊疗方案',
        mode: 'sequential',
        deliverable: '肺炎诊疗方案（严重度评分 + 收治决策 + 经验性抗感染方案）',
        successCriteria: [
          'CURB-65 评分完成且分级正确',
          '收治决策（门诊/住院/ICU）有评分依据',
          '抗生素方案引用指南推荐级别',
        ],
        steps: [
          { id: 'score', agent: 'pulmonary', expert: 'pulmonary_physician', label: 'CURB-65 评分与分诊',
            goal: '快速评估肺炎严重度并做收治决策',
            successCriteria: ['五项指标逐项评分', '总分对应严重度分级', '明确门诊/住院/ICU 建议'],
            profitImpact: { dimension: 'revenue', amount: '精准分诊优化床位周转，月增收 5-10 万' } },
          { id: 'diagnosis', agent: 'pulmonary', expert: 'pulmonary_physician', label: '病原学分析与诊断',
            goal: '初步判定病原类型并指导检查',
            successCriteria: ['区分 CAP/HAP/VAP', '推荐必要的病原学检查', '标注病毒性肺炎鉴别要点'],
            profitImpact: { dimension: 'loss_avoidance', amount: '鉴别诊断降低误诊率，避免赔偿 10-30 万' } },
          { id: 'treatment', agent: 'pulmonary', expert: 'pulmonary_physician', label: '经验性抗感染方案',
            goal: '输出初始抗生素方案（含降阶梯策略）',
            successCriteria: ['抗生素含药名/剂量/疗程', '引用指南证据级别', '含 48-72h 评估和降阶梯时机'],
            profitImpact: { dimension: 'loss_avoidance', amount: '规范用药减少医保拒付 50%+' } },
        ],
        triggerPhrases: ['肺炎', '社区获得性肺炎', 'CAP'],
      },
    ],
    scenarios: [
      { id: 'copd_assess', label: 'COPD 评估', icon: '🫁', prompt: '对这位患者进行 COPD 综合评估（GOLD 分级）', expectedOutcome: 'GOLD 分级（A/B/C/D）+ CAT/mMRC 评分 + 治疗方案推荐（含证据级别）', expert: 'pulmonary.pulmonary_physician', profitImpact: { dimension: 'revenue', amount: '精准分诊提升门诊量，日增收 3000-5000 元' } },
      { id: 'pneumonia', label: '肺炎严重度', icon: '🩺', prompt: '评估这位肺炎患者的严重程度（CURB-65）', expectedOutcome: 'CURB-65 评分 + 严重度分级 + 住院/门诊建议 + 经验性抗生素方案', expert: 'pulmonary.pulmonary_physician', profitImpact: { dimension: 'loss_avoidance', amount: '标准化诊疗降低误诊赔偿风险 10-30 万' } },
      { id: 'pft_interpret', label: '肺功能解读', icon: '📊', prompt: '解读这份肺功能检查报告', expectedOutcome: '通气功能分级 + 阻塞/限制性判断 + 支气管舒张试验结论 + 临床意义', expert: 'pulmonary.pulmonary_physician', profitImpact: { dimension: 'revenue', amount: 'PFT 解读 15min→30s，检查量翻倍增收' } },
      { id: 'drug_interaction', label: '用药审查', icon: '💊', prompt: '检查这位患者的用药方案有无禁忌或相互作用', expectedOutcome: '药物相互作用清单 + 禁忌提示 + 替代方案建议', expert: 'pulmonary.pulmonary_physician', profitImpact: { dimension: 'loss_avoidance', amount: '拦截用药风险，避免不良事件赔偿 5-20 万' } },
    ],
  },
  {
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
    enabledTabs: ['chat', 'tools', 'workflows', 'dashboard'],
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
  },
  {
    id: 'study-abroad-consulting',
    name: '留学咨询智能运营方案',
    icon: '✈️',
    color: '#06b6d4',
    tagline: '一个顾问服务 50 个学生 — 留学机构人效翻 5 倍',
    description: '一个顾问过去只能跟 10 个学生，AI 接手选校匹配、备考方案后能跟 50 个，签约转化率还更高。',
    entrepreneurPurpose: '同样 5 个顾问，签约学生从 200 人增到 1000 人，利润翻 5 倍',
    profitMetrics: ['选校方案 3 天→30 分钟', '顾问人效翻 5 倍', '签约转化率 30%→50%'],
    valueEquivalent: { humanHours: 8, mbeMinutes: 3, acceleration: '160x' },
    agents: [
      agent('education', 8006, '留学规划顾问', '选校匹配、申请规划、考试备考、签证指导、心理测评'),
      agent('finance', 8002, '留学费用顾问', '留学费用预算、资金规划、税务影响分析'),
    ],
    localScripts: [],
    knowledgeCache: ['study_abroad_rules'],
    theme: { primary: '187 86% 53%', accent: '187 86% 53%' },
    enabledTabs: ['chat', 'tools', 'workflows'],
    tools: [
      {
        id: 'study-cost', type: 'calculator', name: '留学费用估算', icon: '💰',
        agent: 'education', apiPath: '/api/education/calc/study-cost',
        description: '按国家/城市/学校类型精确估算留学年度总费用',
        fields: [
          { key: 'country', label: '留学国家', type: 'select', required: true,
            options: [
              { value: 'us', label: '美国' }, { value: 'uk', label: '英国' },
              { value: 'au', label: '澳大利亚' }, { value: 'ca', label: '加拿大' },
              { value: 'hk', label: '中国香港' }, { value: 'sg', label: '新加坡' },
              { value: 'jp', label: '日本' }, { value: 'eu', label: '欧洲（其他）' },
            ] },
          { key: 'degree', label: '学位类型', type: 'select', required: true,
            options: [
              { value: 'bachelor', label: '本科' }, { value: 'master', label: '硕士' },
              { value: 'phd', label: '博士' },
            ] },
          { key: 'city_tier', label: '城市级别', type: 'select', default: 'tier1',
            options: [
              { value: 'tier1', label: '一线城市（纽约/伦敦/悉尼）' },
              { value: 'tier2', label: '二线城市' },
            ] },
        ],
      },
      {
        id: 'score-convert', type: 'calculator', name: '考试分数换算', icon: '🔄',
        agent: 'education', apiPath: '/api/education/calc/score-convert',
        description: 'TOEFL / IELTS / DET / PTE 四向分数互转',
        fields: [
          { key: 'exam_type', label: '当前考试', type: 'select', required: true,
            options: [
              { value: 'ielts', label: 'IELTS 雅思' }, { value: 'toefl', label: 'TOEFL 托福' },
              { value: 'det', label: 'DET 多邻国' }, { value: 'pte', label: 'PTE 学术' },
            ] },
          { key: 'score', label: '当前分数', type: 'number', required: true },
        ],
      },
      {
        id: 'prep-timeline', type: 'calculator', name: '备考时间规划', icon: '📅',
        agent: 'education', apiPath: '/api/education/calc/prep-timeline',
        description: '基于当前水平和目标分数估算备考周期和学习计划',
        fields: [
          { key: 'exam', label: '目标考试', type: 'select', required: true,
            options: [
              { value: 'ielts', label: 'IELTS 雅思' }, { value: 'toefl', label: 'TOEFL 托福' },
              { value: 'gre', label: 'GRE' }, { value: 'gmat', label: 'GMAT' },
            ] },
          { key: 'current_score', label: '当前水平（分数或等级）', type: 'text', required: true },
          { key: 'target_score', label: '目标分数', type: 'number', required: true },
          { key: 'hours_per_week', label: '每周可用学习时间（小时）', type: 'number', default: 15 },
        ],
      },
    ],
    slashCommands: [
      { cmd: '/费用', label: '留学费用', icon: '💰', toolId: 'study-cost' },
      { cmd: '/换算', label: '分数换算', icon: '🔄', toolId: 'score-convert' },
      { cmd: '/备考', label: '备考规划', icon: '📅', toolId: 'prep-timeline' },
    ],
    workflows: [
      {
        id: 'school_matching', name: '智能选校', icon: '🏫',
        description: '根据 GPA、语言成绩、专业偏好、预算等条件，AI 匹配冲/稳/保院校',
        mode: 'sequential',
        deliverable: '选校推荐清单（冲/稳/保各 2-3 所 + 录取概率 + 费用对比）',
        successCriteria: ['每所院校标注录取概率区间', '含学费和生活费对比', '覆盖 ≥ 3 个梯度'],
        steps: [
          { id: 'profile', agent: 'education', expert: 'education_tutor', label: '背景评估',
            goal: '评估学生学术和语言背景，确定选校范围',
            successCriteria: ['GPA 和标化成绩对标目标院校历年录取线', '标注竞争力强弱项'],
            profitImpact: { dimension: 'revenue', amount: '精准定位提高签约率，每个顾问月多签 3-5 单' } },
          { id: 'match', agent: 'education', expert: 'education_tutor', label: '院校匹配推荐',
            goal: '输出冲/稳/保各梯度院校推荐',
            successCriteria: ['每梯度 ≥ 2 所院校', '含专业排名和就业数据', '标注申请截止日期'],
            profitImpact: { dimension: 'revenue', amount: '选校方案 3 天→30 分钟，人效翻 5 倍' } },
        ],
        triggerPhrases: ['选校', '推荐学校', '院校匹配'],
      },
      {
        id: 'full_abroad_plan', name: '留学全方案（含费用）', icon: '📋',
        description: 'Education 做选校与申请策略 → Finance 做费用预算与资金规划',
        mode: 'sequential',
        deliverable: '留学全方案报告（选校 + 申请时间线 + 费用预算 + 资金规划）',
        successCriteria: ['院校推荐含录取概率', '时间线精确到月', '费用预算覆盖学费/生活/签证/机票'],
        steps: [
          { id: 'plan', agent: 'education', expert: 'education_tutor', label: '选校与申请规划',
            goal: '输出完整的选校方案和申请时间线',
            successCriteria: ['覆盖选校/文书/推荐信/递交全流程', '标注关键截止日期'],
            profitImpact: { dimension: 'revenue', amount: '全流程规划提升客户满意度，转介绍率 +50%' } },
          { id: 'budget', agent: 'finance', expert: 'tax_consultant', label: '费用预算与资金规划',
            goal: '精确计算留学总费用并给出资金规划建议',
            successCriteria: ['学费+生活费+签证+机票逐项列出', '含汇率风险提示', '给出资金准备时间建议'],
            profitImpact: { dimension: 'loss_avoidance', amount: '精准预算避免退费纠纷，每单省 1-5 万' } },
        ],
        triggerPhrases: ['留学方案', '全方案', '留学规划含费用'],
      },
    ],
    scenarios: [
      { id: 'school_match', label: '智能选校', icon: '🏫', prompt: '根据我的 GPA 和成绩推荐留学院校', expectedOutcome: '冲/稳/保各 2-3 所院校推荐 + 录取概率 + 费用对比', expert: 'education.education_tutor', profitImpact: { dimension: 'revenue', amount: '方案更快更准，签约转化率从 30% 提到 50%' } },
      { id: 'exam_plan', label: '备考规划', icon: '📝', prompt: '制定雅思/托福备考计划', expectedOutcome: '目标分数 + 周计划 + 薄弱项训练 + 模考安排', expert: 'education.education_tutor', profitImpact: { dimension: 'revenue', amount: '备考方案效率提升，顾问人效翻 5 倍' } },
      { id: 'cost_estimate', label: '费用预算', icon: '💰', prompt: '估算留学一年总费用', expectedOutcome: '学费+生活费+签证+机票各项明细 + 资金规划', workflowId: 'full_abroad_plan', profitImpact: { dimension: 'loss_avoidance', amount: '精确费用预算，避免退费纠纷损失数万' } },
      { id: 'visa_guide', label: '签证指导', icon: '🛂', prompt: '指导签证申请流程和材料准备', expectedOutcome: '签证材料清单 + 面签准备 + 时间规划', expert: 'education.education_tutor', profitImpact: { dimension: 'loss_avoidance', amount: '避免签证被拒导致退费，每单省 1-3 万' } },
    ],
  },
  {
    id: 'education-training',
    name: '教培机构经营方案',
    icon: '🎓',
    color: '#6366f1',
    tagline: '招生转化率提升 30%，师资人效翻 3 倍，退费率降到 5% 以下',
    description: '校长最关心：招生成本、续费率、师资人效。AI 做个性化方案让学生满意→续费率高，AI 做学情报告让家长看到效果→转介绍多。',
    entrepreneurPurpose: '降低获客成本、提高续费率和转介绍率、师资人效翻 3 倍',
    profitMetrics: ['续费率 60%→80%', '转介绍率提升 50%', '师资人效 20→60 学生/师'],
    valueEquivalent: { humanHours: 8, mbeMinutes: 3, acceleration: '160x' },
    agents: [
      agent('education', 8006, '升学规划专家', '留学选校、申请策略、时间规划'),
      agent('education', 8006, '学科辅导专家', '考试备考、学情分析、个性化方案'),
      agent('finance', 8002, '教务财务专家', '学费核算、退费政策、收支对账'),
    ],
    localScripts: [],
    knowledgeCache: [],
    theme: { primary: '239 84% 67%', accent: '239 84% 67%' },
    enabledTabs: ['chat', 'tools', 'workflows', 'dashboard'],
    tools: [
      {
        id: 'tuition-refund', type: 'calculator', name: '退费计算器', icon: '💸',
        agent: 'finance', apiPath: '/api/finance/calc/tuition-refund',
        description: '按合同规则精确计算退费金额（已消耗课时 + 违约金 + 应退款）',
        fields: [
          { key: 'total_fee', label: '合同总学费（元）', type: 'currency', required: true },
          { key: 'total_hours', label: '合同总课时', type: 'number', required: true },
          { key: 'consumed_hours', label: '已消耗课时', type: 'number', required: true },
          { key: 'penalty_rate', label: '违约金比例（%）', type: 'number', default: 10 },
        ],
      },
      {
        id: 'score-convert', type: 'calculator', name: '考试分数换算', icon: '🔄',
        agent: 'education', apiPath: '/api/education/calc/score-convert',
        description: 'TOEFL / IELTS / DET / PTE 四向分数互转',
        fields: [
          { key: 'exam_type', label: '当前考试', type: 'select', required: true,
            options: [
              { value: 'ielts', label: 'IELTS 雅思' }, { value: 'toefl', label: 'TOEFL 托福' },
              { value: 'det', label: 'DET 多邻国' }, { value: 'pte', label: 'PTE 学术' },
            ] },
          { key: 'score', label: '分数', type: 'number', required: true },
        ],
      },
      {
        id: 'course-pricing', type: 'calculator', name: '课程定价分析', icon: '💰',
        agent: 'finance', apiPath: '/api/finance/calc/course-pricing',
        description: '基于成本 + 竞品 + 目标利润率的课程定价建议',
        fields: [
          { key: 'teacher_cost', label: '教师时薪（元）', type: 'currency', required: true },
          { key: 'total_hours', label: '课程总课时', type: 'number', required: true },
          { key: 'class_size', label: '班级人数', type: 'number', required: true },
          { key: 'target_margin', label: '目标利润率（%）', type: 'number', default: 40 },
        ],
      },
    ],
    slashCommands: [
      { cmd: '/退费', label: '退费计算', icon: '💸', toolId: 'tuition-refund' },
      { cmd: '/换算', label: '分数换算', icon: '🔄', toolId: 'score-convert' },
      { cmd: '/定价', label: '课程定价', icon: '💰', toolId: 'course-pricing' },
      { cmd: '/入学', label: '新生入学', icon: '📋', description: '启动入学评估全流程' },
      { cmd: '/续费', label: '续费策略', icon: '🔄', description: '生成续费提升方案' },
    ],
    workflows: [
      {
        id: 'student_onboarding', name: '新生入学评估', icon: '📋',
        description: '从入学测评到个性化方案到学费核算的全流程，确保学生匹配最优课程',
        mode: 'sequential',
        deliverable: '新生入学报告（入学测评 + 个性化学习方案 + 学费明细）',
        successCriteria: [
          '测评结果含各科能力评估和薄弱环节',
          '学习方案匹配学生当前水平和目标',
          '学费核算含课时单价、总费用和分期方案',
        ],
        steps: [
          { id: 'assess', agent: 'education', expert: 'education_tutor', label: '入学水平测评',
            goal: '评估学生当前学科水平和薄弱环节',
            successCriteria: ['各科目评分和等级', '薄弱环节具体到知识点', '与同龄学生水平对标'],
            profitImpact: { dimension: 'revenue', amount: '精准测评提升签约率 30%' } },
          { id: 'plan', agent: 'education', expert: 'education_tutor', label: '个性化学习方案',
            goal: '生成匹配学生水平的学习方案和课程推荐',
            successCriteria: ['课程推荐含课时和周期', '阶段性目标可量化', '对标目标考试/升学要求'],
            profitImpact: { dimension: 'revenue', amount: '个性化方案使客单价提升 20%' } },
          { id: 'fee', agent: 'finance', expert: 'finance_accountant', label: '学费核算与缴费方案',
            goal: '输出学费明细和分期方案',
            successCriteria: ['课时单价和总费用明确', '含分期方案和优惠政策', '退费条款说明清晰'],
            profitImpact: { dimension: 'revenue', amount: '分期方案降低签约门槛，转化率 +15%' } },
        ],
        triggerPhrases: ['新生入学', '入学测评', '报名流程'],
      },
      {
        id: 'renewal_analysis', name: '续费提升策略', icon: '🔄',
        description: '基于学情数据分析续费机会，输出家长沟通方案和续费优惠策略',
        mode: 'sequential',
        deliverable: '续费策略报告（学情分析 + 家长沟通话术 + 续费方案）',
        successCriteria: [
          '学情报告含进步数据和薄弱环节',
          '续费方案含多种套餐对比',
          '话术模板针对不同家长类型定制',
        ],
        steps: [
          { id: 'learning', agent: 'education', expert: 'education_tutor', label: '学情分析与进步报告',
            goal: '输出学生学习成果和下阶段目标',
            successCriteria: ['各科成绩趋势图', '已完成的学习目标', '下阶段提升空间'],
            profitImpact: { dimension: 'revenue', amount: '学情报告让家长看到效果，续费率 +20%' } },
          { id: 'renewal', agent: 'education', expert: 'education_tutor', label: '续费方案设计',
            goal: '设计有吸引力的续费课程组合',
            successCriteria: ['≥ 2 套课程方案对比', '含连报优惠和转介绍奖励', '匹配学生下阶段需求'],
            profitImpact: { dimension: 'revenue', amount: '课程组合提高客单价 25%' } },
          { id: 'accounting', agent: 'finance', expert: 'finance_accountant', label: '财务核算与优惠政策',
            goal: '确认续费方案的利润率和优惠力度',
            successCriteria: ['各方案利润率 ≥ 30%', '优惠力度不超预算', '含到期提醒排期'],
            profitImpact: { dimension: 'cost_saving', amount: '精确核算避免过度让利，每单多赚 500-2000 元' } },
        ],
        triggerPhrases: ['续费', '续报', '学情分析', '家长沟通'],
      },
    ],
    scenarios: [
      { id: 'study_plan', label: '留学规划', icon: '✈️', prompt: '根据我的情况制定留学申请规划', expectedOutcome: '院校推荐清单（含录取率）+ 时间线 + 材料检查清单', expert: 'education.education_tutor', profitImpact: { dimension: 'revenue', amount: '招生转化率提升 30%，年增收 30 万+' } },
      { id: 'exam_prep', label: '考试备考', icon: '📝', prompt: '制定雅思/托福备考计划', expectedOutcome: '目标分数 + 周计划 + 薄弱项针对训练 + 模考安排', expert: 'education.education_tutor', profitImpact: { dimension: 'revenue', amount: '师资人效翻 3 倍，续费率提升 20%' } },
      { id: 'learning_report', label: '学情诊断', icon: '📊', prompt: '分析这位学生的学习情况并生成学情报告', expectedOutcome: '各科能力评估 + 进步趋势 + 薄弱点 + 下阶段提升方案', expert: 'education.education_tutor', profitImpact: { dimension: 'revenue', amount: '学情报告驱动续费和转介绍，年增收 20 万+' } },
      { id: 'refund_calc', label: '退费计算', icon: '💸', prompt: '计算这位学生的退费金额', expectedOutcome: '已消耗金额 + 违约金 + 应退金额 + 退费政策依据', expert: 'finance.finance_accountant', profitImpact: { dimension: 'loss_avoidance', amount: '精确退费避免纠纷，每单省 2000-5000 元' } },
      { id: 'pricing_advice', label: '课程定价', icon: '💰', prompt: '分析这门课程的合理定价区间', expectedOutcome: '成本分析 + 竞品对标 + 定价建议 + 利润预测', expert: 'finance.finance_accountant', profitImpact: { dimension: 'revenue', amount: '科学定价提高毛利率 5-10 个百分点' } },
    ],
  },
  {
    id: 'ecommerce-brand-service',
    name: '品牌电商全价值链方案',
    icon: '🛒',
    color: '#e11d48',
    tagline: '5 人 TP 团队做出 20 人的产出，毛利率提升 20 个百分点',
    description: 'TP/代运营公司利润 = GMV × 佣金率 - 人力成本。AI 让 5 人团队做出 20 人产出，毛利率从 15% 做到 35%。',
    entrepreneurPurpose: '同样团队规模服务 4 倍品牌客户，毛利率从 15% 提到 35%',
    profitMetrics: ['客服人力成本降 60%', '内容生产效率 10 倍提升', '佣金结算零差错'],
    valueEquivalent: { humanHours: 160, mbeMinutes: 30, acceleration: '320x' },
    agents: [
      agent('cs', 8004, '电商客服专家', '多品牌BPO、工单SLA、话术库、消费者运营'),
      agent('growth', 8009, '增长营销专家', '大促策划、投放优化、私域运营、内容排期'),
      agent('sales', 8008, '品牌BD专家', '渠道拓展、竞品分析、客户成功'),
      agent('finance', 8002, '电商财务专家', '佣金核算、服务费结算、税务处理'),
      agent('legal', 8003, '合规审查专家', '消保合规、代运营合同、广告法审查'),
    ],
    localScripts: ['calc_iit', 'calc_vat'],
    knowledgeCache: [],
    theme: { primary: '347 77% 50%', accent: '347 77% 50%', sidebarBg: '347 15% 7%' },
    enabledTabs: ['chat', 'tools', 'workflows', 'dashboard'],
    tools: [
      { id: 'iit', type: 'calculator', name: '个税计算器', icon: '🧾',
        agent: 'finance', apiPath: '/api/finance/calc/iit', localScript: 'calc_iit',
        fields: [
          { key: 'salary', label: '税前月薪（元）', type: 'currency', required: true },
        ],
      },
      { id: 'sla-calc', type: 'calculator', name: 'SLA 达标计算', icon: '📊',
        agent: 'cs', apiPath: '/api/cs/calc/sla',
        description: '客服 SLA 达标率和响应时效计算',
        fields: [
          { key: 'sla_tier', label: 'SLA 等级', type: 'select', required: true,
            options: [
              { value: 'standard', label: '标准（首响60s/解决4h）' },
              { value: 'premium', label: '高级（首响30s/解决2h）' },
              { value: 'vip', label: 'VIP（首响15s/解决1h）' },
            ] },
          { key: 'total_tickets', label: '工单总量', type: 'number', required: true },
          { key: 'breached_tickets', label: '超时工单数', type: 'number', required: true },
        ],
      },
      { id: 'commission-calc', type: 'calculator', name: '佣金核算', icon: '💰',
        agent: 'finance', apiPath: '/api/finance/calc/commission',
        description: '品牌服务佣金和绩效提成计算',
        fields: [
          { key: 'gmv', label: '月度 GMV（元）', type: 'currency', required: true },
          { key: 'base_rate', label: '基础服务费率（%）', type: 'number', default: 3 },
          { key: 'performance_rate', label: '绩效佣金费率（%）', type: 'number', default: 1 },
        ],
      },
    ],
    slashCommands: [
      { cmd: '/个税', label: '个税计算', icon: '🧾', toolId: 'iit' },
      { cmd: '/SLA', label: 'SLA达标计算', icon: '📊', toolId: 'sla-calc' },
      { cmd: '/佣金', label: '佣金核算', icon: '💰', toolId: 'commission-calc' },
    ],
    workflows: [
      {
        id: 'campaign_operation', name: '大促运营全链路', icon: '🎯',
        description: '输出可执行的大促作战方案，从策划到结算全闭环',
        mode: 'sequential',
        deliverable: '大促作战手册（选品方案 + 投放计划 + 客服预案 + 结算明细）',
        successCriteria: ['选品含 ROI 预估和库存风险', '投放预算分配有数据依据', '客服话术覆盖 Top 10 问题', '结算金额可追溯'],
        steps: [
          { id: 'plan', agent: 'growth', expert: 'growth_consultant', label: '活动策划与选品',
            goal: '确定活动主题、选品和 GMV 目标', successCriteria: ['GMV 目标有往期数据支撑', '选品 ≥ 3 个梯度（引流/利润/形象款）'],
            profitImpact: { dimension: 'revenue', amount: '精选品+策划使大促 GMV 提升 30-50%' } },
          { id: 'content', agent: 'growth', expert: 'content_creator', label: '内容与投放执行',
            goal: '输出各渠道内容和预算分配方案', successCriteria: ['覆盖 ≥ 3 个渠道', '每渠道含 ROI 预估和素材数量'],
            profitImpact: { dimension: 'cost_saving', amount: '内容生产 10 倍提速，投放人力省 60%' } },
          { id: 'cs_ready', agent: 'cs', expert: 'cs_consultant', label: '客服备战与话术',
            goal: '确保客服团队能应对流量高峰', successCriteria: ['话术库覆盖促销规则/退换货/物流查询', '含排班方案和应急预案'],
            profitImpact: { dimension: 'loss_avoidance', amount: '大促零投诉，避免平台罚款 5-10 万' } },
          { id: 'settle', agent: 'finance', expert: 'finance_accountant', label: '活动复盘与结算',
            goal: '输出活动 ROI 和品牌结算明细', successCriteria: ['GMV/费用/利润逐项列出', '佣金计算可追溯到合同条款'],
            profitImpact: { dimension: 'cost_saving', amount: '零差错结算，避免佣金争议损失 2-5 万' } },
        ],
        triggerPhrases: ['大促', '618', '双十一', '活动运营'],
      },
      {
        id: 'monthly_settlement', name: '月度品牌服务结算', icon: '💰',
        description: '确保月度服务费核算准确、双方确认无争议',
        mode: 'sequential',
        deliverable: '月度结算对账单（含服务费明细 + 税务处理）',
        successCriteria: ['数据源与品牌方可交叉验证', '佣金计算引用合同费率条款', '税务处理符合增值税规定'],
        steps: [
          { id: 'cs_data', agent: 'cs', expert: 'cs_consultant', label: '客服数据汇总',
            goal: '输出客服工作量和质量指标', successCriteria: ['含工单量/响应时长/解决率等 KPI', '数据源可追溯'],
            profitImpact: { dimension: 'cost_saving', amount: '自动汇总省 1 天人工，月省 2000 元' } },
          { id: 'ops_data', agent: 'growth', expert: 'growth_consultant', label: '运营数据汇总',
            goal: '输出运营效果指标', successCriteria: ['含 GMV/流量/转化率/ROI', '按渠道拆分'],
            profitImpact: { dimension: 'revenue', amount: '数据驱动决策，运营效率提升 40%' } },
          { id: 'commission', agent: 'finance', expert: 'finance_accountant', label: '佣金与费用核算',
            goal: '精确计算服务费和佣金', successCriteria: ['费率引用合同条款', '含基础服务费 + 绩效佣金明细'],
            profitImpact: { dimension: 'loss_avoidance', amount: '佣金零差错，避免品牌方结算争议 2-10 万' } },
          { id: 'tax', agent: 'finance', expert: 'tax_consultant', label: '税务合规检查',
            goal: '确认发票开具和税务处理合规', successCriteria: ['发票税率正确', '进项抵扣合规'],
            profitImpact: { dimension: 'loss_avoidance', amount: '避免进项抵扣违规，防止补税 5-20 万' } },
        ],
        triggerPhrases: ['月度结算', '佣金核算', '服务费结算'],
      },
    ],
    scenarios: [
      { id: 'complaint', label: '客诉升级处理', icon: '🔥', prompt: '处理这个升级客诉，需要合规和赔偿方案', expectedOutcome: '处理方案 + 话术模板 + 赔偿金额 + 消保法引用', expert: 'cs.cs_consultant', profitImpact: { dimension: 'loss_avoidance', amount: '避免平台处罚 + 赔偿损失 5-20 万' } },
      { id: 'campaign_roi', label: '活动 ROI 分析', icon: '📊', prompt: '分析本次营销活动的投入产出比', expectedOutcome: 'ROI 计算过程 + 渠道对比 + 优化建议', expert: 'growth.growth_consultant', profitImpact: { dimension: 'revenue', amount: '精准投放优化 ROI 3:1，增收 100 万+' } },
      { id: 'brand_onboard', label: '新品牌入驻', icon: '🏪', prompt: '新品牌入驻的对接流程和注意事项', expectedOutcome: '入驻检查清单 + 时间排期 + 合同要点', workflowId: 'campaign_operation', profitImpact: { dimension: 'revenue', amount: '新品牌年佣金增收 20-50 万' } },
    ],
  },
  {
    id: 'insurance-operations',
    name: '保险公司智能运营方案',
    icon: '🛡️',
    color: '#0891b2',
    tagline: '综合成本率降 3 个点，续保率升 15%，团险签约快一倍',
    description: '总经理最关心三个数字：综合成本率、续保率、新单保费。MBE 七位 AI 专家直接作用于这三个数字。',
    entrepreneurPurpose: '降低综合成本率、提升续保率和新单保费，直接改善承保利润',
    profitMetrics: ['综合成本率降 3 个点', '续保率提升 15%', '团险签约周期缩短一半'],
    valueEquivalent: { humanHours: 8, mbeMinutes: 2, acceleration: '240x' },
    agents: [
      agent('insurance_cs', 8013, '理赔顾问', '报案受理、定损核赔、速赔通道、赔付跟进'),
      agent('insurance_cs', 8013, '车险专家', '交强险/商业险报案、国任速赔、续保报价'),
      agent('insurance_cs', 8013, '保单服务专员', '投保咨询、保单查询、退保计算、保单贷款'),
      agent('insurance_cs', 8013, '合规守卫', '话术审查、销售误导检测、反洗钱、银保监消保'),
      agent('legal', 8003, '保险法务专家', '理赔纠纷、保险合同审查、代位求偿、投诉处理'),
      agent('finance', 8002, '保费财税专家', '保费收入确认、准备金计提、佣金税务处理'),
      agent('sales', 8008, '团险销售顾问', 'B2B团险销售、渠道拓展、商务谈判'),
    ],
    localScripts: ['calc_iit', 'calc_vat', 'calc_litigation_fee'],
    knowledgeCache: ['insurance_product_rates'],
    theme: { primary: '192 91% 37%', accent: '192 91% 37%', sidebarBg: '192 15% 6%' },
    enabledTabs: ['chat', 'tools', 'workflows', 'dashboard'],
    tools: [
      { id: 'litigation-fee', type: 'calculator', name: '诉讼费计算器', icon: '⚖️',
        agent: 'legal', apiPath: '/api/legal/calc/litigation-fee', localScript: 'calc_litigation_fee',
        fields: [{ key: 'amount', label: '标的额（元）', type: 'currency', required: true }],
      },
      {
        id: 'claims-medical', type: 'calculator', name: '医疗理赔计算', icon: '🏥',
        agent: 'insurance_cs', apiPath: '/api/insurance_cs/consult/calculate/claims',
        description: '医疗险理赔金额计算（扣除免赔额和自费部分）',
        fields: [
          { key: 'total_medical', label: '医疗总费用（元）', type: 'currency', required: true },
          { key: 'self_pay', label: '自费部分（元）', type: 'currency', default: 0 },
          { key: 'deductible', label: '免赔额（元）', type: 'currency', default: 10000 },
          { key: 'reimburse_rate', label: '报销比例', type: 'select', default: '0.8',
            options: [
              { value: '1.0', label: '100%' }, { value: '0.9', label: '90%' },
              { value: '0.8', label: '80%' }, { value: '0.7', label: '70%' },
            ] },
        ],
      },
      {
        id: 'claims-disability', type: 'calculator', name: '伤残赔偿计算', icon: '♿',
        agent: 'insurance_cs', apiPath: '/api/insurance_cs/consult/calculate/claims',
        description: '意外伤残保险金计算（保额×伤残等级比例）',
        fields: [
          { key: 'insured_amount', label: '保险金额（元）', type: 'currency', required: true },
          { key: 'disability_level', label: '伤残等级', type: 'select', required: true,
            options: [
              { value: '1', label: '一级（100%）' }, { value: '2', label: '二级（90%）' },
              { value: '3', label: '三级（80%）' }, { value: '4', label: '四级（70%）' },
              { value: '5', label: '五级（60%）' }, { value: '6', label: '六级（50%）' },
              { value: '7', label: '七级（40%）' }, { value: '8', label: '八级（30%）' },
              { value: '9', label: '九级（20%）' }, { value: '10', label: '十级（10%）' },
            ] },
        ],
      },
      {
        id: 'claims-auto', type: 'calculator', name: '车险理赔计算', icon: '🚗',
        agent: 'insurance_cs', apiPath: '/api/insurance_cs/consult/calculate/claims',
        description: '交强险+商业险赔付额度计算',
        fields: [
          { key: 'loss_amount', label: '损失金额（元）', type: 'currency', required: true },
          { key: 'liability_ratio', label: '责任比例', type: 'select', required: true,
            options: [
              { value: '1.0', label: '全责（100%）' }, { value: '0.7', label: '主责（70%）' },
              { value: '0.5', label: '同等（50%）' }, { value: '0.3', label: '次责（30%）' },
            ] },
          { key: 'compulsory_limit', label: '交强险限额（元）', type: 'currency', default: 200000 },
        ],
      },
    ],
    slashCommands: [
      { cmd: '/诉讼费', label: '诉讼费', icon: '⚖️', toolId: 'litigation-fee' },
      { cmd: '/医疗理赔', label: '医疗理赔计算', icon: '🏥', toolId: 'claims-medical' },
      { cmd: '/车险', label: '车险理赔计算', icon: '🚗', toolId: 'claims-auto' },
      { cmd: '/伤残', label: '伤残赔偿计算', icon: '♿', toolId: 'claims-disability' },
    ],
    workflows: [
      {
        id: 'claim_process', name: '理赔处理全流程', icon: '📋',
        description: '确保理赔快速准确结案，赔付金额合理、流程合规',
        mode: 'sequential',
        deliverable: '理赔结案报告（含定损金额 + 赔付依据 + 合规确认）',
        successCriteria: ['定损金额有评估依据', '赔付条款引用保险合同具体条款', '全流程符合银保监合规要求'],
        steps: [
          { id: 'report', agent: 'insurance_cs', expert: 'cs_consultant', label: '报案受理与初审',
            goal: '确认出险事实和保险责任', successCriteria: ['确认保单有效性', '初步判定是否属于承保范围'],
            profitImpact: { dimension: 'cost_saving', amount: '自动初审提速 3 倍，每单省人力 30 分钟' } },
          { id: 'assess', agent: 'insurance_cs', expert: 'cs_consultant', label: '查勘定损',
            goal: '确定损失金额和赔付标准', successCriteria: ['损失金额有评估依据', '明确免赔额和赔付比例'],
            profitImpact: { dimension: 'loss_avoidance', amount: '定损准确避免多赔，每单省 0.5-2 万' } },
          { id: 'approve', agent: 'finance', expert: 'finance_accountant', label: '核赔审批',
            goal: '审核赔付金额的合理性', successCriteria: ['赔付金额不超保额', '计算过程可审计'],
            profitImpact: { dimension: 'loss_avoidance', amount: '精准核赔降低综合成本率 1-3 个点' } },
          { id: 'compliance', agent: 'legal', expert: 'civil_lawyer', label: '合规审查与结案',
            goal: '确保理赔全流程合规', successCriteria: ['符合保险法规定', '无拒赔/惜赔风险'],
            profitImpact: { dimension: 'loss_avoidance', amount: '避免银保监处罚和声誉损失 10-50 万' } },
        ],
        triggerPhrases: ['理赔', '报案', '出险'],
      },
      {
        id: 'renewal_management', name: '续保挽留流程', icon: '🔄',
        description: '到期保单自动预警→客户分析→个性化续保方案→保费核算→合规审查',
        mode: 'sequential',
        deliverable: '续保方案报告（客户画像 + 新旧方案对比 + 保费明细 + 话术模板）',
        successCriteria: [
          '到期保单提前 30 天触发流程',
          '续保方案含 ≥ 2 种险种组合对比',
          '保费变化说明清晰，客户可直接决策',
        ],
        steps: [
          { id: 'profile', agent: 'insurance_cs', expert: 'cs_consultant', label: '客户画像与出险分析',
            goal: '分析客户历史保单和出险记录，评估续保价值',
            successCriteria: ['历史保费和出险汇总', '客户价值评级（高/中/低）', '续保意愿预判'],
            profitImpact: { dimension: 'revenue', amount: '精准画像提升续保率 15%，多收保费 25-50 万' } },
          { id: 'plan', agent: 'insurance_cs', expert: 'cs_consultant', label: '个性化续保方案',
            goal: '设计适合客户需求变化的续保方案',
            successCriteria: ['新旧方案保障范围对比', '保费变化原因说明', '含加保/减保建议'],
            profitImpact: { dimension: 'revenue', amount: '个性化方案提高客单价 10-20%' } },
          { id: 'premium', agent: 'finance', expert: 'finance_accountant', label: '保费核算与佣金',
            goal: '计算续保保费和渠道佣金',
            successCriteria: ['各险种保费逐项列出', '佣金比例和金额明确', '含分期缴费方案'],
            profitImpact: { dimension: 'cost_saving', amount: '自动核算省财务人力，每单省 30 分钟' } },
          { id: 'compliance', agent: 'legal', expert: 'civil_lawyer', label: '续保合规审查',
            goal: '确保续保流程和话术合规',
            successCriteria: ['无销售误导风险', '条款变更说明符合银保监要求', '退保提示到位'],
            profitImpact: { dimension: 'loss_avoidance', amount: '避免销售误导处罚 10-100 万' } },
        ],
        triggerPhrases: ['续保', '到期保单', '保单续期'],
      },
      {
        id: 'group_insurance', name: '团险签约流程', icon: '👥',
        description: '从企业需求分析到方案设计、报价、合同审查的团险全流程',
        mode: 'sequential',
        deliverable: '团险方案书（需求分析 + 险种组合 + 报价明细 + 合同要点）',
        successCriteria: [
          '方案覆盖企业核心需求（雇主责任/团意/团医）',
          '报价含对标竞品的优势说明',
          '合同条款无不利于投保人的隐患',
        ],
        steps: [
          { id: 'needs', agent: 'sales', expert: 'sales_strategist', label: '企业需求分析',
            goal: '评估企业保障需求和预算',
            successCriteria: ['行业风险特征分析', '员工人数和年龄结构', '预算范围和决策流程'],
            profitImpact: { dimension: 'revenue', amount: '精准需求匹配提升签约率，团险增收 5-15 万/单' } },
          { id: 'design', agent: 'insurance_cs', expert: 'cs_consultant', label: '方案设计与定价',
            goal: '设计险种组合并初步报价',
            successCriteria: ['≥ 2 套方案对比（基础/增强）', '含各险种保障范围和保额', '费率说明透明'],
            profitImpact: { dimension: 'revenue', amount: '多方案对比提高客单价 20%' } },
          { id: 'quote', agent: 'finance', expert: 'finance_accountant', label: '保费精算与佣金测算',
            goal: '输出精确报价和佣金结构',
            successCriteria: ['保费逐险种列出', '含年缴/月缴方案', '佣金和利润率测算'],
            profitImpact: { dimension: 'revenue', amount: '快速精准报价，签约周期缩短一半' } },
          { id: 'contract', agent: 'legal', expert: 'civil_lawyer', label: '合同条款审查',
            goal: '审查保险合同和补充协议',
            successCriteria: ['免责条款逐条标注', '理赔时效和流程说明清晰', '无不合理限制'],
            profitImpact: { dimension: 'loss_avoidance', amount: '合同审查避免后续纠纷损失 10-50 万' } },
        ],
        triggerPhrases: ['团险', '团体保险', '企业保险'],
      },
    ],
    scenarios: [
      { id: 'claim_consult', label: '理赔咨询', icon: '📞', prompt: '咨询这个保险理赔的流程和注意事项', expectedOutcome: '理赔材料清单 + 时间预估 + 注意事项 + 拒赔风险提示', expert: 'insurance_cs.cs_consultant', profitImpact: { dimension: 'cost_saving', amount: '速赔通道省运营成本 500-2000 元/单' } },
      { id: 'policy_check', label: '保单查询', icon: '📄', prompt: '查询这份保单的保障范围和条款', expectedOutcome: '保障范围 + 免责条款 + 免赔额 + 理赔限额', expert: 'insurance_cs.cs_consultant', profitImpact: { dimension: 'cost_saving', amount: '自助查询减少人工坐席，月省 5000 元+' } },
      { id: 'renewal_quote', label: '续保方案', icon: '🔄', prompt: '为这位客户设计最优续保方案', expectedOutcome: '新旧方案对比 + 保费变化 + 保障差异 + 推荐理由', expert: 'insurance_cs.cs_consultant', profitImpact: { dimension: 'revenue', amount: '续保挽留率提升 15%，多收保费 25-50 万' } },
      { id: 'dispute_handle', label: '理赔纠纷', icon: '⚖️', prompt: '处理这个保险理赔纠纷，分析法律依据和应对方案', expectedOutcome: '纠纷性质判定 + 保险法条款引用 + 调解/诉讼建议', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '避免败诉赔偿 10-50 万' } },
      { id: 'group_quote', label: '团险报价', icon: '👥', prompt: '为这家企业设计团体保险方案并报价', expectedOutcome: '险种组合推荐 + 保费估算 + 服务方案 + 竞品对标', expert: 'sales.sales_consultant', profitImpact: { dimension: 'revenue', amount: '精选方案提高签约率，团险增收 5-15 万/单' } },
    ],
  },
  {
    id: 'investment-research',
    name: '投研机构智能方案',
    icon: '📈',
    color: '#d97706',
    tagline: '研究员产出翻 10 倍，从 α 研究到合规发布全链路提速',
    description: '投研竞争力 = 研究深度 × 覆盖广度 × 出报告速度。一个研究员过去一周出一篇深度研报，现在一天出三篇，每个结论可追溯到数据源。',
    entrepreneurPurpose: '研究员产能翻 10 倍，帮客户赚到 α → AUM 增长 → 管理费收入增长',
    profitMetrics: ['深度研报 1 周→1 天', '覆盖股票数翻 10 倍', '合规审查自动化，发布快 50%'],
    valueEquivalent: { humanHours: 320, mbeMinutes: 15, acceleration: '1280x' },
    agents: [
      agent('invest', 8011, '投资分析专家', '四柱研判、MISES评分、产业链追踪、WorldMonitor全球情报'),
      agent('finance', 8002, '财务审计专家', '三表分析、估值建模、财务比率、异常检测'),
      agent('legal', 8003, '投资合规专家', '研报合规、信息披露、利益冲突、证券法'),
    ],
    localScripts: ['calc_iit', 'calc_vat'],
    knowledgeCache: ['invest_mises_framework'],
    theme: { primary: '38 92% 43%', accent: '38 92% 43%' },
    enabledTabs: ['workflows', 'dashboard', 'chat', 'tools'],
    tools: [
      { id: 'iit', type: 'calculator', name: '个税计算器', icon: '🧾',
        agent: 'finance', apiPath: '/api/finance/calc/iit', localScript: 'calc_iit',
        fields: [
          { key: 'salary', label: '税前月薪（元）', type: 'currency', required: true },
        ],
      },
      { id: 'financial-ratio', type: 'calculator', name: '财务比率分析', icon: '📊',
        agent: 'finance', apiPath: '/api/finance/calc/ratio',
        description: '杜邦分析、盈利/偿债/运营效率等20+财务比率计算',
        fields: [
          { key: 'revenue', label: '营业收入（万元）', type: 'currency', required: true },
          { key: 'net_profit', label: '净利润（万元）', type: 'currency', required: true },
          { key: 'total_assets', label: '总资产（万元）', type: 'currency', required: true },
          { key: 'total_equity', label: '股东权益（万元）', type: 'currency', required: true },
          { key: 'total_liability', label: '总负债（万元）', type: 'currency', required: true },
        ],
      },
      { id: 'stamp-tax', type: 'calculator', name: '印花税计算', icon: '📌',
        agent: 'finance', apiPath: '/api/finance/calc/stamp-tax',
        description: '证券交易印花税计算（卖出时0.05%）',
        fields: [
          { key: 'contract_type', label: '类型', type: 'select', required: true,
            options: [
              { value: 'stock_sale', label: '股票卖出（0.05%）' },
              { value: 'property_transfer', label: '产权转移（0.05%）' },
            ] },
          { key: 'amount', label: '交易金额（元）', type: 'currency', required: true },
        ],
      },
    ],
    slashCommands: [
      { cmd: '/比率', label: '财务比率', icon: '📊', toolId: 'financial-ratio' },
      { cmd: '/印花税', label: '印花税', icon: '📌', toolId: 'stamp-tax' },
      { cmd: '/个税', label: '个税计算', icon: '🧾', toolId: 'iit' },
    ],
    workflows: [
      {
        id: 'four_pillar_full', name: '四柱全链路研判', icon: '🏛️',
        description: '从宏观到操作的完整投资决策流程',
        mode: 'sequential',
        deliverable: '四柱投资决策报告（市场方向 + 行业选择 + 个股筛选 + 操作方案）',
        successCriteria: [
          '宏观信号有明确 BUY/CASH 判断且来源可追溯',
          '热点行业有轮动数据支撑',
          '个股 MISES 评分 ≥ 3 维达标',
          '操作建议含明确的仓位和止损止盈',
        ],
        steps: [
          { id: 'macro', agent: 'invest', expert: 'investment_analyst', label: '柱1·宏观判断',
            goal: '判断当前市场是 BUY 还是 CASH', successCriteria: ['先行/同步/滞后指标评分', 'WorldMonitor 信号引用', 'Risk-On/Off 明确'],
            profitImpact: { dimension: 'loss_avoidance', amount: 'CASH 信号避免系统性下跌，保护本金 10-30%' } },
          { id: 'hotspot', agent: 'invest', expert: 'investment_analyst', label: '柱2·热点追踪',
            goal: '找出当前最优行业板块', successCriteria: ['板块轮动有数据', '催化剂事件明确', '≥ 3 个候选行业'],
            profitImpact: { dimension: 'revenue', amount: '精准行业选择，超额收益 10-25%' } },
          { id: 'stock', agent: 'invest', expert: 'investment_analyst', label: '柱3·个股筛选',
            goal: '从热点行业中选出最优标的', successCriteria: ['MISES 五维评分', '信仰度 ≥ 0.6', '≥ 3 只候选标的'],
            profitImpact: { dimension: 'revenue', amount: 'MISES 选股胜率 65%+，Alpha 显著' } },
          { id: 'operation', agent: 'invest', expert: 'investment_analyst', label: '柱4·操作方案',
            goal: '给出具体买卖操作建议', successCriteria: ['买入/卖出价位区间', '仓位比例', '止损止盈位'],
            profitImpact: { dimension: 'loss_avoidance', amount: '纪律化止损止盈，回撤 ≤ 8%' } },
        ],
        triggerPhrases: ['四柱', '全链路', '完整研判', '从头分析'],
      },
      {
        id: 'stock_research', name: '个股深度研究', icon: '🔍',
        description: '对指定个股做深度分析，输出可执行的投资建议',
        mode: 'sequential',
        deliverable: '个股研究报告（行业定位 + 财务分析 + 估值区间 + 操作建议）',
        successCriteria: [
          '行业分析含竞争格局和市场份额数据',
          '财务分析覆盖三年趋势，标注异常项',
          '估值区间含 ≥ 2 种方法交叉验证',
          '投资建议含明确的买入/持有/卖出结论和止损位',
        ],
        steps: [
          { id: 'industry', agent: 'invest', expert: 'investment_analyst', label: '行业格局与竞争分析',
            goal: '定位公司在行业中的竞争地位', successCriteria: ['行业规模和增速有数据来源', '竞争对手 ≥ 3 家对标', '标注护城河类型'],
            profitImpact: { dimension: 'revenue', amount: '深度行业分析提升研报质量，客户续费率 +20%' } },
          { id: 'financial', agent: 'finance', expert: 'finance_accountant', label: '三表联动与财务健康',
            goal: '评估财务质量和盈利可持续性', successCriteria: ['ROE/毛利率/现金流三年趋势', '标注财务异常', '杜邦分析拆解'],
            profitImpact: { dimension: 'loss_avoidance', amount: '识别财务造假/异常，避免踩雷损失 20-50%' } },
          { id: 'valuation', agent: 'invest', expert: 'investment_analyst', label: '估值建模与目标价',
            goal: '给出合理估值区间和目标价', successCriteria: ['≥ 2 种估值方法交叉验证', '关键假设明确', '上行/下行风险标注'],
            profitImpact: { dimension: 'revenue', amount: '估值精准，买在低估区间增收 15-30%' } },
        ],
        triggerPhrases: ['研究', '分析股票', '个股深度', '深度分析'],
      },
    ],
    scenarios: [
      // ── 四柱决策链：该不该买 → 买哪个行业 → 买哪只 → 怎么操作 ──
      { id: 'pillar_macro', label: '柱1·该不该买', icon: '🌍',
        prompt: '当前市场环境下应该加仓还是减仓？', apiEndpoint: '/api/invest/four-pillar/macro', apiMethod: 'GET',
        expectedOutcome: 'BUY/CASH 信号 + 先行/同步/滞后指标评分 + Risk-On/Off 判断',
        expert: 'invest.investment_analyst', profitImpact: { dimension: 'loss_avoidance', amount: '风控精准，最大回撤控制在 5% 内' } },
      { id: 'pillar_hotspot', label: '柱2·买哪个行业', icon: '🔥',
        prompt: '当前最值得关注的行业板块有哪些？', apiEndpoint: '/api/invest/four-pillar/hotspot', apiMethod: 'GET',
        expectedOutcome: '四象限热点模型 + 板块轮动方向 + 催化剂事件',
        expert: 'invest.investment_analyst', profitImpact: { dimension: 'revenue', amount: '精准择时择势，预期超额收益 10-30%' } },
      { id: 'pillar_stock', label: '柱3·买哪只股票', icon: '🎯',
        prompt: '在当前热点行业中筛选最优个股', apiEndpoint: '/api/invest/four-pillar/stock', apiMethod: 'GET',
        expectedOutcome: 'MISES 五维评分 + 信仰度评估 + 关键标的排名',
        expert: 'invest.investment_analyst', profitImpact: { dimension: 'revenue', amount: '选股胜率提升，Alpha 收益显著' } },
      { id: 'pillar_operation', label: '柱4·怎么操作', icon: '⚡',
        prompt: '给出具体的买入/卖出操作建议', apiEndpoint: '/api/invest/four-pillar/operation', apiMethod: 'GET',
        expectedOutcome: '买卖时机 + 仓位比例 + 止损止盈位 + 回撤控制',
        expert: 'invest.investment_analyst', profitImpact: { dimension: 'revenue', amount: '操作纪律化，年化收益提升 5-15%' } },
      // ── 辅助场景 ──
      { id: 'macro_report', label: '全球宏观报告', icon: '📡',
        prompt: '生成全球宏观市场环境报告（含 WorldMonitor 实时数据）', apiEndpoint: '/api/invest/four-pillar/macro-report?include_live_data=true', apiMethod: 'GET',
        expectedOutcome: 'WorldMonitor 7大宏观信号 + 全球市场概览 + GEI/DPI/MEI评分',
        expert: 'invest.investment_analyst', profitImpact: { dimension: 'revenue', amount: '全球视野辅助资产配置，预期增收 10-20%' } },
      { id: 'ai_chain', label: 'AI 产业链', icon: '🤖',
        prompt: '分析 AI 产业链上下游投资机会', apiEndpoint: '/api/invest/chain/spectrum', apiMethod: 'GET',
        expectedOutcome: '六层产业链（算力→基础设施→模型→应用）+ 关键标的 + AI冲击评估',
        expert: 'invest.investment_analyst', profitImpact: { dimension: 'revenue', amount: '发现 AI 产业链低估标的，预期收益 20-50%' } },
      { id: 'four_pillar_dashboard', label: '四柱仪表盘', icon: '📊',
        prompt: '一站式查看四柱投资系统全貌', apiEndpoint: '/api/invest/four-pillar/dashboard', apiMethod: 'GET',
        expectedOutcome: '四柱合一视图：宏观+热点+个股+操作的综合研判',
        expert: 'invest.investment_analyst', profitImpact: { dimension: 'revenue', amount: '一站式决策，研究效率翻 10 倍' } },
    ],
  },
  {
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
    enabledTabs: ['chat', 'tools', 'documents', 'workflows'],
    tools: [],
    slashCommands: [],
    workflows: [],
    scenarios: [
      { id: 'bid_review', label: '标书审查', icon: '📋', prompt: '审查这份招标/投标文件的合规性', expectedOutcome: '合规问题清单 + 改进建议 + 法规引用', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '避免废标损失 10-50 万' } },
    ],
  },
  {
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
    enabledTabs: ['chat', 'tools', 'workflows'],
    tools: [],
    slashCommands: [],
    workflows: [],
    scenarios: [
      { id: 'subsidy_match', label: '补贴政策匹配', icon: '💰', prompt: '查询适用的农业补贴政策', expectedOutcome: '可申报补贴清单 + 申报条件 + 截止日期', expert: 'finance.tax_consultant', profitImpact: { dimension: 'revenue', amount: '多获补贴 5-20 万/年' } },
    ],
  },
  {
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
    enabledTabs: ['chat', 'tools', 'workflows', 'dashboard'],
    tools: [],
    slashCommands: [],
    workflows: [],
    scenarios: [
      { id: 'lease_review', label: '租赁合同审查', icon: '📋', prompt: '审查这份租赁合同的风险点', expectedOutcome: '风险条款标注 + 修改建议 + 法规引用', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '避免租赁纠纷损失 3-15 万' } },
    ],
  },
  {
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
    enabledTabs: ['chat', 'tools', 'documents', 'workflows'],
    tools: [],
    slashCommands: [],
    workflows: [],
    scenarios: [
      { id: 'patent_search', label: '前案检索', icon: '🔍', prompt: '对这项技术方案进行专利前案检索', expectedOutcome: '相关专利清单 + 技术对比 + 可专利性初步评估', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'revenue', amount: '检索加速节省代理人时间，月多接 10 单' } },
    ],
  },
  {
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
    enabledTabs: ['chat', 'tools', 'workflows', 'dashboard'],
    tools: [
      { id: 'iit', type: 'calculator', name: '个税计算器', icon: '🧾',
        agent: 'finance', apiPath: '/api/finance/calc/iit', localScript: 'calc_iit',
        fields: [
          { key: 'salary', label: '税前月薪（元）', type: 'currency', required: true },
          { key: 'insurance', label: '五险一金（元）', type: 'currency', default: 0 },
        ],
      },
      { id: 'vat', type: 'calculator', name: '增值税计算器', icon: '📊',
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
      { cmd: '/增值税', label: '增值税计算', icon: '📊', toolId: 'vat' },
    ],
    workflows: [],
    scenarios: [
      { id: 'tax_filing', label: '纳税申报', icon: '📊', prompt: '协助完成本期纳税申报', expectedOutcome: '各税种应纳税额 + 申报数据 + 注意事项', expert: 'finance.tax_consultant', profitImpact: { dimension: 'cost_saving', amount: '申报效率翻 3 倍，月省人力 5 天' } },
      { id: 'audit_defense', label: '稽查应对', icon: '🛡️', prompt: '税务稽查通知如何应对', expectedOutcome: '材料准备清单 + 应对策略 + 风险评估', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '避免稽查补税罚款 10-100 万' } },
    ],
  },
  {
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
    enabledTabs: ['chat', 'tools', 'documents', 'workflows'],
    tools: [],
    slashCommands: [],
    workflows: [],
    scenarios: [
      { id: 'gmp_check', label: 'GMP 合规检查', icon: '✅', prompt: '检查这项操作的 GMP 合规性', expectedOutcome: '合规结论 + 偏差风险评级 + CAPA 建议', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '避免 GMP 违规停产损失 100 万+' } },
    ],
  },
  {
    id: 'logistics-supply-chain',
    name: '物流与供应链管理方案',
    icon: '🚛',
    color: '#0f766e',
    tagline: '物流成本降 15%，供应链可视化实时追踪',
    description: '运输合同管理 + 物流成本核算 + 供应链合规 + 索赔处理全链路。',
    entrepreneurPurpose: '降低物流成本、提升供应链可视性、减少货损纠纷',
    profitMetrics: ['运输成本降低 15%', '合同审查自动化', '货损索赔处理 3 天→3 小时'],
    agents: [
      agent('legal', 8003, '物流法务专家', '运输合同、货损索赔、国际贸易法'),
      agent('finance', 8002, '物流财务专家', '运费核算、关税计算、成本分析'),
      agent('cs', 8004, '物流客服专家', '货物追踪、异常处理、客户沟通'),
    ],
    localScripts: ['calc_iit', 'calc_vat', 'calc_litigation_fee'],
    knowledgeCache: [],
    theme: { primary: '173 80% 26%', accent: '173 80% 26%' },
    enabledTabs: ['chat', 'tools', 'workflows', 'dashboard'],
    tools: [],
    slashCommands: [],
    workflows: [],
    scenarios: [
      { id: 'damage_claim', label: '货损索赔', icon: '📦', prompt: '货物运输中损坏，如何索赔', expectedOutcome: '索赔流程 + 赔偿金额计算 + 法律依据', expert: 'legal.civil_lawyer', profitImpact: { dimension: 'loss_avoidance', amount: '快速索赔挽回货损 5-30 万' } },
    ],
  },
]

export function getSolution(id: string): SolutionConfig | undefined {
  return SOLUTION_REGISTRY.find(s => s.id === id)
}

export function getDefaultAgent(solution: SolutionConfig): AgentEndpoint {
  return solution.agents[0]
}

/** 默认主题（无方案选中时恢复） */
const DEFAULT_THEME: SolutionTheme = {
  primary: '217 91% 60%',
  accent: '217 91% 60%',
}

/**
 * 将方案主题注入 CSS 变量 — 借鉴 WorldMonitor 多变体仪表盘
 *
 * WorldMonitor 用单代码库为 Market/Company/Geo/Climate/Aviation 5 个变体
 * 切换色彩和布局。MBE 用 CSS 变量实现同样效果，零组件代码改动。
 */
export function applySolutionTheme(solutionId: string | null): () => void {
  const root = document.documentElement
  const solution = solutionId ? getSolution(solutionId) : undefined
  const theme = solution?.theme ?? DEFAULT_THEME

  root.style.setProperty('--primary', theme.primary)
  root.style.setProperty('--ring', theme.primary)
  root.style.setProperty('--accent', theme.accent)

  if (theme.sidebarBg) {
    root.style.setProperty('--card', theme.sidebarBg)
  } else {
    root.style.removeProperty('--card')
  }

  root.setAttribute('data-solution', solutionId ?? '')

  return () => {
    root.style.setProperty('--primary', DEFAULT_THEME.primary)
    root.style.setProperty('--ring', DEFAULT_THEME.primary)
    root.style.setProperty('--accent', DEFAULT_THEME.accent)
    root.style.removeProperty('--card')
    root.removeAttribute('data-solution')
  }
}
