/**
 * PanelErrorBoundary — 面板级错误边界
 *
 * 用途：包裹每个工作台面板（ChatPanel、WorkflowPanel、AccountPanel 等），
 *   当单个面板因 JS 异常崩溃时，仅该面板降级显示错误卡片，
 *   不影响整体 Workspace 布局和其他面板。
 *
 * 使用方式：
 *   <PanelErrorBoundary name="工作流">
 *     <WorkflowPanel />
 *   </PanelErrorBoundary>
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  /** 面板名称，用于错误提示 */
  name?: string
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class PanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const label = this.props.name ?? 'Panel'
    console.error(`[PanelErrorBoundary:${label}]`, error.message, info.componentStack)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { name = '当前面板' } = this.props
    const msg = this.state.error?.message ?? '未知错误'

    return (
      <div
        className="flex flex-col items-center justify-center h-full min-h-[200px] p-8 text-center"
        role="alert"
        aria-live="assertive"
      >
        <AlertTriangle className="w-10 h-10 text-amber-500/70 mb-4" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground mb-1">{name}加载失败</h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-xs leading-relaxed">
          {msg.length > 120 ? msg.slice(0, 120) + '…' : msg}
        </p>
        <button
          onClick={this.handleRetry}
          aria-label={`重新加载${name}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <RefreshCw className="w-3 h-3" aria-hidden="true" />
          重试
        </button>
      </div>
    )
  }
}

export default PanelErrorBoundary
