/**
 * WorkflowMiner — 效率测量 IPC 处理层
 *
 * 记录每次 MBE 辅助操作的耗时（assisted）与人工基准耗时（manual），
 * 生成成本收益报告供 EfficiencyPanel 展示。
 *
 * 数据存储：本地 SQLite（通过 getDb() 适配器），不上传。
 */

import { ipcMain } from 'electron'
import { getDb } from './database'

// ────────────────── Schema ──────────────────

function ensureSchema(): void {
  const db = getDb()
  if (!db) return
  db.exec(`
    CREATE TABLE IF NOT EXISTS efficiency_records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      solution_id TEXT    NOT NULL,
      task_name   TEXT    NOT NULL,
      manual_ms   INTEGER NOT NULL DEFAULT 0,
      assisted_ms INTEGER NOT NULL DEFAULT 0,
      recorded_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_eff_sol_date
      ON efficiency_records(solution_id, recorded_at);
  `)
}

// ────────────────── Helpers ──────────────────

/** 行业基准（人工完成该任务的典型耗时，毫秒） */
const MANUAL_BENCHMARKS: Record<string, number> = {
  '个股深度分析':  25 * 60 * 1000,   // 25 min
  '行业深度研究':  45 * 60 * 1000,   // 45 min
  'MISES 五维评分': 20 * 60 * 1000,  // 20 min
  'AI 产业链分析': 30 * 60 * 1000,   // 30 min
  '财务分析':     15 * 60 * 1000,   // 15 min
  '研报生成':     60 * 60 * 1000,   // 60 min
  '估值建模':     40 * 60 * 1000,   // 40 min
  '合规检查':     10 * 60 * 1000,   // 10 min
  default:        20 * 60 * 1000,   // 20 min fallback
}

function getManualBenchmark(taskName: string): number {
  for (const [key, ms] of Object.entries(MANUAL_BENCHMARKS)) {
    if (key !== 'default' && taskName.includes(key)) return ms
  }
  return MANUAL_BENCHMARKS.default
}

// ────────────────── IPC Handlers ──────────────────

export function setupWorkflowMinerIPC(): void {
  ensureSchema()

  /** 记录一次效率数据 */
  ipcMain.handle('miner:recordEfficiency', (_e, record: {
    solutionId: string
    taskName: string
    assistedMs: number
    manualMs?: number
  }) => {
    try {
      const db = getDb()
      if (!db) return { ok: false }
      ensureSchema()
      const manualMs = record.manualMs ?? getManualBenchmark(record.taskName)
      db.prepare(
        `INSERT INTO efficiency_records (solution_id, task_name, manual_ms, assisted_ms)
         VALUES (?, ?, ?, ?)`
      ).run(record.solutionId, record.taskName, manualMs, record.assistedMs)
      return { ok: true }
    } catch (err) {
      console.error('[WorkflowMiner] recordEfficiency error:', err)
      return { ok: false }
    }
  })

  /** 成本收益汇总报告 */
  ipcMain.handle('miner:costBenefitReport', (_e, solutionId: string, days = 30) => {
    try {
      const db = getDb()
      if (!db) return null
      ensureSchema()

      const cutoff = new Date(Date.now() - days * 86400000).toISOString()

      const rows: { task_name: string; cnt: number; sum_manual: number; sum_assisted: number }[] =
        db.prepare(
          `SELECT task_name,
                  COUNT(*)        AS cnt,
                  SUM(manual_ms)   AS sum_manual,
                  SUM(assisted_ms) AS sum_assisted
           FROM   efficiency_records
           WHERE  solution_id = ?
             AND  recorded_at >= ?
           GROUP  BY task_name`
        ).all(solutionId, cutoff) as any

      if (!rows.length) return null

      const totalManualMs   = rows.reduce((s, r) => s + (r.sum_manual   ?? 0), 0)
      const totalAssistedMs = rows.reduce((s, r) => s + (r.sum_assisted ?? 0), 0)
      const savedMs         = Math.max(0, totalManualMs - totalAssistedMs)
      const savedPercent    = totalManualMs > 0
        ? Math.round((savedMs / totalManualMs) * 100)
        : 0
      const taskCount       = rows.reduce((s, r) => s + (r.cnt ?? 0), 0)

      return {
        solutionId,
        period: `最近 ${days} 天`,
        taskCount,
        totalManualMs,
        totalAssistedMs,
        savedMs,
        savedPercent,
        tasks: rows.map(r => ({
          name:          r.task_name,
          count:         r.cnt,
          avgManualMs:   Math.round(r.sum_manual   / r.cnt),
          avgAssistedMs: Math.round(r.sum_assisted / r.cnt),
          savedPercent:  r.sum_manual > 0
            ? Math.round(((r.sum_manual - r.sum_assisted) / r.sum_manual) * 100)
            : 0,
        })),
      }
    } catch (err) {
      console.error('[WorkflowMiner] costBenefitReport error:', err)
      return null
    }
  })

  /** 历史趋势数据（按天聚合） */
  ipcMain.handle('miner:efficiencyHistory', (_e, solutionId?: string, days = 30) => {
    try {
      const db = getDb()
      if (!db) return []
      ensureSchema()

      const cutoff = new Date(Date.now() - days * 86400000).toISOString()
      const where  = solutionId
        ? `solution_id = '${solutionId.replace(/'/g, "''")}' AND recorded_at >= '${cutoff}'`
        : `recorded_at >= '${cutoff}'`

      return db.prepare(
        `SELECT date(recorded_at) AS day,
                SUM(manual_ms)    AS manual_ms,
                SUM(assisted_ms)  AS assisted_ms,
                COUNT(*)          AS count
         FROM   efficiency_records
         WHERE  ${where}
         GROUP  BY date(recorded_at)
         ORDER  BY day ASC`
      ).all() ?? []
    } catch (err) {
      console.error('[WorkflowMiner] efficiencyHistory error:', err)
      return []
    }
  })

  /** 行业扫描（占位，不做实际分析） */
  ipcMain.handle('miner:scan', () => ({ status: 'ok', message: 'scan not implemented' }))
  ipcMain.handle('miner:industry', () => ({ industry: 'unknown' }))
}
