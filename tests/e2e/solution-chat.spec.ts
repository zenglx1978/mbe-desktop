/**
 * P1 对话 E2E — 覆盖「用户打开方案 → 发消息 → 收到回复」的核心路径
 *
 * Mock 策略:
 *   - HTTP: page.route() 拦截 /api/{agent}/consult 等端点，返回 JSON
 *   - WebSocket: 无后端自然失败，chat-service 自动 fallback 到 HTTP
 *   - 状态: mockFullState 通过 localStorage 注入登录 + 已选方案
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import { mockFullState, mockWebSocket, mockWebSocketSequential } from './helpers'

/* ── Mock 辅助 ── */

interface MockReply {
  answer: string
  confidence?: number
  sources?: Array<{ title: string; url: string; reliability: string }>
}

/**
 * 拦截所有 Agent HTTP 咨询端点，返回固定 JSON 回复。
 * 匹配 /api/{agentId}/consult, /api/{agentId}/secretary/chat, /api/{agentId}/chat
 */
async function mockAgentAPI(page: Page, reply: string | MockReply) {
  const body: MockReply = typeof reply === 'string'
    ? { answer: reply, confidence: 0.85, sources: [] }
    : reply

  await page.route(
    /\/api\/[\w-]+\/(consult|secretary\/chat|chat)$/,
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    },
  )
}

/**
 * 拦截端点并延迟指定毫秒后返回，用于测试加载态。
 */
async function mockAgentAPIWithDelay(page: Page, reply: string, delayMs: number) {
  await page.route(
    /\/api\/[\w-]+\/(consult|secretary\/chat|chat)$/,
    async (route: Route) => {
      await new Promise(resolve => setTimeout(resolve, delayMs))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ answer: reply }),
      })
    },
  )
}

/**
 * 拦截端点，按调用次序返回不同回复（用于多轮对话测试）。
 */
async function mockAgentAPISequential(page: Page, replies: string[]) {
  let callIndex = 0
  await page.route(
    /\/api\/[\w-]+\/(consult|secretary\/chat|chat)$/,
    async (route: Route) => {
      const answer = replies[callIndex] ?? replies[replies.length - 1]
      callIndex++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ answer, confidence: 0.85 }),
      })
    },
  )
}

/* ── 等待辅助 ── */

const MSG_AREA = '[role="log"]'
const STREAMING_CURSOR = '.animate-pulse'

/**
 * 等待聊天界面就绪（textarea 可见），替代不可靠的 networkidle。
 *
 * Workspace 默认 activeTab='workflows'，ChatPanel 不会渲染。
 * 需要先切换到「AI 对话」tab，再等 textarea 出现。
 */
async function waitForChatReady(page: Page, timeout = 15_000) {
  await page.waitForLoadState('domcontentloaded')

  // 等待 WorkbenchTabs 渲染完毕，点击「AI 对话」切换到聊天面板
  const chatTab = page.locator('button', { hasText: 'AI 对话' })
  await expect(chatTab).toBeVisible({ timeout })
  await chatTab.click()

  await expect(page.locator('textarea')).toBeVisible({ timeout })
}

/**
 * 等待 assistant 回复完成（streaming 指示器消失）。
 * streaming 时 ChatMessage 会渲染一个 `.animate-pulse` 的光标元素。
 */
async function waitForReply(page: Page, timeout = 20_000) {
  const area = page.locator(MSG_AREA)
  // 先等 assistant 消息气泡出现（左对齐 = justify-start）
  await expect(area.locator('.justify-start').first()).toBeVisible({ timeout })
  // 再等 streaming 光标消失（所有气泡都完成）
  await expect(area.locator(STREAMING_CURSOR)).toBeHidden({ timeout })
}

/**
 * 在输入框填写文本并按 Enter 发送。
 */
async function sendChat(page: Page, text: string) {
  const textarea = page.locator('textarea')
  await expect(textarea).toBeVisible()
  await textarea.fill(text)
  await textarea.press('Enter')
}

/* ── 测试用例 ── */

