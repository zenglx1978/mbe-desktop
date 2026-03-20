/**
 * KnowledgeGraphPage — 知识图谱可视化页面（开发者 / 运营用）
 *
 * 布局：全屏图谱 + 左侧控制面板 + 右侧详情面板
 * 入口：/kb-graph（开发者工具路由）
 */

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildGraphFromRegistry, getAgentKBStats, type KGNode } from '@/lib/kb-graph-data'
import ForceGraph from '@/components/ForceGraph'
import { ArrowLeft, Circle, Diamond, Hexagon, Filter, Info, BarChart3 } from 'lucide-react'

export default function KnowledgeGraphPage() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [highlightAgent, setHighlightAgent] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<KGNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<KGNode | null>(null)
  const [showStats, setShowStats] = useState(false)

  const graphData = useMemo(() => buildGraphFromRegistry(), [])
  const agentStats = useMemo(() => getAgentKBStats(), [])

  // 容器尺寸追踪
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setDimensions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleNodeClick = useCallback((node: KGNode | null) => {
    setSelectedNode(node)
  }, [])

  const handleNodeHover = useCallback((node: KGNode | null) => {
    setHoveredNode(node)
  }, [])

  const totalNodes = graphData.nodes.length
  const totalEdges = graphData.edges.length

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* 顶栏 */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-card/50 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-semibold">知识图谱</h1>
          <span className="text-[10px] text-muted-foreground/50 px-2 py-0.5 rounded-full bg-muted/30">
            开发者工具
          </span>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground/50">
          <span>{totalNodes} 节点</span>
          <span>{totalEdges} 连接</span>
          <span>{agentStats.length} 个 Agent</span>
          <button
            onClick={() => setShowStats(!showStats)}
            className={`p-1 rounded transition-colors ${showStats ? 'text-primary bg-primary/10' : 'hover:text-foreground'}`}
            title="统计面板"
          >
            <BarChart3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：Agent 筛选 */}
        <aside className="w-48 shrink-0 border-r border-border/20 bg-card/30 p-3 overflow-y-auto">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 mb-3">
            <Filter className="w-3 h-3" />
            <span>Agent 筛选</span>
          </div>
          <button
            onClick={() => setHighlightAgent(null)}
            className={`w-full text-left text-[11px] px-2 py-1.5 rounded-md mb-1 transition-colors ${
              highlightAgent === null ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
          >
            全部 Agent
          </button>
          {agentStats.map((a) => (
            <button
              key={a.id}
              onClick={() => setHighlightAgent(highlightAgent === a.id ? null : a.id)}
              className={`w-full text-left text-[11px] px-2 py-1.5 rounded-md mb-0.5 transition-colors flex items-center gap-2 ${
                highlightAgent === a.id ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: a.color }}
              />
              <span className="flex-1">{a.name}</span>
              <span className="text-[9px] text-muted-foreground/40">{a.total}</span>
            </button>
          ))}

          {/* 图例 */}
          <div className="mt-6 pt-4 border-t border-border/20">
            <div className="text-[10px] text-muted-foreground/60 mb-2">图例</div>
            <div className="space-y-1.5">
              <LegendItem icon={<Circle className="w-3 h-3" />} color="#6366f1" label="Agent" />
              <LegendItem icon={<Circle className="w-2.5 h-2.5" />} color="#3b82f6" label="知识文件" />
              <LegendItem icon={<Diamond className="w-2.5 h-2.5" />} color="#f59e0b" label="计算规则" />
              <LegendItem icon={<Hexagon className="w-2.5 h-2.5" />} color="#10b981" label="解决方案" />
            </div>
            <div className="mt-3 space-y-1 text-[9px] text-muted-foreground/40">
              <p>滚轮缩放 · 拖拽平移</p>
              <p>点击节点查看详情</p>
              <p>节点越大 = 引用越多</p>
            </div>
          </div>
        </aside>

        {/* 中间：图谱画布 */}
        <div ref={containerRef} className="flex-1 relative">
          <ForceGraph
            nodes={graphData.nodes}
            edges={graphData.edges}
            width={dimensions.width}
            height={dimensions.height}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            highlightAgent={highlightAgent}
          />

          {/* hover tooltip */}
          {hoveredNode && !selectedNode && (
            <div className="absolute top-3 left-3 px-3 py-2 rounded-lg bg-card/90 border border-border/30 backdrop-blur-sm text-[11px] pointer-events-none z-10">
              <div className="font-medium text-foreground">{hoveredNode.label}</div>
              <div className="text-muted-foreground/60 mt-0.5">
                {NODE_TYPE_LABELS[hoveredNode.type]} · {hoveredNode.agentId} · 引用 {hoveredNode.refCount}
              </div>
            </div>
          )}

          {/* 统计面板 */}
          {showStats && (
            <div className="absolute bottom-3 left-3 right-3 max-w-lg mx-auto p-3 rounded-xl bg-card/95 border border-border/30 backdrop-blur-sm z-10">
              <div className="text-[10px] text-muted-foreground/50 mb-2 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> 知识库概览
              </div>
              <div className="grid grid-cols-4 gap-2">
                {agentStats.map((a) => (
                  <div
                    key={a.id}
                    className="text-center p-2 rounded-lg bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setHighlightAgent(a.id)}
                  >
                    <div className="text-lg font-bold tabular-nums" style={{ color: a.color }}>
                      {a.total}
                    </div>
                    <div className="text-[9px] text-muted-foreground/50">{a.name}</div>
                    <div className="flex justify-center gap-2 mt-1 text-[8px] text-muted-foreground/30">
                      <span>{a.mdCount} MD</span>
                      <span>{a.ruleCount} 规则</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧：详情面板 */}
        {selectedNode && (
          <aside className="w-64 shrink-0 border-l border-border/20 bg-card/30 p-4 overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                <Info className="w-3 h-3" />
                <span>节点详情</span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-[10px] text-muted-foreground/40 hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {/* 节点信息 */}
            <div
              className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center text-white text-lg font-bold"
              style={{ backgroundColor: getNodeColor(selectedNode) }}
            >
              {selectedNode.label.charAt(0)}
            </div>

            <h3 className="font-semibold text-sm mb-1">{selectedNode.label}</h3>
            <p className="text-[11px] text-muted-foreground/60 mb-4">
              {NODE_TYPE_LABELS[selectedNode.type]} · {selectedNode.agentId}
            </p>

            <div className="space-y-3">
              <DetailRow label="类型" value={NODE_TYPE_LABELS[selectedNode.type]} />
              <DetailRow label="所属 Agent" value={selectedNode.agentId} />
              <DetailRow label="引用次数" value={String(selectedNode.refCount)} />
              {selectedNode.category && (
                <DetailRow label="分类" value={selectedNode.category} />
              )}
              {selectedNode.triggers && selectedNode.triggers.length > 0 && (
                <div>
                  <div className="text-[10px] text-muted-foreground/50 mb-1">触发词</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.triggers.map((t) => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500/80">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 相关连接 */}
            <div className="mt-6 pt-4 border-t border-border/20">
              <div className="text-[10px] text-muted-foreground/50 mb-2">连接关系</div>
              <div className="space-y-1">
                {graphData.edges
                  .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                  .slice(0, 10)
                  .map((e, i) => {
                    const otherId = e.source === selectedNode.id ? e.target : e.source
                    const other = graphData.nodes.find((n) => n.id === otherId)
                    if (!other) return null
                    return (
                      <button
                        key={i}
                        className="w-full text-left text-[10px] px-2 py-1 rounded-md hover:bg-muted/30 transition-colors flex items-center gap-2"
                        onClick={() => setSelectedNode(other)}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: getNodeColor(other) }}
                        />
                        <span className="text-foreground/80 truncate">{other.label}</span>
                        <span className="text-muted-foreground/30 ml-auto">{EDGE_TYPE_LABELS[e.type]}</span>
                      </button>
                    )
                  })}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

// ── 子组件 ──

function LegendItem({ icon, color, label }: { icon: React.ReactNode; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span style={{ color }}>{icon}</span>
      <span className="text-muted-foreground/60">{label}</span>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-muted-foreground/50">{label}</span>
      <span className="text-foreground/80 font-medium">{value}</span>
    </div>
  )
}

// ── 常量 ──

const NODE_TYPE_LABELS: Record<string, string> = {
  agent: 'Agent',
  knowledge: '知识文件',
  rule: '计算规则',
  solution: '解决方案',
}

const EDGE_TYPE_LABELS: Record<string, string> = {
  owns: '拥有',
  references: '引用',
  belongs: '归属',
}

function getNodeColor(node: KGNode): string {
  const AGENT_COLORS: Record<string, string> = {
    finance: '#3b82f6', legal: '#8b5cf6', cost: '#f59e0b', pulmonary: '#06b6d4',
    cs: '#ec4899', hr: '#10b981', invest: '#ef4444', sales: '#f97316',
    growth: '#a855f7', education: '#14b8a6', insurance_cs: '#0ea5e9',
  }
  if (node.type === 'agent') return AGENT_COLORS[node.agentId] ?? '#6366f1'
  if (node.type === 'rule') return '#f59e0b'
  if (node.type === 'solution') return '#10b981'
  return '#3b82f6'
}
