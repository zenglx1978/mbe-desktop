/**
 * ERP 同步服务 — QuickBooks "Bank Feeds / Integrations" 对标
 *
 * 管理 ERP 数据源配置、同步任务、自动对账规则。
 * 渲染进程通过 Electron IPC 调用 LocalAppBridge 读取 ERP 数据。
 * 无 IPC 时降级为手动 CSV 导入或模拟数据。
 */

export type ERPProvider = 'jushuitan' | 'wangdiantong' | 'youzan' | 'pinduoduo' | 'shopify' | 'manual_csv' | 'api' | 'webhook' | 'watch_dir'

export interface ERPConnection {
  id: string
  provider: ERPProvider
  name: string
  enabled: boolean
  lastSyncAt: string | null
  lastSyncStatus: 'success' | 'failed' | 'syncing' | null
  syncInterval: number  // 分钟
  config: Record<string, string>
  createdAt: string
}

export interface ERPOrderRow {
  orderId: string
  brandName: string
  platform: string
  orderDate: string
  gmv: number
  commission: number
  refundAmount: number
  status: 'paid' | 'refunded' | 'pending'
}

export interface ReconRule {
  id: string
  name: string
  description: string
  enabled: boolean
  type: 'tolerance' | 'auto_match' | 'alert'
  config: {
    tolerancePercent?: number
    toleranceAbsolute?: number
    matchField?: string
    alertThreshold?: number
  }
}

const STORAGE_KEY = 'mbe-erp-connections'
const RULES_KEY = 'mbe-recon-rules'

const DEFAULT_RULES: ReconRule[] = [
  {
    id: 'gmv_tolerance',
    name: 'GMV 容差自动匹配',
    description: '内外部 GMV 差异在 0.5% 以内自动标记为"已核验"',
    enabled: true,
    type: 'tolerance',
    config: { tolerancePercent: 0.5 },
  },
  {
    id: 'commission_tolerance',
    name: '佣金容差自动匹配',
    description: '内外部佣金差异在 100 元以内自动标记为"已核验"',
    enabled: true,
    type: 'tolerance',
    config: { toleranceAbsolute: 100 },
  },
  {
    id: 'large_diff_alert',
    name: '大额差异预警',
    description: '差异超过 5000 元自动触发预警通知',
    enabled: true,
    type: 'alert',
    config: { alertThreshold: 5000 },
  },
  {
    id: 'auto_month_match',
    name: '按月自动汇总匹配',
    description: '自动按品牌+月份汇总 ERP 订单数据用于对账',
    enabled: true,
    type: 'auto_match',
    config: { matchField: 'month' },
  },
]

export function loadConnections(): ERPConnection[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function saveConnections(connections: ERPConnection[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections))
}

export function loadReconRules(): ReconRule[] {
  try {
    const stored = localStorage.getItem(RULES_KEY)
    return stored ? JSON.parse(stored) : DEFAULT_RULES
  } catch {
    return DEFAULT_RULES
  }
}

export function saveReconRules(rules: ReconRule[]) {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules))
}

/** 尝试通过 Electron IPC 从 ERP 获取数据 */
export async function fetchERPData(connection: ERPConnection): Promise<ERPOrderRow[]> {
  const bridge = (window as any).electronAPI?.localAppBridge
  if (bridge) {
    try {
      return await bridge.fetchERPData({
        provider: connection.provider,
        config: connection.config,
      })
    } catch {
      // IPC 调用失败，降级
    }
  }
  // 无 IPC 或调用失败 → 返回空（UI 层引导用户手动导入 CSV）
  return []
}

