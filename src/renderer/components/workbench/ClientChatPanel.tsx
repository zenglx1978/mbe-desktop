/**
 * ClientChatPanel — 专业人员端的客户沟通面板
 *
 * 对话模型：N 个专业人员 ↔ 1 个客户
 *
 * 布局：
 *  ┌─────────┬──────────────────────┬──────────┐
 *  │ 客户列表 │      聊天区           │ 成员管理  │
 *  │ (左侧)  │    (中间主区域)        │ (右侧)   │
 *  └─────────┴──────────────────────┴──────────┘
 */
import { useState, useEffect, useCallback } from 'react'
import {
  useClientChatStore,
  type ClientInvite, type AIDraft,
} from '@/stores/client-chat-store'
import {
  Users, Copy, Check, MessageSquare, FileText,
  ListChecks, Search, BarChart3,
} from 'lucide-react'
import ClientSidebar from './client-chat/ClientSidebar'
import ClientMessageList from './client-chat/ClientMessageList'
import ClientInputArea from './client-chat/ClientInputArea'
import ClientMemberPanel from './client-chat/ClientMemberPanel'
import ClientDigestPanel from './client-chat/ClientDigestPanel'
import ClientTaskBoard from './client-chat/ClientTaskBoard'
import ClientStatsPanel, { GlobalDashboardPanel } from './client-chat/ClientStatsPanel'

export default function ClientChatPanel() {
  const {
    invites, activeChannel, members, digests, tasks,
    channelAnalytics, globalDashboard,
    fetchInvites, fetchUnread,
    generateDigest, fetchDigests, publishDigest,
    fetchTasks, createTask, updateTask,
    fetchChannelAnalytics,
    showMembers, setShowMembers, showSearch, setShowSearch,
    activeTab, setActiveTab,
  } = useClientChatStore()

  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [digestGenerating, setDigestGenerating] = useState(false)
  const [aiDraft, setAiDraft] = useState<AIDraft | null>(null)

  useEffect(() => {
    fetchInvites()
    fetchUnread()
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => fetchUnread(), 5000)
    return () => clearInterval(timer)
  }, [])

  const handleCopyLink = useCallback(async (inv: ClientInvite) => {
    await navigator.clipboard.writeText(inv.link)
    setCopiedCode(inv.invite_code)
    setTimeout(() => setCopiedCode(null), 2000)
  }, [])

  const activeInvite = invites.find(i => i.channel_id === activeChannel)

  return (
    <div className="flex h-full min-h-0">
      <ClientSidebar copiedCode={copiedCode} onCopyLink={handleCopyLink} />

      <main className="flex-1 flex flex-col min-w-0">
        {!activeChannel ? (
          globalDashboard ? (
            <GlobalDashboardPanel data={globalDashboard} />
          ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">选择客户或创建新对话</p>
              <p className="text-xs mt-1 max-w-xs">
                客户打开邀请链接即可在浏览器中与您和团队沟通
              </p>
            </div>
          </div>
          )
        ) : (
          <>
            <header className="h-12 px-4 flex items-center justify-between border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm">{activeInvite?.client_name}</span>
                <span className="text-xs text-muted-foreground">
                  {activeInvite?.solution_id !== 'general' ? activeInvite?.solution_id : ''}
                </span>
                <div className="flex items-center gap-0.5 ml-2 bg-muted/50 rounded-lg p-0.5">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                      activeTab === 'chat' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" /> 对话
                  </button>
                  <button
                    onClick={() => { setActiveTab('docs'); fetchDigests() }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                      activeTab === 'docs' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <FileText className="w-3 h-3" /> 文档
                    {digests.length > 0 && (
                      <span className="ml-0.5 text-[10px] bg-primary/15 text-primary px-1 rounded-full">{digests.length}</span>
                    )}
                  </button>
                  <button
                    onClick={() => { setActiveTab('tasks'); fetchTasks() }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                      activeTab === 'tasks' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <ListChecks className="w-3 h-3" /> 任务
                    {tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length > 0 && (
                      <span className="ml-0.5 text-[10px] bg-amber-500/15 text-amber-400 px-1 rounded-full">
                        {tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => { setActiveTab('stats'); if (activeChannel) fetchChannelAnalytics(activeChannel) }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                      activeTab === 'stats' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <BarChart3 className="w-3 h-3" /> 统计
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className={`p-1.5 rounded-md transition-colors ${showSearch ? 'bg-primary/15 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
                  title="搜索消息"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
                {activeInvite && (
                  <button
                    onClick={() => handleCopyLink(activeInvite)}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors text-muted-foreground"
                  >
                    {copiedCode === activeInvite.invite_code ? (
                      <><Check className="w-3 h-3 text-green-500" /> 已复制</>
                    ) : (
                      <><Copy className="w-3 h-3" /> 链接</>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setShowMembers(!showMembers)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                    showMembers ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  {members.length}人
                </button>
              </div>
            </header>

            <div className="flex flex-1 min-h-0">
              {activeTab === 'chat' ? (
              <div className="flex-1 flex flex-col min-w-0">
                <ClientMessageList />
                <ClientInputArea aiDraft={aiDraft} onAIDraftChange={setAiDraft} />
              </div>
              ) : activeTab === 'docs' ? (
              <ClientDigestPanel
                channelId={activeChannel!}
                digests={digests}
                loading={digestGenerating}
                onGenerate={async (type, visibleTo) => {
                  setDigestGenerating(true)
                  await generateDigest(activeChannel!, type, visibleTo)
                  setDigestGenerating(false)
                }}
                onPublish={publishDigest}
              />
              ) : activeTab === 'tasks' ? (
              <ClientTaskBoard
                channelId={activeChannel!}
                tasks={tasks}
                members={members}
                onCreate={async (title, opts) => { await createTask(activeChannel!, title, opts) }}
                onUpdate={updateTask}
              />
              ) : (
              <ClientStatsPanel analytics={channelAnalytics} />
              )}

              {showMembers && <ClientMemberPanel />}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
