/**
 * 文档管理面板 — Documents Tab
 * 左侧：文档 AI 工具列表（审查/生成）+ 最近处理的文档
 * 右侧：选中工具的操作面板
 */

import { useState, useEffect } from 'react'
import type { ToolConfig, SolutionConfig } from '@/lib/solution-router'
import DocumentAIPanel from '@/components/tools/DocumentAIPanel'
import DocGeneratorForm from '@/components/tools/DocGeneratorForm'

interface Props {
  solution: SolutionConfig
}

interface RecentDoc {
  id: string
  name: string
  tool: string
  date: string
}

export default function DocumentsPanel({ solution }: Props) {
  const [activeTool, setActiveTool] = useState<ToolConfig | null>(null)
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([])

  const docTools = solution.tools.filter(t =>
    t.type === 'document-ai' || t.type === 'doc-generator'
  )

  useEffect(() => {
    loadRecentDocs()
  }, [solution.id])

  async function loadRecentDocs() {
    try {
      const api = (window as any).electronAPI
      if (!api?.db?.calc?.list) return
      const records = await api.db.calc.list(solution.id)
      const docs: RecentDoc[] = records
        .filter((r: any) => {
          const tool = solution.tools.find(t => t.id === r.tool_id)
          return tool && (tool.type === 'document-ai' || tool.type === 'doc-generator')
        })
        .slice(0, 10)
        .map((r: any) => ({
          id: r.id,
          name: JSON.parse(r.input_json || '{}').file_name || r.tool_id,
          tool: r.tool_id,
          date: r.created_at,
        }))
      setRecentDocs(docs)
    } catch {
      // SQLite 不可用时静默
    }
  }

  if (docTools.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <span className="text-5xl mb-4">📂</span>
        <h3 className="text-lg font-semibold mb-2">文档工具即将上线</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          此行业方案的文档处理工具正在建设中，请先使用对话功能咨询 AI 专家。
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* 左侧：工具列表 */}
      <div className="w-64 border-r border-border/30 flex flex-col shrink-0">
        {/* 文档工具 */}
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            文档工具
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          <div className="space-y-0.5">
            {docTools.map(tool => {
              const isActive = activeTool?.id === tool.id
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-secondary/30 text-foreground/80'
                  }`}
                >
                  <span className="text-lg shrink-0">{tool.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{tool.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {tool.type === 'document-ai' ? 'AI 分析' : 'AI 生成'}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* 最近处理的文档 */}
          {recentDocs.length > 0 && (
            <>
              <div className="px-2 pt-5 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  最近处理
                </h3>
              </div>
              <div className="space-y-0.5">
                {recentDocs.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/20 cursor-default text-sm"
                  >
                    <span className="text-base shrink-0">{getDocIcon(doc.name)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs">{doc.name}</p>
                      <p className="text-xs text-muted-foreground/50">
                        {doc.date ? new Date(doc.date).toLocaleDateString('zh-CN') : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 右侧：操作区 */}
      <div className="flex-1 overflow-y-auto">
        {activeTool ? (
          <div className="max-w-2xl mx-auto px-6 py-6">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setActiveTool(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ← 返回
              </button>
              <span className="text-xl">{activeTool.icon}</span>
              <div>
                <h2 className="text-base font-semibold">{activeTool.name}</h2>
                {activeTool.description && (
                  <p className="text-xs text-muted-foreground">{activeTool.description}</p>
                )}
              </div>
            </div>

            {activeTool.type === 'document-ai' && (
              <DocumentAIPanel tool={activeTool} color={solution.color} />
            )}
            {activeTool.type === 'doc-generator' && (
              <DocGeneratorForm tool={activeTool} color={solution.color} />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <span className="text-5xl mb-4">📑</span>
            <h3 className="text-lg font-semibold mb-2">选择文档工具</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              从左侧选择一个文档工具开始操作，支持合同审查、文书生成等功能。
            </p>
            {/* 快捷入口 */}
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              {docTools.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-secondary/20 text-sm transition-all"
                >
                  <span className="text-lg">{tool.icon}</span>
                  <span>{tool.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getDocIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const icons: Record<string, string> = {
    pdf: '📄', doc: '📝', docx: '📝', txt: '📋',
    jpg: '🖼', jpeg: '🖼', png: '🖼',
  }
  return icons[ext] || '📎'
}