/** 解析 CSV 文本为 ERP 行数据 */
export function parseCSVToOrders(csv: string): ERPOrderRow[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase())
  const rows: ERPOrderRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(',').map((c) => c.trim())
    const get = (key: string) => cols[header.indexOf(key)] || ''

    rows.push({
      orderId: get('orderid') || get('order_id') || get('订单号') || `row-${i}`,
      brandName: get('brand') || get('brandname') || get('品牌') || '',
      platform: get('platform') || get('平台') || '',
      orderDate: get('date') || get('orderdate') || get('日期') || '',
      gmv: parseFloat(get('gmv') || get('金额') || '0'),
      commission: parseFloat(get('commission') || get('佣金') || '0'),
      refundAmount: parseFloat(get('refund') || get('退款') || '0'),
      status: (get('status') || 'paid') as any,
    })
  }
  return rows.filter((r) => r.gmv > 0 || r.refundAmount > 0)
}

/** 按品牌+月份汇总 ERP 数据 */
export function aggregateByBrandMonth(orders: ERPOrderRow[]): Map<string, { gmv: number; commission: number; deductions: number }> {
  const map = new Map<string, { gmv: number; commission: number; deductions: number }>()
  for (const order of orders) {
    const month = order.orderDate.slice(0, 7)
    const key = `${order.brandName}|${month}`
    const existing = map.get(key) || { gmv: 0, commission: 0, deductions: 0 }
    existing.gmv += order.gmv
    existing.commission += order.commission
    existing.deductions += order.refundAmount
    map.set(key, existing)
  }
  return map
}

export interface ReconResult {
  settlementId: string
  brandName: string
  month: string
  internalGmv: number
  externalGmv: number
  gmvDiff: number
  internalCommission: number
  externalCommission: number
  commissionDiff: number
  deductions: number
  status: 'matched' | 'within_tolerance' | 'diff' | 'alert'
  triggeredRules: string[]
}

/** 执行自动对账规则引擎 */
export function runReconciliation(
  settlements: { id: string; brandName: string; month: string; gmv: number; totalAmount: number }[],
  erpAggregated: Map<string, { gmv: number; commission: number; deductions: number }>,
  rules: ReconRule[],
): ReconResult[] {
  const results: ReconResult[] = []
  const enabledRules = rules.filter((r) => r.enabled)

  for (const s of settlements) {
    const erpKey = `${s.brandName}|${s.month}`
    const erp = erpAggregated.get(erpKey)

    if (!erp) continue

    const gmvDiff = erp.gmv - s.gmv
    const commissionDiff = erp.commission - s.totalAmount
    const triggeredRules: string[] = []
    let status: ReconResult['status'] = 'diff'

    for (const rule of enabledRules) {
      if (rule.type === 'tolerance' && rule.config.tolerancePercent) {
        const pct = Math.abs(gmvDiff) / (s.gmv || 1) * 100
        if (pct <= rule.config.tolerancePercent) {
          status = 'within_tolerance'
          triggeredRules.push(rule.name)
        }
      }
      if (rule.type === 'tolerance' && rule.config.toleranceAbsolute) {
        if (Math.abs(commissionDiff) <= rule.config.toleranceAbsolute) {
          if (status !== 'alert') status = 'within_tolerance'
          triggeredRules.push(rule.name)
        }
      }
      if (rule.type === 'alert' && rule.config.alertThreshold) {
        if (Math.abs(gmvDiff) > rule.config.alertThreshold || Math.abs(commissionDiff) > rule.config.alertThreshold) {
          status = 'alert'
          triggeredRules.push(rule.name)
        }
      }
    }

    if (gmvDiff === 0 && commissionDiff === 0) {
      status = 'matched'
    }

    results.push({
      settlementId: s.id,
      brandName: s.brandName,
      month: s.month,
      internalGmv: s.gmv,
      externalGmv: erp.gmv,
      gmvDiff,
      internalCommission: s.totalAmount,
      externalCommission: erp.commission,
      commissionDiff,
      deductions: erp.deductions,
      status,
      triggeredRules,
    })
  }
  return results
}

