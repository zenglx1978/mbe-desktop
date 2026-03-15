/**
 * useApprovalNotifications — 审批 WS 事件 → Toast 即时弹窗
 *
 * 监听 approval-store 的 lastWsEvent，触发 Toast 通知。
 * 点击 Toast 自动跳转到审批面板并选中对应审批项。
 */

import { useEffect, useRef } from 'react'
import { useApprovalStore } from '@/stores/approval-store'
import { useToastStore } from '@/components/ToastContainer'
import { RISK_META } from '@/lib/approval-service'
import type { GovernanceWsEvent } from '@/lib/approval-service'

/**
 * 将审批 WS 事件转为 Toast 通知（含系统通知）。
 * 需要一个回调来切换到审批 Tab。
 */
export function useApprovalNotifications(
  switchToApprovalTab: () => void,
) {
  const lastWsEvent = useApprovalStore((s) => s.lastWsEvent)
  const clearLastWsEvent = useApprovalStore((s) => s.clearLastWsEvent)
  const select = useApprovalStore((s) => s.select)
  const push = useToastStore((s) => s.push)
  const processedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!lastWsEvent) return

    const eventKey = `${lastWsEvent.type}_${lastWsEvent.data.approval_id}`
    if (processedRef.current === eventKey) return
    processedRef.current = eventKey

    const { type, data } = lastWsEvent
    showToast(type, data, push, () => {
      select(data.approval_id)
      switchToApprovalTab()
    })
    showSystemNotification(type, data)

    clearLastWsEvent()
  }, [lastWsEvent, clearLastWsEvent, select, push, switchToApprovalTab])
}

function showToast(
  type: GovernanceWsEvent['type'],
  data: GovernanceWsEvent['data'],
  push: (t: any) => string,
  onClick: () => void,
) {
  if (type === 'governance.approval_requested') {
    const risk = RISK_META[data.risk_level] || RISK_META.medium
    const variant = data.risk_level === 'critical' || data.risk_level === 'high' ? 'error' : 'warning'
    push({
      title: `新审批请求 [${risk.label}风险]`,
      message: `${data.agent_name}: ${data.action}${data.reason ? ` — ${data.reason}` : ''}`,
      variant,
      duration: 8000,
      onClick,
    })
  }

  if (type === 'governance.approval_decided') {
    const approved = data.status === 'approved'
    push({
      title: approved ? '审批已通过' : '审批已拒绝',
      message: `${data.agent_name}: ${data.action}` + (data.decided_by ? ` (by ${data.decided_by})` : ''),
      variant: approved ? 'success' : 'info',
      duration: 5000,
      onClick,
    })
  }
}

function showSystemNotification(
  type: GovernanceWsEvent['type'],
  data: GovernanceWsEvent['data'],
) {
  if (type !== 'governance.approval_requested') return
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') {
    Notification.requestPermission()
    return
  }

  const risk = RISK_META[data.risk_level] || RISK_META.medium
  new Notification(`MBE 审批请求 [${risk.label}]`, {
    body: `${data.agent_name}: ${data.action}`,
    icon: '/icon.png',
    tag: data.approval_id,
  })
}
