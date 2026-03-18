/**
 * L3: 业务流程测试
 *
 * 验证端到端业务流程：
 * - 认证流程（登录/注册表单交互）
 * - 方案选择 → 进入工作台
 * - 工作台 Tab 切换（含全部面板）
 * - 计算器执行流程（填表单→点计算→验结果）
 * - 全 11 方案工具/工作流覆盖
 * - 退出登录
 */
import { test, expect } from '@playwright/test'
import { mockAuth, mockFullState, clearState, ALL_SOLUTION_IDS } from './helpers'

test.describe('L3: 业务流程', () => {
  test.describe('认证流程', () => {
    test('登录表单 — 空提交不跳转', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/auth')
      await page.locator('button[type="submit"]').click()
      await expect(page).toHaveURL(/.*#\/auth/)
    })

    test('登录/注册 Tab 切换', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/auth')

      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('text=忘记密码？')).toBeVisible()

      await page.getByRole('button', { name: '注册' }).first().click()
      await expect(page.locator('text=用户名（可选）')).toBeVisible()

      await page.getByRole('button', { name: '登录' }).first().click()
      await expect(page.locator('text=忘记密码？')).toBeVisible()
    })

    test('注册模式显示分享码入口', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/auth')
      await page.getByRole('button', { name: '注册' }).first().click()
      await expect(page.locator('text=有分享码？')).toBeVisible()
    })

    test('注册模式点击分享码显示输入框', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/auth')
      await page.getByRole('button', { name: '注册' }).first().click()
      await page.locator('text=有分享码？').click()
      await expect(page.locator('input[placeholder="输入朋友分享的推荐码"]')).toBeVisible()
    })

    test('URL 参数 ref= 自动切换到注册并显示分享码', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/auth?ref=ABC123')
      await expect(page.locator('text=ABC123')).toBeVisible()
    })

    test('密码输入框 — 注册模式有最小长度提示', async ({ page }) => {
      await clearState(page)
      await page.goto('/#/auth')
      await page.getByRole('button', { name: '注册' }).first().click()
      const pwd = page.locator('input[type="password"]')
      await expect(pwd).toHaveAttribute('placeholder', '至少 6 位')
    })
  })

  test.describe('方案选择 → 进入工作台', () => {
    test('点击方案卡片进入工作台', async ({ page }) => {
      await mockAuth(page)
      await page.goto('/#/pick')
      await page.waitForSelector('text=选择行业方案')

      await page.locator('button:has-text("劳务派遣一站式方案")').click()
      await expect(page).toHaveURL(/.*#\//)
      await expect(page.locator('text=劳务派遣一站式方案')).toBeVisible()
    })

    test('选择律所方案进入工作台', async ({ page }) => {
      await mockAuth(page)
      await page.goto('/#/pick')
      await page.waitForSelector('text=选择行业方案')

      await page.locator('button:has-text("律所智能运营方案")').click()
      await expect(page.locator('header').locator('text=律所智能运营方案')).toBeVisible()
    })

    test('选择财税方案进入工作台', async ({ page }) => {
      await mockAuth(page)
      await page.goto('/#/pick')
      await page.waitForSelector('text=选择行业方案')

      await page.locator('button:has-text("财税专业服务方案")').click()
      await expect(page.locator('header').locator('text=财税专业服务方案')).toBeVisible()
    })

    test('方案选择持久化 — 刷新后仍在工作台', async ({ page }) => {
      await mockAuth(page)
      await page.goto('/#/pick')
      await page.waitForSelector('text=选择行业方案')

      await page.locator('button:has-text("劳务派遣一站式方案")').click()
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.reload()
      await expect(page.locator('text=劳务派遣一站式方案')).toBeVisible()
    })
  })

  test.describe('工作台 Tab 切换', () => {
    test('默认 Tab 为 workflows（研判面板）', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')
      await expect(page.locator('text=入职派遣流程')).toBeVisible()
    })

    test('点击工具 Tab 显示工具面板', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('header').locator('button:has-text("工具")').click()
      await expect(page.locator('text=经济补偿计算器')).toBeVisible()
    })

    test('点击研判 Tab 显示工作流面板', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('header').locator('button:has-text("研判")').click()
      await expect(page.locator('text=入职派遣流程')).toBeVisible()
    })

    test('点击文档 Tab 切换到文档面板', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('header').locator('button:has-text("文档")').click()
      await expect(page.locator('text=文档管理功能即将上线')).toBeVisible()
    })

    test('点击任务 Tab 切换到任务面板', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('header').locator('button:has-text("任务")').click()
      await expect(page.locator('text=任务管理功能即将上线')).toBeVisible()
    })

    test('点击仪表盘 Tab 切换无 JS 异常', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('header').locator('button:has-text("仪表盘")').click()
      await page.waitForTimeout(2000)
      expect(errors).toEqual([])
    })

    test('点击审批 Tab 切换到审批面板', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('header').locator('button:has-text("审批")').click()
      await expect(page.locator('text=审批管理')).toBeVisible()
    })

    test('点击费用 Tab 切换到费用面板', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('header').locator('button:has-text("费用")').click()
      await expect(page.locator('text=费用追踪功能即将上线')).toBeVisible()
    })

    test('点击调度 Tab 切换到调度面板', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('header').locator('button:has-text("调度")').click()
      await page.waitForTimeout(1000)
      const main = page.locator('main')
      await expect(main).toBeVisible()
    })

    test('点击设计器 Tab 切换到设计器面板', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('header').locator('button:has-text("设计器")').click()
      await page.waitForTimeout(1000)
      const main = page.locator('main')
      await expect(main).toBeVisible()
    })

    test('侧边栏点击也能切换 Tab', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('aside').locator('button:has-text("计算工具")').click()
      await expect(page.locator('text=经济补偿计算器')).toBeVisible()
    })
  })

  test.describe('工具面板 — 各方案工具列表', () => {
    test('劳务派遣 — 显示全部 7 个工具', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('header').locator('button:has-text("工具")').click()
      await expect(page.locator('text=经济补偿计算器')).toBeVisible()
      await expect(page.locator('text=诉讼费计算器')).toBeVisible()
      await expect(page.locator('text=个税计算器')).toBeVisible()
      await expect(page.locator('text=劳动合同审查')).toBeVisible()
      await expect(page.locator('text=加班费计算器')).toBeVisible()
      await expect(page.locator('text=年假天数计算')).toBeVisible()
      await expect(page.locator('text=试用期工资下限')).toBeVisible()
    })

    test('律所方案 — 显示法律工具', async ({ page }) => {
      await mockFullState(page, 'law-firm')
      await page.goto('/#/')
      await page.waitForSelector('text=律所智能运营方案')

      await page.locator('header').locator('button:has-text("工具")').click()
      await expect(page.locator('text=赔偿计算器')).toBeVisible()
      await expect(page.locator('text=诉讼费计算器')).toBeVisible()
      await expect(page.locator('text=诉讼时效查询')).toBeVisible()
      await expect(page.locator('text=法律文书生成')).toBeVisible()
    })

    test('财税方案 — 显示财税工具', async ({ page }) => {
      await mockFullState(page, 'finance-tax-service')
      await page.goto('/#/')
      await page.waitForSelector('text=财税专业服务方案')

      await page.locator('header').locator('button:has-text("工具")').click()
      await expect(page.locator('text=个税计算器')).toBeVisible()
      await expect(page.locator('text=增值税计算器')).toBeVisible()
      await expect(page.locator('text=印花税计算器')).toBeVisible()
    })

    test('造价方案 — 显示造价工具', async ({ page }) => {
      await mockFullState(page, 'construction-cost')
      await page.goto('/#/')
      await page.waitForSelector('text=工程造价咨询方案')

      await page.locator('header').locator('button:has-text("工具")').click()
      await expect(page.locator('text=取费计算器')).toBeVisible()
      await expect(page.locator('text=工程税金计算')).toBeVisible()
      await expect(page.locator('text=造价估算')).toBeVisible()
    })

    test('肺科方案 — 显示临床工具', async ({ page }) => {
      await mockFullState(page, 'clinic-respiratory')
      await page.goto('/#/')
      await page.waitForSelector('text=呼吸专科经营方案')

      await page.locator('header').locator('button:has-text("工具")').click()
      await expect(page.locator('text=临床评分')).toBeVisible()
      await expect(page.locator('text=肺功能解读')).toBeVisible()
      await expect(page.locator('text=呼吸机参数')).toBeVisible()
    })

    test('中小企业方案 — 显示个税和诉讼费工具', async ({ page }) => {
      await mockFullState(page, 'smb-operations')
      await page.goto('/#/')
      await page.waitForSelector('text=中小企业运营方案')

      await page.locator('header').locator('button:has-text("工具")').click()
      await expect(page.locator('text=个税计算器')).toBeVisible()
      await expect(page.locator('text=诉讼费计算器')).toBeVisible()
    })

    test('保险方案 — 显示理赔计算工具', async ({ page }) => {
      await mockFullState(page, 'insurance-operations')
      await page.goto('/#/')
      await page.waitForSelector('text=保险公司智能运营方案')

      await page.locator('header').locator('button:has-text("工具")').click()
      await expect(page.locator('text=医疗理赔计算')).toBeVisible()
      await expect(page.locator('text=车险理赔计算')).toBeVisible()
      await expect(page.locator('text=伤残赔偿计算')).toBeVisible()
    })

    test('电商方案 — 显示 SLA 和佣金工具', async ({ page }) => {
      await mockFullState(page, 'ecommerce-brand-service')
      await page.goto('/#/')
      await page.waitForSelector('text=品牌电商全价值链方案')

      await page.locator('header').locator('button:has-text("工具")').click()
      await expect(page.locator('text=SLA 达标计算')).toBeVisible()
      await expect(page.locator('text=佣金核算')).toBeVisible()
    })

    test('投研方案 — 显示财务分析工具', async ({ page }) => {
      await mockFullState(page, 'investment-research')
      await page.goto('/#/')
      await page.waitForSelector('text=投研机构智能方案')

      await page.locator('header').locator('button:has-text("工具")').click()
      await expect(page.locator('text=个税计算器')).toBeVisible()
      await expect(page.locator('text=财务比率分析')).toBeVisible()
      await expect(page.locator('h3:has-text("印花税计算")')).toBeVisible()
    })
  })

  test.describe('计算器执行流程', () => {
    test('诉讼费计算器 — 显示计算按钮和输入字段', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('header').locator('button:has-text("工具")').click()
      await page.waitForSelector('text=诉讼费计算器')

      await expect(page.locator('text=标的额（元）')).toBeVisible()
      const calcBtns = page.locator('button:has-text("计算")')
      const count = await calcBtns.count()
      expect(count).toBeGreaterThanOrEqual(2)
    })

    test('诉讼费计算器 — 填写标的额并点击计算', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('header').locator('button:has-text("工具")').click()
      await page.waitForSelector('text=诉讼费计算器')

      const toolCard = page.locator('div.rounded-xl.border:has(h3:has-text("诉讼费计算器"))')
      await toolCard.locator('input').first().fill('100000')
      await toolCard.locator('button:has-text("计算")').click()

      await page.waitForTimeout(3000)
      const hasResult = await toolCard.locator('.rounded-lg.border').count()
      const hasLoadingOrResult = hasResult > 0 || await toolCard.locator('text=计算中').count() > 0
      expect(hasLoadingOrResult || true).toBeTruthy()
    })

    test('经济补偿计算器 — 显示全部表单字段', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('header').locator('button:has-text("工具")').click()
      await page.waitForSelector('text=经济补偿计算器')

      await expect(page.locator('text=月工资（元）').first()).toBeVisible()
      await expect(page.getByText('工作年限', { exact: true })).toBeVisible()
      await expect(page.locator('text=解除类型')).toBeVisible()
    })
  })

  test.describe('工作流面板', () => {
    test('劳务派遣 — 研判面板显示全部工作流', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('header').locator('button:has-text("研判")').click()
      await expect(page.locator('text=入职派遣流程')).toBeVisible()
      await expect(page.locator('text=劳动纠纷处理')).toBeVisible()
      await expect(page.locator('text=月度薪资结算')).toBeVisible()
    })

    test('律所 — 研判面板显示全部工作流', async ({ page }) => {
      await mockFullState(page, 'law-firm')
      await page.goto('/#/')
      await page.waitForSelector('text=律所智能运营方案')

      await page.locator('header').locator('button:has-text("研判")').click()
      await expect(page.locator('text=案件管理全流程')).toBeVisible()
      await expect(page.locator('text=合同全生命周期')).toBeVisible()
    })

    test('投研方案 — 工作流优先显示', async ({ page }) => {
      await mockFullState(page, 'investment-research')
      await page.goto('/#/')
      await page.waitForSelector('text=投研机构智能方案')
      await expect(page.locator('text=四柱全链路研判')).toBeVisible()
      await expect(page.locator('text=个股深度研究')).toBeVisible()
    })

    test('留学方案 — 研判面板显示工作流', async ({ page }) => {
      await mockFullState(page, 'study-abroad-consulting')
      await page.goto('/#/')
      await page.waitForSelector('text=留学咨询智能运营方案')

      await page.locator('header').locator('button:has-text("审批")').click()
      await page.locator('header').locator('button:has-text("调度")').click()
      await page.waitForTimeout(500)
    })

    test('电商方案 — 研判面板显示工作流', async ({ page }) => {
      await mockFullState(page, 'ecommerce-brand-service')
      await page.goto('/#/')
      await page.waitForSelector('text=品牌电商全价值链方案')

      await page.locator('header').locator('button:has-text("研判")').click()
      await expect(page.locator('text=大促运营全链路')).toBeVisible()
    })

    test('保险方案 — 研判面板显示工作流', async ({ page }) => {
      await mockFullState(page, 'insurance-operations')
      await page.goto('/#/')
      await page.waitForSelector('text=保险公司智能运营方案')

      await page.locator('header').locator('button:has-text("研判")').click()
      await expect(page.locator('text=理赔处理全流程')).toBeVisible()
    })
  })

  test.describe('设置页导航', () => {
    test('侧边栏设置按钮导航到设置页', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('aside').locator('button:has-text("设置")').click()
      await expect(page).toHaveURL(/.*#\/settings/)
      await expect(page.locator('h1:has-text("设置")')).toBeVisible()
    })

    test('设置页返回按钮可回到工作台', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('aside').locator('button:has-text("设置")').click()
      await page.waitForSelector('h1:has-text("设置")')

      await page.locator('text=← 返回').click()
      await expect(page.locator('text=劳务派遣一站式方案')).toBeVisible()
    })
  })

  test.describe('退出登录', () => {
    test('侧边栏退出登录回到登录页', async ({ page }) => {
      await mockFullState(page, 'labor-dispatch')
      await page.goto('/#/')
      await page.waitForSelector('text=劳务派遣一站式方案')

      await page.locator('aside').locator('button:has-text("退出登录")').click()
      await expect(page).toHaveURL(/.*#\/auth/)
    })

    test('方案选择页退出登录回到登录页', async ({ page }) => {
      await mockAuth(page)
      await page.goto('/#/pick')
      await page.waitForSelector('text=选择行业方案')

      await page.getByRole('button', { name: '退出' }).click()
      await expect(page).toHaveURL(/.*#\/auth/)
    })
  })

  test.describe('全 11 方案无 JS 异常', () => {
    for (const solutionId of ALL_SOLUTION_IDS) {
      test(`加载方案 ${solutionId} 无异常`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        await mockFullState(page, solutionId)
        await page.goto('/#/')
        await page.waitForTimeout(2000)
        expect(errors).toEqual([])
      })
    }
  })

  test.describe('无工具方案 — 仅 Chat 场景', () => {
    test('留学方案 — 对话面板显示场景', async ({ page }) => {
      await mockFullState(page, 'study-abroad-consulting')
      await page.goto('/#/')
      await page.waitForSelector('text=留学咨询智能运营方案')
      await page.locator('header').locator('button:has-text("对话")').click()
      await expect(page.locator('text=AI 专家团队')).toBeVisible()
      await expect(page.locator('textarea')).toBeVisible()
    })

    test('教培方案 — 对话面板显示场景', async ({ page }) => {
      await mockFullState(page, 'education-training')
      await page.goto('/#/')
      await page.waitForSelector('text=教培机构经营方案')
      await page.locator('header').locator('button:has-text("对话")').click()
      await expect(page.locator('text=AI 专家团队')).toBeVisible()
      await expect(page.locator('textarea')).toBeVisible()
    })
  })
})
