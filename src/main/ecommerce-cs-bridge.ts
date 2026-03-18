// EcommerceCSBridge — 电商客服 Copilot 三区安全模型
// v2.1 核心：AI 生成回复 → 剪贴板 → 人粘贴发送（零封号风险）
//
// 三区安全模型:
//   ✅ 安全区 — 第三方 ERP（聚水潭/旺店通/管易云），AI 可读写
//   ⚠️ 只读区 — 平台客服工具（千牛/旺旺/飞鸽），AI 只读
//   🚫 红线区 — 微信/企微，禁止任何自动化

import { ipcMain, clipboard, Notification, BrowserWindow } from 'electron'

// ────────────────────── 安全分级 ──────────────────────

export type SafetyZone = 'safe' | 'readonly' | 'banned'

interface AppSafetyProfile {
  zone: SafetyZone
  label: string
  canRead: boolean
  canWrite: boolean
  readMethod: 'accessibility' | 'cdp' | 'none'
  writePolicy: 'ai_direct' | 'human_clipboard' | 'forbidden'
}

const APP_SAFETY: Record<string, AppSafetyProfile> = {
  // ✅ 安全区 — 第三方 ERP，AI 可读写
  jushuitan: {
    zone: 'safe', label: '聚水潭 ERP',
    canRead: true, canWrite: true,
    readMethod: 'cdp', writePolicy: 'ai_direct',
  },
  wangdiantong: {
    zone: 'safe', label: '旺店通 ERP',
    canRead: true, canWrite: true,
    readMethod: 'cdp', writePolicy: 'ai_direct',
  },
  guanyiyun: {
    zone: 'safe', label: '管易云 ERP',
    canRead: true, canWrite: true,
    readMethod: 'cdp', writePolicy: 'ai_direct',
  },

  // ⚠️ 只读区 — 平台客服工具，AI 只读，写操作由人完成
  qianniu: {
    zone: 'readonly', label: '千牛工作台',
    canRead: true, canWrite: false,
    readMethod: 'accessibility', writePolicy: 'human_clipboard',
  },
  wangwang: {
    zone: 'readonly', label: '阿里旺旺',
    canRead: true, canWrite: false,
    readMethod: 'accessibility', writePolicy: 'human_clipboard',
  },
  feige: {
    zone: 'readonly', label: '抖店飞鸽',
    canRead: true, canWrite: false,
    readMethod: 'cdp', writePolicy: 'human_clipboard',
  },
  pinduoduo_seller: {
    zone: 'readonly', label: '拼多多商家后台',
    canRead: true, canWrite: false,
    readMethod: 'cdp', writePolicy: 'human_clipboard',
  },
  xiaohongshu_seller: {
    zone: 'readonly', label: '小红书商家后台',
    canRead: true, canWrite: false,
    readMethod: 'cdp', writePolicy: 'human_clipboard',
  },

  // 🚫 红线区 — 微信/企微，禁止任何自动化
  wechat: {
    zone: 'banned', label: '微信',
    canRead: false, canWrite: false,
    readMethod: 'none', writePolicy: 'forbidden',
  },
  wecom: {
    zone: 'banned', label: '企业微信',
    canRead: false, canWrite: false,
    readMethod: 'none', writePolicy: 'forbidden',
  },
}

// ────────────────────── ERP 预设 DOM 选择器 ──────────────────────

interface ErpDomProfile {
  orderListSelector: string
  orderDetailSelector: string
  customerNameSelector: string
  orderStatusSelector: string
  remarkInputSelector?: string
}

const ERP_DOM_PROFILES: Record<string, ErpDomProfile> = {
  jushuitan: {
    orderListSelector: '.order-list-table tbody tr, .order-table-body .order-row',
    orderDetailSelector: '.order-detail-panel, .order-info-container',
    customerNameSelector: '.buyer-name, .customer-nick, [data-field="buyer_nick"]',
    orderStatusSelector: '.order-status-tag, [data-field="order_status"]',
    remarkInputSelector: '.order-remark-input, textarea[name="remark"]',
  },
  wangdiantong: {
    orderListSelector: '.wdt-order-list tr, .order-grid .grid-row',
    orderDetailSelector: '.order-detail, .wdt-order-info',
    customerNameSelector: '.buyer-nick, .customer-name',
    orderStatusSelector: '.status-label, .order-state',
    remarkInputSelector: '.remark-editor, textarea.remark',
  },
  guanyiyun: {
    orderListSelector: '.gy-order-table tbody tr, .order-list-row',
    orderDetailSelector: '.order-detail-card, .order-info-panel',
    customerNameSelector: '.buyer-info .name, .customer-nick-name',
    orderStatusSelector: '.order-status, .status-badge',
    remarkInputSelector: '.remark-textarea, .order-remark-input',
  },
}

