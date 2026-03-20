/**
 * DeepMind Insights Dashboard — 开发者可视化仪表盘
 *
 * 四个模块（从 tests/dashboard_server.py API 获取数据，或降级为示例数据）：
 *  1. P1+I1 退火调度曲线（Annealing Schedule）
 *  2. P4 Expert 波动性 EWMA（Volatility）
 *  3. P3 环境策略非对称对比（Environment Asymmetry）
 *  4. P2 KB 暖启动曲线（Warm-Start）
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Server, Activity, Thermometer, Database } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Area, AreaChart,
} from 'recharts'

/* ---- 类型 ---- */

interface AnnealPoint { turn: number; phase: string; mode: string; blend: number; diversity: number; temperature: number }
interface AnnealData { env: string; horizon: number; curve: AnnealPoint[] }
interface VolExpert { volatility: number; recent_volatility_series: number[]; iteration_priority?: string }
interface VolData { expert_volatility: Record<string, VolExpert>; domain_avg_volatility: number }
interface EnvDimension { development: string | number; production: string | number; asymmetry_ratio: string | number }
interface WarmupPoint { query_count: number; weight: number }
interface WarmupData { agent: string; maturity: string; gate: Record<string, unknown>; warmup_curve: WarmupPoint[] }

/* ---- 静态示例数据 ---- */

const MOCK_ANNEAL: Record<string, AnnealData> = {
  default: { env: 'default', horizon: 8, curve: Array.from({ length: 12 }, (_, i) => ({ turn: i, phase: i < 4 ? 'explore' : 'exploit', mode: 'blend', blend: 0.5 * Math.exp(-i / 6), diversity: 0.3 * Math.exp(-i / 5), temperature: 0.8 * Math.exp(-i / 4) })) },
  development: { env: 'development', horizon: 10, curve: Array.from({ length: 12 }, (_, i) => ({ turn: i, phase: i < 5 ? 'explore' : 'exploit', mode: 'blend', blend: 0.55 * Math.exp(-i / 8), diversity: 0.35 * Math.exp(-i / 7), temperature: 0.9 * Math.exp(-i / 5) })) },
  production: { env: 'production', horizon: 6, curve: Array.from({ length: 12 }, (_, i) => ({ turn: i, phase: i < 3 ? 'explore' : 'exploit', mode: 'blend', blend: 0.4 * Math.exp(-i / 4), diversity: 0.2 * Math.exp(-i / 3), temperature: 0.6 * Math.exp(-i / 3) })) },
}

const MOCK_VOLATILITY: VolData = {
  expert_volatility: {
    tax_consultant: { volatility: 0.045, recent_volatility_series: [0.08, 0.06, 0.05, 0.04, 0.035, 0.04, 0.045], iteration_priority: 'medium' },
    finance_accountant: { volatility: 0.032, recent_volatility_series: [0.05, 0.04, 0.035, 0.03, 0.028, 0.03, 0.032], iteration_priority: 'low' },
    contract_reviewer: { volatility: 0.058, recent_volatility_series: [0.09, 0.07, 0.065, 0.055, 0.05, 0.055, 0.058], iteration_priority: 'high' },
  },
  domain_avg_volatility: 0.042,
}

const MOCK_ENV_POLICY: Record<string, EnvDimension> = {
  annealing_horizon: { development: 10, production: 6, asymmetry_ratio: '1.67x' },
  temperature_init: { development: 0.9, production: 0.6, asymmetry_ratio: '1.50x' },
  diversity_weight: { development: 0.35, production: 0.2, asymmetry_ratio: '1.75x' },
  cache_ttl: { development: 300, production: 3600, asymmetry_ratio: '0.08x' },
  kb_min_confidence: { development: 0.5, production: 0.7, asymmetry_ratio: '0.71x' },
}

const MOCK_WARMUP: WarmupData = {
  agent: 'finance', maturity: 'production',
  gate: { cooldown_turns: 10 },
  warmup_curve: Array.from({ length: 21 }, (_, i) => ({ query_count: i, weight: Math.min(1, 1 - Math.exp(-i / 4)) })),
}

