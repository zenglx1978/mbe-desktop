/**
 * 健康顾问 AI 助理 — Desktop 配置
 * 对应 solutions/clinic-respiratory/solution.yaml v4.0.0
 *
 * 双轨定位（对标律师顾问模式）：
 *   轨道一（consumer）：为个人提供就医咨询/营养指导/健身训练/身体保健
 *   轨道二（professional）：为医生/营养师/健身教练/护士/健康管理师提供专业自训工具
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const clinicRespiratorySolution: SolutionConfig = {
  id: 'clinic-respiratory',
  name: '健康顾问 AI 助理',
  icon: '❤️',
  color: '#16a34a',
  tagline: '你的私人健康顾问——就医咨询、营养指导、健身训练、身体保健，一站全覆盖',
  description:
    '就像律师为个人提供法律顾问服务，健康顾问 AI 为每个人提供专属健康参谋：' +
    '症状评估帮你判断要不要去医院，营养方案替代昂贵面诊，科学健身计划替代高价私教，' +
    '体检报告解读让指标不再看不懂。' +
    '同时也是医生、营养师、健身教练、护士的专业自训工具：案例演练、知识更新、技能查缺。',
  entrepreneurPurpose: '双轨健康顾问：每个人的私人健康参谋 × 每个从业者的专业进修伙伴',
  profitMetrics: [
    '就医咨询：避免不必要急诊就医 1-3 次/年，节省时间和费用',
    '营养指导：替代营养师面诊（¥500-2000/次），AI 按需获取个性化方案',
    '健身计划：AI 私教替代线下私教（¥300-500/节），高频低成本',
    '专业自训：替代专业书籍/继教课程，及时获取最新循证证据和案例演练',
  ],
  valueEquivalent: { humanHours: 2, mbeMinutes: 5, acceleration: '24x' },
  agents: [
    agent('pulmonary', 8005, '全科健康顾问医生', '症状评估 / 就医咨询 / 体检解读 / 慢病保健 / 临床案例'),
    agent('pulmonary', 8005, 'AI 健康教练', '营养指导 / 膳食方案 / 健身计划 / 运动处方 / 体能训练'),
  ],
  localScripts: ['calc_bmr', 'calc_bmi', 'calc_heart_rate_zone', 'calc_clinical_score'],
  knowledgeCache: ['nutrition_guidelines', 'fitness_guidelines', 'common_symptoms', 'clinical_guidelines'],
  theme: { primary: '142 71% 45%', accent: '142 71% 45%', sidebarBg: '142 30% 8%' },
  enabledTabs: ['chat', 'tools', 'workflows', 'dashboard'],
  onboarding: {
    questions: [
      {
        key: 'user_track',
        label: '你使用健康顾问 AI 的主要目的是',
        options: [
          '个人健康管理（就医咨询/营养/健身/体检解读）',
          '专业自训（我是健康从业者，用于学习和提升）',
          '两者都有',
        ],
      },
      {
        key: 'professional_type',
        label: '（专业人员）你的职业方向',
        options: ['全科/社区医生', '注册营养师/营养咨询师', '健身教练/运动康复师', '护士/健康管理师', '其他健康保健从业者'],
        showIf: 'user_track != 个人健康管理',
      },
      {
        key: 'health_goal',
        label: '（个人用户）最想解决的健康问题',
        options: ['就医咨询（症状/体检解读）', '体重管理（减脂/增肌）', '营养改善', '健身训练', '综合健康管理'],
        showIf: 'user_track != 专业自训',
      },
    ],
  },
  tools: [
    {
      id: 'bmi-calc', type: 'calculator', name: 'BMI & 体重分析', icon: '⚖️',
      agent: 'pulmonary', apiPath: '/api/pulmonary/calc/bmi', localScript: 'calc_bmi',
      description: '计算 BMI、理想体重范围、健康体重目标',
      fields: [
        { key: 'height', label: '身高（cm）', type: 'number', required: true },
        { key: 'weight', label: '体重（kg）', type: 'number', required: true },
        { key: 'age',    label: '年龄',       type: 'number', required: true },
        { key: 'gender', label: '性别', type: 'select', required: true,
          options: [{ value: 'male', label: '男' }, { value: 'female', label: '女' }] },
      ],
    },
    {
      id: 'bmr-calc', type: 'calculator', name: '每日热量需求', icon: '🔥',
      agent: 'pulmonary', apiPath: '/api/pulmonary/calc/bmr', localScript: 'calc_bmr',
      description: '基础代谢率 + 活动量 → 每日热量目标（减重/维持/增肌）',
      fields: [
        { key: 'height',   label: '身高（cm）', type: 'number', required: true },
        { key: 'weight',   label: '体重（kg）', type: 'number', required: true },
        { key: 'age',      label: '年龄', type: 'number', required: true },
        { key: 'gender',   label: '性别', type: 'select', required: true,
          options: [{ value: 'male', label: '男' }, { value: 'female', label: '女' }] },
        { key: 'activity', label: '活动量', type: 'select', required: true,
          options: [
            { value: '1.2',  label: '久坐（少运动）' },
            { value: '1.375',label: '轻度活动（1-3次/周）' },
            { value: '1.55', label: '中度活动（3-5次/周）' },
            { value: '1.725',label: '高强度（6-7次/周）' },
          ] },
        { key: 'goal', label: '目标', type: 'select', required: true,
          options: [
            { value: 'lose',     label: '减重（-500kcal/日）' },
            { value: 'maintain', label: '维持体重' },
            { value: 'gain',     label: '增肌（+300kcal/日）' },
          ] },
      ],
    },
    {
      id: 'heart-rate-zone', type: 'calculator', name: '运动心率区间', icon: '💓',
      agent: 'pulmonary', apiPath: '/api/pulmonary/calc/heart-rate-zone', localScript: 'calc_heart_rate_zone',
      description: '计算燃脂/有氧/无氧各区间目标心率',
      fields: [
        { key: 'age',        label: '年龄', type: 'number', required: true },
        { key: 'resting_hr', label: '静息心率（次/分）', type: 'number', required: true },
        { key: 'condition',  label: '心脏病史', type: 'select', required: true,
          options: [{ value: 'no', label: '无' }, { value: 'yes', label: '有（保守区间）' }] },
      ],
    },
  ],
  slashCommands: [
    // 消费者轨道
    { command: '/症状',   label: '症状咨询',    workflowId: 'symptom_triage' },
    { command: '/体检',   label: '体检解读',    workflowId: 'health_report_review' },
    { command: '/营养',   label: '营养方案',    workflowId: 'nutrition_consultation' },
    { command: '/减肥',   label: '体重管理',    workflowId: 'weight_management' },
    { command: '/健身',   label: '健身计划',    workflowId: 'fitness_assessment' },
    { command: '/风险',   label: '健康风险',    workflowId: 'wellness_assessment' },
    // 专业人员轨道
    { command: '/指南',   label: '知识更新',    workflowId: 'knowledge_update' },
    { command: '/案例',   label: '案例演练',    workflowId: 'case_practice' },
    { command: '/查缺',   label: '技能查缺',    workflowId: 'skill_gap_assessment' },
  ],
  safetyRules: [
    { id: 'emergency-alert',         label: '急症预警',     level: 'critical', description: '危急症状立即提示拨打 120' },
    { id: 'no-prescription',         label: '不开处方',     level: 'hard',     description: '拒绝开具处方药，可参考 OTC' },
    { id: 'pediatric-conservative',  label: '儿童保守',     level: 'hard',     description: '14 岁以下采用保守标准，倾向建议就医' },
    { id: 'pregnancy-flag',          label: '孕期警示',     level: 'hard',     description: '孕期营养/症状标注禁忌，建议专科' },
    { id: 'fitness-contraindication',label: '运动禁忌',     level: 'medium',   description: '心脏病/手术后等禁忌提醒' },
    { id: 'professional-scope',      label: '专业边界',     level: 'medium',   description: '专业自训 AI 供学习参考，实际方案由从业者本人负责' },
    { id: 'ai-disclaimer',           label: 'AI 免责声明',  level: 'info',     description: 'AI 建议仅供参考，具体诊疗遵医嘱' },
  ],
  quickActions: [
    // ── 个人用户 ──
    {
      id: 'symptom-check',
      icon: '🩺',
      label: '症状咨询',
      description: '描述症状，判断严重程度、是否需要就医、看哪个科',
      workflowId: 'symptom_triage',
    },
    {
      id: 'nutrition-plan',
      icon: '🥗',
      label: '营养方案',
      description: '基于饮食习惯和目标，定制个性化膳食方案',
      workflowId: 'nutrition_consultation',
    },
    {
      id: 'fitness-plan',
      icon: '🏃',
      label: '健身计划',
      description: '体能评估 + 科学训练计划（减脂/增肌/体态纠正）',
      workflowId: 'fitness_assessment',
    },
    {
      id: 'report-review',
      icon: '📋',
      label: '体检解读',
      description: '异常指标逐项解释，评估是否需要复查或就医',
      workflowId: 'health_report_review',
    },
    {
      id: 'visit-prep',
      icon: '🏥',
      label: '就医准备',
      description: '告诉 AI 你要看什么科，生成个性化就医清单',
      workflowId: 'visit_preparation',
    },
    // ── 专业人员 ──
    {
      id: 'case-practice',
      icon: '🎯',
      label: '案例演练',
      description: '（专业人员）AI 出题 → 你作答 → 循证点评，锻炼决策能力',
      workflowId: 'case_practice',
    },
    {
      id: 'knowledge-update',
      icon: '📚',
      label: '知识更新',
      description: '（专业人员）获取最新指南/研究/运动科学进展要点',
      workflowId: 'knowledge_update',
    },
    {
      id: 'skill-check',
      icon: '🔍',
      label: '技能查缺',
      description: '（专业人员）评估知识盲区，生成个性化学习路径',
      workflowId: 'skill_gap_assessment',
    },
  ],
  workflows: [
    // ── 消费者：就医咨询 ──
    {
      id: 'symptom_triage',
      name: '症状初步评估',
      description: '症状采集 → 红旗征排查 → 严重度分级 → 科室推荐 → 就医建议',
      steps: [
        { label: '症状信息采集',   agent: 'pulmonary', expert: 'general_physician', description: '部位/时间/性质/伴随症状' },
        { label: '危急信号排查',   agent: 'pulmonary', expert: 'general_physician', description: '红旗征识别' },
        { label: '严重程度分级',   agent: 'pulmonary', expert: 'general_physician', description: '🟢 观察 / 🟡 尽快就医 / 🔴 急诊' },
        { label: '科室推荐',       agent: 'pulmonary', expert: 'general_physician', description: '具体科室和最佳就医时机' },
        { label: '就医前建议',     agent: 'pulmonary', expert: 'general_physician', description: '就医前注意事项' },
      ],
    },
    {
      id: 'visit_preparation',
      name: '就医准备清单',
      description: '确认科室 → 生成清单 → 检查告知 → 问诊表达',
      steps: [
        { label: '确认就诊信息',   agent: 'pulmonary', expert: 'general_physician', description: '科室/主诉/既往史' },
        { label: '生成准备清单',   agent: 'pulmonary', expert: 'general_physician', description: '资料/禁食/穿着' },
        { label: '检查项目告知',   agent: 'pulmonary', expert: 'general_physician', description: '可能做的检查提前了解' },
        { label: '问诊表达技巧',   agent: 'pulmonary', expert: 'general_physician', description: '如何清晰描述症状给医生' },
      ],
    },
    {
      id: 'health_report_review',
      name: '体检报告解读',
      description: '基本信息 → 异常指标解读 → 健康风险 → 改善建议 → 是否就医',
      steps: [
        { label: '基本信息录入',   agent: 'pulmonary', expert: 'general_physician', description: '年龄/性别/BMI/既往史' },
        { label: '异常指标逐项解读', agent: 'pulmonary', expert: 'general_physician', description: '每项偏高/偏低含义' },
        { label: '健康风险评估',   agent: 'pulmonary', expert: 'general_physician', description: '心血管/代谢/肿瘤标志物' },
        { label: '改善建议',       agent: 'pulmonary', expert: 'general_physician', description: '饮食/运动/复查节奏' },
        { label: '是否需要就医',   agent: 'pulmonary', expert: 'general_physician', description: '哪些指标需要尽快就诊' },
      ],
    },
    // ── 消费者：营养指导 ──
    {
      id: 'nutrition_consultation',
      name: '个性化营养指导',
      description: '饮食评估 → 营养分析 → 目标确认 → 膳食方案 → 实践技巧',
      steps: [
        { label: '饮食习惯评估',   agent: 'pulmonary', expert: 'health_coach', description: '三日饮食/偏好/过敏/忌口' },
        { label: '营养素摄入分析', agent: 'pulmonary', expert: 'health_coach', description: '能量/蛋白质/脂肪/碳水/微量元素缺口' },
        { label: '目标设定',       agent: 'pulmonary', expert: 'health_coach', description: '减重/增肌/慢病/孕期/儿童发育' },
        { label: '个性化膳食方案', agent: 'pulmonary', expert: 'health_coach', description: '一周食谱 + 份量指导' },
        { label: '实践技巧',       agent: 'pulmonary', expert: 'health_coach', description: '外出就餐/健康零食/补剂参考' },
      ],
    },
    {
      id: 'weight_management',
      name: '体重管理方案',
      description: 'BMR 计算 → 体成分评估 → 目标设定 → 热量方案 → 食物替换',
      steps: [
        { label: 'BMR & 热量需求', agent: 'pulmonary', expert: 'health_coach', description: '基础代谢率+每日消耗计算' },
        { label: '体成分评估',     agent: 'pulmonary', expert: 'health_coach', description: 'BMI/体脂现状分析' },
        { label: '健康目标设定',   agent: 'pulmonary', expert: 'health_coach', description: '0.5-1kg/周健康节奏' },
        { label: '热量方案设计',   agent: 'pulmonary', expert: 'health_coach', description: '摄入量 + 消耗量平衡' },
        { label: '食物替换清单',   agent: 'pulmonary', expert: 'health_coach', description: '可操作饮食调整建议' },
      ],
    },
    // ── 消费者：健身训练 ──
    {
      id: 'fitness_assessment',
      name: '体能评估与健身计划',
      description: '能力评估 → 目标确认 → 禁忌排查 → 训练计划 → 常见错误',
      steps: [
        { label: '运动能力评估',   agent: 'pulmonary', expert: 'health_coach', description: '有氧/力量/柔韧/平衡现状' },
        { label: '目标确认',       agent: 'pulmonary', expert: 'health_coach', description: '减脂/增肌/改善心肺/体态纠正' },
        { label: '运动禁忌排查',   agent: 'pulmonary', expert: 'health_coach', description: '心脏/关节/血压等禁忌' },
        { label: '训练计划生成',   agent: 'pulmonary', expert: 'health_coach', description: '周频次/动作组合/进阶路径' },
        { label: '常见错误纠正',   agent: 'pulmonary', expert: 'health_coach', description: '训练注意事项和错误提醒' },
      ],
    },
    {
      id: 'exercise_prescription',
      name: '运动处方（慢病/康复）',
      description: '病史核查 → 安全强度 → 慢病运动推荐 → FITT 处方 → 确认',
      steps: [
        { label: '病史和用药核查', agent: 'pulmonary', expert: 'general_physician', description: '慢性病/用药/手术史' },
        { label: '安全运动强度',   agent: 'pulmonary', expert: 'general_physician', description: '目标心率区间/禁忌动作' },
        { label: '慢病运动推荐',   agent: 'pulmonary', expert: 'health_coach',     description: '高血压/糖尿病/骨质疏松友好运动' },
        { label: 'FITT 运动处方',  agent: 'pulmonary', expert: 'health_coach',     description: '频率/强度/时间/类型处方' },
        { label: '用户确认',       mode: 'hitl',                                    description: '确认处方并设定追踪计划' },
      ],
    },
    // ── 消费者：身体保健 ──
    {
      id: 'wellness_assessment',
      name: '健康风险筛查',
      description: '生活方式 → 心血管风险 → 代谢风险 → 癌症筛查 → 改善优先级',
      steps: [
        { label: '生活方式问卷',   agent: 'pulmonary', expert: 'general_physician', description: '睡眠/压力/饮酒/吸烟/活动' },
        { label: '心血管风险',     agent: 'pulmonary', expert: 'general_physician', description: '十年心血管事件风险' },
        { label: '代谢综合征',     agent: 'pulmonary', expert: 'general_physician', description: '腰围/血压/血糖/血脂' },
        { label: '癌症筛查建议',   agent: 'pulmonary', expert: 'general_physician', description: '按年龄/性别/家族史' },
        { label: '改善优先级',     agent: 'pulmonary', expert: 'general_physician', description: '从高风险到可观察分级排序' },
      ],
    },
    // ── 专业人员自训 ──
    {
      id: 'knowledge_update',
      name: '专业知识更新',
      description: '主题选择 → 核心要点 → 与旧知识对比 → 实践应用建议',
      steps: [
        { label: '主题选择',       agent: 'pulmonary', expert: 'general_physician', description: '指南/营养研究/运动科学/临床进展' },
        { label: '核心要点讲解',   agent: 'pulmonary', expert: 'general_physician', description: '要点+证据级别+来源' },
        { label: '知识更新对比',   agent: 'pulmonary', expert: 'general_physician', description: '与旧认知的差异和变化' },
        { label: '实践应用建议',   agent: 'pulmonary', expert: 'general_physician', description: '如何用于自己的工作实践' },
      ],
    },
    {
      id: 'case_practice',
      name: '专业案例演练',
      description: '场景设定 → 案例呈现 → 从业者作答 → AI 循证点评 → 盲区补充',
      steps: [
        { label: '场景设定',       agent: 'pulmonary', expert: 'general_physician', description: '难度/方向：临床/营养/健身/护理' },
        { label: '案例情景呈现',   agent: 'pulmonary', expert: 'general_physician', description: '患者/客户信息分批披露' },
        { label: '从业者独立作答', mode: 'hitl',                                    description: '从业者输出自己的判断和方案' },
        { label: 'AI 循证点评',    agent: 'pulmonary', expert: 'general_physician', description: '对标循证标准，指出对/错/改进点' },
        { label: '盲区针对补充',   agent: 'pulmonary', expert: 'general_physician', description: '识别知识盲区并补充讲解' },
      ],
    },
    {
      id: 'skill_gap_assessment',
      name: '专业技能查缺',
      description: '职业方向确认 → 能力自评 → 盲区诊断 → 学习路径推荐',
      steps: [
        { label: '职业方向确认',   agent: 'pulmonary', expert: 'general_physician', description: '医生/营养师/健身教练/护士/健康管理师' },
        { label: '核心能力自评',   agent: 'pulmonary', expert: 'general_physician', description: '各细分技能自信度 1-5 评分' },
        { label: '知识盲区诊断',   agent: 'pulmonary', expert: 'general_physician', description: '结合答题准确率定位薄弱点' },
        { label: '学习路径推荐',   agent: 'pulmonary', expert: 'general_physician', description: '优先补哪些知识、推荐资源' },
      ],
    },
  ],
}

export default clinicRespiratorySolution
