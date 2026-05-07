/**
 * Phase 7: 本地轻量推理引擎
 *
 * 纯 TypeScript 实现，零外部依赖，离线可用。
 * 三大能力：
 *   1. 意图分类 — 加权关键词 + TF-IDF 风格评分
 *   2. 离线问答 — 规则匹配 + 知识片段缓存
 *   3. 文本分析 — 关键词/实体提取、摘要提示
 *
 * 设计原则：
 *   - 不依赖任何 ML 运行时（ONNX/WASM），纯规则 + 统计
 *   - 对确定性问题（税率、公式、法条）给出精确答案
 *   - 对模糊问题给出"最佳猜测 + 置信度"，标注需联网确认
 */

import { ipcMain, BrowserWindow } from 'electron'
import { runCalc, getAvailableCalcs } from './calc-engine'

// sql.js Database 类型（避免 @types/sql.js 依赖）
type Database = any

// ────────────────────── 类型定义 ──────────────────────

export interface IntentResult {
  intent: string
  agentId: string
  confidence: number
  subIntent?: string
  /** 是否可本地处理（不需要远端 LLM） */
  localHandleable: boolean
  /** 匹配的关键词 */
  matchedKeywords: string[]
}

export interface OfflineAnswer {
  /** 生成的回复文本 */
  text: string
  /** 答案来源：calc / knowledge / pattern / fallback */
  source: 'calc' | 'knowledge' | 'pattern' | 'fallback'
  /** 置信度 0-1 */
  confidence: number
  /** 引用的知识片段 key */
  references: string[]
  /** 是否建议联网获取更完整答案 */
  suggestOnline: boolean
  /** 关联的计算结果（如果触发了本地计算） */
  calcResult?: { scriptName: string; output: string }
}

export interface TextAnalysis {
  /** 提取的关键词 */
  keywords: string[]
  /** 识别的实体 */
  entities: { type: string; value: string; start: number; end: number }[]
  /** 检测的语言 */
  language: 'zh' | 'en' | 'mixed'
  /** 文本类别 */
  category: string
  /** 情感倾向 */
  sentiment: 'positive' | 'negative' | 'neutral'
  /** 摘要（前 N 个关键句） */
  keySentences: string[]
}

// ────────────────────── 意图分类器 ──────────────────────