/* ---- 颜色 ---- */
const ENV_COLORS: Record<string, string> = { default: '#a78bfa', development: '#22d3ee', production: '#f472b6' }
const EXPERT_COLORS = ['#f97316', '#06b6d4', '#a3e635', '#e879f9', '#facc15', '#fb923c']

/* ---- 主组件 ---- */

export default function DeepMindInsights() {
  const navigate = useNavigate()
  const [annealData, setAnnealData] = useState<Record<string, AnnealData>>(MOCK_ANNEAL)
  const [volData, setVolData] = useState<VolData>(MOCK_VOLATILITY)
  const [envPolicy, setEnvPolicy] = useState<Record<string, EnvDimension>>(MOCK_ENV_POLICY)
  const [warmup, setWarmup] = useState<WarmupData>(MOCK_WARMUP)
  const [loading, setLoading] = useState(false)
  const [useMock, setUseMock] = useState(true)
  const [dashboardPort] = useState(9000)

  const fetchAPI = useCallback(async (path: string) => {
    const res = await fetch(`http://localhost:${dashboardPort}${path}`)
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json()
  }, [dashboardPort])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    let live = true
    try {
      const [def, dev, prod] = await Promise.all([
        fetchAPI('/api/deepmind/scheduler/default?turns=12'),
        fetchAPI('/api/deepmind/scheduler/development?turns=12'),
        fetchAPI('/api/deepmind/scheduler/production?turns=12'),
      ])
      setAnnealData({ default: def, development: dev, production: prod })
    } catch { live = false }

    try {
      const v = await fetchAPI('/api/deepmind/volatility/finance?period=90')
      if (v?.expert_volatility) setVolData(v)
    } catch { /* keep mock */ }

    try {
      const e = await fetchAPI('/api/deepmind/env-policy')
      if (e) setEnvPolicy(e)
    } catch { /* keep mock */ }

    try {
      const w = await fetchAPI('/api/deepmind/maturity/finance')
      if (w?.warmup_curve) setWarmup(w)
    } catch { /* keep mock */ }

    setUseMock(!live)
    setLoading(false)
  }, [fetchAPI])

  useEffect(() => { fetchAll() }, [fetchAll])

  /* 退火曲线合并数据 */
  const annealChartData = useMemo(() => {
    const turns = 12
    return Array.from({ length: turns }, (_, i) => {
      const point: Record<string, number | string> = { turn: i }
      Object.entries(annealData).forEach(([env, d]) => {
        const p = d.curve[i]
        if (p) point[env] = parseFloat(p.blend.toFixed(4))
      })
      return point
    })
  }, [annealData])

  /* 波动性时间序列 */
  const volChartData = useMemo(() => {
    const experts = Object.entries(volData.expert_volatility)
    const maxLen = Math.max(...experts.map(([, v]) => v.recent_volatility_series.length))
    return Array.from({ length: maxLen }, (_, i) => {
      const point: Record<string, number | string> = { window: i }
      experts.forEach(([eid, v]) => {
        point[eid] = v.recent_volatility_series[i] ?? 0
      })
      return point
    })
  }, [volData])

  const expertNames = useMemo(() => Object.keys(volData.expert_volatility), [volData])

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶栏 */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-md hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold flex items-center gap-2">
            DeepMind Insights Dashboard
          </h1>
          <p className="text-[10px] text-muted-foreground">
            P0-P5 + I1-I4 | AlphaEvolve / SHOR-PSRO / VAD-CFR
            {useMock && <span className="ml-2 text-amber-500">（示例数据 — 启动 dashboard_server.py 获取实时数据）</span>}
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
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* 1. 退火曲线 */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Thermometer className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-semibold">P1+I1: Annealing Schedule</h2>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={annealChartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="turn"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Turn', position: 'insideBottomRight', offset: -2, style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                />
                <YAxis
                  domain={[0, 0.6]}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Blend', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                />
                <Tooltip
                  content={({ payload, label }) => {
                    if (!payload?.length) return null
                    return (
                      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                        <p className="text-muted-foreground mb-1">Turn {label}</p>
                        {payload.map(p => (
                          <p key={String(p.dataKey)} style={{ color: p.color }}>
                            {String(p.dataKey)}: {(p.value as number).toFixed(4)}
                          </p>
                        ))}
                      </div>
                    )
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(v: string) => {
                    const h = annealData[v]?.horizon
                    return <span className="text-muted-foreground text-[10px]">{v}{h ? ` (h=${h})` : ''}</span>
                  }}
                />
                {Object.keys(annealData).map(env => (
                  <Line
                    key={env}
                    type="monotone"
                    dataKey={env}
                    stroke={ENV_COLORS[env] || '#888'}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-muted-foreground mt-2">
              SHOR-PSRO: dev explores more, prod converges faster
            </p>
          </section>

          {/* 2. Expert 波动性 */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold">P4: Expert Volatility (EWMA)</h2>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={volChartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="window"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Window', position: 'insideBottomRight', offset: -2, style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'EWMA Vol', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                />
                <Tooltip
                  content={({ payload, label }) => {
                    if (!payload?.length) return null
                    return (
                      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                        <p className="text-muted-foreground mb-1">Window {label}</p>
                        {payload.map(p => (
                          <p key={String(p.dataKey)} style={{ color: p.color }}>
                            {String(p.dataKey)}: {(p.value as number).toFixed(4)}
                          </p>
                        ))}
                      </div>
                    )
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(v: string) => {
                    const vol = volData.expert_volatility[v]?.volatility
                    return <span className="text-muted-foreground text-[10px]">{v}{vol != null ? ` (vol=${vol.toFixed(3)})` : ''}</span>
                  }}
                />
                {expertNames.map((eid, i) => (
                  <Line
                    key={eid}
                    type="monotone"
                    dataKey={eid}
                    stroke={EXPERT_COLORS[i % EXPERT_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 1.5 }}
                    activeDot={{ r: 3.5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-muted-foreground mt-2">
              Domain avg volatility: {volData.domain_avg_volatility.toFixed(4)}
              {' · '}
              {Object.values(volData.expert_volatility).filter(v => v.iteration_priority !== 'low').length} experts need iteration
            </p>
          </section>

          {/* 3. 环境策略非对称 */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Server className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold">P3: Environment Asymmetry</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 pr-3 font-medium">Dimension</th>
                    <th className="text-right py-2 px-3 font-medium">Dev</th>
                    <th className="text-right py-2 px-3 font-medium">Prod</th>
                    <th className="text-right py-2 pl-3 font-medium">Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(envPolicy).map(([dim, v]) => {
                    const isDiff = String(v.development) !== String(v.production)
                    return (
                      <tr
                        key={dim}
                        className={`border-b border-border/10 ${isDiff ? 'text-cyan-400' : 'text-muted-foreground/50'}`}
                      >
                        <td className="py-2 pr-3 font-medium">{dim}</td>
                        <td className="text-right py-2 px-3 font-mono">{String(v.development)}</td>
                        <td className="text-right py-2 px-3 font-mono">{String(v.production)}</td>
                        <td className="text-right py-2 pl-3 font-mono">{String(v.asymmetry_ratio)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. KB 暖启动曲线 */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold">P2: KB Warm-Start Curve</h2>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={warmup.warmup_curve} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="warmupGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="query_count"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Query Count', position: 'insideBottomRight', offset: -2, style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                />
                <YAxis
                  domain={[0, 1.1]}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'Retrieval Weight', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.[0]) return null
                    const d = payload[0].payload as WarmupPoint
                    return (
                      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                        <p>Query #{d.query_count}</p>
                        <p className="text-emerald-400 font-bold">Weight: {d.weight.toFixed(3)}</p>
                      </div>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="#34d399"
                  strokeWidth={2}
                  fill="url(#warmupGrad)"
                  dot={{ r: 1.5, fill: '#34d399' }}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-muted-foreground mt-2">
              Maturity: {warmup.maturity} | Cooldown: {(warmup.gate as Record<string, number>).cooldown_turns ?? '?'} turns
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
