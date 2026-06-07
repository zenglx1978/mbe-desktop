import { useState, useCallback } from 'react'

// ── API 基础 URL（复用 chat-store 的配置风格）──────────────────────

function getSalesApiBase(): string {
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__SALES_API__) {
    return (window as unknown as Record<string, unknown>).__SALES_API__ as string
  }
  return 'http://localhost:8008/api/sales'
}

async function salesPost(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = localStorage.getItem('mbe_token') ?? ''
  const res = await fetch(`${getSalesApiBase()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json() as Promise<Record<string, unknown>>
}

// ── 类型 ──────────────────────────────────────────────────────────

type TabId = 'call-prep' | 'briefing' | 'asset'

interface CallPrepResult {
  brief_markdown?: string
  company_name?: string
  call_type_label?: string
  exit_criteria?: string
}

interface BriefingResult {
  compact_text?: string
  full_markdown?: string
  high_priority_count?: number
  total_signals?: number
  delivery_results?: Array<{ channel: string; success: boolean }>
}

interface AssetResult {
  asset_type?: string
  content_type?: string
  content?: string
  roi_preview?: {
    annual_savings_yuan: number
    mbe_fee_yuan: number
    client_net_yuan: number
    roi_multiple: number
  }
}

// ── 主组件 ────────────────────────────────────────────────────────

export function SalesAIToolsPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('call-prep')

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">⚡ AI 销售工具</span>
        <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
          Anthropic-inspired
        </span>
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {([
          { id: 'call-prep' as TabId, label: '📋 通话简报', desc: '每次通话前' },
          { id: 'briefing' as TabId, label: '☀️ 日报', desc: '每天早晨' },
          { id: 'asset' as TabId, label: '🎨 生成素材', desc: '通话中实时' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div>{tab.label}</div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500">{tab.desc}</div>
          </button>
        ))}
      </div>

      {/* 面板内容 */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'call-prep' && <CallPrepTab />}
        {activeTab === 'briefing' && <DailyBriefingTab />}
        {activeTab === 'asset' && <CreateAssetTab />}
      </div>
    </div>
  )
}

// ── Tab 1: 通话前简报 ──────────────────────────────────────────────

function CallPrepTab() {
  const [leadId, setLeadId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [callType, setCallType] = useState('discovery')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CallPrepResult | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = useCallback(async () => {
    if (!leadId.trim() || !companyName.trim()) {
      setError('线索 ID 和公司名称为必填项')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await salesPost('/ai-tools/call-prep', {
        lead_id: leadId.trim(),
        company_name: companyName.trim(),
        contact_name: contactName.trim(),
        call_type: callType,
        competitor_focus: true,
      })
      setResult(res.data as CallPrepResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }, [leadId, companyName, contactName, callType])

  const CALL_TYPES = [
    { id: 'discovery', label: '初次发现' },
    { id: 'demo', label: '产品演示' },
    { id: 'negotiation', label: '合同谈判' },
    { id: 'check_in', label: '客户回访' },
  ]

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-gray-500 dark:text-gray-400">
        通话前 5 分钟生成简报：联系人背景 · 发现性问题 · 竞品应对 · 退出标准
      </p>

      {/* 表单 */}
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
            线索 ID <span className="text-red-400">*</span>
          </label>
          <input
            value={leadId}
            onChange={e => setLeadId(e.target.value)}
            placeholder="lead-xxx"
            className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
            公司名称 <span className="text-red-400">*</span>
          </label>
          <input
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="XX 集团"
            className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">联系人姓名</label>
          <input
            value={contactName}
            onChange={e => setContactName(e.target.value)}
            placeholder="张总"
            className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">通话类型</label>
          <div className="grid grid-cols-2 gap-1.5">
            {CALL_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setCallType(t.id)}
                className={`py-1.5 text-xs rounded-md transition-colors ${
                  callType === t.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 rounded px-3 py-2">{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-2.5 text-sm font-medium rounded-md bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
      >
        {loading ? '生成中...' : '📋 生成通话简报'}
      </button>

      {/* 结果 */}
      {result?.brief_markdown && (
        <div className="mt-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20">
          <div className="flex items-center justify-between px-3 py-2 border-b border-blue-200 dark:border-blue-800">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
              {result.company_name} · {result.call_type_label}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(result.brief_markdown ?? '')}
              className="text-[11px] text-blue-500 hover:text-blue-700"
            >
              复制
            </button>
          </div>
          <pre className="p-3 text-[11px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed overflow-auto max-h-80">
            {result.brief_markdown}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Tab 2: AI 销售日报 ────────────────────────────────────────────

function DailyBriefingTab() {
  const [maxItems, setMaxItems] = useState(6)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BriefingResult | null>(null)
  const [error, setError] = useState('')
  const [showFull, setShowFull] = useState(false)

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await salesPost('/ai-tools/daily-briefing', {
        max_items: maxItems,
        delivery: ['wecom'],
        include_wx: true,
      })
      setResult(res.data as BriefingResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }, [maxItems])

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-gray-500 dark:text-gray-400">
        聚合微信 + Pipeline + 日历 + 待回复报价，生成优先级排序的今日行动清单
      </p>

      <div className="flex items-center gap-3">
        <label className="text-[11px] text-gray-600 dark:text-gray-400 whitespace-nowrap">最多显示条目</label>
        <input
          type="number"
          value={maxItems}
          onChange={e => setMaxItems(Math.min(15, Math.max(1, Number(e.target.value))))}
          className="w-16 text-sm px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-center"
        />
      </div>

      {error && (
        <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 rounded px-3 py-2">{error}</div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-2.5 text-sm font-medium rounded-md bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
      >
        {loading ? '生成中...' : '☀️ 生成今日日报'}
      </button>

      {result && (
        <div className="space-y-3">
          {/* 统计徽章 */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              共 {result.total_signals} 条信号
            </span>
            {(result.high_priority_count ?? 0) > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300">
                {result.high_priority_count} 条高优先
              </span>
            )}
            {result.delivery_results?.map(d => (
              <span
                key={d.channel}
                className={`text-[11px] px-2 py-0.5 rounded-full ${
                  d.success
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}
              >
                {d.success ? '✓' : '✗'} {d.channel} 推送
              </span>
            ))}
          </div>

          {/* 精简版 */}
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">企微精简版</span>
              <button
                onClick={() => navigator.clipboard.writeText(result.compact_text ?? '')}
                className="text-[11px] text-amber-500 hover:text-amber-700"
              >
                复制
              </button>
            </div>
            <pre className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {result.compact_text}
            </pre>
          </div>

          {/* 完整版切换 */}
          <button
            onClick={() => setShowFull(!showFull)}
            className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
          >
            {showFull ? '收起完整版' : '展开完整 Markdown'}
          </button>

          {showFull && result.full_markdown && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
              <pre className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed overflow-auto max-h-64">
                {result.full_markdown}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab 3: 动态生成素材 ───────────────────────────────────────────

function CreateAssetTab() {
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [assetType, setAssetType] = useState('auto')
  const [industry, setIndustry] = useState('default')
  const [headcount, setHeadcount] = useState(10)
  const [avgSalary, setAvgSalary] = useState(10000)
  const [painPoint, setPainPoint] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AssetResult | null>(null)
  const [error, setError] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const ASSET_TYPES = [
    { id: 'auto', label: '🤖 自动' },
    { id: 'roi_calculator', label: '💰 ROI 计算器' },
    { id: 'one_pager', label: '📄 一页纸' },
    { id: 'case_story', label: '📖 案例故事' },
    { id: 'competitor_card', label: '🥊 竞品对比' },
  ]

  const INDUSTRIES = [
    { id: 'default', label: '通用' },
    { id: '法律', label: '⚖️ 法律' },
    { id: '财务', label: '💼 财务' },
    { id: '医疗', label: '🏥 医疗' },
    { id: '客服', label: '💬 客服' },
  ]

  const handleGenerate = useCallback(async () => {
    if (!companyName.trim()) { setError('公司名称为必填项'); return }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await salesPost('/ai-tools/asset', {
        company_name: companyName.trim(),
        contact_name: contactName.trim(),
        asset_type: assetType,
        industry,
        current_headcount: headcount,
        avg_salary_yuan: avgSalary,
        pain_point: painPoint.trim(),
      })
      setResult(res as AssetResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }, [companyName, contactName, assetType, industry, headcount, avgSalary, painPoint])

  const assetTypeLabel: Record<string, string> = {
    roi_calculator: 'ROI 计算器 (HTML)',
    one_pager: '一页纸提案 (HTML)',
    case_story: '案例故事 (Markdown)',
    competitor_card: '竞品对比卡片 (Markdown)',
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-gray-500 dark:text-gray-400">
        通话中实时生成定制化素材，可直接发给客户
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
            公司名称 <span className="text-red-400">*</span>
          </label>
          <input
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="XX 集团"
            className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">联系人</label>
          <input
            value={contactName}
            onChange={e => setContactName(e.target.value)}
            placeholder="张总"
            className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        {/* 素材类型 */}
        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">素材类型</label>
          <div className="grid grid-cols-2 gap-1.5">
            {ASSET_TYPES.slice(0, 2).map(t => (
              <button key={t.id} onClick={() => setAssetType(t.id)}
                className={`py-1.5 text-xs rounded-md transition-colors ${assetType === t.id ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{t.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-1.5">
            {ASSET_TYPES.slice(2).map(t => (
              <button key={t.id} onClick={() => setAssetType(t.id)}
                className={`py-1.5 text-xs rounded-md transition-colors ${assetType === t.id ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* 行业 */}
        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">行业</label>
          <div className="flex gap-1.5 flex-wrap">
            {INDUSTRIES.map(ind => (
              <button key={ind.id} onClick={() => setIndustry(ind.id)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${industry === ind.id ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>{ind.label}</button>
            ))}
          </div>
        </div>

        {/* ROI 参数（仅 roi_calculator 或 auto 时显示） */}
        {(assetType === 'auto' || assetType === 'roi_calculator' || assetType === 'one_pager') && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">团队人数</label>
              <input type="number" value={headcount} onChange={e => setHeadcount(Number(e.target.value))} min={1}
                className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-center" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">平均月薪 ¥</label>
              <input type="number" value={avgSalary} onChange={e => setAvgSalary(Number(e.target.value))} step={1000} min={3000}
                className="w-full text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-center" />
            </div>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">痛点摘录（通话中听到的）</label>
          <textarea
            value={painPoint}
            onChange={e => setPainPoint(e.target.value)}
            rows={2}
            placeholder="例：每月 120+ 份合同，审查需要 3-5 天..."
            className="w-full text-sm px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 rounded px-3 py-2">{error}</div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-2.5 text-sm font-medium rounded-md bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
      >
        {loading ? '生成中...' : '🎨 立即生成素材'}
      </button>

      {/* 结果 */}
      {result?.content && (
        <div className="mt-3 space-y-3">
          {/* ROI 预览徽章 */}
          {result.roi_preview && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '年节省', value: `¥${result.roi_preview.annual_savings_yuan.toLocaleString()}` },
                { label: 'MBE 费用', value: `¥${result.roi_preview.mbe_fee_yuan.toLocaleString()}` },
                { label: '客户净收益', value: `¥${result.roi_preview.client_net_yuan.toLocaleString()}` },
                { label: 'ROI', value: `${result.roi_preview.roi_multiple}x` },
              ].map(item => (
                <div key={item.label} className="text-center py-2 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <div className="text-[10px] text-gray-500">{item.label}</div>
                  <div className="text-sm font-bold text-green-600 dark:text-green-400">{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* 素材内容 */}
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/20 dark:bg-green-950/10">
            <div className="flex items-center justify-between px-3 py-2 border-b border-green-200 dark:border-green-800">
              <span className="text-[11px] font-medium text-green-700 dark:text-green-300">
                {assetTypeLabel[result.asset_type ?? ''] ?? result.asset_type}
              </span>
              <div className="flex gap-2">
                {result.content_type === 'html' && (
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-[11px] text-green-500 hover:text-green-700"
                  >
                    {showPreview ? '关闭预览' : '预览 HTML'}
                  </button>
                )}
                <button
                  onClick={() => navigator.clipboard.writeText(result.content ?? '')}
                  className="text-[11px] text-green-500 hover:text-green-700"
                >
                  复制
                </button>
              </div>
            </div>

            {showPreview && result.content_type === 'html' ? (
              <iframe
                srcDoc={result.content}
                className="w-full h-64 border-0"
                sandbox="allow-scripts"
                title="素材预览"
              />
            ) : (
              <pre className="p-3 text-[10px] text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed overflow-auto max-h-48">
                {result.content.slice(0, 600)}{result.content.length > 600 ? '\n...(点击「复制」获取完整内容)' : ''}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
