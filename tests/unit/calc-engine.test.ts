import { describe, it, expect } from 'vitest'
import { runCalc, getAvailableCalcs } from '../../src/main/calc-engine'

function run(name: string, args: string[]) {
  const r = runCalc(name, args)
  expect(r.success).toBe(true)
  return JSON.parse(r.result!)
}

// ────────────────────── 注册表 ──────────────────────

describe('getAvailableCalcs', () => {
  it('返回 11 个计算器', () => {
    const calcs = getAvailableCalcs()
    expect(calcs).toHaveLength(11)
    expect(calcs).toContain('calc_iit')
    expect(calcs).toContain('calc_vat')
    expect(calcs).toContain('calc_labor_compensation')
  })

  it('未知计算器返回错误', () => {
    const r = runCalc('unknown_calc', [])
    expect(r.success).toBe(false)
    expect(r.error).toContain('未知的计算器')
  })
})

// ────────────────────── 个人所得税 ──────────────────────

describe('calc_iit — 综合所得', () => {
  it('年收入 12 万，标准扣除', () => {
    const r = run('calc_iit', ['--annual-income', '120000'])
    expect(Number(r.taxable_income)).toBe(60000)
    // 60000 → 第二档 10%，速算扣除 2520
    expect(Number(r.tax)).toBe(60000 * 0.10 - 2520) // 3480
    expect(r.legal_basis).toContain('个人所得税法')
  })

  it('年收入 36 万，专项扣除 6 万', () => {
    const r = run('calc_iit', ['--annual-income', '360000', '--special-deduction', '60000'])
    // 应纳税所得额 = 360000 - 60000 - 60000 = 240000 → 20% 档
    expect(Number(r.taxable_income)).toBe(240000)
    expect(Number(r.tax)).toBe(240000 * 0.20 - 16920) // 31080
  })

  it('低于起征点不纳税', () => {
    const r = run('calc_iit', ['--annual-income', '50000'])
    expect(Number(r.tax)).toBe(0)
    expect(r.formula).toContain('无需缴税')
  })
})

describe('calc_iit — 年终奖', () => {
  it('年终奖 3 万', () => {
    const r = run('calc_iit', ['--bonus', '30000'])
    expect(Number(r.monthly_average)).toBe(2500) // 30000/12
    expect(Number(r.tax)).toBe(30000 * 0.03 - 0) // 900
    expect(Number(r.after_tax_bonus)).toBe(29100)
  })

  it('年终奖 14.4 万', () => {
    const r = run('calc_iit', ['--bonus', '144000'])
    const monthly = 144000 / 12 // 12000
    expect(Number(r.monthly_average)).toBe(monthly)
    // 12000 → 10% 档
    expect(Number(r.tax_rate)).toBe(0.1)
  })
})

// ────────────────────── 增值税 ──────────────────────

describe('calc_vat — 一般纳税人', () => {
  it('标准税率 13%', () => {
    const r = run('calc_vat', ['general', '--output-amount', '1000000', '--input-amount', '600000'])
    expect(Number(r.output_tax)).toBe(130000)
    expect(Number(r.input_tax)).toBe(78000)
    expect(Number(r.vat_payable)).toBe(52000)
  })

  it('留抵税额', () => {
    const r = run('calc_vat', ['general', '--output-amount', '100000', '--input-amount', '200000'])
    expect(Number(r.vat_payable)).toBe(0)
    expect(Number(r.carried_forward_credit)).toBeGreaterThan(0)
  })
})

describe('calc_vat — 小规模纳税人', () => {
  it('季度 30 万以下免征', () => {
    const r = run('calc_vat', ['small', '--revenue', '250000'])
    expect(Number(r.vat_payable)).toBe(0)
    expect(r.note).toContain('免征增值税')
  })

  it('超免征额需缴税', () => {
    const r = run('calc_vat', ['small', '--revenue', '500000'])
    expect(Number(r.vat_payable)).toBeGreaterThan(0)
  })
})

describe('calc_vat — 附加税', () => {
  it('城市附加税计算', () => {
    const r = run('calc_vat', ['surcharge', '--vat-paid', '10000', '--location', 'city'])
    expect(Number(r.city_maintenance_tax)).toBe(700) // 10000 × 7%
    expect(Number(r.education_surcharge)).toBe(300)   // 10000 × 3%
    expect(Number(r.local_education_surcharge)).toBe(200) // 10000 × 2%
    expect(Number(r.total_surcharge)).toBe(1200)
  })
})

// ────────────────────── 劳动经济补偿 ──────────────────────

