/**
 * 通知铃铛 + 下拉面板 — 放在 Header 右侧
 */
import { useEffect, useRef } from 'react'
import { Bell, CheckCheck, Mail, MessageSquare, Database, X } from 'lucide-react'
import { useNotificationStore, startNotificationPolling } from '@/stores/notification-store'

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  db: Database,
}

const TYPE_LABELS: Record<string, string> = {
  contract_sent: '合同发送',
  contract_customer_signed: '客户签约',
  contract_counter_signed: '我方签章',
  contract_activated: '合同生效',
  contract_expiring: '合同到期',
  contract_sign_reminder: '签约提醒',
  subaccount_created: '子账户创建',
  subaccount_role_assigned: '角色分配',
  subaccount_deactivated: '账户停用',
  subaccount_quota_warning: '配额预警',
  subscription_renewed: '续费成功',
  subscription_expiring_reminder: '续费提醒',
  invoice_issued: '发票开具',
  payment_success: '支付成功',
  payment_failed: '支付失败',
}

export default function NotificationBell() {
  const { items, unreadCount, panelOpen, loading, togglePanel, closePanel, markAsRead, markAllRead, fetchNotifications } = useNotificationStore()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stop = startNotificationPolling()
    return stop
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closePanel()
      }
    }
    if (panelOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [panelOpen, closePanel])

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      const now = new Date()
      const diffMs = now.getTime() - d.getTime()
      if (diffMs < 60_000) return '刚刚'
      if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)} 分钟前`
      if (diffMs < 86400_000) return `${Math.floor(diffMs / 3600_000)} 小时前`
      return `${Math.floor(diffMs / 86400_000)} 天前`
    } catch { return '' }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={togglePanel}
        className="relative p-1.5 rounded-md hover:bg-muted transition-colors"
        title="通知"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[11px] rounded-full flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {panelOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[480px] bg-popover border rounded-lg shadow-lg overflow-hidden z-50">
          {/* 头部 */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <span className="text-sm font-medium">通知中心</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                  title="全部标为已读"
                >
                  <CheckCheck className="w-3 h-3" /> 全部已读
                </button>
              )}
              <button onClick={closePanel} className="p-1 hover:bg-muted rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 列表 */}
          <div className="overflow-y-auto max-h-[420px]">
            {loading && items.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">加载中...</div>
            )}
            {!loading && items.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                暂无通知
              </div>
            )}
            {items.map(n => {
              const ChannelIcon = CHANNEL_ICON[n.channel] || Database
              return (
                <div
                  key={n.id}
                  className={`px-3 py-2.5 border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${
                    !n.is_read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => !n.is_read && markAsRead(n.id)}
                >
                  <div className="flex items-start gap-2">
                    <ChannelIcon className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {!n.is_read && <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />}
                        <span className="text-xs font-medium truncate">
                          {TYPE_LABELS[n.type] || n.type}
                        </span>
                        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                          {formatTime(n.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.title || n.message}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 底部 */}
          {items.length > 0 && (
            <div className="border-t px-3 py-1.5 text-center">
              <button
                onClick={() => { fetchNotifications(); }}
                className="text-xs text-primary hover:underline"
              >
                刷新
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
