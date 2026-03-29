import { type Page } from '@playwright/test'

/**
 * 注入 localStorage 模拟已登录状态（浏览器模式下 auth-store 从 localStorage 恢复）
 */
export async function mockAuth(page: Page, opts?: { token?: string; user?: { name: string; email: string } }) {
  const token = opts?.token ?? 'test-token-e2e-mock'
  const user = opts?.user ?? { name: 'E2E 测试用户', email: 'e2e@test.com', userId: 'e2e-test-user' }

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
  }, { token, user })
}

/**
 * 注入 localStorage 模拟已选择方案
 */
export async function mockSolution(page: Page, solutionId: string) {
  await page.addInitScript(({ solutionId }) => {
    localStorage.setItem('lastSolutionId', solutionId)
  }, { solutionId })
}

/**
 * 拦截 /api/health 返回 200，防止 connectivity-store 将模式设为 degraded/offline。
 * 不做此拦截时，Vite dev server 无法处理 /api/health → 请求失败 → OfflineBanner 遮挡 UI。
 */
export async function mockConnectivity(page: Page) {
  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', service: 'e2e-mock' }),
    })
  })
}

/**
 * 在 localStorage 标记方案 onboarding 已完成，跳过「快速了解你的业务」弹窗。
 * Workspace 组件通过 `mbe-onboarding-done-{solutionId}` 判断是否展示引导。
 */
export async function mockSkipOnboarding(page: Page, solutionId: string) {
  await page.addInitScript(({ solutionId }) => {
    localStorage.setItem(`mbe-onboarding-done-${solutionId}`, '1')
  }, { solutionId })
}

/**
 * 注入已登录 + 已选方案 + 网络连通性 + 跳过引导 的完整状态
 */
export async function mockFullState(page: Page, solutionId = 'labor-dispatch') {
  await mockConnectivity(page)
  await mockAuth(page)
  await mockSolution(page, solutionId)
  await mockSkipOnboarding(page, solutionId)
}

/**
 * 清除所有 mock 状态
 */
export async function clearState(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear()
  })
}

/** 11 个方案 ID 列表 */
export const ALL_SOLUTION_IDS = [
  'labor-dispatch',
  'law-firm',
  'finance-tax-service',
  'construction-cost',
  'clinic-respiratory',
  'smb-operations',
  'study-abroad-consulting',
  'education-training',
  'ecommerce-brand-service',
  'insurance-operations',
  'investment-research',
]

/** 方案 → 启用 Tab 映射 */
export const SOLUTION_TABS: Record<string, string[]> = {
  'labor-dispatch': ['chat', 'tools', 'documents', 'tasks', 'workflows', 'dashboard'],
  'law-firm': ['chat', 'tools', 'documents', 'tasks', 'workflows', 'dashboard'],
  'finance-tax-service': ['chat', 'tools', 'documents', 'workflows', 'dashboard'],
  'construction-cost': ['chat', 'tools', 'workflows', 'dashboard'],
  'clinic-respiratory': ['chat', 'tools'],
  'smb-operations': ['chat', 'tools', 'dashboard'],
  'study-abroad-consulting': ['chat'],
  'education-training': ['chat'],
  'ecommerce-brand-service': ['chat', 'tools', 'workflows', 'dashboard'],
  'insurance-operations': ['chat', 'tools', 'workflows', 'dashboard'],
  'investment-research': ['workflows', 'dashboard', 'chat', 'tools'],
}