// ────────────────────── Copilot 回复管理 ──────────────────────

export interface CopilotReply {
  id: string
  customerName: string
  customerQuery: string
  aiReply: string
  confidence: number
  sourceApp: string
  status: 'pending' | 'copied' | 'sent' | 'skipped' | 'escalated'
  createdAt: string
  copiedAt?: string
}

const pendingReplies: Map<string, CopilotReply> = new Map()
let mainWindowRef: BrowserWindow | null = null

export function setEcommerceCSMainWindow(win: BrowserWindow | null): void {
  mainWindowRef = win
}

function generateId(): string {
  return `cr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ────────────────────── 核心函数 ──────────────────────

function getAppSafety(appKey: string): AppSafetyProfile | null {
  return APP_SAFETY[appKey] ?? null
}

function addCopilotReply(reply: Omit<CopilotReply, 'id' | 'status' | 'createdAt'>): CopilotReply {
  const full: CopilotReply = {
    ...reply,
    id: generateId(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  pendingReplies.set(full.id, full)

  mainWindowRef?.webContents.send('ecommerceCs:newReply', full)

  return full
}

function copyReplyToClipboard(replyId: string): { success: boolean; error?: string } {
  const reply = pendingReplies.get(replyId)
  if (!reply) return { success: false, error: '回复不存在' }

  clipboard.writeText(reply.aiReply)
  reply.status = 'copied'
  reply.copiedAt = new Date().toISOString()

  if (Notification.isSupported()) {
    new Notification({
      title: `AI 回复已复制 — ${reply.customerName}`,
      body: '切换到客服工具窗口，Ctrl+V 粘贴发送',
      silent: false,
    }).show()
  }

  mainWindowRef?.webContents.send('ecommerceCs:replyUpdated', reply)
  return { success: true }
}

function updateReplyStatus(
  replyId: string,
  status: CopilotReply['status'],
): { success: boolean; error?: string } {
  const reply = pendingReplies.get(replyId)
  if (!reply) return { success: false, error: '回复不存在' }

  reply.status = status
  mainWindowRef?.webContents.send('ecommerceCs:replyUpdated', reply)

  if (status === 'sent' || status === 'skipped' || status === 'escalated') {
    setTimeout(() => pendingReplies.delete(replyId), 60000)
  }

  return { success: true }
}

function getPendingReplies(): CopilotReply[] {
  return Array.from(pendingReplies.values())
    .filter(r => r.status === 'pending' || r.status === 'copied')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

function getReplyStats(): {
  pending: number
  copied: number
  sent: number
  skipped: number
  escalated: number
} {
  const all = Array.from(pendingReplies.values())
  return {
    pending: all.filter(r => r.status === 'pending').length,
    copied: all.filter(r => r.status === 'copied').length,
    sent: all.filter(r => r.status === 'sent').length,
    skipped: all.filter(r => r.status === 'skipped').length,
    escalated: all.filter(r => r.status === 'escalated').length,
  }
}

// ────────────────────── IPC ──────────────────────

export function setupEcommerceCsBridgeIPC(): void {
  ipcMain.handle('ecommerceCs:getAppSafety', (_, appKey: string) => {
    return getAppSafety(appKey)
  })

  ipcMain.handle('ecommerceCs:getAllSafety', () => {
    return APP_SAFETY
  })

  ipcMain.handle('ecommerceCs:getErpProfile', (_, erpKey: string) => {
    return ERP_DOM_PROFILES[erpKey] ?? null
  })

  ipcMain.handle('ecommerceCs:addReply', (_, reply: Omit<CopilotReply, 'id' | 'status' | 'createdAt'>) => {
    return addCopilotReply(reply)
  })

  ipcMain.handle('ecommerceCs:copyReply', (_, replyId: string) => {
    return copyReplyToClipboard(replyId)
  })

  ipcMain.handle('ecommerceCs:updateStatus', (_, replyId: string, status: CopilotReply['status']) => {
    return updateReplyStatus(replyId, status)
  })

  ipcMain.handle('ecommerceCs:pendingReplies', () => {
    return getPendingReplies()
  })

  ipcMain.handle('ecommerceCs:stats', () => {
    return getReplyStats()
  })

  ipcMain.handle('ecommerceCs:canWrite', (_, appKey: string) => {
    const profile = getAppSafety(appKey)
    if (!profile) return { canWrite: false, reason: '未知应用' }
    return {
      canWrite: profile.canWrite,
      zone: profile.zone,
      writePolicy: profile.writePolicy,
      reason: profile.canWrite
        ? '安全区应用，AI 可直接操作'
        : profile.zone === 'readonly'
          ? '只读区应用，请手动粘贴发送（防封号）'
          : '红线区应用，禁止任何自动化操作',
    }
  })
}