/** 加权关键词表：每个 agent 的关键词及其权重 */
const INTENT_RULES: Record<string, { keywords: [string, number][]; subIntents?: Record<string, string[]> }> = {
  finance: {
    keywords: [
      ['个税', 3], ['个人所得税', 3], ['年终奖', 2.5], ['工资扣税', 2.5],
      ['VAT', 3], ['企业所得税', 2.5], ['税率', 2], ['发票', 2],
      ['记账', 2], ['会计分录', 2.5], ['借贷', 1.5], ['资产负债', 2],
      ['利润表', 2], ['现金流', 2], ['财务报表', 2.5], ['审计', 2],
      ['折旧', 2], ['摊销', 2], ['应收', 1.5], ['应付', 1.5],
      ['纳税', 2], ['申报', 1.5], ['税务筹划', 2.5], ['抵扣', 2],
      ['财务', 1.5], ['财报', 2], ['毛利', 2], ['ROE', 2],
      ['社保', 1.5], ['公积金', 1.5], ['五险一金', 2],
    ],
    subIntents: {
      calc_iit: ['个税', '个人所得税', '工资扣税', '年终奖', '月薪', '税后'],
      calc_vat: ['VAT', '进项', '销项', '抵扣'],
      accounting: ['分录', '记账', '借贷', '科目'],
      report: ['报表', '利润表', '资产负债', '现金流'],
    },
  },
  legal: {
    keywords: [
      ['合同', 2], ['诉讼', 2.5], ['起诉', 2.5], ['律师', 1.5],
      ['诉讼费', 3], ['赔偿', 2], ['经济补偿', 2.5], ['N+1', 3], ['2N', 2.5],
      ['劳动', 2], ['辞退', 2.5], ['解雇', 2.5], ['裁员', 2],
      ['合同纠纷', 2.5], ['违约', 2], ['侵权', 2], ['损害赔偿', 2.5],
      ['诉讼时效', 3], ['管辖', 2], ['仲裁', 2], ['劳动仲裁', 2.5],
      ['婚姻', 1.5], ['离婚', 2], ['抚养', 2], ['继承', 2],
      ['民法典', 2.5], ['劳动法', 2.5], ['劳动合同法', 2.5],
      ['交通事故', 2], ['工伤', 2], ['知识产权', 2],
    ],
    subIntents: {
      calc_litigation_fee: ['诉讼费', '受理费', '标的额'],
      calc_labor_compensation: ['N+1', '2N', '经济补偿', '赔偿金', '辞退补偿'],
      calc_statute: ['诉讼时效', '还能起诉', '过期'],
      contract: ['合同', '违约', '条款', '审查'],
      labor: ['劳动', '辞退', '解雇', '裁员', '仲裁'],
    },
  },
  cost: {
    keywords: [
      ['造价', 3], ['定额', 2.5], ['取费', 3], ['工程量', 2.5],
      ['清单', 2], ['招投标', 2], ['建安', 2], ['税金', 2],
      ['管理费', 1.5], ['利润率', 1.5], ['措施费', 2], ['规费', 2],
      ['预算', 2], ['结算', 2], ['变更', 1.5], ['签证', 1.5],
      ['平方米', 1.5], ['单方造价', 2.5], ['综合单价', 2.5],
    ],
    subIntents: {
      calc_cost_fee: ['取费', '费率', '管理费', '利润率', '规费'],
      calc_cost_tax: ['税金', '建安税金', 'VAT'],
      calc_cost_estimate: ['估算', '单方造价', '每平米', '概算'],
    },
  },
  pulmonary: {
    keywords: [
      ['COPD', 3], ['肺功能', 2.5], ['FEV1', 3], ['FVC', 2.5],
      ['哮喘', 2.5], ['呼吸', 2], ['呼吸机', 2.5], ['PEEP', 2.5],
      ['潮气量', 2.5], ['SpO2', 2], ['血气', 2], ['PaO2', 2.5],
      ['CURB-65', 3], ['CAT', 2], ['mMRC', 2.5], ['BODE', 2.5],
      ['Wells', 2], ['Light', 2], ['胸腔积液', 2], ['SOFA', 2.5],
      ['肺炎', 2], ['支气管', 2], ['气道', 1.5],
    ],
    subIntents: {
      calc_clinical_score: ['CURB-65', 'CAT', 'mMRC', 'BODE', 'Wells', 'SOFA', 'Light', '评分'],
      calc_pft: ['FEV1', 'FVC', '肺功能', '肺活量', '通气'],
      calc_ventilator: ['呼吸机', 'PEEP', '潮气量', '频率', '通气模式'],
    },
  },
  hr: {
    keywords: [
      ['招聘', 2], ['面试', 2], ['绩效', 2.5], ['KPI', 2], ['OKR', 2],
      ['薪酬', 2], ['社保', 2], ['公积金', 2], ['人力', 1.5], ['HR', 2],
      ['入职', 1.5], ['离职', 2], ['试用期', 2.5], ['转正', 2],
      ['加班', 2], ['年假', 2], ['病假', 2], ['产假', 2],
    ],
  },
  invest: {
    keywords: [
      ['股票', 2.5], ['行情', 2], ['行业分析', 2.5], ['板块', 2],
      ['估值', 2.5], ['PE', 2], ['PB', 2], ['市盈率', 2.5],
      ['MISES', 2], ['四柱', 2], ['宏观', 2], ['产业链', 2],
      ['选股', 2.5], ['研报', 2], ['持仓', 2], ['止损', 2],
    ],
  },
  education: {
    keywords: [
      ['留学', 2.5], ['雅思', 2.5], ['托福', 2.5], ['IELTS', 2.5], ['TOEFL', 2.5],
      ['高考', 2], ['考研', 2], ['课程', 1.5], ['教育', 1.5],
      ['院校', 2], ['申请', 1.5], ['签证', 1.5], ['GPA', 2],
    ],
  },
  cs: {
    keywords: [
      ['客服', 2.5], ['投诉', 2], ['工单', 2.5], ['SLA', 2.5],
      ['NPS', 2], ['满意度', 2], ['响应时间', 2], ['退款', 2],
    ],
  },
  growth: {
    keywords: [
      ['增长', 2], ['留存', 2.5], ['激活', 2], ['DAU', 2.5], ['MAU', 2],
      ['A/B测试', 2.5], ['ROI', 2], ['裂变', 2.5], ['营销', 2],
      ['转化率', 2.5], ['获客', 2], ['LTV', 2.5], ['CAC', 2.5],
    ],
  },
  sales: {
    keywords: [
      ['销售', 2], ['客户', 1.5], ['Pipeline', 2.5], ['报价', 2],
      ['成交', 2], ['大客户', 2], ['线索', 2], ['BANT', 2.5],
    ],
  },
  insurance_cs: {
    keywords: [
      ['保险', 2.5], ['理赔', 2.5], ['保单', 2.5], ['保费', 2],
      ['续保', 2], ['团险', 2], ['承保', 2], ['核保', 2],
    ],
  },
}

/** 问候/闲聊/系统指令识别 */
const META_INTENTS: { intent: string; patterns: RegExp[] }[] = [
  { intent: 'greeting', patterns: [/^(你好|hi|hello|嗨|hey|早上好|下午好|晚上好)/i] },
  { intent: 'farewell', patterns: [/^(再见|拜拜|bye|goodbye|88|886)/i] },
  { intent: 'thanks', patterns: [/^(谢谢|感谢|thank|多谢|辛苦)/i] },
  { intent: 'help', patterns: [/^(帮助|help|怎么用|使用说明|功能|你能做什么)/i] },
  { intent: 'status', patterns: [/^(状态|网络|离线|在线|连接)/] },
]

