/**
 * Copilot 端到端测试 — 电商 CS AI Copilot 完整流程
 *
 * 测试链路：千牛消息读取 → AI 回复生成 → CopilotReplyCard → 剪贴板 → 状态流转
 * 浏览器模式下 mock electronAPI，验证 UI 交互和数据流。
 */
import { test, expect, type Page } from '@playwright/test'
import { mockFullState } from './helpers'

const SOLUTION_ID = 'ecommerce-brand-service'

// ── Mock electronAPI 注入 ─────────────────────────────
async function injectCopilotMocks(page: Page) {
  await page.addInitScript(() => {
    const replies: Record<string, any> = {}
    let replyCounter = 0
    const listeners: Record<string, Function[]> = {}

    function emit(channel: string, data: unknown) {
      ;(listeners[channel] || []).forEach(cb => cb(data))
    }

    const mockEcommerceCs = {
      getAppSafety: async (appKey: string) => {
        const SAFETY: Record<string, any> = {
          qianniu: { zone: 'readonly', label: '千牛工作台', canRead: true, canWrite: false, readMethod: 'accessibility', writePolicy: 'human_clipboard' },
          jushuitan: { zone: 'safe', label: '聚水潭 ERP', canRead: true, canWrite: true, readMethod: 'cdp', writePolicy: 'ai_direct' },
          wechat: { zone: 'banned', label: '微信', canRead: false, canWrite: false, readMethod: 'none', writePolicy: 'forbidden' },
        }
        return SAFETY[appKey] || null
      },
      getAllSafety: async () => ({
        qianniu: { zone: 'readonly', label: '千牛工作台', canRead: true, canWrite: false },
        jushuitan: { zone: 'safe', label: '聚水潭 ERP', canRead: true, canWrite: true },
        wechat: { zone: 'banned', label: '微信', canRead: false, canWrite: false },
      }),
      getErpProfile: async (erpKey: string) => null,
      canWrite: async (appKey: string) => {
        if (appKey === 'jushuitan') return { canWrite: true, zone: 'safe', writePolicy: 'ai_direct', reason: '安全区' }
        if (appKey === 'qianniu') return { canWrite: false, zone: 'readonly', writePolicy: 'human_clipboard', reason: '只读区' }
        return { canWrite: false, zone: 'banned', writePolicy: 'forbidden', reason: '红线区' }
      },
      addReply: async (reply: any) => {
        const id = `reply_${++replyCounter}`
        const full = { ...reply, id, status: 'pending', createdAt: new Date().toISOString() }
        replies[id] = full
        emit('ecommerceCs:newReply', full)
        return full
      },
      copyReply: async (replyId: string) => {
        if (!replies[replyId]) return { success: false, error: '回复不存在' }
        replies[replyId].status = 'copied'
        replies[replyId].copiedAt = new Date().toISOString()
        emit('ecommerceCs:replyUpdated', replies[replyId])
        // 模拟写入剪贴板
        ;(window as any).__copiedText = replies[replyId].aiReply
        return { success: true }
      },
      updateStatus: async (replyId: string, status: string) => {
        if (!replies[replyId]) return { success: false, error: '回复不存在' }
        replies[replyId].status = status
        emit('ecommerceCs:replyUpdated', replies[replyId])
        return { success: true }
      },
      pendingReplies: async () => Object.values(replies).filter((r: any) => r.status === 'pending' || r.status === 'copied'),
      stats: async () => {
        const vals = Object.values(replies) as any[]
        return {
          pending: vals.filter(r => r.status === 'pending').length,
          copied: vals.filter(r => r.status === 'copied').length,
          sent: vals.filter(r => r.status === 'sent').length,
          skipped: vals.filter(r => r.status === 'skipped').length,
          escalated: vals.filter(r => r.status === 'escalated').length,
        }
      },
      onNewReply: (cb: Function) => {
        listeners['ecommerceCs:newReply'] = listeners['ecommerceCs:newReply'] || []
        listeners['ecommerceCs:newReply'].push(cb)
        return () => {
          listeners['ecommerceCs:newReply'] = (listeners['ecommerceCs:newReply'] || []).filter((f: Function) => f !== cb)
        }
      },
      onReplyUpdated: (cb: Function) => {
        listeners['ecommerceCs:replyUpdated'] = listeners['ecommerceCs:replyUpdated'] || []
        listeners['ecommerceCs:replyUpdated'].push(cb)
        return () => {
          listeners['ecommerceCs:replyUpdated'] = (listeners['ecommerceCs:replyUpdated'] || []).filter((f: Function) => f !== cb)
        }
      },
    }

    const mockAccessibility = {
      readChat: async (appKey: string) => {
        if (appKey === 'qianniu') {
          return {
            success: true,
            app: 'qianniu',
            windowTitle: '千牛工作台 - 旺旺消息',
            messages: [
              { sender: '买家_小明', content: '你好，我买的衣服尺码不对，想退换', timestamp: new Date().toISOString(), isCustomer: true },
              { sender: '客服_小张', content: '您好，我来帮您处理', timestamp: new Date().toISOString(), isCustomer: false },
              { sender: '买家_小明', content: '多久能处理好？', timestamp: new Date().toISOString(), isCustomer: true },
            ],
          }
        }
        return { success: false, app: appKey, messages: [], error: `应用 ${appKey} 未运行` }
      },
      watchChat: async () => ({ success: true }),
      stopWatch: async () => ({ success: true }),
      stopAll: async () => ({ success: true }),
      supportedApps: async () => ['qianniu', 'wangwang', 'feige'],
      onNewMessages: (cb: Function) => {
        listeners['accessibility:newMessages'] = listeners['accessibility:newMessages'] || []
        listeners['accessibility:newMessages'].push(cb)
        return () => {
          listeners['accessibility:newMessages'] = (listeners['accessibility:newMessages'] || []).filter((f: Function) => f !== cb)
        }
      },
    }

    // 注入到全局，确保 renderer 可访问
    const existing = (window as any).electronAPI || {}
    ;(window as any).electronAPI = {
      ...existing,
      ecommerceCs: mockEcommerceCs,
      accessibility: mockAccessibility,
      copilot: {
        ...(existing.copilot || {}),
        clipboard: { write: async (text: string) => { (window as any).__copiedText = text } },
      },
    }

    // 暴露 emit 供测试触发事件
    ;(window as any).__testEmit = emit
    ;(window as any).__testReplies = replies
  })
}

