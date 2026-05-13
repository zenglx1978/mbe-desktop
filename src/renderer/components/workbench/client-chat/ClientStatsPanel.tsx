import { type ChannelAnalytics, type GlobalDashboard } from '@/stores/client-chat-store'
import {
  MessageSquare, Bot, Users, ListChecks, Clock,
  TrendingUp, BarChart3, CheckCircle, Loader2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

export default function ClientStatsPanel({ analytics }: { analytics: ChannelAnalytics | null }) {
  if (!analytics) return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载统计数据...
    </div>
  )

  const ms = analytics.messages
  const rt = analytics.response_time
  const ts = analytics.tasks

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard icon={<MessageSquare className="w-4 h-4" />} label="总消息" value={ms.total_messages} color="text-blue-500" />
        <KpiCard icon={<Clock className="w-4 h-4" />} label="平均响应" value={rt.avg_minutes ? `${rt.avg_minutes}分` : '—'} color="text-green-500" />
        <KpiCard icon={<CheckCircle className="w-4 h-4" />} label="任务完成率" value={`${ts.completion_rate}%`} color="text-amber-500" />
        <KpiCard icon={<Bot className="w-4 h-4" />} label="AI 协助" value={ms.ai_msgs} color="text-purple-500" />
      </div>

      <div className="bg-card/50 border border-border rounded-xl p-4">
        <h4 className="text-xs font-medium mb-3 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-primary" /> 消息构成
        </h4>
        <div className="flex gap-4 text-xs">
          <MsgBar label="专业人员" count={ms.professional_msgs} total={ms.total_messages} color="bg-blue-500" />
          <MsgBar label="客户" count={ms.client_msgs} total={ms.total_messages} color="bg-green-500" />
          <MsgBar label="AI" count={ms.ai_msgs} total={ms.total_messages} color="bg-purple-500" />
          <MsgBar label="文件" count={ms.file_count} total={ms.total_messages} color="bg-amber-500" />
        </div>
      </div>

      {analytics.daily_trend.length > 0 && (
        <div className="bg-card/50 border border-border rounded-xl p-4">
          <h4 className="text-xs font-medium mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-primary" /> 每日消息趋势
          </h4>
          <ResponsiveContainer width="100%" height={96}>
            <BarChart
              data={analytics.daily_trend.slice(-30).map(d => ({
                day: d.day.slice(5),
                total: d.total,
              }))}
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="day"
                tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.[0]) return null
                  const d = payload[0].payload as { day: string; total: number }
                  return (
                    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[11px] shadow-lg">
                      {d.day}: <strong>{d.total}</strong>条
                    </div>
                  )
                }}
              />
              <Bar dataKey="total" fill="hsl(var(--primary) / 0.7)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-card/50 border border-border rounded-xl p-4">
        <h4 className="text-xs font-medium mb-3 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-green-500" /> 响应时间分析
        </h4>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-lg font-semibold">{rt.avg_minutes ?? '—'}</div>
            <div className="text-[11px] text-muted-foreground">平均(分)</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{rt.median_minutes ?? '—'}</div>
            <div className="text-[11px] text-muted-foreground">中位数(分)</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{rt.replied_count}</div>
            <div className="text-[11px] text-muted-foreground">已回复</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-500">
              {ms.client_msgs > 0 ? Math.round(rt.replied_count / ms.client_msgs * 100) : 0}%
            </div>
            <div className="text-[11px] text-muted-foreground">回复率</div>
          </div>
        </div>
      </div>

      {analytics.member_activity.length > 0 && (
        <div className="bg-card/50 border border-border rounded-xl p-4">
          <h4 className="text-xs font-medium mb-3 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary" /> 成员活跃度
          </h4>
          <ResponsiveContainer width="100%" height={Math.max(80, analytics.member_activity.length * 28)}>
            <BarChart
              data={analytics.member_activity.map(m => ({
                name: m.sender_name.length > 6 ? m.sender_name.slice(0, 6) + '…' : m.sender_name,
                msgs: m.msg_count,
              }))}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={60}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.[0]) return null
                  const d = payload[0].payload as { name: string; msgs: number }
                  return (
                    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[11px] shadow-lg">
                      {d.name}: <strong>{d.msgs}</strong> 条消息
                    </div>
                  )
                }}
              />
              <Bar dataKey="msgs" fill="hsl(var(--primary) / 0.55)" radius={[0, 3, 3, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-card/50 border border-border rounded-xl p-4">
        <h4 className="text-xs font-medium mb-3 flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5 text-amber-500" /> 任务统计
        </h4>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-lg font-semibold">{ts.total_tasks}</div>
            <div className="text-[11px] text-muted-foreground">总计</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-500">{ts.completed}</div>
            <div className="text-[11px] text-muted-foreground">已完成</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-blue-500">{ts.in_progress}</div>
            <div className="text-[11px] text-muted-foreground">进行中</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-muted-foreground">{ts.todo}</div>
            <div className="text-[11px] text-muted-foreground">待办</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function GlobalDashboardPanel({ data }: { data: GlobalDashboard }) {
  const ms = data.messages
  const ts = data.tasks
  const maxDaily = Math.max(...data.daily_trend.map(d => d.count), 1)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">服务总览</h2>
          <span className="text-xs text-muted-foreground">近 {data.period_days} 天</span>
        </div>

        <div className="grid grid-cols-5 gap-3">
          <KpiCard icon={<Users className="w-4 h-4" />} label="活跃频道" value={`${data.active_channels}/${data.total_channels}`} color="text-blue-500" />
          <KpiCard icon={<MessageSquare className="w-4 h-4" />} label="总消息" value={ms.total} color="text-primary" />
          <KpiCard icon={<Clock className="w-4 h-4" />} label="平均响应" value={data.avg_response_minutes ? `${data.avg_response_minutes}分` : '—'} color="text-green-500" />
          <KpiCard icon={<CheckCircle className="w-4 h-4" />} label="任务完成率" value={`${ts.completion_rate}%`} color="text-amber-500" />
          <KpiCard icon={<Bot className="w-4 h-4" />} label="AI 协助" value={ms.ai} color="text-purple-500" />
        </div>

        {data.daily_trend.length > 0 && (
          <div className="bg-card/50 border border-border rounded-xl p-4">
            <h4 className="text-xs font-medium mb-3">消息趋势</h4>
            <div className="flex items-end gap-[2px] h-20">
              {data.daily_trend.slice(-30).map((d, i) => (
                <div key={i} className="flex-1 group relative">
                  <div
                    className="w-full bg-primary/60 rounded-t hover:bg-primary"
                    style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: d.count > 0 ? '2px' : '0' }}
                  />
                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-popover border border-border rounded px-2 py-1 text-[11px] whitespace-nowrap shadow-lg z-10">
                    {d.day.slice(5)}: {d.count}条
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.top_channels.length > 0 && (
          <div className="bg-card/50 border border-border rounded-xl p-4">
            <h4 className="text-xs font-medium mb-3">活跃客户排行</h4>
            <div className="space-y-2">
              {data.top_channels.map((ch, i) => (
                <div key={ch.channel_id} className="flex items-center gap-3 text-xs">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    i < 3 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>{i + 1}</span>
                  <span className="flex-1 truncate font-medium">{ch.channel_name}</span>
                  <span className="text-muted-foreground">{ch.msg_count} 条消息</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-card/50 border border-border rounded-xl p-3 text-center">
      <div className={`flex items-center justify-center mb-1.5 ${color}`}>{icon}</div>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}

function MsgBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round(count / total * 100) : 0
  return (
    <div className="flex-1 text-center">
      <div className="h-16 flex items-end justify-center mb-1">
        <div className={`w-6 ${color} rounded-t`} style={{ height: `${Math.max(pct, 2)}%` }} />
      </div>
      <div className="font-medium">{count}</div>
      <div className="text-muted-foreground text-[11px]">{label} ({pct}%)</div>
    </div>
  )
}
