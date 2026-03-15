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

export type WorkbenchTab = 'chat' | 'tools' | 'documents' | 'tasks' | 'dashboard' | 'workflows' | 'approvals' | 'costs'

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
}

export interface SolutionConfig {
  id: string
  name: string
  icon: string
  color: string
  tagline: string
  description: string
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

const API_BASE = 'https://mbe.hi-maker.com'

function agent(id: string, _port: number, role: string, handles: string): AgentEndpoint {
  return {
    id,
    role,
    handles,
    baseUrl: `${API_BASE}/api/${id}`,
    wsUrl: `wss://mbe.hi-maker.com/api/${id}/ws`,
  }
}

export const SOLUTION_REGISTRY: SolutionConfig[] = [
  {
    id: 'labor-dispatch',
    name: '劳务派遣一站式方案',
    icon: '👷',
    color: '#f59e0b',
    tagline: '用工合规 + 薪酬结算 + 纠纷处理，一个平台全搞定',
    description: '劳务派遣公司每天要处理合规检查、工资社保、合同管理、劳动纠纷等交叉领域的问题。过去需要法务 + 会计 + HR 三个岗位，现在 MBE 为你派遣三位 AI 专家协同工作。',
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
    ],
    slashCommands: [
      { cmd: '/计算', label: '赔偿计算', icon: '💰', toolId: 'labor-compensation' },
      { cmd: '/审查', label: '合同审查', icon: '📋', toolId: 'contract-review' },
      { cmd: '/个税', label: '个税计算', icon: '🧾', toolId: 'salary-tax' },
      { cmd: '/诉讼费', label: '诉讼费计算', icon: '⚖️', toolId: 'litigation-fee' },
      { cmd: '/加班费', label: '加班费计算', icon: '⏰', toolId: 'overtime-calc' },
      { cmd: '/年假', label: '年假天数', icon: '🏖️', toolId: 'annual-leave' },
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
            successCriteria: ['明确派遣比例是否超标', '列出岗位三性（临时/辅助/替代）判定依据'] },
          { id: 'contract', agent: 'legal', expert: 'civil_lawyer', label: '劳动合同审查',
            goal: '识别合同中全部法律风险并给出修改文本',
            successCriteria: ['逐条标注风险等级（高/中/低）', '每条高风险给出替代条款文本', '引用劳动合同法具体条款号'] },
          { id: 'tax', agent: 'finance', expert: 'tax_consultant', label: '薪税方案核算',
            goal: '输出个税最优方案和社保成本明细',
            successCriteria: ['含工资、社保、公积金、个税各项金额', '对比至少 2 种薪酬结构方案的税后差异'] },
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
            successCriteria: ['明确劳动关系类型', '列出适用法条（条款号）', '给出胜诉概率区间'] },
          { id: 'compensation', agent: 'finance', expert: 'tax_consultant', label: '补偿金额核算',
            goal: '精确计算各类补偿/赔偿金额',
            successCriteria: ['N/N+1/2N 各项金额逐项列出', '含社保补缴、年假折算等附带金额', '计算过程可验证'] },
          { id: 'strategy', agent: 'hr', expert: 'hr_consultant', label: '应对策略与预防',
            goal: '输出可直接执行的应对方案和长效预防机制',
            successCriteria: ['方案含谈判话术要点', '含时间线（仲裁/诉讼截止日期）', '提出 ≥ 2 项预防改进措施'] },
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
            successCriteria: ['加班工时分类（工作日/休息日/法定假）', '标注超 36 小时月加班上限的员工'] },
          { id: 'payroll', agent: 'finance', expert: 'tax_consultant', label: '薪资与社保计算',
            goal: '精确计算每人应发/实发金额',
            successCriteria: ['含五险一金各项基数和金额', '个税累计预扣法计算正确', '总额与上月差异 ≤ 5% 或标注原因'] },
          { id: 'compliance', agent: 'legal', expert: 'civil_lawyer', label: '用工合规检查',
            goal: '确认发放方案无法律风险',
            successCriteria: ['最低工资标准达标确认', '加班费计算基数合规', '社保缴纳比例符合当地规定'] },
        ],
        triggerPhrases: ['薪资结算', '发工资', '社保核算'],
      },
    ],
    scenarios: [
      { id: 'dismiss', label: '员工辞退方案', icon: '🚪', prompt: '公司想辞退一名员工，请分析合法的辞退方案和经济补偿', expectedOutcome: '含法律依据的辞退方案 + N/2N 精确金额 + 操作时间线', workflowId: 'dispute_resolution' },
      { id: 'contract_check', label: '新合同审查', icon: '📋', prompt: '审查这份劳动合同的风险点', expectedOutcome: '逐条风险标注（高/中/低）+ 每条修改建议文本 + 引用法条', expert: 'legal.civil_lawyer' },
      { id: 'overtime_risk', label: '加班费风险', icon: '⏰', prompt: '分析加班费计算方式和潜在法律风险', expectedOutcome: '加班费计算公式 + 三种加班倍率 + 超时加班法律后果', expert: 'legal.civil_lawyer' },
      { id: 'social_insurance', label: '社保合规', icon: '🏥', prompt: '检查社保缴纳基数和比例是否合规', expectedOutcome: '当地社保基数上下限 + 各险种费率 + 差异金额', expert: 'finance.tax_consultant' },
      { id: 'batch_onboard', label: '批量入职', icon: '👥', prompt: '20 名新员工同时入职的流程和注意事项', expectedOutcome: '批量入职检查清单 + 时间排期 + 常见风险点', workflowId: 'onboarding' },
    ],
  },
  {
    id: 'law-firm',
    name: '律所智能运营方案',
    icon: '⚖️',
    color: '#3366cc',
    tagline: '案件管理 + 文书生成 + 律所财务，AI 团队驻场服务',
    description: '律所合伙人最头疼的不是打官司，而是案件管理混乱、文书效率低、财务核算复杂。MBE 为律所派遣法律 + 财务 AI 专家团队，让律师专注打赢官司，杂活交给 AI。',
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
            successCriteria: ['确定案由', '列出原被告主体信息', '明确管辖法院依据'] },
          { id: 'evidence', agent: 'legal', expert: 'civil_lawyer', label: '证据分析与法律检索',
            goal: '构建完整证据链，检索支撑判例',
            successCriteria: ['每项证据标注证明目的', '标注证据缺口和补救方案', '检索 ≥ 2 个类似判例'] },
          { id: 'strategy', agent: 'legal', expert: 'civil_lawyer', label: '诉讼策略制定',
            goal: '输出最优诉讼路径和备选方案',
            successCriteria: ['给出胜诉概率区间', '含调解/仲裁/诉讼三种路径对比', '标注关键时间节点'] },
          { id: 'budget', agent: 'finance', expert: 'finance_accountant', label: '诉讼费用预算',
            goal: '精确计算全部诉讼成本',
            successCriteria: ['受理费按标的额精确计算', '律师费标注计算方式', '含保全费/鉴定费等可能费用'] },
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
            successCriteria: ['覆盖六大必备要素', '条款结构符合行业惯例'] },
          { id: 'review', agent: 'legal', expert: 'civil_lawyer', label: '条款风险审查',
            goal: '识别并消除全部高风险条款',
            successCriteria: ['逐条标注风险等级', '每条高风险给出替代文本', '引用民法典条款号'] },
          { id: 'advice', agent: 'legal', expert: 'civil_lawyer', label: '签约建议与谈判要点',
            goal: '输出谈判策略和签约注意事项',
            successCriteria: ['标注可让步条款和底线条款', '含签约前检查清单'] },
        ],
        triggerPhrases: ['起草合同', '合同审查', '签合同'],
      },
    ],
    scenarios: [
      { id: 'case_assess', label: '案件胜率评估', icon: '⚖️', prompt: '评估这个案件的胜诉概率和风险', expectedOutcome: '胜诉概率区间 + 关键风险点 + 证据强弱分析', expert: 'legal.civil_lawyer' },
      { id: 'demand_letter', label: '律师函起草', icon: '📄', prompt: '根据以下情况起草一份律师函', expectedOutcome: '可直接发送的律师函全文 + 法律依据', expert: 'legal.civil_lawyer' },
      { id: 'statute_check', label: '诉讼时效查询', icon: '⏰', prompt: '查询这个案件的诉讼时效', expectedOutcome: '适用时效年限 + 起算日期 + 剩余天数 + 中断/中止情形', expert: 'legal.civil_lawyer' },
      { id: 'case_cost', label: '诉讼费估算', icon: '💰', prompt: '估算这个案件的全部诉讼成本', expectedOutcome: '受理费 + 律师费 + 鉴定费等各项明细金额', workflowId: 'case_management' },
    ],
  },
  {
    id: 'finance-tax-service',
    name: '财税专业服务方案',
    icon: '📊',
    color: '#00d4aa',
    tagline: '记账报税 + 审计辅助 + 税务筹划，财税全链路 AI 驻场',
    description: '会计师事务所、审计所、税务师事务所、代理记账公司——财税从业者的日常被发票、凭证、报表、审计底稿、税务筹划淹没。MBE 派遣四位 AI 专家，从发票 OCR 到审计报告全链路提效。',
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
    ],
    slashCommands: [
      { cmd: '/个税', label: '个税计算', icon: '🧾', toolId: 'iit' },
      { cmd: '/增值税', label: '增值税计算', icon: '📊', toolId: 'vat' },
      { cmd: '/印花税', label: '印花税计算', icon: '📌', toolId: 'stamp-tax' },
      { cmd: '/企业所得税', label: '企业所得税预缴', icon: '🏢', toolId: 'cit-quarterly' },
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
            goal: '确认全部发票真实、合规、已入账', successCriteria: ['列出发票总数和金额汇总', '标注异常发票（抬头/税号/金额不符）'] },
          { id: 'voucher', agent: 'finance', expert: 'finance_accountant', label: '记账凭证生成',
            goal: '生成完整准确的会计凭证', successCriteria: ['每笔凭证含借贷科目和金额', '引用会计准则条款'] },
          { id: 'report', agent: 'finance', expert: 'finance_accountant', label: '财务报表编制',
            goal: '编制三张主要报表并校验勾稽', successCriteria: ['资产=负债+所有者权益', '利润表与现金流量表交叉验证'] },
          { id: 'tax_filing', agent: 'finance', expert: 'tax_consultant', label: '纳税申报',
            goal: '确定各税种申报金额和截止日期', successCriteria: ['增值税/企业所得税/附加税各项金额明确', '标注申报截止日和注意事项'] },
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
            goal: '摸清当前税负结构和优化空间', successCriteria: ['列出各税种实际税负率', '对标行业平均税负率'] },
          { id: 'risk', agent: 'finance', expert: 'tax_consultant', label: '税务风险评估',
            goal: '识别现有税务操作中的风险点', successCriteria: ['逐项标注风险等级和金额影响', '含近三年税务稽查关注点'] },
          { id: 'plan', agent: 'finance', expert: 'tax_consultant', label: '筹划方案设计',
            goal: '输出 ≥ 2 套可行筹划方案并对比', successCriteria: ['每套方案含实施步骤和预期节税金额', '对比实施成本和风险'] },
          { id: 'compliance', agent: 'legal', expert: 'civil_lawyer', label: '合规性检查',
            goal: '确认筹划方案不触碰法律红线', successCriteria: ['逐方案给出合规/存疑/违规结论', '引用税法和刑法相关条款'] },
        ],
        triggerPhrases: ['税务筹划', '节税方案', '合理避税'],
      },
    ],
    scenarios: [
      { id: 'invoice_check', label: '发票合规检查', icon: '🧾', prompt: '检查这批发票是否合规', expectedOutcome: '逐张发票合规/异常判定 + 异常原因 + 处理建议', expert: 'finance.finance_accountant' },
      { id: 'tax_calc', label: '企业税负测算', icon: '📊', prompt: '测算当前企业整体税负率', expectedOutcome: '各税种税负率 + 综合税负率 + 行业对标', expert: 'finance.tax_consultant' },
      { id: 'annual_audit', label: '年审准备', icon: '📋', prompt: '准备年度审计需要的材料清单和注意事项', expectedOutcome: '完整材料清单（含科目余额表/银行对账单等）+ 常见问题预警', expert: 'finance.finance_accountant' },
    ],
  },
  {
    id: 'construction-cost',
    name: '工程造价咨询方案',
    icon: '🏗️',
    color: '#ea580c',
    tagline: '概预算 + 清单计价 + 结算审核，造价全流程 AI 辅助',
    description: '造价咨询公司每个项目都要翻定额、算工程量、核取费，一个项目动辄上千条清单。MBE 为造价所派遣造价 + 合规 AI 专家，秒查定额、自动取费、智能审核。',
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
    ],
    slashCommands: [
      { cmd: '/取费', label: '取费计算', icon: '🧮', toolId: 'cost-fee' },
      { cmd: '/税金', label: '工程税金', icon: '🏗️', toolId: 'cost-tax' },
      { cmd: '/估算', label: '造价估算', icon: '📐', toolId: 'cost-estimate' },
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
            goal: '逐项核实工程量，标注偏差和依据', successCriteria: ['核减/核增项逐条列出', '引用图纸编号或签证单号'] },
          { id: 'price', agent: 'cost', expert: 'cost_engineer', label: '综合单价审核',
            goal: '验证单价组成合理性', successCriteria: ['主材价格对比信息价', '人工机械单价引用定额基价'] },
          { id: 'fee', agent: 'cost', expert: 'cost_engineer', label: '取费与税金审核',
            goal: '确认取费费率和税金计算正确', successCriteria: ['费率引用当地文件编号', '税金计算方式（一般/简易）正确'] },
        ],
        triggerPhrases: ['结算审核', '审核结算', '工程结算'],
      },
    ],
    scenarios: [
      { id: 'quota_lookup', label: '定额查询', icon: '📖', prompt: '查询这项施工内容的定额子目和单价', expectedOutcome: '定额编号 + 子目名称 + 含量 + 基价', expert: 'cost.cost_engineer' },
      { id: 'change_order', label: '变更签证', icon: '📝', prompt: '分析这份变更签证的造价影响', expectedOutcome: '变更金额（增/减）+ 计算依据 + 合同条款引用', expert: 'cost.cost_engineer' },
    ],
  },
  {
    id: 'clinic-respiratory',
    name: '呼吸科临床辅助方案',
    icon: '🫁',
    color: '#0d9488',
    tagline: '临床评分 + 肺功能解读 + 用药检查，循证医学 AI 助手',
    description: '呼吸内科医生每天面对大量肺功能报告、影像报告和复杂用药方案。',
    agents: [
      agent('pulmonary', 8005, '呼吸科诊疗专家', '临床评分、诊断分析、治疗方案'),
      agent('pulmonary', 8005, '肺功能解读专家', 'PFT 报告解读、通气功能评估'),
      agent('pulmonary', 8005, '重症监护专家', '呼吸机参数、SOFA 评分、预后评估'),
    ],
    localScripts: ['calc_clinical_score', 'calc_pft', 'calc_ventilator'],
    knowledgeCache: ['copd_guidelines', 'pneumonia_guidelines'],
    theme: { primary: '168 82% 32%', accent: '168 82% 32%' },
    enabledTabs: ['chat', 'tools'],
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
    ],
    workflows: [],
    scenarios: [
      { id: 'copd_assess', label: 'COPD 评估', icon: '🫁', prompt: '对这位患者进行 COPD 综合评估（GOLD 分级）', expectedOutcome: 'GOLD 分级（A/B/C/D）+ CAT/mMRC 评分 + 治疗方案推荐（含证据级别）', expert: 'pulmonary.pulmonary_physician' },
      { id: 'pneumonia', label: '肺炎严重度', icon: '🩺', prompt: '评估这位肺炎患者的严重程度（CURB-65）', expectedOutcome: 'CURB-65 评分 + 严重度分级 + 住院/门诊建议 + 经验性抗生素方案', expert: 'pulmonary.pulmonary_physician' },
    ],
  },
  {
    id: 'smb-operations',
    name: '中小企业运营方案',
    icon: '🏢',
    color: '#8b5cf6',
    tagline: '法务 + 财务 + 销售 + 客服，四位 AI 专家驻场',
    description: '中小企业老板什么都要管——合同要审、账要记、税要报、客户要跟、客服要回。MBE 为中小企业派遣全栈 AI 专家团队，相当于同时雇了法务、会计、销售顾问和客服主管。',
    agents: [
      agent('legal', 8003, '企业法务专家', '合同审查、劳动法咨询、风险防控'),
      agent('finance', 8002, '企业财务专家', '记账报税、发票管理、财务分析'),
      agent('sales', 8008, '销售顾问', '客户分析、商机评估、话术推荐'),
      agent('cs', 8004, '客服主管', '工单管理、FAQ 维护、满意度提升'),
    ],
    localScripts: ['calc_iit', 'calc_vat', 'calc_litigation_fee'],
    knowledgeCache: ['labor_law_basics', 'tax_law_basics'],
    theme: { primary: '263 70% 66%', accent: '263 70% 66%', sidebarBg: '263 15% 7%' },
    enabledTabs: ['chat', 'tools', 'dashboard'],
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
    ],
    workflows: [],
    scenarios: [
      { id: 'contract_review', label: '合同快审', icon: '📋', prompt: '快速审查这份商业合同的风险点', expectedOutcome: '逐条风险标注 + 修改建议 + 民法典条款引用', expert: 'legal.civil_lawyer' },
      { id: 'tax_question', label: '税务快问', icon: '🧾', prompt: '解答这个税务问题', expectedOutcome: '准确税务结论 + 税法条款依据 + 对经营的影响分析', expert: 'finance.tax_consultant' },
    ],
  },
  {
    id: 'study-abroad-consulting',
    name: '留学咨询方案',
    icon: '✈️',
    color: '#06b6d4',
    tagline: '选校匹配 + 申请规划 + 备考方案 + 签证指导 + 费用预算',
    description: '准备出国留学？MBE 为你派遣留学规划 + 费用顾问两位 AI 专家，基于 15 个留学知识库，覆盖选校匹配、考试备考、申请时间线、签证指导、费用预算全流程。',
    agents: [
      agent('education', 8006, '留学规划顾问', '选校匹配、申请规划、考试备考、签证指导、心理测评'),
      agent('finance', 8002, '留学费用顾问', '留学费用预算、资金规划、税务影响分析'),
    ],
    localScripts: [],
    knowledgeCache: ['study_abroad_rules'],
    theme: { primary: '187 86% 53%', accent: '187 86% 53%' },
    enabledTabs: ['chat'],
    tools: [],
    slashCommands: [],
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
            successCriteria: ['GPA 和标化成绩对标目标院校历年录取线', '标注竞争力强弱项'] },
          { id: 'match', agent: 'education', expert: 'education_tutor', label: '院校匹配推荐',
            goal: '输出冲/稳/保各梯度院校推荐',
            successCriteria: ['每梯度 ≥ 2 所院校', '含专业排名和就业数据', '标注申请截止日期'] },
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
            successCriteria: ['覆盖选校/文书/推荐信/递交全流程', '标注关键截止日期'] },
          { id: 'budget', agent: 'finance', expert: 'tax_consultant', label: '费用预算与资金规划',
            goal: '精确计算留学总费用并给出资金规划建议',
            successCriteria: ['学费+生活费+签证+机票逐项列出', '含汇率风险提示', '给出资金准备时间建议'] },
        ],
        triggerPhrases: ['留学方案', '全方案', '留学规划含费用'],
      },
    ],
    scenarios: [
      { id: 'school_match', label: '智能选校', icon: '🏫', prompt: '根据我的 GPA 和成绩推荐留学院校', expectedOutcome: '冲/稳/保各 2-3 所院校推荐 + 录取概率 + 费用对比', expert: 'education.education_tutor' },
      { id: 'exam_plan', label: '备考规划', icon: '📝', prompt: '制定雅思/托福备考计划', expectedOutcome: '目标分数 + 周计划 + 薄弱项训练 + 模考安排', expert: 'education.education_tutor' },
      { id: 'cost_estimate', label: '费用预算', icon: '💰', prompt: '估算留学一年总费用', expectedOutcome: '学费+生活费+签证+机票各项明细 + 资金规划', workflowId: 'full_abroad_plan' },
      { id: 'visa_guide', label: '签证指导', icon: '🛂', prompt: '指导签证申请流程和材料准备', expectedOutcome: '签证材料清单 + 面签准备 + 时间规划', expert: 'education.education_tutor' },
    ],
  },
  {
    id: 'education-training',
    name: '教育培训方案',
    icon: '🎓',
    color: '#6366f1',
    tagline: '留学规划 + 考试备考 + 课程管理 + 学费核算，教培全场景',
    description: '留学机构、培训学校、考试辅导班——教育从业者的日常被学员咨询、课程排期、成绩分析、留学方案设计消耗。MBE 派遣三位 AI 专家，让老师专注教学，行政杂活交给 AI。',
    agents: [
      agent('education', 8006, '升学规划专家', '留学选校、申请策略、时间规划'),
      agent('education', 8006, '学科辅导专家', '考试备考、学情分析、个性化方案'),
      agent('finance', 8002, '教务财务专家', '学费核算、退费政策、收支对账'),
    ],
    localScripts: [],
    knowledgeCache: [],
    theme: { primary: '239 84% 67%', accent: '239 84% 67%' },
    enabledTabs: ['chat'],
    tools: [],
    slashCommands: [],
    workflows: [],
    scenarios: [
      { id: 'study_plan', label: '留学规划', icon: '✈️', prompt: '根据我的情况制定留学申请规划', expectedOutcome: '院校推荐清单（含录取率）+ 时间线 + 材料检查清单', expert: 'education.education_tutor' },
      { id: 'exam_prep', label: '考试备考', icon: '📝', prompt: '制定雅思/托福备考计划', expectedOutcome: '目标分数 + 周计划 + 薄弱项针对训练 + 模考安排', expert: 'education.education_tutor' },
    ],
  },
  {
    id: 'ecommerce-brand-service',
    name: '品牌电商全价值链方案',
    icon: '🛒',
    color: '#e11d48',
    tagline: '运营 + 营销 + 客服 + 财务 + 合规，全链路 AI 驻场服务',
    description: '品牌电商服务公司（TP/代运营/BPO）每天处理店铺运营、内容生产、多品牌客服、达人合作、佣金结算等全价值链任务。MBE 派遣五位 AI 专家，覆盖从品牌入驻到月度结算的完整运营闭环。',
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
            goal: '确定活动主题、选品和 GMV 目标', successCriteria: ['GMV 目标有往期数据支撑', '选品 ≥ 3 个梯度（引流/利润/形象款）'] },
          { id: 'content', agent: 'growth', expert: 'content_creator', label: '内容与投放执行',
            goal: '输出各渠道内容和预算分配方案', successCriteria: ['覆盖 ≥ 3 个渠道', '每渠道含 ROI 预估和素材数量'] },
          { id: 'cs_ready', agent: 'cs', expert: 'cs_consultant', label: '客服备战与话术',
            goal: '确保客服团队能应对流量高峰', successCriteria: ['话术库覆盖促销规则/退换货/物流查询', '含排班方案和应急预案'] },
          { id: 'settle', agent: 'finance', expert: 'finance_accountant', label: '活动复盘与结算',
            goal: '输出活动 ROI 和品牌结算明细', successCriteria: ['GMV/费用/利润逐项列出', '佣金计算可追溯到合同条款'] },
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
            goal: '输出客服工作量和质量指标', successCriteria: ['含工单量/响应时长/解决率等 KPI', '数据源可追溯'] },
          { id: 'ops_data', agent: 'growth', expert: 'growth_consultant', label: '运营数据汇总',
            goal: '输出运营效果指标', successCriteria: ['含 GMV/流量/转化率/ROI', '按渠道拆分'] },
          { id: 'commission', agent: 'finance', expert: 'finance_accountant', label: '佣金与费用核算',
            goal: '精确计算服务费和佣金', successCriteria: ['费率引用合同条款', '含基础服务费 + 绩效佣金明细'] },
          { id: 'tax', agent: 'finance', expert: 'tax_consultant', label: '税务合规检查',
            goal: '确认发票开具和税务处理合规', successCriteria: ['发票税率正确', '进项抵扣合规'] },
        ],
        triggerPhrases: ['月度结算', '佣金核算', '服务费结算'],
      },
    ],
    scenarios: [
      { id: 'complaint', label: '客诉升级处理', icon: '🔥', prompt: '处理这个升级客诉，需要合规和赔偿方案', expectedOutcome: '处理方案 + 话术模板 + 赔偿金额 + 消保法引用', expert: 'cs.cs_consultant' },
      { id: 'campaign_roi', label: '活动 ROI 分析', icon: '📊', prompt: '分析本次营销活动的投入产出比', expectedOutcome: 'ROI 计算过程 + 渠道对比 + 优化建议', expert: 'growth.growth_consultant' },
      { id: 'brand_onboard', label: '新品牌入驻', icon: '🏪', prompt: '新品牌入驻的对接流程和注意事项', expectedOutcome: '入驻检查清单 + 时间排期 + 合同要点', workflowId: 'campaign_operation' },
    ],
  },
  {
    id: 'insurance-operations',
    name: '保险公司智能运营方案',
    icon: '🛡️',
    color: '#0891b2',
    tagline: '理赔服务 + 合规引擎 + 团险销售 + 续保激活，全链路 AI 专家驻场',
    description: '保险公司的日常运营横跨理赔、承保、合规、销售、财务等专业领域。MBE 派遣七位 AI 专家，覆盖从客户咨询到理赔结案、从团险销售到续保激活的完整运营闭环。',
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
            goal: '确认出险事实和保险责任', successCriteria: ['确认保单有效性', '初步判定是否属于承保范围'] },
          { id: 'assess', agent: 'insurance_cs', expert: 'cs_consultant', label: '查勘定损',
            goal: '确定损失金额和赔付标准', successCriteria: ['损失金额有评估依据', '明确免赔额和赔付比例'] },
          { id: 'approve', agent: 'finance', expert: 'finance_accountant', label: '核赔审批',
            goal: '审核赔付金额的合理性', successCriteria: ['赔付金额不超保额', '计算过程可审计'] },
          { id: 'compliance', agent: 'legal', expert: 'civil_lawyer', label: '合规审查与结案',
            goal: '确保理赔全流程合规', successCriteria: ['符合保险法规定', '无拒赔/惜赔风险'] },
        ],
        triggerPhrases: ['理赔', '报案', '出险'],
      },
    ],
    scenarios: [
      { id: 'claim_consult', label: '理赔咨询', icon: '📞', prompt: '咨询这个保险理赔的流程和注意事项', expectedOutcome: '理赔材料清单 + 时间预估 + 注意事项 + 拒赔风险提示', expert: 'insurance_cs.cs_consultant' },
      { id: 'policy_check', label: '保单查询', icon: '📄', prompt: '查询这份保单的保障范围和条款', expectedOutcome: '保障范围 + 免责条款 + 免赔额 + 理赔限额', expert: 'insurance_cs.cs_consultant' },
      { id: 'renewal_quote', label: '续保方案', icon: '🔄', prompt: '为这位客户设计最优续保方案', expectedOutcome: '新旧方案对比 + 保费变化 + 保障差异 + 推荐理由', expert: 'insurance_cs.cs_consultant' },
      { id: 'dispute_handle', label: '理赔纠纷', icon: '⚖️', prompt: '处理这个保险理赔纠纷，分析法律依据和应对方案', expectedOutcome: '纠纷性质判定 + 保险法条款引用 + 调解/诉讼建议', expert: 'legal.civil_lawyer' },
      { id: 'group_quote', label: '团险报价', icon: '👥', prompt: '为这家企业设计团体保险方案并报价', expectedOutcome: '险种组合推荐 + 保费估算 + 服务方案 + 竞品对标', expert: 'sales.sales_consultant' },
    ],
  },
  {
    id: 'investment-research',
    name: '投研机构智能方案',
    icon: '📈',
    color: '#d97706',
    tagline: '行业研究 + 估值建模 + 全球情报 + 合规审查，投研全链路 AI 驻场',
    description: '私募基金、券商研究所、家族办公室——投研团队每天被行业研究、选股筛选、财务分析、估值建模、研报撰写消耗。MBE 派遣三位 AI 专家，搭载 WorldMonitor 全球情报层，打通从宏观研判到研报发布的完整链路。',
    agents: [
      agent('invest', 8011, '投资分析专家', '行业研究、MISES评分、选股筛选、全球情报'),
      agent('finance', 8002, '财务审计专家', '三表分析、估值建模、财务比率、异常检测'),
      agent('legal', 8003, '投资合规专家', '研报合规、信息披露、利益冲突、证券法'),
    ],
    localScripts: ['calc_iit', 'calc_vat'],
    knowledgeCache: ['invest_mises_framework'],
    theme: { primary: '38 92% 43%', accent: '38 92% 43%' },
    enabledTabs: ['chat', 'tools', 'workflows', 'dashboard'],
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
        id: 'stock_research', name: '个股深度研究', icon: '🔍',
        description: '输出可供投资决策的个股研究报告',
        mode: 'sequential',
        deliverable: '个股研究报告（行业定位 + 财务分析 + 估值区间 + 投资建议）',
        successCriteria: [
          '行业分析含竞争格局和市场份额数据',
          '财务分析覆盖三年趋势，标注异常项',
          '估值区间含 ≥ 2 种方法（如 PE/DCF）交叉验证',
          '投资建议含明确的买入/持有/卖出结论和风险提示',
        ],
        steps: [
          { id: 'industry', agent: 'invest', expert: 'investment_analyst', label: '行业格局与竞争分析',
            goal: '定位公司在行业中的竞争地位', successCriteria: ['行业规模和增速有数据来源', '竞争对手 ≥ 3 家对标', '标注护城河类型'] },
          { id: 'financial', agent: 'finance', expert: 'finance_accountant', label: '三表联动与财务健康',
            goal: '评估财务质量和盈利可持续性', successCriteria: ['ROE/毛利率/现金流三年趋势', '标注财务异常（如应收暴增）', '杜邦分析拆解'] },
          { id: 'valuation', agent: 'invest', expert: 'investment_analyst', label: '估值建模与目标价',
            goal: '给出合理估值区间和目标价', successCriteria: ['≥ 2 种估值方法交叉验证', '关键假设明确列出', '标注上行/下行风险'] },
        ],
        triggerPhrases: ['研究', '分析股票', '个股深度'],
      },
    ],
    scenarios: [
      { id: 'macro_view', label: '宏观研判', icon: '🌍', prompt: '分析当前宏观经济环境和市场展望', expectedOutcome: 'Risk-On/Off 判断 + 关键经济指标趋势 + 资产配置建议', expert: 'invest.investment_analyst' },
      { id: 'peer_compare', label: '同行对标', icon: '📊', prompt: '做这家公司与同行的对标分析', expectedOutcome: '≥ 3 家可比公司 + 关键指标对比表 + 竞争优劣势结论', expert: 'invest.investment_analyst' },
      { id: 'ai_chain', label: 'AI 产业链分析', icon: '🤖', prompt: '分析 AI 产业链上下游投资机会', expectedOutcome: '六层产业链分析（算力→基础设施→模型→应用）+ 关键标的 + 估值基准', expert: 'invest.investment_analyst' },
      { id: 'earnings_review', label: '财报速评', icon: '📋', prompt: '快速分析这份财报的亮点和风险', expectedOutcome: '营收/利润增速 + 毛利率变化 + 现金流健康度 + 超/低预期判定', expert: 'finance.finance_accountant' },
      { id: 'compliance_check', label: '研报合规', icon: '✅', prompt: '检查这份研究报告的合规性', expectedOutcome: '信息披露完整性 + 利益冲突声明 + 免责条款 + 证券法合规', expert: 'legal.civil_lawyer' },
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