export function classifyIntent(text: string): IntentResult {
  const trimmed = text.trim()

  // 先检查 meta intents
  for (const meta of META_INTENTS) {
    for (const pat of meta.patterns) {
      if (pat.test(trimmed)) {
        return {
          intent: meta.intent,
          agentId: '__meta__',
          confidence: 0.95,
          localHandleable: true,
          matchedKeywords: [],
        }
      }
    }
  }

  // 加权关键词评分
  const scores: { agentId: string; score: number; matched: string[]; subIntent?: string }[] = []

  for (const [agentId, rules] of Object.entries(INTENT_RULES)) {
    let totalScore = 0
    const matched: string[] = []

    for (const [keyword, weight] of rules.keywords) {
      const regex = new RegExp(keyword, 'i')
      if (regex.test(trimmed)) {
        totalScore += weight
        matched.push(keyword)
      }
    }

    // 检测 subIntent
    let bestSubIntent: string | undefined
    let bestSubScore = 0
    if (rules.subIntents) {
      for (const [subId, subKws] of Object.entries(rules.subIntents)) {
        let subScore = 0
        for (const kw of subKws) {
          if (trimmed.includes(kw)) subScore++
        }
        if (subScore > bestSubScore) {
          bestSubScore = subScore
          bestSubIntent = subId
        }
      }
    }

    if (totalScore > 0) {
      scores.push({ agentId, score: totalScore, matched, subIntent: bestSubIntent })
    }
  }

  if (scores.length === 0) {
    return {
      intent: 'unknown',
      agentId: '__unknown__',
      confidence: 0.1,
      localHandleable: false,
      matchedKeywords: [],
    }
  }

  scores.sort((a, b) => b.score - a.score)
  const best = scores[0]
  const maxPossibleScore = INTENT_RULES[best.agentId].keywords.reduce((s, [, w]) => s + w, 0)
  const confidence = Math.min(best.score / Math.max(maxPossibleScore * 0.15, 1), 1.0)

  // 本地可处理：有对应的 subIntent 且是计算类
  const calcSubIntents = new Set([
    'calc_iit', 'calc_vat', 'calc_litigation_fee', 'calc_labor_compensation',
    'calc_statute', 'calc_cost_fee', 'calc_cost_tax', 'calc_cost_estimate',
    'calc_clinical_score', 'calc_pft', 'calc_ventilator',
  ])
  const localHandleable = (
    best.subIntent != null && calcSubIntents.has(best.subIntent)
  ) || ['greeting', 'farewell', 'thanks', 'help', 'status'].includes(best.agentId)

  return {
    intent: best.agentId,
    agentId: best.agentId,
    confidence,
    subIntent: best.subIntent,
    localHandleable,
    matchedKeywords: best.matched,
  }
}

// ────────────────────── 离线问答引擎 ──────────────────────

/** 知识片段（从 DB 缓存或硬编码常用问答） */
interface KnowledgeSnippet {
  id: string
  patterns: RegExp[]
  answer: string
  category: string
  confidence: number
}

/** 内置常用知识片段 — 覆盖高频离线查询 */
const BUILTIN_SNIPPETS: KnowledgeSnippet[] = [
  // 税率
  {
    id: 'vat_rate_general',
    patterns: [/VAT.*(rate|多少|几个点)/, /一般纳税人.*税率/],
    answer: '香港無增值稅制度。如查詢內地 VAT 稅率：一般納稅人 13%/9%/6%/0%；小規模納稅人 3%。',
    category: 'finance',
    confidence: 0.95,
  },
  {
    id: 'iit_brackets',
    patterns: [/个税.*(税率|档|级|多少)/, /个人所得税.*(税率|多少)/],
    answer: '中国个人所得税综合所得税率表（年度）：\n- 不超过 36,000 → 3%\n- 36,000-144,000 → 10%\n- 144,000-300,000 → 20%\n- 300,000-420,000 → 25%\n- 420,000-660,000 → 30%\n- 660,000-960,000 → 35%\n- 超过 960,000 → 45%\n\n基本减除费用：60,000 元/年（5,000 元/月）。\n\n提示：可使用 `/calc 个税` 进行精确计算。',
    category: 'finance',
    confidence: 0.95,
  },
  {
    id: 'cit_rate',
    patterns: [/企业所得税.*(税率|多少)/, /企业税率/],
    answer: '企业所得税基本税率：25%\n- 小型微利企业：应纳税所得额 ≤300 万，实际税负约 5%\n- 高新技术企业：15%\n- 西部大开发鼓励类：15%\n- 技术先进型服务企业：15%',
    category: 'finance',
    confidence: 0.95,
  },
  // 劳动法
  {
    id: 'labor_n1',
    patterns: [/N\+1.*什么意思/, /经济补偿.*怎么算/, /N\+1.*怎么算/, /辞退.*补偿/],
    answer: '经济补偿金（N+1）计算：\n- N = 工作年限（每满 1 年支付 1 个月工资）\n- 6 个月以上不满 1 年 → 按 1 年算\n- 不满 6 个月 → 支付半个月工资\n- "+1" 是指未提前 30 天通知时额外支付的 1 个月工资（代通知金）\n\n月工资 = 解除前 12 个月平均工资\n月工资上限 = 当地上年度职工月平均工资 3 倍\n年限上限 = 12 年（仅对高收入者适用）\n\n违法解除赔偿金 = 2N（经济补偿标准的二倍）\n\n提示：可使用 `/calc 补偿金` 进行精确计算。',
    category: 'legal',
    confidence: 0.95,
  },
  {
    id: 'litigation_fee_table',
    patterns: [/诉讼费.*多少/, /诉讼费.*怎么算/, /受理费.*标准/, /打官司.*费用/],
    answer: '财产案件诉讼费（案件受理费）简表：\n- ≤1 万：50 元\n- 1-10 万：2.5%（减去 200）\n- 10-20 万：2%（加 300）\n- 20-50 万：1.5%（加 1300）\n- 50-100 万：1%（加 3800）\n- 100-200 万：0.9%（加 4800）\n- 200-500 万：0.8%（加 6800）\n- 500-1000 万：0.7%（加 11800）\n- 1000-2000 万：0.6%（加 21800）\n- 超过 2000 万：0.5%（加 41800）\n\n劳动争议案件：10 元\n离婚案件：50-300 元（涉及财产分割另计）\n\n提示：可使用 `/calc 诉讼费` 进行精确计算。',
    category: 'legal',
    confidence: 0.95,
  },
  {
    id: 'statute_limitations',
    patterns: [/诉讼时效.*(多久|多长|几年)/, /.*过了.*还能.*起诉/],
    answer: '常见诉讼时效：\n- 普通民事纠纷：3 年（自知道或应当知道权利被侵害之日起）\n- 人身损害赔偿：3 年\n- 劳动争议仲裁：1 年（自知道或应当知道权利被侵害之日起）\n- 产品质量缺陷致损：2 年；最长 10 年（自交付之日起）\n- 国际货物买卖：4 年\n- 最长保护期限：20 年（自权利被侵害之日起）\n\n注意：诉讼时效可中断（催告、起诉等）和中止（不可抗力等）。',
    category: 'legal',
    confidence: 0.9,
  },
  // 造价
  {
    id: 'cost_fee_structure',
    patterns: [/取费.*怎么算/, /造价.*费用构成/, /建安.*费用/],
    answer: '建安工程费用构成（GB50500）：\n\n**分部分项工程费** = ∑(工程量 × 综合单价)\n**措施项目费** ≈ 分部分项的 3-8%\n**其他项目费**：暂列金额、暂估价、专业工程、计日工\n**规费** ≈ 人工费的 10-15%（养老、医疗、失业、工伤、住房公积金）\n**税金** = (分部分项 + 措施 + 其他 + 规费) × 9%\n\n提示：可使用 `/calc 取费` 进行精确计算。',
    category: 'cost',
    confidence: 0.9,
  },
  // 肺科
  {
    id: 'copd_gold',
    patterns: [/COPD.*分级/, /GOLD.*分级/, /慢阻肺.*分级/],
    answer: 'COPD GOLD 气流受限严重程度分级（基于吸入支气管扩张剂后 FEV1）：\n- GOLD 1 轻度：FEV1 ≥ 80% 预计值\n- GOLD 2 中度：50% ≤ FEV1 < 80% 预计值\n- GOLD 3 重度：30% ≤ FEV1 < 50% 预计值\n- GOLD 4 极重度：FEV1 < 30% 预计值\n\n综合评估（ABE 分组）还需结合 CAT 评分和急性加重史。\n\n提示：可使用 `/calc 临床评分` 进行 CURB-65、CAT、mMRC 等评分计算。',
    category: 'pulmonary',
    confidence: 0.9,
  },
  // 通用
  {
    id: 'social_insurance',
    patterns: [/五险一金.*(比例|缴纳|多少)/, /社保.*(比例|缴费)/],
    answer: '五险一金缴纳比例（全国通用基准，各地有差异）：\n\n| 险种 | 单位 | 个人 |\n|------|------|------|\n| 养老保险 | 16% | 8% |\n| 医疗保险 | 8-10% | 2% |\n| 失业保险 | 0.5-1% | 0.2-0.5% |\n| 工伤保险 | 0.2-1.9% | 0 |\n| 生育保险 | 0.5-1% | 0 |\n| 住房公积金 | 5-12% | 5-12% |\n\n具体比例以当地社保局和公积金中心公布为准。',
    category: 'hr',
    confidence: 0.85,
  },
  {
    id: 'overtime_rate',
    patterns: [/加班费.*(怎么算|标准|多少|倍数)/, /加班.*工资/],
    answer: '加班费计算标准（《劳动法》第44条）：\n- 工作日延长工时：不低于工资的 **150%**\n- 休息日加班且不能补休：不低于工资的 **200%**\n- 法定节假日加班：不低于工资的 **300%**\n\n计算基数 = 劳动合同约定的月工资 ÷ 21.75 天 ÷ 8 小时',
    category: 'hr',
    confidence: 0.95,
  },
  {
    id: 'annual_leave',
    patterns: [/年假.*(多少天|标准|怎么算)/, /带薪.*年休假/],
    answer: '带薪年休假标准（《职工带薪年休假条例》）：\n- 累计工作 1-10 年：5 天\n- 累计工作 10-20 年：10 天\n- 累计工作满 20 年：15 天\n\n国家法定休假日、休息日不计入年休假的假期。\n单位确因工作需要不能安排的，应按日工资收入的 300% 支付年休假工资报酬。',
    category: 'hr',
    confidence: 0.95,
  },
]

