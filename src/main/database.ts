/**
 * 本地 SQLite 存储层 — sql.js（纯 WASM，零原生模块）
 *
 * 替代 better-sqlite3 以消除 Windows Defender 对原生 .node 二进制的误报。
 * sql.js 在内存中运行 SQLite，写操作后自动持久化到磁盘。
 */

import path from 'path'
import fs from 'fs'
import { app, ipcMain } from 'electron'

// ────────────────────── sql.js 状态 ──────────────────────

let SQL: any = null
let sqlDb: any = null
let dbFilePath = ''
let dirty = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

// ────────────────────── 磁盘持久化 ──────────────────────

function scheduleSave(): void {
  dirty = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => flushSave(), 2000)
}

function flushSave(): void {
  if (!dirty || !sqlDb) return
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  try {
    const data = sqlDb.export()
    fs.writeFileSync(dbFilePath, Buffer.from(data))
    dirty = false
  } catch (err) {
    console.error('[Database] Persist failed:', err)
  }
}

// ────────────────────── better-sqlite3 兼容适配器 ──────────────────────

function createAdapter(sDb: any) {
  return {
    pragma(stmt: string): void {
      sDb.run(`PRAGMA ${stmt}`)
    },

    exec(sql: string): void {
      sDb.exec(sql)
      scheduleSave()
    },

    prepare(sql: string) {
      return {
        all(...params: any[]): any[] {
          const result = sDb.exec(sql, params)
          if (!result.length) return []
          const { columns, values } = result[0]
          return values.map((row: any[]) => {
            const obj: Record<string, any> = {}
            columns.forEach((col: string, i: number) => { obj[col] = row[i] })
            return obj
          })
        },
        get(...params: any[]): any {
          const result = sDb.exec(sql, params)
          if (!result.length || !result[0].values.length) return undefined
          const { columns, values } = result[0]
          const obj: Record<string, any> = {}
          columns.forEach((col: string, i: number) => { obj[col] = values[0][i] })
          return obj
        },
        run(...params: any[]): { changes: number } {
          sDb.run(sql, params)
          scheduleSave()
          return { changes: sDb.getRowsModified() }
        },
      }
    },

    serialize(): Buffer {
      return Buffer.from(sDb.export())
    },

    close(): void {
      flushSave()
      try { sDb.close() } catch { /* already closed */ }
    },
  }
}

let db: ReturnType<typeof createAdapter> | null = null

// ────────────────────── WASM 加载 ──────────────────────

function loadWasmBinary(): Buffer {
  try {
    const mainJs = require.resolve('sql.js')
    return fs.readFileSync(path.join(path.dirname(mainJs), 'sql-wasm.wasm'))
  } catch {
    return fs.readFileSync(path.join(process.resourcesPath, 'sql-wasm.wasm'))
  }
}

// ────────────────────── 路径 ──────────────────────

function getDbPath(): string {
  const docs = app.getPath('documents')
  const dir = path.join(docs, 'MBE Desktop')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return path.join(dir, 'mbe-desktop.db')
}

// ────────────────────── 初始化 ──────────────────────

