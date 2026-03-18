import { useState, useRef, useEffect, useCallback } from 'react'
import {
  X, Pin, PinOff, Copy, Camera,
  Send, Loader2, Monitor, Minimize2,
  Clipboard, Sparkles,
} from 'lucide-react'

const api = (window as any).electronAPI

interface ActiveWindowInfo {
  success: boolean
  title?: string
  app?: string
  category?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  wechat: '微信 🚫',
  wecom: '企业微信 🚫',
  qianniu: '千牛 ⚠️只读',
  wangwang: '旺旺 ⚠️只读',
  feige: '抖店飞鸽 ⚠️只读',
  pinduoduo_seller: '拼多多商家 ⚠️只读',
  xiaohongshu_seller: '小红书商家 ⚠️只读',
  jushuitan: '聚水潭 ERP ✅',
  wangdiantong: '旺店通 ERP ✅',
  guanyiyun: '管易云 ERP ✅',
  feishu: '飞书',
  dingtalk: '钉钉',
  browser: '浏览器',
  email: '邮箱',
  spreadsheet: '表格',
  document: '文档',
  other: '应用',
}

export default function CopilotPanel() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pinned, setPinned] = useState(true)
  const [activeApp, setActiveApp] = useState<ActiveWindowInfo | null>(null)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    // 监听来自主进程的分析请求
    const cleanupAnalyze = api?.copilot?.onAnalyze?.((data: { text: string }) => {
      if (data.text) {
        setInput(data.text)
        handleSend(data.text)
      }
    })
    const cleanupScreenshot = api?.copilot?.onScreenshot?.((data: { dataUrl: string }) => {
      setScreenshot(data.dataUrl)
    })
    return () => {
      cleanupAnalyze?.()
      cleanupScreenshot?.()
    }
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // 定期检测活跃窗口
  useEffect(() => {
    const poll = async () => {
      const info = await api?.copilot?.activeWindow?.()
      if (info?.success) setActiveApp(info)
    }
    poll()
    const timer = setInterval(poll, 3000)
    return () => clearInterval(timer)
  }, [])

  const handleSend = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim()
    if (!text || isLoading) return
    if (!textOverride) setInput('')

    setMessages(prev => [...prev, { role: 'user', text }])
    setIsLoading(true)

    // 构建上下文：当前活跃应用 + 截图
    const ctx = activeApp?.success
      ? `[当前应用: ${CATEGORY_LABELS[activeApp.category || 'other']} - ${activeApp.title}]\n`
      : ''
    const fullPrompt = ctx + text

    try {
      // TODO: 接入实际的 AI 后端，当前先用模拟回复
      await new Promise(r => setTimeout(r, 800))
      const aiReply = generateLocalReply(text, activeApp)
      setMessages(prev => [...prev, { role: 'ai', text: aiReply }])
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: '抱歉，处理出错，请重试' }])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, activeApp])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleReadClipboard = async () => {
    const data = await api?.copilot?.clipboard?.read()
    if (data?.text) {
      setInput(data.text)
      inputRef.current?.focus()
    }
  }

  const handleScreenshot = async () => {
    const result = await api?.copilot?.screenshot()
    if (result?.success) {
      setScreenshot(result.dataUrl)
    }
  }

  const handleCopyToClipboard = (text: string) => {
    api?.copilot?.clipboard?.write(text)
  }

  const handleClose = () => {
    api?.copilot?.close()
  }

  const handlePin = () => {
    const next = !pinned
    setPinned(next)
    api?.copilot?.pin(next)
  }

  // 拖拽标题栏移动窗口
  const handleDragStart = (e: React.MouseEvent) => {
    dragRef.current = { x: e.screenX, y: e.screenY }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.screenX - dragRef.current.x
      const dy = ev.screenY - dragRef.current.y
      dragRef.current = { x: ev.screenX, y: ev.screenY }
      // 通知主进程相对移动不精确，直接用 screen position
      // 这里用绝对坐标
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="h-screen w-full flex flex-col bg-[#0d0d14]/95 backdrop-blur-xl text-white rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-white/5 cursor-move select-none"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium">MBE AI 副驾驶</span>
          {activeApp?.success && (
            <span className="text-xs text-white/40 truncate max-w-[160px]">
              · {CATEGORY_LABELS[activeApp.category || 'other']}
            </span>
          )}
        </div>
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <button
            onClick={handlePin}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
            title={pinned ? '取消置顶' : '置顶'}
          >
            {pinned ? <Pin className="w-3.5 h-3.5 text-blue-400" /> : <PinOff className="w-3.5 h-3.5 text-white/40" />}
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md hover:bg-red-500/20 transition-colors"
            title="关闭"
          >
            <X className="w-3.5 h-3.5 text-white/40 hover:text-red-400" />
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-white/30 space-y-3">
            <Sparkles className="w-8 h-8" />
            <div>
              <p className="text-sm font-medium">AI 副驾驶就绪</p>
              <p className="text-xs mt-1">Ctrl+Shift+M 读取剪贴板分析</p>
              <p className="text-xs">Ctrl+Shift+S 截图分析</p>
              <p className="text-xs">Ctrl+Shift+Space 开关本窗口</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600/30 text-blue-100'
                  : 'bg-white/8 text-white/90'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.text}</div>
              {msg.role === 'ai' && (
                <button
                  onClick={() => handleCopyToClipboard(msg.text)}
                  className="mt-1.5 flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  <Copy className="w-3 h-3" /> 复制到剪贴板
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/8 rounded-xl px-3 py-2 flex items-center gap-2 text-white/50 text-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> 思考中...
            </div>
          </div>
        )}
      </div>

      {/* 截图预览 */}
      {screenshot && (
        <div className="px-3 pb-1">
          <div className="relative rounded-lg overflow-hidden border border-white/10 max-h-24">
            <img src={screenshot} alt="截图" className="w-full object-cover max-h-24" />
            <button
              onClick={() => setScreenshot(null)}
              className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
            >
              <X className="w-3 h-3 text-white/70" />
            </button>
          </div>
        </div>
      )}

      {/* 输入区 */}
      <div className="px-3 py-2 bg-white/5 border-t border-white/10">
        <div className="flex items-end gap-2">
          <div className="flex gap-1">
            <button
              onClick={handleReadClipboard}
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
              title="读取剪贴板"
            >
              <Clipboard className="w-4 h-4 text-white/40" />
            </button>
            <button
              onClick={handleScreenshot}
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
              title="截图"
            >
              <Camera className="w-4 h-4 text-white/40" />
            </button>
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你需要的帮助..."
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500/50 text-white placeholder:text-white/20"
            style={{ maxHeight: 80 }}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// 本地模拟回复（真正部署时替换为 AI 后端调用）