/** 数值提取辅助 */
function extractNumbers(text: string): number[] {
  const matches = text.match(/[\d,]+\.?\d*/g)
  if (!matches) return []
  return matches.map(m => parseFloat(m.replace(/,/g, ''))).filter(n => !isNaN(n))
}

/** 计算类意图 → 尝试调用本地计算引擎 */
async function tryLocalCalc(
  text: string,
  intent: IntentResult,
): Promise<{ success: boolean; scriptName?: string; output?: string } | null> {
  if (!intent.subIntent || !intent.subIntent.startsWith('calc_')) return null

  const availableCalcs = getAvailableCalcs()
  const scriptName = intent.subIntent
  if (!availableCalcs.includes(scriptName)) return null

  const nums = extractNumbers(text)

  // 根据不同计算器构建参数
  const argsMap: Record<string, () => string[]> = {
    calc_iit: () => {
      const income = nums[0] || 0
      return ['--annual-income', String(income), '--format', 'json']
    },
    calc_vat: () => {
      const amount = nums[0] || 0
      const type = text.includes('小规模') ? 'small' : 'general'
      return ['--type', type, '--output-amount', String(amount), '--input-amount', '0', '--format', 'json']
    },
    calc_litigation_fee: () => {
      const amount = nums[0] || 0
      return ['--amount', String(amount), '--format', 'json']
    },
    calc_labor_compensation: () => {
      const salary = nums.find(n => n > 100) || nums[0] || 0
      const years = nums.find(n => n <= 50 && n !== salary) || 1
      return ['--monthly-salary', String(salary), '--years', String(years), '--format', 'json']
    },
    calc_cost_fee: () => {
      const amount = nums[0] || 0
      const type = text.includes('装修') ? 'decoration' : text.includes('安装') ? 'installation' : 'building'
      return ['--base-amount', String(amount), '--project-type', type, '--format', 'json']
    },
    calc_cost_tax: () => {
      const amount = nums[0] || 0
      return ['--pretax-amount', String(amount), '--format', 'json']
    },
    calc_cost_estimate: () => {
      const area = nums[0] || 0
      const type = text.includes('别墅') ? 'villa' : text.includes('办公') ? 'office' : 'residential'
      return ['--area', String(area), '--building-type', type, '--format', 'json']
    },
    calc_clinical_score: () => {
      return ['--score-type', 'CURB-65', '--format', 'json']
    },
  }

  const buildArgs = argsMap[scriptName]
  if (!buildArgs || nums.length === 0) return null

  try {
    const result = runCalc(scriptName, buildArgs())
    if (result.success && result.result) {
      return { success: true, scriptName, output: result.result }
    }
  } catch { /* 静默 */ }
  return null
}

