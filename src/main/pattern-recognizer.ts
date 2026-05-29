// PatternRecognizer — Layer 2: 从行为数据中发现可 AI 化的重复工作流
//
// 三种模式识别：
//   1. 频繁应用序列 — "用友→Excel→税控盘" 重复 >= 3 次/周 → 识别为记账报税流程
//   2. 时间规律任务 — 每周一 9:00 总打开某类软件 → 识别为周例行任务
//   3. 跨应用数据搬运 — 在 A 复制 → 在 B 粘贴 → 可被工作流自动化

import { ipcMain, BrowserWindow, Notification } from 'electron'
import { setFlag } from './module-flags'

// ────────────────────── 类型定义 ──────────────────────

export interface DetectedPattern {
  id: string
  type: 'frequent_sequence' | 'time_routine' | 'data_transfer'
  label: string
  description: string
  apps: string[]
  frequency: number
  avgDurationMs: number
  confidence: number
  suggestedSolution?: string
  suggestedWorkflow?: string
  estimatedManualMinutes: number
  estimatedAiMinutes: number
  status: 'new' | 'accepted' | 'dismissed' | 'automated'
  firstSeenAt: string
  lastSeenAt: string
}

export interface PatternMatch {
  patternKeywords: string[]
  solutionId: string
  workflowId?: string
  label: string
  estimatedManualMin: number
  estimatedAiMin: number
}

// ────────────────────── Solution 模式匹配规则 ──────────────────────
// Phase 4 会从 solution.yaml 加载，这里内置默认规则

const SOLUTION_PATTERNS: PatternMatch[] = [
  {
    patternKeywords: ['用友', 'yonyou', '金蝶', 'kingdee', 'excel', '税控', '开票', '航天', '百旺'],
    solutionId: 'finance-tax-service',
    workflowId: 'monthly_tax_filing',
    label: '记账报税流程',
    estimatedManualMin: 120,
    estimatedAiMin: 5,
  },
  {
    patternKeywords: ['发票', 'invoice', 'pdf', 'excel', '扫描'],
    solutionId: 'finance-tax-service',
    workflowId: 'invoice_processing',
    label: '发票入账处理',
    estimatedManualMin: 45,
    estimatedAiMin: 3,
  },
  {
    patternKeywords: ['法信', '北大法宝', 'pkulaw', 'icourt', '无讼', 'word', '裁判文书'],
    solutionId: 'law-firm',
    workflowId: 'case_analysis',
    label: '法律案件研究',
    estimatedManualMin: 180,
    estimatedAiMin: 15,
  },
  {
    patternKeywords: ['广联达', 'glodon', 'cad', 'autocad', 'revit', 'bim', '算量'],
    solutionId: 'construction-cost',
    workflowId: 'quantity_calc',
    label: '工程量计算',
    estimatedManualMin: 240,
    estimatedAiMin: 20,
  },
  {
    patternKeywords: ['东方财富', '同花顺', 'wind', '万得', '通达信', 'tradingview', 'choice'],
    solutionId: 'investment-research',
    workflowId: 'stock_analysis',
    label: '投资分析研究',
    estimatedManualMin: 90,
    estimatedAiMin: 10,
  },
  {
    patternKeywords: ['千牛', '生意参谋', '抖店', '聚水潭', '旺店通', '店小秘'],
    solutionId: 'ecommerce-brand-service',
    workflowId: 'order_management',
    label: '电商订单管理',
    estimatedManualMin: 60,
    estimatedAiMin: 5,
  },
  {
    patternKeywords: ['his', 'lis', 'pacs', '病历', '医疗', '诊断'],
    solutionId: 'clinic-respiratory',
    workflowId: 'clinical_assessment',
    label: '临床评估辅助',
    estimatedManualMin: 30,
    estimatedAiMin: 5,
  },
  {
    patternKeywords: ['保险', '核保', '理赔', '保费', '精算'],
    solutionId: 'insurance-operations',
    workflowId: 'claim_processing',
    label: '理赔处理流程',
    estimatedManualMin: 45,
    estimatedAiMin: 8,
  },
  {
    patternKeywords: ['boss直聘', '猎聘', '北森', 'moka', '社保', '薪人薪事', '飞书人事'],
    solutionId: 'smb-operations',
    workflowId: 'hr_onboarding',
    label: '招聘入职流程',
    estimatedManualMin: 60,
    estimatedAiMin: 10,
  },
  {
    patternKeywords: ['classin', '腾讯课堂', '排课', '教务', '学而思'],
    solutionId: 'education-training',
    workflowId: 'course_planning',
    label: '课程排期管理',
    estimatedManualMin: 40,
    estimatedAiMin: 5,
  },
]

