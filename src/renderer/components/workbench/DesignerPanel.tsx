import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { SolutionConfig } from '@/lib/solution-router'
import {
  createCanvas,
  fetchCanvas,
  listCanvases,
  validateCanvas,
  exportCanvas,
  fetchTemplates,
  type DesignerCanvasDef,
  type WorkflowTemplateDef,
} from '@/lib/workflow-os-service'

interface Props {
  solution: SolutionConfig
}

type DragState = { nodeId: string; offsetX: number; offsetY: number } | null

const NODE_W = 200
const NODE_H = 72
const NODE_TYPES: Record<string, { icon: string; color: string }> = {
  expert:       { icon: '🧠', color: '#3b82f6' },
  operation:    { icon: '⚙️', color: '#8b5cf6' },
  cross_agent:  { icon: '🌐', color: '#f59e0b' },
  approval:     { icon: '🛡️', color: '#ef4444' },
  default:      { icon: '📦', color: '#6b7280' },
}

export default function DesignerPanel({ solution }: Props) {
  const agentName = solution.agents[0]?.id || 'finance'
  const svgRef = useRef<SVGSVGElement>(null)

  const [canvases, setCanvases] = useState<Array<{ canvas_id: string; name: string; nodes: number }>>([])
  const [canvas, setCanvas] = useState<DesignerCanvasDef | null>(null)
  const [templates, setTemplates] = useState<WorkflowTemplateDef[]>([])
  const [newName, setNewName] = useState('')
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [drag, setDrag] = useState<DragState>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'canvas'>('list')

  const refresh = useCallback(async () => {
    setLoading(true)
    const [c, t] = await Promise.all([
      listCanvases(agentName),
      fetchTemplates(agentName),
    ])
    setCanvases(c)
    setTemplates(t)
    setLoading(false)
  }, [agentName])

  useEffect(() => { refresh() }, [refresh])

  const handleCreate = async () => {
    if (!newName.trim()) return
    const c = await createCanvas(agentName, newName.trim())
    if (c) {
      setCanvas(c)
      setView('canvas')
      setNewName('')
      await refresh()
    }
  }

  const handleOpen = async (canvasId: string) => {
    const c = await fetchCanvas(agentName, canvasId)
    if (c) {
      setCanvas(c)
      setView('canvas')
      setValidation(null)
      setSelectedNode(null)
    }
  }

  const handleValidate = async () => {
    if (!canvas) return
    const v = await validateCanvas(agentName, canvas.canvas_id)
    setValidation(v)
  }

  const handleExport = async () => {
    if (!canvas) return
    const data = await exportCanvas(agentName, canvas.canvas_id)
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${canvas.name || 'workflow'}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleFromTemplate = async (tmpl: WorkflowTemplateDef) => {
    const c = await createCanvas(agentName, `${tmpl.name} (可视化)`)
    if (!c) return
    c.nodes = tmpl.steps.map((step, i) => ({
      node_id: step.id,
      node_type: 'expert',
      label: step.name,
      agent: agentName,
      expert: '',
      description: '',
      x: 100 + (i % 3) * 250,
      y: 100 + Math.floor(i / 3) * 130,
      sla_minutes: 0,
      requires_approval: false,
    }))
    c.edges = tmpl.steps.slice(1).map((step, i) => ({
      edge_id: `e_${i}`,
      source: tmpl.steps[i].id,
      target: step.id,
      label: '',
      condition: '',
    }))
    setCanvas(c)
    setView('canvas')
    await refresh()
  }

  // SVG 节点拖拽
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (!canvas) return
    const node = canvas.nodes.find(n => n.node_id === nodeId)
    if (!node) return
    const svg = svgRef.current
    if (!svg) return
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()?.inverse()
    if (!ctm) return
    const svgPt = pt.matrixTransform(ctm)
    setDrag({ nodeId, offsetX: svgPt.x - node.x, offsetY: svgPt.y - node.y })
    setSelectedNode(nodeId)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drag || !canvas || !svgRef.current) return
    const pt = svgRef.current.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svgRef.current.getScreenCTM()?.inverse()
    if (!ctm) return
    const svgPt = pt.matrixTransform(ctm)
    setCanvas({
      ...canvas,
      nodes: canvas.nodes.map(n =>
        n.node_id === drag.nodeId
          ? { ...n, x: svgPt.x - drag.offsetX, y: svgPt.y - drag.offsetY }
          : n
      ),
    })
  }

  const handleMouseUp = () => { setDrag(null) }

  const edgePaths = useMemo(() => {
    if (!canvas) return []
    const nodeMap = new Map(canvas.nodes.map(n => [n.node_id, n]))
    return canvas.edges.map(edge => {
      const src = nodeMap.get(edge.source)
      const tgt = nodeMap.get(edge.target)
      if (!src || !tgt) return null
      const sx = src.x + NODE_W / 2
      const sy = src.y + NODE_H
      const tx = tgt.x + NODE_W / 2
      const ty = tgt.y
      const cy = (sy + ty) / 2
      return { ...edge, d: `M${sx},${sy} C${sx},${cy} ${tx},${cy} ${tx},${ty}` }
    }).filter(Boolean)
  }, [canvas])

  // ── 列表视图 ──
  if (view === 'list') {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">工作流设计器</h2>
          <p className="text-sm text-muted-foreground">可视化拖拽设计工作流 — 创建画布或从模板导入</p>
        </div>

        {/* 创建新画布 */}
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="新画布名称..."
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            + 新建
          </button>
        </div>

        {/* 已有画布 */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">已有画布</h3>
          {canvases.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">暂无画布，创建一个或从模板导入</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {canvases.map(c => (
              <button
                key={c.canvas_id}
                onClick={() => handleOpen(c.canvas_id)}
                className="p-4 rounded-xl border border-border hover:border-primary/60 text-left transition-colors"
              >
                <p className="font-medium text-sm text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.nodes} 个节点</p>
              </button>
            ))}
          </div>
        </div>

        {/* 从模板导入 */}
        {templates.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">从模板导入</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleFromTemplate(t)}
                  className="p-4 rounded-xl border border-dashed border-border hover:border-primary/60 text-left transition-colors"
                >
                  <p className="font-medium text-sm text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.steps.length} 步骤</p>
                  {t.schedule && <p className="text-xs text-primary mt-0.5">🕐 {t.schedule}</p>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── 画布视图 ──
  const selNode = canvas?.nodes.find(n => n.node_id === selectedNode)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background/80 backdrop-blur-sm">
        <button onClick={() => { setView('list'); setCanvas(null) }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← 返回
        </button>
        <span className="text-sm font-medium text-foreground">{canvas?.name || '画布'}</span>
        <div className="flex-1" />
        <button onClick={handleValidate} className="px-3 py-1 text-xs rounded-md border border-border hover:bg-muted transition-colors">
          ✓ 验证
        </button>
        <button onClick={handleExport} className="px-3 py-1 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
          ⬇ 导出 YAML
        </button>
      </div>

      {/* 验证结果 */}
      {validation && (
        <div className={`px-4 py-2 text-xs ${validation.valid ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
          {validation.valid ? '✓ 工作流验证通过' : `✗ ${validation.errors.join('; ')}`}
          {validation.warnings.length > 0 && <span className="ml-2 text-amber-600">⚠ {validation.warnings.join('; ')}</span>}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* 画布 SVG */}
        <div className="flex-1 bg-muted/30 overflow-hidden">
          <svg
            ref={svgRef}
            className="w-full h-full"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                <path d="M0,0 L10,4 L0,8 Z" className="fill-muted-foreground/60" />
              </marker>
            </defs>

            {/* 网格 */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" className="stroke-border/30" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* 边 */}
            {edgePaths.map(ep => ep && (
              <path
                key={ep.edge_id}
                d={ep.d}
                fill="none"
                className="stroke-muted-foreground/40"
                strokeWidth="2"
                markerEnd="url(#arrow)"
              />
            ))}

            {/* 节点 */}
            {canvas?.nodes.map(node => {
              const typeInfo = NODE_TYPES[node.node_type] || NODE_TYPES.default
              const isSelected = selectedNode === node.node_id
              return (
                <g
                  key={node.node_id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={e => handleMouseDown(e, node.node_id)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx="12"
                    className={isSelected ? 'fill-background' : 'fill-background'}
                    stroke={isSelected ? typeInfo.color : 'var(--border)'}
                    strokeWidth={isSelected ? 2.5 : 1}
                    filter={isSelected ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))' : undefined}
                  />
                  <text x="16" y="28" fontSize="16">{typeInfo.icon}</text>
                  <text x="38" y="30" fontSize="13" className="fill-foreground font-medium" textAnchor="start">
                    {node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label}
                  </text>
                  <text x="16" y="52" fontSize="10" className="fill-muted-foreground">
                    {node.node_type}{node.requires_approval ? ' · 需审批' : ''}
                  </text>
                  {/* 连接点 */}
                  <circle cx={NODE_W / 2} cy={0} r="4" fill={typeInfo.color} className="opacity-60" />
                  <circle cx={NODE_W / 2} cy={NODE_H} r="4" fill={typeInfo.color} className="opacity-60" />
                </g>
              )
            })}
          </svg>
        </div>

        {/* 右侧属性面板 */}
        <div className="w-64 border-l border-border bg-background overflow-y-auto p-4 space-y-4">
          <h3 className="text-sm font-medium text-foreground">属性</h3>
          {selNode ? (
            <div className="space-y-3">
              <PropField label="ID" value={selNode.node_id} />
              <PropField label="名称" value={selNode.label} />
              <PropField label="类型" value={selNode.node_type} />
              <PropField label="Agent" value={selNode.agent} />
              <PropField label="Expert" value={selNode.expert || '—'} />
              <PropField label="SLA (分钟)" value={selNode.sla_minutes || '—'} />
              <PropField label="需审批" value={selNode.requires_approval ? '是' : '否'} />
              {selNode.description && <PropField label="描述" value={selNode.description} />}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">点击节点查看属性</p>
          )}

          {canvas && (
            <div className="pt-4 border-t border-border space-y-2">
              <p className="text-xs text-muted-foreground">{canvas.nodes.length} 节点 · {canvas.edges.length} 连线</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PropField({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{String(value)}</p>
    </div>
  )
}
