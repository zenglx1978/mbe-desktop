// 本地确定性计算引擎
// 通过 child_process 调用本地 Python 脚本执行确定性计算。
// 所有脚本纯 stdlib，无 pip 依赖，离线可用。
// 脚本来源：.claude/skills/{domain}-calc/scripts/calc_*.py

import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import path from 'path'
import fs from 'fs'

/** 计算脚本目录映射 */
const SCRIPT_DIRS: Record<string, string> = {
  calc_iit: 'finance-calc',
  calc_vat: 'finance-calc',
  calc_labor_compensation: 'legal-calc',
  calc_litigation_fee: 'legal-calc',
  calc_statute: 'legal-calc',
  calc_cost_estimate: 'cost-calc',
  calc_cost_fee: 'cost-calc',
  calc_cost_tax: 'cost-calc',
  calc_clinical_score: 'pulmonary-calc',
  calc_pft: 'pulmonary-calc',
  calc_ventilator: 'pulmonary-calc',
}

function findPython(): string {
  const candidates = process.platform === 'win32'
    ? ['python', 'python3', 'py']
    : ['python3', 'python']
  for (const cmd of candidates) {
    try {
      require('child_process').execSync(`${cmd} --version`, { stdio: 'ignore' })
      return cmd
    } catch {
      continue
    }
  }
  return 'python'
}

let pythonCmd: string | null = null

function getPython(): string {
  if (!pythonCmd) {
    pythonCmd = findPython()
  }
  return pythonCmd
}

function getScriptPath(scriptName: string): string | null {
  const skillDir = SCRIPT_DIRS[scriptName]
  if (!skillDir) return null

  const candidates = [
    // 开发模式：从 mbe-desktop 上级（monorepo 根）找
    path.resolve(process.cwd(), '..', '.claude', 'skills', skillDir, 'scripts', `${scriptName}.py`),
    // 开发模式：从 process.cwd() 直接找（在 monorepo 根运行时）
    path.resolve(process.cwd(), '.claude', 'skills', skillDir, 'scripts', `${scriptName}.py`),
    // 打包模式：从 app 资源目录找
    path.resolve(process.resourcesPath || '', 'calc-scripts', `${scriptName}.py`),
  ]

  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

export function setupLocalCalcIPC(): void {
  ipcMain.handle('calc:run', async (_, scriptName: string, args: string[]): Promise<{
    success: boolean
    result?: string
    error?: string
  }> => {
    const scriptPath = getScriptPath(scriptName)
    if (!scriptPath) {
      return { success: false, error: `脚本不存在: ${scriptName}` }
    }

    return new Promise((resolve) => {
      const python = getPython()
      execFile(
        python,
        [scriptPath, ...args],
        {
          timeout: 10000,
          maxBuffer: 1024 * 1024,
          cwd: path.dirname(scriptPath),
        },
        (error, stdout, stderr) => {
          if (error) {
            resolve({
              success: false,
              error: stderr || error.message,
            })
          } else {
            resolve({
              success: true,
              result: stdout.trim(),
            })
          }
        },
      )
    })
  })

  ipcMain.handle('calc:available', async (): Promise<string[]> => {
    const available: string[] = []
    for (const name of Object.keys(SCRIPT_DIRS)) {
      if (getScriptPath(name)) {
        available.push(name)
      }
    }
    return available
  })

  ipcMain.handle('calc:pythonAvailable', async (): Promise<boolean> => {
    try {
      require('child_process').execSync(`${getPython()} --version`, { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  })
}
