// WorkflowMiner — 行为捕捉 → 工作流自动生成 → 行业方案自进化
//
// 四层架构：
//   Layer 1: Behavior Observer — 静默捕捉应用切换/文件访问模式
//   Layer 2: Pattern Recognizer — 识别高频序列/跨应用流程
//   Layer 3: Industry Detector — 从已安装软件推断行业
//   Layer 4: Efficiency Meter — 测量操作耗时（成本收益）

import { ipcMain, app } from 'electron'
import { spawn, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

// ────────────────────── 类型定义 ──────────────────────

export interface InstalledApp {
  name: string
  publisher?: string
  installPath?: string
  category: AppCategory
}

export type AppCategory =
  | 'finance'     // 用友/金蝶/浪潮
  | 'legal'       // 法律文书/裁判文书
  | 'medical'     // 医疗 HIS/LIS/PACS
  | 'engineering' // CAD/BIM/造价
  | 'office'      // WPS/Office/LibreOffice
  | 'design'      // PS/AI/Figma
  | 'dev'         // VS Code/JetBrains
  | 'communication' // 微信/钉钉/飞书
  | 'browser'     // Chrome/Edge/Firefox
  | 'stock'       // 东方财富/同花顺/通达信
  | 'education'   // 教育相关
  | 'insurance'   // 保险系统
  | 'crm'         // CRM/ERP
  | 'media'       // 剪映/达芬奇
  | 'other'

export interface IndustryGuess {
  industry: string
  confidence: number
  matchedApps: string[]
  suggestedSolution: string
}

export interface EfficiencyRecord {
  taskName: string
  solutionId: string
  manualDurationMs: number | null
  assistedDurationMs: number | null
  timestamp: string
}

// ────────────────────── 行业推断规则 ──────────────────────

const INDUSTRY_RULES: {
  industry: string
  solution: string
  keywords: string[]
  weight: number
}[] = [
  {
    industry: '财务/会计',
    solution: 'finance-tax-service',
    keywords: ['用友', '金蝶', 'kingdee', 'yonyou', '浪潮', '管家婆', '财务', '报税', '航天信息', '百旺', '税控', '开票', '发票', 'Invoice'],
    weight: 3,
  },
  {
    industry: '法律服务',
    solution: 'law-firm',
    keywords: ['裁判文书', '法律', 'iCourt', '无讼', '律师', '合同管理', '法信', '北大法宝', 'pkulaw', '中国法律'],
    weight: 3,
  },
  {
    industry: '工程造价',
    solution: 'construction-cost',
    keywords: ['广联达', 'glodon', 'CAD', 'AutoCAD', 'Revit', 'BIM', '品茗', '斯维尔', '清华斯维尔', '算量', '鲁班', '预算'],
    weight: 3,
  },
  {
    industry: '医疗/临床',
    solution: 'clinic-respiratory',
    keywords: ['HIS', 'LIS', 'PACS', '医疗', '临床', 'hospital', 'medical', '卫宁', '东华', '和仁'],
    weight: 3,
  },
  {
    industry: '投资/证券',
    solution: 'investment-research',
    keywords: ['东方财富', '同花顺', 'Wind', '万得', '通达信', 'Choice', 'Bloomberg', 'iFinD', '恒生', '大智慧', 'thinkorswim', 'TradingView'],
    weight: 3,
  },
  {
    industry: '电商运营',
    solution: 'ecommerce-brand-service',
    keywords: ['千牛', '生意参谋', '抖店', '拼多多', '快手小店', '有赞', '微店', '店小秘', 'ERP', '聚水潭', '旺店通'],
    weight: 3,
  },
  {
    industry: '教育培训',
    solution: 'education-training',
    keywords: ['ClassIn', '腾讯课堂', '作业帮', '猿辅导', '学而思', '知学', '教务', '校管', '排课'],
    weight: 2,
  },
  {
    industry: '保险服务',
    solution: 'insurance-operations',
    keywords: ['保险', 'insurance', '核保', '理赔', '精算', '保费', '国任', '太平洋', '平安', '中国人寿', '新华'],
    weight: 2,
  },
  {
    industry: '人力资源',
    solution: 'smb-operations',
    keywords: ['北森', '钉钉', '薪人薪事', 'Moka', '飞书人事', '人事', '社保', '招聘', 'Boss直聘', '猎聘', '拉勾'],
    weight: 2,
  },
  {
    industry: '内容创作/营销',
    solution: 'smb-operations',
    keywords: ['剪映', 'CapCut', '达芬奇', 'Premiere', 'Final Cut', 'Canva', '稿定设计', '创客贴', '新榜', '蝉妈妈'],
    weight: 2,
  },
]

// ────────────────────── Layer 3: 已安装软件扫描 ──────────────────────

function scanWindowsApps(): InstalledApp[] {
  const apps: InstalledApp[] = []

  try {
    const psScript = `
      Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* |
        Select-Object DisplayName, Publisher, InstallLocation |
        Where-Object { $_.DisplayName -ne $null } |
        ConvertTo-Json -Compress
    `
    const result = execSync(`powershell -NoProfile -Command "${psScript}"`, {
      timeout: 15000,
      windowsHide: true,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    })

    const parsed = JSON.parse(result.trim())
    const entries = Array.isArray(parsed) ? parsed : [parsed]

    for (const entry of entries) {
      if (!entry.DisplayName) continue
      apps.push({
        name: entry.DisplayName,
        publisher: entry.Publisher || undefined,
        installPath: entry.InstallLocation || undefined,
        category: categorizeApp(entry.DisplayName, entry.Publisher),
      })
    }
  } catch {
    // 注册表扫描失败，降级到常见路径检测
  }

  // 也扫描当前用户的注册表
  try {
    const psScript = `
      Get-ItemProperty HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* |
        Select-Object DisplayName, Publisher, InstallLocation |
        Where-Object { $_.DisplayName -ne $null } |
        ConvertTo-Json -Compress
    `
    const result = execSync(`powershell -NoProfile -Command "${psScript}"`, {
      timeout: 10000,
      windowsHide: true,
      encoding: 'utf-8',
      maxBuffer: 5 * 1024 * 1024,
    })

    if (result.trim()) {
      const parsed = JSON.parse(result.trim())
      const entries = Array.isArray(parsed) ? parsed : [parsed]
      const existingNames = new Set(apps.map((a) => a.name))

      for (const entry of entries) {
        if (!entry.DisplayName || existingNames.has(entry.DisplayName)) continue
        apps.push({
          name: entry.DisplayName,
          publisher: entry.Publisher || undefined,
          installPath: entry.InstallLocation || undefined,
          category: categorizeApp(entry.DisplayName, entry.Publisher),
        })
      }
    }
  } catch {
    // ignore
  }

  return apps
}

function categorizeApp(name: string, publisher?: string): AppCategory {
  const combined = `${name} ${publisher || ''}`.toLowerCase()

  const categoryMap: [AppCategory, string[]][] = [
    ['finance', ['用友', 'yonyou', '金蝶', 'kingdee', '浪潮', '管家婆', '报税', '税控', '开票', '航天信息', '百旺']],
    ['legal', ['法律', 'icourt', '无讼', '律师', '法信', '北大法宝', 'pkulaw']],
    ['medical', ['his', 'lis', 'pacs', '医疗', 'hospital', 'medical', '卫宁', '东华']],
    ['engineering', ['广联达', 'glodon', 'autocad', 'autodesk', 'revit', 'bim', '品茗', '斯维尔', '鲁班']],
    ['stock', ['东方财富', '同花顺', 'wind', '万得', '通达信', 'choice', 'bloomberg', 'ifind', '大智慧', 'tradingview']],
    ['insurance', ['保险', 'insurance', '核保', '理赔']],
    ['education', ['classin', '腾讯课堂', '作业帮', '猿辅导', '学而思', '教务', '排课']],
    ['crm', ['salesforce', 'hubspot', '纷享销客', '有赞', '微店']],
    ['design', ['photoshop', 'illustrator', 'figma', 'sketch', '稿定', '创客贴', 'canva']],
    ['media', ['剪映', 'capcut', 'premiere', 'davinci', 'final cut']],
    ['dev', ['visual studio', 'jetbrains', 'intellij', 'pycharm', 'webstorm', 'vscode']],
    ['communication', ['微信', 'wechat', '钉钉', 'dingtalk', '飞书', 'lark', 'slack', 'teams']],
    ['office', ['office', 'wps', 'libreoffice', 'excel', 'word', 'powerpoint']],
    ['browser', ['chrome', 'edge', 'firefox', 'safari', 'brave', '360']],
  ]

  for (const [category, keywords] of categoryMap) {
    if (keywords.some((kw) => combined.includes(kw))) return category
  }
  return 'other'
}

// ────────────────────── Layer 3: 行业推断 ──────────────────────

function inferIndustry(apps: InstalledApp[]): IndustryGuess[] {
  const appNames = apps.map((a) => `${a.name} ${a.publisher || ''}`).join(' ').toLowerCase()
  const guesses: IndustryGuess[] = []

  for (const rule of INDUSTRY_RULES) {
    const matched: string[] = []
    for (const kw of rule.keywords) {
      if (appNames.includes(kw.toLowerCase())) {
        matched.push(kw)
      }
    }

    if (matched.length > 0) {
      const confidence = Math.min(matched.length * rule.weight * 0.15, 0.95)
      guesses.push({
        industry: rule.industry,
        confidence,
        matchedApps: matched,
        suggestedSolution: rule.solution,
      })
    }
  }

  // 也从 app category 统计中补充
  const categoryCount: Record<AppCategory, number> = {} as any
  for (const a of apps) {
    categoryCount[a.category] = (categoryCount[a.category] || 0) + 1
  }

  const categoryToIndustry: Partial<Record<AppCategory, { industry: string; solution: string }>> = {
    finance: { industry: '财务/会计', solution: 'finance-tax-service' },
    legal: { industry: '法律服务', solution: 'law-firm' },
    engineering: { industry: '工程造价', solution: 'construction-cost' },
    medical: { industry: '医疗/临床', solution: 'clinic-respiratory' },
    stock: { industry: '投资/证券', solution: 'investment-research' },
    insurance: { industry: '保险服务', solution: 'insurance-operations' },
    education: { industry: '教育培训', solution: 'education-training' },
  }

  for (const [cat, count] of Object.entries(categoryCount)) {
    const mapping = categoryToIndustry[cat as AppCategory]
    if (!mapping || count < 1) continue
    const existing = guesses.find((g) => g.industry === mapping.industry)
    if (!existing) {
      guesses.push({
        industry: mapping.industry,
        confidence: Math.min(count * 0.2, 0.6),
        matchedApps: apps.filter((a) => a.category === cat).map((a) => a.name).slice(0, 3),
        suggestedSolution: mapping.solution,
      })
    }
  }

  return guesses.sort((a, b) => b.confidence - a.confidence)
}

// ────────────────────── Layer 4: 效率测量 ──────────────────────

const efficiencyLogPath = () => {
  const dataDir = path.join(app.getPath('userData'), 'workflow-miner')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  return path.join(dataDir, 'efficiency.jsonl')
}

function recordEfficiency(record: EfficiencyRecord): void {
  try {
    const line = JSON.stringify(record) + '\n'
    fs.appendFileSync(efficiencyLogPath(), line)
  } catch {
    // 效率记录失败不阻塞
  }
}

function loadEfficiencyRecords(solutionId?: string, days = 30): EfficiencyRecord[] {
  try {
    const filePath = efficiencyLogPath()
    if (!fs.existsSync(filePath)) return []

    const content = fs.readFileSync(filePath, 'utf-8')
    const cutoff = new Date(Date.now() - days * 86400000).toISOString()

    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        try { return JSON.parse(line) } catch { return null }
      })
      .filter((r): r is EfficiencyRecord => {
        if (!r) return false
        if (r.timestamp < cutoff) return false
        if (solutionId && r.solutionId !== solutionId) return false
        return true
      })
  } catch {
    return []
  }
}