describe('calc_labor_compensation', () => {
  it('协商解除 N', () => {
    const r = run('calc_labor_compensation', ['--salary', '10000', '--years', '5', '--type', 'mutual'])
    expect(Number(r.total_compensation)).toBe(50000) // 10000 × 5
  })

  it('违法解除 2N', () => {
    const r = run('calc_labor_compensation', ['--salary', '10000', '--years', '3', '--type', 'illegal'])
    expect(Number(r.total_compensation)).toBe(60000) // 10000 × 3 × 2
  })

  it('半年以上不足一年按一年', () => {
    const r = run('calc_labor_compensation', ['--salary', '10000', '--years', '2.7', '--type', 'mutual'])
    // 2.7 → 2 + 0.7(≥0.5) → 3 个月
    expect(Number(r.total_compensation)).toBe(30000)
  })

  it('不足半年按 0.5 个月', () => {
    const r = run('calc_labor_compensation', ['--salary', '10000', '--years', '1.3', '--type', 'mutual'])
    // 1.3 → 1 + 0.3(>0) → 1.5 个月
    expect(Number(r.total_compensation)).toBe(15000)
  })

  it('三倍封顶 + 12 年上限', () => {
    const r = run('calc_labor_compensation', [
      '--salary', '40000', '--years', '15', '--type', 'mutual', '--avg-salary-3x', '30000',
    ])
    // 工资 40000 > 三倍 30000，按 30000 算，年限封顶 12 个月
    expect(Number(r.total_compensation)).toBe(360000) // 30000 × 12
  })

  it('无过失性辞退 + 代通知金', () => {
    const r = run('calc_labor_compensation', [
      '--salary', '10000', '--years', '3', '--type', 'no_fault', '--proxy-notice',
    ])
    // N + 1 个月代通知金 = 10000×3 + 10000
    expect(Number(r.total_compensation)).toBe(40000)
  })

  it('未知解除类型报错', () => {
    const r = run('calc_labor_compensation', ['--salary', '10000', '--years', '3', '--type', 'invalid_type'])
    expect(r.error).toContain('不支持的解除类型')
  })
})

// ────────────────────── 诉讼费 ──────────────────────

describe('calc_litigation_fee', () => {
  it('1 万以下固定 50 元', () => {
    const r = run('calc_litigation_fee', ['--amount', '5000'])
    expect(Number(r.litigation_fee)).toBe(50)
  })

  it('标的额 10 万', () => {
    const r = run('calc_litigation_fee', ['--amount', '100000'])
    // 100000 × 0.025 - 200 = 2300
    expect(Number(r.litigation_fee)).toBe(2300)
  })

  it('简易程序减半', () => {
    const r = run('calc_litigation_fee', ['--amount', '100000'])
    expect(Number(r.litigation_fee_half)).toBe(1150)
  })

  it('标的额 0 报错', () => {
    const r = run('calc_litigation_fee', ['--amount', '0'])
    expect(r.error).toContain('标的额必须大于 0')
  })
})

// ────────────────────── 诉讼时效 ──────────────────────

describe('calc_statute', () => {
  it('一般诉讼时效 3 年', () => {
    const r = run('calc_statute', ['--case-type', 'general', '--start-date', '2020-01-01'])
    expect(r.expired).toBe(true) // 2020+3 = 2023, 已过期
    expect(r.statute_years).toBe(3)
  })

  it('劳动仲裁时效 1 年', () => {
    const r = run('calc_statute', ['--case-type', 'labor', '--start-date', '2020-06-01'])
    expect(r.expired).toBe(true)
    expect(r.statute_years).toBe(1)
  })

  it('未来日期未过期', () => {
    const nextYear = new Date().getFullYear() + 1
    const r = run('calc_statute', ['--case-type', 'general', '--start-date', `${nextYear}-01-01`])
    expect(r.expired).toBe(false)
    expect(r.status).toBe('有效')
  })

  it('未知案件类型报错', () => {
    const r = run('calc_statute', ['--case-type', 'unknown_type', '--start-date', '2024-01-01'])
    expect(r.error).toContain('不支持的案件类型')
  })
})

// ────────────────────── 造价估算 ──────────────────────

describe('calc_cost_estimate', () => {
  it('建筑工程标准品质', () => {
    const r = run('calc_cost_estimate', ['--project_type', 'building', '--area', '1000'])
    expect(Number(r.unit_cost)).toBe(4000)
    expect(Number(r.total_cost)).toBe(4000000)
    expect(r.composition).toHaveProperty('labor')
    expect(r.composition).toHaveProperty('material')
  })

  it('经济品质系数 0.75', () => {
    const r = run('calc_cost_estimate', ['--project_type', 'building', '--area', '100', '--quality', 'economy'])
    expect(Number(r.quality_coeff)).toBe(0.75)
    expect(Number(r.unit_cost)).toBe(3000) // 4000 × 0.75
  })
})

// ────────────────────── 造价取费 ──────────────────────

describe('calc_cost_fee', () => {
  it('标准取费计算', () => {
    const r = run('calc_cost_fee', ['--base_amount', '1000000'])
    expect(Number(r.grand_total)).toBeGreaterThan(1000000)
    expect(r.fees).toHaveProperty('management_fee')
    expect(r.tax_rate).toBe('9%')
  })
})

// ────────────────────── 建安税金 ──────────────────────

