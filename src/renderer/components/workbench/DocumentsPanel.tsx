import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, FileText, Search, Download, ChevronDown, ChevronRight } from 'lucide-react'
import type { SolutionConfig } from '@/lib/solution-router'

interface DocItem {
  id: string
  title: string
  type: DocType
  content: string
  createdAt: string
  updatedAt: string
  source?: string
}

type DocType = 'report' | 'contract' | 'voucher' | 'checklist' | 'note' | 'other'

const DOC_TYPE_META: Record<DocType, { label: string; icon: string; cls: string }> = {
  report:    { label: '报告', icon: '📊', cls: 'bg-blue-500/10 text-blue-500' },
  contract:  { label: '合同', icon: '📜', cls: 'bg-amber-500/10 text-amber-500' },
  voucher:   { label: '凭证', icon: '🧾', cls: 'bg-green-500/10 text-green-500' },
  checklist: { label: '清单', icon: '✅', cls: 'bg-purple-500/10 text-purple-500' },
  note:      { label: '笔记', icon: '📝', cls: 'bg-cyan-500/10 text-cyan-500' },
  other:     { label: '其他', icon: '📄', cls: 'bg-secondary text-muted-foreground' },
}

function storageKey(solutionId: string) {
  return `mbe_docs_${solutionId}`
}

function loadDocs(solutionId: string): DocItem[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(solutionId)) || '[]')
  } catch {
    return []
  }
}

function saveDocs(solutionId: string, docs: DocItem[]) {
  localStorage.setItem(storageKey(solutionId), JSON.stringify(docs))
}

interface Props {
  solution: SolutionConfig
}

export default function DocumentsPanel({ solution }: Props) {
  const [docs, setDocs] = useState<DocItem[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<DocType | 'all'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)

  useEffect(() => {
    setDocs(loadDocs(solution.id))
    setSelectedDoc(null)
  }, [solution.id])

  const persist = useCallback((next: DocItem[]) => {
    setDocs(next)
    saveDocs(solution.id, next)
  }, [solution.id])

  const addDoc = useCallback((title: string, type: DocType, content: string) => {
    const doc: DocItem = {
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      type,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'manual',
    }
    persist([doc, ...docs])
    setShowAdd(false)
  }, [docs, persist])

  const deleteDoc = useCallback((id: string) => {
    persist(docs.filter(d => d.id !== id))
    if (selectedDoc === id) setSelectedDoc(null)
  }, [docs, selectedDoc, persist])

  const filtered = docs.filter(d => {
    if (filterType !== 'all' && d.type !== filterType) return false
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.content.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const typeGroups = Object.entries(DOC_TYPE_META).map(([type, meta]) => ({
    type: type as DocType,
    ...meta,
    count: docs.filter(d => d.type === type).length,
  })).filter(g => g.count > 0)

  const selectedItem = selectedDoc ? docs.find(d => d.id === selectedDoc) : null

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 头部：搜索 + 新建 */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索文档..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary/30 border border-border/50 text-sm outline-none focus:border-primary/50"
            />
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建
          </button>
        </div>

        {/* 类型筛选标签 */}
        {typeGroups.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                filterType === 'all' ? 'bg-primary/10 text-primary font-medium' : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
              }`}
            >
              全部 ({docs.length})
            </button>
            {typeGroups.map(g => (
              <button
                key={g.type}
                onClick={() => setFilterType(filterType === g.type ? 'all' : g.type)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 ${
                  filterType === g.type ? 'bg-primary/10 text-primary font-medium' : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
                }`}
              >
                <span>{g.icon}</span> {g.label} ({g.count})
              </button>
            ))}
          </div>
        )}

        {/* 新建文档表单 */}
        {showAdd && <AddDocForm onAdd={addDoc} onCancel={() => setShowAdd(false)} />}

        {/* 文档列表 */}
        {filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map(doc => {
              const meta = DOC_TYPE_META[doc.type]
              const isSelected = selectedDoc === doc.id
              return (
                <div key={doc.id}>
                  <button
                    onClick={() => setSelectedDoc(isSelected ? null : doc.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                      isSelected ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-card/50 hover:border-primary/20'
                    }`}
                  >
                    <span className="text-xl shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(doc.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {doc.source && doc.source !== 'manual' && <span className="ml-1.5">· 来自 {doc.source}</span>}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${meta.cls}`}>
                      {meta.label}
                    </span>
                    {isSelected ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                  {isSelected && selectedItem && (
                    <div className="ml-6 mt-1 mb-3 rounded-xl border border-border/20 bg-card/30 p-4 space-y-3">
                      <div className="prose prose-sm prose-invert max-w-none text-sm whitespace-pre-wrap leading-relaxed">
                        {selectedItem.content}
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t border-border/20">
                        <button
                          onClick={() => navigator.clipboard.writeText(selectedItem.content)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-secondary/30 hover:bg-secondary/50 transition-colors"
                        >
                          <Download className="w-3 h-3" /> 复制内容
                        </button>
                        <button
                          onClick={() => deleteDoc(doc.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
                        >
                          <Trash2 className="w-3 h-3" /> 删除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyDocs hasAny={docs.length > 0} onAdd={() => setShowAdd(true)} />
        )}
      </div>
    </div>
  )
}

function AddDocForm({ onAdd, onCancel }: { onAdd: (title: string, type: DocType, content: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<DocType>('note')
  const [content, setContent] = useState('')

  return (
    <div className="rounded-xl border border-primary/20 bg-card/50 p-4 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" /> 新建文档
      </h3>
      <div className="grid gap-3">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="文档标题"
          className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border/50 text-sm outline-none focus:border-primary/50"
        />
        <select
          value={type}
          onChange={e => setType(e.target.value as DocType)}
          className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border/50 text-sm outline-none focus:border-primary/50"
        >
          {Object.entries(DOC_TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="文档内容..."
          rows={6}
          className="w-full px-3 py-2 rounded-lg bg-secondary/30 border border-border/50 text-sm outline-none focus:border-primary/50 resize-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => title.trim() && onAdd(title.trim(), type, content)}
          disabled={!title.trim()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          保存
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-border/50 text-sm hover:bg-secondary/30 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  )
}

function EmptyDocs({ hasAny, onAdd }: { hasAny: boolean; onAdd: () => void }) {
  return (
    <div className="text-center py-12 space-y-4">
      <div className="text-5xl">📄</div>
      <div>
        <p className="text-lg font-semibold text-foreground">
          {hasAny ? '没有匹配的文档' : '还没有文档'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {hasAny
            ? '尝试调整搜索关键词或筛选条件'
            : '工作流执行后会自动生成文档，你也可以手动创建笔记和清单'}
        </p>
      </div>
      {!hasAny && (
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> 新建文档
        </button>
      )}
    </div>
  )
}
