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
