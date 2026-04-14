// 纯 TypeScript 确定性计算引擎
// 替代原 Python child_process 方案，消除 Windows Defender 误报触发源。
// 所有计算均为纯数学运算，零外部依赖，离线可用。

// ────────────────────── 精度工具 ──────────────────────

function R(n: number, dp = 2): number {
  const m = 10 ** dp
  return Math.floor(n * m + 0.5) / m
}

function pct(n: number, dp = 2): string {
  return `${R(n, dp)}%`
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = args[i + 1]
      if (!next || next.startsWith('--')) {
        result[key] = true
      } else {
        result[key] = next
        i++
      }
    }
  }
  return result
}

function num(v: string | boolean | undefined, def = 0): number {
  if (v === undefined || v === true) return def
  const n = Number(v)
  return isNaN(n) ? def : n
}

function str(v: string | boolean | undefined, def = ''): string {
  if (v === undefined || typeof v === 'boolean') return def
  return v
}

// ────────────────────── 个人所得税 ──────────────────────

const IIT_BRACKETS = [
  { upper: 36000, rate: 0.03, deduction: 0 },
  { upper: 144000, rate: 0.10, deduction: 2520 },
  { upper: 300000, rate: 0.20, deduction: 16920 },
  { upper: 420000, rate: 0.25, deduction: 31920 },
  { upper: 660000, rate: 0.30, deduction: 52920 },
  { upper: 960000, rate: 0.35, deduction: 85920 },
  { upper: Infinity, rate: 0.45, deduction: 181920 },
]

const BONUS_MONTHLY_BRACKETS = [
  { upper: 3000, rate: 0.03, deduction: 0 },
  { upper: 12000, rate: 0.10, deduction: 210 },
  { upper: 25000, rate: 0.20, deduction: 1410 },
  { upper: 35000, rate: 0.25, deduction: 2660 },
  { upper: 55000, rate: 0.30, deduction: 4410 },
  { upper: 80000, rate: 0.35, deduction: 7160 },
  { upper: Infinity, rate: 0.45, deduction: 15160 },
]

const BASIC_DEDUCTION = 60000

function calcAnnualIIT(annualIncome: number, specialDeduction: number, specialAdditional: number, otherDeduction: number) {
  const taxable = annualIncome - BASIC_DEDUCTION - specialDeduction - specialAdditional - otherDeduction
  if (taxable <= 0) {
    return {
      annual_income: String(annualIncome),
      taxable_income: '0', tax: '0', effective_rate: '0%',
      formula: '应纳税所得额 ≤ 0，无需缴税',
      legal_basis: '《个人所得税法》第6条',
    }
  }
  let matchedRate = 0, matchedDeduction = 0
  for (const b of IIT_BRACKETS) {
    if (taxable <= b.upper) { matchedRate = b.rate; matchedDeduction = b.deduction; break }
  }
  const tax = R(taxable * matchedRate - matchedDeduction)
  const effectiveRate = annualIncome > 0 ? R(tax / annualIncome * 100) : 0
  return {
    annual_income: String(annualIncome), basic_deduction: String(BASIC_DEDUCTION),
    special_deduction: String(specialDeduction), special_additional_deduction: String(specialAdditional),
    other_deduction: String(otherDeduction), taxable_income: String(taxable),
    tax_rate: String(matchedRate), quick_deduction: String(matchedDeduction),
    tax: String(tax), effective_rate: pct(effectiveRate),
    after_tax_income: String(annualIncome - tax - specialDeduction),
    formula: `(${annualIncome} - ${BASIC_DEDUCTION} - ${specialDeduction} - ${specialAdditional}) × ${matchedRate} - ${matchedDeduction}`,
    legal_basis: '《个人所得税法》第3条、第6条',
  }
}

function calcBonusTax(bonus: number) {
  const monthly = R(bonus / 12)
  let matchedRate = 0, matchedDeduction = 0
  for (const b of BONUS_MONTHLY_BRACKETS) {
    if (monthly <= b.upper) { matchedRate = b.rate; matchedDeduction = b.deduction; break }
  }
  const tax = R(bonus * matchedRate - matchedDeduction)
  const effectiveRate = bonus > 0 ? R(tax / bonus * 100) : 0
  return {
    bonus: String(bonus), monthly_average: String(monthly),
    tax_rate: String(matchedRate), quick_deduction: String(matchedDeduction),
    tax: String(tax), after_tax_bonus: String(bonus - tax),
    effective_rate: pct(effectiveRate),
    formula: `${bonus} × ${matchedRate} - ${matchedDeduction}`,
    legal_basis: '财税〔2018〕164号，优惠延续至2027-12-31',
    note: '并入综合所得可能更优（需对比两种方式）',
  }
}

