/**
 * KnowledgeGraphPanel — 知识图谱工作台面板
 *
 * 三层结构:
 *  1. 概览: 统计数据 + 社区列表 + 全局搜索
 *  2. 社区钻取: 社区内节点列表
 *  3. 节点详情: 邻居关系图
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, Network, ChevronLeft, Loader2, AlertCircle,
  Hash, Link2, Users, ArrowRight, Layers,
} from 'lucide-react'
import {
  fetchGraphHealth,
  fetchGraphStats,
  fetchCommunities,
  searchNodes,
  fetchNodeDetail,
  fetchCommunityDetail,
  type GraphStats,
  type CommunityItem,
  type SearchResult,
  type NodeDetail,
  type CommunityDetail,
} from '@/lib/graph-api-service'

type View = 'overview' | 'community' | 'node'

export default function KnowledgeGraphPanel() {
  const [healthy, setHealthy] = useState<boolean | null>(null)
  const [stats, setStats] = useState<GraphStats | null>(null)
  const [communities, setCommunities] = useState<CommunityItem[]>([])
  const [view, setView] = useState<View>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [communityDetail, setCommunityDetail] = useState<CommunityDetail | null>(null)
  const [nodeDetail, setNodeDetail] = useState<NodeDetail | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  // ── 初始加载 ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const h = await fetchGraphHealth()
        if (cancelled) return
        setHealthy(!!h)
        if (!h) {
          setError('知识图谱服务不可用')
          setLoading(false)
          return
        }
        const [s, c] = await Promise.all([
          fetchGraphStats(),
          fetchCommunities(5, 100),
        ])
        if (cancelled) return
        setStats(s)
        setCommunities(c)
      } catch (e) {
        if (!cancelled) setError(String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // ── 搜索 (debounced) ───────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults(null); return }
    setSearching(true)
    try {
      const r = await searchNodes(q, undefined, 30)
      setSearchResults(r)
    } catch {
      setSearchResults(null)
    } finally {
      setSearching(false)
    }
  }, [])

  const handleSearchInput = useCallback((val: string) => {
    setSearchQuery(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => doSearch(val), 400)
  }, [doSearch])

  // ── 钻取操作 ────────────────────────────────────────────
  const openCommunity = useCallback(async (id: number) => {
    setLoading(true)
    setError(null)
    try {
      const d = await fetchCommunityDetail(id)
      setCommunityDetail(d)
      setView('community')
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const openNode = useCallback(async (nodeId: string) => {
    setLoading(true)
    setError(null)
    try {
      const d = await fetchNodeDetail(nodeId)
      setNodeDetail(d)
      setView('node')
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const goBack = useCallback(() => {
    if (view === 'node' && communityDetail) {
      setView('community')
    } else {
      setView('overview')
      setCommunityDetail(null)
      setNodeDetail(null)
    }
  }, [view, communityDetail])

  // ── 渲染 ───────────────────────────────────────────────
  if (loading && view === 'overview' && !stats) {
    return <CenteredMessage icon={<Loader2 className="animate-spin" size={32} />} text="加载知识图谱…" />
  }
  if (error && !stats) {
    return <CenteredMessage icon={<AlertCircle size={32} className="text-red-400" />} text={error} />
  }

  return (
    <div className="flex flex-col h-full overflow-hidden text-sm">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-2 border-b border-white/10 shrink-0">
        {view !== 'overview' && (
          <button onClick={goBack} className="p-1 rounded hover:bg-white/10 transition-colors">
            <ChevronLeft size={18} />
          </button>
        )}
        <Network size={18} className="text-blue-400" />
        <span className="font-medium">
          {view === 'overview' && '知识图谱'}
          {view === 'community' && communityDetail && `社区 #${communityDetail.community_id}: ${communityDetail.label}`}
          {view === 'node' && nodeDetail && nodeDetail.node.label}
        </span>
        {healthy === false && (
          <span className="ml-auto text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={12} /> 服务离线
          </span>
        )}
        {loading && <Loader2 size={14} className="ml-auto animate-spin text-white/40" />}
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {view === 'overview' && (
          <OverviewView
            stats={stats}
            communities={communities}
            searchQuery={searchQuery}
            searchResults={searchResults}
            searching={searching}
            onSearch={handleSearchInput}
            onOpenCommunity={openCommunity}
            onOpenNode={openNode}
          />
        )}
        {view === 'community' && communityDetail && (
          <CommunityView detail={communityDetail} onOpenNode={openNode} />
        )}
        {view === 'node' && nodeDetail && (
          <NodeView detail={nodeDetail} onOpenNode={openNode} onOpenCommunity={openCommunity} />
        )}
      </div>
    </div>
  )
}

// ── 子组件 ────────────────────────────────────────────────

function CenteredMessage({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-white/50">
      {icon}
      <p>{text}</p>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white/5 rounded-lg p-3 flex items-center gap-3">
      <div className="text-blue-400">{icon}</div>
      <div>
        <div className="text-lg font-semibold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        <div className="text-xs text-white/40">{label}</div>
      </div>
    </div>
  )
}

interface OverviewProps {
  stats: GraphStats | null
  communities: CommunityItem[]
  searchQuery: string
  searchResults: SearchResult | null
  searching: boolean
  onSearch: (q: string) => void
  onOpenCommunity: (id: number) => void
  onOpenNode: (id: string) => void
}

function OverviewView({
  stats, communities, searchQuery, searchResults, searching,
  onSearch, onOpenCommunity, onOpenNode,
}: OverviewProps) {
  return (
    <>
      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={<Hash size={18} />} label="节点" value={stats.nodes} />
          <StatCard icon={<Link2 size={18} />} label="边" value={stats.edges} />
          <StatCard icon={<Users size={18} />} label="社区" value={stats.communities} />
          <StatCard icon={<Layers size={18} />} label="平均度" value={stats.avg_degree.toFixed(1)} />
        </div>
      )}

      {/* 搜索 */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="搜索节点（名称、类型…）"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
        />
        {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-white/40" />}
      </div>

      {/* 搜索结果 */}
      {searchResults && searchResults.count > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs text-white/40 font-medium">搜索结果 ({searchResults.count})</h3>
          <div className="divide-y divide-white/5 max-h-60 overflow-y-auto rounded-lg border border-white/10">
            {searchResults.results.map((n) => (
              <button
                key={n.id}
                onClick={() => onOpenNode(n.id)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors text-left"
              >
                <div className="truncate">
                  <span className="text-white/80">{n.label}</span>
                  <span className="ml-2 text-xs text-white/30">{n.type}</span>
                </div>
                <ArrowRight size={14} className="text-white/20 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 社区列表 */}
      <div className="space-y-1">
        <h3 className="text-xs text-white/40 font-medium">知识社区 ({communities.length})</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {communities.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpenCommunity(c.id)}
              className="bg-white/5 hover:bg-white/8 rounded-lg p-3 text-left transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-white/80 truncate">{c.label || `社区 #${c.id}`}</span>
                <ArrowRight size={14} className="text-white/20 group-hover:text-white/40 transition-colors shrink-0" />
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                <span>{c.size} 节点</span>
                {c.top_nodes.length > 0 && (
                  <span className="truncate">{c.top_nodes.slice(0, 3).join(', ')}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function CommunityView({ detail, onOpenNode }: { detail: CommunityDetail; onOpenNode: (id: string) => void }) {
  const [filter, setFilter] = useState('')
  const filtered = detail.nodes.filter(
    (n) => !filter || n.label.toLowerCase().includes(filter.toLowerCase()) || n.type.includes(filter),
  )

  return (
    <>
      <div className="flex items-center gap-3 text-xs text-white/40">
        <span>{detail.node_count} 节点</span>
        <span>{detail.edge_count} 边</span>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          placeholder="过滤节点…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
        />
      </div>

      <div className="divide-y divide-white/5 rounded-lg border border-white/10 max-h-[calc(100vh-280px)] overflow-y-auto">
        {filtered.map((n) => (
          <button
            key={n.id}
            onClick={() => onOpenNode(n.id)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors text-left"
          >
            <div className="flex-1 truncate">
              <span className="text-white/80">{n.label}</span>
              <span className="ml-2 text-xs text-white/30">{n.type}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-white/20">度 {n.degree}</span>
              <ArrowRight size={14} className="text-white/20" />
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-white/30">无匹配节点</div>
        )}
      </div>
    </>
  )
}

function NodeView({
  detail, onOpenNode, onOpenCommunity,
}: {
  detail: NodeDetail
  onOpenNode: (id: string) => void
  onOpenCommunity: (id: number) => void
}) {
  const { node, neighbors } = detail

  return (
    <>
      {/* 基本信息 */}
      <div className="bg-white/5 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">{node.label}</span>
          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">{node.type}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40">
          <span>度: {node.degree}</span>
          <button
            onClick={() => onOpenCommunity(node.community)}
            className="hover:text-blue-400 transition-colors"
          >
            社区: {node.community_label || `#${node.community}`}
          </button>
        </div>
      </div>

      {/* 邻居列表 */}
      <div className="space-y-1">
        <h3 className="text-xs text-white/40 font-medium">关联节点 ({neighbors.length})</h3>
        <div className="divide-y divide-white/5 rounded-lg border border-white/10 max-h-[calc(100vh-340px)] overflow-y-auto">
          {neighbors.map((nb, i) => (
            <button
              key={`${nb.node.id}-${i}`}
              onClick={() => onOpenNode(nb.node.id)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors text-left"
            >
              <div className="flex-1 truncate">
                <span className="text-white/80">{nb.node.label}</span>
                <span className="ml-2 text-xs text-white/30">{nb.node.type}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs text-white/20">
                <span>{nb.edge_type}</span>
                <span className="text-white/10">{nb.direction === 'outgoing' ? '→' : '←'}</span>
              </div>
            </button>
          ))}
          {neighbors.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-white/30">无关联节点</div>
          )}
        </div>
      </div>
    </>
  )
}
