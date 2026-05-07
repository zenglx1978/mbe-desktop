/**
 * E2E — 计费错误拦截与升级引导
 *
 * 验证 chat-service.ts 对 HTTP 402 / 429 的处理：
 *  1. API 返回 402（额度不足）→ 聊天区显示「额度已用尽」+ 升级引导
 *  2. API 返回 429（频率限制）→ 聊天区显示「请求过于频繁」+ 套餐升级提示
 *
 * 测试策略：
 *  - 注入完整的已登录 + 已选方案状态（跳过 UI 登录流程）
 *  - 用 page.route() 拦截所有 chat 相关 POST，返回目标状态码
 *  - 在聊天输入框发送一条消息，断言回复区出现指定文字
 */

import { test, expect } from '@playwright/test'
import {
  injectSession,
  silenceAllApiCalls,
  waitForHash,
  EXTERNAL_USER,
} from './helpers/auth'

// 已知方案 ID，确保 hasPickedSolution = true → 进入 Workspace
const DEMO_SOLUTION = 'finance'

// 拦截所有 Agent 的 chat 端点（streamViaHTTP 的三条候选 URL）
async function mockAgentChatWith(
  page: import('@playwright/test').Page,
  status: number,
  detail = '',
) {
  for (const path of ['/consult', '/secretary/chat', '/chat']) {
    await page.route(`**${path}`, async (route) => {
      const method = route.request().method()
      if (method !== 'POST') {
        await route.continue()
        return
      }
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ detail }),
      })
    })
  }
}

// 等待聊天回复区出现指定文字（最长 15 秒，因为需要流式拼接完成）
async function waitForChatMessage(
  page: import('@playwright/test').Page,
  textPattern: RegExp,
  timeout = 15_000,
) {
  await page.waitForFunction(
    (pattern) => {
      // 聊天消息通常渲染在 role="article" 或 .prose 容器里
      const el = document.querySelector('[data-role="assistant"], .prose, [class*="message"]')
      return !!el && new RegExp(pattern).test(el.textContent ?? '')
    },
    textPattern.source,
    { timeout },
  )
}

test.describe('计费错误拦截 — chat-service HTTP 错误处理', () => {
  test.beforeEach(async ({ page }) => {
    // 静默其他 API（connectivity 探针、token quota 等）
    await silenceAllApiCalls(page)

    // 注入：已登录 + 已完成引导 + 已选方案（直接进入 Workspace）
    await injectSession(page, {
      user: EXTERNAL_USER,
      onboardingDone: true,
      solutionId: DEMO_SOLUTION,
    })
  })

  // ── 1. HTTP 402 额度不足 ──────────────────────────────────────────────────

  test('API 返回 402 → 聊天区显示额度用尽提示 + 升级引导', async ({ page }) => {
    await mockAgentChatWith(page, 402, '您本月的 Token 配额已全部用尽')

    await page.goto('/')
    // 已登录 + 已选方案 → Workspace（`/#/`）
    await waitForHash(page, '', 10_000)

    // 等待聊天输入框出现
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 10_000 })

    // 输入并发送消息
    await textarea.fill('帮我生成一份财务报告')
    // 发送按钮（紧邻 textarea 的 button，或 ArrowUp / Send icon button）
    const sendBtn = page.locator('button').filter({ hasText: '' }).last()
    await sendBtn.click()

    // 等待助手回复区出现「额度」相关文字
    await page.waitForFunction(
      () => {
        const body = document.body.textContent ?? ''
        return body.includes('额度') || body.includes('用尽') || body.includes('升级')
      },
      undefined,
      { timeout: 15_000 },
    )

    // 断言升级引导关键词出现在页面上
    await expect(page.getByText(/额度|用尽|升级/)).toBeVisible({ timeout: 5_000 })
    // 订阅管理导航提示
    await expect(page.getByText(/账户|订阅管理/)).toBeVisible({ timeout: 5_000 })
  })

  // ── 2. HTTP 429 频率限制 ───────────────────────────────────────────────────

  test('API 返回 429 → 聊天区显示频率限制提示 + 等待/升级建议', async ({ page }) => {
    await mockAgentChatWith(page, 429, '请求过于频繁，请稍后重试')

    await page.goto('/')
    await waitForHash(page, '', 10_000)

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 10_000 })

    await textarea.fill('查一下这笔收入该交多少税')
    const sendBtn = page.locator('button').last()
    await sendBtn.click()

    // 等待频率限制关键词
    await page.waitForFunction(
      () => {
        const body = document.body.textContent ?? ''
        return body.includes('频繁') || body.includes('限流') || body.includes('套餐')
      },
      undefined,
      { timeout: 15_000 },
    )

    await expect(page.getByText(/频繁|限流|套餐/)).toBeVisible({ timeout: 5_000 })
  })

  // ── 3. 正常 200 响应不触发计费错误 ──────────────────────────────────────

  test('API 返回 200 → 聊天区显示正常回复，无升级提示', async ({ page }) => {
    // 覆盖 silenceAllApiCalls 的 200 空响应，返回一个模拟答复
    await page.route('**/consult', async (route) => {
      if (route.request().method() !== 'POST') { await route.continue(); return }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ answer: '根据税法规定，此笔收入需缴纳增值税 6%。' }),
      })
    })

    await page.goto('/')
    await waitForHash(page, '', 10_000)

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 10_000 })
    await textarea.fill('增值税率是多少？')
    await page.locator('button').last().click()

    // 等待正常回复
    await page.waitForFunction(
      () => (document.body.textContent ?? '').includes('增值税'),
      undefined,
      { timeout: 15_000 },
    )

    // 不应出现升级提示
    await expect(page.getByText(/额度已用尽|请求过于频繁/i)).not.toBeVisible()
  })
})

// ── TokenQuotaWidget 视觉检查 ────────────────────────────────────────────────

test.describe('TokenQuotaWidget — 额度进度条展示', () => {
  test('侧边栏显示额度组件（已登录状态）', async ({ page }) => {
    await silenceAllApiCalls(page)
    await injectSession(page, {
      user: EXTERNAL_USER,
      onboardingDone: true,
      solutionId: DEMO_SOLUTION,
    })

    // mock quota API
    await page.route('**/api/v1/billing/quota**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan: 'basic',
          token_limit: 100_000,
          token_used: 75_000,
          reset_date: new Date(Date.now() + 15 * 86400_000).toISOString(),
          is_unlimited: false,
        }),
      })
    })

    await page.goto('/')
    await waitForHash(page, '', 10_000)

    // 额度组件出现在 DOM（可能是折叠的 dot 或展开的 widget）
    await page.waitForFunction(
      () => {
        const body = document.body.textContent ?? ''
        // 展开状态会显示 Token 或剩余或套餐名
        return body.includes('Token') || body.includes('剩余') || body.includes('basic')
          || !!document.querySelector('[data-testid="token-quota-widget"]')
      },
      undefined,
      { timeout: 10_000 },
    )
  })
})
