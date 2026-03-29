// UserMemory — 用户偏好记忆引擎
// Phase 6: 让 MBE Desktop 从"健忘症工具"变成"越用越懂你的管家"
//
// 三层记忆架构：
//   1. Profile  — 用户画像（公司名、行业、纳税人类型、角色……）
//   2. Preferences — 偏好设置（文档主题、默认导出格式、语言、常用专家……）
//   3. Facts — 知识碎片（从对话中自动学习到的事实，如"张律师邮箱是 xxx"）
//
// 自动学习：Agent 回复中检测到用户事实时，自动沉淀到 memory_facts 表
// 上下文注入：每次 API 请求自动携带 memory summary，让 Agent "记住"用户

import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'

// ────────────────────── 类型定义 ──────────────────────

export interface UserProfile {
  company?: string
  industry?: string
  taxpayerType?: 'small' | 'general'
  role?: string
  location?: string
  employeeCount?: string
  /** 自定义字段，用户可随时补充 */
  [key: string]: string | undefined
}

export interface UserPreferences {
  docTheme?: 'light' | 'dark' | 'corporate'
  defaultExportFormat?: 'xlsx' | 'docx' | 'pptx' | 'pdf'
  language?: string
  currency?: string
  dateFormat?: string
  /** 常用专家，按使用频率排序 */
  favoriteExperts?: string[]
  /** 常用方案 ID */
  favoriteSolutions?: string[]
  /** 默认输出目录 */
  defaultOutputDir?: string
  /** 通知偏好 */
  notificationLevel?: 'all' | 'important' | 'none'
  [key: string]: unknown
}

export interface MemoryFact {
  id: string
  /** 事实类别 */
  category: 'contact' | 'business' | 'preference' | 'parameter' | 'context' | 'custom'
  /** 事实的键（去重用） */
  key: string
  /** 事实值 */
  value: string
  /** 来源（哪个会话/操作中学到的） */
  source?: string
  /** 关联的方案 */
  solutionId?: string
  /** 置信度 0-1 */
  confidence: number
  /** 使用次数（被注入到 context 的次数） */
  usageCount: number
  createdAt: string
  updatedAt: string
}

export interface FrequentParam {
  toolId: string
  paramKey: string
  paramValue: string
  usageCount: number
  lastUsedAt: string
}

export interface MemorySummary {
  profile: UserProfile
  preferences: UserPreferences
  recentFacts: MemoryFact[]
  topParams: FrequentParam[]
}

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

export function setMemoryMainWindow(win: BrowserWindow): void {
  mainWindow = win
}

export function setMemoryDb(db: typeof dbAdapter): void {
  dbAdapter = db
}

function emitToRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

// ────────────────────── Profile CRUD ──────────────────────

function getProfile(): UserProfile {
  if (!dbAdapter) return {}
  try {
    const row = dbAdapter.prepare(
      "SELECT data_json FROM user_memory WHERE key = 'profile'"
    ).get()
    return row ? JSON.parse(row.data_json as string) : {}
  } catch {
    return {}
  }
}

function updateProfile(partial: Partial<UserProfile>): UserProfile {
  const current = getProfile()
  const merged = { ...current, ...partial }
  // 清理 undefined 值
  for (const k of Object.keys(merged)) {
    if (merged[k] === undefined || merged[k] === null || merged[k] === '') {
      delete merged[k]
    }
  }
  upsertMemoryRow('profile', JSON.stringify(merged))
  emitToRenderer('memory:profileUpdated', merged)
  return merged
}

// ────────────────────── Preferences CRUD ──────────────────────

function getPreferences(): UserPreferences {
  if (!dbAdapter) return {}
  try {
    const row = dbAdapter.prepare(
      "SELECT data_json FROM user_memory WHERE key = 'preferences'"
    ).get()
    return row ? JSON.parse(row.data_json as string) : {}
  } catch {
    return {}
  }
}

function updatePreferences(partial: Partial<UserPreferences>): UserPreferences {
  const current = getPreferences()
  const merged = { ...current, ...partial }
  upsertMemoryRow('preferences', JSON.stringify(merged))
  emitToRenderer('memory:preferencesUpdated', merged)
  return merged
}

