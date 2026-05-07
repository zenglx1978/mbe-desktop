/**
 * 自动拆分自 solution-registry-data.ts。
 * 请勿手工编辑“结构”——如需改方案内容，请直接改本文件字段即可。
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const educationTrainingSolution: SolutionConfig = {
  id: 'education-training',
  name: '教培机构经营方案',
  icon: '🎓',
  color: '#6366f1',
  tagline: '国内教培招生与续费 — 人效翻 3 倍，退费率可控',
  description:
    '主攻国内教育培训与升学：K12/高考/考研/职教/医学继教、学情诊断、课时与退费核算。仅教雅思/托福课时仍可覆盖；若核心业务为出国留学申请、签证与海外费用全链路，请优先选用「留学咨询」方案（study-abroad-consulting），与本方案互补而非重复。',
  entrepreneurPurpose: '降低获客成本、提高续费率和转介绍率、师资人效翻 3 倍',
  profitMetrics: ['续费率 60%→80%', '转介绍率提升 50%', '师资人效 20→60 学生/师'],
  valueEquivalent: { humanHours: 8, mbeMinutes: 3, acceleration: '160x' },
  agents: [
    agent('education', 8006, '国内升学与应试规划', 'K12/高考/考研、学情分析；机构内留学语言课可覆盖，深度留学申请请选留学咨询方案'),
    agent('education', 8006, '学科辅导专家', '考试备考、个性化学习方案、薄弱项提升'),
    agent('finance', 8002, '教务财务专家', '学费核算、退费政策、收支对账'),
  ],
  localScripts: [],
  knowledgeCache: [],
  theme: { primary: '239 84% 67%', accent: '239 84% 67%' },
  enabledTabs: ['chat', 'tools', 'workflows', 'dashboard', 'knowledge-graph'],
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
    { cmd: '/入学', label: '新生入学', icon: '📋', workflowId: 'student_onboarding' },
    { cmd: '/续费', label: '续费策略', icon: '🔄', workflowId: 'renewal_analysis' },
    { cmd: '/留学选校', label: '留学选校方案', icon: '🏫', workflowId: 'study_abroad_plan' },
    { cmd: '/全案规划', label: '留学全案规划', icon: '✈️', workflowId: 'study_abroad_full' },
    { cmd: '/备考', label: '备考方案', icon: '📝', workflowId: 'exam_strategy' },
    { cmd: '/学情诊断', label: '学情诊断与提分', icon: '📊', workflowId: 'exam_improvement' },
  ],
  workflows: [
    {
      id: 'student_onboarding', name: '新生入学评估', icon: '📋',
      description: '从入学测评到个性化方案到学费核算的全流程，确保学生匹配最优课程',
      mode: 'sequential',
      estimatedTime: { human: '1 天', ai: '15 分钟' },
      aiRate: 0.80,
      deliverable: '新生入学报告（入学测评 + 个性化学习方案 + 学费明细）',
      steps: [
        { id: 'assess', agent: 'education', expert: 'education_tutor', label: '入学水平测评' },
        { id: 'plan', agent: 'education', expert: 'education_tutor', label: '个性化学习方案' },
        { id: 'fee', agent: 'finance', expert: 'finance_accountant', label: '学费核算与缴费方案' },
      ],
      triggerPhrases: ['新生入学', '入学测评', '报名流程', '新生报到'],
    },
    {
      id: 'renewal_analysis', name: '续费提升策略', icon: '🔄',
      description: '基于学情数据分析续费机会，输出家长沟通方案和续费优惠策略',
      mode: 'sequential',
      estimatedTime: { human: '1 天', ai: '10 分钟' },
      aiRate: 0.85,
      deliverable: '续费策略报告（学情分析 + 家长沟通话术 + 续费方案）',
      steps: [
        { id: 'learning', agent: 'education', expert: 'education_tutor', label: '学情分析与进步报告' },
        { id: 'renewal', agent: 'education', expert: 'education_tutor', label: '续费方案设计' },
        { id: 'accounting', agent: 'finance', expert: 'finance_accountant', label: '财务核算与优惠政策' },
      ],
      triggerPhrases: ['续费', '续报', '学情分析', '家长沟通', '续课方案'],
    },
    {
      id: 'study_abroad_plan', name: '留学选校方案', icon: '🏫',
      description: '背景评估 → 院校匹配（冲/稳/保梯度）→ 申请策略与时间线（3天→30分钟）',
      mode: 'sequential',
      estimatedTime: { human: '3 天', ai: '30 分钟' },
      aiRate: 0.85,
      deliverable: '留学选校方案报告（8-10所院校 + 录取概率 + 申请时间线）',
      steps: [
        { id: 'background_assessment', agent: 'education', expert: 'education_tutor', label: '背景评估' },
        { id: 'school_matching', agent: 'education', expert: 'education_tutor', label: '院校匹配（冲/稳/保）' },
        { id: 'application_strategy', agent: 'education', expert: 'education_tutor', label: '申请策略与时间线' },
      ],
      triggerPhrases: ['留学选校', '选校方案', '申请哪些学校', '院校匹配', '冲稳保'],
    },
    {
      id: 'study_abroad_full', name: '留学全案规划', icon: '✈️',
      description: '选校规划 → 文书框架 → 费用预算 → 方案整合（5天→1小时）',
      mode: 'sequential',
      estimatedTime: { human: '5 天', ai: '1 小时' },
      aiRate: 0.80,
      deliverable: '完整留学方案书（选校 + 文书框架 + 费用预算 + 时间线）',
      steps: [
        { id: 'school_plan', agent: 'education', expert: 'education_tutor', label: '选校规划' },
        { id: 'essay_framework', agent: 'education', expert: 'education_tutor', label: '文书框架（PS/SOP/CV）' },
        { id: 'budget', agent: 'finance', expert: 'tax_consultant', label: '费用预算核算' },
      ],
      triggerPhrases: ['留学全案', '留学规划', '出国留学方案', '帮我规划留学'],
    },
    {
      id: 'exam_strategy', name: '备考方案', icon: '📝',
      description: '水平评估 → 薄弱诊断 → 备考计划 → 资源推荐（2天→15分钟）',
      mode: 'sequential',
      estimatedTime: { human: '2 天', ai: '15 分钟' },
      aiRate: 0.90,
      deliverable: '个性化备考方案（分阶段路线图 + 周计划模板 + 推荐资源）',
      steps: [
        { id: 'level_assessment', agent: 'education', expert: 'education_tutor', label: '当前水平评估' },
        { id: 'weakness_diagnosis', agent: 'education', expert: 'education_tutor', label: '薄弱环节诊断' },
        { id: 'study_plan_generation', agent: 'education', expert: 'education_tutor', label: '备考计划生成' },
        { id: 'resource_recommendation', agent: 'education', expert: 'education_tutor', label: '学习资源推荐' },
      ],
      triggerPhrases: ['备考方案', '考试规划', '怎么备考', '学习计划', '高考备考', '考研规划'],
    },
    {
      id: 'exam_improvement', name: '学情诊断与提分', icon: '📊',
      description: '成绩采集 → 薄弱诊断 → 提分方案 → 费用核算 → 家长沟通（3天→30分钟）',
      mode: 'sequential',
      estimatedTime: { human: '3 天', ai: '30 分钟' },
      aiRate: 0.75,
      deliverable: '学情诊断报告（薄弱点分析 + 提分方案 + 补课费用建议）',
      steps: [
        { id: 'collect', agent: 'education', expert: 'education_tutor', label: '成绩采集与趋势分析' },
        { id: 'diagnose', agent: 'education', expert: 'education_tutor', label: '薄弱知识点诊断' },
        { id: 'improve', agent: 'education', expert: 'education_tutor', label: '提分方案生成' },
        { id: 'fee', agent: 'finance', expert: 'finance_accountant', label: '补课费用核算' },
      ],
      triggerPhrases: ['学情分析', '学情诊断', '提分方案', '成绩下滑', '薄弱项'],
    },
    {
      id: 'tuition_refund', name: '退费计算与合规', icon: '💸',
      description: '课时核算 → 退费计算 → 合规审查 → 退费确认（1天→10分钟）',
      mode: 'sequential',
      estimatedTime: { human: '1 天', ai: '10 分钟' },
      aiRate: 0.85,
      deliverable: '退费核算单（已消耗课时 + 应退金额 + 合规确认）',
      steps: [
        { id: 'hours_calc', agent: 'finance', expert: 'finance_accountant', label: '课时核算' },
        { id: 'refund_calc', agent: 'finance', expert: 'finance_accountant', label: '退费金额计算' },
        { id: 'compliance', agent: 'finance', expert: 'finance_accountant', label: '合规审查' },
      ],
      triggerPhrases: ['退费', '退课', '退学费', '学员退款'],
    },
  ],
  safetyRules: [
    { id: 'refund-compliance-check', label: '退费合规检查', trigger: '退费金额超过 5000 元或退费比例超过 50%', action: '自动核查退费条款合规性，提示校长审批' },
    { id: 'underage-data-protection', label: '未成年人数据保护', trigger: '涉及学生个人信息、成绩、家庭情况', action: '自动脱敏处理，仅授权教师可查看完整信息' },
    { id: 'exam-score-anomaly', label: '成绩异常波动预警', trigger: '学生单次考试成绩波动超过 20%', action: '橙色预警，提示老师关注并启动学情诊断' },
    { id: 'contract-auto-renew-guard', label: '自动续费防护', trigger: '课程即将到期且学员未明确续费意愿', action: '禁止自动扣款，发送续费确认通知' },
    { id: 'teacher-qualification-check', label: '教师资质校验', trigger: '新增或变更授课教师', action: '自动校验教师资格证信息，不合规阻止排课' },
  ],
  quickActions: [
    { id: 'quick-refund', label: '快速退费计算', icon: '💸', workflowId: 'tuition_refund', description: '输入课时和合同信息，秒出退费金额', cta: '计算退费' },
    { id: 'study-plan-gen', label: '学习方案生成', icon: '📋', workflowId: 'exam_strategy', description: '一键生成个性化备考/学习方案', cta: '生成方案' },
    { id: 'learning-report', label: '学情报告生成', icon: '📊', workflowId: 'exam_improvement', description: '自动汇总学生成绩趋势和薄弱项', cta: '生成报告' },
    { id: 'renewal-remind', label: '续费到期提醒', icon: '🔔', workflowId: 'renewal_analysis', description: '查看即将到期学员并生成续费方案', cta: '查看续费' },
    { id: 'score-convert-action', label: '分数快速换算', icon: '🔄', workflowId: 'exam_strategy', description: 'TOEFL/IELTS/DET/PTE 一键互转', cta: '立即换算' },
  ],
  scenarios: [
    { id: 'study_plan', label: '留学规划', icon: '✈️', prompt: '根据我的情况制定留学申请规划', expectedOutcome: '院校推荐清单（含录取率）+ 时间线 + 材料检查清单', expert: 'education.education_tutor', profitImpact: { dimension: 'revenue', amount: '招生转化率提升 30%，年增收 30 万+' } },
    { id: 'exam_prep', label: '考试备考', icon: '📝', prompt: '制定雅思/托福备考计划', expectedOutcome: '目标分数 + 周计划 + 薄弱项针对训练 + 模考安排', expert: 'education.education_tutor', profitImpact: { dimension: 'revenue', amount: '师资人效翻 3 倍，续费率提升 20%' } },
    { id: 'learning_report', label: '学情诊断', icon: '📊', prompt: '分析这位学生的学习情况并生成学情报告', expectedOutcome: '各科能力评估 + 进步趋势 + 薄弱点 + 下阶段提升方案', expert: 'education.education_tutor', profitImpact: { dimension: 'revenue', amount: '学情报告驱动续费和转介绍，年增收 20 万+' } },
    { id: 'refund_calc', label: '退费计算', icon: '💸', prompt: '计算这位学生的退费金额', expectedOutcome: '已消耗金额 + 违约金 + 应退金额 + 退费政策依据', expert: 'finance.finance_accountant', profitImpact: { dimension: 'loss_avoidance', amount: '精确退费避免纠纷，每单省 2000-5000 元' } },
    { id: 'pricing_advice', label: '课程定价', icon: '💰', prompt: '分析这门课程的合理定价区间', expectedOutcome: '成本分析 + 竞品对标 + 定价建议 + 利润预测', expert: 'finance.finance_accountant', profitImpact: { dimension: 'revenue', amount: '科学定价提高毛利率 5-10 个百分点' } },
  ],
}

export default educationTrainingSolution
