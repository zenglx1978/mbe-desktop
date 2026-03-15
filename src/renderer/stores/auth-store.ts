import { create } from 'zustand'

interface AuthState {
  token: string
  refreshToken: string
  email: string
  name: string
  isLoggedIn: boolean
  login: (data: { token: string; email: string; name: string; refreshToken?: string }) => void
  logout: () => void
  restoreAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  token: '',
  refreshToken: '',
  email: '',
  name: '',
  isLoggedIn: false,

  login: (data) => {
    const { token, email, name, refreshToken } = data
    set({ token, email, name, refreshToken: refreshToken || '', isLoggedIn: true })

    const api = window.electronAPI
    if (api?.session) {
      api.session.set('auth_token', token)
      api.session.set('auth_email', email)
      api.session.set('auth_name', name)
      if (refreshToken) api.session.set('refreshToken', refreshToken)
    }
  },

  logout: () => {
    set({ token: '', refreshToken: '', email: '', name: '', isLoggedIn: false })

    const api = window.electronAPI
    if (api?.session) {
      api.session.remove('auth_token')
      api.session.remove('auth_email')
      api.session.remove('auth_name')
      api.session.remove('refreshToken')
    }
  },

  restoreAuth: async () => {
    try {
      const api = window.electronAPI
      if (!api?.session) return

      const [token, email, name, refreshToken] = await Promise.all([
        api.session.get('auth_token'),
        api.session.get('auth_email'),
        api.session.get('auth_name'),
        api.session.get('refreshToken'),
      ])

      if (token && typeof token === 'string') {
        set({
          token,
          email: (email as string) || '',
          name: (name as string) || '',
          refreshToken: (refreshToken as string) || '',
          isLoggedIn: true,
        })
      }
    } catch {
      // 首次启动或数据损坏，静默忽略
    }
  },
}))
