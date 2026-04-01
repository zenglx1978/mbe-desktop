import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Search, Upload, Download, ChevronDown, ChevronRight, Briefcase, RefreshCw } from 'lucide-react'
import type { SolutionConfig } from '@/lib/solution-router'
import { API_BASE, authFetch, authHeaders } from '@/lib/api-client'

const LEGAL_API = `${API_BASE}/api/legal`

const CATEGORY_META: Record<string, { label: string; icon: string; cls: string }> = {
  contract:       { label: '合同文书', icon: '📜', cls: 'bg-amber-500/10 text-amber-500' },
  evidence:       { label: '证据材料', icon: '🔍', cls: 'bg-red-500/10 text-red-500' },
  correspondence: { label: '往来函件', icon: '📨', cls: 'bg-blue-500/10 text-blue-500' },
  court_doc:      { label: '法院文书', icon: '⚖️', cls: 'bg-purple-500/10 text-purple-500' },
  identity:       { label: '身份证明', icon: '🪪', cls: 'bg-green-500/10 text-green-500' },
  financial:      { label: '财务凭证', icon: '🧾', cls: 'bg-teal-500/10 text-teal-500' },
  photo:          { label: '照片影像', icon: '📷', cls: 'bg-pink-500/10 text-pink-500' },
  audio:          { label: '录音录像', icon: '🎙️', cls: 'bg-indigo-500/10 text-indigo-500' },
  other:          { label: '其他',     icon: '📄', cls: 'bg-secondary text-muted-foreground' },
}

interface CaseBrief {
  id: string
  title: string
  case_type?: string
  status?: string
  client_name?: string
  updated_at?: string
}

interface Attachment {
  id: string
  case_id: string
  file_name: string
  file_size: number
  file_size_display: string
  mime_type: string
  category: string
  category_label: string
  description?: string
  has_text: boolean
  ai_summary?: string
  ai_tags: string[]
  uploaded_by?: string
  created_at?: string
}

interface Props {
  solution: SolutionConfig
}

