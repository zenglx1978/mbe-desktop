// 本地确定性计算引擎 — 纯 TypeScript 实现
// 零 child_process、零 Python 依赖，消除 Windows Defender 误报。
// 计算逻辑见 calc-engine.ts

import { ipcMain } from 'electron'
import { runCalc, getAvailableCalcs } from './calc-engine'

export function setupLocalCalcIPC(): void {
  ipcMain.handle('calc:run', async (_, scriptName: string, args: string[]): Promise<{
    success: boolean
    result?: string
    error?: string
  }> => {
    if (typeof scriptName !== 'string' || !scriptName) {
      return { success: false, error: '无效的计算器名称' }
    }
    const available = getAvailableCalcs()
    if (!available.includes(scriptName)) {
      return { success: false, error: `计算器不在白名单中: ${scriptName}，可用: ${available.join(', ')}` }
    }
    if (!Array.isArray(args) || args.some(a => typeof a !== 'string')) {
      return { success: false, error: '参数必须为字符串数组' }
    }
    return runCalc(scriptName, args)
  })

  ipcMain.handle('calc:available', async (): Promise<string[]> => {
    return getAvailableCalcs()
  })

  ipcMain.handle('calc:pythonAvailable', async (): Promise<boolean> => {
    // 不再依赖 Python，始终返回 true（纯 TS 计算）
    return true
  })
}
