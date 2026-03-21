import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import {
  Database, Globe, FolderOpen, Monitor, CheckCircle2,
  ArrowRight, ArrowLeft, AlertCircle, ExternalLink, RefreshCw,
} from 'lucide-react'

const electronAPI = (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI as {
  localApp?: { detectApps: () => Promise<{ name: string; installed: boolean; path?: string }[]> }
  webReader?: { listPresets: () => Promise<{ key: string; urls: string[] }[]> }
  localReader?: { supportedTypes: () => Promise<{ extensions: string[]; types: Record<string, string[]> }> }
}

interface DataSource {
  id: string
  label: string
  type: 'central' | 'app' | 'file'
  status: 'ready' | 'missing' | 'unchecked'
  detail?: string
  url?: string
  appName?: string
}

/**
 * 首次启动数据源配置引导页
 * 用户选择方案后展示该方案需要的数据源，引导配置
 */
export default function DataSourceSetup() {
  const navigate = useNavigate()
  const { currentSolutionId } = useAppStore()
  const [step, setStep] = useState(0)
  const [sources, setSources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)
  const [, setDetectedApps] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadDataSources()
  }, [currentSolutionId])

  const loadDataSources = useCallback(async () => {
    setLoading(true)
    const items: DataSource[] = []

    // 根据当前方案加载数据源声明
    const solutionSources = getSolutionDataSources(currentSolutionId || '')

    for (const src of solutionSources.central) {
      items.push({
        id: src.id, label: src.label, type: 'central',
        status: 'ready', url: src.url, detail: `自动跟踪 · 刷新周期 ${src.refresh_days} 天`,
      })
    }

    // 检测本地已安装应用
    let installedApps: Record<string, boolean> = {}
    try {
      const apps = await electronAPI.localApp?.detectApps() || []
      installedApps = Object.fromEntries(apps.map(a => [a.name, a.installed]))
      setDetectedApps(installedApps)
    } catch { /* 忽略检测失败 */ }

    for (const src of solutionSources.apps) {
      const installed = installedApps[src.appName || ''] ?? false
      items.push({
        id: src.id, label: src.label, type: 'app',
        status: installed ? 'ready' : 'missing',
        appName: src.appName,
        detail: installed ? '已安装' : '未检测到，建议安装',
      })
    }

    for (const src of solutionSources.files) {
      items.push({
        id: src.id, label: src.label, type: 'file',
        status: 'unchecked',
        detail: `支持 ${src.fileTypes.join('/')} 格式`,
      })
    }

    setSources(items)
    setLoading(false)
  }, [currentSolutionId])

  const steps = [
    { title: '中央知识源', icon: Globe, description: '由 MBE 自动维护的法规、标准、平台规则' },
    { title: '推荐应用', icon: Monitor, description: '安装这些应用可获取更丰富的行业数据' },
    { title: '本地文件', icon: FolderOpen, description: '导入您的业务文件以获得定制化服务' },
  ]

  const centralSources = sources.filter(s => s.type === 'central')
  const appSources = sources.filter(s => s.type === 'app')
  const fileSources = sources.filter(s => s.type === 'file')

  const currentSources = step === 0 ? centralSources : step === 1 ? appSources : fileSources

  const readyCount = sources.filter(s => s.status === 'ready').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">正在检测数据源...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 头部 */}
      <div className="border-b px-8 py-6">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold">数据源配置</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          配置 AI 专家的知识来源，获取更准确、更专业的服务。所有数据仅在本地处理。
        </p>

        {/* 进度指示 */}
        <div className="flex gap-2 mt-4">
          {steps.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                i === step
                  ? 'bg-primary text-primary-foreground'
                  : i < step
                    ? 'bg-primary/10 text-primary'
                    : 'bg-secondary text-muted-foreground'
              }`}
            >
              <s.icon className="w-4 h-4" />
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 px-8 py-6 overflow-auto">
        <div className="max-w-2xl">
          <p className="text-sm text-muted-foreground mb-4">
            {steps[step].description}
          </p>

          <div className="space-y-3">
            {currentSources.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                当前方案未声明此类数据源
              </p>
            ) : (
              currentSources.map(src => (
                <div
                  key={src.id}
                  className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    {src.status === 'ready' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : src.status === 'missing' ? (
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{src.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{src.detail}</div>
                  </div>
                  {src.url && (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 hover:underline"
                    >
                      查看 <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 底部导航 */}
      <div className="border-t px-8 py-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          已就绪 {readyCount}/{sources.length} 个数据源
        </div>
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-sm rounded-lg border hover:bg-accent flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> 上一步
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
            >
              下一步 <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
            >
              完成配置 <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 方案数据源声明（从 solution.yaml 映射） ──

interface SourceDecl {
  id: string
  label: string
  url?: string
  refresh_days?: number
  appName?: string
  fileTypes: string[]
}

function getSolutionDataSources(solutionId: string): {
  central: SourceDecl[]
  apps: SourceDecl[]
  files: SourceDecl[]
} {
  const registry: Record<string, { central: SourceDecl[]; apps: SourceDecl[]; files: SourceDecl[] }> = {
    'ecommerce-brand-service': {
      central: [
        { id: 'taobao_rules', label: '淘宝/天猫平台规则', url: 'https://rule.taobao.com', refresh_days: 30, fileTypes: [] },
        { id: 'douyin_ecom_rules', label: '抖音电商平台规则', url: 'https://school.jinritemai.com', refresh_days: 30, fileTypes: [] },
        { id: 'jd_rules', label: '京东开放平台规则', url: 'https://rule.jd.com', refresh_days: 30, fileTypes: [] },
        { id: 'consumer_protection_law', label: '消费者权益保护法', url: 'https://flk.npc.gov.cn', refresh_days: 180, fileTypes: [] },
        { id: 'advertising_law', label: '广告法（极限词）', url: 'https://flk.npc.gov.cn', refresh_days: 180, fileTypes: [] },
      ],
      apps: [
        { id: 'douyin_seller', label: '抖店商家后台', appName: '抖店', fileTypes: [] },
        { id: 'taobao_seller', label: '千牛卖家后台', appName: '千牛', fileTypes: [] },
      ],
      files: [
        { id: 'brand_contracts', label: '品牌代运营合同', fileTypes: ['pdf', 'docx'] },
        { id: 'settlement_sheets', label: '佣金结算表', fileTypes: ['xlsx', 'csv'] },
      ],
    },
    'investment-research': {
      central: [
        { id: 'csrc_announcements', label: '证监会公告', url: 'http://www.csrc.gov.cn', refresh_days: 7, fileTypes: [] },
        { id: 'sse_disclosure', label: '上交所信息披露', url: 'http://www.sse.com.cn', refresh_days: 1, fileTypes: [] },
        { id: 'szse_disclosure', label: '深交所信息披露', url: 'http://www.szse.cn', refresh_days: 1, fileTypes: [] },
      ],
      apps: [
        { id: 'eastmoney', label: '东方财富终端', appName: '东方财富', fileTypes: [] },
        { id: 'ths_ifind', label: '同花顺 iFinD', appName: '同花顺', fileTypes: [] },
        { id: 'wind', label: 'Wind 金融终端', appName: 'Wind', fileTypes: [] },
      ],
      files: [
        { id: 'research_reports', label: '自有研报/投资备忘录', fileTypes: ['pdf', 'docx', 'xlsx'] },
        { id: 'portfolio_data', label: '持仓数据', fileTypes: ['xlsx', 'csv'] },
      ],
    },
    'law-firm': {
      central: [
        { id: 'npc_laws', label: '全国人大法律法规库', url: 'https://flk.npc.gov.cn', refresh_days: 30, fileTypes: [] },
        { id: 'court_interpretations', label: '最高法司法解释', url: 'https://www.court.gov.cn', refresh_days: 30, fileTypes: [] },
        { id: 'guiding_cases', label: '指导性案例', url: 'https://www.court.gov.cn', refresh_days: 60, fileTypes: [] },
      ],
      apps: [
        { id: 'pkulaw', label: '北大法宝', appName: '北大法宝', fileTypes: [] },
        { id: 'court_open', label: '中国裁判文书网', appName: '裁判文书网', fileTypes: [] },
      ],
      files: [
        { id: 'case_documents', label: '案件材料', fileTypes: ['pdf', 'docx', 'jpg'] },
        { id: 'contract_templates', label: '合同模板库', fileTypes: ['docx', 'pdf'] },
      ],
    },
  }

  return registry[solutionId] || { central: [], apps: [], files: [] }
}
