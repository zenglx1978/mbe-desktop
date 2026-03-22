import { useState, useCallback, useEffect, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import { API_BASE } from '@/lib/api-client'

type AuthMode = 'login' | 'register'

const GOOGLE_SVG = (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
)

export default function AuthPage() {
  const navigate = useNavigate()
  const { login, register, loading, error, clearError, setToken, setUser, emailUnverified, resendVerification, referralCode, setReferralCode } = useAuthStore()
  const [searchParams] = useSearchParams()

  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showRefInput, setShowRefInput] = useState(false)

  // 从 URL 参数读取分享码（Web: ?ref=xxx 或 Electron 深链）
  useEffect(() => {
    const refFromUrl = searchParams.get('ref')
    if (refFromUrl) {
      setReferralCode(refFromUrl)
      setMode('register')
    }
  }, [searchParams, setReferralCode])

  // Electron 深链传入分享码
  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.onReferralCode) return
    const unsubscribe = api.onReferralCode((data: { code: string }) => {
      if (data.code) {
        setReferralCode(data.code)
        setMode('register')
      }
    })
    return unsubscribe
  }, [setReferralCode])

  // 监听 Desktop 深链 OAuth 回调
  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.onAuthCallback) return

    const unsubscribe = api.onAuthCallback((data: { token: string; email: string; name: string }) => {
      if (data.token) {
        setToken(data.token)
        setUser({ name: data.name || data.email?.split('@')[0] || '', email: data.email || '' })
        setGoogleLoading(false)
        navigate('/pick', { replace: true })
      }
    })

    return unsubscribe
  }, [setToken, setUser, navigate])

  const switchMode = useCallback((m: AuthMode) => {
    setMode(m)
    clearError()
    setSuccessMsg('')
  }, [clearError])

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    setSuccessMsg('')
    if (!email.trim() || !password.trim()) return

    if (mode === 'login') {
      const ok = await login(email.trim(), password.trim())
      if (ok) navigate('/pick', { replace: true })
    } else {
      const result = await register(email.trim(), password.trim(), username.trim() || undefined)
      if (result.ok) {
        if (result.needVerify) {
          setSuccessMsg('注册成功！请查收邮箱完成验证，然后登录。')
          setMode('login')
        } else {
          navigate('/pick', { replace: true })
        }
      }
    }
  }, [mode, email, password, username, login, register, navigate])

  const handleGoogleLogin = useCallback(() => {
    setGoogleLoading(true)
    clearError()
    const oauthUrl = `${API_BASE}/api/v1/auth/oauth/google`
    const api = (window as any).electronAPI
    if (api?.openExternal) {
      api.openExternal(oauthUrl)
    } else {
      window.open(oauthUrl, '_blank')
    }
    // 30 秒后自动取消等待状态
    setTimeout(() => setGoogleLoading(false), 30000)
  }, [clearError])

  const handleForgotPassword = useCallback(() => {
    const url = `${API_BASE}/user/forgot-password`
    const api = (window as any).electronAPI
    if (api?.openExternal) {
      api.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }, [])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl font-bold tracking-tight text-foreground">MBE</div>
          <p className="text-muted-foreground text-sm mt-1">AI 专业服务 · 智能派遣</p>
        </div>

        {/* Tab */}
        <div className="flex mb-6 bg-secondary/50 rounded-lg p-1" role="tablist" aria-label="登录或注册">
          <button
            role="tab"
            aria-selected={mode === 'login'}
            aria-controls="auth-panel"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'login'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            登录
          </button>
          <button
            role="tab"
            aria-selected={mode === 'register'}
            aria-controls="auth-panel"
            onClick={() => switchMode('register')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'register'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            注册
          </button>
        </div>

        {/* Google Login */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 text-sm font-medium
            bg-white text-gray-700 border border-gray-300 rounded-lg
            hover:bg-gray-50 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {GOOGLE_SVG}
          {googleLoading ? '等待 Google 授权...' : '使用 Google 账号登录'}
        </button>

        {googleLoading && (
          <div className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 mb-4">
            已在浏览器中打开 Google 登录页面，完成后将自动返回。
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">或</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Form */}
        <form id="auth-panel" role="tabpanel" onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  用户名（可选）
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="选填，默认使用邮箱前缀"
                  autoComplete="username"
                  className="w-full px-3 py-2.5 text-sm bg-card border border-border rounded-lg
                    text-foreground placeholder:text-muted-foreground/50
                    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50
                    transition-colors"
                />
              </div>

              {/* 分享码 */}
              {referralCode ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <span className="text-xs text-emerald-400">分享码：</span>
                  <span className="text-xs font-mono text-emerald-300">{referralCode}</span>
                  <button
                    type="button"
                    onClick={() => setReferralCode('')}
                    className="ml-auto text-xs text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : showRefInput ? (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    分享码（可选）
                  </label>
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.trim())}
                    placeholder="输入朋友分享的推荐码"
                    className="w-full px-3 py-2.5 text-sm bg-card border border-border rounded-lg
                      text-foreground placeholder:text-muted-foreground/50
                      focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50
                      transition-colors"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowRefInput(true)}
                  className="text-xs text-primary/60 hover:text-primary transition-colors"
                >
                  有分享码？
                </button>
              )}
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              邮箱
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
              className="w-full px-3 py-2.5 text-sm bg-card border border-border rounded-lg
                text-foreground placeholder:text-muted-foreground/50
                focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50
                transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                密码
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-primary/70 hover:text-primary transition-colors"
                >
                  忘记密码？
                </button>
              )}
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '至少 6 位' : '输入密码'}
              minLength={mode === 'register' ? 6 : undefined}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              className="w-full px-3 py-2.5 text-sm bg-card border border-border rounded-lg
                text-foreground placeholder:text-muted-foreground/50
                focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50
                transition-colors"
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2" role="alert">
              <p>{error}</p>
              {emailUnverified && email && (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await resendVerification(email.trim())
                    if (res.ok) setSuccessMsg(res.message || '确认邮件已发送，请查收')
                  }}
                  disabled={loading}
                  className="mt-2 text-xs font-medium text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors disabled:opacity-50"
                >
                  重发确认邮件
                </button>
              )}
            </div>
          )}

          {successMsg && (
            <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2" role="status">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-sm font-medium rounded-lg transition-colors
              bg-primary text-primary-foreground hover:bg-primary/90
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? (mode === 'login' ? '登录中...' : '注册中...')
              : (mode === 'login' ? '登录' : '注册')
            }
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          登录即表示同意{' '}
          <a href="https://mbe.hi-maker.com/terms" target="_blank" rel="noreferrer"
            className="text-primary/80 hover:text-primary underline-offset-2 hover:underline">
            服务条款
          </a>{' '}和{' '}
          <a href="https://mbe.hi-maker.com/privacy" target="_blank" rel="noreferrer"
            className="text-primary/80 hover:text-primary underline-offset-2 hover:underline">
            隐私政策
          </a>
        </p>
      </div>
    </div>
  )
}
