// AutomationPanel — WorkflowMiner 自动化建议面板
// 展示 PatternRecognizer 识别的可自动化工作流，一键启用
//
// 数据流：BehaviorObserver → PatternRecognizer → 此面板 → Solution workflow 路由

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, Zap, Clock, ArrowRight, CheckCircle2, XCircle,
  RefreshCw, Activity, Eye, EyeOff, TrendingUp,
  Cpu, MonitorSmartphone, Timer,
} from 'lucide-react'

interface DetectedPattern {
  id: string
  type: 'frequent_sequence' | 'time_routine' | 'data_transfer'
  label: string
  description: string
  apps: string[]
  frequency: number
  avgDurationMs: number
  confidence: number
  suggestedSolution?: string
  suggestedWorkflow?: string
  estimatedManualMinutes: number
  estimatedAiMinutes: number
  status: 'new' | 'accepted' | 'dismissed' | 'automated'
  firstSeenAt: string
  lastSeenAt: string
}

interface AppSummary {
  appName: string
  totalMs: number
  sessionCount: number
  avgSessionMs: number
}

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}秒`
  if (ms < 3600000) return `${Math.round(ms / 60000)}分钟`
  return `${(ms / 3600000).toFixed(1)}小时`
}

export default function AutomationPanel() {
  const navigate = useNavigate()
  const [patterns, setPatterns] = useState<DetectedPattern[]>([])
  const [appSummary, setAppSummary] = useState<AppSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [observerEnabled, setObserverEnabled] = useState(true)
  const [tab, setTab] = useState<'suggestions' | 'activity' | 'automated'>('suggestions')

  const api = window.electronAPI

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      if (api?.pattern?.list) {
        const pats = await api.pattern.list() as DetectedPattern[]
        setPatterns(pats)
      }
      if (api?.observer?.appSummary) {
        const summary = await api.observer.appSummary(7) as AppSummary[]
        setAppSummary(summary)
      }
      if (api?.observer?.enabled) {
        const enabled = await api.observer.enabled()
        setObserverEnabled(enabled)
      }
    } catch {
      // Electron API 不可用时静默降级
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => { loadData() }, [loadData])

  // 监听新发现通知
  useEffect(() => {
    if (!api?.pattern?.onNewDiscovery) return
    const cleanup = api.pattern.onNewDiscovery(() => {
      loadData()
    })
    return cleanup
  }, [api, loadData])

  const handleAnalyze = useCallback(async () => {
    if (!api?.pattern?.analyze) return
    setAnalyzing(true)
    try {
      await api.pattern.analyze()
      await loadData()
    } finally {
      setAnalyzing(false)
    }
  }, [api, loadData])

  const handleAccept = useCallback(async (patternId: string) => {
    if (!api?.pattern?.accept) return
    await api.pattern.accept(patternId)
    setPatterns((prev) => prev.map((p) =>
      p.id === patternId ? { ...p, status: 'accepted' as const } : p,
    ))
  }, [api])

  const handleDismiss = useCallback(async (patternId: string) => {
    if (!api?.pattern?.dismiss) return
    await api.pattern.dismiss(patternId)
    setPatterns((prev) => prev.filter((p) => p.id !== patternId))
  }, [api])

  const handleAutomate = useCallback(async (pattern: DetectedPattern) => {
    if (!api?.pattern?.automate) return
    await api.pattern.automate(pattern.id)
    setPatterns((prev) => prev.map((p) =>
      p.id === pattern.id ? { ...p, status: 'automated' as const } : p,
    ))
    if (pattern.suggestedSolution) {
      navigate(`/solution/${pattern.suggestedSolution}`)
    }
  }, [api, navigate])

  const handleToggleObserver = useCallback(async () => {
    if (!api?.observer?.setEnabled) return
    const result = await api.observer.setEnabled(!observerEnabled)
    setObserverEnabled(result.enabled)
  }, [api, observerEnabled])

  const newPatterns = useMemo(() => patterns.filter((p) => p.status === 'new'), [patterns])
  const automatedPatterns = useMemo(() => patterns.filter((p) => p.status === 'automated'), [patterns])

  const totalSavedMin = useMemo(() =>
    automatedPatterns.reduce((sum, p) => sum + (p.estimatedManualMinutes - p.estimatedAiMinutes) * p.frequency, 0),
    [automatedPatterns],
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              智能自动化发现
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              AI 观察您的工作模式，自动发现可以用 MBE 提效的流程
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleObserver}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                observerEnabled
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-secondary/50 text-muted-foreground'
              }`}
              title={observerEnabled ? '行为观察已开启（点击关闭）' : '行为观察已关闭（点击开启）'}
            >
              {observerEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {observerEnabled ? '观察中' : '已暂停'}
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
              {analyzing ? '分析中...' : '立即分析'}
            </button>
          </div>
        </div>

        {/* 汇总卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            label="发现模式"
            value={patterns.length.toString()}
            icon={<Activity className="w-4 h-4" />}
          />
          <SummaryCard
            label="待确认"
            value={newPatterns.length.toString()}
            icon={<Sparkles className="w-4 h-4" />}
            highlight={newPatterns.length > 0}
          />
          <SummaryCard
            label="已自动化"
            value={automatedPatterns.length.toString()}
            icon={<Zap className="w-4 h-4" />}
          />
          <SummaryCard
            label="预计周省"
            value={totalSavedMin > 0 ? `${totalSavedMin}分钟` : '—'}
            icon={<TrendingUp className="w-4 h-4" />}
            highlight={totalSavedMin > 0}
          />
        </div>

        {/* 标签切换 */}
        <div className="flex gap-1 mb-6 p-1 bg-secondary/30 rounded-lg w-fit">
          {([
            { key: 'suggestions', label: '发现', count: newPatterns.length },
            { key: 'activity', label: '行为概览', count: appSummary.length },
            { key: 'automated', label: '已自动化', count: automatedPatterns.length },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  tab === t.key ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Timer className="w-5 h-5 animate-spin mr-2" />
            加载行为数据...
          </div>
        ) : (
          <>
            {/* 发现标签页 */}
            {tab === 'suggestions' && (
              newPatterns.length === 0 ? (
                <EmptyDiscovery observerEnabled={observerEnabled} />
              ) : (
                <div className="space-y-3">
                  {newPatterns.map((pattern) => (
                    <PatternCard
                      key={pattern.id}
                      pattern={pattern}
                      onAccept={handleAccept}
                      onDismiss={handleDismiss}
                      onAutomate={handleAutomate}
                    />
                  ))}
                </div>
              )
            )}

            {/* 行为概览标签页 */}
            {tab === 'activity' && (
              appSummary.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <MonitorSmartphone className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>暂无行为数据，观察器会在后台静默记录</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border/50 bg-card">
                  <div className="px-5 py-3 border-b border-border/30">
                    <h3 className="text-sm font-semibold text-foreground">
                      过去 7 天应用使用概览
                    </h3>
                  </div>
                  <div className="divide-y divide-border/20">
                    {appSummary.slice(0, 15).map((item) => (
                      <div key={item.appName} className="flex items-center gap-4 px-5 py-3">
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <Cpu className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.appName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.sessionCount} 次切换 · 平均 {formatDuration(item.avgSessionMs)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-foreground">
                            {formatDuration(item.totalMs)}
                          </p>
                        </div>
                        {/* 占比条 */}
                        <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden shrink-0">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{
                              width: `${Math.min(100, (item.totalMs / (appSummary[0]?.totalMs || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* 已自动化标签页 */}
            {tab === 'automated' && (
              automatedPatterns.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>尚未启用任何自动化流程</p>
                  <p className="text-xs mt-1">在"发现"标签中查看可自动化的工作流</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {automatedPatterns.map((pattern) => (
                    <div key={pattern.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">{pattern.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {pattern.apps.join(' → ')} · 每次省 {pattern.estimatedManualMinutes - pattern.estimatedAiMinutes} 分钟
                          </p>
                        </div>
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-full">
                          运行中
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PatternCard({ pattern, onAccept, onDismiss, onAutomate }: {
  pattern: DetectedPattern
  onAccept: (id: string) => void
  onDismiss: (id: string) => void
  onAutomate: (pattern: DetectedPattern) => void
}) {
  const savedMin = pattern.estimatedManualMinutes - pattern.estimatedAiMinutes
  const speedup = pattern.estimatedAiMinutes > 0
    ? Math.round(pattern.estimatedManualMinutes / pattern.estimatedAiMinutes)
    : 10

  const typeLabel = pattern.type === 'frequent_sequence' ? '频繁操作'
    : pattern.type === 'time_routine' ? '定时任务'
    : '数据搬运'

  return (
    <div className="rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.04] to-transparent p-5 transition-all hover:border-amber-500/30">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
          {pattern.type === 'time_routine'
            ? <Clock className="w-5 h-5 text-amber-500" />
            : <Activity className="w-5 h-5 text-amber-500" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-foreground">{pattern.label}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
              {typeLabel}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {Math.round(pattern.confidence * 100)}% 置信
            </span>
          </div>

          <p className="text-xs text-muted-foreground">{pattern.description}</p>

          {/* 应用序列 */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {pattern.apps.map((app, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-xs px-2 py-0.5 rounded-md bg-secondary/60 text-muted-foreground font-medium">
                  {app}
                </span>
                {i < pattern.apps.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-muted-foreground/40" />
                )}
              </span>
            ))}
          </div>

          {/* 效率对比 */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span>
              手动 <strong className="text-foreground">{pattern.estimatedManualMinutes}分钟</strong>
            </span>
            <ArrowRight className="w-3 h-3" />
            <span>
              AI <strong className="text-primary">{pattern.estimatedAiMinutes}分钟</strong>
            </span>
            <span className="text-emerald-600 font-bold">
              快 {speedup}x · 省 {savedMin}分钟/次
            </span>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 mt-3">
            {pattern.suggestedSolution && (
              <button
                type="button"
                onClick={() => onAutomate(pattern)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                一键自动化
              </button>
            )}
            <button
              type="button"
              onClick={() => onAccept(pattern.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border/50 text-muted-foreground hover:bg-secondary/50 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              记住
            </button>
            <button
              type="button"
              onClick={() => onDismiss(pattern.id)}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              忽略
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, icon, highlight }: {
  label: string
  value: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${
      highlight ? 'border-amber-500/25 bg-amber-500/5' : 'border-border/50 bg-card'
    }`}>
      <div className={`flex items-center gap-2 mb-2 text-xs ${
        highlight ? 'text-amber-600' : 'text-muted-foreground'
      }`}>
        {icon}
        {label}
      </div>
      <p className={`text-2xl font-bold ${highlight ? 'text-amber-600' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  )
}

function EmptyDiscovery({ observerEnabled }: { observerEnabled: boolean }) {
  return (
    <div className="text-center py-16">
      <Sparkles className="w-12 h-12 text-muted-foreground/15 mx-auto mb-4" />
      <p className="text-muted-foreground font-medium">
        {observerEnabled ? '还未发现可自动化的模式' : '行为观察已暂停'}
      </p>
      <p className="text-muted-foreground/60 text-sm mt-2 max-w-md mx-auto">
        {observerEnabled
          ? '系统正在后台学习您的工作习惯。使用各类应用一段时间后，AI 会自动识别可以提效的重复性工作。'
          : '开启行为观察后，AI 将在后台静默学习您的工作模式，发现可以自动化的流程。数据仅存本地。'
        }
      </p>
    </div>
  )
}
