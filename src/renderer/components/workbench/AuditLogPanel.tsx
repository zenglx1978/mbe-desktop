/**
 * 审计日志面板 — QuickBooks "Audit Trail" 对标
 *
 * 显示所有数据变更记录，支持按实体类型和 ID 筛选。
 */
import { useState, useEffect } from 'react'
import { History, ArrowRight } from 'lucide-react'
import { getAuditLog, type AuditEntry } from '@/lib/database'

interface Props {
  entityType?: string
  entityId?: string
  limit?: number
}

export default function AuditLogPanel({ entityType, entityId, limit = 50 }: Props) {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [filterType, setFilterType] = useState(entityType || '')

  useEffect(() => {
    setLogs(getAuditLog(filterType || undefined, entityId, limit))
  }, [filterType, entityId, limit])

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p>暂无变更记录</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" />
          变更日志
        </h4>
        {!entityType && (
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs px-2 py-1 rounded-md border border-border/40 bg-secondary/20"
          >
            <option value="">全部类型</option>
            <option value="brand">品牌</option>
            <option value="settlement">结算</option>
            <option value="system">系统</option>
          </select>
        )}
      </div>

      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/20 text-xs">
            <div className="shrink-0 mt-0.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                log.action === 'create' ? 'bg-green-500' :
                log.action === 'update' ? 'bg-blue-500' :
                log.action === 'delete' ? 'bg-red-500' :
                'bg-gray-400'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium">{log.action === 'create' ? '新建' : log.action === 'update' ? '更新' : log.action === 'delete' ? '删除' : log.action}</span>
                <span className="text-muted-foreground">{log.entityType}</span>
                <span className="text-muted-foreground/60 truncate">{log.entityId.slice(0, 8)}</span>
              </div>
              {log.fieldName && (
                <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
                  <span>{log.fieldName}:</span>
                  {log.oldValue && <span className="line-through opacity-50">{log.oldValue}</span>}
                  {log.oldValue && log.newValue && <ArrowRight className="w-2.5 h-2.5" />}
                  {log.newValue && <span className="text-foreground">{log.newValue}</span>}
                </div>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground/60 shrink-0">
              {new Date(log.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