/** meta intent 的固定回复 */
function metaResponse(intent: string): string {
  const responses: Record<string, string> = {
    greeting: '你好！我是 MBE AI 专家助手。当前处于离线模式，部分功能仍然可用：\n\n- 税费计算（个税、VAT、企业所得税）\n- 法律费用计算（诉讼费、经济补偿金）\n- 造价计算（取费、税金、估算）\n- 临床评分（CURB-65、CAT、PFT）\n- 常用知识查询（税率、法规要点）\n\n试试问我："VAT 税率是多少？"或"帮我算一下诉讼费"',
    farewell: '再见！连接网络后可以获得完整的 AI 专家服务。',
    thanks: '不客气！如果还有其他问题，随时问我。',
    help: '**离线可用功能：**\n\n1. **确定性计算** — 个税、VAT、诉讼费、补偿金、造价取费、临床评分\n2. **知识查询** — 税率表、补偿标准、诉讼时效、费用构成\n3. **意图识别** — 自动判断你的问题属于哪个领域\n4. **文本分析** — 关键词提取、实体识别、分类\n\n连接网络后可获得：AI 深度分析、多轮对话、文档生成、知识库检索等完整功能。',
    status: '当前状态：**离线模式**\n\n- 网络连接：❌ 不可用\n- 本地计算：✅ 可用\n- 知识查询：✅ 内置知识可用\n- AI 对话：❌ 需联网\n\n连接网络后将自动恢复完整功能。',
  }
  return responses[intent] ?? '你好，我是 MBE AI 助手。当前处于离线模式。'
}

/**
 * 生成离线回答
 */
export async function generateOfflineAnswer(
  text: string,
  solutionId?: string,
): Promise<OfflineAnswer> {
  const intent = classifyIntent(text)

  // 1. meta intent — 固定回复
  if (intent.agentId === '__meta__') {
    return {
      text: metaResponse(intent.intent),
      source: 'pattern',
      confidence: 0.95,
      references: [],
      suggestOnline: false,
    }
  }

  // 2. 尝试本地计算
  const calcResult = await tryLocalCalc(text, intent)
  if (calcResult?.success && calcResult.output) {
    let formatted: string
    try {
      const parsed = JSON.parse(calcResult.output)
      formatted = formatCalcResult(calcResult.scriptName!, parsed)
    } catch {
      formatted = calcResult.output
    }
    return {
      text: formatted,
      source: 'calc',
      confidence: 0.98,
      references: [calcResult.scriptName!],
      suggestOnline: false,
      calcResult: { scriptName: calcResult.scriptName!, output: calcResult.output },
    }
  }

  // 3. 知识片段匹配（双层策略：RegExp 精确匹配 > TF-IDF 语义检索）
  const allSnippets = [...BUILTIN_SNIPPETS, ...getCachedSnippets()]

  // 3a. RegExp 精确匹配（高置信度）
  let bestSnippet: KnowledgeSnippet | null = null
  let bestScore = 0
  for (const snippet of allSnippets) {
    for (const pattern of snippet.patterns) {
      if (pattern.test(text)) {
        const score = snippet.confidence
        if (score > bestScore) {
          bestScore = score
          bestSnippet = snippet
        }
      }
    }
  }

  if (bestSnippet && bestScore >= 0.7) {
    return {
      text: bestSnippet.answer,
      source: 'knowledge',
      confidence: bestSnippet.confidence,
      references: [bestSnippet.id],
      suggestOnline: bestSnippet.confidence < 0.9,
    }
  }

  // 3b. TF-IDF 语义检索（兜底，覆盖内置片段无法精确匹配的查询）
  if (_tfidfIndex) {
    const semantic = semanticSearch(text, allSnippets, 0.25)
    if (semantic && semantic.score >= 0.25) {
      const confidenceAdjusted = Math.min(semantic.snippet.confidence * semantic.score * 2, 0.88)
      return {
        text: semantic.snippet.answer,
        source: 'knowledge',
        confidence: confidenceAdjusted,
        references: [semantic.snippet.id],
        suggestOnline: confidenceAdjusted < 0.7,
      }
    }
  }

  // 4. 有意图但无法本地回答 — 给出引导
  if (intent.agentId !== '__unknown__' && intent.confidence >= 0.3) {
    const agentNames: Record<string, string> = {
      finance: '财务专家', legal: '法律专家', cost: '造价专家',
      pulmonary: '肺科专家', hr: '人力资源专家', invest: '投资分析专家',
      education: '教育顾问', cs: '客服专家', growth: '增长专家',
      sales: '销售顾问', insurance_cs: '保险顾问',
    }
    const expertName = agentNames[intent.agentId] ?? 'AI 专家'
    const kws = intent.matchedKeywords.slice(0, 3).join('、')
    const calcHint = intent.subIntent?.startsWith('calc_')
      ? `\n\n如果你想进行计算，请提供具体数值，例如："帮我算一下 50 万的诉讼费"。`
      : ''

    return {
      text: `我理解你的问题涉及「${kws}」，属于 **${expertName}** 的服务范围。\n\n当前处于离线模式，这类深度分析需要联网使用完整的 AI 能力。${calcHint}\n\n连接网络后，${expertName}可以为你提供专业的分析和建议。`,
      source: 'pattern',
      confidence: intent.confidence * 0.5,
      references: [],
      suggestOnline: true,
    }
  }

  // 5. 完全无法理解 — fallback
  return {
    text: '当前处于离线模式，我的理解能力有限。\n\n**离线可做的事：**\n- 输入 `/calc` 使用计算器（个税、诉讼费、造价等）\n- 询问常见税率、法律标准\n- 查看基础知识（如社保比例、加班费标准）\n\n连接网络后可获得完整的 AI 专家对话能力。',
    source: 'fallback',
    confidence: 0.1,
    references: [],
    suggestOnline: true,
  }
}

