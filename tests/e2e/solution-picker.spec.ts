import { test, expect } from '@playwright/test'

function mockAuthState() {
  return JSON.stringify({
    state: { token: 'test-token', user: { id: 1, username: 'test' } },
    version: 0,
  })
}

test.describe('Solution Picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/auth')
    await page.evaluate((auth) => {
      localStorage.setItem('mbe-auth-store', auth)
    }, mockAuthState())
    await page.goto('/#/pick')
    await page.waitForTimeout(300)
  })

  test('显示方案选择页面', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible()
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })

  test('页面包含可交互元素', async ({ page }) => {
    const buttons = page.locator('button, [role="button"], a')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)
  })
})
