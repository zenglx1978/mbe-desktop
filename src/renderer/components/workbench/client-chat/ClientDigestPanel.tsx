import { useState } from 'react'
import { type ChannelDigest } from '@/stores/client-chat-store'
import {
  FileText, ListChecks, ExternalLink, Lock, Users,
  Loader2, ChevronDown,
} from 'lucide-react'
import { formatTime } from './shared'

const DIGEST_TYPES = [
  { id: 'summary',       label: '对话摘要',   icon: FileText,   desc: '时间线、关键决策、待办事项' },
  { id: 'meeting_notes', label: '会议纪要',   icon: ListChecks,  desc: '议程、讨论、决议' },
  { id: 'action_items',  label: '行动清单',   icon: ListChecks,  desc: '责任人、截止日期、优先级' },
  { id: 'client_report', label: '客户报告',   icon: ExternalLink, desc: '自动脱敏，仅客户可见' },
  { id: 'internal_memo', label: '内部备忘',   icon: Lock,        desc: '仅专业团队可见' },
  { id: 'handover',      label: '交接文档',   icon: Users,       desc: '新成员快速了解上下文' },
] as const

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft:     { label: '草稿',   color: 'bg-yellow-500/15 text-yellow-500' },
  published: { label: '已发布', color: 'bg-green-500/15 text-green-500' },
  archived:  { label: '已归档', color: 'bg-zinc-500/15 text-zinc-500' },
}

interface ClientDigestPanelProps {
  channelId: string
  digests: ChannelDigest[]
  loading: boolean
  onGenerate: (type: string, visibleTo: string | string[]) => Promise<void>
  onPublish: (digestId: string) => Promise<boolean>
}

export default function ClientDigestPanel({
  channelId, digests, loading, onGenerate, onPublish,
}: ClientDigestPanelProps) {
  const [showGen, setShowGen] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const previewDigest = digests.find(d => d.digest_id === previewId)

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {digests.length} 份文档
        </span>
        <button
          onClick={() => setShowGen(!showGen)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          生成报告
          <ChevronDown className={`w-3 h-3 transition-transform ${showGen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showGen && (
        <div className="px-4 py-3 border-b border-border bg-muted/30 grid grid-cols-3 gap-2">
          {DIGEST_TYPES.map(dt => {
            const Icon = dt.icon
            return (
              <button
                key={dt.id}
                onClick={async () => {
                  await onGenerate(dt.id, dt.id === 'client_report' ? 'all' : dt.id === 'internal_memo' ? [] : 'all')
                  setShowGen(false)
                }}
                disabled={loading}
                className="flex flex-col items-start gap-1 p-2.5 rounded-lg border border-border bg-background hover:border-primary/30 hover:bg-primary/5 transition-colors text-left disabled:opacity-40"
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium">{dt.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight">{dt.desc}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {previewDigest ? (
          <div className="p-4">
            <button
              onClick={() => setPreviewId(null)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
            >
              <ChevronDown className="w-3 h-3 rotate-90" /> 返回列表
            </button>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium flex-1">{previewDigest.title}</h3>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_MAP[previewDigest.status]?.color ?? ''}`}>
                {STATUS_MAP[previewDigest.status]?.label ?? previewDigest.status}
              </span>
              {previewDigest.status === 'draft' && (
                <button
                  onClick={async () => {
                    await onPublish(previewDigest.digest_id)
                  }}
                  className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                >
                  发布给客户
                </button>
              )}
            </div>
            <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap border border-border rounded-lg p-4 bg-background">
              {previewDigest.content_md}
            </div>
          </div>
        ) : digests.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full text-center py-16">
            <div>
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-15" />
              <p className="text-sm text-muted-foreground">暂无文档</p>
              <p className="text-xs text-muted-foreground mt-1">
                点击「生成报告」，AI 自动从聊天记录中提取结构化文档
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {digests.map(d => {
              const st = STATUS_MAP[d.status] ?? STATUS_MAP.draft
              const typeInfo = DIGEST_TYPES.find(t => t.id === d.digest_type)
              const Icon = typeInfo?.icon ?? FileText
              return (
                <button
                  key={d.digest_id}
                  onClick={() => setPreviewId(d.digest_id)}
                  className="w-full text-left p-3 rounded-lg border border-border bg-background hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-medium flex-1 truncate">{d.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${st.color}`}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                    <span>{typeInfo?.label}</span>
                    <span>·</span>
                    <span>{formatTime(d.created_at)}</span>
                    {d.visible_to !== 'all' && (
                      <span className="flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> 限定可见</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