export default function CaseDocumentsPanel({ solution }: Props) {
  const [cases, setCases] = useState<CaseBrief[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [caseDropdownOpen, setCaseDropdownOpen] = useState(false)

  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    authFetch(`${LEGAL_API}/cases?page_size=50&sort_by=updated_at&sort_dir=desc`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.cases?.length) {
          setCases(data.cases)
          setSelectedCaseId(data.cases[0].id)
        } else {
          setCases([])
          setSelectedCaseId(null)
        }
      })
      .catch(() => setCases([]))
      .finally(() => setLoading(false))
  }, [solution.id])

  const fetchAttachments = useCallback((caseId: string, category?: string) => {
    setLoading(true)
    const url = category && category !== 'all'
      ? `${LEGAL_API}/cases/${caseId}/attachments?category=${category}`
      : `${LEGAL_API}/cases/${caseId}/attachments`
    authFetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setAttachments(data.attachments || [])
          setCategoryCounts(data.category_counts || {})
        }
      })
      .catch(() => setAttachments([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedCaseId) {
      setExpandedId(null)
      fetchAttachments(selectedCaseId)
    }
  }, [selectedCaseId, fetchAttachments])

  const handleCategoryFilter = useCallback((cat: string) => {
    setFilterCategory(cat)
    if (selectedCaseId) fetchAttachments(selectedCaseId, cat)
  }, [selectedCaseId, fetchAttachments])

  const handleUpload = useCallback(async (files: FileList) => {
    if (!selectedCaseId || files.length === 0) return
    setUploading(true)
    const headers = authHeaders()
    delete (headers as Record<string, string>)['Content-Type']

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file, file.name)
      formData.append('case_id', selectedCaseId)
      formData.append('auto_recognize', 'true')
      try {
        await fetch(`${LEGAL_API}/documents/upload`, {
          method: 'POST',
          headers,
          body: formData,
        })
      } catch { /* silent */ }
    }
    setUploading(false)
    fetchAttachments(selectedCaseId, filterCategory === 'all' ? undefined : filterCategory)
  }, [selectedCaseId, filterCategory, fetchAttachments])

  const handleDownload = useCallback(async (att: Attachment) => {
    try {
      const res = await authFetch(`${LEGAL_API}/attachments/${att.id}/download`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = att.file_name
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* silent */ }
  }, [])

  const selectedCase = useMemo(() => cases.find(c => c.id === selectedCaseId), [cases, selectedCaseId])

  const filtered = useMemo(() => {
    if (!search) return attachments
    const q = search.toLowerCase()
    return attachments.filter(a =>
      a.file_name.toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q) ||
      (a.ai_summary || '').toLowerCase().includes(q),
    )
  }, [attachments, search])

  const categoryGroups = useMemo(() =>
    Object.entries(categoryCounts)
      .filter(([, count]) => count > 0)
      .map(([cat, count]) => ({ cat, count, ...(CATEGORY_META[cat] || CATEGORY_META.other) })),
  [categoryCounts])

  if (loading && cases.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">加载案件列表...</div>
  }

  if (cases.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-5xl">📂</div>
          <p className="text-lg font-semibold">暂无案件</p>
          <p className="text-sm text-muted-foreground">通过对话或案件管理创建案件后，相关文档将在此集中展示</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* 案件选择器 */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <button
              onClick={() => setCaseDropdownOpen(!caseDropdownOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30 border border-border/50 text-sm text-left hover:border-primary/30 transition-colors"
            >
              <Briefcase className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate flex-1">{selectedCase?.title || '选择案件'}</span>
              {selectedCase?.status && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary">
                  {selectedCase.status}
                </span>
              )}
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
            {caseDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                {cases.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCaseId(c.id); setCaseDropdownOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${
                      c.id === selectedCaseId ? 'text-primary font-medium bg-primary/5' : ''
                    }`}
                  >
                    <span className="truncate block">{c.title}</span>
                    {c.client_name && <span className="text-[10px] text-muted-foreground">{c.client_name}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => selectedCaseId && fetchAttachments(selectedCaseId)}
            className="p-2 rounded-lg border border-border/50 hover:bg-secondary/30 transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 搜索 + 上传 */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索文件名、描述或摘要..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary/30 border border-border/50 text-sm outline-none focus:border-primary/50"
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => e.target.files && handleUpload(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !selectedCaseId}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <Upload className="w-4 h-4" />
            {uploading ? '上传中...' : '上传文件'}
          </button>
        </div>

        {/* 分类筛选 */}
        {categoryGroups.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleCategoryFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                filterCategory === 'all' ? 'bg-primary/10 text-primary font-medium' : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
              }`}
            >
              全部 ({attachments.length})
            </button>
            {categoryGroups.map(g => (
              <button
                key={g.cat}
                onClick={() => handleCategoryFilter(filterCategory === g.cat ? 'all' : g.cat)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 ${
                  filterCategory === g.cat ? 'bg-primary/10 text-primary font-medium' : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
                }`}
              >
                <span>{g.icon}</span> {g.label} ({g.count})
              </button>
            ))}
          </div>
        )}

        {/* 附件列表 */}
        {filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map(att => {
              const meta = CATEGORY_META[att.category] || CATEGORY_META.other
              const isExpanded = expandedId === att.id
              return (
                <div key={att.id}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : att.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                      isExpanded ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-card/50 hover:border-primary/20'
                    }`}
                  >
                    <span className="text-xl shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{att.file_name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {att.file_size_display}
                        {att.created_at && (
                          <span className="ml-1.5">
                            · {new Date(att.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {att.has_text && <span className="ml-1.5 text-green-500">· 已提取文本</span>}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] shrink-0 ${meta.cls}`}>
                      {att.category_label}
                    </span>
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                  {isExpanded && (
                    <div className="ml-6 mt-1 mb-3 rounded-xl border border-border/20 bg-card/30 p-4 space-y-3">
                      {att.description && (
                        <p className="text-sm text-foreground/80">{att.description}</p>
                      )}
                      {att.ai_summary && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">AI 摘要</p>
                          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{att.ai_summary}</p>
                        </div>
                      )}
                      {att.ai_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {att.ai_tags.map((tag, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-secondary/50 text-muted-foreground">{tag}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-2 border-t border-border/20">
                        <button
                          onClick={() => handleDownload(att)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-secondary/30 hover:bg-secondary/50 transition-colors"
                        >
                          <Download className="w-3 h-3" /> 下载
                        </button>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {att.mime_type}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12 space-y-4">
            <div className="text-5xl">📂</div>
            <div>
              <p className="text-lg font-semibold">
                {attachments.length > 0 ? '没有匹配的文件' : '该案件还没有文件'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {attachments.length > 0
                  ? '尝试调整搜索关键词或筛选条件'
                  : '在对话中上传文件或点击上方"上传文件"按钮添加案件材料'}
              </p>
            </div>
            {attachments.length === 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedCaseId}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                <Upload className="w-4 h-4" /> 上传文件
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
