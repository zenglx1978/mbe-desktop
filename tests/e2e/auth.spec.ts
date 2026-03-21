import { test, expect } from '@playwright/test'

test.describe('Auth Page', () => {
  test('显示登录界面', async ({ page }) => {
    await page.goto('/#/auth')
    await expect(page.locator('body')).toBeVisible()
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })

  test('已登录用户跳转到 /pick', async ({ page }) => {
    await page.goto('/#/auth')
    // 模拟本地存储已有 token
    await page.evaluate(() => {
      localStorage.setItem(
        'mbe-auth-store',
        JSON.stringify({
          state: { token: 'test-token', user: { id: 1, username: 'test' } },
          version: 0,
        }),
      )
    })
    await page.reload()
    await page.waitForTimeout(500)
    await expect(page).toHaveURL(/pick/)
  })
})