interface CostBenefitReport {
  solutionId: string
  period: string
  taskCount: number
  totalManualMs: number
  totalAssistedMs: number
  savedMs: number
  savedPercent: number
  tasks: {
    name: string
    count: number
    avgManualMs: number
    avgAssistedMs: number
    savedPercent: number
  }[]
}

function generateCostBenefitReport(solutionId: string, days = 30): CostBenefitReport {
  const records = loadEfficiencyRecords(solutionId, days)

  const taskMap: Record<string, { manualMs: number[]; assistedMs: number[] }> = {}

  for (const r of records) {
    if (!taskMap[r.taskName]) taskMap[r.taskName] = { manualMs: [], assistedMs: [] }
    if (r.manualDurationMs != null) taskMap[r.taskName].manualMs.push(r.manualDurationMs)
    if (r.assistedDurationMs != null) taskMap[r.taskName].assistedMs.push(r.assistedDurationMs)
  }

  let totalManual = 0
  let totalAssisted = 0
  const tasks: CostBenefitReport['tasks'] = []

  for (const [name, data] of Object.entries(taskMap)) {
    const avgManual = data.manualMs.length > 0
      ? data.manualMs.reduce((s, v) => s + v, 0) / data.manualMs.length : 0
    const avgAssisted = data.assistedMs.length > 0
      ? data.assistedMs.reduce((s, v) => s + v, 0) / data.assistedMs.length : 0

    const count = Math.max(data.manualMs.length, data.assistedMs.length)
    totalManual += avgManual * count
    totalAssisted += avgAssisted * count

    tasks.push({
      name,
      count,
      avgManualMs: Math.round(avgManual),
      avgAssistedMs: Math.round(avgAssisted),
      savedPercent: avgManual > 0 ? Math.round((1 - avgAssisted / avgManual) * 100) : 0,
    })
  }

  tasks.sort((a, b) => b.savedPercent - a.savedPercent)

  return {
    solutionId,
    period: `${days}天`,
    taskCount: records.length,
    totalManualMs: Math.round(totalManual),
    totalAssistedMs: Math.round(totalAssisted),
    savedMs: Math.round(totalManual - totalAssisted),
    savedPercent: totalManual > 0 ? Math.round((1 - totalAssisted / totalManual) * 100) : 0,
    tasks,
  }
}