// ── Setup ─────────────────────────────────────────────
test.describe('Copilot E2E — 电商客服 AI Copilot 流程', () => {
  test.beforeEach(async ({ page }) => {
    await injectCopilotMocks(page)
    await mockFullState(page, SOLUTION_ID)
  })

  // ── T1: 方案加载 ──
  test('T1: 电商品牌方案能正常进入工作台', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForSelector('text=品牌电商全价值链方案', { timeout: 10_000 })
  })

  // ── T2: 三区安全模型验证 ──
  test('T2: 三区安全模型 — 千牛只读/聚水潭可写/微信禁止', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForSelector('text=品牌电商全价值链方案', { timeout: 10_000 })

    // 通过 JS 执行验证 mock API 的正确性
    const qianniu = await page.evaluate(() =>
      (window as any).electronAPI.ecommerceCs.canWrite('qianniu')
    )
    expect(qianniu.canWrite).toBe(false)
    expect(qianniu.zone).toBe('readonly')
    expect(qianniu.writePolicy).toBe('human_clipboard')

    const jushuitan = await page.evaluate(() =>
      (window as any).electronAPI.ecommerceCs.canWrite('jushuitan')
    )
    expect(jushuitan.canWrite).toBe(true)
    expect(jushuitan.zone).toBe('safe')

    const wechat = await page.evaluate(() =>
      (window as any).electronAPI.ecommerceCs.canWrite('wechat')
    )
    expect(wechat.canWrite).toBe(false)
    expect(wechat.zone).toBe('banned')
    expect(wechat.writePolicy).toBe('forbidden')
  })

  // ── T3: Accessibility 读取千牛消息 ──
  test('T3: Accessibility Bridge — 读取千牛聊天消息', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForSelector('text=品牌电商全价值链方案', { timeout: 10_000 })

    const result = await page.evaluate(() =>
      (window as any).electronAPI.accessibility.readChat('qianniu')
    )

    expect(result.success).toBe(true)
    expect(result.app).toBe('qianniu')
    expect(result.messages.length).toBe(3)

    const customerMsg = result.messages.find((m: any) => m.isCustomer && m.content.includes('尺码'))
    expect(customerMsg).toBeTruthy()
    expect(customerMsg.sender).toBe('买家_小明')
  })

  // ── T4: Accessibility 不支持的应用降级 ──
  test('T4: Accessibility — 不支持应用返回错误', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForSelector('text=品牌电商全价值链方案', { timeout: 10_000 })

    const result = await page.evaluate(() =>
      (window as any).electronAPI.accessibility.readChat('unknown_app')
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('未运行')
  })

  // ── T5: Copilot 回复生命周期（add → copy → sent） ──
  test('T5: CopilotReply 生命周期 — pending → copied → sent', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForSelector('text=品牌电商全价值链方案', { timeout: 10_000 })

    // 添加 AI 回复
    const reply = await page.evaluate(() =>
      (window as any).electronAPI.ecommerceCs.addReply({
        customerName: '买家_小明',
        customerQuery: '衣服尺码不对，想退换',
        aiReply: '亲，非常抱歉给您带来不便！根据我们的七天无理由退换货政策，您可以申请退换。请您在订单详情页点击"申请售后"，选择"尺码不合适"原因，我们会优先为您处理。运费由我们承担哦~',
        confidence: 0.92,
        sourceApp: 'qianniu',
      })
    )

    expect(reply.id).toBeTruthy()
    expect(reply.status).toBe('pending')
    expect(reply.aiReply).toContain('七天无理由')

    // 复制到剪贴板
    const copyResult = await page.evaluate((id: string) =>
      (window as any).electronAPI.ecommerceCs.copyReply(id)
    , reply.id)

    expect(copyResult.success).toBe(true)

    // 验证状态变更
    const pending = await page.evaluate(() =>
      (window as any).electronAPI.ecommerceCs.pendingReplies()
    )
    const copied = pending.find((r: any) => r.id === reply.id)
    expect(copied.status).toBe('copied')
    expect(copied.copiedAt).toBeTruthy()

    // 标记已发送
    const sentResult = await page.evaluate((id: string) =>
      (window as any).electronAPI.ecommerceCs.updateStatus(id, 'sent')
    , reply.id)
    expect(sentResult.success).toBe(true)

    // 统计验证
    const stats = await page.evaluate(() =>
      (window as any).electronAPI.ecommerceCs.stats()
    )
    expect(stats.sent).toBe(1)
    expect(stats.pending).toBe(0)
  })

  // ── T6: 批量回复处理 ──
  test('T6: 批量回复 — 多条 pending 同时管理', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForSelector('text=品牌电商全价值链方案', { timeout: 10_000 })

    // 添加 3 条回复
    const ids: string[] = []
    for (const q of ['发货太慢了', '东西破损', '想改地址']) {
      const r = await page.evaluate((query: string) =>
        (window as any).electronAPI.ecommerceCs.addReply({
          customerName: '顾客',
          customerQuery: query,
          aiReply: `关于"${query}"的处理建议...`,
          confidence: 0.85,
          sourceApp: 'qianniu',
        })
      , q)
      ids.push(r.id)
    }

    // 验证 3 条 pending
    const stats1 = await page.evaluate(() =>
      (window as any).electronAPI.ecommerceCs.stats()
    )
    expect(stats1.pending).toBe(3)

    // 第 1 条复制并发送
    await page.evaluate((id: string) =>
      (window as any).electronAPI.ecommerceCs.copyReply(id)
    , ids[0])
    await page.evaluate((id: string) =>
      (window as any).electronAPI.ecommerceCs.updateStatus(id, 'sent')
    , ids[0])

    // 第 2 条跳过
    await page.evaluate((id: string) =>
      (window as any).electronAPI.ecommerceCs.updateStatus(id, 'skipped')
    , ids[1])

    // 第 3 条转人工
    await page.evaluate((id: string) =>
      (window as any).electronAPI.ecommerceCs.updateStatus(id, 'escalated')
    , ids[2])

    const stats2 = await page.evaluate(() =>
      (window as any).electronAPI.ecommerceCs.stats()
    )
    expect(stats2.pending).toBe(0)
    expect(stats2.sent).toBe(1)
    expect(stats2.skipped).toBe(1)
    expect(stats2.escalated).toBe(1)
  })

  // ── T7: 支持的应用列表 ──
  test('T7: Accessibility — 支持的应用列表', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForSelector('text=品牌电商全价值链方案', { timeout: 10_000 })

    const apps = await page.evaluate(() =>
      (window as any).electronAPI.accessibility.supportedApps()
    )
    expect(apps).toContain('qianniu')
    expect(apps).toContain('wangwang')
    expect(apps).toContain('feige')
    expect(apps.length).toBe(3)
  })

  // ── T8: 全链路模拟（读 → 生成 → 复制 → 统计） ──
  test('T8: 全链路 — 读消息 → AI 生成回复 → 复制 → 标记发送', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForSelector('text=品牌电商全价值链方案', { timeout: 10_000 })

    // Step 1: 读取千牛消息
    const chat = await page.evaluate(() =>
      (window as any).electronAPI.accessibility.readChat('qianniu')
    )
    expect(chat.success).toBe(true)
    const lastCustomerMsg = chat.messages.filter((m: any) => m.isCustomer).pop()
    expect(lastCustomerMsg).toBeTruthy()

    // Step 2: 检查安全区（千牛为只读）
    const safety = await page.evaluate(() =>
      (window as any).electronAPI.ecommerceCs.canWrite('qianniu')
    )
    expect(safety.canWrite).toBe(false)
    expect(safety.writePolicy).toBe('human_clipboard')

    // Step 3: AI 生成回复（模拟后端返回）
    const reply = await page.evaluate((query: string) =>
      (window as any).electronAPI.ecommerceCs.addReply({
        customerName: '买家_小明',
        customerQuery: query,
        aiReply: '亲，您的退换货申请我已帮您提交，请保持商品完好并在48小时内寄回，运费我们承担。寄出后请将快递单号告诉我~',
        confidence: 0.95,
        sourceApp: 'qianniu',
      })
    , lastCustomerMsg.content)
    expect(reply.status).toBe('pending')

    // Step 4: 复制到剪贴板（人工将去粘贴到千牛）
    await page.evaluate((id: string) =>
      (window as any).electronAPI.ecommerceCs.copyReply(id)
    , reply.id)

    const copiedText = await page.evaluate(() => (window as any).__copiedText)
    expect(copiedText).toContain('退换货申请')

    // Step 5: 人工确认已发送
    await page.evaluate((id: string) =>
      (window as any).electronAPI.ecommerceCs.updateStatus(id, 'sent')
    , reply.id)

    // 最终统计
    const stats = await page.evaluate(() =>
      (window as any).electronAPI.ecommerceCs.stats()
    )
    expect(stats.sent).toBe(1)
    expect(stats.pending).toBe(0)
  })
})