// ────────────────────── Facts CRUD ──────────────────────

function getFacts(solutionId?: string, category?: string, limit = 50): MemoryFact[] {
  if (!dbAdapter) return []
  try {
    let sql = 'SELECT * FROM memory_facts WHERE 1=1'
    const params: unknown[] = []
    if (solutionId) { sql += ' AND (solution_id = ? OR solution_id IS NULL)'; params.push(solutionId) }
    if (category) { sql += ' AND category = ?'; params.push(category) }
    sql += ' ORDER BY usage_count DESC, updated_at DESC LIMIT ?'
    params.push(limit)

    const rows = dbAdapter.prepare(sql).all(...params)
    return rows.map(rowToFact)
  } catch {
    return []
  }
}

function upsertFact(fact: Omit<MemoryFact, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>): MemoryFact {
  if (!dbAdapter) throw new Error('数据库未初始化')

  const now = new Date().toISOString()

  // 通过 category + key 去重
  const existing = dbAdapter.prepare(
    'SELECT * FROM memory_facts WHERE category = ? AND key = ?'
  ).get(fact.category, fact.key)

  if (existing) {
    const newConf = Math.max(existing.confidence as number, fact.confidence)
    dbAdapter.prepare(`
      UPDATE memory_facts SET value = ?, confidence = ?, source = ?,
        solution_id = COALESCE(?, solution_id), updated_at = ?
      WHERE id = ?
    `).run(fact.value, newConf, fact.source ?? null, fact.solutionId ?? null, now, existing.id)
    return rowToFact({ ...existing, value: fact.value, confidence: newConf, updated_at: now })
  }

  const id = randomUUID()
  dbAdapter.prepare(`
    INSERT INTO memory_facts (id, category, key, value, source, solution_id, confidence, usage_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(id, fact.category, fact.key, fact.value, fact.source ?? null, fact.solutionId ?? null, fact.confidence, now, now)

  return {
    id, category: fact.category, key: fact.key, value: fact.value,
    source: fact.source, solutionId: fact.solutionId,
    confidence: fact.confidence, usageCount: 0,
    createdAt: now, updatedAt: now,
  }
}

function deleteFact(factId: string): boolean {
  if (!dbAdapter) return false
  const { changes } = dbAdapter.prepare('DELETE FROM memory_facts WHERE id = ?').run(factId)
  return changes > 0
}

function incrementFactUsage(factIds: string[]): void {
  if (!dbAdapter || factIds.length === 0) return
  const placeholders = factIds.map(() => '?').join(',')
  dbAdapter.prepare(
    `UPDATE memory_facts SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id IN (${placeholders})`
  ).run(...factIds)
}

// ────────────────────── 常用参数学习 ──────────────────────

function recordParamUsage(toolId: string, params: Record<string, unknown>): void {
  if (!dbAdapter) return
  const now = new Date().toISOString()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    const strVal = typeof value === 'string' ? value : JSON.stringify(value)
    if (strVal.length > 500) continue

    const existing = dbAdapter.prepare(
      'SELECT * FROM frequent_params WHERE tool_id = ? AND param_key = ? AND param_value = ?'
    ).get(toolId, key, strVal)

    if (existing) {
      dbAdapter.prepare(
        'UPDATE frequent_params SET usage_count = usage_count + 1, last_used_at = ? WHERE id = ?'
      ).run(now, existing.id)
    } else {
      dbAdapter.prepare(
        'INSERT INTO frequent_params (id, tool_id, param_key, param_value, usage_count, last_used_at) VALUES (?, ?, ?, ?, 1, ?)'
      ).run(randomUUID(), toolId, key, strVal, now)
    }
  }
}

function getTopParams(toolId?: string, limit = 20): FrequentParam[] {
  if (!dbAdapter) return []
  try {
    let sql = 'SELECT * FROM frequent_params'
    const params: unknown[] = []
    if (toolId) { sql += ' WHERE tool_id = ?'; params.push(toolId) }
    sql += ' ORDER BY usage_count DESC LIMIT ?'
    params.push(limit)

    return dbAdapter.prepare(sql).all(...params).map(row => ({
      toolId: row.tool_id as string,
      paramKey: row.param_key as string,
      paramValue: row.param_value as string,
      usageCount: row.usage_count as number,
      lastUsedAt: row.last_used_at as string,
    }))
  } catch {
    return []
  }
}

// ────────────────────── Memory Summary（注入到 API 请求） ──────────────────────

function buildMemorySummary(solutionId?: string): MemorySummary {
  return {
    profile: getProfile(),
    preferences: getPreferences(),
    recentFacts: getFacts(solutionId, undefined, 20),
    topParams: getTopParams(undefined, 15),
  }
}

/**
 * 生成可注入到 Agent system prompt 的文本摘要
 * 控制在 500 字以内，避免消耗过多 token
 */
function buildMemoryPromptText(solutionId?: string): string {
  const summary = buildMemorySummary(solutionId)
  const parts: string[] = []

  // 用户画像
  const profileEntries = Object.entries(summary.profile).filter(([, v]) => v)
  if (profileEntries.length > 0) {
    parts.push('## 用户信息')
    for (const [k, v] of profileEntries) {
      const label = PROFILE_LABELS[k] ?? k
      parts.push(`- ${label}: ${v}`)
    }
  }

  // 偏好
  const prefEntries = Object.entries(summary.preferences)
    .filter(([k, v]) => v !== undefined && !['favoriteExperts', 'favoriteSolutions'].includes(k))
  if (prefEntries.length > 0) {
    parts.push('## 用户偏好')
    for (const [k, v] of prefEntries) {
      const label = PREF_LABELS[k] ?? k
      parts.push(`- ${label}: ${v}`)
    }
  }

  // 关键事实（高置信 + 高使用）
  const relevantFacts = summary.recentFacts
    .filter(f => f.confidence >= 0.6)
    .slice(0, 10)
  if (relevantFacts.length > 0) {
    parts.push('## 已知事实')
    for (const f of relevantFacts) {
      parts.push(`- ${f.key}: ${f.value}`)
    }
  }

  // 常用参数
  const topParams = summary.topParams
    .filter(p => p.usageCount >= 2)
    .slice(0, 5)
  if (topParams.length > 0) {
    parts.push('## 常用参数')
    for (const p of topParams) {
      parts.push(`- ${p.toolId}.${p.paramKey} = ${p.paramValue} (用过${p.usageCount}次)`)
    }
  }

  if (parts.length === 0) return ''

  // 标记使用过的 fact id
  const usedFactIds = relevantFacts.map(f => f.id)
  if (usedFactIds.length > 0) {
    incrementFactUsage(usedFactIds)
  }

  return parts.join('\n')
}

const PROFILE_LABELS: Record<string, string> = {
  company: '公司名称',
  industry: '所属行业',
  taxpayerType: '纳税人类型',
  role: '职位/角色',
  location: '所在地',
  employeeCount: '公司规模',
}

const PREF_LABELS: Record<string, string> = {
  docTheme: '文档主题',
  defaultExportFormat: '默认导出格式',
  language: '语言',
  currency: '货币',
  dateFormat: '日期格式',
  defaultOutputDir: '默认输出目录',
  notificationLevel: '通知级别',
}

// ────────────────────── 自动事实提取（从对话内容学习） ──────────────────────

interface ExtractedFact {
  category: MemoryFact['category']
  key: string
  value: string
  confidence: number
}

/**
 * 从用户输入中提取可学习的事实
 * 规则式 + 正则，不依赖 LLM
 */
function extractFactsFromText(text: string): ExtractedFact[] {
  const facts: ExtractedFact[] = []

  // 公司名："我们公司是XX" / "我在XX工作" / "我们XX公司"
  const companyPatterns = [
    /我(?:们)?(?:公司|单位|企业)(?:是|叫|名?称?)(?:叫?)\s*[「"'"【]?([^「"'"】\s,，。.]{2,20})[」"'"】]?/,
    /我在([^「"'"】\s,，。.]{2,20})(?:公司|集团|有限|工作|上班)/,
    /([^「"'"】\s,，。.]{2,20})(?:公司|集团|有限)(?:的|是我)/,
  ]
  for (const re of companyPatterns) {
    const m = text.match(re)
    if (m?.[1]) {
      facts.push({ category: 'business', key: '公司名称', value: m[1].trim(), confidence: 0.8 })
      break
    }
  }

  // 行业
  const industryPatterns = [
    /我(?:们)?(?:是|做)(?:的?是?)\s*([^,，。.\s]{2,10})(?:行业|领域|方向)/,
    /(?:属于|从事)\s*([^,，。.\s]{2,10})(?:行业|领域)/,
  ]
  for (const re of industryPatterns) {
    const m = text.match(re)
    if (m?.[1]) {
      facts.push({ category: 'business', key: '所属行业', value: m[1].trim(), confidence: 0.7 })
      break
    }
  }

  // 纳税人类型
  if (/小规模/.test(text)) {
    facts.push({ category: 'business', key: '纳税人类型', value: '小规模纳税人', confidence: 0.9 })
  } else if (/一般纳税人/.test(text)) {
    facts.push({ category: 'business', key: '纳税人类型', value: '一般纳税人', confidence: 0.9 })
  }

  // 邮箱
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
  if (emailMatch) {
    const email = emailMatch[1]
    // 尝试提取关联人名："张律师的邮箱是 xxx" / "发给 xxx@"
    const nameBeforeEmail = text.match(
      /([^,，。.\s]{2,6}?)(?:的?邮箱|的?email|的?Email)\s*(?:是|为|:：)?\s*/
    )
    const key = nameBeforeEmail?.[1] ? `${nameBeforeEmail[1]}的邮箱` : '常用邮箱'
    facts.push({ category: 'contact', key, value: email, confidence: 0.85 })
  }

  // 电话
  const phoneMatch = text.match(/(1[3-9]\d{9})/)
  if (phoneMatch) {
    const nameBeforePhone = text.match(
      /([^,，。.\s]{2,6}?)(?:的?(?:手机|电话|号码|联系方式))\s*(?:是|为|:：)?\s*/
    )
    const key = nameBeforePhone?.[1] ? `${nameBeforePhone[1]}的电话` : '常用电话'
    facts.push({ category: 'contact', key, value: phoneMatch[1], confidence: 0.85 })
  }

  // 地址/所在地
  const locationPatterns = [
    /我(?:们)?(?:在|位于|坐落)\s*([^,，。.\s]{2,15})/,
    /公司地址(?:是|在|为)\s*([^,，。.]{3,30})/,
  ]
  for (const re of locationPatterns) {
    const m = text.match(re)
    if (m?.[1]) {
      facts.push({ category: 'business', key: '所在地', value: m[1].trim(), confidence: 0.7 })
      break
    }
  }

  // 文档偏好
  if (/深色|dark|暗色/.test(text) && /(?:PPT|ppt|主题|模板|风格)/.test(text)) {
    facts.push({ category: 'preference', key: '文档主题偏好', value: 'dark', confidence: 0.8 })
  }
  if (/浅色|light|白色/.test(text) && /(?:PPT|ppt|主题|模板|风格)/.test(text)) {
    facts.push({ category: 'preference', key: '文档主题偏好', value: 'light', confidence: 0.8 })
  }

  // 默认格式偏好
  const formatPref = text.match(/(?:默认|总是|一直)(?:用|导出|生成)\s*(Excel|Word|PPT|PDF)/i)
  if (formatPref) {
    const formatMap: Record<string, string> = { excel: 'xlsx', word: 'docx', ppt: 'pptx', pdf: 'pdf' }
    const fmt = formatMap[formatPref[1].toLowerCase()] ?? formatPref[1].toLowerCase()
    facts.push({ category: 'preference', key: '默认导出格式', value: fmt, confidence: 0.85 })
  }

  return facts
}

/**
 * 从对话内容自动学习事实并持久化
 * 在每次用户发送消息时调用
 */
function learnFromConversation(
  userMessage: string,
  solutionId?: string,
  conversationId?: string,
): ExtractedFact[] {
  const extracted = extractFactsFromText(userMessage)
  if (extracted.length === 0) return []

  const source = conversationId ? `conversation:${conversationId}` : 'chat'
  const persisted: ExtractedFact[] = []

  for (const fact of extracted) {
    try {
      upsertFact({
        category: fact.category,
        key: fact.key,
        value: fact.value,
        confidence: fact.confidence,
        source,
        solutionId,
      })
      persisted.push(fact)

      // 同步更新 profile（如果是画像字段）
      if (fact.key === '公司名称') updateProfile({ company: fact.value })
      else if (fact.key === '所属行业') updateProfile({ industry: fact.value })
      else if (fact.key === '纳税人类型') {
        updateProfile({ taxpayerType: fact.value.includes('小') ? 'small' : 'general' })
      }
      else if (fact.key === '所在地') updateProfile({ location: fact.value })
    } catch (err) {
      console.error('[UserMemory] 学习事实失败:', err)
    }
  }

  if (persisted.length > 0) {
    emitToRenderer('memory:factsLearned', { facts: persisted, source })
  }

  return persisted
}

// ────────────────────── DB 辅助 ──────────────────────

function upsertMemoryRow(key: string, dataJson: string): void {
  if (!dbAdapter) return
  dbAdapter.prepare(`
    INSERT OR REPLACE INTO user_memory (key, data_json, updated_at) VALUES (?, ?, datetime('now'))
  `).run(key, dataJson)
}

function rowToFact(row: Record<string, unknown>): MemoryFact {
  return {
    id: row.id as string,
    category: row.category as MemoryFact['category'],
    key: row.key as string,
    value: row.value as string,
    source: row.source as string | undefined,
    solutionId: row.solution_id as string | undefined,
    confidence: (row.confidence as number) ?? 0,
    usageCount: (row.usage_count as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupUserMemoryIPC(): void {
  // ── Profile ──
  ipcMain.handle('memory:getProfile', async () => getProfile())
  ipcMain.handle('memory:updateProfile', async (_, partial: Partial<UserProfile>) => updateProfile(partial))

  // ── Preferences ──
  ipcMain.handle('memory:getPreferences', async () => getPreferences())
  ipcMain.handle('memory:updatePreferences', async (_, partial: Partial<UserPreferences>) => updatePreferences(partial))

  // ── Facts ──
  ipcMain.handle('memory:getFacts', async (_, solutionId?: string, category?: string, limit?: number) => {
    return getFacts(solutionId, category, limit)
  })
  ipcMain.handle('memory:upsertFact', async (_, fact: Omit<MemoryFact, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>) => {
    return upsertFact(fact)
  })
  ipcMain.handle('memory:deleteFact', async (_, factId: string) => deleteFact(factId))

  // ── 常用参数 ──
  ipcMain.handle('memory:recordParamUsage', async (_, toolId: string, params: Record<string, unknown>) => {
    recordParamUsage(toolId, params)
    return { recorded: true }
  })
  ipcMain.handle('memory:getTopParams', async (_, toolId?: string, limit?: number) => {
    return getTopParams(toolId, limit)
  })

  // ── Summary（前端注入到 API 请求用） ──
  ipcMain.handle('memory:getSummary', async (_, solutionId?: string) => {
    return buildMemorySummary(solutionId)
  })
  ipcMain.handle('memory:getPromptText', async (_, solutionId?: string) => {
    return buildMemoryPromptText(solutionId)
  })

  // ── 自动学习 ──
  ipcMain.handle('memory:learn', async (_, userMessage: string, solutionId?: string, conversationId?: string) => {
    return learnFromConversation(userMessage, solutionId, conversationId)
  })

  // ── 重置 ──
  ipcMain.handle('memory:reset', async () => {
    if (!dbAdapter) return { success: false }
    dbAdapter.prepare("DELETE FROM user_memory").run()
    dbAdapter.prepare("DELETE FROM memory_facts").run()
    dbAdapter.prepare("DELETE FROM frequent_params").run()
    emitToRenderer('memory:reset', {})
    return { success: true }
  })
}
