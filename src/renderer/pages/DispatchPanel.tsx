import { useEffect, useState, useCallback } from 'react'
import {
  Send, Wifi, WifiOff, RefreshCw, Clock, CheckCircle2,
  XCircle, Loader2, Smartphone, Monitor, ArrowRight,
} from 'lucide-react'
import { useDispatchStore, type DispatchConnectionStatus } from '@/stores/dispatch-store'
import { useAppStore } from '@/stores/app-store'

const STATUS_CONFIG: Record<DispatchConnectionStatus, { icon: typeof Wifi; label: string; color: string }> = {
  connected:    { icon: Wifi,      label: '已连接',  color: '#22c55e' },
  connecting:   { icon: RefreshCw, label: '连接中…', color: '#f59e0b' },
  disconnected: { icon: WifiOff,   label: '未连接',  color: '#6b7280' },
  error:        { icon: XCircle,   label: '连接错误', color: '#ef4444' },
}

export default function DispatchPanel() {
  const { connectionStatus, results, error, connect, disconnect, listResults } = useDispatchStore()
  const color = useAppStore((s) => s.currentSolution()?.color) || '#6366f1'

  const [sending, setSending] = useState(false)
  const [agentName, setAgentName] = useState('finance')
  const [expertId, setExpertId] = useState('')
  const [prompt, setPrompt] = useState('')

  const statusCfg = STATUS_CONFIG[connectionStatus] || STATUS_CONFIG.disconnected
  const StatusIcon = statusCfg.icon

  useEffect(() => {
    listResults()
    const timer = setInterval(listResults, 15000)
    return () => clearInterval(timer)
  }, [listResults])

  const handleConnect = useCallback(async () => {
    await connect('desktop_user', 'https://mbe.hi-maker.com')
  }, [connect])

  const handleSend = useCallback(async () => {
    if (!prompt.trim()) return
    setSending(true)
    try {
      const api = (window as any).electronAPI?.dispatch
      if (api?.send) {
        await api.send({ agentName, expertId: expertId || undefined, prompt })
        setPrompt('')
        setTimeout(listResults, 2000)
      }
    } finally {
      setSending(false)
    }
  }, [agentName, expertId, prompt, listResults])

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* 顶栏 */}
      <div className="flex-none px-6 py-4 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: `${color}18` }}>
              <Send className="w-4.5 h-4.5" style={{ color }} />
            </div>
            <div>
              <h1 className="text-base font-bold">远程派遣</h1>
              <p className="text-[11px] text-muted-foreground">
                手机/PWA 发起任务 → Desktop AI 专家执行 → 结果推回
              </p>
            </div>
          </div>

          {/* 连接状态 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                 style={{
                   background: `${statusCfg.color}15`,
                   color: statusCfg.color,
                 }}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusCfg.label}
            </div>

            {connectionStatus === 'disconnected' || connectionStatus === 'error' ? (
              <button onClick={handleConnect}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                      style={{ background: color }}>
                连接后端
              </button>
            ) : connectionStatus === 'connected' ? (
              <button onClick={disconnect}
                      className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground border border-border/30 hover:bg-muted/50">
                断开
              </button>
            ) : null}
          </div>
        </div>
        {error && (
          <div className="mt-2 text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg">
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左列：发送面板 */}
        <div className="w-[380px] flex-none border-r border-border/30 flex flex-col">
          {/* 架构示意 */}
          <div className="p-4 border-b border-border/20">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/30">
                <Smartphone className="w-3 h-3" /> 手机/PWA
              </div>
              <ArrowRight className="w-3 h-3" />
              <div className="flex items-center gap-1 px-2 py-1 rounded-md"
                   style={{ background: `${color}15`, color }}>
                <Send className="w-3 h-3" /> 后端中枢
              </div>
              <ArrowRight className="w-3 h-3" />
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/30">
                <Monitor className="w-3 h-3" /> Desktop
              </div>
            </div>
          </div>

          {/* 发送表单 */}
          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            <label className="block">
              <span className="text-[11px] text-muted-foreground mb-1 block">目标 Agent</span>
              <select value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border/40 bg-muted/20 focus:outline-none focus:ring-1"
                      style={{ '--tw-ring-color': color } as any}>
                {['finance', 'legal', 'cost', 'cs', 'pulmonary', 'sales', 'growth', 'hr', 'invest'].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] text-muted-foreground mb-1 block">Expert ID（可选）</span>
              <input value={expertId}
                     onChange={(e) => setExpertId(e.target.value)}
                     placeholder="留空使用默认 Expert"
                     className="w-full px-3 py-2 text-sm rounded-lg border border-border/40 bg-muted/20 focus:outline-none focus:ring-1" />
            </label>

            <label className="block">
              <span className="text-[11px] text-muted-foreground mb-1 block">提示词</span>
              <textarea value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="输入要执行的任务..."
                        rows={5}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-border/40 bg-muted/20 resize-none focus:outline-none focus:ring-1" />
            </label>

            <button onClick={handleSend}
                    disabled={sending || !prompt.trim()}
                    className="w-full py-2.5 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: color }}>
              {sending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 执行中…</>
              ) : (
                <><Send className="w-4 h-4" /> 发送到 Desktop 执行</>
              )}
            </button>
          </div>
        </div>

        {/* 右列：执行记录 */}
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4" style={{ color }} />
            执行记录
            <span className="text-xs text-muted-foreground font-normal">
              （共 {results.length} 条）
            </span>
          </h2>

          {results.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Send className="w-12 h-12 mx-auto mb-4 opacity-10" />
              <p className="text-sm">暂无远程派遣记录</p>
              <p className="text-xs mt-1">从左侧面板发送任务，或通过手机/PWA 远程触发</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((r) => {
                const isOk = r.status === 'completed'
                return (
                  <div key={r.request_id}
                       className="p-3 rounded-xl border border-border/30 bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-2">
                      {isOk ? (
                        <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 flex-none" />
                      ) : (
                        <XCircle className="w-4 h-4 mt-0.5 text-red-400 flex-none" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed line-clamp-3">
                          {r.result_summary || r.status}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                          <span>{r.completed_at ? new Date(r.completed_at).toLocaleString('zh-CN') : ''}</span>
                          <span className="font-mono">{r.request_id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