describe('calc_cost_tax', () => {
  it('一般计税 9%', () => {
    const r = run('calc_cost_tax', ['--amount', '1090000', '--method', 'general'])
    expect(Number(r.vat)).toBeGreaterThan(0)
    expect(r.method).toBe('一般计税')
  })

  it('简易计税 3%', () => {
    const r = run('calc_cost_tax', ['--amount', '103000', '--method', 'simplified'])
    expect(r.method).toBe('简易计税')
    expect(Number(r.vat_rate)).toBe(0.03)
  })
})

// ────────────────────── 肺科临床评分 ──────────────────────

describe('calc_clinical_score', () => {
  it('CURB-65 低危', () => {
    const params = JSON.stringify({ confusion: false, urea: false, respiratory_rate: false, blood_pressure: false, age: false })
    const r = run('calc_clinical_score', ['--score_type', 'curb65', '--params', params])
    expect(r.score).toBe(0)
    expect(r.risk_level).toBe('low')
  })

  it('CURB-65 高危', () => {
    const params = JSON.stringify({ confusion: true, urea: true, respiratory_rate: true, blood_pressure: true, age: true })
    const r = run('calc_clinical_score', ['--score_type', 'curb65', '--params', params])
    expect(r.score).toBe(5)
    expect(r.risk_level).toBe('high')
  })

  it('CAT 评分', () => {
    const params = JSON.stringify({ cough: 3, phlegm: 2, chest_tightness: 2, breathlessness: 3, activity_limit: 2, confidence_leaving: 1, sleep: 2, energy: 2 })
    const r = run('calc_clinical_score', ['--score_type', 'cat', '--params', params])
    expect(r.score).toBe(17)
    expect(r.risk_level).toBe('moderate')
  })

  it('Light 标准 — 漏出液', () => {
    const params = JSON.stringify({ pleural_protein: 15, serum_protein: 60, pleural_ldh: 80, serum_ldh: 250, serum_ldh_upper_normal: 200 })
    const r = run('calc_clinical_score', ['--score_type', 'light', '--params', params])
    expect(r.risk_level).toBe('transudate')
  })

  it('Light 标准 — 渗出液', () => {
    const params = JSON.stringify({ pleural_protein: 40, serum_protein: 60, pleural_ldh: 200, serum_ldh: 250, serum_ldh_upper_normal: 200 })
    const r = run('calc_clinical_score', ['--score_type', 'light', '--params', params])
    expect(r.risk_level).toBe('exudate')
  })

  it('未知评分类型报错', () => {
    const r = run('calc_clinical_score', ['--score_type', 'unknown_score', '--params', '{}'])
    expect(r.error).toContain('不支持的评分类型')
  })
})

// ────────────────────── 肺功能解读 ──────────────────────

describe('calc_pft', () => {
  it('正常肺功能', () => {
    const r = run('calc_pft', ['--fev1', '3.5', '--fvc', '4.5', '--fev1_percent', '95', '--fvc_percent', '100'])
    expect(r.pattern).toBe('normal')
  })

  it('阻塞性通气障碍 + GOLD 分级', () => {
    const r = run('calc_pft', ['--fev1', '1.2', '--fvc', '3.0', '--fev1_percent', '40', '--fvc_percent', '85'])
    expect(r.pattern).toBe('obstructive')
    expect(r.gold_stage).toBe('GOLD3') // fev1_percent 40 → 30~50 = GOLD3
  })

  it('限制性通气障碍', () => {
    const r = run('calc_pft', ['--fev1', '2.5', '--fvc', '3.0', '--fev1_percent', '70', '--fvc_percent', '60'])
    // ratio = 2.5/3.0 = 0.833 ≥ 0.70, fvc_percent 60 < 80 → restrictive
    expect(r.pattern).toBe('restrictive')
  })

  it('支气管舒张试验阳性', () => {
    const r = run('calc_pft', [
      '--fev1', '2.0', '--fvc', '3.5', '--fev1_percent', '55', '--fvc_percent', '85',
      '--post_bd_fev1', '2.5',
    ])
    expect(r.bd_response).toBeTruthy()
    expect(r.bd_response.positive).toBe(true)
  })
})

// ────────────────────── 呼吸机参数 ──────────────────────

describe('calc_ventilator', () => {
  it('ARDS 肺保护通气', () => {
    const r = run('calc_ventilator', ['--height_cm', '170', '--gender', 'male', '--diagnosis', 'ARDS'])
    expect(r.tidal_volume).toBeLessThanOrEqual(r.ibw * 8) // ≤8ml/kg
    expect(r.peep_range[0]).toBeGreaterThanOrEqual(8)
  })

  it('非 ARDS 标准通气', () => {
    const r = run('calc_ventilator', ['--height_cm', '165', '--gender', 'female', '--diagnosis', 'pneumonia'])
    expect(r.respiratory_rate_range[0]).toBe(12)
    expect(r.peep_range[0]).toBe(5)
  })
})
