/**
 * E2E — 新用户引导流程
 *
 * 覆盖三条路径：
 *  1. 新用户注册 → 跳转 /welcome → 看到计费说明
 *  2. 新用户完成两步引导 → 跳转 /pick
 *  3. 老用户（已完成引导）登录 → 直接跳 /pick，不再看到引导页
 */

import { test, expect } from '@playwright/test'
import {
  injectSession,
  mockLoginSuccess,
  mockRegisterSuccess,
  silenceAllApiCalls,
  waitForHash,
  EXTERNAL_USER,
} from './helpers/auth'

test.describe('新用户引导流程', () => {
  // 每个 test 都从干净状态开始
  test.beforeEach(async ({ page }) => {
    // 屏蔽无关 API 调用（connectivity check、token quota 等）
    await silenceAllApiCalls(page)
  })

  // ── 1. 新用户注册后跳转到引导页 ──────────────────────────────────────────

  test('新用户注册成功后重定向到 /welcome', async ({ page }) => {
    await mockRegisterSuccess(page, EXTERNAL_USER)

    await page.goto('/')

    // 未登录 → 自动跳转到 /auth
    await waitForHash(page, 'auth')

    // 切换到注册 Tab（找"注册"按钮或链接）
    const registerTab = page.getByRole('button', { name: /注册|Sign up/i }).first()
    if (await registerTab.isVisible()) {
      await registerTab.click()
    }

    // 填写注册表单
    await page.getByLabel(/邮箱|Email/i).fill(EXTERNAL_USER.email)
    await page.getByLabel(/密码|Password/i).first().fill('Test@123456')
    const submitBtn = page.getByRole('button', { name: /注册|Register/i })
    await submitBtn.click()

    // 注册后应跳转到引导页
    await waitForHash(page, 'welcome', 8_000)
    await expect(page).toHaveURL(/#\/welcome/)
  })

  // ── 2. 引导页第一步展示三种计费模式 ─────────────────────────────────────

  test('引导页展示三种计费方式卡片', async ({ page }) => {
    // 注入未完成引导的登录状态，直接访问 /welcome
    await injectSession(page, { user: EXTERNAL_USER, onboardingDone: false })
    await page.goto('/#/welcome')

    // 三种计费方式应该可见
    await expect(page.getByText(/订阅/)).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText(/计件|按量/)).toBeVisible()
    await expect(page.getByText(/分成|分润/)).toBeVisible()
  })

  // ── 3. 点击「下一步」进入第二步，再点「开始」跳转到 /pick ──────────────

  test('完成两步引导后跳转到方案选择页', async ({ page }) => {
    await injectSession(page, { user: EXTERNAL_USER, onboardingDone: false })
    await silenceAllApiCalls(page)
    await page.goto('/#/welcome')

    // 等待计费卡片出现
    await page.waitForSelector('text=/订阅|计件|分成/', { timeout: 8_000 })

    // 点击进入第二步的按钮（显示工作流步骤）
    const nextBtn = page.getByRole('button', { name: /下一步|如何使用|开始使用/i })
    await nextBtn.click()

    // 第二步内容
    await expect(page.getByText(/三步|选择方案|开始/)).toBeVisible({ timeout: 5_000 })

    // 点击完成引导的按钮
    const startBtn = page.getByRole('button', { name: /选择|方案|开始工作/i }).last()
    await startBtn.click()

    // 应跳转到方案选择页
    await waitForHash(page, 'pick', 8_000)
    await expect(page).toHaveURL(/#\/pick/)
  })

  // ── 4. 老用户直接跳过引导页 ───────────────────────────────────────────────

  test('已完成引导的老用户登录后跳到 /pick 而非 /welcome', async ({ page }) => {
    await mockLoginSuccess(page, EXTERNAL_USER)

    // 注入：已完成引导的会话状态（登录后 AuthPage 会根据此判断跳哪里）
    await injectSession(page, { user: EXTERNAL_USER, onboardingDone: true })
    await page.goto('/')

    // 已登录 → 跳到 /pick（而非 /welcome）
    await waitForHash(page, 'pick', 8_000)
    await expect(page).toHaveURL(/#\/pick/)

    // 确认没有显示引导页内容
    await expect(page.getByText(/三种计费方式|billing models/i)).not.toBeVisible()
  })

  // ── 5. 可以跳过引导页 ─────────────────────────────────────────────────────

  test('点击「跳过」按钮可直接进入方案选择页', async ({ page }) => {
    await injectSession(page, { user: EXTERNAL_USER, onboardingDone: false })
    await silenceAllApiCalls(page)
    await page.goto('/#/welcome')

    await page.waitForSelector('text=/订阅|计件|分成/', { timeout: 8_000 })

    // 找并点击跳过按钮
    const skipBtn = page.getByRole('button', { name: /跳过|Skip/i })
    await skipBtn.click()

    await waitForHash(page, 'pick', 8_000)
    await expect(page).toHaveURL(/#\/pick/)
  })
})
