/**
 * 本地 SQLite 存储层
 *
 * 统一数据库，各行业方案共享一个 MBE Desktop 数据库。
 * 存储：对话历史、任务记录、方案偏好、文档元数据。
 */

import path from 'path'
import fs from 'fs'
import { app, ipcMain } from 'electron'

let db: any = null

function getDbPath(): string {
  const docs = app.getPath('documents')
  const dir = path.join(docs, 'MBE Desktop')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return path.join(dir, 'mbe-desktop.db')
}

export function initDatabase(): void {
  try {
    const Database = require('better-sqlite3')
    db = new Database(getDbPath())
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        solution_id TEXT NOT NULL,
        agent_role TEXT,
        title TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        agent_role TEXT,
        sources TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        solution_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        mime_type TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_solution ON conversations(solution_id);
      CREATE INDEX IF NOT EXISTS idx_documents_solution ON documents(solution_id);

      -- 计算历史（可离线回溯）
      CREATE TABLE IF NOT EXISTS calc_history (
        id TEXT PRIMARY KEY,
        solution_id TEXT NOT NULL,
        tool_id TEXT NOT NULL,
        input_json TEXT NOT NULL,
        output_json TEXT NOT NULL,
        confidence REAL,
        source TEXT CHECK(source IN ('local', 'remote')),
        conversation_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- 任务管理
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        solution_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        priority TEXT DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done')),
        due_date TEXT,
        related_conversation_id TEXT,
        related_calc_id TEXT,
        metadata_json TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_calc_history_solution ON calc_history(solution_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_solution ON tasks(solution_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

      -- ── Bitter Lesson: 客户端智能 ──

      -- 使用行为分析（驱动缓存学习 + 自适应 UI）
      CREATE TABLE IF NOT EXISTS usage_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        solution_id TEXT,
        agent_role TEXT,
        tool_id TEXT,
        tab_id TEXT,
        metadata_json TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Expert 本地反馈（驱动本地路由优化）
      CREATE TABLE IF NOT EXISTS expert_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        solution_id TEXT NOT NULL,
        agent_role TEXT NOT NULL,
        feedback_type TEXT NOT NULL CHECK(feedback_type IN ('positive', 'negative', 'switch', 'timeout')),
        query_text TEXT,
        from_agent TEXT,
        to_agent TEXT,
        response_time_ms INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- 智能缓存条目（学习出的缓存策略）
      CREATE TABLE IF NOT EXISTS cache_entries (
        cache_key TEXT PRIMARY KEY,
        solution_id TEXT NOT NULL,
        content_json TEXT NOT NULL,
        hit_count INTEGER DEFAULT 0,
        priority REAL DEFAULT 0.5,
        expires_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        last_hit_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_usage_events_solution ON usage_events(solution_id);
      CREATE INDEX IF NOT EXISTS idx_expert_feedback_solution ON expert_feedback(solution_id);
      CREATE INDEX IF NOT EXISTS idx_cache_entries_priority ON cache_entries(priority DESC);

      -- ── Bitter Lesson Phase 10.4: 云端配置快照 ──

      CREATE TABLE IF NOT EXISTS config_snapshots (
        solution_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        snapshot_json TEXT NOT NULL,
        applied_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (solution_id, version)
      );

      CREATE INDEX IF NOT EXISTS idx_config_snapshots_solution ON config_snapshots(solution_id);
    `)

    console.log('[Database] Initialized at', getDbPath())
  } catch (err) {
    console.error('[Database] Failed to initialize:', err)
  }
}

export function setupDatabaseIPC(): void {
  ipcMain.handle('db:conversations:list', (_, solutionId: string) => {
    if (!db) return []
    return db.prepare(
      'SELECT * FROM conversations WHERE solution_id = ? ORDER BY updated_at DESC LIMIT 50'
    ).all(solutionId)
  })

  ipcMain.handle('db:conversations:create', (_, data: {
    id: string; solutionId: string; agentRole?: string; title?: string
  }) => {
    if (!db) return
    db.prepare(
      'INSERT INTO conversations (id, solution_id, agent_role, title) VALUES (?, ?, ?, ?)'
    ).run(data.id, data.solutionId, data.agentRole || null, data.title || '新对话')
  })

  ipcMain.handle('db:conversations:updateTitle', (_, id: string, title: string) => {
    if (!db) return
    db.prepare(
      "UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(title, id)
  })

  ipcMain.handle('db:conversations:delete', (_, id: string) => {
    if (!db) return
    db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
  })

  ipcMain.handle('db:messages:list', (_, conversationId: string) => {
    if (!db) return []
    return db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(conversationId)
  })

  ipcMain.handle('db:messages:add', (_, data: {
    id: string; conversationId: string; role: string; content: string; agentRole?: string; sources?: string
  }) => {
    if (!db) return
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, agent_role, sources) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(data.id, data.conversationId, data.role, data.content, data.agentRole || null, data.sources || null)
    db.prepare(
      "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?"
    ).run(data.conversationId)
  })

  ipcMain.handle('db:messages:clear', (_, conversationId: string) => {
    if (!db) return
    db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId)
  })

  // ─── 计算历史 ───
  ipcMain.handle('db:calc:list', (_, solutionId: string) => {
    if (!db) return []
    return db.prepare(
      'SELECT * FROM calc_history WHERE solution_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(solutionId)
  })

  ipcMain.handle('db:calc:add', (_, data: {
    id: string; solutionId: string; toolId: string
    inputJson: string; outputJson: string; confidence?: number
    source: string; conversationId?: string
  }) => {
    if (!db) return
    db.prepare(
      'INSERT INTO calc_history (id, solution_id, tool_id, input_json, output_json, confidence, source, conversation_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(data.id, data.solutionId, data.toolId, data.inputJson, data.outputJson, data.confidence ?? null, data.source, data.conversationId ?? null)
  })

  // ─── 任务管理 ───
  ipcMain.handle('db:tasks:list', (_, solutionId: string) => {
    if (!db) return []
    return db.prepare(
      'SELECT * FROM tasks WHERE solution_id = ? ORDER BY priority ASC, created_at DESC'
    ).all(solutionId)
  })

  ipcMain.handle('db:tasks:create', (_, data: {
    id: string; solutionId: string; type: string; title: string
    priority?: string; dueDate?: string; relatedConversationId?: string
  }) => {
    if (!db) return
    db.prepare(
      'INSERT INTO tasks (id, solution_id, type, title, priority, due_date, related_conversation_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(data.id, data.solutionId, data.type, data.title, data.priority || 'medium', data.dueDate || null, data.relatedConversationId || null)
  })

  ipcMain.handle('db:tasks:update', (_, id: string, updates: { status?: string; title?: string; priority?: string }) => {
    if (!db) return
    const fields: string[] = ["updated_at = datetime('now')"]
    const values: any[] = []
    if (updates.status) { fields.push('status = ?'); values.push(updates.status) }
    if (updates.title) { fields.push('title = ?'); values.push(updates.title) }
    if (updates.priority) { fields.push('priority = ?'); values.push(updates.priority) }
    values.push(id)
    db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  })

  ipcMain.handle('db:tasks:delete', (_, id: string) => {
    if (!db) return
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  })

  // ── Bitter Lesson: 客户端智能 IPC ──

  ipcMain.handle('db:usage:track', (_, data: {
    eventType: string; solutionId?: string; agentRole?: string
    toolId?: string; tabId?: string; metadata?: Record<string, unknown>
  }) => {
    if (!db) return
    db.prepare(
      'INSERT INTO usage_events (event_type, solution_id, agent_role, tool_id, tab_id, metadata_json) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(data.eventType, data.solutionId ?? null, data.agentRole ?? null, data.toolId ?? null, data.tabId ?? null, data.metadata ? JSON.stringify(data.metadata) : null)
  })

  ipcMain.handle('db:usage:stats', (_, solutionId: string, days: number = 30) => {
    if (!db) return {}
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString()

    const agentStats = db.prepare(`
      SELECT agent_role, COUNT(*) as count FROM usage_events
      WHERE solution_id = ? AND agent_role IS NOT NULL AND created_at > ?
      GROUP BY agent_role ORDER BY count DESC
    `).all(solutionId, cutoff)

    const toolStats = db.prepare(`
      SELECT tool_id, COUNT(*) as count FROM usage_events
      WHERE solution_id = ? AND tool_id IS NOT NULL AND created_at > ?
      GROUP BY tool_id ORDER BY count DESC
    `).all(solutionId, cutoff)

    const tabStats = db.prepare(`
      SELECT tab_id, COUNT(*) as count FROM usage_events
      WHERE solution_id = ? AND tab_id IS NOT NULL AND created_at > ?
      GROUP BY tab_id ORDER BY count DESC
    `).all(solutionId, cutoff)

    const hourStats = db.prepare(`
      SELECT strftime('%H', created_at) as hour, COUNT(*) as count
      FROM usage_events WHERE solution_id = ? AND created_at > ?
      GROUP BY hour ORDER BY count DESC LIMIT 5
    `).all(solutionId, cutoff)

    return { agentStats, toolStats, tabStats, hourStats }
  })

  ipcMain.handle('db:feedback:add', (_, data: {
    solutionId: string; agentRole: string; feedbackType: string
    queryText?: string; fromAgent?: string; toAgent?: string; responseTimeMs?: number
  }) => {
    if (!db) return
    db.prepare(
      'INSERT INTO expert_feedback (solution_id, agent_role, feedback_type, query_text, from_agent, to_agent, response_time_ms) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(data.solutionId, data.agentRole, data.feedbackType, data.queryText ?? null, data.fromAgent ?? null, data.toAgent ?? null, data.responseTimeMs ?? null)
  })

  ipcMain.handle('db:feedback:stats', (_, solutionId: string) => {
    if (!db) return {}
    const perAgent = db.prepare(`
      SELECT agent_role,
        SUM(CASE WHEN feedback_type = 'positive' THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN feedback_type = 'negative' THEN 1 ELSE 0 END) as negative,
        SUM(CASE WHEN feedback_type = 'switch' THEN 1 ELSE 0 END) as switches,
        AVG(response_time_ms) as avg_response_ms,
        COUNT(*) as total
      FROM expert_feedback WHERE solution_id = ?
      GROUP BY agent_role
    `).all(solutionId)

    const switchPairs = db.prepare(`
      SELECT from_agent, to_agent, COUNT(*) as count
      FROM expert_feedback WHERE solution_id = ? AND feedback_type = 'switch'
      GROUP BY from_agent, to_agent ORDER BY count DESC LIMIT 10
    `).all(solutionId)

    return { perAgent, switchPairs }
  })

  // ── Bitter Lesson Phase 10: 反馈导出（供上报服务端） ──

  ipcMain.handle('db:feedback:export', (_, solutionId: string, sinceTs?: string) => {
    if (!db) return []
    const since = sinceTs || new Date(Date.now() - 7 * 86400_000).toISOString()
    return db.prepare(`
      SELECT id, solution_id, agent_role, feedback_type, query_text,
             from_agent, to_agent, response_time_ms, created_at
      FROM expert_feedback
      WHERE solution_id = ? AND created_at > ?
      ORDER BY created_at ASC
    `).all(solutionId, since)
  })

  ipcMain.handle('db:feedback:markSynced', (_, ids: number[]) => {
    if (!db || !ids.length) return 0
    const placeholders = ids.map(() => '?').join(',')
    return db.prepare(
      `DELETE FROM expert_feedback WHERE id IN (${placeholders})`
    ).run(...ids).changes
  })

  ipcMain.handle('db:cache:get', (_, cacheKey: string) => {
    if (!db) return null
    const row = db.prepare('SELECT * FROM cache_entries WHERE cache_key = ?').get(cacheKey)
    if (!row) return null
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      db.prepare('DELETE FROM cache_entries WHERE cache_key = ?').run(cacheKey)
      return null
    }
    db.prepare("UPDATE cache_entries SET hit_count = hit_count + 1, last_hit_at = datetime('now') WHERE cache_key = ?").run(cacheKey)
    return row
  })

  ipcMain.handle('db:cache:set', (_, data: {
    cacheKey: string; solutionId: string; contentJson: string
    priority?: number; expiresAt?: string
  }) => {
    if (!db) return
    db.prepare(`
      INSERT OR REPLACE INTO cache_entries (cache_key, solution_id, content_json, priority, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.cacheKey, data.solutionId, data.contentJson, data.priority ?? 0.5, data.expiresAt ?? null)
  })

  ipcMain.handle('db:cache:prune', (_, maxEntries: number = 500) => {
    if (!db) return 0
    const total = db.prepare('SELECT COUNT(*) as c FROM cache_entries').get().c
    if (total <= maxEntries) return 0
    const pruneCount = total - maxEntries
    db.prepare(`
      DELETE FROM cache_entries WHERE cache_key IN (
        SELECT cache_key FROM cache_entries ORDER BY priority ASC, last_hit_at ASC LIMIT ?
      )
    `).run(pruneCount)
    return pruneCount
  })

  // ── Bitter Lesson Phase 10.4: 云端配置快照 IPC ──

  ipcMain.handle('db:snapshot:save', (_, solutionId: string, version: number, snapshotJson: string) => {
    if (!db) return
    db.prepare(`
      INSERT OR REPLACE INTO config_snapshots (solution_id, version, snapshot_json, applied_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(solutionId, version, snapshotJson)
  })

  ipcMain.handle('db:snapshot:latest', (_, solutionId: string) => {
    if (!db) return null
    return db.prepare(`
      SELECT solution_id, version, snapshot_json, applied_at
      FROM config_snapshots WHERE solution_id = ?
      ORDER BY version DESC LIMIT 1
    `).get(solutionId)
  })

  ipcMain.handle('db:snapshot:version', (_, solutionId: string) => {
    if (!db) return 0
    const row = db.prepare(
      'SELECT MAX(version) as v FROM config_snapshots WHERE solution_id = ?'
    ).get(solutionId)
    return row?.v ?? 0
  })

  ipcMain.handle('db:snapshot:history', (_, solutionId: string, limit: number = 10) => {
    if (!db) return []
    return db.prepare(`
      SELECT solution_id, version, applied_at
      FROM config_snapshots WHERE solution_id = ?
      ORDER BY version DESC LIMIT ?
    `).all(solutionId, limit)
  })

  registerBackupHandlers()
}

/**
 * 加密备份/恢复（AES-256 加密的 .mbebackup 文件）
 */
function registerBackupHandlers() {
  const crypto = require('crypto')
  const { dialog } = require('electron')

  ipcMain.handle('db:backup:create', async () => {
    if (!db) throw new Error('数据库未初始化')
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: `mbe-desktop-backup-${new Date().toISOString().slice(0, 10)}.mbebackup`,
      filters: [{ name: 'MBE 备份', extensions: ['mbebackup'] }],
    })
    if (!filePath) return { ok: false }

    const data = db.serialize()
    const password = crypto.randomBytes(16).toString('hex')
    const iv = crypto.randomBytes(16)
    const key = crypto.scryptSync(password, 'mbe-desktop-salt', 32)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
    const tag = cipher.getAuthTag()

    const header = JSON.stringify({ v: 1, algo: 'aes-256-gcm', iv: iv.toString('hex'), tag: tag.toString('hex') })
    const headerBuf = Buffer.from(header + '\n')

    fs.writeFileSync(filePath, Buffer.concat([headerBuf, encrypted]))
    return { ok: true, path: filePath, password }
  })

  ipcMain.handle('db:backup:restore', async () => {
    if (!db) throw new Error('数据库未初始化')
    const { filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'MBE 备份', extensions: ['mbebackup'] }],
      properties: ['openFile'],
    })
    if (!filePaths?.length) return { ok: false }

    return { ok: true, message: '备份恢复需要输入备份时生成的密码，此功能将在下个版本完善' }
  })
}

export function getDb(): any {
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
