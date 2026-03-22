/**
 * 网络连通性状态管理
 *
 * 监测网络状态和后端可达性，控制在线/离线/降级模式。
 * 离线时：确定性计算仍可用，AI 对话不可用。
 */

import { create } from 'zustand'
import { API_BASE } from '@/lib/api-client'

export type ConnectivityMode = 'online' | 'offline' | 'degraded'

interface ConnectivityState {
  mode: ConnectivityMode
  /** 浏览器网络 API 报告的状态 */
  browserOnline: boolean
  /** 后端 API 是否可达 */
  backendReachable: boolean
  /** 本地 Python 是否可用 */
  pythonAvailable: boolean
  /** 可用的本地计算脚本 */
  availableScripts: string[]
  /** 上次检测时间 */
  lastCheck: number

  checkConnectivity: () => Promise<void>
  setPythonStatus: (available: boolean, scripts: string[]) => void
}

const BACKEND_HEALTH_URL = `${API_BASE}/api/health`
const CHECK_INTERVAL = 30_000

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  mode: navigator.onLine ? 'online' : 'offline',
  browserOnline: navigator.onLine,
  backendReachable: false,
  pythonAvailable: false,
  availableScripts: [],
  lastCheck: 0,

  checkConnectivity: async () => {
    const browserOnline = navigator.onLine
    let backendReachable = false

    if (browserOnline) {
      try {
        const resp = await fetch(BACKEND_HEALTH_URL, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        })
        backendReachable = resp.ok
      } catch {
        backendReachable = false
      }
    }

    const mode: ConnectivityMode = backendReachable
      ? 'online'
      : browserOnline
        ? 'degraded'
        : 'offline'

    set({ mode, browserOnline, backendReachable, lastCheck: Date.now() })
  },

  setPythonStatus: (available: boolean, scripts: string[]) => {
    set({ pythonAvailable: available, availableScripts: scripts })
  },
}))

/** 检测本地 Python 和脚本可用性 */
async function checkLocalCalcStatus() {
  const store = useConnectivityStore.getState()
  try {
    const api = (window as any).electronAPI
    if (!api?.calc) return

    const [pythonOk, scripts] = await Promise.all([
      api.calc.pythonAvailable() as Promise<boolean>,
      api.calc.available() as Promise<string[]>,
    ])
    store.setPythonStatus(pythonOk, scripts)
  } catch {
    store.setPythonStatus(false, [])
  }
}

/** 初始化连通性监测，返回清理函数 */
export function initConnectivityMonitor(): () => void {
  const store = useConnectivityStore.getState()

  store.checkConnectivity()
  checkLocalCalcStatus()

  const onOnline = () => store.checkConnectivity()
  const onOffline = () => store.checkConnectivity()
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  const t1 = setInterval(() => store.checkConnectivity(), CHECK_INTERVAL)
  const t2 = setInterval(() => checkLocalCalcStatus(), CHECK_INTERVAL * 2)

  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    clearInterval(t1)
    clearInterval(t2)
  }
}
