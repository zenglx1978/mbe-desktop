import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { API_BASE, authFetch } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { useAppStore } from '@/stores/app-store'

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

export default function Settings() {
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const solutionId = useAppStore((s) => s.solutionId) || ''

  const [solutionUsers, setSolutionUsers] = useState<SolutionUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [dbStats, setDbStats] = useState<DbStats | null>(null)
  const [backupMsg, setBackupMsg] = useState<string | null>(null)
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null)
  const [pendingRestorePath, setPendingRestorePath] = useState<string | null>(null)
  const [restorePassword, setRestorePassword] = useState('')

  const loadSolutionUsers = useCallback(async () => {
    if (!solutionId || !token) return
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
    const api = (window as any).electronAPI
    if (!api?.db?.stats) return
    try {
      const stats = await api.db.stats()
      setDbStats(stats)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadDbStats()
  }, [loadDbStats])

  const handleBackupCreate = async () => {
    const api = (window as any).electronAPI
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
  }

  const handleBackupRestore = async () => {
    const api = (window as any).electronAPI
    if (!api?.db?.backup?.restore) return
    setRestoreMsg(null)
    setPendingRestorePath(null)
    try {
      const result = await api.db.backup.restore()
      if (result?.needPassword) {
        setPendingRestorePath(result.filePath)
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
  }

  const handleRestoreWithPassword = async () => {
    if (!pendingRestorePath || !restorePassword) return
    const api = (window as any).electronAPI
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
  }

  const handleClearCache = async () => {
    const api = (window as any).electronAPI
    if (!api?.db?.clearCache) return
    try {
      const count = await api.db.clearCache()
      setBackupMsg(`已清除 ${count} 条缓存`)
      loadDbStats()
    } catch (e: any) {
      setBackupMsg(`清除失败：${e.message}`)
    }
  }

  const handleOpenWebLogin = () => {
    const url = `${API_BASE}/user/login?redirect=mbe-desktop://auth`
    const api = (window as any).electronAPI
    if (api?.openExternal) {
      api.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  const handleOpenAdminSolutions = () => {
    const url = `${API_BASE}/admin/solutions`
    const api = (window as any).electronAPI
    if (api?.openExternal) {
      api.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
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
              <p className="text-destructive text-sm py-2">{userError}</p>
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

          {dbStats && (
            <div className="mb-4 space-y-1">
              <p className="text-muted-foreground text-xs">
                数据库大小：
                <span className="text-foreground font-medium">
                  {formatBytes(dbStats.dbSizeBytes)}
                </span>
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(dbStats.tables)
                  .filter(([, c]) => c > 0)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 8)
                  .map(([name, count]) => (
                    <span
                      key={name}
                      className="bg-muted/30 px-2 py-0.5 rounded text-muted-foreground"
                    >
                      {name}: {count}
                    </span>
                  ))}
              </div>
            </div>
          )}

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
                  <input
                    type="password"
                    value={restorePassword}
                    onChange={(e) => setRestorePassword(e.target.value)}
                    placeholder="输入备份密码"
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
      </div>
    </div>
  )
}
