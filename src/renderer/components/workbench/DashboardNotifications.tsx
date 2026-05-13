import type { Dispatch, SetStateAction } from 'react'
import { NotifIcon } from './dashboard-panel-widgets'
import { markAllRead, markNotificationRead, type NotificationDef } from '@/lib/workflow-os-service'

export interface DashboardNotificationsProps {
  agentName: string
  userId: string
  showNotifPanel: boolean
  unreadCount: number
  notifications: NotificationDef[]
  onTogglePanel: () => void
  onNotificationsChange: Dispatch<SetStateAction<NotificationDef[]>>
  onUnreadCountChange: Dispatch<SetStateAction<number>>
}

export function DashboardNotifications({
  agentName,
  userId,
  showNotifPanel,
  unreadCount,
  notifications,
  onTogglePanel,
  onNotificationsChange,
  onUnreadCountChange,
}: DashboardNotificationsProps) {
  return (
    <>
      <div className="flex items-center justify-end -mb-2">
        <button
          onClick={onTogglePanel}
          className="relative p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="通知"
        >
          <span className="text-lg">🔔</span>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {showNotifPanel && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-sm font-semibold">通知 {unreadCount > 0 && `(${unreadCount})`}</h3>
            {unreadCount > 0 && (
              <button
                onClick={async () => {
                  await markAllRead(agentName, userId)
                  onNotificationsChange((prev) => prev.map((n) => ({ ...n, read: true })))
                  onUnreadCountChange(0)
                }}
                className="text-xs text-blue-500 hover:text-blue-600"
              >
                全部已读
              </button>
            )}
          </div>
          <div className="max-h-[320px] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-700">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">暂无通知</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notification_id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors ${!n.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                  onClick={async () => {
                    if (!n.read) {
                      await markNotificationRead(agentName, n.notification_id)
                      onNotificationsChange((prev) =>
                        prev.map((x) => x.notification_id === n.notification_id ? { ...x, read: true } : x)
                      )
                      onUnreadCountChange((c) => Math.max(0, c - 1))
                    }
                  }}
                >
                  <NotifIcon type={n.type} priority={n.priority} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.read ? 'font-semibold' : 'font-medium'} truncate`}>{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.body}</p>}
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
                    {new Date(n.created_at).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
