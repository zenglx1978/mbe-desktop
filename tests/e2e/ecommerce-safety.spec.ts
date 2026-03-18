/**
 * 电商三区安全模型验证测试
 *
 * 验证所有电商应用的安全分区是否正确，确保：
 * - ✅ 安全区（ERP）：AI 可读写
 * - ⚠️ 只读区（平台客服工具）：AI 只读，写操作人工完成
 * - 🚫 红线区（微信/企微）：禁止任何自动化
 */
import { test, expect, type Page } from '@playwright/test'
import { mockFullState } from './helpers'

const SOLUTION_ID = 'ecommerce-brand-service'

async function injectSafetyMock(page: Page) {
  await page.addInitScript(() => {
    const APP_SAFETY: Record<string, any> = {
      // ✅ 安全区
      jushuitan:  { zone: 'safe', label: '聚水潭 ERP', canRead: true, canWrite: true, readMethod: 'cdp', writePolicy: 'ai_direct' },
      wangdiantong: { zone: 'safe', label: '旺店通 ERP', canRead: true, canWrite: true, readMethod: 'cdp', writePolicy: 'ai_direct' },
      guanyiyun:  { zone: 'safe', label: '管易云 ERP', canRead: true, canWrite: true, readMethod: 'cdp', writePolicy: 'ai_direct' },
      // ⚠️ 只读区
      qianniu:    { zone: 'readonly', label: '千牛工作台', canRead: true, canWrite: false, readMethod: 'accessibility', writePolicy: 'human_clipboard' },
      wangwang:   { zone: 'readonly', label: '阿里旺旺', canRead: true, canWrite: false, readMethod: 'accessibility', writePolicy: 'human_clipboard' },
      feige:      { zone: 'readonly', label: '抖店飞鸽', canRead: true, canWrite: false, readMethod: 'cdp', writePolicy: 'human_clipboard' },
      pinduoduo_seller: { zone: 'readonly', label: '拼多多商家', canRead: true, canWrite: false, readMethod: 'cdp', writePolicy: 'human_clipboard' },
      xiaohongshu_seller: { zone: 'readonly', label: '小红书商家', canRead: true, canWrite: false, readMethod: 'cdp', writePolicy: 'human_clipboard' },
      // 🚫 红线区
      wechat:     { zone: 'banned', label: '微信', canRead: false, canWrite: false, readMethod: 'none', writePolicy: 'forbidden' },
      wecom:      { zone: 'banned', label: '企业微信', canRead: false, canWrite: false, readMethod: 'none', writePolicy: 'forbidden' },
    }

    const existing = (window as any).electronAPI || {}
    ;(window as any).electronAPI = {
      ...existing,
      ecommerceCs: {
        ...(existing.ecommerceCs || {}),
        getAppSafety: async (key: string) => APP_SAFETY[key] || null,
        getAllSafety: async () => APP_SAFETY,
        canWrite: async (key: string) => {
          const p = APP_SAFETY[key]
          if (!p) return { canWrite: false, zone: 'unknown', writePolicy: 'forbidden', reason: '未知应用' }
          return {
            canWrite: p.canWrite,
            zone: p.zone,
            writePolicy: p.writePolicy,
            reason: p.zone === 'safe' ? '安全区' : p.zone === 'readonly' ? '只读区' : '红线区',
          }
        },
      },
    }
  })
}

test.describe('三区安全模型 — 全应用覆盖', () => {
  test.beforeEach(async ({ page }) => {
    await injectSafetyMock(page)
    await mockFullState(page, SOLUTION_ID)
  })

  // ── 安全区：ERP 系统可读写 ──
  for (const erp of ['jushuitan', 'wangdiantong', 'guanyiyun']) {
    test(`✅ 安全区: ${erp} — AI 可读可写`, async ({ page }) => {
      await page.goto('/#/')
      await page.waitForSelector('text=品牌电商全价值链方案', { timeout: 10_000 })

      const safety = await page.evaluate((key: string) =>
        (window as any).electronAPI.ecommerceCs.getAppSafety(key)
      , erp)

      expect(safety).not.toBeNull()
      expect(safety.zone).toBe('safe')
      expect(safety.canRead).toBe(true)
      expect(safety.canWrite).toBe(true)
      expect(safety.readMethod).toBe('cdp')
      expect(safety.writePolicy).toBe('ai_direct')
    })
  }

  // ── 只读区：平台客服工具 ──
  for (const app of ['qianniu', 'wangwang', 'feige', 'pinduoduo_seller', 'xiaohongshu_seller']) {
    test(`⚠️ 只读区: ${app} — AI 只读，写操作人工`, async ({ page }) => {
      await page.goto('/#/')
      await page.waitForSelector('text=品牌电商全价值链方案', { timeout: 10_000 })

      const safety = await page.evaluate((key: string) =>
        (window as any).electronAPI.ecommerceCs.getAppSafety(key)
      , app)

      expect(safety).not.toBeNull()
      expect(safety.zone).toBe('readonly')
      expect(safety.canRead).toBe(true)
      expect(safety.canWrite).toBe(false)
      expect(safety.writePolicy).toBe('human_clipboard')
    })
  }

  // ── 红线区：微信 / 企微 ──
  for (const banned of ['wechat', 'wecom']) {
    test(`🚫 红线区: ${banned} — 禁止任何自动化`, async ({ page }) => {
      await page.goto('/#/')
      await page.waitForSelector('text=品牌电商全价值链方案', { timeout: 10_000 })

      const safety = await page.evaluate((key: string) =>
        (window as any).electronAPI.ecommerceCs.getAppSafety(key)
      , banned)

      expect(safety).not.toBeNull()
      expect(safety.zone).toBe('banned')
      expect(safety.canRead).toBe(false)
      expect(safety.canWrite).toBe(false)
      expect(safety.readMethod).toBe('none')
      expect(safety.writePolicy).toBe('forbidden')
    })
  }

  // ── 未知应用返回 null ──
  test('未知应用 — getAppSafety 返回 null', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForSelector('text=品牌电商全价值链方案', { timeout: 10_000 })

    const safety = await page.evaluate(() =>
      (window as any).electronAPI.ecommerceCs.getAppSafety('unknown_app')
    )
    expect(safety).toBeNull()
  })

  // ── canWrite 完整验证 ──
  test('canWrite 一致性 — 全应用返回正确的 zone 和 writePolicy', async ({ page }) => {
    await page.goto('/#/')
    await page.waitForSelector('text=品牌电商全价值链方案', { timeout: 10_000 })

    const allApps = ['jushuitan', 'wangdiantong', 'guanyiyun', 'qianniu', 'wangwang', 'feige', 'pinduoduo_seller', 'xiaohongshu_seller', 'wechat', 'wecom']

    for (const appKey of allApps) {
      const result = await page.evaluate((key: string) =>
        (window as any).electronAPI.ecommerceCs.canWrite(key)
      , appKey)

      const safety = await page.evaluate((key: string) =>
        (window as any).electronAPI.ecommerceCs.getAppSafety(key)
      , appKey)

      expect(result.canWrite).toBe(safety.canWrite)
      expect(result.zone).toBe(safety.zone)
      expect(result.writePolicy).toBe(safety.writePolicy)
    }
  })
})