export const ERP_PROVIDERS: Record<ERPProvider, { name: string; icon: string; description: string }> = {
  jushuitan: { name: '聚水潭', icon: '🌊', description: '自动读取聚水潭 ERP 订单和退款数据' },
  wangdiantong: { name: '旺店通', icon: '📦', description: '自动读取旺店通 ERP 发货和售后数据' },
  youzan: { name: '有赞', icon: '🏪', description: '有赞微商城/零售订单和会员数据' },
  pinduoduo: { name: '拼多多', icon: '🍊', description: '拼多多商家后台订单和退款数据' },
  shopify: { name: 'Shopify', icon: '🛍️', description: 'Shopify 店铺订单、退款和库存数据' },
  manual_csv: { name: 'CSV 导入', icon: '📄', description: '手动上传订单 CSV 文件进行对账' },
  api: { name: 'API 对接', icon: '🔗', description: '通过 REST API 获取订单数据' },
  webhook: { name: 'Webhook 推送', icon: '📡', description: '接收外部系统主动推送的订单事件' },
  watch_dir: { name: '目录监听', icon: '👁️', description: '监听本地文件夹，ERP 导出的 CSV/Excel 自动导入' },
}

// ─── ERP 实时监听（通过 Electron localReader:watchDir IPC） ───

let watchCleanup: (() => void) | null = null

export interface WatchDirConfig {
  dirPath: string
  fileTypes: string[]
  pollInterval: number
}

/**
 * 启动目录监听 — 基于 Electron 主进程 localReader:watchDir
 * 当监听目录中出现新 CSV/Excel 文件时，自动解析并回调
 */
export async function startERPWatch(
  config: WatchDirConfig,
  onNewData: (orders: ERPOrderRow[], filename: string) => void,
): Promise<boolean> {
  const api = (window as any).electronAPI

  if (!api?.localReader?.watchDir) {
    console.warn('[ERP Watch] localReader.watchDir 不可用，降级为手动导入')
    return false
  }

  try {
    await api.localReader.watchDir({
      dirPath: config.dirPath,
      fileTypes: config.fileTypes.length ? config.fileTypes : ['csv', 'xlsx'],
      recursive: false,
    })

    api.localReader.onNewFiles((data: { files: { path: string; name: string; content?: string }[] }) => {
      for (const file of data.files) {
        if (file.content && file.name.endsWith('.csv')) {
          const orders = parseCSVToOrders(file.content)
          if (orders.length > 0) onNewData(orders, file.name)
        }
      }
    })

    watchCleanup = () => {
      api.localReader.unwatchDir(config.dirPath)
    }

    return true
  } catch {
    return false
  }
}

/** 通过 Electron 选择目录对话框 */
export async function selectWatchDirectory(): Promise<string | null> {
  const api = (window as any).electronAPI
  if (!api?.scheduler?.selectWatchDir) return null
  try {
    return await api.scheduler.selectWatchDir()
  } catch {
    return null
  }
}

export function stopERPWatch() {
  if (watchCleanup) {
    watchCleanup()
    watchCleanup = null
  }
}

// ─── Webhook 服务端（Electron 主进程提供 HTTP 端点接收推送） ───

export async function getWebhookUrl(): Promise<string | null> {
  const api = (window as any).electronAPI
  if (!api?.localApp?.exec) return null
  // Webhook 由主进程内嵌 HTTP server 提供，此处返回配置的 URL
  return 'http://localhost:19090/webhook/erp-orders'
}

// ─── 通过 Electron scheduler IPC 创建定期同步任务 ───

export async function createScheduledSync(
  provider: ERPProvider,
  cronExpr: string,
  solutionId: string,
): Promise<boolean> {
  const api = (window as any).electronAPI
  if (!api?.scheduler?.create) return false
  try {
    await api.scheduler.create({
      name: `ERP 同步 (${ERP_PROVIDERS[provider]?.name || provider})`,
      cron: cronExpr,
      solutionId,
      type: 'pipeline',
      payload: { action: 'erp_sync', provider },
    })
    return true
  } catch {
    return false
  }
}