function handleCalcIIT(args: string[]): object {
  const p = parseArgs(args)
  if (p['bonus']) return calcBonusTax(num(p['bonus']))
  return calcAnnualIIT(num(p['annual-income']), num(p['special-deduction']), num(p['special-additional']), num(p['other-deduction']))
}

// ────────────────────── VAT ──────────────────────

const SURCHARGE_CITY_RATES: Record<string, number> = { city: 0.07, county: 0.05, other: 0.01 }
const EDUCATION_RATE = 0.03
const LOCAL_EDUCATION_RATE = 0.02

function calcVATGeneral(outputAmount: number, inputAmount: number, rate: number, priorCredit: number) {
  const outputTax = R(outputAmount * rate)
  const inputTax = R(inputAmount * rate)
  let payable = outputTax - inputTax - priorCredit
  let carriedForward = 0
  if (payable < 0) { carriedForward = Math.abs(payable); payable = 0 }
  const effectiveRate = outputAmount > 0 ? R(payable / outputAmount * 100) : 0
  return {
    taxpayer_type: '一般纳税人', output_amount: String(outputAmount), output_tax: String(outputTax),
    input_amount: String(inputAmount), input_tax: String(inputTax), prior_credit: String(priorCredit),
    vat_payable: String(R(payable)), carried_forward_credit: String(R(carriedForward)),
    effective_rate: pct(effectiveRate), tax_rate: String(rate),
    formula: `销项(${outputTax}) - 进项(${inputTax}) - 上期留抵(${priorCredit})`,
    legal_basis: 'VAT Law Art. 4 & 11',
  }
}

function calcVATSmall(revenue: number, rate: number, period: string) {
  const exemptThreshold = period === 'quarterly' ? 300000 : 100000
  if (revenue <= exemptThreshold) {
    return {
      taxpayer_type: '小规模纳税人', revenue: String(revenue), period,
      exempt_threshold: String(exemptThreshold), vat_payable: '0',
      note: `${period}销售额≤${exemptThreshold}元，免征VAT`,
      legal_basis: 'VAT Law Art. 5, STA Notice',
    }
  }
  const revenueExcl = R(revenue / (1 + rate))
  const vat = R(revenueExcl * rate)
  return {
    taxpayer_type: '小规模纳税人', revenue_incl_tax: String(revenue),
    revenue_excl_tax: String(revenueExcl), tax_rate: String(rate),
    vat_payable: String(vat), formula: `${revenue} ÷ (1+${rate}) × ${rate}`,
    legal_basis: 'VAT Law Art. 5',
  }
}

function calcSurcharge(vatPaid: number, location: string) {
  const cityRate = SURCHARGE_CITY_RATES[location] ?? 0.07
  const cityTax = R(vatPaid * cityRate)
  const eduTax = R(vatPaid * EDUCATION_RATE)
  const localEduTax = R(vatPaid * LOCAL_EDUCATION_RATE)
  const total = R(cityTax + eduTax + localEduTax)
  return {
    vat_paid: String(vatPaid), location,
    city_maintenance_tax: String(cityTax), city_maintenance_rate: String(cityRate),
    education_surcharge: String(eduTax), education_rate: String(EDUCATION_RATE),
    local_education_surcharge: String(localEduTax), local_education_rate: String(LOCAL_EDUCATION_RATE),
    total_surcharge: String(total), total_with_vat: String(R(vatPaid + total)),
    formula: `城建(${cityRate}) + 教育(${EDUCATION_RATE}) + 地方教育(${LOCAL_EDUCATION_RATE})`,
    legal_basis: '《城市维护建设税法》、《征收教育费附加的暂行规定》',
  }
}

function handleCalcVAT(args: string[]): object {
  const mode = args[0]
  const p = parseArgs(args.slice(1))
  if (mode === 'general') return calcVATGeneral(num(p['output-amount']), num(p['input-amount']), num(p['rate'], 0.13), num(p['prior-credit']))
  if (mode === 'small') return calcVATSmall(num(p['revenue']), num(p['rate'], 0.03), str(p['period'], 'quarterly'))
  return calcSurcharge(num(p['vat-paid']), str(p['location'], 'city'))
}

