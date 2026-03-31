import { useClientChatStore } from '@/stores/client-chat-store'
import { Zap, Plus, Trash2 } from 'lucide-react'

const QR_CATEGORIES = [
  { id: '', label: '全部' },
  { id: 'greeting', label: '问候' },
  { id: 'faq', label: '常见' },
  { id: 'pricing', label: '报价' },
  { id: 'followup', label: '跟进' },
  { id: 'closing', label: '结束' },
]

export default function ClientQuickReply() {
  const {
    quickReplies, showQuickReplies, setShowQuickReplies,
    qrCategory, setQrCategory, fetchQuickReplies,
    showCreateQR, setShowCreateQR,
    newQRTitle, setNewQRTitle, newQRContent, setNewQRContent,
    newQRCat, setNewQRCat, resetQuickReplyForm,
    createQuickReply, deleteQuickReply, applyQuickReply,
    setInputText,
  } = useClientChatStore()

  return (
    <div className="relative">
      <button
        onClick={() => { setShowQuickReplies(!showQuickReplies); if (!showQuickReplies) fetchQuickReplies() }}
        className={`p-2 rounded-lg transition-colors shrink-0 ${showQuickReplies ? 'bg-primary/15 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
        title="快捷回复"
      >
        <Zap className="w-4 h-4" />
      </button>
      {showQuickReplies && (
        <div className="absolute bottom-full left-0 mb-1 w-72 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-80 flex flex-col">
          <div className="p-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium">快捷回复</span>
            <button onClick={() => { setShowCreateQR(!showCreateQR); setNewQRTitle(''); setNewQRContent('') }} className="p-1 rounded hover:bg-muted">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-1.5 border-b border-border flex gap-1 flex-wrap">
            {QR_CATEGORIES.map(c => (
              <button key={c.id} onClick={() => { setQrCategory(c.id); fetchQuickReplies(c.id || undefined) }}
                className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${qrCategory === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >{c.label}</button>
            ))}
          </div>
          {showCreateQR && (
            <div className="p-2 border-b border-border space-y-1.5">
              <input className="w-full px-2 py-1 text-xs border border-border rounded bg-background" placeholder="标题" value={newQRTitle} onChange={e => setNewQRTitle(e.target.value)} />
              <textarea className="w-full px-2 py-1 text-xs border border-border rounded bg-background resize-none" placeholder="内容" rows={2} value={newQRContent} onChange={e => setNewQRContent(e.target.value)} />
              <div className="flex items-center gap-1.5">
                <select className="flex-1 text-[10px] px-1.5 py-0.5 border border-border rounded bg-background" value={newQRCat} onChange={e => setNewQRCat(e.target.value)}>
                  <option value="general">通用</option>
                  <option value="greeting">问候语</option>
                  <option value="faq">常见问答</option>
                  <option value="pricing">报价相关</option>
                  <option value="followup">跟进话术</option>
                  <option value="closing">结束语</option>
                </select>
                <button
                  onClick={async () => {
                    if (newQRTitle.trim() && newQRContent.trim()) {
                      await createQuickReply(newQRTitle.trim(), newQRContent.trim(), newQRCat)
                      resetQuickReplyForm()
                    }
                  }}
                  className="px-2 py-0.5 text-[10px] bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >保存</button>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-1">
            {quickReplies.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground">暂无模板，点 + 创建</div>
            ) : quickReplies.map(qr => (
              <div key={qr.reply_id} className="group flex items-start gap-2 p-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
                onClick={async () => {
                  const content = await applyQuickReply(qr.reply_id)
                  if (content) { setInputText(content); setShowQuickReplies(false) }
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium truncate">{qr.title}</span>
                    {qr.shortcut && <code className="text-[9px] bg-muted px-1 rounded">{qr.shortcut}</code>}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{qr.content.slice(0, 60)}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteQuickReply(qr.reply_id) }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
