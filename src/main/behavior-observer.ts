// BehaviorObserver — Layer 1: 静默捕捉应用切换/文件访问模式
//
// 隐私设计原则：
//   - 仅记录应用名 + 窗口标题前 50 字，不记录内容
//   - 数据纯本地 SQLite，不上传
//   - 设置页可一键关闭
//   - 超过 90 天的数据自动清理

import { ipcMain, BrowserWindow } from 'electron'
import { execSync } from 'child_process'
import { setFlag } from './module-flags'

// ────────────────────── 类型定义 ──────────────────────

export interface BehaviorEvent {
  id?: number
  eventType: 'app_switch' | 'file_access' | 'mbe_action' | 'idle_start' | 'idle_end'
  appName: string
  windowTitle: string
  filePath?: string
  solutionId?: string
  expertId?: string
  durationMs?: number
  timestamp: string
}

export interface AppSession {
  appName: string
  startedAt: string
  endedAt?: string
  durationMs: number
  windowTitle: string
}

export interface DailyAppSummary {
  appName: string
  totalMs: number
  sessionCount: number
  avgSessionMs: number
}

// ────────────────────── Module State ──────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let mainWindow: BrowserWindow | null = null
let dbAdapter: {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...args: unknown[]) => Record<string, unknown>[]
    get: (...args: unknown[]) => Record<string, unknown> | undefined
    run: (...args: unknown[]) => { changes: number }
  }
} | null = null

// 默认关闭：全局窗口监控属敏感能力，需用户在设置页显式开启
let observerEnabled = false
let pollInterval: ReturnType<typeof setInterval> | null = null
let lastActiveApp = ''
let lastActiveTitle = ''
let lastSwitchTime = Date.now()
const POLL_INTERVAL_MS = 5000
const TITLE_MAX_LEN = 50
const RETENTION_DAYS = 90

// ────────────────────── 模块初始化 ──────────────────────

export function setBehaviorObserverMainWindow(win: BrowserWindow): void {
  mainWindow = win
}

export function setBehaviorObserverDb(db: typeof dbAdapter): void {
  dbAdapter = db
  ensureTable()
}

function ensureTable(): void {
  if (!dbAdapter) return
  try {
    dbAdapter.exec(`
      CREATE TABLE IF NOT EXISTS behavior_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        app_name TEXT NOT NULL DEFAULT '',
        window_title TEXT NOT NULL DEFAULT '',
        file_path TEXT,
        solution_id TEXT,
        expert_id TEXT,
        duration_ms INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_behavior_type ON behavior_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_behavior_app ON behavior_events(app_name);
      CREATE INDEX IF NOT EXISTS idx_behavior_time ON behavior_events(created_at);
    `)
  } catch (err) {
    console.error('[BehaviorObserver] 建表失败:', err) // eslint-disable-line no-console
  }
}

// ────────────────────── 活跃窗口检测（Windows） ──────────────────────