// ────────────────────── 劳动经济补偿 ──────────────────────

const TERMINATION_TYPES: Record<string, { factor: number; label: string }> = {
  mutual: { factor: 1, label: '协商解除 (N)' },
  no_fault: { factor: 1, label: '无过失性辞退 (N)，可+1月代通知金' },
  layoff: { factor: 1, label: '经济性裁员 (N)' },
  illegal: { factor: 2, label: '违法解除/终止 (2N)' },
  constructive: { factor: 1, label: '被迫辞职 (N)，用人单位过错' },
  expiry_not_renew: { factor: 1, label: '合同到期不续签 (N)' },
}

function calcWorkYearsMonths(years: number): number {
  const full = Math.floor(years)
  const remainder = years - full
  if (remainder >= 0.5) return full + 1
  if (remainder > 0) return full + 0.5
  return full
}

function handleCalcLaborCompensation(args: string[]): object {
  const p = parseArgs(args)
  const salary = num(p['salary'])
  const years = num(p['years'])
  const type = str(p['type'])
  const avgSalary3x = p['avg-salary-3x'] ? num(p['avg-salary-3x']) : null
  const proxyNotice = p['proxy-notice'] === true

  const info = TERMINATION_TYPES[type]
  if (!info) return { error: `不支持的解除类型: ${type}，可选: ${Object.keys(TERMINATION_TYPES).join(', ')}` }

  let salaryForCalc = salary
  let capped = false, yearsCapApplied = false
  if (avgSalary3x && salary > avgSalary3x) { salaryForCalc = avgSalary3x; capped = true }

  let nMonths = calcWorkYearsMonths(years)
  if (capped && nMonths > 12) { nMonths = 12; yearsCapApplied = true }

  const baseAmount = salaryForCalc * nMonths
  let total = baseAmount * info.factor
  let proxyPay = 0
  if (proxyNotice && type === 'no_fault') { proxyPay = salary; total += proxyPay }

  const breakdown: Record<string, unknown> = {
    monthly_salary: String(salary), salary_for_calc: String(salaryForCalc), salary_capped: capped,
    years_worked: String(years), n_months: String(nMonths), years_cap_applied: yearsCapApplied,
    factor: info.factor, base_N: String(baseAmount),
  }
  if (proxyPay > 0) breakdown.proxy_notice_pay = String(proxyPay)

  return {
    termination_type: type, termination_label: info.label,
    total_compensation: String(total),
    formula: `${salaryForCalc} × ${nMonths} × ${info.factor}` + (proxyPay > 0 ? ` + ${proxyPay}(代通知金)` : ''),
    breakdown,
    legal_basis: '《劳动合同法》第47条(N)、第87条(2N)、第40条(代通知金)',
  }
}

// ────────────────────── 诉讼费 ──────────────────────

const LITIGATION_SEGMENTS = [
  { upper: 10000, fixed: 50, rate: 0, offset: 0 },
  { upper: 100000, fixed: 0, rate: 0.025, offset: -200 },
  { upper: 200000, fixed: 0, rate: 0.02, offset: 300 },
  { upper: 500000, fixed: 0, rate: 0.015, offset: 1300 },
  { upper: 1000000, fixed: 0, rate: 0.01, offset: 3800 },
  { upper: 2000000, fixed: 0, rate: 0.009, offset: 4800 },
  { upper: 5000000, fixed: 0, rate: 0.008, offset: 6800 },
  { upper: 10000000, fixed: 0, rate: 0.007, offset: 11800 },
  { upper: 20000000, fixed: 0, rate: 0.006, offset: 21800 },
  { upper: Infinity, fixed: 0, rate: 0.005, offset: 41800 },
]

function handleCalcLitigationFee(args: string[]): object {
  const p = parseArgs(args)
  const amount = num(p['amount'])
  if (amount <= 0) return { error: '标的额必须大于 0' }

  let fee = 0, matchedDesc = ''
  for (const seg of LITIGATION_SEGMENTS) {
    if (amount <= seg.upper) {
      if (seg.fixed > 0) {
        fee = seg.fixed
        matchedDesc = `≤${seg.upper}元，固定${seg.fixed}元`
      } else {
        fee = amount * seg.rate + seg.offset
        matchedDesc = `≤${seg.upper === Infinity ? '∞' : seg.upper}元，费率${seg.rate}，偏移${seg.offset}`
      }
      break
    }
  }
  const feeHalf = Math.floor((fee + 1) / 2)
  return {
    claim_amount: String(amount), litigation_fee: String(fee), litigation_fee_half: String(feeHalf),
    formula: `${amount} × 费率 + 偏移`, matched_segment: matchedDesc,
    legal_basis: '《诉讼费用交纳办法》第13条', note: '简易程序/调解结案减半收取',
  }
}

