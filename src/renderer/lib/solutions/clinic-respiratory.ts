/**
 * 自动拆分自 solution-registry-data.ts。
 * 请勿手工编辑“结构”——如需改方案内容，请直接改本文件字段即可。
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const clinicRespiratorySolution: SolutionConfig = {
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
  enabledTabs: ['chat', 'tools', 'workflows', 'dashboard', 'knowledge-graph'],
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
    { cmd: '/用药', label: '用药审查', icon: '💊', description: '检查药物禁忌和相互作用' },
  ],
  safetyRules: [
    { id: 'critical-value-alert', label: '危急值报警', trigger: '检验结果达到危急值阈值（血气/电解质/凝血）', action: '红色弹窗报警，强制置顶显示' },
    { id: 'drug-allergy-block', label: '过敏药物拦截', trigger: '用药方案包含患者已知过敏药物', action: '阻断该方案，标红过敏药物，推荐替代' },
    { id: 'ventilator-safety', label: '呼吸机安全', trigger: '潮气量 >8ml/kg IBW 或 PEEP 超标', action: '警告肺保护策略违规，要求医生确认' },
    { id: 'discharge-criteria', label: '出院标准', trigger: '出院时尚有异常指标未复查', action: '提示未满足出院条件，列出待复查项目' },
    { id: 'ai-disclaimer', label: 'AI 免责声明', trigger: '所有 AI 输出的诊疗建议', action: '底部固定：AI 辅助建议仅供参考，最终诊疗决策由执业医师负责' },
  ],
  quickActions: [
    { id: 'quick-score', label: '快速评分', icon: '🩺', workflowId: 'copd_management', description: '选择量表（CURB-65/CAT/mMRC/SOFA），秒出结果', cta: '开始评分' },
    { id: 'pft-read', label: '肺功能解读', icon: '🫁', toolId: 'pft', description: '上传报告，1 分钟获得完整解读', cta: '上传报告' },
    { id: 'vent-calc', label: '呼吸机参数', icon: '💨', toolId: 'ventilator', description: '输入体重和病情，AI 计算初始参数', cta: '计算参数' },
    { id: 'drug-check', label: '用药审查', icon: '💊', description: '输入用药清单，自动检查禁忌和交互', cta: '审查用药' },
    { id: 'pneumonia-triage', label: '肺炎分诊', icon: '🏥', workflowId: 'pneumonia_triage', description: 'CURB-65 评分+收治决策+抗生素方案', cta: '开始分诊' },
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
}

export default clinicRespiratorySolution
