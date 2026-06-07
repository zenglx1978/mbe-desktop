import { useCallback } from 'react'
import { useClientChatStore, type ChannelMember } from '@/stores/client-chat-store'
import { UserPlus, X } from 'lucide-react'
import { ROLE_CONFIG } from './shared'

export default function ClientMemberPanel() {
  const {
    members, activeChannel,
    showAddMember, setShowAddMember,
    newMemberId, setNewMemberId, newMemberName, setNewMemberName,
    newMemberTitle, setNewMemberTitle, newMemberRole, setNewMemberRole,
    addMember, removeMember, resetMemberInviteForm,
  } = useClientChatStore()

  const professionals = members.filter(m => m.role !== 'client')
  const clients = members.filter(m => m.role === 'client')

  const handleAddMember = useCallback(async () => {
    if (!activeChannel || !newMemberId.trim() || !newMemberName.trim()) return
    const ok = await addMember(activeChannel, newMemberId.trim(), newMemberName.trim(), newMemberTitle.trim(), newMemberRole)
    if (ok) resetMemberInviteForm()
  }, [activeChannel, newMemberId, newMemberName, newMemberTitle, newMemberRole, addMember, resetMemberInviteForm])

  return (
    <aside className="w-56 border-l border-border bg-card/30 flex flex-col shrink-0">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium">对话成员</span>
        <button
          onClick={() => setShowAddMember(!showAddMember)}
          className="p-1 rounded hover:bg-muted transition-colors"
          title="邀请专业人员"
        >
          <UserPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {showAddMember && (
        <div className="p-2 border-b border-border space-y-1.5">
          <input
            value={newMemberId}
            onChange={e => setNewMemberId(e.target.value)}
            placeholder="用户 ID"
            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            value={newMemberName}
            onChange={e => setNewMemberName(e.target.value)}
            placeholder="显示名称（如：张律师）"
            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            value={newMemberTitle}
            onChange={e => setNewMemberTitle(e.target.value)}
            placeholder="职称（如：财务顾问）"
            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <select
            value={newMemberRole}
            onChange={e => setNewMemberRole(e.target.value as 'admin' | 'member' | 'viewer')}
            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="admin">管理员 — 可管理成员和消息</option>
            <option value="member">成员 — 可发消息和文件</option>
            <option value="viewer">观察员 — 只读旁听</option>
          </select>
          <button
            onClick={handleAddMember}
            disabled={!newMemberId.trim() || !newMemberName.trim()}
            className="w-full px-2 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground disabled:opacity-40"
          >
            邀请加入
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {professionals.length > 0 && (
          <div className="px-3 pt-3 pb-1">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
              专业团队 ({professionals.length})
            </div>
            {professionals.map(m => (
              <MemberRow
                key={m.user_id}
                member={m}
                onRemove={activeChannel ? () => removeMember(activeChannel, m.user_id) : undefined}
              />
            ))}
          </div>
        )}
        {clients.length > 0 && (
          <div className="px-3 pt-3 pb-1">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
              客户 ({clients.length})
            </div>
            {clients.map(m => (
              <MemberRow key={m.user_id} member={m} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function MemberRow({ member, onRemove }: { member: ChannelMember; onRemove?: () => void }) {
  const cfg = (ROLE_CONFIG[member.role] ?? ROLE_CONFIG['member'])!
  const RoleIcon = cfg.icon

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <div className="relative shrink-0">
        <RoleIcon className={`w-4 h-4 ${cfg.color}`} />
        {member.is_online && (
          <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-background" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">
          {member.display_name}
          <span className={`ml-1 text-[11px] ${cfg.color}`}>({cfg.label})</span>
        </div>
        {member.title && (
          <div className="text-[11px] text-muted-foreground truncate">{member.title}</div>
        )}
      </div>
      {onRemove && member.role !== 'owner' && (
        <button
          onClick={onRemove}
          className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
          title="移除"
        >
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}
