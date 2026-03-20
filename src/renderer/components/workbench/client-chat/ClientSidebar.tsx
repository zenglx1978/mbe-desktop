import { useCallback } from 'react'
import {
  useClientChatStore,
  type ClientInvite,
} from '@/stores/client-chat-store'
import {
  Users, Plus, Check, Link2, MessageSquare, Crown, BarChart3,
} from 'lucide-react'

interface ClientSidebarProps {
  copiedCode: string | null
  onCopyLink: (inv: ClientInvite) => void
}

export default function ClientSidebar({ copiedCode, onCopyLink }: ClientSidebarProps) {
  const {
    invites, activeChannel, unreadCounts, lastPreviews,
    showCreate, setShowCreate, newClientName, setNewClientName,
    createInvite, selectChannel, fetchGlobalDashboard,
  } = useClientChatStore()

  const handleCreate = useCallback(async () => {
    if (!newClientName.trim()) return
    const inv = await createInvite(newClientName.trim())
    if (inv) {
      setNewClientName('')
      setShowCreate(false)
      selectChannel(inv.channel_id)
    }
  }, [newClientName, createInvite, selectChannel])

  return (
    <aside className="w-72 border-r border-border flex flex-col bg-card/50 shrink-0">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="w-4 h-4 text-primary" />
          <span>客户对话</span>
          <span className="text-xs text-muted-foreground">({invites.length})</span>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          title="创建新对话"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showCreate && (
        <div className="p-3 border-b border-border space-y-2">
          <input
            value={newClientName}
            onChange={e => setNewClientName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="客户名称"
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <button
            onClick={handleCreate}
            className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            创建邀请链接
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {invites.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>暂无客户对话</p>
            <p className="text-xs mt-1">点击 + 创建新对话</p>
          </div>
        ) : (
          invites.map(inv => {
            const unread = unreadCounts[inv.channel_id] || 0
            const preview = lastPreviews[inv.channel_id]
            return (
            <div
              key={inv.invite_code}
              onClick={() => selectChannel(inv.channel_id)}
              className={`p-3 cursor-pointer border-b border-border/50 transition-colors ${
                activeChannel === inv.channel_id
                  ? 'bg-primary/10 border-l-2 border-l-primary'
                  : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium truncate ${unread > 0 ? 'text-foreground' : ''}`}>{inv.client_name}</span>
                <div className="flex items-center gap-1">
                  {unread > 0 && (
                    <span className="min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full bg-red-500 text-white px-1">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                  {inv.member_count && inv.member_count > 1 && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                      {inv.member_count}人
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); onCopyLink(inv) }}
                    className="p-1 rounded hover:bg-muted transition-colors"
                    title="复制邀请链接"
                  >
                    {copiedCode === inv.invite_code ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Link2 className="w-3 h-3 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {inv.solution_id !== 'general' ? inv.solution_id : inv.agent_id}
                </span>
                {inv.my_role === 'owner' && (
                  <Crown className="w-3 h-3 text-amber-500" />
                )}
              </div>
              {preview ? (
                <div className={`text-xs mt-1 truncate ${unread > 0 ? 'text-foreground/80 font-medium' : 'text-muted-foreground/70'}`}>
                  {preview.sender_name}: {preview.content?.slice(0, 40)}
                </div>
              ) : inv.last_message ? (
                <div className="text-xs text-muted-foreground/70 mt-1 truncate">
                  {inv.last_message.sender_name}: {inv.last_message.content}
                </div>
              ) : null}
            </div>
            )
          })
        )}
      </div>
      <button
        onClick={() => { fetchGlobalDashboard(); selectChannel('') }}
        className={`mx-2 mb-2 p-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
          !activeChannel ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'
        }`}
      >
        <BarChart3 className="w-3.5 h-3.5" /> 全局仪表板
      </button>
    </aside>
  )
}
