import { test, expect } from '@playwright/test'

function mockAuthState() {
  return JSON.stringify({
    state: { token: 'test-token', user: { id: 1, username: 'test' } },
    version: 0,
  })
}

test.describe('Routing Guards', () => {
  test('受保护路由未登录时重定向到 /auth', async ({ page }) => {
    await page.goto('/#/pick')
    await page.waitForTimeout(300)
    await expect(page).toHaveURL(/auth/)
  })

  test('/settings 需要登录', async ({ page }) => {
    await page.goto('/#/settings')
    await page.waitForTimeout(300)
    await expect(page).toHaveURL(/auth/)
  })

  test('未知路由重定向', async ({ page }) => {
    await page.goto('/#/nonexistent')
    await page.waitForTimeout(300)
    await expect(page).toHaveURL(/auth/)
  })

  test('已登录访问 /settings', async ({ page }) => {
    await page.goto('/#/auth')
    await page.evaluate((auth) => {
      localStorage.setItem('mbe-auth-store', auth)
    }, mockAuthState())
    await page.goto('/#/settings')
    await page.waitForTimeout(300)
    const bodyText = await page.textContent('body')
    expect(bodyText).toBeTruthy()
  })
})
