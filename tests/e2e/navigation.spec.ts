/**
 * L1: 页面可达性测试
 *
 * 验证所有核心路由可访问、正确渲染、无 JS 异常。
 * 覆盖 5 条路由 + 未知路由重定向 + 路由守卫。
 */
import { test, expect } from '@playwright/test'
import { mockAuth, mockFullState, clearState, ALL_SOLUTION_IDS } from './helpers'

test.describe('L1: 页面可达性', () => {
  test.describe('未登录路由守卫', () => {
    test('根路径重定向到登录页', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/')
      await expect(page).toHaveURL(/.*#\/auth/)
    })

    test('/pick 未登录重定向到登录页', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/pick')
      await expect(page).toHaveURL(/.*#\/auth/)
    })

    test('/settings 未登录重定向到登录页', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/settings')
      await expect(page).toHaveURL(/.*#\/auth/)
    })

    test('/migrate 未登录重定向到登录页', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/migrate')
      await expect(page).toHaveURL(/.*#\/auth/)
    })

    test('未知路由重定向到登录页', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/nonexistent')
      await expect(page).toHaveURL(/.*#\/auth/)
    })
  })

  test.describe('登录页', () => {
    test('登录页加载成功，显示 MBE Logo', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/auth')
      await expect(page.locator('text=MBE')).toBeVisible()
      await expect(page.locator('text=AI 专业服务')).toBeVisible()
    })

    test('登录页显示登录/注册 Tab', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/auth')
      await expect(page.getByRole('button', { name: '登录' }).first()).toBeVisible()
      await expect(page.getByRole('button', { name: '注册' }).first()).toBeVisible()
    })

    test('登录页显示邮箱和密码输入框', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/auth')
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"]')).toBeVisible()
    })

    test('登录页显示 Google 登录按钮', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/auth')
      await expect(page.locator('text=Google')).toBeVisible()
    })

    test('登录页显示服务条款和隐私政策链接', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/auth')
      await expect(page.locator('a[href*="terms"]')).toBeVisible()
      await expect(page.locator('a[href*="privacy"]')).toBeVisible()
    })

    test('已登录用户访问 /auth 重定向到 /pick', async ({ page }) => {
      await mockAuth(page)
      await page.goto('/#/auth')
      await expect(page).toHaveURL(/.*#\/pick/)
    })
  })

  test.describe('方案选择页', () => {
    test('方案选择页加载成功', async ({ page }) => {
      await mockAuth(page)
      await page.goto('/#/pick')
      await expect(page.locator('text=选择行业方案')).toBeVisible()
    })

    test('显示所有行业方案卡片', async ({ page }) => {
      await mockAuth(page)
      await page.goto('/#/pick')
      await expect(page.locator('text=劳务派遣一站式方案')).toBeVisible()
      await expect(page.locator('text=律所智能运营方案')).toBeVisible()
      await expect(page.locator('text=财税专业服务方案')).toBeVisible()
      await expect(page.locator('text=工程造价咨询方案')).toBeVisible()
      await expect(page.locator('text=呼吸专科经营方案')).toBeVisible()
      await expect(page.locator('text=中小企业运营方案')).toBeVisible()
    })

    test('显示用户信息和退出按钮', async ({ page }) => {
      await mockAuth(page)
      await page.goto('/#/pick')
      await expect(page.locator('text=E2E 测试用户')).toBeVisible()
      await expect(page.getByRole('button', { name: '退出' })).toBeVisible()
    })

    test('方案卡片数量 >= 9', async ({ page }) => {
      await mockAuth(page)
      await page.goto('/#/pick')
      await page.waitForSelector('text=选择行业方案')
      const cards = page.locator('.grid > button')
      await expect(cards).toHaveCount(ALL_SOLUTION_IDS.length)
    })
  })

  test.describe('工作台页', () => {
    test('工作台页加载成功（劳务派遣方案）', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await expect(page.locator('text=劳务派遣一站式方案')).toBeVisible()
    })

    test('未选方案时工作台重定向到 /pick', async ({ page }) => {
      await mockAuth(page)
      await page.goto('/#/')
      await expect(page).toHaveURL(/.*#\/pick/)
    })
  })

  test.describe('设置页', () => {
    test('设置页加载成功', async ({ page }) => {
      await mockFullState(page)
      await page.goto('/#/settings')
      await expect(page.locator('h1:has-text("设置")')).toBeVisible()
      await expect(page.locator('text=账户与方案设置')).toBeVisible()
    })

    test('设置页显示返回按钮', async ({ page }) => {
      await mockFullState(page)
      await page.goto('/#/settings')
      await expect(page.locator('text=← 返回')).toBeVisible()
    })

    test('设置页显示账户区域', async ({ page }) => {
      await mockFullState(page)
      await page.goto('/#/settings')
      await expect(page.getByRole('heading', { name: '账户' })).toBeVisible()
    })

    test('设置页显示数据管理区域', async ({ page }) => {
      await mockFullState(page)
      await page.goto('/#/settings')
      await expect(page.locator('text=数据管理')).toBeVisible()
    })
  })

  test.describe('无 JS 异常', () => {
    test('登录页无 JS 异常', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await clearState(page)
      await page.goto('/#/auth')
      await page.waitForTimeout(1000)
      expect(errors).toEqual([])
    })

    test('方案选择页无 JS 异常', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await mockAuth(page)
      await page.goto('/#/pick')
      await page.waitForTimeout(1000)
      expect(errors).toEqual([])
    })

    test('工作台页无 JS 异常', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await mockFullState(page)
      await page.goto('/#/')
      await page.waitForTimeout(2000)
      expect(errors).toEqual([])
    })

    test('设置页无 JS 异常', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await mockFullState(page)
      await page.goto('/#/settings')
      await page.waitForTimeout(1000)
      expect(errors).toEqual([])
    })
  })
})
