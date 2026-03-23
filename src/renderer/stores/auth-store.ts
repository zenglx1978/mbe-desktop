import { create } from 'zustand'
import { API_BASE } from '@/lib/api-client'
import type { WindowWithElectron } from '@/types/api-responses'

interface UserInfo {
  name: string
  email: string
  role?: string
  userId?: string
  solutionRole?: string
  subAccountId?: string
}

interface AuthState {
  token: string | null
  user: UserInfo | null
  loading: boolean
  error: string | null

  /** 是否已登录 */
  isAuthenticated: () => boolean
  setToken: (t: string | null) => void
  setUser: (u: UserInfo | null) => void
  logout: () => void
  restoreAuth: () => Promise<void>

  /** 邮箱+密码登录 */
  login: (email: string, password: string) => Promise<boolean>
  /** 邮箱+密码注册 */
  register: (email: string, password: string, username?: string) => Promise<{ ok: boolean; needVerify?: boolean }>
  /** 重发邮箱确认邮件 */
  resendVerification: (email: string) => Promise<{ ok: boolean; message?: string }>
  /** 登录失败是否因为邮箱未验证 */
  emailUnverified: boolean
  /** 分享码（渠道追踪） */
  referralCode: string
  setReferralCode: (code: string) => void
  clearError: () => void
}

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

/** POST 用户认证 JSON 接口，统一解析 body（失败时仍返回已解析的 detail 等字段） */
type UserAuthPostResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; headers: Headers; data: Record<string, unknown> }

async function postUserAuthJson(
  path: string,
  body: Record<string, unknown>,
): Promise<UserAuthPostResult> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
  if (!resp.ok) {
    return { ok: false, status: resp.status, headers: resp.headers, data }
  }
  return { ok: true, data }
}

function persistSessionFromToken(get: () => AuthState, accessToken: string, user: UserInfo): void {
  get().setToken(accessToken)
  get().setUser(user)
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  loading: false,
  error: null,
  emailUnverified: false,
  referralCode: '',

  isAuthenticated: () => !!get().token,

  setReferralCode: (code: string) => set({ referralCode: code }),

  setToken: (t) => {
    set({ token: t })
    try {
      const api = (window as WindowWithElectron).electronAPI
      if (api?.session) {
        t ? api.session.set(TOKEN_KEY, t) : api.session.remove(TOKEN_KEY)
      } else {
        t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)
      }
    } catch {
      // Expected: Electron session API 不可用或抛错；降级到 localStorage
      t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)
    }
  },

  setUser: (u) => {
    set({ user: u })
    try {
      const api = (window as WindowWithElectron).electronAPI
      if (api?.session) {
        u ? api.session.set(USER_KEY, u) : api.session.remove(USER_KEY)
      } else {
        u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY)
      }
    } catch {
      // Expected: Electron session API 不可用或抛错；降级到 localStorage
      u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY)
    }
  },

  logout: () => {
    get().setToken(null)
    get().setUser(null)
  },

  clearError: () => set({ error: null, emailUnverified: false }),

  restoreAuth: async () => {
    try {
      const api = (window as WindowWithElectron).electronAPI
      if (api?.session) {
        const [token, userRaw] = await Promise.all([
          api.session.get(TOKEN_KEY),
          api.session.get(USER_KEY),
        ])
        if (token && typeof token === 'string') {
          set({ token, user: (userRaw as UserInfo) ?? null })
        }
      } else {
        const token = localStorage.getItem(TOKEN_KEY)
        const userStr = localStorage.getItem(USER_KEY)
        if (token) {
          let user: UserInfo | null = null
          if (userStr) {
            try { user = JSON.parse(userStr) } catch { /* Expected: auth_user 非合法 JSON，忽略 */ }
          }
          set({ token, user })
        }
      }
    } catch {
      // Expected: 浏览器环境无 session 或读存储失败；不阻断启动
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true, error: null, emailUnverified: false })
    try {
      const result = await postUserAuthJson('/api/v1/users/login', { email, password })
      if (!result.ok) {
        const unverified =
          result.status === 403 && result.headers.get('X-Email-Unverified') === 'true'
        set({
          loading: false,
          error: (result.data.detail as string) || `登录失败 (${result.status})`,
          emailUnverified: unverified,
        })
        return false
      }
      const data = result.data
      const user: UserInfo = {
        name: (data.username as string) || email.split('@')[0],
        email,
        role: data.role as string | undefined,
        userId: data.user_id as string | undefined,
      }
      persistSessionFromToken(get, data.access_token as string, user)
      set({ loading: false, error: null })
      return true
    } catch (err: any) {
      set({ loading: false, error: err?.message || '网络连接失败' })
      return false
    }
  },

  register: async (email: string, password: string, username?: string) => {
    set({ loading: true, error: null })
    try {
      const payload: Record<string, string> = {
        email,
        password,
        username: username || email.split('@')[0],
        source: 'desktop',
      }
      const ref = get().referralCode
      if (ref) payload.referral_code = ref

      const result = await postUserAuthJson('/api/v1/users/register', payload)
      if (!result.ok) {
        set({
          loading: false,
          error: (result.data.detail as string) || `注册失败 (${result.status})`,
        })
        return { ok: false }
      }
      const data = result.data
      if (data.access_token) {
        const user: UserInfo = {
          name: username || email.split('@')[0],
          email,
          role: (data.role as string) || 'user',
          userId: data.user_id as string | undefined,
        }
        persistSessionFromToken(get, data.access_token as string, user)
        set({ loading: false })
        return { ok: true }
      }
      set({ loading: false })
      return { ok: true, needVerify: true }
    } catch (err: any) {
      set({ loading: false, error: err?.message || '网络连接失败' })
      return { ok: false }
    }
  },

  resendVerification: async (email: string) => {
    set({ loading: true, error: null })
    try {
      const resp = await fetch(`${API_BASE}/api/v1/users/resend-verification?email=${encodeURIComponent(email)}`, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        set({ loading: false, error: data.detail || '发送失败' })
        return { ok: false }
      }
      set({ loading: false, emailUnverified: false })
      return { ok: true, message: data.message || '确认邮件已发送，请查收' }
    } catch (err: any) {
      set({ loading: false, error: err?.message || '网络连接失败' })
      return { ok: false }
    }
  },
}))
