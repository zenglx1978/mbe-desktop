import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth-store'

type Tab = 'account' | 'appearance' | 'data' | 'security' | 'about'

export default function Settings() {
  const navigate = useNavigate()
  const { email, name, isLoggedIn, logout } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('account')
  const [appInfo, setAppInfo] = useState<{
    version: string; name: string; platform: string; arch: string; isDev: boolean
    paths: { userData: string; documents: string; dataDir: string; temp: string }
  } | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark')
  const [migrationStatus, setMigrationStatus] = useState<{ migrated: string[]; hasMigrated: boolean }>({ migrated: [], hasMigrated: false })
  const [updateStatus, setUpdateStatus] = useState<string>('')

  const loadInfo = useCallback(async () => {
    const api = window.electronAPI
    if (!api) return
    const [info, mig] = await Promise.all([
      api.getAppInfo(),
      api.migration.status(),
    ])
    setAppInfo(info)
    setMigrationStatus(mig)

    const savedTheme = await api.session.get('theme')
    if (savedTheme) setTheme(savedTheme as 'dark' | 'light' | 'system')
  }, [])

  useEffect(() => { loadInfo() }, [loadInfo])

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    const unsub = api.updater.onStatus((data: any) => {
      if (data.status === 'available') setUpdateStatus(`发现新版本 v${data.version}`)
      else if (data.status === 'installing') setUpdateStatus('正在安装更新...')
      else setUpdateStatus('')
    })
    return unsub
  }, [])

  const changeTheme = async (t: 'dark' | 'light' | 'system') => {
    setTheme(t)
    window.electronAPI?.session.set('theme', t)
    // 通知主题切换（当前仅支持 dark）
    document.documentElement.classList.toggle('dark', t !== 'light')
  }

  const checkUpdate = () => {
    setUpdateStatus('检查中...')
    window.electronAPI?.updater.check()
  }

  const openDataDir = () => {
    if (appInfo?.paths.dataDir) window.electronAPI?.openPath(appInfo.paths.dataDir)
  }

  const [backupStatus, setBackupStatus] = useState('')
  const [restoreStatus, setRestoreStatus] = useState('')

  const handleBackup = async () => {
    setBackupStatus('正在创建备份...')
    try {
      const api = window.electronAPI
      if (!api?.db?.backup) { setBackupStatus('备份功能暂不可用'); return }
      const result = await api.db.backup.create()
      setBackupStatus(result?.path ? `备份已保存: ${result.path}` : '备份完成')
    } catch (e: any) {
      setBackupStatus(`备份失败: ${e.message || '未知错误'}`)
    }
  }

  const handleRestore = async () => {
    setRestoreStatus('正在选择备份文件...')
    try {
      const api = window.electronAPI
      if (!api?.db?.backup) { setRestoreStatus('恢复功能暂不可用'); return }
      const result = await api.db.backup.restore()
      setRestoreStatus(result?.ok ? '恢复成功，请重启应用' : '已取消')
    } catch (e: any) {
      setRestoreStatus(`恢复失败: ${e.message || '未知错误'}`)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'account', label: '账号' },
    { id: 'appearance', label: '外观' },
    { id: 'data', label: '数据' },
    { id: 'security', label: '数据安全' },
    { id: 'about', label: '关于' },
  ]

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto">
        {/* 返回 + 标题 */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← 返回
          </button>
          <h1 className="text-2xl font-bold">设置</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-border">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 账号 */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            {isLoggedIn ? (
              <div className="p-6 rounded-lg border border-border space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold text-primary">
                    {(name || email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{name || '用户'}</p>
                    <p className="text-sm text-muted-foreground">{email}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-border">
                  <button
                    onClick={logout}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    退出登录
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-lg border border-border text-center space-y-3">
                <p className="text-muted-foreground">未登录</p>
                <p className="text-sm text-muted-foreground">
                  登录后可享受云端同步、在线 AI 专家等完整功能
                </p>
                <button
                  onClick={() => window.electronAPI?.openExternal('https://mbe.hi-maker.com/user/login?redirect=mbe-desktop://auth')}
                  className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  前往登录
                </button>
              </div>
            )}
          </div>
        )}

        {/* 外观 */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-3">主题</h3>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { id: 'dark' as const, label: '深色', desc: '默认深色主题' },
                  { id: 'light' as const, label: '浅色', desc: '浅色主题（开发中）' },
                  { id: 'system' as const, label: '跟随系统', desc: '自动切换' },
                ]).map(t => (
                  <button
                    key={t.id}
                    onClick={() => changeTheme(t.id)}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      theme === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 数据 */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            <div className="p-6 rounded-lg border border-border space-y-4">
              <h3 className="font-medium">本地数据</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>数据目录：{appInfo?.paths.dataDir || '—'}</p>
                <p>包含：SQLite 数据库、Session、上传文档</p>
              </div>
              <button
                onClick={openDataDir}
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                打开数据目录
              </button>
            </div>

            <div className="p-6 rounded-lg border border-border space-y-4">
              <h3 className="font-medium">数据迁移</h3>
              {migrationStatus.hasMigrated ? (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>已迁移：{migrationStatus.migrated.join(', ')}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">尚未从旧版 Agent 迁移数据</p>
              )}
              <button
                onClick={() => navigate('/migration')}
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                打开迁移向导
              </button>
            </div>

            <div className="p-6 rounded-lg border border-border space-y-4">
              <h3 className="font-medium">备份与恢复</h3>
              <p className="text-sm text-muted-foreground">
                将本地对话历史、文档元数据导出为加密备份文件（.mbebackup），或从备份恢复
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleBackup}
                  className="px-3 py-1.5 rounded-lg text-sm border border-border hover:border-primary/40 transition-colors"
                >
                  导出备份
                </button>
                <button
                  onClick={handleRestore}
                  className="px-3 py-1.5 rounded-lg text-sm border border-border hover:border-primary/40 transition-colors"
                >
                  导入备份
                </button>
              </div>
              {backupStatus && <p className="text-xs text-muted-foreground">{backupStatus}</p>}
              {restoreStatus && <p className="text-xs text-muted-foreground">{restoreStatus}</p>}
            </div>
          </div>
        )}

        {/* 数据安全 */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="p-6 rounded-lg border border-border space-y-4">
              <h3 className="font-medium">数据存储策略</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>MBE Desktop 遵循「数据留本地」原则：</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>对话历史、文档元数据存储在本地 SQLite 数据库</li>
                  <li>Token 使用 Electron safeStorage 加密存储</li>
                  <li>备份文件使用 AES-256 加密，需密码才能恢复</li>
                  <li>AI 对话仅在线时发送到 Agent 后端处理，不留存于服务器</li>
                  <li>断网时仍可使用本地计算功能（税费、诉讼费、临床评分等）</li>
                </ul>
              </div>
            </div>

            <div className="p-6 rounded-lg border border-border space-y-4">
              <h3 className="font-medium">加密与安全</h3>
              <div className="text-sm space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Token 加密存储（Electron safeStorage）</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">传输加密（TLS 1.3）</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">备份加密（AES-256）</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">本地数据隔离（每用户独立数据库）</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-lg border border-border space-y-4">
              <h3 className="font-medium">隐私声明</h3>
              <p className="text-sm text-muted-foreground">
                MBE 不会将用户数据用于模型训练。受监管行业的数据处理遵循《个人信息保护法》。
              </p>
              <button
                onClick={() => window.electronAPI?.openExternal('https://mbe.hi-maker.com/privacy')}
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                查看完整隐私政策 →
              </button>
            </div>
          </div>
        )}

        {/* 关于 */}
        {activeTab === 'about' && (
          <div className="space-y-6">
            <div className="p-6 rounded-lg border border-border space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                  M
                </div>
                <div>
                  <h3 className="text-lg font-bold">MBE Desktop</h3>
                  <p className="text-sm text-muted-foreground">AI 专业服务 · 统一桌面端</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">版本：</span>
                  <span>{appInfo?.version || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">平台：</span>
                  <span>{appInfo?.platform} ({appInfo?.arch})</span>
                </div>
                <div>
                  <span className="text-muted-foreground">环境：</span>
                  <span>{appInfo?.isDev ? '开发' : '生产'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Electron：</span>
                  <span>28.x</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-lg border border-border space-y-3">
              <h3 className="font-medium">检查更新</h3>
              {updateStatus ? (
                <p className="text-sm text-primary">{updateStatus}</p>
              ) : (
                <p className="text-sm text-muted-foreground">当前已是最新版本</p>
              )}
              <button
                onClick={checkUpdate}
                className="px-4 py-2 rounded-lg text-sm border border-border hover:border-primary/40 transition-colors"
              >
                检查更新
              </button>
            </div>

            <div className="text-center text-xs text-muted-foreground pt-4 space-y-1">
              <p>© {new Date().getFullYear()} HiMaker · Mises Behavior Engine</p>
              <p>
                <button onClick={() => window.electronAPI?.openExternal('https://mbe.hi-maker.com')} className="text-primary hover:underline">
                  官网
                </button>
                {' · '}
                <button onClick={() => window.electronAPI?.openExternal('https://mbe.hi-maker.com/privacy')} className="text-primary hover:underline">
                  隐私政策
                </button>
                {' · '}
                <button onClick={() => window.electronAPI?.openExternal('https://mbe.hi-maker.com/terms')} className="text-primary hover:underline">
                  服务条款
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