// ────────────────────── Module State ──────────────────────

let mainWindow: BrowserWindow | null = null
let dbAdapter: {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...args: unknown[]) => Record<string, unknown>[]
    get: (...args: unknown[]) => Record<string, unknown> | undefined
    run: (...args: unknown[]) => { changes: number }
  }
} | null = null

let analysisInterval: ReturnType<typeof setInterval> | null = null
let initialAnalysisTimer: ReturnType<typeof setTimeout> | null = null
const ANALYSIS_INTERVAL_MS = 4 * 3600 * 1000 // 每 4 小时分析一次

// ────────────────────── 模块初始化 ──────────────────────

export function setPatternRecognizerMainWindow(win: BrowserWindow): void {
  mainWindow = win
}

export function setPatternRecognizerDb(db: typeof dbAdapter): void {
  dbAdapter = db
  ensureTable()
}

function ensureTable(): void {
  if (!dbAdapter) return
  try {
    dbAdapter.exec(`
      CREATE TABLE IF NOT EXISTS detected_patterns (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        apps_json TEXT NOT NULL DEFAULT '[]',
        frequency INTEGER DEFAULT 0,
        avg_duration_ms INTEGER DEFAULT 0,
        confidence REAL DEFAULT 0,
        suggested_solution TEXT,
        suggested_workflow TEXT,
        estimated_manual_min INTEGER DEFAULT 0,
        estimated_ai_min INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'new',
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_patterns_status ON detected_patterns(status);
      CREATE INDEX IF NOT EXISTS idx_patterns_solution ON detected_patterns(suggested_solution);
    `)
  } catch (err) {
    console.error('[PatternRecognizer] 建表失败:', err)
  }
}

// ────────────────────── 核心分析算法 ──────────────────────

