/** 客户门户 API 共享类型（多 store 复用） */

export interface ClientInvite {
  invite_code: string
  client_name: string
  channel_id: string
  solution_id: string
  agent_id: string
  note: string
  link: string
  created_at: string
  expires_at: string
  is_active: boolean
  member_count?: number
  my_role?: string
  last_message?: ClientMsg | null
  unread_hint?: number
}

export interface MemberPermissions {
  send_message?: boolean
  send_file?: boolean
  send_private?: boolean
  manage_members?: boolean
  delete_message?: boolean
  close_channel?: boolean
  view_all_messages?: boolean
}

export interface ChannelMember {
  user_id: string
  display_name: string
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'client'
  title: string
  joined_at: string
  is_online: boolean
  permissions?: MemberPermissions
}

export interface ClientMsg {
  message_id: string
  channel_id: string
  sender_type: 'client' | 'professional' | 'ai' | 'system'
  sender_id: string
  sender_name: string
  sender_title: string
  content: string
  message_type: string
  file_id?: string
  file_name?: string
  created_at: string
  visible_to: string | string[]
}

export interface ChannelDigest {
  digest_id: string
  channel_id: string
  digest_type: string
  title: string
  content_md: string
  content_json: Record<string, unknown>
  visible_to: string | string[]
  created_by: string
  status: 'draft' | 'published' | 'archived'
  created_at: string
  action_items_count?: number
}

export interface ChannelTask {
  task_id: string
  channel_id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'high' | 'medium' | 'low'
  assignee_id: string
  assignee_name: string
  due_date: string | null
  source_type: string
  visible_to: string | string[]
  created_by: string
  created_at: string
  completed_at: string | null
}

export interface SearchResult {
  message_id: string
  channel_id: string
  sender_name: string
  content: string
  message_type: string
  created_at: string
  channel_name?: string
}

export interface QuickReply {
  reply_id: string
  owner_id: string
  category: string
  title: string
  content: string
  shortcut: string
  use_count: number
}

export interface ChannelAnalytics {
  channel_id: string
  period_days: number
  messages: {
    total_messages: number
    professional_msgs: number
    client_msgs: number
    ai_msgs: number
    file_count: number
  }
  daily_trend: { day: string; total: number; professional: number; client: number }[]
  response_time: {
    replied_count: number
    avg_minutes: number | null
    median_minutes: number | null
  }
  tasks: {
    total_tasks: number
    completed: number
    todo: number
    in_progress: number
    completion_rate: number
  }
  digests: { total_digests: number; published: number; drafts: number }
  member_activity: { sender_id: string; sender_name: string; msg_count: number; last_active: string }[]
}

export interface GlobalDashboard {
  total_channels: number
  active_channels: number
  period_days: number
  messages: { total: number; professional: number; client: number; ai: number; files: number }
  daily_trend: { day: string; count: number }[]
  avg_response_minutes: number | null
  tasks: { total: number; done: number; active: number; completion_rate: number }
  top_channels: { channel_id: string; channel_name: string; msg_count: number; last_active: string }[]
}

export interface AIDraft {
  draft_id: string
  agent_id: string
  agent_name: string
  agent_icon: string
  question: string
  answer: string
  confidence: number
  sources: string[]
  status: 'draft'
}
