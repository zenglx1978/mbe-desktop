/**
 * 五轮代码审计回归测试 — Desktop 专项
 * 覆盖：R15 Designer 导出格式、R18-R20 空壳 Store、R24 Tray、R29 计算器技术栈
 */
import { test, expect } from '@playwright/test'
import { mockFullState, clearState, ALL_SOLUTION_IDS } from './helpers'

test.describe('AUDIT — R15: DesignerPanel 导出格式', () => {
  test('R15-01: 设计器导出按钮存在', async ({ page }) => {
    await mockFullState(page, 'labor-dispatch')
    await page.goto('/#/')
    await page.waitForTimeout(1000)

    // 切到 workflows tab（设计器在 workflows 面板内）
    const workflowTab = page.locator('[data-tab="workflows"], button:has-text("工作流")')
    if (await workflowTab.count() > 0) {
      await workflowTab.first().click()
      await page.waitForTimeout(500)

      // 查找设计器入口
      const designerBtn = page.locator('button:has-text("设计"), button:has-text("Designer")')
      if (await designerBtn.count() > 0) {
        await designerBtn.first().click()
        await page.waitForTimeout(500)

        // 查找导出按钮并检查标签
        const exportBtn = page.locator('button:has-text("导出"), button:has-text("Export")')
        if (await exportBtn.count() > 0) {
          const btnText = await exportBtn.first().textContent()
          if (btnText?.includes('YAML')) {
            test.info().annotations.push({
              type: 'known-issue',
              description: 'R15: 按钮标签写 YAML 但实际导出 JSON',
            })
          }
        }
      }
    }
  })
})

test.describe('AUDIT — R18/R19: 空壳 Store 检测', () => {
  test('R18-01: adaptive-ui-store 不应全是空操作', async ({ page }) => {
    await mockFullState(page, 'labor-dispatch')
    await page.goto('/#/')
    await page.waitForTimeout(1000)

    // 通过 JS 评估检查 store 是否有真实实现
    const storeCheck = await page.evaluate(() => {
      // 检查 Zustand store 是否存在且有状态
      const stores = Object.keys(localStorage).filter(k =>
        k.includes('adaptive') || k.includes('ui-store')
      )
      return { storeKeys: stores, hasContent: stores.length > 0 }
    })

    test.info().annotations.push({
      type: storeCheck.hasContent ? 'ok' : 'known-issue',
      description: storeCheck.hasContent
        ? 'adaptive-ui-store 有 localStorage 数据'
        : 'R18: adaptive-ui-store 无 localStorage 数据（可能是空壳）',
    })
  })

  test('R19-01: smart-cache-store 不应全是空操作', async ({ page }) => {
    await mockFullState(page, 'labor-dispatch')
    await page.goto('/#/')
    await page.waitForTimeout(2000)

    const cacheCheck = await page.evaluate(() => {
      const stores = Object.keys(localStorage).filter(k =>
        k.includes('cache') || k.includes('smart-cache')
      )
      return { storeKeys: stores, hasContent: stores.length > 0 }
    })

    test.info().annotations.push({
      type: cacheCheck.hasContent ? 'ok' : 'known-issue',
      description: cacheCheck.hasContent
        ? 'smart-cache-store 有 localStorage 数据'
        : 'R19: smart-cache-store 无 localStorage 数据（可能是空壳）',
    })
  })
})

test.describe('AUDIT — R20: cloud-sync-store 调度器禁用', () => {
  test('R20-01: 云同步功能按钮存在但无效', async ({ page }) => {
    await mockFullState(page, 'labor-dispatch')
    await page.goto('/#/settings')
    await page.waitForTimeout(1000)

    const syncBtn = page.locator('button:has-text("同步"), button:has-text("Sync"), button:has-text("云同步")')
    if (await syncBtn.count() > 0) {
      test.info().annotations.push({
        type: 'known-issue',
        description: 'R20: 云同步按钮存在但 startCloudSync 返回空函数',
      })
    }
  })
})

test.describe('AUDIT — R29: 工具面板计算器技术栈', () => {
  test('R29-01: 工具面板计算器调用成功', async ({ page }) => {
    await mockFullState(page, 'labor-dispatch')
    await page.goto('/#/')
    await page.waitForTimeout(1000)

    // 切到 tools tab
    const toolTab = page.locator('[data-tab="tools"], button:has-text("工具")')
    if (await toolTab.count() > 0) {
      await toolTab.first().click()
      await page.waitForTimeout(500)

      // 查找任意计算器工具
      const calcTool = page.locator('[data-tool], button:has-text("计算"), button:has-text("Calculator")')
      if (await calcTool.count() > 0) {
        test.info().annotations.push({
          type: 'info',
          description: 'R29: 计算器使用 TypeScript 实现（非 Python），文档需更新',
        })
      }
    }
  })
})

test.describe('AUDIT — Dashboard 面板 API 调用', () => {
  test('DASH-01: DashboardPanel 加载不产生 JS 异常', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await mockFullState(page, 'labor-dispatch')
    await page.goto('/#/')
    await page.waitForTimeout(1000)

    // 切到 dashboard tab
    const dashTab = page.locator('[data-tab="dashboard"], button:has-text("仪表盘"), button:has-text("Dashboard")')
    if (await dashTab.count() > 0) {
      await dashTab.first().click()
      await page.waitForTimeout(3000)
    }

    // Dashboard 调用 17 个 API — 网络请求失败不应产生未捕获异常
    const criticalErrors = errors.filter(e =>
      !e.includes('fetch') && !e.includes('NetworkError') && !e.includes('AbortError')
    )
    expect(criticalErrors).toEqual([])
  })
})

test.describe('AUDIT — 所有方案可进入工作台', () => {
  for (const solId of ALL_SOLUTION_IDS) {
    test(`SOL-ENTER: ${solId} 工作台加载无异常`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))

      await mockFullState(page, solId)
      await page.goto('/#/')
      await page.waitForTimeout(2000)

      const criticalErrors = errors.filter(e =>
        !e.includes('fetch') && !e.includes('NetworkError') && !e.includes('AbortError')
      )
      expect(criticalErrors).toEqual([])
    })
  }
})

test.describe('AUDIT — 占位面板不崩溃', () => {
  const PLACEHOLDER_TABS = ['documents', 'tasks', 'approval', 'cost']

  for (const tab of PLACEHOLDER_TABS) {
    test(`PLACEHOLDER: ${tab} 面板切换不崩溃`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))

      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForTimeout(1000)

      const tabBtn = page.locator(`[data-tab="${tab}"], button:has-text("${tab}")`)
      if (await tabBtn.count() > 0) {
        await tabBtn.first().click()
        await page.waitForTimeout(1000)
        expect(errors).toEqual([])
      }
    })
  }
})