function analyzeFrequentSequences(): DetectedPattern[] {
  if (!dbAdapter) return []
  const patterns: DetectedPattern[] = []

  try {
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString()
    const rows = dbAdapter.prepare(`
      SELECT app_name, window_title, duration_ms, created_at
      FROM behavior_events
      WHERE event_type = 'app_switch' AND created_at >= ?
      ORDER BY created_at ASC
    `).all(cutoff) as { app_name: string; window_title: string; duration_ms: number; created_at: string }[]

    if (rows.length < 3) return patterns

    // 滑动窗口提取 2-gram 和 3-gram 应用序列
    const bigramCounts = new Map<string, { count: number; totalMs: number; apps: string[]; titles: string[] }>()
    const trigramCounts = new Map<string, { count: number; totalMs: number; apps: string[]; titles: string[] }>()

    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i].app_name.toLowerCase()
      const b = rows[i + 1].app_name.toLowerCase()
      if (a === b) continue

      const biKey = `${a}→${b}`
      const bi = bigramCounts.get(biKey) || { count: 0, totalMs: 0, apps: [a, b], titles: [] }
      bi.count++
      bi.totalMs += (rows[i].duration_ms || 0) + (rows[i + 1].duration_ms || 0)
      bi.titles.push(rows[i].window_title, rows[i + 1].window_title)
      bigramCounts.set(biKey, bi)

      if (i < rows.length - 2) {
        const c = rows[i + 2].app_name.toLowerCase()
        if (b !== c) {
          const triKey = `${a}→${b}→${c}`
          const tri = trigramCounts.get(triKey) || { count: 0, totalMs: 0, apps: [a, b, c], titles: [] }
          tri.count++
          tri.totalMs += (rows[i].duration_ms || 0) + (rows[i + 1].duration_ms || 0) + (rows[i + 2].duration_ms || 0)
          tri.titles.push(rows[i].window_title, rows[i + 1].window_title, rows[i + 2].window_title)
          trigramCounts.set(triKey, tri)
        }
      }
    }

    // 过滤出频率 >= 3 的序列
    const MIN_FREQUENCY = 3

    for (const [key, data] of trigramCounts) {
      if (data.count < MIN_FREQUENCY) continue
      const match = matchSolutionPattern(data.apps, data.titles)
      const avgMs = Math.round(data.totalMs / data.count)

      patterns.push({
        id: `seq3_${hashString(key)}`,
        type: 'frequent_sequence',
        label: match?.label || `${data.apps.join(' → ')} 工作流`,
        description: `您每周平均 ${data.count} 次在这些应用间切换`,
        apps: data.apps.map(a => a.charAt(0).toUpperCase() + a.slice(1)),
        frequency: data.count,
        avgDurationMs: avgMs,
        confidence: Math.min(data.count * 0.12, 0.95),
        suggestedSolution: match?.solutionId,
        suggestedWorkflow: match?.workflowId,
        estimatedManualMinutes: match?.estimatedManualMin || Math.round(avgMs / 60000),
        estimatedAiMinutes: match?.estimatedAiMin || Math.max(1, Math.round(avgMs / 60000 / 5)),
        status: 'new',
        firstSeenAt: rows[0].created_at,
        lastSeenAt: rows[rows.length - 1].created_at,
      })
    }

    for (const [key, data] of bigramCounts) {
      if (data.count < MIN_FREQUENCY * 2) continue
      const alreadyCovered = patterns.some((p) =>
        p.apps.length === 3 && data.apps.every((a) => p.apps.map(x => x.toLowerCase()).includes(a)),
      )
      if (alreadyCovered) continue

      const match = matchSolutionPattern(data.apps, data.titles)
      const avgMs = Math.round(data.totalMs / data.count)

      patterns.push({
        id: `seq2_${hashString(key)}`,
        type: 'frequent_sequence',
        label: match?.label || `${data.apps.join(' → ')} 切换`,
        description: `每周 ${data.count} 次在这两个应用间切换`,
        apps: data.apps.map(a => a.charAt(0).toUpperCase() + a.slice(1)),
        frequency: data.count,
        avgDurationMs: avgMs,
        confidence: Math.min(data.count * 0.08, 0.85),
        suggestedSolution: match?.solutionId,
        suggestedWorkflow: match?.workflowId,
        estimatedManualMinutes: match?.estimatedManualMin || Math.round(avgMs / 60000),
        estimatedAiMinutes: match?.estimatedAiMin || Math.max(1, Math.round(avgMs / 60000 / 3)),
        status: 'new',
        firstSeenAt: rows[0].created_at,
        lastSeenAt: rows[rows.length - 1].created_at,
      })
    }
  } catch (err) {
    console.error('[PatternRecognizer] 序列分析失败:', err)
  }

  return patterns
}

