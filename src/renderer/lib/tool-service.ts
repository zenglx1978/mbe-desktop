/**
 * 工具调用服务 — 统一本地 Python 计算和远端 API 调用
 *
 * 离线优先：有本地脚本则优先调用 Python，失败时 fallback 到远端。
 * 所有结果写入 SQLite calc_history。
 */

import type { ToolConfig } from './solution-router'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'
import { authHeaders, API_BASE } from '@/lib/api-client'
import type { RunLocalCalcRawResult, WindowWithElectron } from '@/types/api-responses'

export interface CalcResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
  source: 'local' | 'remote'
  durationMs: number
}

/**
 * 表单字段 → Python CLI 参数映射
 * 不同脚本的参数名和表单 key 不完全一致
 */
const FIELD_TO_ARG: Record<string, Record<string, string>> = {
  calc_labor_compensation: {
    monthly_salary: '--salary',
    work_years: '--years',
    dismissal_type: '--type',
  },
  calc_litigation_fee: {
    amount: '--amount',
  },
  calc_iit: {
    salary: '--annual-income',
    insurance: '--special-deduction',
    deduction: '--special-additional',
  },
  calc_vat: {
    amount: '--amount',
    rate: '--rate',
  },
  calc_statute: {
    case_type: '--type',
    start_date: '--start-date',
  },
  calc_cost_fee: {
    project_type: '--type',
    base_cost: '--base-cost',
  },
  calc_cost_tax: {
    amount: '--amount',
    tax_rate: '--rate',
  },
  calc_cost_estimate: {
    area: '--area',
    structure: '--structure',
  },
  calc_clinical_score: {
    score_type: '--type',
  },
  calc_pft: {
    fev1: '--fev1',
    fvc: '--fvc',
    fev1_pred: '--fev1-pred',
  },
  calc_ventilator: {
    weight: '--weight',
    mode: '--mode',
  },
}

/** dismissal_type 表单值 → Python 脚本参数值映射 */
const DISMISSAL_MAP: Record<string, string> = {
  'N': 'mutual',
  'N+1': 'no_fault',
  '2N': 'illegal',
}

function buildArgs(scriptName: string, values: Record<string, unknown>): string[] {
  const map = FIELD_TO_ARG[scriptName]
  if (!map) {
    return Object.entries(values).flatMap(([k, v]) =>
      v != null && v !== '' ? [`--${k}`, String(v)] : []
    )
  }

  const args: string[] = []
  for (const [fieldKey, argName] of Object.entries(map)) {
    let val: unknown = values[fieldKey]
    if (val == null || val === '') continue

    // 个税：月薪 → 年收入
    if (scriptName === 'calc_iit' && fieldKey === 'salary') {
      val = parseFloat(String(val)) * 12
    }

    // 劳动补偿：表单选项 → 脚本枚举值
    if (scriptName === 'calc_labor_compensation' && fieldKey === 'dismissal_type') {
      val = DISMISSAL_MAP[String(val)] || val
    }

    args.push(argName, String(val))
  }
  return args
}

/** 调用本地 Python 脚本 */
async function runLocal(tool: ToolConfig, values: Record<string, unknown>): Promise<CalcResult | null> {
  if (!tool.localScript) return null

  const api = (window as WindowWithElectron).electronAPI
  if (!api?.runLocalCalc) return null

  const args = buildArgs(tool.localScript, values)
  const start = Date.now()

  try {
    const res = (await api.runLocalCalc(tool.localScript, args)) as RunLocalCalcRawResult
    const duration = Date.now() - start

    if (res.success && res.result) {
      try {
        const data = JSON.parse(res.result)
        if (data.error) {
          return { success: false, error: data.error, source: 'local', durationMs: duration }
        }
        return { success: true, data, source: 'local', durationMs: duration }
      } catch {
        // Expected: 本地脚本 stdout 非 JSON；按原始字符串包装
        return { success: true, data: { result: res.result }, source: 'local', durationMs: duration }
      }
    }
    return null
  } catch {
    // Expected: runLocalCalc IPC 抛错；无本地结果
    return null
  }
}

export function resolveAgentBase(_agentId: string): string {
  return API_BASE
}

/** 调用远端 Agent API */
async function runRemote(tool: ToolConfig, values: Record<string, unknown>): Promise<CalcResult> {
  const start = Date.now()
  try {
    const base = resolveAgentBase(tool.agent)
    const resp = await fetch(`${base}${tool.apiPath}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(values),
      signal: AbortSignal.timeout(15000),
    })
    const duration = Date.now() - start

    if (!resp.ok) {
      return { success: false, error: `服务器错误 (${resp.status})`, source: 'remote', durationMs: duration }
    }
    const data = (await resp.json()) as Record<string, unknown>
    return { success: true, data, source: 'remote', durationMs: duration }
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : ''
    const message = err instanceof Error ? err.message : '网络错误'
    return {
      success: false,
      error: name === 'TimeoutError' ? '请求超时' : message,
      source: 'remote',
      durationMs: Date.now() - start,
    }
  }
}

/** 保存计算历史到 SQLite */
async function saveHistory(
  solutionId: string,
  toolId: string,
  input: Record<string, unknown>,
  result: CalcResult,
) {
  try {
    const api = (window as WindowWithElectron).electronAPI
    if (!api?.db?.calc) return

    await api.db.calc.add({
      id: `calc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      solutionId,
      toolId,
      inputJson: JSON.stringify(input),
      outputJson: JSON.stringify(result.data || {}),
      confidence: result.source === 'local' ? 1.0 : 0.95,
      source: result.source,
    })
  } catch {
    // Expected: SQLite 历史写入失败；不影响计算主流程
  }
}

/**
 * 执行计算 — 离线优先策略
 * 1. 有本地脚本 → 先跑本地 Python
 * 2. 本地失败/无脚本 → fallback 到远端 API
 * 3. 成功后自动保存历史
 */
export async function runCalculation(
  tool: ToolConfig,
  values: Record<string, unknown>,
  solutionId: string,
): Promise<CalcResult> {
  // Bitter Lesson: 追踪工具使用频率
  useAdaptiveUIStore.getState().trackToolUse(solutionId, tool.id)

  // 本地优先
  const localResult = await runLocal(tool, values)
  if (localResult?.success) {
    await saveHistory(solutionId, tool.id, values, localResult)
    return localResult
  }

  // 远端 fallback
  const remoteResult = await runRemote(tool, values)
  if (remoteResult.success) {
    await saveHistory(solutionId, tool.id, values, remoteResult)
  }
  return remoteResult
}
