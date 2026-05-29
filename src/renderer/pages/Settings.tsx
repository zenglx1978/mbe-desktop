import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { API_BASE, authFetch, isElectron } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { useAppStore } from '@/stores/app-store'

function useIsInternalUser() {
  const user = useAuthStore((s) => s.user)
  return user?.role === 'admin' || user?.role === 'mbe_staff'
}

interface SolutionUser {
  user_id: string
  email: string
  solution_role: string
  is_admin: boolean
  granted_at: string
}

interface DbStats {
  tables: Record<string, number>
  dbSizeBytes: number
}

function formatBytes(b: number): string {
  if (b <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = b
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

/** 实验/敏感模块（默认关闭，需用户显式开启）— 与 main/module-flags.ts 一致 */
type ExperimentalKey = 'behaviorObserver' | 'patternRecognizer' | 'copilot'

interface ExperimentalModuleMeta {
  key: ExperimentalKey
  label: string
  desc: string
  /** sensitive=true 时开启需二次确认（涉及全局监控/系统级权限） */
  sensitive: boolean
  /** 开启前的知情确认文案 */
  consent?: string
}

const EXPERIMENTAL_MODULES: ExperimentalModuleMeta[] = [
  {
    key: 'behaviorObserver',
    label: '行为观察',
    desc: '记录应用切换与前台窗口标题（仅前 50 字），数据仅存本地，保留 90 天，用于效率统计。',
    sensitive: true,
    consent: '开启后将监控所有应用的前台窗口标题（每 5 秒采样一次）。数据仅保存在本机、不上传，保留 90 天，可随时关闭。确定开启？',
  },
  {
    key: 'patternRecognizer',
    label: '模式识别与自动化建议',
    desc: '基于行为数据识别高频重复流程，给出可 AI 化的工作流建议（依赖「行为观察」）。',
    sensitive: false,
  },
  {
    key: 'copilot',
    label: '全局副驾驶',
    desc: '注册全局快捷键（Ctrl+Shift+M/S/Space），支持读剪贴板、截屏交给 AI 分析。',
    sensitive: true,
    consent: '开启后将注册全局系统快捷键，并在你触发时读取剪贴板/截屏内容交给 AI 分析。可随时关闭。确定开启？',
  },
]

export default function Settings() {
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const solutionId = useAppStore((s) => s.solutionId) || ''
  const isInternal = useIsInternalUser()

  const [solutionUsers, setSolutionUsers] = useState<SolutionUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [dbStats, setDbStats] = useState<DbStats | null>(null)
  const [loadingDbStats, setLoadingDbStats] = useState(true)
  const [backupMsg, setBackupMsg] = useState<string | null>(null)
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null)
  const [pendingRestorePath, setPendingRestorePath] = useState<string | null>(null)
  const [restorePassword, setRestorePassword] = useState('')

  const [moduleFlags, setModuleFlags] = useState<Record<string, boolean>>({})

  const loadModuleFlags = useCallback(async () => {
    const api = window.electronAPI
    if (!api?.moduleFlags?.getAll) return
    try {
      const flags = await api.moduleFlags.getAll()
      setModuleFlags(flags ?? {})
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadModuleFlags()
  }, [loadModuleFlags])

  const handleToggleModule = useCallback(async (meta: ExperimentalModuleMeta) => {
    const api = window.electronAPI
    if (!api) return
    const next = !moduleFlags[meta.key]
    // 敏感模块开启前需知情确认
    if (next && meta.sensitive && meta.consent && !window.confirm(meta.consent)) return
    try {
      // 运行期启停（主进程内部会持久化 flag，重启后保持）
      if (meta.key === 'behaviorObserver') {
        await api.observer.setEnabled(next)
      } else if (meta.key === 'patternRecognizer') {
        await api.pattern.setEnabled(next)
      } else if (meta.key === 'copilot') {
        await (api as unknown as { copilot?: { setEnabled: (e: boolean) => Promise<unknown> } })
          .copilot?.setEnabled(next)
      }
      setModuleFlags((prev) => ({ ...prev, [meta.key]: next }))
    } catch { /* ignore */ }
  }, [moduleFlags])

  const loadSolutionUsers = useCallback(async () => {
    if (!solutionId || !token || !isElectron()) return
    setLoadingUsers(true)
    setUserError(null)
    try {
      const resp = await authFetch(
        `${API_BASE}/admin/api/admin/solutions/${solutionId}/users?limit=50`,
      )
      if (!resp.ok) {
        if (resp.status === 403) {
          setIsAdmin(false)
          return
        }
        throw new Error(`HTTP ${resp.status}`)
      }
      const data = await resp.json()
      if (data.success) {
        setIsAdmin(true)
        setSolutionUsers(data.users || [])
      } else {
        setUserError(data.error || '加载失败')
      }
    } catch (e: any) {
      setUserError(e.message)
    } finally {
      setLoadingUsers(false)
    }
  }, [solutionId, token])

  useEffect(() => {
    loadSolutionUsers()
  }, [loadSolutionUsers])

  const loadDbStats = useCallback(async () => {
    const api = window.electronAPI
    if (!api?.db?.stats) {
      setLoadingDbStats(false)
      return
    }
    try {
      const stats = await api.db.stats()
      setDbStats(stats ?? null)
    } catch { /* ignore */ } finally {
      setLoadingDbStats(false)
    }
  }, [])

  useEffect(() => {
    loadDbStats()
  }, [loadDbStats])

  const handleOpenWebLogin = useCallback(() => {
    const url = `${API_BASE}/user/login?redirect=mbe-desktop://auth`
    const api = window.electronAPI
    if (api?.openExternal) {
      api.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }, [])

  const handleOpenAdminSolutions = useCallback(() => {
    const url = `${API_BASE}/admin/solutions`
    const api = window.electronAPI
    if (api?.openExternal) {
      api.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }, [])

  const handleBackupCreate = useCallback(async () => {
    const api = window.electronAPI
    if (!api?.db?.backup?.create) return
    setBackupMsg(null)
    try {
      const result = await api.db.backup.create()
      if (result?.ok) {
        setBackupMsg(`备份成功！\n文件：${result.path}\n密码：${result.password}\n请妥善保管密码，恢复时需要。`)
      } else {
        setBackupMsg('已取消')
      }
    } catch (e: any) {
      setBackupMsg(`备份失败：${e.message}`)
    }
  }, [])

  const handleBackupRestore = useCallback(async () => {
    const api = window.electronAPI
    if (!api?.db?.backup?.restore) return
    setRestoreMsg(null)
    setPendingRestorePath(null)
    try {
      const result = await api.db.backup.restore()
      if (result?.needPassword) {
        setPendingRestorePath(result.filePath ?? null)
        setRestoreMsg('请输入备份时生成的密码：')
      } else if (result?.ok) {
        setRestoreMsg(`恢复成功！已恢复 ${result.tables?.length || 0} 张表。`)
        loadDbStats()
      } else {
        setRestoreMsg(result?.error || '已取消')
      }
    } catch (e: any) {
      setRestoreMsg(`恢复失败：${e.message}`)
    }
  }, [loadDbStats])

  const handleRestoreWithPassword = useCallback(async () => {
    if (!pendingRestorePath || !restorePassword) return
    const api = window.electronAPI
    if (!api?.db?.backup?.restoreWithPassword) return
    try {
      const result = await api.db.backup.restoreWithPassword(pendingRestorePath, restorePassword)
      if (result?.ok) {
        setRestoreMsg('恢复成功！')
        setPendingRestorePath(null)
        setRestorePassword('')
        loadDbStats()
      } else {
        setRestoreMsg(result?.error || '恢复失败')
      }
    } catch (e: any) {
      setRestoreMsg(`恢复失败：${e.message}`)
    }
  }, [pendingRestorePath, restorePassword, loadDbStats])

  const handleClearCache = useCallback(async () => {
    const api = window.electronAPI
    if (!api?.db?.clearCache) return
    try {
      const count = await api.db.clearCache()
      setBackupMsg(`已清除 ${count} 条缓存`)
      loadDbStats()
    } catch (e: any) {
      setBackupMsg(`清除失败：${e.message}`)
    }
  }, [loadDbStats])

  const goBack = useCallback(() => navigate(-1), [navigate])

  const navigateKbGraph = useCallback(() => navigate('/kb-graph'), [navigate])
  const navigateHeatmaps = useCallback(() => navigate('/analytics/heatmaps'), [navigate])
  const navigateDeepmind = useCallback(() => navigate('/deepmind'), [navigate])

  const dbTableChips = useMemo(() => {
    if (!dbStats) return [] as { name: string; count: number }[]
    return Object.entries(dbStats.tables)
      .filter(([, c]) => c > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))
  }, [dbStats])

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            type="button"
            onClick={goBack}
            aria-label="返回上一页"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ← 返回
          </button>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">设置</h1>
        <p className="text-muted-foreground text-sm mb-6">账户与方案设置</p>

        {/* 账户 */}
        <section className="rounded-lg border border-border bg-card p-4 mb-4">
          <h2 className="text-sm font-medium text-foreground mb-2">账户</h2>
          <p className="text-muted-foreground text-sm mb-3">
            在浏览器中登录或管理您的 MBE 账户，支持 Google 登录、找回密码等。
          </p>
          <button
            type="button"
            onClick={handleOpenWebLogin}
            className="text-sm text-primary hover:underline"
          >
            在浏览器中登录 / 管理账户 →
          </button>
        </section>

        {/* 方案用户管理 */}
        {solutionId && token && (
          <section className="rounded-lg border border-border bg-card p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-foreground">
                方案用户管理
              </h2>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleOpenAdminSolutions}
                  className="text-xs text-primary hover:underline"
                >
                  在管理后台管理 →
                </button>
              )}
            </div>
            <p className="text-muted-foreground text-xs mb-3">
              当前方案：
              <span className="text-foreground font-medium">{solutionId}</span>
            </p>

            {loadingUsers && (
              <p className="text-muted-foreground text-sm py-4 text-center">
                加载中...
              </p>
            )}

            {userError && (
              <p className="text-destructive text-sm py-2" role="alert">{userError}</p>
            )}

            {!loadingUsers && !isAdmin && !userError && (
              <p className="text-muted-foreground text-sm py-2">
                您不是此方案的管理员，无法查看用户列表。
              </p>
            )}

            {!loadingUsers && isAdmin && solutionUsers.length === 0 && (
              <p className="text-muted-foreground text-sm py-2">
                暂无用户。可在管理后台添加。
              </p>
            )}

            {!loadingUsers && isAdmin && solutionUsers.length > 0 && (
              <div className="space-y-2">
                {solutionUsers.map((u) => (
                  <div
                    key={u.user_id}
                    className="flex items-center justify-between text-sm py-2 px-3 rounded bg-muted/30"
                  >
                    <div>
                      <span className="text-foreground">
                        {u.email || u.user_id}
                      </span>
                      {u.is_admin && (
                        <span className="ml-2 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                          管理员
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {u.solution_role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 数据管理 */}
        <section className="rounded-lg border border-border bg-card p-4 mb-4">
          <h2 className="text-sm font-medium text-foreground mb-3">数据管理</h2>

          {loadingDbStats ? (
            <div className="mb-4 space-y-2 animate-pulse">
              <div className="h-3 w-32 bg-muted/40 rounded" />
              <div className="flex gap-2">
                <div className="h-5 w-20 bg-muted/30 rounded" />
                <div className="h-5 w-16 bg-muted/30 rounded" />
                <div className="h-5 w-24 bg-muted/30 rounded" />
              </div>
            </div>
          ) : dbStats ? (
            <div className="mb-4 space-y-1">
              <p className="text-muted-foreground text-xs">
                数据库大小：
                <span className="text-foreground font-medium">
                  {formatBytes(dbStats.dbSizeBytes)}
                </span>
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {dbTableChips.map(({ name, count }) => (
                  <span
                    key={name}
                    className="bg-muted/30 px-2 py-0.5 rounded text-muted-foreground"
                  >
                    {name}: {count}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={handleBackupCreate}
              className="text-xs px-3 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary/10"
            >
              备份本地数据
            </button>
            <button
              type="button"
              onClick={handleBackupRestore}
              className="text-xs px-3 py-1.5 rounded border border-border text-foreground hover:bg-muted/30"
            >
              恢复本地数据
            </button>
            <button
              type="button"
              onClick={handleClearCache}
              className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:bg-muted/30"
            >
              清除缓存
            </button>
          </div>

          {backupMsg && (
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/20 p-2 rounded mb-2">
              {backupMsg}
            </pre>
          )}

          {restoreMsg && (
            <div className="mb-2">
              <p className="text-xs text-muted-foreground mb-1">{restoreMsg}</p>
              {pendingRestorePath && (
                <div className="flex gap-2 items-center">
                  <label htmlFor="restore-pwd" className="sr-only">备份密码</label>
                  <input
                    id="restore-pwd"
                    type="password"
                    value={restorePassword}
                    onChange={(e) => setRestorePassword(e.target.value)}
                    placeholder="输入备份密码"
                    aria-describedby="restore-hint"
                    className="text-xs px-2 py-1 rounded border border-border bg-background text-foreground w-48"
                  />
                  <button
                    type="button"
                    onClick={handleRestoreWithPassword}
                    disabled={!restorePassword}
                    className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
                  >
                    确认恢复
                  </button>
                </div>
              )}
            </div>
          )}

          <p className="text-muted-foreground text-[11px]">
            备份会导出加密的 .mbebackup 文件，包含对话历史、计算记录和任务数据。
            系统每 7 天会自动备份到 文档/MBE Desktop/backups/ 目录。
          </p>
        </section>

        {/* 隐私与实验功能 — 默认关闭，需用户显式开启 */}
        {isElectron() && (
          <section className="rounded-lg border border-border bg-card p-4 mb-4">
            <h2 className="text-sm font-medium text-foreground mb-1">隐私与实验功能</h2>
            <p className="text-muted-foreground text-xs mb-3">
              以下功能默认关闭，开启后才会运行。数据均仅保存在本机、不上传，可随时关闭。
            </p>
            <div className="space-y-2">
              {EXPERIMENTAL_MODULES.map((meta) => {
                const enabled = !!moduleFlags[meta.key]
                return (
                  <div
                    key={meta.key}
                    className="flex items-start justify-between gap-3 py-2 px-3 rounded bg-muted/20"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground">{meta.label}</span>
                        {meta.sensitive && (
                          <span className="text-[10px] bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded">
                            敏感
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-[11px] mt-0.5">{meta.desc}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${enabled ? '关闭' : '开启'}${meta.label}`}
                      onClick={() => handleToggleModule(meta)}
                      className={`shrink-0 mt-0.5 relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          enabled ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* 开发者工具 — 仅对内部员工（admin / mbe_staff）可见 */}
        {isInternal && (
          <section className="rounded-lg border border-border bg-card p-4 mb-4">
            <h2 className="text-sm font-medium text-foreground mb-3">开发者工具</h2>
            <div className="space-y-2">
              <button
                type="button"
                onClick={navigateKbGraph}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-border/50 hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground"
              >
                <span className="text-base">🧠</span>
                知识图谱可视化
                <span className="text-[11px] text-muted-foreground/50 ml-auto">11 Agent · 577 文件</span>
              </button>
              <button
                type="button"
                onClick={navigateHeatmaps}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-border/50 hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground"
              >
                <span className="text-base">🔥</span>
                数据热力图分析
                <span className="text-[11px] text-muted-foreground/50 ml-auto">法律风险 · 投资瓶颈 · 产业链</span>
              </button>
              <button
                type="button"
                onClick={navigateDeepmind}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-border/50 hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground"
              >
                <span className="text-base">🔬</span>
                实验洞察仪表盘
                <span className="text-[11px] text-muted-foreground/50 ml-auto">退火 · 波动 · 策略 · 暖启动</span>
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
