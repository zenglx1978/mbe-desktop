import type { WindowWithElectron } from '@/types/api-responses'

/**
 * 本地确定性计算服务（渲染进程端）
 *
 * 调用主进程的 Python 脚本执行确定性计算。
 * 离线时仍然可用 — 税费、诉讼费、临床评分不需要网络。
 */

export interface CalcResult {
  success: boolean
  result?: string
  error?: string
  parsed?: Record<string, unknown>
}

function getAPI() {
  return (window as WindowWithElectron).electronAPI
}

/** 执行本地计算脚本 */
export async function runLocalCalc(scriptName: string, args: string[]): Promise<CalcResult> {
  const api = getAPI()
  if (!api?.runLocalCalc) {
    return { success: false, error: '非桌面端环境，本地计算不可用' }
  }

  const raw = (await api.runLocalCalc(scriptName, args)) as {
    success: boolean
    result?: string
    error?: string
  }
  const result: CalcResult = { ...raw }
  if (raw.success && raw.result) {
    try {
      result.parsed = JSON.parse(raw.result)
    } catch {
      // Expected: 脚本输出非 JSON；保留原始 result 字符串
    }
  }
  return result
}

/** 检查本地 Python 是否可用 */
export async function checkPythonAvailable(): Promise<boolean> {
  const api = getAPI()
  if (!api?.runLocalCalc) return false
  try {
    const { ipcRenderer } = window.require('electron')
    return await ipcRenderer.invoke('calc:pythonAvailable')
  } catch {
    // Expected: Electron IPC 不可用；视为 Python 检测失败
    return false
  }
}

/** 获取当前可用的本地计算脚本列表 */
export async function getAvailableScripts(): Promise<string[]> {
  const api = getAPI()
  if (!api?.runLocalCalc) return []
  try {
    const { ipcRenderer } = window.require('electron')
    return await ipcRenderer.invoke('calc:available')
  } catch {
    // Expected: IPC 不可用；无本地脚本列表
    return []
  }
}

// ── 快捷方法 ──

/** 计算个人所得税 */
export function calcIIT(annualIncome: number, specialDeduction = 0, additionalDeduction = 0) {
  return runLocalCalc('calc_iit', [
    '--annual-income', String(annualIncome),
    '--special-deduction', String(specialDeduction),
    '--special-additional', String(additionalDeduction),
    '--format', 'json',
  ])
}

/** 计算增值税（一般纳税人） */
export function calcVATGeneral(outputAmount: number, inputAmount: number, rate = 0.13) {
  return runLocalCalc('calc_vat', [
    '--type', 'general',
    '--output-amount', String(outputAmount),
    '--input-amount', String(inputAmount),
    '--rate', String(rate),
    '--format', 'json',
  ])
}

/** 计算诉讼费 */
export function calcLitigationFee(amount: number) {
  return runLocalCalc('calc_litigation_fee', [
    '--amount', String(amount),
    '--format', 'json',
  ])
}

/** 计算劳动补偿金 */
export function calcLaborCompensation(monthlySalary: number, yearsWorked: number, terminationType: string) {
  return runLocalCalc('calc_labor_compensation', [
    '--monthly-salary', String(monthlySalary),
    '--years-worked', String(yearsWorked),
    '--termination-type', terminationType,
    '--format', 'json',
  ])
}

/** 计算诉讼时效 */
export function calcStatute(caseType: string, startDate: string) {
  return runLocalCalc('calc_statute', [
    '--case-type', caseType,
    '--start-date', startDate,
    '--format', 'json',
  ])
}

/** 造价快速估算 */
export function calcCostEstimate(projectType: string, area: number, quality = 'standard') {
  return runLocalCalc('calc_cost_estimate', [
    '--project-type', projectType,
    '--area', String(area),
    '--quality', quality,
    '--format', 'json',
  ])
}

/** 临床评分（CURB-65 等） */
export function calcClinicalScore(scoreType: string, params: Record<string, unknown>) {
  return runLocalCalc('calc_clinical_score', [
    '--score-type', scoreType,
    '--params', JSON.stringify(params),
    '--format', 'json',
  ])
}

/** 肺功能解读 */
export function calcPFT(fev1: number, fvc: number, fev1Percent: number, fvcPercent: number) {
  return runLocalCalc('calc_pft', [
    '--fev1', String(fev1),
    '--fvc', String(fvc),
    '--fev1-percent', String(fev1Percent),
    '--fvc-percent', String(fvcPercent),
    '--format', 'json',
  ])
}
