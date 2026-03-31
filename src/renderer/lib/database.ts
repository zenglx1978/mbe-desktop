/**
 * 本地 SQLite 数据库服务 — QuickBooks "System of Record" 对标
 *
 * 使用 sql.js (WASM) 在渲染进程运行 SQLite，数据持久化到 localStorage/IndexedDB。
 * 包含：品牌表、结算表、审计日志表。
 * 后续可迁移到 Electron 主进程通过 IPC 操作。
 */
// @ts-expect-error — sql.js 无 TS 声明，运行时由 WASM 提供
import initSqlJs, { type Database } from 'sql.js'

let db: Database | null = null
const DB_STORAGE_KEY = 'mbe-sqlite-db'

/** 当前 schema 版本 — 见 MIGRATIONS 数组 */
export const SCHEMA_VERSION = 1

const MIGRATIONS = [
  // V1: 初始 schema
  `
  CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    platforms TEXT NOT NULL DEFAULT '[]',
    contract_rate REAL NOT NULL DEFAULT 0,
    performance_rate REAL NOT NULL DEFAULT 0,
    fixed_monthly_fee REAL NOT NULL DEFAULT 0,
    sla_tier TEXT NOT NULL DEFAULT 'standard',
    status TEXT NOT NULL DEFAULT 'active',
    contact_person TEXT,
    contract_expiry TEXT,
    monthly_gmv_target REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settlements (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES brands(id),
    month TEXT NOT NULL,
    gmv REAL NOT NULL DEFAULT 0,
    base_service_fee REAL NOT NULL DEFAULT 0,
    performance_commission REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,
    recon_gmv REAL,
    recon_commission REAL,
    recon_deductions REAL,
    recon_final_payable REAL,
    recon_source TEXT,
    recon_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    user_id TEXT DEFAULT 'local',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_settlements_brand ON settlements(brand_id);
  CREATE INDEX IF NOT EXISTS idx_settlements_month ON settlements(month);
  CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at);

  CREATE TABLE IF NOT EXISTS schema_version (version INTEGER);
  INSERT INTO schema_version VALUES (1);
  `,
]

const IDB_NAME = 'mbe-desktop-db'
const IDB_STORE = 'sqlite'
const IDB_KEY = 'main'

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(IDB_STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function saveToStorage(database: Database) {
  try {
    const data = database.export()
    const arr = new Uint8Array(data)

    // 主通道: IndexedDB（无大小限制，异步）
    openIDB().then((idb) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(arr, IDB_KEY)
    }).catch(() => {})

    // 备份通道: localStorage（<5MB 场景兼容）
    if (arr.length < 4 * 1024 * 1024) {
      const blob = new Blob([arr])
      const reader = new FileReader()
      reader.onload = () => {
        if (reader.result) {
          try { localStorage.setItem(DB_STORAGE_KEY, reader.result as string) } catch { /* quota exceeded */ }
        }
      }
      reader.readAsDataURL(blob)
    }
  } catch {
    // 静默失败
  }
}

