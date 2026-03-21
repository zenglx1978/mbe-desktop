import { test, expect } from '@playwright/test'

test.describe('Smoke Tests', () => {
  test('应用首页加载正常', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/MBE/)
  })

  test('未登录跳转到 /auth', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL(/auth/)
    await expect(page.locator('body')).toBeVisible()
  })
})
