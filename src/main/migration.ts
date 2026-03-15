// 旧版 Agent 数据迁移引擎
// 检测 ~/Documents/ 下各 Agent 的 session.json 和 localStorage 中的对话历史，
// 导入到 MBE Desktop 统一 SQLite 数据库。

import { app, ipcMain, safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'

/** 旧版 Agent 目录映射 → solution_id */
const LEGACY_AGENTS: { dirName: string; solutionId: string; agentId: string; label: string }[] = [
  { dirName: 'MBE Finance', solutionId: 'finance-tax-service', agentId: 'finance', label: 'MBE 财务' },
  { dirName: 'MBE Legal', solutionId: 'law-firm', agentId: 'legal', label: 'MBE 法律' },
  { dirName: 'MBE 肺科医生', solutionId: 'clinic-respiratory', agentId: 'pulmonary', label: 'MBE 肺科' },
  { dirName: 'MBE Cost', solutionId: 'construction-cost', agentId: 'cost', label: 'MBE 造价' },
  { dirName: 'MBE Sales', solutionId: 'smb-operations', agentId: 'sales', label: 'MBE 销售' },
  { dirName: 'MBE Growth', solutionId: 'smb-operations', agentId: 'growth', label: 'MBE 增长' },
  { dirName: 'MBE Invest', solutionId: 'smb-operations', agentId: 'invest', label: 'MBE 投资' },
  { dirName: 'MBE Customer Service', solutionId: 'smb-operations', agentId: 'cs', label: 'MBE 客服' },
  { dirName: 'MBE Education', solutionId: 'education-training', agentId: 'education', label: 'MBE 教育' },
]

export interface LegacyAgentInfo {
  dirName: string
  solutionId: string
  agentId: string
  label: string
  sessionPath: string
  hasSession: boolean
  chatHistoryCount: number
  sessionFields: string[]
}

export interface MigrationResult {
  agent: string
  sessionMigrated: boolean
  conversationsMigrated: number
  messagesMigrated: number
  errors: string[]
}

// ── 检测 ──

function getDocsDir(): string {
  return app.getPath('documents')
}

function detectLegacyAgent(agent: typeof LEGACY_AGENTS[0]): LegacyAgentInfo {
  const docsDir = getDocsDir()
  const agentDir = path.join(docsDir, agent.dirName)
  const sessionPath = path.join(agentDir, 'session.json')
  const hasSession = fs.existsSync(sessionPath)

  let sessionFields: string[] = []
  let chatHistoryCount = 0

  if (hasSession) {
    try {
      const raw = fs.readFileSync(sessionPath, 'utf-8')
      const data = JSON.parse(raw)
      sessionFields = Object.keys(data)
    } catch { /* corrupt */ }
  }

  // localStorage 中的对话历史无法直接读取（LevelDB 格式），
  // 后续可扩展解析 userData 目录

  return {
    dirName: agent.dirName,
    solutionId: agent.solutionId,
    agentId: agent.agentId,
    label: agent.label,
    sessionPath,
    hasSession,
    chatHistoryCount,
    sessionFields,
  }
}

function detectAllLegacy(): LegacyAgentInfo[] {
  return LEGACY_AGENTS.map(detectLegacyAgent).filter(a => a.hasSession)
}

// ── 迁移 ──

function readLegacySession(sessionPath: string): Record<string, any> {
  try {
    const raw = fs.readFileSync(sessionPath, 'utf-8')
    const data = JSON.parse(raw)

    // 解密加密字段
    if (safeStorage.isEncryptionAvailable()) {
      for (const key of Object.keys(data)) {
        if (key.startsWith('_enc_') && typeof data[key] === 'string') {
          const realKey = key.slice(5)
          try {
            data[realKey] = safeStorage.decryptString(Buffer.from(data[key], 'base64'))
          } catch { /* 可能是不同机器加密的 */ }
          delete data[key]
        }
      }
    }
    return data
  } catch {
    return {}
  }
}

function migrateAgent(info: LegacyAgentInfo, db: any): MigrationResult {
  const result: MigrationResult = {
    agent: info.label,
    sessionMigrated: false,
    conversationsMigrated: 0,
    messagesMigrated: 0,
    errors: [],
  }

  // 1. 迁移 session 数据（token、偏好）
  try {
    const legacySession = readLegacySession(info.sessionPath)
    if (legacySession.auth_token || legacySession.token || legacySession.accessToken) {
      // 将旧版 token 写入 MBE Desktop session（以 agent 前缀区分）
      const desktopSessionPath = path.join(getDocsDir(), 'MBE Desktop', 'session.json')
      let desktopSession: Record<string, any> = {}
      try {
        if (fs.existsSync(desktopSessionPath)) {
          desktopSession = JSON.parse(fs.readFileSync(desktopSessionPath, 'utf-8'))
        }
      } catch { /* */ }

      // 复用 token（统一认证，各 Agent 共享）
      if (!desktopSession.auth_token) {
        const token = legacySession.auth_token || legacySession.token || legacySession.accessToken
        if (token) {
          desktopSession.auth_token = token
          desktopSession.email = desktopSession.email || legacySession.email
          desktopSession.name = desktopSession.name || legacySession.userName || legacySession.name
        }
      }

      // 保存迁移来源标记
      desktopSession[`_migrated_${info.agentId}`] = {
        from: info.dirName,
        at: new Date().toISOString(),
        fields: info.sessionFields,
      }

      const desktopDir = path.join(getDocsDir(), 'MBE Desktop')
      if (!fs.existsSync(desktopDir)) fs.mkdirSync(desktopDir, { recursive: true })
      fs.writeFileSync(desktopSessionPath, JSON.stringify(desktopSession, null, 2), 'utf-8')

      result.sessionMigrated = true
    }
  } catch (err: any) {
    result.errors.push(`Session 迁移失败: ${err.message}`)
  }

  // 2. 创建一条"迁移记录"对话，标记数据来源
  try {
    if (db) {
      const convId = `migrated_${info.agentId}_${Date.now()}`
      db.prepare(
        'INSERT OR IGNORE INTO conversations (id, solution_id, agent_role, title) VALUES (?, ?, ?, ?)'
      ).run(convId, info.solutionId, null, `[已迁移] ${info.label} 历史数据`)

      const msgId = `migmsg_${Date.now()}`
      db.prepare(
        'INSERT INTO messages (id, conversation_id, role, content, agent_role) VALUES (?, ?, ?, ?, ?)'
      ).run(
        msgId,
        convId,
        'system',
        `此对话由 ${info.label}（${info.dirName}）迁移而来。\n迁移时间：${new Date().toLocaleString('zh-CN')}\n原始 session 字段：${info.sessionFields.join(', ')}`,
        null,
      )

      result.conversationsMigrated = 1
      result.messagesMigrated = 1
    }
  } catch (err: any) {
    result.errors.push(`对话迁移失败: ${err.message}`)
  }

  return result
}

// ── IPC ──

let dbRef: any = null

export function setMigrationDb(db: any): void {
  dbRef = db
}

export function setupMigrationIPC(): void {
  ipcMain.handle('migration:detect', async () => {
    return detectAllLegacy()
  })

  ipcMain.handle('migration:run', async (_, agentIds: string[]) => {
    const allLegacy = detectAllLegacy()
    const results: MigrationResult[] = []

    for (const info of allLegacy) {
      if (agentIds.includes(info.agentId) || agentIds.includes('all')) {
        results.push(migrateAgent(info, dbRef))
      }
    }

    return results
  })

  ipcMain.handle('migration:status', async () => {
    const desktopSessionPath = path.join(getDocsDir(), 'MBE Desktop', 'session.json')
    try {
      if (fs.existsSync(desktopSessionPath)) {
        const session = JSON.parse(fs.readFileSync(desktopSessionPath, 'utf-8'))
        const migrated = Object.keys(session).filter(k => k.startsWith('_migrated_'))
        return { migrated: migrated.map(k => k.replace('_migrated_', '')), hasMigrated: migrated.length > 0 }
      }
    } catch { /* */ }
    return { migrated: [], hasMigrated: false }
  })
}