async function loadFromIDB(): Promise<Uint8Array | null> {
  try {
    const idb = await openIDB()
    return new Promise((resolve) => {
      const tx = idb.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
      req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result) : null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

function loadFromLocalStorage(): Uint8Array | null {
  try {
    const stored = localStorage.getItem(DB_STORAGE_KEY)
    if (!stored) return null
    const binary = atob(stored.split(',')[1])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

async function loadFromStorage(): Promise<Uint8Array | null> {
  // 优先从 IndexedDB 加载（更大容量），降级到 localStorage
  const fromIDB = await loadFromIDB()
  if (fromIDB) return fromIDB
  return loadFromLocalStorage()
}

/**
 * 离线优先 WASM 加载策略（三级降级）：
 * 1. Electron extraResources（打包后本地 WASM）
 * 2. node_modules 内联 WASM（开发模式 / Vite import）
 * 3. CDN 兜底（仅在浏览器预览且网络可用时）
 */
function resolveWasmUrl(file: string): string {
  const electronAPI = typeof window !== 'undefined' && (window as any).electronAPI

  // L1: Electron 打包产物 → extraResources/sql-wasm.wasm
  if (electronAPI) {
    return `../resources/${file}`
  }

  // L2: Vite 开发模式 → public/ 或 node_modules 拷贝
  // 约定: 将 sql-wasm.wasm 拷贝到 public/ 以便 Vite devServer 直接返回
  try {
    const localUrl = `/${file}`
    return localUrl
  } catch {
    // L3: CDN 兜底
    return `https://sql.js.org/dist/${file}`
  }
}

export async function initDatabase(): Promise<Database> {
  if (db) return db

  const SQL = await initSqlJs({
    locateFile: resolveWasmUrl,
  })

  const existing = await loadFromStorage()
  db = existing ? new SQL.Database(existing) : new SQL.Database()

  // 检查 schema 版本并执行迁移
  try {
    const result = db.exec('SELECT version FROM schema_version LIMIT 1')
    const currentVersion = result.length > 0 ? (result[0].values[0][0] as number) : 0
    for (let i = currentVersion; i < MIGRATIONS.length; i++) {
      db.run(MIGRATIONS[i])
    }
  } catch {
    // schema_version 表不存在 => 全新数据库
    for (const migration of MIGRATIONS) {
      db.run(migration)
    }
  }

  saveToStorage(db)
  return db
}

export function getDatabase(): Database | null {
  return db
}

/** 持久化当前数据库 */
export function persistDatabase() {
  if (db) saveToStorage(db)
}

// ─── 审计日志 ───

export function logAudit(
  entityType: string,
  entityId: string,
  action: string,
  changes?: { field: string; oldValue: string | null; newValue: string | null }[],
) {
  if (!db) return
  if (changes && changes.length > 0) {
    for (const c of changes) {
      db.run(
        'INSERT INTO audit_log (entity_type, entity_id, action, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)',
        [entityType, entityId, action, c.field, c.oldValue, c.newValue],
      )
    }
  } else {
    db.run(
      'INSERT INTO audit_log (entity_type, entity_id, action) VALUES (?, ?, ?)',
      [entityType, entityId, action],
    )
  }
  persistDatabase()
}

export function getAuditLog(entityType?: string, entityId?: string, limit = 50): AuditEntry[] {
  if (!db) return []
  let sql = 'SELECT * FROM audit_log'
  const params: string[] = []
  const conditions: string[] = []
  if (entityType) { conditions.push('entity_type = ?'); params.push(entityType) }
  if (entityId) { conditions.push('entity_id = ?'); params.push(entityId) }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ' ORDER BY id DESC LIMIT ?'

  const result = db.exec(sql, [...params, String(limit)])
  if (!result.length) return []
  return result[0].values.map((row: any[]) => ({
    id: row[0] as number,
    entityType: row[1] as string,
    entityId: row[2] as string,
    action: row[3] as string,
    fieldName: row[4] as string | null,
    oldValue: row[5] as string | null,
    newValue: row[6] as string | null,
    userId: row[7] as string,
    createdAt: row[8] as string,
  }))
}

export interface AuditEntry {
  id: number
  entityType: string
  entityId: string
  action: string
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  userId: string
  createdAt: string
}

// ─── 品牌 CRUD ───

export interface BrandRow {
  id: string
  name: string
  category: string
  platforms: string[]
  contractRate: number
  performanceRate: number
  fixedMonthlyFee: number
  slaTier: string
  status: string
  contactPerson: string | null
  contractExpiry: string | null
  monthlyGmvTarget: number | null
  createdAt: string
  updatedAt: string
}

export function upsertBrand(brand: BrandRow) {
  if (!db) return
  db.run(`
    INSERT OR REPLACE INTO brands (id, name, category, platforms, contract_rate, performance_rate, fixed_monthly_fee, sla_tier, status, contact_person, contract_expiry, monthly_gmv_target, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    brand.id, brand.name, brand.category, JSON.stringify(brand.platforms),
    brand.contractRate, brand.performanceRate, brand.fixedMonthlyFee,
    brand.slaTier, brand.status, brand.contactPerson, brand.contractExpiry,
    brand.monthlyGmvTarget, brand.createdAt, brand.updatedAt,
  ])
  persistDatabase()
}

export function deleteBrandRow(id: string) {
  if (!db) return
  db.run('DELETE FROM settlements WHERE brand_id = ?', [id])
  db.run('DELETE FROM brands WHERE id = ?', [id])
  logAudit('brand', id, 'delete')
  persistDatabase()
}

export function getAllBrands(): BrandRow[] {
  if (!db) return []
  const result = db.exec('SELECT * FROM brands ORDER BY created_at DESC')
  if (!result.length) return []
  return result[0].values.map(rowToBrand)
}

function rowToBrand(row: any[]): BrandRow {
  return {
    id: row[0], name: row[1], category: row[2],
    platforms: JSON.parse(row[3] || '[]'),
    contractRate: row[4], performanceRate: row[5], fixedMonthlyFee: row[6],
    slaTier: row[7], status: row[8], contactPerson: row[9],
    contractExpiry: row[10], monthlyGmvTarget: row[11],
    createdAt: row[12], updatedAt: row[13],
  }
}

// ─── 结算 CRUD ───

export interface SettlementRow {
  id: string
  brandId: string
  month: string
  gmv: number
  baseServiceFee: number
  performanceCommission: number
  totalAmount: number
  taxAmount: number
  status: string
  notes: string | null
  reconGmv: number | null
  reconCommission: number | null
  reconDeductions: number | null
  reconFinalPayable: number | null
  reconSource: string | null
  reconAt: string | null
  createdAt: string
  updatedAt: string
}

export function upsertSettlement(s: SettlementRow) {
  if (!db) return
  db.run(`
    INSERT OR REPLACE INTO settlements (id, brand_id, month, gmv, base_service_fee, performance_commission, total_amount, tax_amount, status, notes, recon_gmv, recon_commission, recon_deductions, recon_final_payable, recon_source, recon_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    s.id, s.brandId, s.month, s.gmv, s.baseServiceFee, s.performanceCommission,
    s.totalAmount, s.taxAmount, s.status, s.notes,
    s.reconGmv, s.reconCommission, s.reconDeductions, s.reconFinalPayable,
    s.reconSource, s.reconAt, s.createdAt, s.updatedAt,
  ])
  persistDatabase()
}

export function getSettlementsByBrand(brandId: string): SettlementRow[] {
  if (!db) return []
  const result = db.exec('SELECT * FROM settlements WHERE brand_id = ? ORDER BY month DESC', [brandId])
  if (!result.length) return []
  return result[0].values.map(rowToSettlement)
}

export function getAllSettlements(): SettlementRow[] {
  if (!db) return []
  const result = db.exec('SELECT * FROM settlements ORDER BY month DESC')
  if (!result.length) return []
  return result[0].values.map(rowToSettlement)
}

function rowToSettlement(row: any[]): SettlementRow {
  return {
    id: row[0], brandId: row[1], month: row[2],
    gmv: row[3], baseServiceFee: row[4], performanceCommission: row[5],
    totalAmount: row[6], taxAmount: row[7], status: row[8], notes: row[9],
    reconGmv: row[10], reconCommission: row[11], reconDeductions: row[12],
    reconFinalPayable: row[13], reconSource: row[14], reconAt: row[15],
    createdAt: row[16], updatedAt: row[17],
  }
}

// ─── 迁移工具：从 localStorage brand-store 导入 ───

export function migrateFromLocalStorage() {
  if (!db) return
  try {
    const stored = localStorage.getItem('brand-store')
    if (!stored) return
    const { state } = JSON.parse(stored)
    if (!state) return

    const existingBrands = db.exec('SELECT COUNT(*) FROM brands')
    if (existingBrands.length > 0 && (existingBrands[0].values[0][0] as number) > 0) return

    for (const brand of (state.brands || [])) {
      upsertBrand({
        id: brand.id,
        name: brand.name,
        category: brand.category || '',
        platforms: brand.platforms || [],
        contractRate: brand.contractRate || 0,
        performanceRate: brand.performanceRate || 0,
        fixedMonthlyFee: brand.fixedMonthlyFee || 0,
        slaTier: brand.slaTier || 'standard',
        status: brand.status || 'active',
        contactPerson: brand.contactPerson || null,
        contractExpiry: brand.contractExpiry || null,
        monthlyGmvTarget: brand.monthlyGmvTarget || null,
        createdAt: brand.createdAt || new Date().toISOString(),
        updatedAt: brand.updatedAt || new Date().toISOString(),
      })
    }

    for (const settlement of (state.settlements || [])) {
      const recon = settlement.reconciliation
      upsertSettlement({
        id: settlement.id,
        brandId: settlement.brandId,
        month: settlement.month,
        gmv: settlement.gmv || 0,
        baseServiceFee: settlement.baseServiceFee || 0,
        performanceCommission: settlement.performanceCommission || 0,
        totalAmount: settlement.totalAmount || 0,
        taxAmount: settlement.taxAmount || 0,
        status: settlement.status || 'draft',
        notes: settlement.notes || null,
        reconGmv: recon?.gmv ?? null,
        reconCommission: recon?.commission ?? null,
        reconDeductions: recon?.deductions ?? null,
        reconFinalPayable: recon?.finalPayable ?? null,
        reconSource: recon?.source ?? null,
        reconAt: recon?.reconciledAt ?? null,
        createdAt: settlement.createdAt || new Date().toISOString(),
        updatedAt: settlement.updatedAt || new Date().toISOString(),
      })
    }

    logAudit('system', 'migration', 'migrate_from_localstorage')
    persistDatabase()
  } catch {
    // 迁移失败不阻塞
  }
}
