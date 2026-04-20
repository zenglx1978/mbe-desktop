/**
 * 自动拆分自 solution-registry-data.ts。
 * 请勿手工编辑“结构”——如需改方案内容，请直接改本文件字段即可。
 */
import type { SolutionConfig } from '../solution-router'
import { agent } from '../solution-router-agent'

export const professionalServiceMarketingSolution: SolutionConfig = {
  id: 'professional-service-marketing',
  name: '专业服务机构智能营销方案',
  icon: '📣',
  color: '#7c3aed',
  tagline: '月成本 ¥160 替代 ¥16,000 外包团队 — 19+ 篇/周全渠道内容',
  description: '将 Growth + Sales + CS 三大 Agent 编排为专业服务机构（律所/会计所/咨询/SaaS）的全链路数字营销方案。内容获客 → 线索漏斗 → 客户激活 → 效果归因，MBE 自身是第 0 号客户（Dogfood）。',
  entrepreneurPurpose: '月成本 ¥160 实现 19+ 篇/周全渠道内容产出，替代 ¥16,000/月外包团队',
  profitMetrics: ['内容效率 120-480 倍', '线索培育人效翻 5 倍', 'RFM 激活复购率 +15-30%'],
  valueEquivalent: { humanHours: 80, mbeMinutes: 30, acceleration: '160x' },
  agents: [
    agent('growth', 8009, '增长策略专家', '内容策划、选题排期、Newsletter、渠道 ROI 归因'),
    agent('sales', 8008, '线索培育专家', '线索评分、BANT 认定、培育邮件序列'),
    agent('cs', 8004, '客户激活专家', '沉睡客户分群、RFM 激活、满意度提升'),
  ],
  localScripts: [],
  knowledgeCache: [],
  theme: { primary: '263 70% 50%', accent: '263 70% 50%' },
  enabledTabs: ['chat', 'tools', 'workflows', 'dashboard', 'knowledge-graph'],
  tools: [
    {
      id: 'content-calendar', type: 'doc-generator', name: '内容排期生成', icon: '📅',
      agent: 'growth', apiPath: '/api/growth/ai/content-calendar',
      description: 'AI 生成本周 5 平台内容排期（主题/标题/格式/发布时间）',
      fields: [
        { key: 'industry', label: '行业', type: 'text', required: true, placeholder: '如：律所/会计所/SaaS' },
        { key: 'platforms', label: '平台', type: 'text', required: true, placeholder: '公众号,小红书,知乎,抖音' },
        { key: 'selling_points', label: '核心卖点', type: 'textarea', required: true },
      ],
    },
    {
      id: 'lead-scorer', type: 'calculator', name: '线索评分器', icon: '📊',
      agent: 'sales', apiPath: '/api/sales/calc/lead-score',
      description: 'Fit+Intent+Timing 三维度评分，输出线索优先级',
      fields: [
        { key: 'company_size', label: '公司规模', type: 'select', required: true,
          options: [
            { value: 'micro', label: '微型（< 10 人）' }, { value: 'small', label: '小型' },
            { value: 'medium', label: '中型' }, { value: 'large', label: '大型（> 200 人）' },
          ] },
        { key: 'engagement', label: '互动程度', type: 'select', required: true,
          options: [
            { value: 'high', label: '高（下载/试用/咨询）' },
            { value: 'medium', label: '中（浏览/注册）' },
            { value: 'low', label: '低（仅访问）' },
          ] },
      ],
    },
    {
      id: 'roi-calc', type: 'calculator', name: '渠道 ROI 计算器', icon: '📈',
      agent: 'growth', apiPath: '/api/growth/calc/channel-roi',
      description: '计算各渠道投入产出比，输出预算优化建议',
      fields: [
        { key: 'channel', label: '渠道', type: 'text', required: true },
        { key: 'spend', label: '投入（元）', type: 'currency', required: true },
        { key: 'leads', label: '获取线索数', type: 'number', required: true },
        { key: 'conversions', label: '付费转化数', type: 'number', required: true },
        { key: 'revenue', label: '带来收入（元）', type: 'currency', required: true },
      ],
    },
  ],
  slashCommands: [
    { cmd: '/排期', label: '内容排期', icon: '📅', toolId: 'content-calendar' },
    { cmd: '/评分', label: '线索评分', icon: '📊', toolId: 'lead-scorer' },
    { cmd: '/ROI', label: '渠道ROI', icon: '📈', toolId: 'roi-calc' },
  ],
  safetyRules: [
    { id: 'brand-consistency', label: '品牌一致性检查', trigger: '生成的内容与品牌语调/视觉标准不一致', action: '橙色提示，标注不一致要素并提供修正建议' },
    { id: 'competitor-mention', label: '竞品提及审查', trigger: '内容中直接提及竞品品牌名或进行不当对比', action: '橙色预警，提示修改为行业术语或通用描述' },
    { id: 'unsubscribe-alert', label: '退订率异常预警', trigger: '邮件退订率超过 2% 或投诉率超过 0.1%', action: '红色预警，暂停发送并分析原因' },
    { id: 'data-privacy', label: '数据隐私合规', trigger: '营销活动涉及用户个人数据采集或画像', action: '自动检查是否符合《个人信息保护法》要求' },
    { id: 'roi-negative', label: '负 ROI 渠道预警', trigger: '单渠道连续 2 周 ROI < 1', action: '橙色预警，建议暂停投放并分析优化方向' },
    { id: 'content-plagiarism', label: '内容查重检查', trigger: 'AI 生成内容与已发布内容相似度超过 30%', action: '橙色提示，标注重复段落并建议重写' },
  ],
  quickActions: [
    { id: 'quick-content-week', label: '本周内容排期', icon: '📅', workflowId: 'weekly_content_pipeline', description: '一键生成 5 平台内容排期', cta: '生成排期' },
    { id: 'quick-lead-score', label: '线索评分', icon: '📊', workflowId: 'lead_nurture_funnel', description: '批量评分新注册线索', cta: '开始评分' },
    { id: 'quick-reactivate', label: '沉睡客户激活', icon: '🔔', workflowId: 'customer_reactivation', description: '分析沉睡客户并生成激活方案', cta: '开始激活' },
    { id: 'quick-roi-report', label: '渠道 ROI 报告', icon: '📈', workflowId: 'roi_attribution', description: '一键生成渠道 ROI 排名和预算建议', cta: '生成报告' },
    { id: 'quick-pricing', label: '竞品定价分析', icon: '💰', workflowId: 'pricing_analysis', description: '输入竞品名单，AI 输出定价对标矩阵', cta: '开始分析' },
  ],
  workflows: [
    {
      id: 'weekly_content_pipeline', name: '每周内容生产流水线', icon: '📝',
      description: 'AI 选题策划 → 批量内容生成 → 平台适配 → 排期发布 → Newsletter',
      mode: 'sequential',
      deliverable: '本周 5 平台 × 4 篇专业内容 + Newsletter',
      successCriteria: ['覆盖 5 个目标平台', '内容与品牌语调一致', 'Newsletter 打开率 ≥ 25%'],
      steps: [
        { id: 'topic', agent: 'growth', expert: 'content_strategist', label: '选题策划',
          goal: 'AI 基于热点+SEO+竞品分析生成 20 篇选题', successCriteria: ['覆盖核心关键词', '匹配目标受众痛点'],
          profitImpact: { dimension: 'revenue', amount: '内容获客成本从 ¥200/篇降至 ¥2/篇' } },
        { id: 'create', agent: 'growth', expert: 'content_creator', label: '内容批量生成',
          goal: 'AI 批量生成 5 平台适配内容', successCriteria: ['各平台格式规范', '内容专业度评分 ≥ 4/5'],
          profitImpact: { dimension: 'cost_saving', amount: '月省外包费 ¥15,000+' } },
        { id: 'newsletter', agent: 'growth', expert: 'newsletter_editor', label: 'Newsletter 编辑',
          goal: '编辑周报邮件内容', successCriteria: ['打开率 ≥ 25%', '退订率 < 0.5%'],
          profitImpact: { dimension: 'revenue', amount: 'Newsletter 转化率提升 2-5%' } },
      ],
      triggerPhrases: ['内容排期', '本周内容', '内容生产'],
    },
    {
      id: 'lead_nurture_funnel', name: '线索自动培育漏斗', icon: '📊',
      description: '新注册用户 → 画像分析 → 线索评分 → 自动培育 → 转化跟进',
      mode: 'sequential',
      deliverable: '线索评分报告 + 7-14 天培育邮件序列 + 高分线索跟进方案',
      successCriteria: ['注册→付费转化率 ≥ 3%', '培育邮件打开率 ≥ 30%'],
      steps: [
        { id: 'profile', agent: 'sales', expert: 'customer_analyst', label: '画像分析与评分',
          goal: '分析注册信息，Fit+Intent+Timing 三维评分', successCriteria: ['评分完整', '分群清晰'],
          profitImpact: { dimension: 'revenue', amount: '精准培育使转化率翻 3 倍' } },
        { id: 'nurture', agent: 'growth', expert: 'newsletter_editor', label: '培育序列生成',
          goal: '按评分生成差异化培育邮件序列', successCriteria: ['邮件主题行 CTR ≥ 3%', '内容个性化'],
          profitImpact: { dimension: 'cost_saving', amount: '替代 SDR 人工跟进，人效翻 5 倍' } },
      ],
      triggerPhrases: ['线索培育', '新注册', '线索评分'],
    },
  ],
  scenarios: [
    { id: 'weekly_content', label: '本周内容排期', icon: '📅', prompt: '为我的公司制定本周内容排期', expectedOutcome: '5 平台 × 4 篇内容主题/标题/格式/发布时间', expert: 'growth.content_strategist', profitImpact: { dimension: 'cost_saving', amount: '月省外包费 ¥15,000+' } },
    { id: 'lead_scoring', label: '线索评分与培育', icon: '📊', prompt: '分析我的新注册线索并评分', expectedOutcome: '线索分群 + 培育邮件序列 + 预期转化率', workflowId: 'lead_nurture_funnel', profitImpact: { dimension: 'revenue', amount: '注册→付费转化率翻 3 倍' } },
    { id: 'reactivation', label: '沉睡客户激活', icon: '🔔', prompt: '制定沉睡客户激活方案', expectedOutcome: 'RFM 分群 + 激活策略 + 多渠道文案', expert: 'growth.growth_consultant', profitImpact: { dimension: 'revenue', amount: '复购率提升 15-30%' } },
    { id: 'pricing_review', label: '定价策略分析', icon: '💰', prompt: '分析我的产品定价合理性', expectedOutcome: '竞品对标矩阵 + 定价建议 + A/B 测试方案', workflowId: 'pricing_analysis', profitImpact: { dimension: 'revenue', amount: '科学定价提升利润率 10-20%' } },
    { id: 'channel_roi', label: '渠道效果归因', icon: '📈', prompt: '分析各渠道 ROI 并优化预算', expectedOutcome: '渠道 ROI 排名 + 预算优化建议', expert: 'growth.growth_consultant', profitImpact: { dimension: 'cost_saving', amount: '砍掉低效渠道，预算利用率提升 40%' } },
  ],
}

export default professionalServiceMarketingSolution
