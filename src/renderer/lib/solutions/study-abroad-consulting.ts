/**
 * 自动拆分自 solution-registry-data.ts。
 * 请勿手工编辑“结构”——如需改方案内容，请直接改本文件字段即可。
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const studyAbroadConsultingSolution: SolutionConfig = {
  id: 'study-abroad-consulting',
  name: '留学咨询智能运营方案',
  icon: '✈️',
  color: '#06b6d4',
  tagline: '一个顾问服务 50 个学生 — 留学机构人效翻 5 倍',
  description:
    '专注国际教育/出国留学：留学规划、IELTS/TOEFL 等标化备考、院校申请与文书时间线、签证与面签、海外费用与资金规划。与「教培机构」方案互补——后者主攻国内 K12/高考/考研/职教/医学继教等；若主业是海外申请全链路请选本方案。',
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
  enabledTabs: ['today', 'chat', 'tools', 'workflows', 'knowledge-graph'],
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
      mode: 'single',
      deliverable: '选校推荐清单（冲/稳/保各 2-3 所 + 录取概率 + 费用对比）',
      successCriteria: ['每所院校标注录取概率区间', '含学费和生活费对比', '覆盖 ≥ 3 个梯度'],
      steps: [
        { id: 'step1_school_matching', agent: 'education', expert: 'education_tutor', label: '智能选校匹配',
          goal: '评估背景 + 输出冲/稳/保各梯度院校推荐',
          successCriteria: ['GPA和标化成绩对标目标院校', '每梯度 ≥ 2 所院校', '含专业排名和申请截止日期'],
          profitImpact: { dimension: 'revenue', amount: '选校方案 3 天→30 分钟，人效翻 5 倍' } },
      ],
      triggerPhrases: ['选校', '推荐学校', '院校匹配'],
    },
    {
      id: 'exam_strategy', name: '考试备考规划', icon: '📝',
      description: '根据目标分数和备考周期，制定 IELTS/TOEFL/GRE/GMAT 备考方案',
      mode: 'single',
      deliverable: '个性化备考方案（周计划 + 薄弱项训练 + 模考安排 + 资料推荐）',
      successCriteria: ['备考周期精确到周', '薄弱项有针对性训练计划', '含模考和阶段目标'],
      steps: [
        { id: 'step1_exam_plan', agent: 'education', expert: 'education_tutor', label: '备考方案制定',
          goal: '根据当前水平和目标分数制定详细备考方案',
          successCriteria: ['每周学习计划含课时分配', '各科目薄弱项有针对性训练', '含模考安排和成绩预期曲线'],
          profitImpact: { dimension: 'revenue', amount: '高效备考方案提升签约转化率，咨询费每单 +2000' } },
      ],
      triggerPhrases: ['备考', '雅思计划', '托福计划', 'GRE备考'],
    },
    {
      id: 'application_plan', name: '申请全规划', icon: '📑',
      description: '从选校到文书到递交的完整申请时间线（T-18 月到入学）',
      mode: 'single',
      deliverable: '申请全流程时间线（选校→文书→推荐信→网申→面试→签证→行前）',
      successCriteria: ['时间线精确到月', '每阶段有明确交付物', '标注所有截止日期'],
      steps: [
        { id: 'step1_application', agent: 'education', expert: 'education_tutor', label: '申请时间线规划',
          goal: '输出从现在到入学的完整申请时间线',
          successCriteria: ['覆盖选校/文书/推荐信/网申/面试/签证全流程', '每阶段标注截止日期和所需材料'],
          profitImpact: { dimension: 'loss_avoidance', amount: '避免错过截止日导致退费纠纷，每单省 2-5 万' } },
      ],
      triggerPhrases: ['申请规划', '申请时间线', '什么时候该做什么'],
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
    {
      id: 'visa_guide', name: '签证指导', icon: '🛂',
      description: '根据目标国家和录取情况，提供签证材料清单、面签准备、时间规划',
      mode: 'single',
      deliverable: '签证指导报告（材料清单 + 面签准备 + 时间规划 + 常见问题）',
      successCriteria: ['材料清单覆盖所有必需文件', '面签问答有模拟练习', '时间规划标注预约和递签日期'],
      steps: [
        { id: 'step1_visa', agent: 'education', expert: 'education_tutor', label: '签证申请指导',
          goal: '提供完整的签证申请指导方案',
          successCriteria: ['材料清单含原件/复印件/翻译件要求', '面签准备含常见问题和回答策略', '时间规划含预约到获签全流程'],
          profitImpact: { dimension: 'loss_avoidance', amount: '避免签证被拒导致退费，每单省 1-3 万' } },
      ],
      triggerPhrases: ['签证', '面签', '签证材料'],
    },
  ],
  safetyRules: [
    { id: 'passport-data-protection', label: '护照信息保护', trigger: '对话涉及护照号、签证号、身份证号', action: '自动脱敏显示，仅授权顾问可查看完整信息' },
    { id: 'deadline-miss-alert', label: '申请截止日预警', trigger: '距申请截止日 ≤ 30 天且材料未齐', action: '红色弹窗预警，通知顾问和学生，标注缺失材料' },
    { id: 'financial-proof-check', label: '资金证明合规检查', trigger: '签证资金证明金额低于目标国最低要求', action: '橙色预警，提示补充资金证明方案' },
    { id: 'score-validity-guard', label: '成绩有效期校验', trigger: '标化成绩在申请时已过有效期', action: '红色预警，提示重考并调整申请时间线' },
    { id: 'visa-rejection-risk', label: '拒签风险预警', trigger: '学生背景命中拒签高风险因素', action: '橙色预警，输出风险点清单和规避建议' },
    { id: 'fee-overcharge-guard', label: '咨询费用透明化', trigger: '留学咨询费超过行业均价 50%', action: '提示费用对比，确保收费透明合规' },
  ],
  quickActions: [
    { id: 'quick-school-match', label: '快速选校', icon: '🏫', workflowId: 'school_matching', description: '输入 GPA 和成绩，秒出冲/稳/保院校推荐', cta: '立即匹配' },
    { id: 'quick-cost-estimate', label: '费用估算', icon: '💰', workflowId: 'full_abroad_plan', description: '一键估算目标国留学年度总费用', cta: '估算费用' },
    { id: 'quick-timeline', label: '申请时间线', icon: '📅', workflowId: 'application_plan', description: '输入目标入学时间，自动生成倒推时间线', cta: '生成时间线' },
    { id: 'quick-visa-checklist', label: '签证材料清单', icon: '🛂', workflowId: 'visa_guide', description: '一键输出目标国签证材料完整清单', cta: '获取清单' },
    { id: 'quick-exam-plan', label: '备考方案', icon: '📝', workflowId: 'exam_strategy', description: '输入目标分数，自动生成备考周计划', cta: '生成方案' },
    { id: 'quick-score-convert', label: '分数换算', icon: '🔄', workflowId: 'exam_strategy', description: 'TOEFL/IELTS/DET/PTE 四向互转', cta: '立即换算' },
  ],
  scenarios: [
    { id: 'school_match', label: '智能选校', icon: '🏫', prompt: '根据我的 GPA 和成绩推荐留学院校', expectedOutcome: '冲/稳/保各 2-3 所院校推荐 + 录取概率 + 费用对比', expert: 'education.education_tutor', profitImpact: { dimension: 'revenue', amount: '方案更快更准，签约转化率从 30% 提到 50%' } },
    { id: 'exam_plan', label: '备考规划', icon: '📝', prompt: '制定雅思/托福备考计划', expectedOutcome: '目标分数 + 周计划 + 薄弱项训练 + 模考安排', expert: 'education.education_tutor', profitImpact: { dimension: 'revenue', amount: '备考方案效率提升，顾问人效翻 5 倍' } },
    { id: 'cost_estimate', label: '费用预算', icon: '💰', prompt: '估算留学一年总费用', expectedOutcome: '学费+生活费+签证+机票各项明细 + 资金规划', workflowId: 'full_abroad_plan', profitImpact: { dimension: 'loss_avoidance', amount: '精确费用预算，避免退费纠纷损失数万' } },
    { id: 'visa_guide', label: '签证指导', icon: '🛂', prompt: '指导签证申请流程和材料准备', expectedOutcome: '签证材料清单 + 面签准备 + 时间规划', expert: 'education.education_tutor', profitImpact: { dimension: 'loss_avoidance', amount: '避免签证被拒导致退费，每单省 1-3 万' } },
  ],
}

export default studyAbroadConsultingSolution
