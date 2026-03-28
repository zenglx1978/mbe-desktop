import { Component, Suspense, lazy, useEffect, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'

const OfflineBanner = lazy(() => import('@/components/OfflineBanner'))
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
const ScheduleManager = lazy(() => import('@/pages/ScheduleManager'))
const DispatchPanel = lazy(() => import('@/pages/DispatchPanel'))

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

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="text-center space-y-6 max-w-md px-6">
            <div className="text-6xl">⚠</div>
            <h1 className="text-2xl font-bold">应用出现异常</h1>
            <p className="text-muted-foreground text-sm">
              {this.state.error?.message || '未知错误'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity"
              >
                重试
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
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
        {/* AI 专家定时巡检管理 */}
        <Route
          path="/schedules"
          element={
            <RequireAuth>
              <ScheduleManager />
            </RequireAuth>
          }
        />
        {/* 远程派遣面板（Anthropic Dispatch 启发） */}
        <Route
          path="/dispatch"
          element={
            <RequireAuth>
              <DispatchPanel />
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
    <ErrorBoundary>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm"
      >
        跳过导航
      </a>
      <HashRouter>
        <Suspense fallback={null}>
          <OfflineBanner />
        </Suspense>
        <AppRoutes />
      </HashRouter>
    </ErrorBoundary>
  )
}
