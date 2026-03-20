import { Suspense, lazy, useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'

const AuthPage = lazy(() => import('@/pages/AuthPage'))
const SolutionPicker = lazy(() => import('@/pages/SolutionPicker'))
const Workspace = lazy(() => import('@/pages/Workspace'))
const MigrationWizard = lazy(() => import('@/pages/MigrationWizard'))
const Settings = lazy(() => import('@/pages/Settings'))
const CopilotPanel = lazy(() => import('@/pages/CopilotPanel'))
const DataSourceSetup = lazy(() => import('@/pages/DataSourceSetup'))
const SolutionStory = lazy(() => import('@/pages/SolutionStory'))
const KnowledgeGraphPage = lazy(() => import('@/pages/KnowledgeGraphPage'))
const AnalyticsHeatmaps = lazy(() => import('@/pages/AnalyticsHeatmaps'))
const DeepMindInsights = lazy(() => import('@/pages/DeepMindInsights'))

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

/** 需要登录才能访问的路由守卫 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated()) {
    return <Navigate to="/auth" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  const { hasPickedSolution } = useAppStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route
          path="/auth"
          element={isAuthenticated() ? <Navigate to="/pick" replace /> : <AuthPage />}
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              {hasPickedSolution ? <Workspace /> : <Navigate to="/pick" replace />}
            </RequireAuth>
          }
        />
        <Route
          path="/pick"
          element={
            <RequireAuth>
              <SolutionPicker />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
        <Route
          path="/migrate"
          element={
            <RequireAuth>
              <MigrationWizard />
            </RequireAuth>
          }
        />
        <Route
          path="/data-source-setup"
          element={
            <RequireAuth>
              <DataSourceSetup />
            </RequireAuth>
          }
        />
        {/* 方案 Scrollytelling 交互叙事 */}
        <Route
          path="/solution/:solutionId"
          element={
            <RequireAuth>
              <SolutionStory />
            </RequireAuth>
          }
        />
        {/* 知识图谱可视化（开发者工具） */}
        <Route
          path="/kb-graph"
          element={
            <RequireAuth>
              <KnowledgeGraphPage />
            </RequireAuth>
          }
        />
        {/* 数据热力图分析 */}
        <Route
          path="/analytics/heatmaps"
          element={
            <RequireAuth>
              <AnalyticsHeatmaps />
            </RequireAuth>
          }
        />
        {/* DeepMind Insights 仪表盘（开发者工具） */}
        <Route
          path="/deepmind"
          element={
            <RequireAuth>
              <DeepMindInsights />
            </RequireAuth>
          }
        />
        {/* AI 副驾驶悬浮窗（独立窗口加载，不需要认证） */}
        <Route path="/copilot" element={<CopilotPanel />} />
        {/* 未匹配路由：已登录 → 首页，未登录 → 登录 */}
        <Route path="*" element={<Navigate to={isAuthenticated() ? '/' : '/auth'} replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    const init = async () => {
      await useAuthStore.getState().restoreAuth()
      useAppStore.getState().initFromStorage()
      setRestoring(false)
    }
    init()
  }, [])

  if (restoring) return <LoadingScreen />

  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}