export async function initDatabase(): Promise<void> {
  try {
    const initSqlJs = require('sql.js')
    SQL = await initSqlJs({ wasmBinary: loadWasmBinary() })

    dbFilePath = getDbPath()

    if (fs.existsSync(dbFilePath)) {
      const fileData = fs.readFileSync(dbFilePath)
      sqlDb = new SQL.Database(new Uint8Array(fileData))
    } else {
      sqlDb = new SQL.Database()
    }

    db = createAdapter(sqlDb)
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

      CREATE TABLE IF NOT EXISTS config_snapshots (
        solution_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        snapshot_json TEXT NOT NULL,
        applied_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (solution_id, version)
      );

      CREATE INDEX IF NOT EXISTS idx_config_snapshots_solution ON config_snapshots(solution_id);

      CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('cron', 'watch', 'once')),
        label TEXT NOT NULL,
        cron_expr TEXT,
        watch_path TEXT,
        watch_file_types TEXT,
        delay_ms INTEGER,
        action_json TEXT NOT NULL,
        solution_id TEXT,
        conversation_id TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed', 'failed')),
        run_count INTEGER DEFAULT 0,
        last_run_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_solution ON scheduled_jobs(solution_id);

      -- Phase 6: 用户偏好记忆
      CREATE TABLE IF NOT EXISTS user_memory (
        key TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS memory_facts (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL CHECK(category IN ('contact', 'business', 'preference', 'parameter', 'context', 'custom')),
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        source TEXT,
        solution_id TEXT,
        confidence REAL DEFAULT 0.5,
        usage_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS frequent_params (
        id TEXT PRIMARY KEY,
        tool_id TEXT NOT NULL,
        param_key TEXT NOT NULL,
        param_value TEXT NOT NULL,
        usage_count INTEGER DEFAULT 1,
        last_used_at TEXT DEFAULT (datetime('now'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_facts_cat_key ON memory_facts(category, key);
      CREATE INDEX IF NOT EXISTS idx_memory_facts_solution ON memory_facts(solution_id);
      CREATE INDEX IF NOT EXISTS idx_memory_facts_confidence ON memory_facts(confidence DESC);
      CREATE INDEX IF NOT EXISTS idx_frequent_params_tool ON frequent_params(tool_id);
      CREATE INDEX IF NOT EXISTS idx_frequent_params_usage ON frequent_params(usage_count DESC);
    `)

    flushSave()
    console.log('[Database] Initialized at', dbFilePath)
  } catch (err) {
    console.error('[Database] Failed to initialize:', err)
  }
}

// ────────────────────── IPC ──────────────────────

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

  // ── 客户端智能 IPC ──

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

  // ── 反馈导出 ──

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
    const total = db.prepare('SELECT COUNT(*) as c FROM cache_entries').get()?.c ?? 0
    if (total <= maxEntries) return 0
    const pruneCount = total - maxEntries
    db.prepare(`
      DELETE FROM cache_entries WHERE cache_key IN (
        SELECT cache_key FROM cache_entries ORDER BY priority ASC, last_hit_at ASC LIMIT ?
      )
    `).run(pruneCount)
    return pruneCount
  })

  // ── 云端配置快照 IPC ──

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
  registerDataManagementHandlers()
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

  ipcMain.handle('db:backup:restore', async (_event, password?: string) => {
    if (!db) throw new Error('数据库未初始化')
    const { filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'MBE 备份', extensions: ['mbebackup'] }],
      properties: ['openFile'],
    })
    if (!filePaths?.length) return { ok: false }

    if (!password) {
      return { ok: false, needPassword: true, filePath: filePaths[0] }
    }

    const raw = fs.readFileSync(filePaths[0])
    const newlineIdx = raw.indexOf(0x0a)
    if (newlineIdx < 0) throw new Error('备份文件格式错误：缺少 header')

    const header = JSON.parse(raw.subarray(0, newlineIdx).toString('utf-8'))
    const encrypted = raw.subarray(newlineIdx + 1)

    const iv = Buffer.from(header.iv, 'hex')
    const tag = Buffer.from(header.tag, 'hex')
    const key = crypto.scryptSync(password, 'mbe-desktop-salt', 32)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)

    let decrypted: Buffer
    try {
      decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    } catch {
      return { ok: false, error: '密码错误或备份文件已损坏' }
    }

    const backupPath = dbFilePath + '.pre-restore.' + Date.now()
    if (fs.existsSync(dbFilePath)) fs.copyFileSync(dbFilePath, backupPath)

    db.close()
    db = null
    sqlDb = null

    fs.writeFileSync(dbFilePath, decrypted)
    sqlDb = new SQL.Database(new Uint8Array(decrypted))
    db = createAdapter(sqlDb)
    db.pragma('foreign_keys = ON')

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all()
    const tableNames = tables.map((t: any) => t.name)

    return {
      ok: true,
      tables: tableNames,
      preRestoreBackup: backupPath,
    }
  })
}

/**
 * 数据管理 IPC（统计 + 清缓存 + 自动备份检查）
 */
function registerDataManagementHandlers() {
  ipcMain.handle('db:stats', () => {
    if (!db) return null
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all() as { name: string }[]

    const stats: Record<string, number> = {}
    for (const t of tables) {
      try {
        const row = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get() as { c: number }
        stats[t.name] = row.c
      } catch {
        stats[t.name] = -1
      }
    }

    let dbSizeBytes = 0
    try {
      const s = fs.statSync(dbFilePath)
      dbSizeBytes = s.size
    } catch { /* ignore */ }

    return { tables: stats, dbSizeBytes }
  })

  ipcMain.handle('db:clearCache', () => {
    if (!db) return 0
    const r = db.prepare('DELETE FROM cache_entries').run()
    return r.changes
  })

  ipcMain.handle('db:backup:restoreWithPassword', async (_, filePath: string, password: string) => {
    if (!db) throw new Error('数据库未初始化')
    const crypto = require('crypto')

    const raw = fs.readFileSync(filePath)
    const newlineIdx = raw.indexOf(0x0a)
    if (newlineIdx < 0) throw new Error('备份文件格式错误')

    const header = JSON.parse(raw.subarray(0, newlineIdx).toString('utf-8'))
    const encrypted = raw.subarray(newlineIdx + 1)

    const iv = Buffer.from(header.iv, 'hex')
    const tag = Buffer.from(header.tag, 'hex')
    const key = crypto.scryptSync(password, 'mbe-desktop-salt', 32)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)

    let decrypted: Buffer
    try {
      decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    } catch {
      return { ok: false, error: '密码错误或备份文件已损坏' }
    }

    const backupPath = dbFilePath + '.pre-restore.' + Date.now()
    if (fs.existsSync(dbFilePath)) fs.copyFileSync(dbFilePath, backupPath)

    db.close()
    db = null
    sqlDb = null

    fs.writeFileSync(dbFilePath, decrypted)
    sqlDb = new SQL.Database(new Uint8Array(decrypted))
    db = createAdapter(sqlDb)
    db.pragma('foreign_keys = ON')

    return { ok: true, preRestoreBackup: backupPath }
  })
}

/**
 * 自动备份检查（启动时调用）
 * 超过 7 天未备份，自动保存到 ~/Documents/MBE Desktop/backups/
 */
export function checkAutoBackup(): void {
  if (!db) return
  try {
    const crypto = require('crypto')
    const docs = app.getPath('documents')
    const backupDir = path.join(docs, 'MBE Desktop', 'backups')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    const existing = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.mbebackup'))
      .sort()
      .reverse()

    if (existing.length > 0) {
      const latestPath = path.join(backupDir, existing[0])
      const stat = fs.statSync(latestPath)
      const ageMs = Date.now() - stat.mtimeMs
      if (ageMs < 7 * 86400_000) return
    }

    const data = db.serialize()
    const password = crypto.randomBytes(16).toString('hex')
    const iv = crypto.randomBytes(16)
    const key = crypto.scryptSync(password, 'mbe-desktop-salt', 32)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
    const tag = cipher.getAuthTag()

    const header = JSON.stringify({ v: 1, algo: 'aes-256-gcm', iv: iv.toString('hex'), tag: tag.toString('hex') })
    const headerBuf = Buffer.from(header + '\n')

    const filename = `auto-backup-${new Date().toISOString().slice(0, 10)}.mbebackup`
    const filePath = path.join(backupDir, filename)
    fs.writeFileSync(filePath, Buffer.concat([headerBuf, encrypted]))

    const pwFile = path.join(backupDir, `${filename}.key`)
    fs.writeFileSync(pwFile, password, 'utf-8')

    const oldFiles = existing.slice(4)
    for (const f of oldFiles) {
      try {
        fs.unlinkSync(path.join(backupDir, f))
        const keyF = path.join(backupDir, f + '.key')
        if (fs.existsSync(keyF)) fs.unlinkSync(keyF)
      } catch { /* ignore */ }
    }

    console.log('[AutoBackup] Saved to', filePath)
  } catch (err) {
    console.error('[AutoBackup] Failed:', err)
  }
}

export function getDb(): any {
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    sqlDb = null
  }
}
