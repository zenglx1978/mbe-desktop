import { useState } from 'react'
import type { ToolConfig, SolutionConfig } from '@/lib/solution-router'
import CalculatorForm from '@/components/tools/CalculatorForm'
import DocumentAIPanel from '@/components/tools/DocumentAIPanel'
import DocGeneratorForm from '@/components/tools/DocGeneratorForm'

interface Props {
  solution: SolutionConfig
}

export default function ToolPanel({ solution }: Props) {
  const [activeTool, setActiveTool] = useState<ToolConfig | null>(null)
  const tools = solution.tools

  if (tools.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-3">
          <div className="text-4xl">🔧</div>
          <p className="text-sm">当前方案暂无可用工具</p>
          <p className="text-xs">请切换到 💬对话 Tab 向 AI 专家提问</p>
        </div>
      </div>
    )
  }

  if (activeTool) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-3 border-b border-border/30 flex items-center gap-3">
          <button
            onClick={() => setActiveTool(null)}
            className="text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            ← 返回工具列表
          </button>
          <span className="text-border/50">|</span>
          <span className="text-lg">{activeTool.icon}</span>
          <span className="font-medium text-sm">{activeTool.name}</span>
          {activeTool.localScript && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
              离线可用
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ToolRenderer tool={activeTool} color={solution.color} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h3 className="text-lg font-bold">业务工具</h3>
          <p className="text-sm text-muted-foreground mt-1">
            结构化计算、文档处理、精确结果 · 标注置信度和法律依据
          </p>
        </div>

        {/* 按类型分组 */}
        <ToolGroup
          label="确定性计算器"
          icon="🧮"
          description="表单输入 → 精确计算 → 100% 确定性结果"
          tools={tools.filter(t => t.type === 'calculator')}
          onSelect={setActiveTool}
        />
        <ToolGroup
          label="文档 AI 分析"
          icon="📋"
          description="上传文档 → AI 智能分析 → 结构化报告"
          tools={tools.filter(t => t.type === 'document-ai')}
          onSelect={setActiveTool}
        />
        <ToolGroup
          label="文书生成"
          icon="📄"
          description="填写表单 → AI 生成 → 导出 Word/PDF"
          tools={tools.filter(t => t.type === 'doc-generator')}
          onSelect={setActiveTool}
        />
      </div>
    </div>
  )
}

function ToolGroup({ label, icon, description, tools, onSelect }: {
  label: string; icon: string; description: string
  tools: ToolConfig[]; onSelect: (t: ToolConfig) => void
}) {
  if (tools.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span>{icon}</span>
        <h4 className="text-sm font-medium">{label}</h4>
        <span className="text-xs text-muted-foreground">· {description}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tools.map(tool => (
          <button
            key={tool.id}
            onClick={() => onSelect(tool)}
            className="group flex items-start gap-3 p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all text-left"
          >
            <span className="text-2xl shrink-0 mt-0.5">{tool.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm group-hover:text-primary transition-colors">
                {tool.name}
              </div>
              {tool.description && (
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {tool.description}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                {tool.localScript && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
                    离线可用
                  </span>
                )}
                {tool.type === 'calculator' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">
                    100% 确定性
                  </span>
                )}
              </div>
            </div>
            <span className="text-muted-foreground/30 group-hover:text-primary/50 transition-colors text-sm mt-1">
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ToolRenderer({ tool, color }: { tool: ToolConfig; color: string }) {
  switch (tool.type) {
    case 'calculator':
      return <CalculatorForm tool={tool} color={color} />
    case 'document-ai':
      return <DocumentAIPanel tool={tool} color={color} />
    case 'doc-generator':
      return <DocGeneratorForm tool={tool} color={color} />
    default:
      return <div className="text-muted-foreground text-sm">此工具类型即将支持</div>
  }
}
