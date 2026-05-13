/**
 * Dispatch Dashboard — 多设备连接状态 + 请求历史 + 路由统计
 *
 * P26: 可视化 Dispatch Hub 状态，展示多设备拓扑、负载分布、请求时间线。
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, Monitor, WifiOff, Clock, Zap,
  Activity, Radio,
} from 'lucide-react'
import {
  useDispatchStore,
  type HubDesktopInfo,
} from '@/stores/dispatch-store'
import { useAppStore } from '@/stores/app-store'

const API_BASE = (window as any).__MBE_API_BASE__ || 'https://mbe.hi-maker.com'

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  completed: { color: '#22c55e', label: '完成' },
  failed: { color: '#ef4444', label: '失败' },
  pending: { color: '#f59e0b', label: '排队中' },
  dispatched: { color: '#3b82f6', label: '执行中' },
  timeout: { color: '#6b7280', label: '超时' },
}

export default function DispatchDashboard() {
  const navigate = useNavigate()
  const { hubStatus, dispatchHistory, fetchHubStatus, fetchDispatchHistory, connectionStatus } = useDispatchStore()
  const { currentSolution } = useAppStore()
  const color = currentSolution()?.color || '#6366f1'

  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      fetchHubStatus(API_BASE),
      fetchDispatchHistory(API_BASE, 30),
    ])
    setRefreshing(false)
  }, [fetchHubStatus, fetchDispatchHistory])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 15000)
    return () => clearInterval(timer)
  }, [refresh])

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶栏 */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border/50">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-muted/50 rounded-lg">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Radio className="w-5 h-5" style={{ color }} />
        <h1 className="text-lg font-bold">Dispatch 控制台</h1>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
          {connectionStatus === 'connected' ? '已连接' : '未连接'}
        </div>
        <button onClick={refresh} className="p-1.5 hover:bg-muted/50 rounded-lg">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* 概览卡片 */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              icon={Monitor}
              label="在线设备"
              value={hubStatus?.connected_desktops ?? 0}
              color={color}
            />
            <StatCard
              icon={Clock}
              label="排队请求"
              value={hubStatus?.pending_requests ?? 0}
              color="#f59e0b"
            />
            <StatCard
              icon={Activity}
              label="历史总量"
              value={hubStatus?.history_size ?? 0}
              color="#6b7280"
            />
            <StatCard
              icon={Zap}
              label="JWT 认证"
              value={hubStatus?.config?.jwt_enabled ? '已启用' : '未启用'}
              color={hubStatus?.config?.jwt_enabled ? '#22c55e' : '#ef4444'}
            />
          </div>

          {/* 设备拓扑 */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Monitor className="w-4 h-4" style={{ color }} />
              在线设备（{hubStatus?.connected_desktops ?? 0}）
            </h2>

            {(!hubStatus?.desktop_details || hubStatus.desktop_details.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">暂无 Desktop 在线</p>
                <p className="text-xs mt-1">启动 MBE Desktop 并连接 Dispatch 后显示</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {hubStatus.desktop_details.map((d) => (
                  <DeviceCard key={d.client_id} device={d} color={color} />
                ))}
              </div>
            )}
          </section>

          {/* 配置信息 */}
          {hubStatus?.config && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold flex items-center gap-2 text-muted-foreground">
                Hub 配置
              </h2>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Ping 间隔: {hubStatus.config.ping_interval_s}s</span>
                <span>心跳超时: {hubStatus.config.heartbeat_timeout_s}s</span>
                <span>请求超时: {hubStatus.config.request_timeout_s}s</span>
              </div>
              {hubStatus.reconnect_advice && (
                <div className="text-xs text-muted-foreground">
                  重连策略: {hubStatus.reconnect_advice.initial_delay_ms}ms 起步,
                  ×{hubStatus.reconnect_advice.backoff_multiplier} 退避,
                  最大 {hubStatus.reconnect_advice.max_delay_ms}ms
                </div>
              )}
            </section>
          )}

          {/* 请求历史时间线 */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color }} />
              请求历史（最近 {dispatchHistory.length} 条）
            </h2>

            {dispatchHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">暂无 Dispatch 请求</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[11px] top-3 bottom-0 w-px bg-border/30" />
                {dispatchHistory.map((item) => {
                  const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending
                  return (
                    <div key={item.request_id} className="relative flex gap-3 pb-3">
                      <div className="relative z-10 mt-1 shrink-0">
                        <div
                          className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center"
                          style={{ borderColor: st.color, backgroundColor: `${st.color}15` }}
                        >
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }} />
                        </div>
                      </div>
                      <div className="flex-1 p-3 rounded-xl border border-border/30 bg-card space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: `${st.color}15`, color: st.color }}
                          >
                            {st.label}
                          </span>
                          <span className="text-xs font-medium">{item.agent_name}/{item.expert_id || '—'}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground">
                            {item.source}
                          </span>
                          <span className="text-[11px] text-muted-foreground ml-auto">
                            {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '—'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {item.prompt || '—'}
                        </p>
                        {item.result_summary && (
                          <p className="text-xs text-foreground/80 line-clamp-2">{item.result_summary}</p>
                        )}
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          {item.token_cost > 0 && <span>Token: {item.token_cost}</span>}
                          <span className="font-mono">{item.request_id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon, label, value, color,
}: {
  icon: any; label: string; value: string | number; color: string
}) {
  return (
    <div className="p-4 rounded-xl border border-border/30 bg-card">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

function DeviceCard({ device, color }: { device: HubDesktopInfo; color: string }) {
  const isHealthy = device.last_pong_age_s < 60
  return (
    <div className="p-4 rounded-xl border border-border/30 bg-card space-y-2">
      <div className="flex items-center gap-2">
        <Monitor className="w-4 h-4" style={{ color }} />
        <span className="text-sm font-medium flex-1 truncate">{device.device_name}</span>
        <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-yellow-500'}`} />
      </div>
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span>负载: {device.active_load}</span>
        <span>心跳: {device.last_pong_age_s.toFixed(0)}s ago</span>
      </div>
      {device.agents.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {device.agents.map((a) => (
            <span key={a} className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10" style={{ color }}>
              {a}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">支持全部 Agent</p>
      )}
      <p className="text-[11px] text-muted-foreground">
        连接于 {device.connected_at ? new Date(device.connected_at).toLocaleString('zh-CN') : '—'}
      </p>
    </div>
  )
}
