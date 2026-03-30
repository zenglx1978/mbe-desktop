/**
 * 数据驱动 E2E — 覆盖 solution-chat.spec.ts 未涵盖的 9 个方案
 *
 * 每个方案验证：
 *   1. 打开后展示欢迎页和快捷场景卡片
 *   2. 直接输入消息并收到回复
 *   3. 点击快捷场景卡片并收到回复
 */
import { test, expect, type Page, type Route } from '@playwright/test'
import { mockFullState } from './helpers'

/* ── 方案元数据 ── */

interface SolutionTestData {
  id: string
  name: string
  /** 用于验证欢迎页的场景卡片文本（取第一个 quick_scenario） */
  firstScenario: string
  /** 直接对话的测试问题 */
  question: string
  /** mock 回复（需包含可断言的关键词） */
  mockReply: string
  /** 回复中的断言关键词 */
  replyKeyword: string
}

const SOLUTIONS: SolutionTestData[] = [
  {
    id: 'law-firm',
    name: '律师事务所',
    firstScenario: '案件胜率评估',
    question: '律所年度合规检查需要覆盖哪些方面？',
    mockReply: '律所年度合规检查应覆盖：1. 利益冲突管理 2. 客户资金专户 3. 保密义务 4. 执业风险防控。',
    replyKeyword: '利益冲突',
  },
  {
    id: 'insurance-operations',
    name: '保险公司运营',
    firstScenario: '理赔咨询',
    question: '车险小额案件的速赔标准是什么？',
    mockReply: '车险速赔标准：损失金额5000元以下、单方事故、证照齐全，可走速赔通道，24小时内赔付。',
    replyKeyword: '速赔',
  },
  {
    id: 'investment-research',
    name: '投研机构',
    firstScenario: '该不该买',
    question: 'AI 算力行业的核心投资逻辑是什么？',
    mockReply: 'AI 算力行业核心逻辑：需求端由大模型训练推理驱动，供给端受高端 GPU 产能约束，重点关注英伟达、AMD 产能释放节奏。',
    replyKeyword: '算力',
  },
  {
    id: 'clinic-respiratory',
    name: '就医助手',
    firstScenario: 'COPD 评估',
    question: '反复咳嗽两周，需要做什么检查？',
    mockReply: '持续咳嗽两周建议：1. 胸部X线排除肺炎/结核 2. 血常规+CRP 3. 肺功能检查排除哮喘。如有发热、咯血需紧急就诊。',
    replyKeyword: '胸部X线',
  },
  {
    id: 'ecommerce-brand-service',
    name: '品牌电商',
    firstScenario: 'AI Copilot',
    question: '大促期间客服排班应该怎么规划？',
    mockReply: '大促客服排班建议：预热期正常排班，爆发期三班倒，峰值时段（20:00-24:00）增配50%人力，配合AI预回复降低人工压力。',
    replyKeyword: '三班倒',
  },
  {
    id: 'construction-cost',
    name: '工程造价',
    firstScenario: '定额查询',
    question: '一栋6层住宅楼的土建造价大概多少每平米？',
    mockReply: '6层住宅楼土建造价参考：框架结构约2200-2800元/m²，砖混结构约1800-2200元/m²。具体需根据地区、抗震等级、装修标准调整。',
    replyKeyword: '元/m²',
  },
  {
    id: 'smb-operations',
    name: '中小企业运营',
    firstScenario: '合同快审',
    question: '供应商合同中哪些条款需要重点关注？',
    mockReply: '供应商合同重点条款：1. 质量标准与验收 2. 付款条件与账期 3. 违约责任与赔偿上限 4. 知识产权归属 5. 不可抗力条款。',
    replyKeyword: '违约责任',
  },
  {
    id: 'education-training',
    name: '教育培训',
    firstScenario: '留学规划',
    question: '雅思6.5能申请哪些英国大学的商科硕士？',
    mockReply: '雅思6.5可申请：利兹大学、谢菲尔德大学、南安普顿大学等QS前100商科硕士。部分名校接受雅思6.5配6周语言班。',
    replyKeyword: '利兹大学',
  },
  {
    id: 'study-abroad-consulting',
    name: '留学咨询',
    firstScenario: '智能选校',
    question: '英国硕士一年留学费用大概多少？',
    mockReply: '英国硕士一年费用预算：学费约20-35万人民币（商科偏高），生活费伦敦地区约15-20万，非伦敦约10-15万。总计35-55万/年。',
    replyKeyword: '35',
  },
]

/* ── Mock 辅助（复用 solution-chat.spec.ts 模式） ── */

async function mockAgentAPI(page: Page, reply: string) {
  await page.route(
    /\/api\/[\w-]+\/(consult|secretary\/chat|chat)$/,
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ answer: reply, confidence: 0.85 }),
      })
    },
  )
}

const MSG_AREA = '[role="log"]'
const STREAMING_CURSOR = '.animate-pulse'

async function waitForChatReady(page: Page, timeout = 15_000) {
  await page.waitForLoadState('domcontentloaded')
  const chatTab = page.locator('button', { hasText: 'AI 对话' }).first()
  await expect(chatTab).toBeVisible({ timeout })
  await chatTab.click()
  await expect(page.locator('textarea')).toBeVisible({ timeout })
}

async function waitForReply(page: Page, timeout = 20_000) {
  const area = page.locator(MSG_AREA)
  await expect(area.locator('.justify-start').first()).toBeVisible({ timeout })
  await expect(area.locator(STREAMING_CURSOR)).toBeHidden({ timeout })
}

async function sendChat(page: Page, text: string) {
  const textarea = page.locator('textarea')
  await expect(textarea).toBeVisible()
  await textarea.fill(text)
  await textarea.press('Enter')
}

/* ── 数据驱动测试 ── */

for (const sol of SOLUTIONS) {
  test.describe(`${sol.name} (${sol.id})`, () => {

    test('打开方案后展示欢迎页和快捷场景', async ({ page }) => {
      await mockFullState(page, sol.id)
      await page.goto('/')
      await waitForChatReady(page)

      const area = page.locator(MSG_AREA)
      await expect(area).toBeVisible()
      await expect(page.getByText(sol.firstScenario).first()).toBeVisible({ timeout: 10_000 })
    })

    test('直接输入消息并收到回复', async ({ page }) => {
      await mockFullState(page, sol.id)
      await mockAgentAPI(page, sol.mockReply)

      await page.goto('/')
      await waitForChatReady(page)

      await sendChat(page, sol.question)
      await waitForReply(page)

      const area = page.locator(MSG_AREA)
      await expect(area.locator('.justify-start').getByText(sol.replyKeyword).first()).toBeVisible()
    })

    test('点击快捷场景卡片并收到回复', async ({ page }) => {
      await mockFullState(page, sol.id)
      await mockAgentAPI(page, sol.mockReply)

      await page.goto('/')
      await waitForChatReady(page)

      const scenarioBtn = page.locator('button', { hasText: sol.firstScenario }).first()
      await expect(scenarioBtn).toBeVisible({ timeout: 10_000 })
      await scenarioBtn.click()

      await waitForReply(page)

      const area = page.locator(MSG_AREA)
      await expect(area.locator('.justify-start').getByText(sol.replyKeyword).first()).toBeVisible()
    })
  })
}