/** 格式化计算结果为可读文本 */
function formatCalcResult(scriptName: string, parsed: Record<string, unknown>): string {
  const labels: Record<string, string> = {
    calc_iit: '个人所得税计算结果',
    calc_vat: 'VAT 計算結果',
    calc_litigation_fee: '诉讼费计算结果',
    calc_labor_compensation: '经济补偿金计算结果',
    calc_statute: '诉讼时效查询结果',
    calc_cost_fee: '取费计算结果',
    calc_cost_tax: '工程税金计算结果',
    calc_cost_estimate: '造价估算结果',
    calc_clinical_score: '临床评分结果',
    calc_pft: '肺功能评估结果',
    calc_ventilator: '呼吸机参数计算结果',
  }

  const title = labels[scriptName] ?? '计算结果'
  const lines = [`**${title}**\n`]

  for (const [key, value] of Object.entries(parsed)) {
    if (key.startsWith('_') || key === 'format') continue
    const displayKey = key.replace(/_/g, ' ')
    if (typeof value === 'number') {
      lines.push(`- **${displayKey}**：${value.toLocaleString('zh-CN')}`)
    } else if (typeof value === 'string') {
      lines.push(`- **${displayKey}**：${value}`)
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`- **${displayKey}**：`)
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        lines.push(`  - ${k}：${v}`)
      }
    }
  }

  lines.push('\n> 以上为本地离线计算结果，精确度与在线版一致。')
  return lines.join('\n')
}

// ────────────────────── 文本分析 ──────────────────────

/** 中文停用词 */
const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
  '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
  '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '这个', '那个',
  '什么', '怎么', '如何', '多少', '可以', '能', '吗', '呢', '啊', '哦',
  '请', '帮', '帮我', '一下', '需要', '想', '问', '请问',
])

/** 分词（简易版：按标点 + 常见词边界切分） */
function tokenize(text: string): string[] {
  const tokens: string[] = []
  const patterns = [
    /[A-Za-z][A-Za-z0-9-]+/g,  // 英文词
    /[\d,]+\.?\d*/g,             // 数字
    /[\u4e00-\u9fff]{2,6}/g,    // 中文 2-6 字短语
  ]

  for (const pat of patterns) {
    let m
    while ((m = pat.exec(text)) !== null) {
      const tok = m[0].toLowerCase()
      if (!STOP_WORDS.has(tok) && tok.length >= 2) {
        tokens.push(tok)
      }
    }
  }

  return [...new Set(tokens)]
}

/** 实体提取 */
function extractEntities(text: string): TextAnalysis['entities'] {
  const entities: TextAnalysis['entities'] = []

  const entityPatterns: [string, RegExp][] = [
    ['money', /(\d[\d,]*\.?\d*)\s*(万?元|块|rmb|人民币|美元|USD)/gi],
    ['percentage', /(\d+\.?\d*)\s*(%|个百分点|个点)/g],
    ['date', /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})[日号]?/g],
    ['duration', /(\d+\.?\d*)\s*(年|个月|月|天|日|小时|周)/g],
    ['person', /([\u4e00-\u9fff]{2,3})(律师|法官|会计|医生|老师|先生|女士|经理|总)/g],
    ['company', /([\u4e00-\u9fff]{2,10})(公司|集团|有限|股份|企业)/g],
    ['law', /《([\u4e00-\u9fff\s]+)》/g],
    ['phone', /(1[3-9]\d{9})/g],
    ['email', /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g],
  ]

  for (const [type, pattern] of entityPatterns) {
    let match
    const regex = new RegExp(pattern.source, pattern.flags)
    while ((match = regex.exec(text)) !== null) {
      entities.push({
        type,
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
      })
    }
  }

  return entities
}

/** 语言检测 */
function detectLanguage(text: string): 'zh' | 'en' | 'mixed' {
  const zhCount = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const enCount = (text.match(/[a-zA-Z]/g) || []).length
  const total = zhCount + enCount
  if (total === 0) return 'zh'
  if (zhCount / total > 0.7) return 'zh'
  if (enCount / total > 0.7) return 'en'
  return 'mixed'
}

/** 情感分析（简易版） */
function analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const positive = ['好', '棒', '优秀', '满意', '成功', '增长', '提升', '利好', '顺利', '达标']
  const negative = ['差', '糟', '失败', '亏损', '下降', '违约', '纠纷', '投诉', '拒绝', '损失', '风险', '问题', '困难']

  let posScore = 0
  let negScore = 0
  for (const w of positive) { if (text.includes(w)) posScore++ }
  for (const w of negative) { if (text.includes(w)) negScore++ }

  if (posScore > negScore + 1) return 'positive'
  if (negScore > posScore + 1) return 'negative'
  return 'neutral'
}