function analyzeTimeRoutines(): DetectedPattern[] {
  if (!dbAdapter) return []
  const patterns: DetectedPattern[] = []

  try {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
    const rows = dbAdapter.prepare(`
      SELECT app_name,
             strftime('%w', created_at) as day_of_week,
             strftime('%H', created_at) as hour,
             COUNT(*) as cnt,
             AVG(duration_ms) as avg_ms
      FROM behavior_events
      WHERE event_type = 'app_switch' AND created_at >= ?
        AND app_name NOT IN ('explorer', 'searchhost', 'shellexperiencehost', 'startmenuexperiencehost')
      GROUP BY app_name, day_of_week, hour
      HAVING cnt >= 4
      ORDER BY cnt DESC
      LIMIT 10
    `).all(cutoff) as { app_name: string; day_of_week: string; hour: string; cnt: number; avg_ms: number }[]

    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

    for (const row of rows) {
      const dayName = dayNames[parseInt(row.day_of_week)] || `第${row.day_of_week}天`
      const hour = parseInt(row.hour)
      const match = matchSolutionPattern([row.app_name], [])

      patterns.push({
        id: `time_${hashString(`${row.app_name}_${row.day_of_week}_${row.hour}`)}`,
        type: 'time_routine',
        label: `${dayName} ${hour}:00 例行：${row.app_name}`,
        description: `过去 30 天，您在${dayName} ${hour}:00 左右 ${row.cnt} 次使用 ${row.app_name}`,
        apps: [row.app_name],
        frequency: row.cnt,
        avgDurationMs: Math.round(row.avg_ms || 0),
        confidence: Math.min(row.cnt * 0.06, 0.8),
        suggestedSolution: match?.solutionId,
        suggestedWorkflow: match?.workflowId,
        estimatedManualMinutes: match?.estimatedManualMin || Math.round((row.avg_ms || 0) / 60000),
        estimatedAiMinutes: match?.estimatedAiMin || 2,
        status: 'new',
        firstSeenAt: cutoff,
        lastSeenAt: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.error('[PatternRecognizer] 时间规律分析失败:', err)
  }

  return patterns
}

// ────────────────────── 模式→方案匹配 ──────────────────────

function matchSolutionPattern(apps: string[], titles: string[]): PatternMatch | null {
  const searchText = [...apps, ...titles].join(' ').toLowerCase()

  let bestMatch: PatternMatch | null = null
  let bestScore = 0

  for (const pattern of SOLUTION_PATTERNS) {
    let score = 0
    for (const kw of pattern.patternKeywords) {
      if (searchText.includes(kw.toLowerCase())) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = pattern
    }
  }

  return bestScore >= 1 ? bestMatch : null
}

// ────────────────────── 持久化 + 去重 ──────────────────────

function persistPatterns(patterns: DetectedPattern[]): DetectedPattern[] {
  if (!dbAdapter) return patterns
  const newPatterns: DetectedPattern[] = []

  for (const p of patterns) {
    try {
      const existing = dbAdapter.prepare(
        'SELECT id, status, frequency FROM detected_patterns WHERE id = ?',
      ).get(p.id)

      if (existing) {
        if ((existing.status as string) === 'dismissed') continue
        dbAdapter.prepare(`
          UPDATE detected_patterns
          SET frequency = ?, avg_duration_ms = ?, confidence = ?, last_seen_at = ?
          WHERE id = ?
        `).run(p.frequency, p.avgDurationMs, p.confidence, p.lastSeenAt, p.id)
      } else {
        dbAdapter.prepare(`
          INSERT INTO detected_patterns
            (id, type, label, description, apps_json, frequency, avg_duration_ms, confidence,
             suggested_solution, suggested_workflow, estimated_manual_min, estimated_ai_min,
             status, first_seen_at, last_seen_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          p.id, p.type, p.label, p.description, JSON.stringify(p.apps),
          p.frequency, p.avgDurationMs, p.confidence,
          p.suggestedSolution ?? null, p.suggestedWorkflow ?? null,
          p.estimatedManualMinutes, p.estimatedAiMinutes,
          p.status, p.firstSeenAt, p.lastSeenAt,
        )
        newPatterns.push(p)
      }
    } catch (err) {
      console.error('[PatternRecognizer] 持久化失败:', err)
    }
  }

  return newPatterns
}

// ────────────────────── 通知新发现 ──────────────────────

function notifyNewPatterns(patterns: DetectedPattern[]): void {
  const actionable = patterns.filter((p) => p.suggestedSolution && p.confidence >= 0.3)
  if (actionable.length === 0) return

  const top = actionable[0]
  const savedMin = top.estimatedManualMinutes - top.estimatedAiMinutes

  if (Notification.isSupported()) {
    const n = new Notification({
      title: `发现可自动化流程：${top.label}`,
      body: `每次可节省约 ${savedMin} 分钟。点击查看详情。`,
      urgency: 'normal',
    })
    n.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
        mainWindow.webContents.send('pattern:newDiscovery', top)
      }
    })
    n.show()
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pattern:newDiscovery', top)
  }
}

// ────────────────────── 运行分析 ──────────────────────

export function runPatternAnalysis(): { patterns: DetectedPattern[]; newCount: number } {
  const seqPatterns = analyzeFrequentSequences()
  const timePatterns = analyzeTimeRoutines()
  const allPatterns = [...seqPatterns, ...timePatterns]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20)

  const newPatterns = persistPatterns(allPatterns)
  if (newPatterns.length > 0) {
    notifyNewPatterns(newPatterns)
  }

  return { patterns: allPatterns, newCount: newPatterns.length }
}

// ────────────────────── 查询接口 ──────────────────────

function loadPatterns(status?: string): DetectedPattern[] {
  if (!dbAdapter) return []
  try {
    const sql = status
      ? `SELECT * FROM detected_patterns WHERE status = ? ORDER BY confidence DESC, frequency DESC`
      : `SELECT * FROM detected_patterns WHERE status != 'dismissed' ORDER BY confidence DESC, frequency DESC`
    const rows = status
      ? dbAdapter.prepare(sql).all(status)
      : dbAdapter.prepare(sql).all()
    return rows.map(mapPatternRow)
  } catch {
    return []
  }
}

function updatePatternStatus(patternId: string, status: DetectedPattern['status']): boolean {
  if (!dbAdapter) return false
  try {
    dbAdapter.prepare('UPDATE detected_patterns SET status = ? WHERE id = ?').run(status, patternId)
    return true
  } catch {
    return false
  }
}

function mapPatternRow(r: Record<string, unknown>): DetectedPattern {
  return {
    id: r.id as string,
    type: r.type as DetectedPattern['type'],
    label: r.label as string,
    description: r.description as string,
    apps: JSON.parse((r.apps_json as string) || '[]'),
    frequency: (r.frequency as number) || 0,
    avgDurationMs: (r.avg_duration_ms as number) || 0,
    confidence: (r.confidence as number) || 0,
    suggestedSolution: r.suggested_solution as string | undefined,
    suggestedWorkflow: r.suggested_workflow as string | undefined,
    estimatedManualMinutes: (r.estimated_manual_min as number) || 0,
    estimatedAiMinutes: (r.estimated_ai_min as number) || 0,
    status: (r.status as DetectedPattern['status']) || 'new',
    firstSeenAt: r.first_seen_at as string,
    lastSeenAt: r.last_seen_at as string,
  }
}

// ────────────────────── 工具函数 ──────────────────────

function hashString(s: string): string {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}

// ────────────────────── 生命周期 ──────────────────────

export function startPatternRecognizer(): void {
  if (analysisInterval) return
  initialAnalysisTimer = setTimeout(() => {
    initialAnalysisTimer = null
    runPatternAnalysis()
  }, 30000)
  analysisInterval = setInterval(() => runPatternAnalysis(), ANALYSIS_INTERVAL_MS)
  console.log('[PatternRecognizer] 已启动（每 4h 分析一次）')
}

export function stopPatternRecognizer(): void {
  if (initialAnalysisTimer) {
    clearTimeout(initialAnalysisTimer)
    initialAnalysisTimer = null
  }
  if (analysisInterval) {
    clearInterval(analysisInterval)
    analysisInterval = null
  }
  console.log('[PatternRecognizer] 已停止')
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupPatternRecognizerIPC(): void {
  ipcMain.handle('pattern:enabled', () => analysisInterval !== null)

  ipcMain.handle('pattern:setEnabled', (_, enabled: boolean) => {
    if (enabled && !analysisInterval) startPatternRecognizer()
    if (!enabled && analysisInterval) stopPatternRecognizer()
    setFlag('patternRecognizer', enabled) // 持久化：重启后保持用户选择
    return { success: true, enabled }
  })

  ipcMain.handle('pattern:list', (_, status?: string) => {
    return loadPatterns(status)
  })

  ipcMain.handle('pattern:analyze', () => {
    return runPatternAnalysis()
  })

  ipcMain.handle('pattern:accept', (_, patternId: string) => {
    return { success: updatePatternStatus(patternId, 'accepted') }
  })

  ipcMain.handle('pattern:dismiss', (_, patternId: string) => {
    return { success: updatePatternStatus(patternId, 'dismissed') }
  })

  ipcMain.handle('pattern:automate', (_, patternId: string) => {
    return { success: updatePatternStatus(patternId, 'automated') }
  })

  // 注册/更新外部 solution 的 miner patterns（Phase 4 从 YAML 加载后调用）
  ipcMain.handle('pattern:registerSolutionPatterns', (_, patterns: PatternMatch[]) => {
    for (const p of patterns) {
      const exists = SOLUTION_PATTERNS.find(
        (sp) => sp.solutionId === p.solutionId && sp.workflowId === p.workflowId,
      )
      if (!exists) {
        SOLUTION_PATTERNS.push(p)
      }
    }
    return { success: true, totalRules: SOLUTION_PATTERNS.length }
  })
}
