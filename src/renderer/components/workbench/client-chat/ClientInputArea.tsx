import { useState, useRef, useCallback } from 'react'
import {
  useClientChatStore,
  type AIDraft, type ChannelMember,
} from '@/stores/client-chat-store'
import {
  Send, Paperclip, Bot, Globe, Lock,
  CheckCircle, XCircle, Edit3,
} from 'lucide-react'
import { AI_AGENTS } from './shared'
import ClientQuickReply from './ClientQuickReply'

interface ClientInputAreaProps {
  aiDraft: AIDraft | null
  onAIDraftChange: (draft: AIDraft | null) => void
}

export default function ClientInputArea({ aiDraft, onAIDraftChange }: ClientInputAreaProps) {
  const {
    inputText, setInputText, clearInputText, sendTarget, setSendTarget,
    loading, members, activeChannel,
    sendMessage, uploadFile, invokeAI, reviewAI,
    showAIMenu, setShowAIMenu,
  } = useClientChatStore()

  const fileRef = useRef<HTMLInputElement>(null)

  const handleSend = useCallback(async () => {
    if (!inputText.trim()) return
    await sendMessage(inputText, sendTarget)
    clearInputText()
  }, [inputText, sendMessage, sendTarget, clearInputText])

  const handleFile = useCallback(async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    await uploadFile(file, sendTarget)
    if (fileRef.current) fileRef.current.value = ''
  }, [uploadFile, sendTarget])

  return (
    <>
      {aiDraft && (
        <AIReviewPanel
          draft={aiDraft}
          onApprove={async () => {
            await reviewAI(aiDraft.draft_id, 'approve', '', sendTarget)
            onAIDraftChange(null)
          }}
          onEdit={async (content) => {
            await reviewAI(aiDraft.draft_id, 'edit', content, sendTarget)
            onAIDraftChange(null)
          }}
          onReject={async () => {
            await reviewAI(aiDraft.draft_id, 'reject')
            onAIDraftChange(null)
          }}
        />
      )}

      <div className="border-t border-border shrink-0">
        <VisibilitySelector
          value={sendTarget}
          onChange={setSendTarget}
          members={members}
        />
        <div className="px-3 pb-3 pt-1.5 flex items-end gap-2">
          <input type="file" ref={fileRef} className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground shrink-0"
            title="上传文件"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowAIMenu(!showAIMenu)}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground shrink-0 disabled:opacity-40"
              title="@AI 专家"
            >
              <Bot className="w-4 h-4" />
            </button>
            {showAIMenu && (
              <div className="absolute bottom-full left-0 mb-1 w-48 bg-popover border border-border rounded-lg shadow-lg p-1 z-50">
                {AI_AGENTS.map(a => (
                  <button
                    key={a.id}
                    onClick={async () => {
                      setShowAIMenu(false)
                      const draft = await invokeAI(activeChannel!, a.id, inputText || undefined)
                      if (draft) {
                        onAIDraftChange(draft)
                      }
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted transition-colors text-left"
                  >
                    <span>{a.icon}</span>
                    <span>{a.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <ClientQuickReply />
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={sendTarget === 'all' ? '输入消息（全员可见）...' : '输入私密消息...'}
            rows={1}
            className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary max-h-24"
          />
          <button
            onClick={handleSend}
            disabled={loading || !inputText.trim()}
            className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  )
}

function VisibilitySelector({
  value, onChange, members,
}: {
  value: string | string[]
  onChange: (v: string | string[]) => void
  members: ChannelMember[]
}) {
  const isAll = value === 'all'
  const allMembers = members.filter(m => m.role !== 'owner')

  return (
    <div className="px-3 pt-2 flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => onChange('all')}
        className={`flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
          isAll ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground'
        }`}
      >
        <Globe className="w-3 h-3" /> 全员
      </button>
      {allMembers.map(m => {
        const selected = Array.isArray(value) && value.includes(m.user_id)
        return (
          <button
            key={m.user_id}
            onClick={() => {
              if (isAll) {
                onChange([m.user_id])
              } else if (Array.isArray(value)) {
                const next = selected
                  ? value.filter(v => v !== m.user_id)
                  : [...value, m.user_id]
                onChange(next.length === 0 ? 'all' : next)
              }
            }}
            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
              selected ? 'border-amber-500/50 bg-amber-500/10 text-amber-400' : 'border-border text-muted-foreground hover:border-muted-foreground'
            }`}
          >
            <Lock className="w-3 h-3" />
            {m.display_name}
            {m.title ? ` (${m.title})` : ''}
          </button>
        )
      })}
      {!isAll && (
        <span className="text-[10px] text-amber-400 ml-1">仅选中的人可见</span>
      )}
    </div>
  )
}

function AIReviewPanel({
  draft, onApprove, onEdit, onReject,
}: {
  draft: AIDraft
  onApprove: () => void
  onEdit: (content: string) => void
  onReject: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(draft.answer)

  return (
    <div className="border-t border-amber-500/30 bg-amber-500/5 p-3 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="w-4 h-4 text-amber-500" />
        <span className="text-xs font-medium text-amber-500">
          {draft.agent_icon} {draft.agent_name} 草稿 — 审核后发布
        </span>
        {draft.confidence > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            置信度 {Math.round(draft.confidence * 100)}%
          </span>
        )}
      </div>

      {draft.sources.length > 0 && (
        <div className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1 flex-wrap">
          <span>来源:</span>
          {draft.sources.map((s, i) => (
            <span key={i} className="bg-muted px-1.5 py-0.5 rounded">{s}</span>
          ))}
        </div>
      )}

      {editing ? (
        <textarea
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary mb-2"
        />
      ) : (
        <div className="text-sm bg-background border border-border rounded-lg p-3 mb-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
          {draft.answer}
        </div>
      )}

      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <button
              onClick={() => { onEdit(editContent); setEditing(false) }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              <CheckCircle className="w-3.5 h-3.5" /> 发布修改版
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted"
            >
              取消
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onApprove}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              <CheckCircle className="w-3.5 h-3.5" /> 发布原文
            </button>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted"
            >
              <Edit3 className="w-3.5 h-3.5" /> 修改
            </button>
            <button
              onClick={onReject}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <XCircle className="w-3.5 h-3.5" /> 丢弃
            </button>
          </>
        )}
      </div>
    </div>
  )
}