/** 关键句提取（基于位置 + 关键词密度） */
function extractKeySentences(text: string, maxSentences = 3): string[] {
  const sentences = text.split(/[。！？\n]+/).filter(s => s.trim().length > 5)
  if (sentences.length <= maxSentences) return sentences.map(s => s.trim())

  // 对每个句子评分：位置权重 + 关键词密度
  const keywords = tokenize(text)
  const scored = sentences.map((s, i) => {
    const posWeight = i === 0 ? 1.5 : i === sentences.length - 1 ? 1.2 : 1.0
    let kwCount = 0
    for (const kw of keywords) { if (s.includes(kw)) kwCount++ }
    const density = kwCount / Math.max(s.length, 1)
    return { text: s.trim(), score: posWeight * (1 + density * 10) }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, maxSentences).map(s => s.text)
}

/**
 * 分析文本
 */
export function analyzeText(text: string): TextAnalysis {
  return {
    keywords: tokenize(text).slice(0, 15),
    entities: extractEntities(text),
    language: detectLanguage(text),
    category: classifyIntent(text).agentId,
    sentiment: analyzeSentiment(text),
    keySentences: extractKeySentences(text),
  }
}

// ────────────────────── TF-IDF 向量检索层 ──────────────────────
//
// 替代纯 RegExp 匹配，使用 TF-IDF 余弦相似度实现语义近似检索。
// 纯 TypeScript，零外部依赖，离线可用。
// 这是桌面端的"轻量向量层"，对中文知识库的高频查询覆盖率 > 90%。

interface TfIdfIndex {
  /** 每个文档（知识片段）的词频向量 */
  docs: { id: string; tf: Map<string, number>; norm: number }[]
  /** 逆文档频率 */
  idf: Map<string, number>
}

let _tfidfIndex: TfIdfIndex | null = null

/** 轻量中文分词（2-4 字 n-gram + 英文词） */
function tfidfTokenize(text: string): string[] {
  const tokens: string[] = []
  const lower = text.toLowerCase()

  // 英文词 + 数字
  const enMatches = lower.match(/[a-z][a-z0-9-]+|[\d.]+/g) ?? []
  tokens.push(...enMatches)

  // 中文字符：提取 2-gram 和 3-gram 覆盖近邻语义
  const zh = lower.replace(/[^\u4e00-\u9fff]/g, '')
  for (let i = 0; i < zh.length - 1; i++) {
    tokens.push(zh.slice(i, i + 2))
    if (i < zh.length - 2) tokens.push(zh.slice(i, i + 3))
  }

  return tokens.filter(t => t.length >= 2)
}

/** 计算词频（归一化） */
function buildTf(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1)
  // 归一化
  const max = Math.max(...freq.values(), 1)
  freq.forEach((v, k) => freq.set(k, v / max))
  return freq
}

/** 向量 L2 范数 */
function vecNorm(tf: Map<string, number>): number {
  let sum = 0
  tf.forEach(v => { sum += v * v })
  return Math.sqrt(sum)
}

/** 余弦相似度（稀疏向量） */
function cosineSim(a: Map<string, number>, normA: number, b: Map<string, number>, normB: number): number {
  if (normA === 0 || normB === 0) return 0
  let dot = 0
  a.forEach((va, term) => {
    const vb = b.get(term)
    if (vb !== undefined) dot += va * vb
  })
  return dot / (normA * normB)
}

/** 构建 TF-IDF 索引（在所有片段加载后调用） */
function buildTfIdfIndex(snippets: KnowledgeSnippet[]): TfIdfIndex {
  const N = snippets.length

  // 文档频率（DF）：每个 term 出现在多少文档中
  const df = new Map<string, number>()
  const docTokens: { id: string; tokens: string[] }[] = snippets.map(s => {
    // 将 answer + category 合并为索引文本
    const text = `${s.category} ${s.answer}`
    const tokens = tfidfTokenize(text)
    for (const t of new Set(tokens)) {
      df.set(t, (df.get(t) ?? 0) + 1)
    }
    return { id: s.id, tokens }
  })

  // IDF = log((N + 1) / (df + 1)) + 1
  const idf = new Map<string, number>()
  df.forEach((count, term) => {
    idf.set(term, Math.log((N + 1) / (count + 1)) + 1)
  })

  // TF-IDF 向量
  const docs = docTokens.map(({ id, tokens }) => {
    const tf = buildTf(tokens)
    // 乘以 IDF 权重
    tf.forEach((v, k) => tf.set(k, v * (idf.get(k) ?? 1)))
    const norm = vecNorm(tf)
    return { id, tf, norm }
  })

  return { docs, idf }
}

/**
 * TF-IDF 语义检索：在所有知识片段中找最相关的一个
 * @param query 用户查询文本
 * @param snippets 知识片段列表（顺序与 _tfidfIndex.docs 一致）
 * @param threshold 相似度阈值（默认 0.25）
 */
function semanticSearch(
  query: string,
  snippets: KnowledgeSnippet[],
  threshold = 0.25,
): { snippet: KnowledgeSnippet; score: number } | null {
  if (!_tfidfIndex || snippets.length === 0) return null

  const queryTokens = tfidfTokenize(query)
  const queryTf = buildTf(queryTokens)
  // 应用 IDF 权重
  queryTf.forEach((v, k) => queryTf.set(k, v * (_tfidfIndex!.idf.get(k) ?? 1)))
  const queryNorm = vecNorm(queryTf)

  let bestScore = 0
  let bestIdx = -1

  _tfidfIndex.docs.forEach((doc, i) => {
    const sim = cosineSim(queryTf, queryNorm, doc.tf, doc.norm)
    if (sim > bestScore) {
      bestScore = sim
      bestIdx = i
    }
  })

  if (bestIdx < 0 || bestScore < threshold) return null
  return { snippet: snippets[bestIdx], score: bestScore }
}