function getActiveWindow(): { appName: string; title: string } | null {
  if (process.platform !== 'win32') return null

  try {
    const psScript = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;
        public class WinAPI {
          [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
          [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
        }
"@
      $hwnd = [WinAPI]::GetForegroundWindow()
      $sb = New-Object System.Text.StringBuilder 256
      [WinAPI]::GetWindowText($hwnd, $sb, 256) | Out-Null
      $pid = 0
      [WinAPI]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
      $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
      @{ Name = $proc.ProcessName; Title = $sb.ToString() } | ConvertTo-Json -Compress
    `
    const result = execSync(
      `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`,
      { timeout: 3000, windowsHide: true, encoding: 'utf-8', maxBuffer: 1024 * 1024 },
    )
    const parsed = JSON.parse(result.trim())
    return {
      appName: (parsed.Name || '').toString(),
      title: (parsed.Title || '').toString().slice(0, TITLE_MAX_LEN),
    }
  } catch {
    return null
  }
}

// ────────────────────── 事件记录 ──────────────────────

function recordEvent(event: BehaviorEvent): void {
  if (!dbAdapter || !observerEnabled) return
  try {
    dbAdapter.prepare(`
      INSERT INTO behavior_events (event_type, app_name, window_title, file_path, solution_id, expert_id, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.eventType,
      event.appName,
      event.windowTitle,
      event.filePath ?? null,
      event.solutionId ?? null,
      event.expertId ?? null,
      event.durationMs ?? 0,
      event.timestamp,
    )
  } catch (err) {
    console.error('[BehaviorObserver] 记录失败:', err) // eslint-disable-line no-console
  }
}

export function recordMBEAction(solutionId: string, expertId: string, actionLabel: string): void {
  recordEvent({
    eventType: 'mbe_action',
    appName: 'MBE Desktop',
    windowTitle: actionLabel.slice(0, TITLE_MAX_LEN),
    solutionId,
    expertId,
    timestamp: new Date().toISOString(),
  })
}

// ────────────────────── 轮询逻辑 ──────────────────────

function pollActiveWindow(): void {
  if (!observerEnabled) return

  const win = getActiveWindow()
  if (!win || !win.appName) return

  const now = Date.now()
  const appChanged = win.appName !== lastActiveApp

  if (appChanged && lastActiveApp) {
    recordEvent({
      eventType: 'app_switch',
      appName: lastActiveApp,
      windowTitle: lastActiveTitle,
      durationMs: now - lastSwitchTime,
      timestamp: new Date(lastSwitchTime).toISOString(),
    })
  }

  if (appChanged) {
    lastActiveApp = win.appName
    lastActiveTitle = win.title
    lastSwitchTime = now
  } else {
    lastActiveTitle = win.title
  }
}

// ────────────────────── 数据清理 ──────────────────────

function cleanOldEvents(): void {
  if (!dbAdapter) return
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString()
    dbAdapter.prepare('DELETE FROM behavior_events WHERE created_at < ?').run(cutoff)
  } catch {
    // 清理失败不阻塞
  }
}

// ────────────────────── 查询 API ──────────────────────

function queryAppSwitchSequences(days = 7, limit = 200): BehaviorEvent[] {
  if (!dbAdapter) return []
  try {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString()
    const rows = dbAdapter.prepare(`
      SELECT event_type, app_name, window_title, file_path, solution_id, expert_id, duration_ms, created_at
      FROM behavior_events
      WHERE event_type = 'app_switch' AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(cutoff, limit)
    return rows.map(mapRow)
  } catch {
    return []
  }
}

function queryDailyAppSummary(days = 7): DailyAppSummary[] {
  if (!dbAdapter) return []
  try {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString()
    const rows = dbAdapter.prepare(`
      SELECT app_name,
             SUM(duration_ms) as total_ms,
             COUNT(*) as session_count,
             AVG(duration_ms) as avg_session_ms
      FROM behavior_events
      WHERE event_type = 'app_switch' AND created_at >= ?
      GROUP BY app_name
      ORDER BY total_ms DESC
      LIMIT 20
    `).all(cutoff)
    return rows.map((r) => ({
      appName: r.app_name as string,
      totalMs: (r.total_ms as number) || 0,
      sessionCount: (r.session_count as number) || 0,
      avgSessionMs: Math.round((r.avg_session_ms as number) || 0),
    }))
  } catch {
    return []
  }
}

function queryMBEActions(solutionId?: string, days = 30): BehaviorEvent[] {
  if (!dbAdapter) return []
  try {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString()
    const sql = solutionId
      ? `SELECT * FROM behavior_events WHERE event_type = 'mbe_action' AND solution_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 100`
      : `SELECT * FROM behavior_events WHERE event_type = 'mbe_action' AND created_at >= ? ORDER BY created_at DESC LIMIT 100`
    const rows = solutionId
      ? dbAdapter.prepare(sql).all(solutionId, cutoff)
      : dbAdapter.prepare(sql).all(cutoff)
    return rows.map(mapRow)
  } catch {
    return []
  }
}

function queryRecentSequence(count = 20): string[] {
  if (!dbAdapter) return []
  try {
    const rows = dbAdapter.prepare(`
      SELECT app_name FROM behavior_events
      WHERE event_type = 'app_switch' AND app_name != 'MBE Desktop'
      ORDER BY created_at DESC LIMIT ?
    `).all(count)
    return rows.map((r) => r.app_name as string)
  } catch {
    return []
  }
}

function mapRow(r: Record<string, unknown>): BehaviorEvent {
  return {
    id: r.id as number | undefined,
    eventType: r.event_type as BehaviorEvent['eventType'],
    appName: r.app_name as string,
    windowTitle: r.window_title as string,
    filePath: r.file_path as string | undefined,
    solutionId: r.solution_id as string | undefined,
    expertId: r.expert_id as string | undefined,
    durationMs: r.duration_ms as number | undefined,
    timestamp: r.created_at as string,
  }
}

// ────────────────────── 生命周期 ──────────────────────

export function startBehaviorObserver(): void {
  if (pollInterval) return
  observerEnabled = true
  lastActiveApp = ''
  lastActiveTitle = ''
  lastSwitchTime = Date.now()
  pollInterval = setInterval(pollActiveWindow, POLL_INTERVAL_MS)
  cleanOldEvents()
  console.log('[BehaviorObserver] 已启动（每 5s 采样）') // eslint-disable-line no-console
}

export function stopBehaviorObserver(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  if (lastActiveApp) {
    recordEvent({
      eventType: 'app_switch',
      appName: lastActiveApp,
      windowTitle: lastActiveTitle,
      durationMs: Date.now() - lastSwitchTime,
      timestamp: new Date(lastSwitchTime).toISOString(),
    })
  }
  console.log('[BehaviorObserver] 已停止') // eslint-disable-line no-console
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupBehaviorObserverIPC(): void {
  ipcMain.handle('observer:enabled', () => observerEnabled)

  ipcMain.handle('observer:setEnabled', (_, enabled: boolean) => {
    observerEnabled = enabled
    if (enabled && !pollInterval) startBehaviorObserver()
    if (!enabled && pollInterval) stopBehaviorObserver()
    setFlag('behaviorObserver', enabled) // 持久化：重启后保持用户选择
    return { success: true, enabled }
  })

  ipcMain.handle('observer:appSummary', (_, days?: number) => {
    return queryDailyAppSummary(days ?? 7)
  })

  ipcMain.handle('observer:sequences', (_, days?: number, limit?: number) => {
    return queryAppSwitchSequences(days ?? 7, limit ?? 200)
  })

  ipcMain.handle('observer:mbeActions', (_, solutionId?: string, days?: number) => {
    return queryMBEActions(solutionId, days ?? 30)
  })

  ipcMain.handle('observer:recentApps', (_, count?: number) => {
    return queryRecentSequence(count ?? 20)
  })

  ipcMain.handle('observer:recordAction', (_, solutionId: string, expertId: string, label: string) => {
    recordMBEAction(solutionId, expertId, label)
    return { success: true }
  })
}
