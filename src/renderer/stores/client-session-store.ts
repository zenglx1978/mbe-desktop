/**
 * 客户门户 — 会话与成员（对话列表、当前频道、未读、成员管理 UI 草稿）
 */
import { create } from 'zustand'
import { authHeaders } from '@/lib/api-client'
import { CLIENT_PORTAL_API as API } from './client-portal-constants'
import type { ClientInvite, ChannelMember } from './client-portal-types'

export interface ClientSessionState {
  invites: ClientInvite[]
  activeChannel: string | null
  unreadCounts: Record<string, number>
  lastPreviews: Record<string, { sender_name: string; content: string; created_at: string }>
  members: ChannelMember[]

  /** 左侧：新建对话表单 */
  showCreate: boolean
  newClientName: string
  /** 右侧成员面板 */
  showMembers: boolean
  showAddMember: boolean
  newMemberId: string
  newMemberName: string
  newMemberTitle: string
  newMemberRole: 'admin' | 'member' | 'viewer'

  setActiveChannel: (channelId: string | null) => void
  setMembers: (members: ChannelMember[]) => void
  clearMembers: () => void

  setShowCreate: (v: boolean) => void
  setNewClientName: (v: string) => void
  setShowMembers: (v: boolean) => void
  setShowAddMember: (v: boolean) => void
  setNewMemberId: (v: string) => void
  setNewMemberName: (v: string) => void
  setNewMemberTitle: (v: string) => void
  setNewMemberRole: (v: 'admin' | 'member' | 'viewer') => void
  resetMemberInviteForm: () => void

  fetchInvites: () => Promise<void>
  fetchUnread: () => Promise<void>
  createInvite: (clientName: string, solutionId?: string, agentId?: string) => Promise<ClientInvite | null>
  fetchMembers: (channelId?: string) => Promise<void>
  addMember: (channelId: string, userId: string, displayName: string, title?: string, role?: string) => Promise<boolean>
  removeMember: (channelId: string, userId: string) => Promise<boolean>
}

export const useClientSessionStore = create<ClientSessionState>((set, get) => ({
  invites: [],
  activeChannel: null,
  unreadCounts: {},
  lastPreviews: {},
  members: [],

  showCreate: false,
  newClientName: '',
  showMembers: false,
  showAddMember: false,
  newMemberId: '',
  newMemberName: '',
  newMemberTitle: '',
  newMemberRole: 'member',

  setActiveChannel: (channelId) => set({ activeChannel: channelId }),
  setMembers: (members) => set({ members }),
  clearMembers: () => set({ members: [] }),

  setShowCreate: (v) => set({ showCreate: v }),
  setNewClientName: (v) => set({ newClientName: v }),
  setShowMembers: (v) => set({ showMembers: v }),
  setShowAddMember: (v) => set({ showAddMember: v }),
  setNewMemberId: (v) => set({ newMemberId: v }),
  setNewMemberName: (v) => set({ newMemberName: v }),
  setNewMemberTitle: (v) => set({ newMemberTitle: v }),
  setNewMemberRole: (v) => set({ newMemberRole: v }),
  resetMemberInviteForm: () => set({
    newMemberId: '',
    newMemberName: '',
    newMemberTitle: '',
    newMemberRole: 'member',
    showAddMember: false,
  }),

  fetchInvites: async () => {
    try {
      const res = await fetch(`${API}/invites`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        set({ invites: data })
      }
    } catch (e) {
      // Expected: 邀请列表 API 不可达；在聊天区提示错误
      console.warn('[client-session-store] fetchInvites:', e)
      const { useClientChatMessagesStore } = await import('./client-chat-store')
      useClientChatMessagesStore.setState({ error: '获取对话列表失败' })
    }
  },

  fetchUnread: async () => {
    try {
      const res = await fetch(`${API}/channels/unread`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        const prev = get().unreadCounts
        const newCounts = (data.unread || {}) as Record<string, number>

        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          for (const [cid, cnt] of Object.entries(newCounts)) {
            if (cnt > (prev[cid] || 0)) {
              const preview = data.previews?.[cid]
              if (preview) {
                new Notification('MBE 新消息', {
                  body: `${preview.sender_name}: ${(preview.content || '').slice(0, 60)}`,
                  silent: false,
                })
              }
            }
          }
        }
        set({ unreadCounts: newCounts, lastPreviews: data.previews || {} })
      }
    } catch {
      // Expected: 未读轮询失败（离线/鉴权）；下次轮询重试
    }
  },

  createInvite: async (clientName, solutionId = 'general', agentId = 'cs') => {
    try {
      const res = await fetch(`${API}/invites`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          client_name: clientName,
          solution_id: solutionId,
          agent_id: agentId,
          expires_hours: 72,
        }),
      })
      if (!res.ok) return null
      const data = await res.json()
      const invite: ClientInvite = {
        invite_code: data.invite_code,
        client_name: clientName,
        channel_id: data.channel_id,
        solution_id: solutionId,
        agent_id: agentId,
        note: '',
        link: data.link,
        created_at: new Date().toISOString(),
        expires_at: data.expires_at,
        is_active: true,
        member_count: 1,
        my_role: 'owner',
      }
      set(s => ({ invites: [invite, ...s.invites] }))
      return invite
    } catch {
      // Expected: 创建邀请失败；返回 null
      return null
    }
  },

  fetchMembers: async (channelId) => {
    const ch = channelId ?? get().activeChannel
    if (!ch) return
    try {
      const res = await fetch(`${API}/channels/${ch}/members`, {
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        set({ members: data })
      }
    } catch {
      // Expected: 成员列表拉取失败；不覆盖已有 members
    }
  },

  addMember: async (channelId, userId, displayName, title = '', role = 'member') => {
    try {
      const res = await fetch(`${API}/channels/${channelId}/members`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ user_id: userId, display_name: displayName, title, role }),
      })
      if (res.ok) {
        await get().fetchMembers(channelId)
        return true
      }
      return false
    } catch {
      // Expected: 添加成员失败；返回 false
      return false
    }
  },

  removeMember: async (channelId, userId) => {
    try {
      const res = await fetch(`${API}/channels/${channelId}/members/${userId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.ok) {
        await get().fetchMembers(channelId)
        return true
      }
      return false
    } catch {
      // Expected: 移除成员失败；返回 false
      return false
    }
  },
}))