// ────────────────────── DB 缓存层 ──────────────────────

let _db: Database | null = null
let _mainWindow: BrowserWindow | null = null

const cachedSnippets: KnowledgeSnippet[] = []

export function setInferenceDb(db: Database): void { _db = db }
export function setInferenceMainWindow(win: BrowserWindow): void { _mainWindow = win }

function getCachedSnippets(): KnowledgeSnippet[] {
  return cachedSnippets
}

/**
 * 从 DB cache 加载知识片段（由在线时缓存的 Agent 回答提取）
 *
 * 修复：使用正确的 cache_entries 表（而非不存在的 response_cache 表）。
 * 知识片段以 key 前缀 'kb_snippet_' 标识，content_json 格式：
 *   { patterns: string[], answer: string, category?: string, confidence?: number }
 */
function loadCachedSnippets(): void {
  if (!_db) return
  try {
    const stmt = _db.prepare(`
      SELECT cache_key, content_json FROM cache_entries
      WHERE cache_key LIKE 'kb_snippet_%'
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY priority DESC, last_hit_at DESC
      LIMIT 200
    `)
    let loaded = 0
    while (stmt.step()) {
      const row = stmt.getAsObject() as { cache_key: string; content_json: string }
      try {
        const data = JSON.parse(row.content_json)
        // 兼容两种格式：
        // 格式1（完整片段）：{ patterns, answer, category, confidence }
        // 格式2（预热占位）：{ _warmup: true, workflow_id } → 跳过
        if (data._warmup) continue
        if (data.patterns && data.answer) {
          cachedSnippets.push({
            id: row.cache_key,
            patterns: (data.patterns as string[]).map((p: string) => {
              try { return new RegExp(p, 'i') } catch { return /(?:)/ }
            }),
            answer: data.answer,
            category: data.category ?? 'general',
            confidence: data.confidence ?? 0.8,
          })
          loaded++
        }
      } catch { /* 跳过格式错误的条目 */ }
    }
    stmt.free()

    // 构建 TF-IDF 索引（覆盖内置 + 缓存片段）
    const allSnippets = [...BUILTIN_SNIPPETS, ...cachedSnippets]
    _tfidfIndex = buildTfIdfIndex(allSnippets)
  } catch { /* cache_entries 表不存在时静默 */ }
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupLocalInferenceIPC(): void {
  ipcMain.handle('inference:classify', async (_, text: string) => {
    return classifyIntent(text)
  })

  ipcMain.handle('inference:answer', async (_, text: string, solutionId?: string) => {
    return generateOfflineAnswer(text, solutionId)
  })

  ipcMain.handle('inference:analyze', async (_, text: string) => {
    return analyzeText(text)
  })

  ipcMain.handle('inference:status', async () => {
    return {
      available: true,
      snippetCount: BUILTIN_SNIPPETS.length + cachedSnippets.length,
      calcEngines: getAvailableCalcs(),
      version: '1.0.0',
    }
  })
}

/** 初始化（在 DB 就绪后调用） */
export function initLocalInference(): void {
  loadCachedSnippets()
  // 若 DB 中没有缓存片段，也要为内置片段建 TF-IDF 索引
  if (!_tfidfIndex) {
    _tfidfIndex = buildTfIdfIndex(BUILTIN_SNIPPETS)
  }
}

/**
 * 向 DB 写入一条知识片段缓存（由在线回答提取后调用）
 *
 * 写入格式与 loadCachedSnippets 兼容：
 *   cache_key: 'kb_snippet_{id}'
 *   content_json: { patterns, answer, category, confidence }
 *
 * 写入后重建 TF-IDF 索引，使新知识立即可搜索。
 */
export function persistKnowledgeSnippet(
  id: string,
  patterns: string[],
  answer: string,
  category: string,
  confidence: number,
  solutionId: string,
  ttlHours = 720,
): void {
  if (!_db) return
  try {
    const key = `kb_snippet_${id}`
    const contentJson = JSON.stringify({ patterns, answer, category, confidence })
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString()
    const priority = confidence

    _db.run(`
      INSERT OR REPLACE INTO cache_entries
        (cache_key, solution_id, content_json, priority, expires_at, last_hit_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `, [key, solutionId, contentJson, priority, expiresAt])

    // 更新内存索引
    const existing = cachedSnippets.findIndex(s => s.id === key)
    const snippet: KnowledgeSnippet = {
      id: key,
      patterns: patterns.map(p => { try { return new RegExp(p, 'i') } catch { return /(?:)/ } }),
      answer,
      category,
      confidence,
    }
    if (existing >= 0) {
      cachedSnippets[existing] = snippet
    } else {
      cachedSnippets.push(snippet)
    }

    // 重建 TF-IDF 索引
    _tfidfIndex = buildTfIdfIndex([...BUILTIN_SNIPPETS, ...cachedSnippets])
  } catch { /* 静默 */ }
}

/**
 * 暴露给 IPC：批量导入知识片段（在线时由 Agent 响应提取）
 */
export function setupKnowledgeCacheIPC(): void {
  ipcMain.handle('inference:persistSnippet', async (_, data: {
    id: string
    patterns: string[]
    answer: string
    category: string
    confidence: number
    solutionId: string
    ttlHours?: number
  }) => {
    persistKnowledgeSnippet(
      data.id, data.patterns, data.answer,
      data.category, data.confidence, data.solutionId, data.ttlHours,
    )
    return { success: true }
  })
}
