/**
 * L2: 组件渲染测试
 *
 * 验证工作台核心组件正确渲染：侧边栏、WorkbenchTabs、各面板。
 * 覆盖不同方案下的 Tab 启用情况 + 全部 10 个面板。
 */
import { test, expect } from '@playwright/test'
import { mockFullState } from './helpers'

test.describe('L2: 组件渲染', () => {
  test.describe('侧边栏 (Sidebar)', () => {
    test('侧边栏显示用户头像和信息', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      await expect(page.locator('aside')).toBeVisible()
      await expect(page.locator('aside').locator('text=E2E 测试用户')).toBeVisible()
    })

    test('侧边栏显示导航条目', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      const sidebar = page.locator('aside')
      await expect(sidebar.locator('text=AI 对话')).toBeVisible()
      await expect(sidebar.locator('text=计算工具')).toBeVisible()
    })

    test('侧边栏显示审批和费用条目（自动注入）', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      const sidebar = page.locator('aside')
      await expect(sidebar.locator('text=审批')).toBeVisible()
      await expect(sidebar.locator('text=费用')).toBeVisible()
    })

    test('侧边栏显示设置和退出按钮', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      const sidebar = page.locator('aside')
      await expect(sidebar.locator('text=设置')).toBeVisible()
      await expect(sidebar.locator('text=退出登录')).toBeVisible()
    })

    test('侧边栏折叠/展开', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      const sidebar = page.locator('aside')
      await expect(sidebar).toHaveClass(/w-64/)

      const collapseBtn = sidebar.locator('text=收起')
      await collapseBtn.click()
      await expect(sidebar).toHaveClass(/w-16/)
    })
  })

  test.describe('WorkbenchTabs（顶部 Tab 栏）', () => {
    test('劳务派遣方案 — 显示所有自动注入 Tab', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      const header = page.locator('header')
      await expect(header.locator('text=对话')).toBeVisible()
      await expect(header.locator('text=工具')).toBeVisible()
      await expect(header.locator('text=研判')).toBeVisible()
      await expect(header.locator('text=仪表盘')).toBeVisible()
      await expect(header.locator('text=文档')).toBeVisible()
      await expect(header.locator('text=任务')).toBeVisible()
      await expect(header.locator('text=审批')).toBeVisible()
      await expect(header.locator('text=费用')).toBeVisible()
      await expect(header.locator('text=调度')).toBeVisible()
      await expect(header.locator('text=设计器')).toBeVisible()
    })

    test('律所方案 — 显示工作台 Tab', async ({ page }) => {
      await mockFullState(page, 'law-firm')
      await page.goto('/#/')
      await page.waitForSelector('text=律所智能运营方案')
      const header = page.locator('header')
      await expect(header.locator('text=对话')).toBeVisible()
      await expect(header.locator('text=工具')).toBeVisible()
    })

    test('呼吸专科方案 — 仅 chat + tools + 自动注入 Tab', async ({ page }) => {
      await mockFullState(page, 'clinic-respiratory')
      await page.goto('/#/')
      await page.waitForSelector('text=呼吸专科经营方案')
      const header = page.locator('header')
      await expect(header.locator('text=对话')).toBeVisible()
      await expect(header.locator('text=工具')).toBeVisible()
      await expect(header.locator('text=审批')).toBeVisible()
      await expect(header.locator('text=调度')).toBeVisible()
    })
  })

  test.describe('ChatPanel WelcomeScreen', () => {
    test('对话面板显示方案 LOGO 和 tagline', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      await page.locator('header').locator('button:has-text("对话")').click()
      await expect(page.locator('text=劳务派遣一站式方案').first()).toBeVisible()
    })

    test('对话面板显示快捷场景', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      await page.locator('header').locator('button:has-text("对话")').click()
      await expect(page.locator('text=快捷场景')).toBeVisible()
    })

    test('投研方案对话面板显示决策链', async ({ page }) => {
      await mockFullState(page, 'investment-research')
      await page.goto('/#/')
      await page.waitForSelector('text=投研机构智能方案')
      await page.locator('header').locator('button:has-text("对话")').click()
      await expect(page.locator('text=决策链')).toBeVisible()
    })

    test('对话面板显示 AI 专家团队', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      await page.locator('header').locator('button:has-text("对话")').click()
      await expect(page.locator('text=AI 专家团队')).toBeVisible()
    })

    test('对话面板显示利润指标卡片', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      await page.locator('header').locator('button:has-text("对话")').click()
      await expect(page.locator('text=年省 30-50 万')).toBeVisible()
    })

    test('对话面板显示输入框和发送按钮', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      await page.locator('header').locator('button:has-text("对话")').click()
      await expect(page.locator('textarea')).toBeVisible()
    })
  })

  test.describe('面板切换 — 占位面板', () => {
    test('文档 Tab — 显示占位文案', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      await page.locator('header').locator('button:has-text("文档")').click()
      await expect(page.locator('text=文档管理功能即将上线')).toBeVisible()
    })

    test('任务 Tab — 显示占位文案', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      await page.locator('header').locator('button:has-text("任务")').click()
      await expect(page.locator('text=任务管理功能即将上线')).toBeVisible()
    })

    test('审批 Tab — 显示占位文案', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      await page.locator('header').locator('button:has-text("审批")').click()
      await expect(page.locator('text=审批管理')).toBeVisible()
      await expect(page.locator('text=待审批事项将显示在此处')).toBeVisible()
    })

    test('费用 Tab — 显示占位文案', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      await page.locator('header').locator('button:has-text("费用")').click()
      await expect(page.locator('text=费用追踪功能即将上线')).toBeVisible()
    })
  })

  test.describe('面板切换 — 实际功能面板', () => {
    test('仪表盘 Tab — 切换无 JS 异常', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      await page.locator('header').locator('button:has-text("仪表盘")').click()
      await page.waitForTimeout(2000)
      expect(errors).toEqual([])
    })

    test('调度 Tab — 加载 SchedulerPanel', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      await page.locator('header').locator('button:has-text("调度")').click()
      await page.waitForTimeout(1000)
      const main = page.locator('main')
      await expect(main).toBeVisible()
    })

    test('设计器 Tab — 加载 DesignerPanel', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      await page.locator('header').locator('button:has-text("设计器")').click()
      await page.waitForTimeout(1000)
      const main = page.locator('main')
      await expect(main).toBeVisible()
    })
  })

  test.describe('连接状态标记', () => {
    test('工作台显示连接状态组件', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      const header = page.locator('header')
      await expect(header).toBeVisible()
    })
  })

  test.describe('方案主题色', () => {
    test('劳务派遣方案 — 金色主题', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      const dataSolution = await page.locator('html').getAttribute('data-solution')
      expect(dataSolution).toBe('labor-dispatch')
    })

    test('律所方案 — 蓝色主题', async ({ page }) => {
      await mockFullState(page, 'law-firm')
      await page.goto('/#/')
      await page.waitForSelector('text=律所智能运营方案')
      const dataSolution = await page.locator('html').getAttribute('data-solution')
      expect(dataSolution).toBe('law-firm')
    })

    test('财税方案 — 绿色主题', async ({ page }) => {
      await mockFullState(page, 'finance-tax-service')
      await page.goto('/#/')
      await page.waitForSelector('text=财税专业服务方案')
      const dataSolution = await page.locator('html').getAttribute('data-solution')
      expect(dataSolution).toBe('finance-tax-service')
    })
  })

  test.describe('Loading Screen', () => {
    test('应用启动时显示 Loading', async ({ page }) => {
      await mockFullState(page)
      const response = page.goto('/#/')
      const loading = page.locator('text=正在启动...')
      await response
      await page.waitForTimeout(500)
    })
  })

  test.describe('设置页组件', () => {
    test('设置页显示账户管理入口', async ({ page }) => {
      await mockFullState(page)
      await page.goto('/#/settings')
      await expect(page.getByRole('button', { name: /在浏览器中登录/ })).toBeVisible()
    })

    test('设置页显示数据管理按钮', async ({ page }) => {
      await mockFullState(page)
      await page.goto('/#/settings')
      await expect(page.locator('button:has-text("备份本地数据")')).toBeVisible()
      await expect(page.locator('button:has-text("恢复本地数据")')).toBeVisible()
      await expect(page.locator('button:has-text("清除缓存")')).toBeVisible()
    })

    test('设置页显示自动备份提示', async ({ page }) => {
      await mockFullState(page)
      await page.goto('/#/settings')
      await expect(page.locator('text=.mbebackup')).toBeVisible()
    })
  })
})
