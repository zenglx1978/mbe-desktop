/**
 * 热力图分析页 — 汇聚三个后端已有数据端点的前端展示
 *
 * 1. AI 价值链六层瓶颈分数 (/api/invest/bottleneck/heatmap)
 * 2. 产业链行业 AI 冲击热力图 (/api/invest/chain/heatmap)
 * 3. 合同审查风险分布 (/api/legal/ai/contract-review-parallel → risk_heatmap)
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, AlertTriangle, Layers, Shield, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import HeatmapChart, { type HeatmapCell } from '@/components/charts/HeatmapChart'
import { authFetch, API_BASE } from '@/lib/api-client'

/* ---- 类型 ---- */

interface BottleneckLayer {
  layer: string
  name: string
  name_cn: string
  score: number
  is_bottleneck: boolean
}

interface BottleneckData {
  layers: BottleneckLayer[]
  current_bottleneck: string
}

interface ChainIndustry {
  avg_impact: number
  max_impact: number
  min_impact: number
  high_impact_count: number
  opportunity_count: number
}

interface ChainData {
  heatmap: Record<string, ChainIndustry>
  industries_count: number
}

interface RiskDistribution {
  high: { count: number; percent: number }
  medium: { count: number; percent: number }
  low: { count: number; percent: number }
  safe: { count: number; percent: number }
}

interface RiskHeatmap {
  total_clauses: number
  risk_distribution: RiskDistribution
  high_risk_items: { index: number; title: string; score: number; issues: string[] }[]
}

/* ---- 静态 mock（后端不可达时的示例数据） ---- */

const MOCK_BOTTLENECK: BottleneckData = {
  layers: [
    { layer: 'L1', name: 'Energy', name_cn: '能源/电力', score: 3.2, is_bottleneck: false },
    { layer: 'L2', name: 'Chips', name_cn: '芯片/算力', score: 4.5, is_bottleneck: true },
    { layer: 'L3', name: 'Infrastructure', name_cn: '基础设施', score: 2.8, is_bottleneck: false },
    { layer: 'L4', name: 'Models', name_cn: '模型/算法', score: 3.7, is_bottleneck: false },
    { layer: 'L5', name: 'Applications', name_cn: '应用层', score: 2.1, is_bottleneck: false },
    { layer: 'L6', name: 'Safety', name_cn: '安全/合规', score: 3.9, is_bottleneck: false },
  ],
  current_bottleneck: 'Chips',
}

const MOCK_CHAIN: ChainData = {
  heatmap: {
    '金融': { avg_impact: 4.2, max_impact: 5.0, min_impact: 2.5, high_impact_count: 8, opportunity_count: 12 },
    '法律': { avg_impact: 3.8, max_impact: 4.5, min_impact: 2.0, high_impact_count: 6, opportunity_count: 9 },
    '医疗': { avg_impact: 3.5, max_impact: 4.8, min_impact: 1.5, high_impact_count: 5, opportunity_count: 7 },
    '教育': { avg_impact: 3.9, max_impact: 4.6, min_impact: 2.2, high_impact_count: 7, opportunity_count: 10 },
    '制造': { avg_impact: 2.8, max_impact: 3.5, min_impact: 1.2, high_impact_count: 3, opportunity_count: 5 },
    '零售': { avg_impact: 3.3, max_impact: 4.0, min_impact: 1.8, high_impact_count: 4, opportunity_count: 8 },
  },
  industries_count: 6,
}

const MOCK_RISK: RiskHeatmap = {
  total_clauses: 24,
  risk_distribution: {
    high: { count: 3, percent: 12.5 },
    medium: { count: 7, percent: 29.2 },
    low: { count: 6, percent: 25.0 },
    safe: { count: 8, percent: 33.3 },
  },
  high_risk_items: [
    { index: 5, title: '违约金条款', score: 0.85, issues: ['金额超出合理范围', '未约定上限'] },
    { index: 12, title: '知识产权归属', score: 0.78, issues: ['归属约定模糊'] },
    { index: 18, title: '免责条款', score: 0.72, issues: ['免责范围过广'] },
  ],
}

/* ---- 组件 ---- */

