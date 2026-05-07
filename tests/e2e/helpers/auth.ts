/**
 * E2E 测试共享辅助工具
 *
 * 核心策略：
 *  - 通过 page.addInitScript() 在 React 挂载前写入 localStorage，
 *    模拟 restoreAuth() / initFromStorage() 读取到的用户会话。
 *  - 通过 page.route() 拦截后端 API，返回 mock 响应，避免依赖真实服务。
 *  - HashRouter 路由格式：http://localhost:5180/#/<path>
 */

import type { Page } from '@playwright/test'

// ── 用户角色 ───────────────────────────────────────────────────────────────

export const EXTERNAL_USER = {
  name: '外部测试用户',
  email: 'external@e2e.test',
  role: 'user',
  userId: 'e2e-ext-001',
}

export const ADMIN_USER = {
  name: '内部管理员',
  email: 'admin@e2e.test',
  role: 'admin',
  userId: 'e2e-admin-001',
}

export const STAFF_USER = {
  name: '内部员工',
  email: 'staff@e2e.test',
  role: 'mbe_staff',
  userId: 'e2e-staff-001',
}

// ── localStorage 键名（与 store 保持一致）──────────────────────────────────

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'
const ONBOARDING_KEY = 'mbe_onboarding_v1'
const SOLUTION_KEY = 'lastSolutionId'

// ── 注入认证 & 应用状态 ────────────────────────────────────────────────────

export interface InjectOptions {
  /** 用户对象（default: EXTERNAL_USER） */
  user?: typeof EXTERNAL_USER
  /** 是否已完成引导页（default: false） */
  onboardingDone?: boolean
  /** 已选方案 ID（不传则 hasPickedSolution = false） */
  solutionId?: string
}

/**
 * 在 page.goto() 之前调用：向 localStorage 注入 mock 会话，
 * 让 restoreAuth() / initFromStorage() 直接读到已登录状态。
 *
 * 注意：必须在第一次 page.goto() 之前调用，才能通过 addInitScript 生效。
 */
export async function injectSession(page: Page, opts: InjectOptions = {}): Promise<void> {
  const {
    user = EXTERNAL_USER,
    onboardingDone = false,
    solutionId,
  } = opts

  await page.addInitScript(
    ({ tokenKey, userKey, onboardingKey, solutionKey, userData, onboardingDone, solutionId }) => {
      localStorage.setItem(tokenKey, 'e2e-mock-token')
      localStorage.setItem(userKey, JSON.stringify(userData))
      if (onboardingDone) {
        localStorage.setItem(onboardingKey, '1')
      } else {
        localStorage.removeItem(onboardingKey)
      }
      if (solutionId) {
        localStorage.setItem(solutionKey, solutionId)
      } else {
        localStorage.removeItem(solutionKey)
      }
    },
    {
      tokenKey: TOKEN_KEY,
      userKey: USER_KEY,
      onboardingKey: ONBOARDING_KEY,
      solutionKey: SOLUTION_KEY,
      userData: user,
      onboardingDone,
      solutionId,
    },
  )
}

// ── API Mock 工具 ──────────────────────────────────────────────────────────

/** 拦截登录接口，返回成功响应 */
export async function mockLoginSuccess(page: Page, user: typeof EXTERNAL_USER): Promise<void> {
  await page.route('**/api/v1/users/login**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'e2e-mock-token',
        token_type: 'bearer',
        user: {
          id: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      }),
    })
  })
}

/** 拦截注册接口，返回成功响应（不需要邮件验证） */
export async function mockRegisterSuccess(page: Page, user: typeof EXTERNAL_USER): Promise<void> {
  await page.route('**/api/v1/users/register**', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'e2e-mock-token',
        user: {
          id: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        need_verify: false,
      }),
    })
  })
}

/** 拦截聊天流式接口，返回指定 HTTP 状态码 */
export async function mockChatEndpoint(
  page: Page,
  status: number,
  body: Record<string, unknown> = {},
): Promise<void> {
  await page.route('**/api/v1/**/chat**', async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ detail: body.detail ?? 'mock error', ...body }),
    })
  })
  // 同时拦截 SSE / stream 路径
  await page.route('**/chat/stream**', async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ detail: body.detail ?? 'mock error', ...body }),
    })
  })
}

/** 拦截所有未匹配的 API 请求，返回 200 空体，防止测试因网络报错 */
export async function silenceAllApiCalls(page: Page): Promise<void> {
  await page.route('**/api/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}

// ── 导航辅助 ───────────────────────────────────────────────────────────────

/** 等待 HashRouter 路由稳定到指定 hash 路径 */
export async function waitForHash(page: Page, hashPath: string, timeout = 10_000): Promise<void> {
  await page.waitForFunction(
    (hash) => window.location.hash === hash || window.location.hash.startsWith(hash + '/'),
    '#/' + hashPath.replace(/^\//, ''),
    { timeout },
  )
}