test.describe('Solution 对话 E2E', () => {

  test('打开方案后展示欢迎页和快捷场景', async ({ page }) => {
    await mockFullState(page, 'labor-dispatch')
    await page.goto('/')
    await waitForChatReady(page)

    // 欢迎页可见
    const area = page.locator(MSG_AREA)
    await expect(area).toBeVisible()

    // 至少有一个场景卡片（labor-dispatch 有 "员工辞退方案" 等）
    await expect(page.getByText('员工辞退方案')).toBeVisible({ timeout: 10_000 })
  })

  test('直接输入消息并收到回复 (labor-dispatch)', async ({ page }) => {
    await mockFullState(page, 'labor-dispatch')
    const mockReply = '根据《劳动合同法》第四十七条，经济补偿按劳动者在本单位工作的年限计算。'
    await mockAgentAPI(page, mockReply)

    await page.goto('/')
    await waitForChatReady(page)

    await sendChat(page, '劳动合同到期不续签，需要支付经济补偿吗？')
    await waitForReply(page)

    const area = page.locator(MSG_AREA)
    await expect(area.locator('.justify-end').getByText('劳动合同到期不续签')).toBeVisible()
    await expect(area.locator('.justify-start').getByText('劳动合同法')).toBeVisible()
    await expect(area.locator('.justify-start').getByText('经济补偿')).toBeVisible()
  })

  test('点击快捷场景卡片并收到回复', async ({ page }) => {
    await mockFullState(page, 'labor-dispatch')
    const mockReply = '合法辞退方案分析：\n1. 协商一致解除（N倍补偿）\n2. 无过失性辞退（N+1）\n3. 经济性裁员'
    await mockAgentAPI(page, mockReply)

    await page.goto('/')
    await waitForChatReady(page)

    // 点击场景卡片
    const scenarioBtn = page.getByText('员工辞退方案')
    await expect(scenarioBtn).toBeVisible({ timeout: 10_000 })
    await scenarioBtn.click()

    await waitForReply(page)

    const area = page.locator(MSG_AREA)
    await expect(area.locator('.justify-end').getByText('辞退')).toBeVisible()
    await expect(area.locator('.justify-start').getByText('合法辞退方案')).toBeVisible()
  })

  test('finance-tax-service 方案直接对话', async ({ page }) => {
    await mockFullState(page, 'finance-tax-service')
    const mockReply = '一般纳税人增值税税率：13%（货物销售）、9%（建筑/交通）、6%（现代服务业）。'
    await mockAgentAPI(page, mockReply)

    await page.goto('/')
    await waitForChatReady(page)

    await sendChat(page, '一般纳税人增值税税率是多少？')
    await waitForReply(page)

    const area = page.locator(MSG_AREA)
    await expect(area.locator('.justify-end').getByText('增值税税率')).toBeVisible()
    await expect(area.locator('.justify-start').getByText('13%')).toBeVisible()
  })

  test('消息发送后 streaming 指示器正确出现和消失', async ({ page }) => {
    await mockFullState(page, 'labor-dispatch')
    await mockAgentAPIWithDelay(page, '延迟回复测试成功。', 1500)

    await page.goto('/')
    await waitForChatReady(page)

    await sendChat(page, '测试加载状态')

    const area = page.locator(MSG_AREA)
    // streaming 光标应出现
    await expect(area.locator(STREAMING_CURSOR)).toBeVisible({ timeout: 10_000 })
    // 回复完成后光标消失
    await expect(area.locator(STREAMING_CURSOR)).toBeHidden({ timeout: 15_000 })
    // 回复内容可见
    await expect(area.getByText('延迟回复测试成功')).toBeVisible()
  })

  test('连续发送多条消息保持对话顺序', async ({ page }) => {
    await mockFullState(page, 'labor-dispatch')
    await mockAgentAPISequential(page, [
      '第一个问题的回复：劳动合同期限由双方协商确定。',
      '第二个问题的回复：试用期工资不得低于约定工资的80%。',
    ])

    await page.goto('/')
    await waitForChatReady(page)

    // 第一轮
    await sendChat(page, '劳动合同期限有什么规定？')
    await waitForReply(page)

    // 第二轮
    await sendChat(page, '试用期工资标准是什么？')
    await waitForReply(page)

    const area = page.locator(MSG_AREA)
    await expect(area.locator('.justify-end').getByText('劳动合同期限')).toBeVisible()
    await expect(area.locator('.justify-end').getByText('试用期工资标准')).toBeVisible()
    await expect(area.locator('.justify-start').getByText('双方协商确定')).toBeVisible()
    await expect(area.locator('.justify-start').getByText('约定工资的80%')).toBeVisible()
  })

  test('AI 回复中嵌入流程链接，用户可点击跳转', async ({ page }) => {
    await mockFullState(page, 'finance-tax-service')

    const replyWithLinks = [
      '根据您的情况，建议按以下步骤处理：\n\n',
      '1. 先完成当月凭证录入 → [月末结转流程](mbe://workflow/monthly_closing)\n',
      '2. 核对银行流水 → [银行对账](mbe://workflow/bank_reconcile)\n',
      '3. 生成增值税申报表 → [税务申报](mbe://tab/tax-filing)\n',
      '4. 需要计算税额可使用 → [增值税计算器](mbe://calc/vat)\n',
    ].join('')

    await mockAgentAPI(page, replyWithLinks)

    await page.goto('/')
    await waitForChatReady(page)

    await sendChat(page, '这个月的记账报税流程怎么走？')
    await waitForReply(page)

    const area = page.locator(MSG_AREA)

    // 回复文本内容可见
    await expect(area.getByText('凭证录入')).toBeVisible()

    // mbe:// 链接被渲染为可点击的流程芯片按钮（WorkflowActionLink）
    const workflowBtn = area.locator('button[title*="执行流程"]').first()
    await expect(workflowBtn).toBeVisible()

    const tabBtn = area.locator('button[title*="前往"]').first()
    await expect(tabBtn).toBeVisible()

    const calcBtn = area.locator('button[title*="打开计算器"]').first()
    await expect(calcBtn).toBeVisible()

    // 点击流程链接按钮 → 触发 setActiveTab('workflows')，导航离开聊天页
    await workflowBtn.click()
    // 验证已导航到工作流面板（WorkflowPanel 渲染 "业务流程" 标题）
    await expect(page.getByText('业务流程')).toBeVisible({ timeout: 5000 })
  })

  test('AI 回复中 workflow_suggestion 渲染为流程建议', async ({ page }) => {
    await mockFullState(page, 'finance-tax-service')

    await page.route(
      /\/api\/[\w-]+\/(consult|secretary\/chat|chat)$/,
      async (route: Route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            answer: '已为您分析完毕，建议执行以下流程完成本月记账。',
            confidence: 0.9,
            workflow_suggestion: {
              suggested_task_type: 'accounting',
              workflow_name: '月末结转',
              workflow_description: '自动完成当月凭证汇总与结转',
              steps: [
                { id: 'step_1', name: '凭证录入' },
                { id: 'step_2', name: '核对银行流水' },
                { id: 'step_3', name: '月末结转' },
              ],
              message: '已为您分析完毕，建议执行以下流程完成本月记账。',
              confidence: 'high',
            },
          }),
        })
      },
    )

    await page.goto('/')
    await waitForChatReady(page)

    await sendChat(page, '帮我做月末结转')
    await waitForReply(page)

    const area = page.locator(MSG_AREA)
    await expect(area.locator('.justify-start').getByText('已为您分析完毕').first()).toBeVisible()
    await expect(area.locator('.justify-start').getByText('凭证录入').first()).toBeVisible()
  })

  test('API 异常时展示错误提示', async ({ page }) => {
    await mockFullState(page, 'labor-dispatch')
    // 所有端点返回 500
    await page.route(
      /\/api\/[\w-]+\/(consult|secretary\/chat|chat)$/,
      async (route: Route) => {
        await route.fulfill({ status: 500, body: 'Internal Server Error' })
      },
    )

    await page.goto('/')
    await waitForChatReady(page)

    await sendChat(page, '触发错误的消息')

    // 等待 assistant 消息出现（可能是错误提示）
    const area = page.locator(MSG_AREA)
    const assistantMsg = area.locator('.justify-start').first()
    await expect(assistantMsg).toBeVisible({ timeout: 20_000 })

    // streaming 应该已停止
    await expect(area.locator(STREAMING_CURSOR)).toBeHidden({ timeout: 5_000 })
  })

  /* ── WebSocket mock 测试 ── */

  test('WebSocket 流式回复正常渲染', async ({ page }) => {
    await mockFullState(page, 'finance-tax-service')
    await mockWebSocket(page, {
      answer: '增值税小规模纳税人季度销售额不超过30万元免征增值税，这是国家税务总局明确的优惠政策。',
      confidence: 0.92,
      sources: [{ title: '增值税暂行条例', url: 'https://tax.example/vat', reliability: 'authoritative' }],
    })

    await page.goto('/')
    await waitForChatReady(page)
    await sendChat(page, '小规模纳税人免税额度是多少？')
    await waitForReply(page)

    const area = page.locator(MSG_AREA)
    await expect(area.locator('.justify-start').getByText('30万元').first()).toBeVisible()
    await expect(area.locator(STREAMING_CURSOR)).toBeHidden({ timeout: 5_000 })
  })

  test('WebSocket 多轮对话按顺序返回不同回复', async ({ page }) => {
    await mockFullState(page, 'finance-tax-service')
    await mockWebSocketSequential(page, [
      '一般纳税人增值税税率分为13%、9%、6%三档。',
      '小规模纳税人征收率为3%，疫情期间曾降至1%。',
    ])

    await page.goto('/')
    await waitForChatReady(page)

    await sendChat(page, '一般纳税人税率是多少？')
    await waitForReply(page)
    const area = page.locator(MSG_AREA)
    await expect(area.locator('.justify-start').getByText('13%').first()).toBeVisible()

    await sendChat(page, '小规模纳税人呢？')
    await waitForReply(page, 2)
    await expect(area.locator('.justify-start').getByText('3%').first()).toBeVisible()
  })

  test('WebSocket 回复携带 workflow_suggestion 渲染流程建议', async ({ page }) => {
    await mockFullState(page, 'finance-tax-service')
    await mockWebSocket(page, {
      answer: '已为您生成记账凭证方案，请按以下步骤操作。',
      confidence: 0.88,
      workflow_suggestion: {
        workflow_id: 'monthly-bookkeeping',
        workflow_name: '月度记账',
        steps: [
          { step_id: 's1', name: '收集原始凭证', status: 'pending' },
          { step_id: 's2', name: '录入会计分录', status: 'pending' },
          { step_id: 's3', name: '审核过账', status: 'pending' },
        ],
      },
    })

    await page.goto('/')
    await waitForChatReady(page)
    await sendChat(page, '帮我做本月记账')
    await waitForReply(page)

    const area = page.locator(MSG_AREA)
    await expect(area.locator('.justify-start').getByText('记账凭证方案').first()).toBeVisible()
    await expect(area.locator('.justify-start').getByText('收集原始凭证').first()).toBeVisible()
  })

  test('点击回复中 workflow 链接跳转到流程面板', async ({ page }) => {
    await mockFullState(page, 'finance-tax-service')
    const linkText = '启动报税流程'
    await mockWebSocket(page, {
      answer: `请点击 [${linkText}](mbe://workflow/tax-filing) 开始操作。`,
      confidence: 0.90,
    })

    await page.goto('/')
    await waitForChatReady(page)
    await sendChat(page, '怎么报税？')
    await waitForReply(page)

    const area = page.locator(MSG_AREA)
    const link = area.locator('.justify-start').getByRole('button', { name: linkText }).first()
    await expect(link).toBeVisible({ timeout: 10_000 })
    await link.click()

    await expect(page.getByText('业务流程')).toBeVisible({ timeout: 5_000 })
  })
})