export default function AnalyticsHeatmaps() {
  const navigate = useNavigate()
  const [bottleneck, setBottleneck] = useState<BottleneckData | null>(null)
  const [chain, setChain] = useState<ChainData | null>(null)
  const [risk, setRisk] = useState<RiskHeatmap | null>(null)
  const [loading, setLoading] = useState(false)
  const [useMock, setUseMock] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    let anyFailed = false

    try {
      const res = await authFetch(`${API_BASE}/api/invest/bottleneck/heatmap`)
      if (res.ok) {
        setBottleneck(await res.json())
      } else throw new Error()
    } catch {
      setBottleneck(MOCK_BOTTLENECK)
      anyFailed = true
    }

    try {
      const res = await authFetch(`${API_BASE}/api/invest/chain/heatmap`)
      if (res.ok) {
        const json = await res.json()
        setChain(json.data || json)
      } else throw new Error()
    } catch {
      setChain(MOCK_CHAIN)
      anyFailed = true
    }

    try {
      const res = await authFetch(`${API_BASE}/api/legal/ai/contract-review-parallel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '' }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.risk_heatmap) setRisk(json.risk_heatmap)
        else throw new Error()
      } else throw new Error()
    } catch {
      setRisk(MOCK_RISK)
      anyFailed = true
    }

    setUseMock(anyFailed)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  /* 产业链热力图数据转换 */
  const chainHeatCells = useMemo<HeatmapCell[]>(() => {
    if (!chain) return []
    const metrics = ['avg_impact', 'max_impact', 'high_impact_count', 'opportunity_count'] as const
    const metricLabels: Record<string, string> = {
      avg_impact: '平均冲击',
      max_impact: '最大冲击',
      high_impact_count: '高冲击数',
      opportunity_count: '机会数',
    }
    const cells: HeatmapCell[] = []
    Object.entries(chain.heatmap).forEach(([industry, data]) => {
      metrics.forEach(m => {
        cells.push({
          row: industry,
          col: metricLabels[m],
          value: data[m],
          label: data[m].toFixed(1),
        })
      })
    })
    return cells
  }, [chain])

  const chainRows = useMemo(() => chain ? Object.keys(chain.heatmap) : [], [chain])
  const chainCols = ['平均冲击', '最大冲击', '高冲击数', '机会数']

  /* 风险分布数据 */
  const riskBarData = useMemo(() => {
    if (!risk) return []
    const rd = risk.risk_distribution
    return [
      { level: '高风险', count: rd.high.count, pct: rd.high.percent, fill: '#ef4444' },
      { level: '中风险', count: rd.medium.count, pct: rd.medium.percent, fill: '#f59e0b' },
      { level: '低风险', count: rd.low.count, pct: rd.low.percent, fill: '#22c55e' },
      { level: '安全', count: rd.safe.count, pct: rd.safe.percent, fill: '#3b82f6' },
    ]
  }, [risk])

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶栏 */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-md hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold">数据热力图分析</h1>
          <p className="text-[10px] text-muted-foreground">
            法律风险 · 投资瓶颈 · 产业链冲击
            {useMock && <span className="ml-2 text-amber-500">（示例数据 — 后端未连接）</span>}
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-secondary/30 hover:bg-secondary/50 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* 1. AI 价值链瓶颈柱状图 */}
          {bottleneck && (
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-cyan-500" />
                <h2 className="text-sm font-semibold">AI 价值链六层瓶颈评分</h2>
                <span className="ml-auto text-xs text-amber-500 font-medium">
                  当前瓶颈：{bottleneck.layers.find(l => l.name === bottleneck.current_bottleneck)?.name_cn || bottleneck.current_bottleneck}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={bottleneck.layers.map(l => ({
                    name: l.name_cn,
                    score: l.score,
                    bottleneck: l.is_bottleneck,
                  }))}
                  margin={{ top: 4, right: 20, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 5]}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload?.[0]) return null
                      const d = payload[0].payload as { name: string; score: number; bottleneck: boolean }
                      return (
                        <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                          <p className="font-medium">{d.name}</p>
                          <p>评分：<strong>{d.score.toFixed(1)}</strong>/5</p>
                          {d.bottleneck && <p className="text-amber-500 font-bold mt-1">⚠ 瓶颈层</p>}
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {bottleneck.layers.map((l, i) => (
                      <Cell
                        key={i}
                        fill={l.is_bottleneck ? '#f59e0b' : 'hsl(var(--primary) / 0.55)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* 2. 产业链 AI 冲击热力图 */}
          {chain && chainHeatCells.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                <h2 className="text-sm font-semibold">产业链 AI 冲击热力图</h2>
                <span className="text-[10px] text-muted-foreground ml-2">
                  {chain.industries_count} 个行业
                </span>
              </div>
              <HeatmapChart
                data={chainHeatCells}
                rows={chainRows}
                cols={chainCols}
                colorLow="210 70% 90%"
                colorHigh="0 85% 50%"
                min={0}
                max={5}
                cellSize={56}
              />
            </section>
          )}

          {/* 3. 合同审查风险分布 */}
          {risk && (
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-red-500" />
                <h2 className="text-sm font-semibold">合同条款风险分布</h2>
                <span className="text-[10px] text-muted-foreground ml-2">
                  共 {risk.total_clauses} 条款
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 风险等级分布柱状图 */}
                <div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={riskBarData} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                      <XAxis
                        dataKey="level"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ payload }) => {
                          if (!payload?.[0]) return null
                          const d = payload[0].payload as { level: string; count: number; pct: number }
                          return (
                            <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                              <p className="font-medium">{d.level}</p>
                              <p>{d.count} 条 ({d.pct.toFixed(1)}%)</p>
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {riskBarData.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 高风险条款列表 */}
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-red-500 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    高风险条款
                  </h3>
                  {risk.high_risk_items.map((item) => (
                    <div
                      key={item.index}
                      className="rounded-lg border border-red-200/30 bg-red-50/5 p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">#{item.index} {item.title}</span>
                        <span className="text-[10px] font-bold text-red-500">
                          {(item.score * 100).toFixed(0)}分
                        </span>
                      </div>
                      <ul className="text-[10px] text-muted-foreground space-y-0.5">
                        {item.issues.map((issue, i) => (
                          <li key={i}>· {issue}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
