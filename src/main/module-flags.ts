/**
 * ModuleFlags — 实验/敏感模块的统一开关 + 本地持久化
 *
 * 背景：行为观察、模式识别、全局副驾驶等模块此前默认开启且无法持久关闭，
 * 在受监管行业（律所/医疗/财税）构成隐私与合规风险。
 *
 * 设计：
 *   - 核心模块（数据库/计算/派遣/交付物）不受此开关控制，始终可用。
 *   - 实验/敏感模块默认关闭（opt-in），用户在设置页显式开启并同意后才启动。
 *   - 偏好持久化到 Documents/MBE Desktop/module-flags.json，重启后保持。
 *   - 启动时同步读取（readFileSync + 缓存），供 index.ts 决定是否拉起模块。
 */

import { app, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'

export type ModuleFlagKey =
  | 'behaviorObserver'
  | 'patternRecognizer'
  | 'copilot'
  | 'rpa'
  | 'accessibility'

/** 默认全部关闭：实验/敏感模块需用户显式 opt-in */
const DEFAULTS: Record<ModuleFlagKey, boolean> = {
  behaviorObserver: false,
  patternRecognizer: false,
  copilot: false,
  rpa: false,
  accessibility: false,
}

let cache: Record<ModuleFlagKey, boolean> | null = null

function flagsPath(): string {
  return path.join(app.getPath('documents'), 'MBE Desktop', 'module-flags.json')
}

function load(): Record<ModuleFlagKey, boolean> {
  if (cache) return cache
  try {
    const raw = fs.readFileSync(flagsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Record<ModuleFlagKey, boolean>>
    cache = { ...DEFAULTS, ...parsed }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache
}

export function getFlag(key: ModuleFlagKey): boolean {
  return load()[key] ?? DEFAULTS[key]
}

export function getAllFlags(): Record<ModuleFlagKey, boolean> {
  return { ...load() }
}

export function setFlag(key: ModuleFlagKey, value: boolean): void {
  if (!(key in DEFAULTS)) return
  const flags = load()
  flags[key] = !!value
  cache = flags
  try {
    const dir = path.dirname(flagsPath())
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(flagsPath(), JSON.stringify(flags, null, 2), 'utf-8')
  } catch (err) {
    console.error('[ModuleFlags] 持久化失败:', err) // eslint-disable-line no-console
  }
}

export function setupModuleFlagsIPC(): void {
  ipcMain.handle('moduleFlags:getAll', () => getAllFlags())
  ipcMain.handle('moduleFlags:get', (_, key: ModuleFlagKey) => getFlag(key))
  ipcMain.handle('moduleFlags:set', (_, key: ModuleFlagKey, value: boolean) => {
    setFlag(key, value)
    return getAllFlags()
  })
}
