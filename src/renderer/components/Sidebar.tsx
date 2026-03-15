import { useAppStore } from '@/stores/app-store'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '@/stores/chat-store'
import { useConversationStore } from '@/stores/conversation-store'
import { useToolStore } from '@/stores/tool-store'
import { useApprovalStore } from '@/stores/approval-store'
import ConversationList from '@/components/ConversationList'

export default function Sidebar() {
  const navigate = useNavigate()
  const {
    currentAgentIndex, currentSolution,
    switchAgent, sidebarExpanded, toggleSidebar,
  } = useAppStore()
  const { clearMessages } = useChatStore()
  const { selectConversation } = useConversationStore()
  const { navigateToTool, setActiveTab } = useToolStore()
  const pendingApprovals = useApprovalStore(s => s.pendingCount)
  const solution = currentSolution()

  function handleChangeSolution() {
    navigate('/pick')
  }

  function handleNewChat() {
    clearMessages()
    selectConversation(null)
  }

  return (
    <aside className={`fixed left-0 top-0 h-full bg-card border-r border-border/50 flex flex-col transition-all duration-200 z-20 ${sidebarExpanded ? 'w-64' : 'w-16'}`}>
      {/* Logo */}
      <div className="h-12 border-b border-border/50 flex items-center px-4 shrink-0">
        {sidebarExpanded ? (
          <span className="font-bold text-sm tracking-tight">MBE Desktop</span>
        ) : (
          <span className="font-bold text-lg mx-auto">M</span>
        )}
        <button
          onClick={toggleSidebar}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          title={sidebarExpanded ? '收起' : '展开'}
        >
          {sidebarExpanded ? '◁' : '▷'}
        </button>
      </div>

      {solution && (
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          {/* AI 专家团队 */}
          {sidebarExpanded && (
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                AI 专家团队
              </p>
            </div>
          )}
          <div className="space-y-0.5 px-2 pb-3">
            {solution.agents.map((agent, i) => (
              <button
                key={i}
                onClick={() => switchAgent(i)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  currentAgentIndex === i
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: currentAgentIndex === i ? solution.color : 'hsl(240 5% 30%)' }}
                />
                {sidebarExpanded && (
                  <div className="text-left min-w-0">
                    <div className="font-medium truncate">{agent.role}</div>
                    <div className="text-xs text-muted-foreground truncate">{agent.handles}</div>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* 快捷工具 */}
          {sidebarExpanded && solution.tools.length > 0 && (
            <>
              <div className="border-t border-border/30 mx-4" />
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  快捷工具
                </p>
              </div>
              <div className="space-y-0.5 px-2 pb-2">
                {solution.tools.slice(0, 5).map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => navigateToTool(tool)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <span className="text-base">{tool.icon}</span>
                    <span className="truncate text-xs">{tool.name}</span>
                    {tool.localScript && (
                      <span className="ml-auto text-[9px] text-emerald-500/70">离线</span>
                    )}
                  </button>
                ))}
                {solution.tools.length > 5 && (
                  <button
                    onClick={() => setActiveTab('tools')}
                    className="w-full px-3 py-1.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors text-center"
                  >
                    查看全部 {solution.tools.length} 个工具 →
                  </button>
                )}
              </div>
            </>
          )}
          {!sidebarExpanded && solution.tools.length > 0 && (
            <>
              <div className="border-t border-border/30 mx-2 my-1" />
              <div className="space-y-0.5 px-2">
                {solution.tools.slice(0, 4).map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => navigateToTool(tool)}
                    className="w-full flex items-center justify-center py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    title={tool.name}
                  >
                    <span className="text-sm">{tool.icon}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 对话历史 */}
          {sidebarExpanded && (
            <>
              <div className="border-t border-border/30 mx-4" />
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  对话历史
                </p>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <ConversationList />
              </div>
            </>
          )}
        </div>
      )}

      {/* 底部操作 */}
      <div className="border-t border-border/50 p-3 space-y-1 shrink-0">
        {sidebarExpanded ? (
          <>
            <button
              onClick={handleNewChat}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <span>✨</span> 新对话
            </button>
            <button
              onClick={handleChangeSolution}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <span>🔄</span> 切换行业方案
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors relative"
            >
              <span>🛡</span> 审批
              {pendingApprovals > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-500 text-white">
                  {pendingApprovals > 99 ? '99+' : pendingApprovals}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <span>⚙</span> 设置
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              title="新对话"
            >
              ✨
            </button>
            <button
              onClick={handleChangeSolution}
              className="w-full flex items-center justify-center py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              title="切换行业方案"
            >
              🔄
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className="w-full flex items-center justify-center py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors relative"
              title="审批"
            >
              🛡
              {pendingApprovals > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-orange-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {pendingApprovals > 9 ? '!' : pendingApprovals}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="w-full flex items-center justify-center py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              title="设置"
            >
              ⚙
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