function generateLocalReply(query: string, app: ActiveWindowInfo | null): string {
  const appLabel = app?.success ? CATEGORY_LABELS[app.category || 'other'] : '应用'

  if (query.length > 200) {
    return `已分析来自${appLabel}的内容（${query.length}字）。\n\n要点摘要：\n1. 这是一段较长的文本内容\n2. 建议将具体问题与文本一起发送，AI 可以提供更精准的分析\n\n您可以问我：\n- 帮我总结要点\n- 帮我回复这段消息\n- 检查其中的法律/财务风险`
  }

  if (app?.category === 'wechat' || app?.category === 'wecom') {
    return `检测到您正在使用${appLabel}。\n\n我可以帮您：\n• 润色/改写消息\n• 分析对方意图\n• 草拟回复话术\n• 总结聊天要点\n\n请复制聊天内容后按 Ctrl+Shift+M，或直接告诉我您需要什么帮助。`
  }

  if (app?.category === 'feishu' || app?.category === 'dingtalk') {
    return `检测到您正在使用${appLabel}。\n\n我可以帮您：\n• 草拟审批意见\n• 优化文档内容\n• 分析会议纪要\n• 回复工作消息\n\n请复制内容后按 Ctrl+Shift+M。`
  }

  return `收到。请告诉我您需要什么帮助，或者从其他应用复制内容后按 Ctrl+Shift+M，我会自动分析。\n\n当前支持的操作：\n• 文本分析与改写\n• 消息回复建议\n• 文档内容审查\n• 截图内容识别（Ctrl+Shift+S）`
}
