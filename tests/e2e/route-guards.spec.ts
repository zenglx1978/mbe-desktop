/**
 * E2E — 路由门禁（RequireAuth + RequireInternal）
 *
 * 验证三类用户访问受限路由时的行为：
 *  1. 未登录用户 → 被重定向到 /auth
 *  2. 外部付费用户（role: user）→ 访问内部工具被重定向到 /
 *  3. 内部员工（role: admin / mbe_staff）→ 正常访问内部工具
 *
 * 受限路由（RequireInternal）：/kb-graph、/analytics/heatmaps、/deepmind
 */

import { test, expect } from '@playwright/test'
import {
  injectSession,
  silenceAllApiCalls,
  waitForHash,
  EXTERNAL_USER,
  ADMIN_USER,
  STAFF_USER,
} from './helpers/auth'

// 所有 RequireInternal 保护的路由
const INTERNAL_ROUTES = ['kb-graph', 'analytics/heatmaps', 'deepmind'] as const

test.describe('RequireAuth — 未登录访问保护', () => {
  test('未登录访问 / → 重定向到 /auth', async ({ page }) => {
    // 不注入任何 session，清空 localStorage
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')

    await waitForHash(page, 'auth', 8_000)
    await expect(page).toHaveURL(/#\/auth/)
  })

  test('未登录直接访问 /pick → 重定向到 /auth', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/#/pick')

    await waitForHash(page, 'auth', 8_000)
    await expect(page).toHaveURL(/#\/auth/)
  })

  for (const route of INTERNAL_ROUTES) {
    test(`未登录访问 /${route} → 重定向到 /auth`, async ({ page }) => {
      await page.addInitScript(() => localStorage.clear())
      await page.goto(`/#/${route}`)

      await waitForHash(page, 'auth', 8_000)
      await expect(page).toHaveURL(/#\/auth/)
    })
  }
})

test.describe('RequireInternal — 外部用户访问内部工具', () => {
  test.beforeEach(async ({ page }) => {
    await silenceAllApiCalls(page)
    await injectSession(page, {
      user: EXTERNAL_USER,
      onboardingDone: true,
    })
  })

  for (const route of INTERNAL_ROUTES) {
    test(`外部用户访问 /${route} → 重定向到 /（不暴露工具存在感）`, async ({ page }) => {
      await page.goto(`/#/${route}`)

      // RequireInternal: 非内部用户 → Navigate to="/"
      // / 会进一步判断：没有选方案 → /pick；有选方案 → Workspace
      // 关键点：不应停留在受限路由上
      await page.waitForFunction(
        () => !window.location.hash.includes('/kb-graph')
          && !window.location.hash.includes('/heatmaps')
          && !window.location.hash.includes('/deepmind'),
        undefined,
        { timeout: 8_000 },
      )

      // 不应在受限路由上
      expect(page.url()).not.toContain(route)
      // 不应在 auth 页（已登录）
      expect(page.url()).not.toContain('/auth')
    })
  }

  test('外部用户的 Settings 页不显示「开发者工具」section', async ({ page }) => {
    await page.goto('/#/settings')

    // 等待 Settings 加载
    await page.waitForSelector('[data-testid="settings-page"], h1, h2', { timeout: 8_000 })

    // 开发者工具 section 不应出现
    await expect(page.getByText(/开发者工具|Developer Tools/i)).not.toBeVisible()
  })
})

test.describe('RequireInternal — 内部员工可访问内部工具', () => {
  for (const [role, user] of [
    ['admin', ADMIN_USER],
    ['mbe_staff', STAFF_USER],
  ] as const) {
    test.describe(`role: ${role}`, () => {
      test.beforeEach(async ({ page }) => {
        await silenceAllApiCalls(page)
        await injectSession(page, {
          user,
          onboardingDone: true,
        })
      })

      test(`${role} 访问 /kb-graph → 正常加载（不被重定向）`, async ({ page }) => {
        await page.goto('/#/kb-graph')

        // 等待路由稳定后检查 URL
        await page.waitForTimeout(2_000)

        // 应停留在 /kb-graph（不应被重定向到 /pick 或 /auth）
        expect(page.url()).toContain('kb-graph')
      })

      test(`${role} 的 Settings 页显示「开发者工具」section`, async ({ page }) => {
        await page.goto('/#/settings')
        await page.waitForSelector('[data-testid="settings-page"], h1, h2, section', {
          timeout: 8_000,
        })
        await expect(page.getByText(/开发者工具/i)).toBeVisible({ timeout: 5_000 })
      })
    })
  }
})