// ────────────────────── 冷启动结果缓存 ──────────────────────

const coldStartCachePath = () => path.join(app.getPath('userData'), 'workflow-miner', 'cold-start.json')

interface ColdStartResult {
  scannedAt: string
  apps: InstalledApp[]
  industryGuesses: IndustryGuess[]
}

function loadColdStartCache(): ColdStartResult | null {
  try {
    const filePath = coldStartCachePath()
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function saveColdStartCache(result: ColdStartResult): void {
  try {
    const dir = path.dirname(coldStartCachePath())
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(coldStartCachePath(), JSON.stringify(result, null, 2))
  } catch {
    // ignore
  }
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupWorkflowMinerIPC(): void {
  // 扫描已安装软件 + 推断行业（首次启动用）
  ipcMain.handle('miner:scan', async (): Promise<ColdStartResult> => {
    const cached = loadColdStartCache()
    if (cached) {
      const cacheAge = Date.now() - new Date(cached.scannedAt).getTime()
      if (cacheAge < 7 * 86400000) return cached
    }

    const apps = process.platform === 'win32' ? scanWindowsApps() : []
    const industryGuesses = inferIndustry(apps)

    const result: ColdStartResult = {
      scannedAt: new Date().toISOString(),
      apps,
      industryGuesses,
    }
    saveColdStartCache(result)
    return result
  })

  // 获取行业推断结果（不重新扫描）
  ipcMain.handle('miner:industry', async (): Promise<IndustryGuess[]> => {
    const cached = loadColdStartCache()
    return cached?.industryGuesses || []
  })

  // 记录效率数据（单次操作）
  ipcMain.handle('miner:recordEfficiency', (_, record: EfficiencyRecord) => {
    recordEfficiency(record)
    return { success: true }
  })

  // 生成成本收益报告
  ipcMain.handle('miner:costBenefitReport', (_, solutionId: string, days?: number): CostBenefitReport => {
    return generateCostBenefitReport(solutionId, days || 30)
  })

  // 加载效率历史
  ipcMain.handle('miner:efficiencyHistory', (_, solutionId?: string, days?: number): EfficiencyRecord[] => {
    return loadEfficiencyRecords(solutionId, days || 30)
  })
}