// ────────────────────── 诉讼时效 ──────────────────────

const STATUTE_RULES: Record<string, { years: number; label: string; basis: string }> = {
  general: { years: 3, label: '一般诉讼时效', basis: '《民法典》第188条' },
  special_1y: { years: 1, label: '特别诉讼时效（1年）', basis: '特别法规定' },
  labor: { years: 1, label: '劳动争议仲裁时效', basis: '《劳动争议调解仲裁法》第27条' },
  body_injury: { years: 3, label: '人身损害赔偿', basis: '《民法典》第188条（2017年后统一为3年）' },
  product_defect: { years: 2, label: '产品缺陷侵权', basis: '《产品质量法》' },
  environmental: { years: 3, label: '环境污染侵权', basis: '《民法典》第188条' },
  longest: { years: 20, label: '最长保护期', basis: '《民法典》第188条第2款' },
}

function handleCalcStatute(args: string[]): object {
  const p = parseArgs(args)
  const caseType = str(p['case-type'])
  const startDateStr = str(p['start-date'])

  const rule = STATUTE_RULES[caseType]
  if (!rule) return { error: `不支持的案件类型: ${caseType}，可选: ${Object.keys(STATUTE_RULES).join(', ')}` }

  const startDate = new Date(startDateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expireDate = new Date(startDate)
  expireDate.setFullYear(expireDate.getFullYear() + rule.years)

  const remainingDays = Math.floor((expireDate.getTime() - today.getTime()) / 86400000)
  const expired = remainingDays < 0
  const status = expired ? '已过期' : (remainingDays <= 30 ? '即将到期（≤30天）' : '有效')

  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return {
    case_type: caseType, case_type_label: rule.label,
    start_date: startDateStr, expire_date: fmt(expireDate), today: fmt(today),
    remaining_days: remainingDays, status, expired, statute_years: rule.years,
    legal_basis: rule.basis,
    note: expired
      ? '已过诉讼时效，但对方未提出抗辩的，法院仍可受理'
      : '诉讼时效可因主张权利、提起诉讼等中断事由而重新起算',
  }
}

// ────────────────────── 造价估算 ──────────────────────

const REF_PRICES: Record<string, number[]> = {
  building: [2500, 4000, 6500],
  municipal: [800, 1500, 2500],
  rail: [50000, 80000, 120000],
  decoration: [400, 800, 1500],
  installation: [600, 1200, 2000],
}

const QUALITY_COEFFS: Record<string, number> = { economy: 0.75, standard: 1.0, premium: 1.4 }

const COMPOSITION: [string, string, number][] = [
  ['labor', '人工费', 0.25], ['material', '材料费', 0.55],
  ['machine', '机械费', 0.12], ['other', '其他费', 0.08],
]

function handleCalcCostEstimate(args: string[]): object {
  const p = parseArgs(args)
  const projectType = str(p['project_type'], 'building')
  const area = num(p['area'])
  const quality = str(p['quality'], 'standard')

  const prices = REF_PRICES[projectType] ?? REF_PRICES.building
  const refPrice = prices[1]
  const qualityCoeff = QUALITY_COEFFS[quality] ?? 1.0
  const unitCost = R(refPrice * qualityCoeff)
  const totalCost = R(area * unitCost)

  const composition: Record<string, object> = {}
  for (const [key, name, rate] of COMPOSITION) {
    composition[key] = { name, rate: String(rate), amount: String(R(totalCost * rate)) }
  }

  return {
    project_type: projectType, area: String(area), quality, ref_price: String(refPrice),
    quality_coeff: String(qualityCoeff), unit_cost: String(unitCost),
    total_cost: String(totalCost), composition,
  }
}

// ────────────────────── 造价取费 ──────────────────────

const FEE_RATES: [string, string, number][] = [
  ['measure_fee', '测量费', 0.03], ['safety_fee', '安全文明施工费', 0.015],
  ['management_fee', '管理费', 0.08], ['profit', '利润', 0.05],
  ['social_insurance', '社会保险费', 0.04], ['housing_fund', '住房公积金', 0.02],
  ['hazard_insurance', '危险作业意外伤害保险', 0.002],
]

function handleCalcCostFee(args: string[]): object {
  const p = parseArgs(args)
  const baseAmount = num(p['base_amount'])
  const projectType = str(p['project_type'], 'building')
  const taxRate = num(p['tax_rate'], 9.0)
  const itemsFilter = p['items'] ? String(p['items']).split(',').map(s => s.trim()) : null

  const fees: Record<string, object> = {}
  let sumFees = 0
  for (const [key, name, rate] of FEE_RATES) {
    if (itemsFilter && !itemsFilter.includes(key)) continue
    const amount = R(baseAmount * rate)
    fees[key] = { name, rate: String(rate), amount: String(amount) }
    sumFees += amount
  }
  const subtotalBeforeTax = R(baseAmount + sumFees)
  const tax = R(subtotalBeforeTax * taxRate / 100)
  const grandTotal = R(subtotalBeforeTax + tax)

  return {
    base_amount: String(baseAmount), project_type: projectType, fees,
    subtotal_before_tax: String(subtotalBeforeTax),
    tax_rate: `${taxRate}%`, tax: String(tax), grand_total: String(grandTotal),
  }
}

// ────────────────────── 建安税金 ──────────────────────

const URBAN_RATES: Record<string, number> = { city: 0.07, town: 0.05, other: 0.01 }
const COST_EDU_RATE = 0.03
const COST_LOCAL_EDU_RATE = 0.02

function handleCalcCostTax(args: string[]): object {
  const p = parseArgs(args)
  const amount = num(p['amount'])
  const method = str(p['method'], 'general')
  const region = str(p['region'], 'city')

  const vatRate = method === 'general' ? 0.09 : 0.03
  const amountExclVat = R(amount / (1 + vatRate))
  const vat = R(amountExclVat * vatRate)

  const urbanRate = URBAN_RATES[region] ?? 0.07
  const urbanTax = R(vat * urbanRate)
  const eduTax = R(vat * COST_EDU_RATE)
  const localEduTax = R(vat * COST_LOCAL_EDU_RATE)
  const totalTax = R(vat + urbanTax + eduTax + localEduTax)

  const regionNames: Record<string, string> = { city: '城市', town: '县城/镇', other: '其他' }
  return {
    amount: String(amount), method: method === 'general' ? '一般计税' : '简易计税',
    region: regionNames[region] ?? region, vat: String(vat), vat_rate: String(vatRate),
    surcharges: {
      urban_construction: { name: '城市维护建设税', rate: `${urbanRate}（${regionNames[region] ?? region}）`, amount: String(urbanTax) },
      education: { name: '教育费附加', rate: '3%', amount: String(eduTax) },
      local_education: { name: '地方教育附加', rate: '2%', amount: String(localEduTax) },
    },
    total_tax: String(totalTax), after_tax_amount: String(R(amount - vat)),
  }
}

// ────────────────────── 肺科临床评分 ──────────────────────

function calcCURB65(params: Record<string, unknown>) {
  const score = ['confusion', 'urea', 'respiratory_rate', 'blood_pressure', 'age']
    .reduce((s, k) => s + (params[k] ? 1 : 0), 0)
  if (score <= 1) return { score, risk_level: 'low', interpretation: '低危：30 天病死率 <3%，门诊治疗', recommendations: '门诊口服抗生素，2-3 天后随访' }
  if (score === 2) return { score, risk_level: 'moderate', interpretation: '中危：30 天病死率约 9%，建议短期住院', recommendations: '考虑住院或家庭医疗，密切随访' }
  return { score, risk_level: 'high', interpretation: '高危：30 天病死率 15-40%，需住院', recommendations: '住院治疗，部分需 ICU' }
}

function calcCAT(params: Record<string, unknown>) {
  const items = ['cough', 'phlegm', 'chest_tightness', 'breathlessness', 'activity_limit', 'confidence_leaving', 'sleep', 'energy']
  const score = items.reduce((s, k) => s + Math.max(0, Math.min(5, Number(params[k] ?? 0))), 0)
  if (score <= 9) return { score, risk_level: 'mild', interpretation: '轻度：症状轻微', recommendations: '维持治疗，戒烟，疫苗接种' }
  if (score <= 20) return { score, risk_level: 'moderate', interpretation: '中度：症状影响日常', recommendations: '优化吸入治疗，肺康复' }
  if (score <= 30) return { score, risk_level: 'severe', interpretation: '重度：明显限制活动', recommendations: '强化治疗，评估并发症，肺康复' }
  return { score, risk_level: 'very_severe', interpretation: '极重度：严重损害生活质量', recommendations: '多学科管理，考虑氧疗/无创通气' }
}

function calcMMRC(params: Record<string, unknown>) {
  const grade = Math.max(0, Math.min(4, Number(params.grade ?? 0)))
  return grade <= 1
    ? { score: grade, risk_level: 'mild', interpretation: '轻度呼吸困难', recommendations: '维持治疗，肺康复可获益' }
    : { score: grade, risk_level: 'moderate_severe', interpretation: '中重度呼吸困难', recommendations: '优化支气管扩张剂，肺康复，评估氧疗' }
}

function calcBODE(params: Record<string, unknown>) {
  const bmi = Number(params.bmi ?? 0)
  const fev1Pct = Number(params.fev1_percent ?? 0)
  const mmrc = Math.max(0, Math.min(4, Number(params.mmrc_grade ?? 0)))
  const walk = Number(params.walk_distance_6min ?? 0)

  const bmiScore = bmi <= 21 ? 1 : 0
  const fev1Score = fev1Pct >= 65 ? 0 : fev1Pct >= 50 ? 1 : fev1Pct >= 36 ? 2 : 3
  const mmrcScore = mmrc <= 1 ? 0 : mmrc - 1
  const walkScore = walk >= 350 ? 0 : walk >= 250 ? 1 : walk >= 150 ? 2 : 3

  const score = bmiScore + fev1Score + mmrcScore + walkScore
  const tiers: [number, string, string, string][] = [
    [2, '~15%', 'BODE 0-2：4 年病死率约 15%', '维持治疗，肺康复，戒烟'],
    [4, '~30%', 'BODE 3-4：4 年病死率约 30%', '强化治疗，肺康复，评估肺减容/移植'],
    [6, '~40%', 'BODE 5-6：4 年病死率约 40%', '多学科管理，姑息与预后讨论'],
    [Infinity, '~80%', 'BODE ≥7：4 年病死率约 80%', '姑息治疗，氧疗，讨论生命末期意愿'],
  ]
  const tier = tiers.find(t => score <= t[0])!
  return {
    score, risk_level: tier[1], interpretation: tier[2], recommendations: tier[3],
    breakdown: { bmi_score: bmiScore, fev1_score: fev1Score, mmrc_score: mmrcScore, walk_score: walkScore },
  }
}

function calcWellsPE(params: Record<string, unknown>) {
  const keys = ['dvt_symptoms', 'pe_most_likely', 'heart_rate_gt100', 'immobilization_surgery', 'previous_dvt_pe', 'hemoptysis', 'malignancy']
  const weights = [3.0, 3.0, 1.5, 1.5, 1.5, 1.0, 1.0]
  const score = keys.reduce((s, k, i) => s + (params[k] ? weights[i] : 0), 0)
  if (score <= 1) return { score: R(score, 1), risk_level: 'low', interpretation: '低危：PE 可能性低', recommendations: '可考虑 D-dimer 排除，若阴性则无需进一步影像' }
  if (score <= 6) return { score: R(score, 1), risk_level: 'moderate', interpretation: '中危：PE 需考虑', recommendations: '建议 CT 肺动脉造影或核素通气灌注扫描' }
  return { score: R(score, 1), risk_level: 'high', interpretation: '高危：PE 可能性高', recommendations: '建议 CT 肺动脉造影，考虑抗凝' }
}

function calcSOFA(params: Record<string, unknown>) {
  const pao2Fio2 = Number(params.pao2_fio2 ?? 400)
  const mechVent = !!params.mechanical_ventilation
  const platelets = Number(params.platelets ?? 150)
  const bilirubin = Number(params.bilirubin ?? 0)
  const mapVal = Number(params.map ?? 70)
  const vaso = String(params.vasopressors ?? 'none')
  const gcs = Number(params.gcs ?? 15)
  const creatinine = Number(params.creatinine ?? 0)

  let r = pao2Fio2 >= 400 ? 0 : pao2Fio2 >= 300 ? 1 : pao2Fio2 >= 200 ? 2 : pao2Fio2 >= 100 ? 3 : 4
  if (mechVent && r < 4) r = Math.min(4, r + 1)
  const c = platelets >= 150 ? 0 : platelets >= 100 ? 1 : platelets >= 50 ? 2 : platelets >= 20 ? 3 : 4
  const l = bilirubin < 1.2 ? 0 : bilirubin < 2.0 ? 1 : bilirubin < 6.0 ? 2 : bilirubin < 12.0 ? 3 : 4
  const cv = vaso === 'none' && mapVal >= 70 ? 0 : vaso === 'low_dopamine' ? 1 : vaso === 'high_dopamine' ? 2 : vaso === 'norepinephrine' ? 3 : mapVal >= 70 ? 0 : 1
  const n = gcs === 15 ? 0 : gcs >= 13 ? 1 : gcs >= 10 ? 2 : gcs >= 6 ? 3 : 4
  const k = creatinine < 1.2 ? 0 : creatinine < 2.0 ? 1 : creatinine < 3.5 ? 2 : creatinine < 5.0 ? 3 : 4

  const score = r + c + l + cv + n + k
  const breakdown = { respiration: r, coagulation: c, liver: l, cardiovascular: cv, cns: n, renal: k }
  const tiers: [number, string, string][] = [
    [1, '<5%', 'SOFA 0-1：病死率 <5%'], [6, '<10%', 'SOFA 2-6：病死率 <10%'],
    [9, '15-20%', 'SOFA 7-9：病死率 15-20%'], [12, '40-50%', 'SOFA 10-12：病死率 40-50%'],
    [14, '50-60%', 'SOFA 13-14：病死率 50-60%'], [Infinity, '>80%', 'SOFA ≥15：病死率 >80%'],
  ]
  const tier = tiers.find(t => score <= t[0])!
  const sepsisNote = score >= 2 ? '感染 + SOFA≥2 提示脓毒症' : ''
  return {
    score, risk_level: tier[1], interpretation: tier[2],
    recommendations: '根据各系统分数针对性器官支持' + (sepsisNote ? `；${sepsisNote}` : ''),
    breakdown,
  }
}

function calcLight(params: Record<string, unknown>) {
  const pp = Number(params.pleural_protein ?? 0)
  const sp = Number(params.serum_protein ?? 0)
  const pl = Number(params.pleural_ldh ?? 0)
  const sl = Number(params.serum_ldh ?? 0)
  const slUpper = Number(params.serum_ldh_upper_normal ?? 200)

  const proteinRatio = sp > 0 ? pp / sp : 0
  const ldhRatio = sl > 0 ? pl / sl : 0
  const ldhUpperRule = pl > (2 / 3 * slUpper)
  const exudate = proteinRatio > 0.5 || ldhRatio > 0.6 || ldhUpperRule

  return {
    score: null, risk_level: exudate ? 'exudate' : 'transudate',
    interpretation: exudate ? '渗出液（Light 标准：满足 ≥1 项）' : '漏出液（Light 标准均不符合）',
    recommendations: exudate ? '需进一步病因学检查（感染、恶性肿瘤、结缔组织病等）' : '考虑心衰、肝硬化、肾病综合征等',
    breakdown: {
      protein_ratio: R(proteinRatio, 3), ldh_ratio: R(ldhRatio, 3),
      pleural_ldh_gt_2_3_upper: ldhUpperRule,
    },
  }
}

const CLINICAL_SCORE_HANDLERS: Record<string, (p: Record<string, unknown>) => object> = {
  curb65: calcCURB65, cat: calcCAT, mmrc: calcMMRC, bode: calcBODE,
  wells_pe: calcWellsPE, sofa: calcSOFA, light: calcLight,
}

function handleCalcClinicalScore(args: string[]): object {
  const p = parseArgs(args)
  const scoreType = str(p['score_type'])
  const handler = CLINICAL_SCORE_HANDLERS[scoreType]
  if (!handler) return { error: `不支持的评分类型: ${scoreType}，可选: ${Object.keys(CLINICAL_SCORE_HANDLERS).join(', ')}` }

  try {
    const params = JSON.parse(str(p['params'], '{}'))
    return handler(params)
  } catch (e) {
    return { error: `无效的 JSON 参数: ${e}` }
  }
}

// ────────────────────── 肺功能解读 ──────────────────────

function handleCalcPFT(args: string[]): object {
  const p = parseArgs(args)
  const fev1 = num(p['fev1'])
  const fvc = num(p['fvc'])
  const fev1Pct = num(p['fev1_percent'])
  const fvcPct = num(p['fvc_percent'])
  const dlcoPct = p['dlco_percent'] !== undefined ? num(p['dlco_percent']) : null
  const postBdFev1 = p['post_bd_fev1'] !== undefined ? num(p['post_bd_fev1']) : null

  const ratio = fvc > 0 ? fev1 / fvc : 0
  const obstructive = ratio < 0.70
  const restrictive = ratio >= 0.70 && fvcPct < 80

  let pattern: string, interp: string
  if (obstructive && restrictive) { pattern = 'mixed'; interp = '混合型通气障碍：同时存在阻塞与限制' }
  else if (obstructive) { pattern = 'obstructive'; interp = '阻塞性通气障碍，提示 COPD/哮喘等' }
  else if (restrictive) { pattern = 'restrictive'; interp = '限制性通气障碍，提示间质病、胸廓畸形等' }
  else { pattern = 'normal'; interp = '肺功能大致正常' }

  let goldStage: string | null = null
  if (pattern === 'obstructive') {
    goldStage = fev1Pct >= 80 ? 'GOLD1' : fev1Pct >= 50 ? 'GOLD2' : fev1Pct >= 30 ? 'GOLD3' : 'GOLD4'
  }

  let dlcoGrade: string | null = null
  if (dlcoPct !== null) {
    dlcoGrade = dlcoPct >= 80 ? 'normal' : dlcoPct >= 60 ? 'mild_reduction' : dlcoPct >= 40 ? 'moderate_reduction' : 'severe_reduction'
  }

  let bdResponse: object | null = null
  if (postBdFev1 !== null && fev1 > 0) {
    const absInc = postBdFev1 - fev1
    const pctInc = 100 * absInc / fev1
    bdResponse = { positive: absInc >= 0.2 && pctInc >= 12, absolute_increase_ml: R(absInc * 1000, 1), percent_increase: R(pctInc, 1) }
  }

  return { pattern, gold_stage: goldStage, dlco_grade: dlcoGrade, bd_response: bdResponse, interpretation: interp, fev1_fvc_ratio: R(ratio, 3) }
}

// ────────────────────── 呼吸机参数 ──────────────────────

function handleCalcVentilator(args: string[]): object {
  const p = parseArgs(args)
  const heightCm = num(p['height_cm'])
  const gender = str(p['gender'], 'male')
  const diagnosis = str(p['diagnosis'])
  const targetVt = p['target_vt'] !== undefined ? num(p['target_vt']) : null

  const ibw = Math.max(30, R(gender.toLowerCase() === 'female' ? 45.5 + 0.91 * (heightCm - 152.4) : 50 + 0.91 * (heightCm - 152.4), 1))
  const isARDS = diagnosis.trim().toUpperCase() === 'ARDS'
  const vt = Math.round(targetVt !== null ? ibw * targetVt : ibw * (isARDS ? 6 : 7))
  const rrRange = isARDS ? [20, 30] : [12, 20]
  const peepRange = isARDS ? [8, 15] : [5, 8]
  const mvRange = [R(vt * rrRange[0] / 1000), R(vt * rrRange[1] / 1000)]

  return {
    ibw, tidal_volume: vt, respiratory_rate_range: rrRange, peep_range: peepRange,
    minute_ventilation_range: mvRange, diagnosis,
    notes: 'ARDS：肺保护性通气 6ml/kg IBW；非 ARDS：7ml/kg 或自定义 target_vt',
  }
}

// ────────────────────── 统一调度 ──────────────────────

const HANDLERS: Record<string, (args: string[]) => object> = {
  calc_iit: handleCalcIIT,
  calc_vat: handleCalcVAT,
  calc_labor_compensation: handleCalcLaborCompensation,
  calc_litigation_fee: handleCalcLitigationFee,
  calc_statute: handleCalcStatute,
  calc_cost_estimate: handleCalcCostEstimate,
  calc_cost_fee: handleCalcCostFee,
  calc_cost_tax: handleCalcCostTax,
  calc_clinical_score: handleCalcClinicalScore,
  calc_pft: handleCalcPFT,
  calc_ventilator: handleCalcVentilator,
}

export function runCalc(scriptName: string, args: string[]): { success: boolean; result?: string; error?: string } {
  const handler = HANDLERS[scriptName]
  if (!handler) return { success: false, error: `未知的计算器: ${scriptName}` }
  try {
    const result = handler(args)
    return { success: true, result: JSON.stringify(result, null, 2) }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export function getAvailableCalcs(): string[] {
  return Object.keys(HANDLERS)
}
