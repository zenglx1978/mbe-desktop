import { Suspense, lazy, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAppStore, restoreSolution } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'

const SolutionPicker = lazy(() => import('@/pages/SolutionPicker'))
const Workspace = lazy(() => import('@/pages/Workspace'))
const MigrationWizard = lazy(() => import('@/pages/MigrationWizard'))
const Settings = lazy(() => import('@/pages/Settings'))

declare const __APP_VERSION__: string

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center space-y-4">
        <div className="text-4xl font-bold tracking-tight">MBE Desktop</div>
        <p className="text-muted-foreground text-sm">AI 专业服务 · 正在启动...</p>
        <div className="w-48 h-1 bg-secondary rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()
  const { hasPickedSolution, pickSolution } = useAppStore()
  const { restoreAuth } = useAuthStore()

  useEffect(() => {
    async function init() {
      await restoreAuth()

      // 首次启动：检测旧版 Agent 数据，有的话引导迁移
      const api = window.electronAPI
      if (api) {
        const migStatus = await api.migration.status()
        if (!migStatus.hasMigrated) {
          const legacy = await api.migration.detect()
          if (legacy.length > 0) {
            setReady(true)
            navigate('/migration', { replace: true })
            return
          }
        }
      }

      const lastSolution = await restoreSolution()
      if (lastSolution) {
        pickSolution(lastSolution)
        navigate('/workspace', { replace: true })
      }
      setReady(true)
    }
    init()

    // 监听 deep link 登录回调
    const api = (window as any).electronAPI
    if (api?.onAuthCallback) {
      const unsubscribe = api.onAuthCallback((data: any) => {
        useAuthStore.getState().login(data)
      })
      return unsubscribe
    }
  }, [])

  if (!ready) return <LoadingScreen />

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={
          hasPickedSolution ? <Navigate to="/workspace" replace /> : <Navigate to="/pick" replace />
        } />
        <Route path="/pick" element={<SolutionPicker />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/migration" element={<MigrationWizard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  )
}
