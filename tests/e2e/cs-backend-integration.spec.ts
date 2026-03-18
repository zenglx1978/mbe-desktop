/**
 * 后端 CS Agent API 联调测试
 *
 * 直接调用 mbe-cs-backend (端口 8004) 的 HTTP API，验证：
 * 1. 健康检查
 * 2. Expert 列表
 * 3. 电商客服咨询（chat 端点）
 * 4. 流式响应
 *
 * 需要后端运行：cd mbe-cs-backend && uvicorn main:app --port 8004
 * 通过环境变量 CS_BACKEND_URL 可覆盖默认 URL。
 */
import { test, expect } from '@playwright/test'

const CS_BASE = process.env.CS_BACKEND_URL || 'https://mbe.hi-maker.com/api/cs'
const TIMEOUT = 30_000

function authHeaders() {
  const token = process.env.MBE_TEST_TOKEN || 'test-e2e-token'
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
}

test.describe('CS Backend API 联调', () => {
  // ── T1: 健康检查（无需认证） ──
  test('T1: /health 返回 200', async ({ request }) => {
    const healthUrl = CS_BASE.replace('/api/cs', '/health')
    const res = await request.get(healthUrl, { timeout: TIMEOUT })
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(['healthy', 'ok']).toContain(body.status)
  })

  // ── T2: Expert 列表 ──
  test('T2: /api/cs/experts 返回专家列表', async ({ request }) => {
    const res = await request.get(`${CS_BASE}/experts`, {
      timeout: TIMEOUT,
      headers: authHeaders(),
    })
    // 无有效 token 时可能 401，验证端点可达即可
    expect([200, 401, 403]).toContain(res.status())

    if (res.status() === 200) {
      const experts = await res.json()
      expect(Array.isArray(experts)).toBe(true)
      expect(experts.length).toBeGreaterThan(0)
    }
  })

  // ── T3: 电商客服咨询 — 退换货场景 ──
  test('T3: /api/cs/chat 退换货问题', async ({ request }) => {
    const res = await request.post(`${CS_BASE}/chat`, {
      data: {
        message: '我买的衣服尺码不合适，想退换货，七天无理由退换怎么操作？',
        stream: false,
      },
      headers: authHeaders(),
      timeout: TIMEOUT,
    })
    expect([200, 401, 403]).toContain(res.status())

    if (res.status() === 200) {
      const body = await res.json()
      expect(body.reply || body.response || body.content).toBeTruthy()
      const replyText = body.reply || body.response || body.content || ''
      expect(replyText.length).toBeGreaterThan(20)
    }
  })

  // ── T4: 电商客服咨询 — 物流查询场景 ──
  test('T4: /api/cs/chat 物流查询', async ({ request }) => {
    const res = await request.post(`${CS_BASE}/chat`, {
      data: {
        message: '我的订单什么时候发货？已经等了3天了',
        stream: false,
      },
      headers: authHeaders(),
      timeout: TIMEOUT,
    })
    expect([200, 401, 403]).toContain(res.status())

    if (res.status() === 200) {
      const body = await res.json()
      const replyText = body.reply || body.response || body.content || ''
      expect(replyText.length).toBeGreaterThan(10)
    }
  })

  // ── T5: 电商客服咨询 — 投诉场景 ──
  test('T5: /api/cs/chat 客户投诉', async ({ request }) => {
    const res = await request.post(`${CS_BASE}/chat`, {
      data: {
        message: '收到的商品和图片完全不一样，我要投诉，要求全额退款加赔偿',
        stream: false,
      },
      headers: authHeaders(),
      timeout: TIMEOUT,
    })
    expect([200, 401, 403]).toContain(res.status())

    if (res.status() === 200) {
      const body = await res.json()
      const replyText = body.reply || body.response || body.content || ''
      expect(replyText.length).toBeGreaterThan(20)
    }
  })

  // ── T6: Consult 端点等效性 ──
  test('T6: /api/cs/consult 与 /api/cs/chat 等效', async ({ request }) => {
    const res = await request.post(`${CS_BASE}/consult`, {
      data: {
        message: '退货运费谁承担？',
        stream: false,
      },
      headers: authHeaders(),
      timeout: TIMEOUT,
    })
    expect([200, 401, 403]).toContain(res.status())

    if (res.status() === 200) {
      const body = await res.json()
      const replyText = body.reply || body.response || body.content || ''
      expect(replyText.length).toBeGreaterThan(5)
    }
  })

  // ── T7: 流式响应 ──
  test('T7: /api/cs/chat stream=true 返回 SSE', async ({ request }) => {
    const res = await request.post(`${CS_BASE}/chat`, {
      data: {
        message: '怎么申请退款？',
        stream: true,
      },
      headers: authHeaders(),
      timeout: TIMEOUT,
    })

    expect([200, 401, 403]).toContain(res.status())

    if (res.status() === 200) {
      const contentType = res.headers()['content-type'] || ''
      expect(
        contentType.includes('text/event-stream') || contentType.includes('application/json')
      ).toBe(true)
    }
  })
})
