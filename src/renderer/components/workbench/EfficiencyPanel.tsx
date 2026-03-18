// 效率测量面板 — MBE Desktop 成本收益报告
// 核心功能：展示"用 MBE 前"vs"用 MBE 后"的时间对比，量化 ROI

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/app-store'
import { Clock, TrendingUp, BarChart3, Download, Timer, ArrowRight } from 'lucide-react'

interface CostBenefitReport {
  solutionId: string
  period: string
  taskCount: number
  totalManualMs: number
  totalAssistedMs: number
  savedMs: number
  savedPercent: number
  tasks: {
    name: string
    count: number
    avgManualMs: number
    avgAssistedMs: number
    savedPercent: number
  }[]
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}秒`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}分钟`
  return `${(ms / 3600000).toFixed(1)}小时`
}

export default function EfficiencyPanel() {
  const { solutionId, currentSolution } = useAppStore()
  const solution = currentSolution()
  const [report, setReport] = useState<CostBenefitReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30)

  const loadReport = useCallback(async () => {
    if (!solutionId) return
    setLoading(true)
    try {
      const api = (window as any).electronAPI
      if (api?.miner?.costBenefitReport) {
        const data = await api.miner.costBenefitReport(solutionId, period)
        setReport(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [solutionId, period])

  useEffect(() => { loadReport() }, [loadReport])

  if (!solution) return null

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              效率报告 · 成本收益分析
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              对比使用 MBE 前后的操作耗时，量化 AI 专家带来的效率提升
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  period === d
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/50'
                }`}
              >
                {d}天
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Timer className="w-5 h-5 animate-spin mr-2" />
            加载效率数据...
          </div>
        ) : !report || report.taskCount === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* 概览统计卡片 */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="总操作次数"
                value={report.taskCount.toString()}
                icon={<Clock className="w-4 h-4" />}
              />
              <StatCard
                label="人工总耗时"
                value={formatDuration(report.totalManualMs)}
                icon={<Timer className="w-4 h-4" />}
                sublabel="不用 MBE"
              />
              <StatCard
                label="MBE 总耗时"
                value={formatDuration(report.totalAssistedMs)}
                icon={<TrendingUp className="w-4 h-4" />}
                sublabel="使用 MBE"
                highlight
              />
              <StatCard
                label="效率提升"
                value={`${report.savedPercent}%`}
                icon={<BarChart3 className="w-4 h-4" />}
                sublabel={`节省 ${formatDuration(report.savedMs)}`}
                highlight
              />
            </div>

            {/* 时间节省可视化 */}
            <div className="rounded-xl border border-border/50 bg-card p-5 mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">时间对比</h3>
              <div className="flex items-center gap-4 mb-2">
                <span className="text-xs text-muted-foreground w-16 shrink-0">人工</span>
                <div className="flex-1 h-6 bg-red-500/10 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500/60 rounded-full" style={{ width: '100%' }} />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-20 text-right">
                  {formatDuration(report.totalManualMs)}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-16 shrink-0">MBE</span>
                <div className="flex-1 h-6 bg-emerald-500/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500/60 rounded-full transition-all duration-1000"
                    style={{ width: report.totalManualMs > 0 ? `${Math.max((report.totalAssistedMs / report.totalManualMs) * 100, 3)}%` : '0%' }}
                  />
                </div>
                <span className="text-xs font-mono text-primary w-20 text-right font-medium">
                  {formatDuration(report.totalAssistedMs)}
                </span>
              </div>
            </div>

            {/* 分任务明细 */}
            {report.tasks.length > 0 && (
              <div className="rounded-xl border border-border/50 bg-card">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
                  <h3 className="text-sm font-semibold text-foreground">各任务效率明细</h3>
                  <button
                    onClick={() => exportReport(report)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    导出报告
                  </button>
                </div>
                <div className="divide-y divide-border/20">
                  {report.tasks.map((task) => (
                    <div key={task.name} className="flex items-center gap-4 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{task.name}</p>
                        <p className="text-xs text-muted-foreground">{task.count} 次操作</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                        <span>{formatDuration(task.avgManualMs)}</span>
                        <ArrowRight className="w-3 h-3 text-primary" />
                        <span className="text-primary font-medium">{formatDuration(task.avgAssistedMs)}</span>
                      </div>
                      <div className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${
                        task.savedPercent >= 50 ? 'bg-emerald-500/15 text-emerald-600' :
                        task.savedPercent >= 20 ? 'bg-blue-500/15 text-blue-600' :
                        'bg-gray-500/15 text-gray-600'
                      }`}>
                        {task.savedPercent > 0 ? `-${task.savedPercent}%` : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sublabel, icon, highlight }: {
  label: string
  value: string
  sublabel?: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${
      highlight ? 'border-primary/25 bg-primary/5' : 'border-border/50 bg-card'
    }`}>
      <div className={`flex items-center gap-2 mb-2 text-xs ${
        highlight ? 'text-primary' : 'text-muted-foreground'
      }`}>
        {icon}
        {label}
      </div>
      <p className={`text-2xl font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      {sublabel && (
        <p className="text-[10px] text-muted-foreground mt-1">{sublabel}</p>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <BarChart3 className="w-12 h-12 text-muted-foreground/20 mb-4" />
      <p className="text-muted-foreground font-medium">暂无效率数据</p>
      <p className="text-muted-foreground/50 text-sm mt-2 max-w-md">
        使用 MBE 处理业务后，系统会自动记录操作耗时。
        数据积累后，您将看到详细的成本收益分析报告。
      </p>
    </div>
  )
}

function exportReport(report: CostBenefitReport) {
  const lines = [
    `MBE 效率报告 — ${report.period}`,
    `方案: ${report.solutionId}`,
    `总操作: ${report.taskCount} 次`,
    `人工总耗时: ${formatDuration(report.totalManualMs)}`,
    `MBE 总耗时: ${formatDuration(report.totalAssistedMs)}`,
    `节省: ${formatDuration(report.savedMs)} (${report.savedPercent}%)`,
    '',
    '任务明细:',
    ...report.tasks.map((t) =>
      `  ${t.name}: ${formatDuration(t.avgManualMs)} → ${formatDuration(t.avgAssistedMs)} (省 ${t.savedPercent}%, ${t.count}次)`
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `MBE效率报告_${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
