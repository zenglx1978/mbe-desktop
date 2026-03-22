// LocalDataReader — MBE Desktop 本地文件阅读器
// 读取用户本地的 Excel/CSV/PDF/Word 文件，提取结构化文本
// 核心场景：客户导入合同、结算表、持仓数据、案件材料
// 依赖 package.json 已有的 exceljs 和 docx

import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { isReadPathAllowed } from './safe-path'

// ────────────────────── 类型 ──────────────────────

export interface LocalReadRequest {
  /** 文件绝对路径（如果为空则弹出文件选择对话框） */
  filePath?: string
  /** 允许的文件类型后缀（用于对话框过滤） */
  fileTypes?: string[]
  /** 对话框标题 */
  dialogTitle?: string
  /** Excel 专用：指定工作表名（默认读第一个） */
  sheetName?: string
  /** Excel 专用：从第几行开始读（默认 1，即第一行为表头） */
  headerRow?: number
  /** 最大读取字符数（防止超大文件内存溢出） */
  maxChars?: number
}

export interface LocalReadResult {
  success: boolean
  filePath: string
  fileName: string
  fileType: string
  /** 纯文本内容 */
  text?: string
  /** 结构化表格数据（Excel/CSV） */
  tables?: Record<string, string>[][]
  /** 文件元数据 */
  meta?: {
    sizeBytes: number
    lastModified: string
    sheets?: string[]
  }
  error?: string
  readTimeMs?: number
}

export interface WatchDirectoryRequest {
  /** 要监控的目录路径 */
  dirPath: string
  /** 文件类型过滤 */
  fileTypes?: string[]
  /** 轮询间隔秒数（默认 60） */
  intervalSeconds?: number
}

// ────────────────────── 文件类型后缀映射 ──────────────────────

const FILE_TYPE_MAP: Record<string, string[]> = {
  excel: ['.xlsx', '.xls', '.xlsm'],
  csv: ['.csv', '.tsv'],
  word: ['.docx'],
  pdf: ['.pdf'],
  text: ['.txt', '.md', '.json'],
}

const ALL_SUPPORTED_EXTENSIONS = Object.values(FILE_TYPE_MAP).flat()

function getFileType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  for (const [type, exts] of Object.entries(FILE_TYPE_MAP)) {
    if (exts.includes(ext)) return type
  }
  return 'unknown'
}

// ────────────────────── Excel 读取 ──────────────────────

async function readExcelFile(
  filePath: string,
  sheetName?: string,
  headerRow = 1,
  maxChars = 500000,
): Promise<{ text: string; tables: Record<string, string>[][]; sheets: string[] }> {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)

  const sheets = workbook.worksheets.map(ws => ws.name)
  const allTables: Record<string, string>[][] = []
  const textParts: string[] = []
  let totalChars = 0

  const targetSheets = sheetName
    ? workbook.worksheets.filter(ws => ws.name === sheetName)
    : workbook.worksheets

  for (const ws of targetSheets) {
    if (totalChars >= maxChars) break

    textParts.push(`[Sheet: ${ws.name}]`)

    const rows: Record<string, string>[] = []
    let headers: string[] = []

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (totalChars >= maxChars) return

      const cells = row.values as (string | number | null | undefined)[]
      // ExcelJS row.values 索引从 1 开始
      const values = cells.slice(1).map(v => {
        if (v === null || v === undefined) return ''
        if (typeof v === 'object' && 'result' in v) return String((v as { result: unknown }).result)
        return String(v)
      })

      if (rowNumber === headerRow) {
        headers = values
        textParts.push(values.join('\t'))
      } else if (rowNumber > headerRow) {
        const rowObj: Record<string, string> = {}
        values.forEach((val, i) => {
          const key = headers[i] || `col${i}`
          rowObj[key] = val
        })
        rows.push(rowObj)
        const line = values.join('\t')
        textParts.push(line)
        totalChars += line.length
      }
    })

    if (rows.length > 0) {
      allTables.push(rows)
    }
  }

  return { text: textParts.join('\n'), tables: allTables, sheets }
}

// ────────────────────── CSV 读取 ──────────────────────

async function readCsvFile(
  filePath: string,
  maxChars = 500000,
): Promise<{ text: string; tables: Record<string, string>[][] }> {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const truncated = raw.slice(0, maxChars)

  const separator = filePath.endsWith('.tsv') ? '\t' : ','
  const lines = truncated.split('\n').filter(l => l.trim())
  if (lines.length === 0) return { text: '', tables: [] }

  const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ''))
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(separator).map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    vals.forEach((val, j) => {
      row[headers[j] || `col${j}`] = val
    })
    rows.push(row)
  }

  return { text: truncated, tables: rows.length > 0 ? [rows] : [] }
}

// ────────────────────── Word (.docx) 读取 ──────────────────────

async function readWordFile(
  filePath: string,
  maxChars = 500000,
): Promise<{ text: string }> {
  const mammoth = await loadMammoth()
  if (mammoth) {
    const result = await mammoth.extractRawText({ path: filePath })
    return { text: result.value.slice(0, maxChars) }
  }

  // 降级：简单读取 docx 的 XML 内容提取文本
  const JSZip = await import('jszip' as string).catch(() => null) as typeof import('jszip') | null
  if (!JSZip) {
    return { text: '[无法读取 .docx 文件，缺少 mammoth 或 jszip 依赖]' }
  }

  const data = fs.readFileSync(filePath)
  const zip = await JSZip.loadAsync(data)
  const docXml = await zip.file('word/document.xml')?.async('string')
  if (!docXml) return { text: '' }

  const textContent = docXml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars)

  return { text: textContent }
}

async function loadMammoth(): Promise<{ extractRawText: (opts: { path: string }) => Promise<{ value: string }> } | null> {
  try {
    return await import('mammoth' as string) as unknown as { extractRawText: (opts: { path: string }) => Promise<{ value: string }> }
  } catch {
    return null
  }
}

// ────────────────────── PDF 读取 ──────────────────────

async function readPdfFile(
  filePath: string,
  maxChars = 500000,
): Promise<{ text: string }> {
  try {
    const pdfParse = await import('pdf-parse' as string) as unknown as (buf: Buffer) => Promise<{ text: string }>
    const buf = fs.readFileSync(filePath)
    const data = await pdfParse(buf)
    return { text: data.text.slice(0, maxChars) }
  } catch {
    return { text: '[无法读取 PDF，缺少 pdf-parse 依赖。请导出为 txt 或 docx 后重试]' }
  }
}

// ────────────────────── 纯文本读取 ──────────────────────

function readTextFile(filePath: string, maxChars = 500000): { text: string } {
  const raw = fs.readFileSync(filePath, 'utf-8')
  return { text: raw.slice(0, maxChars) }
}

// ────────────────────── 统一入口 ──────────────────────

async function readLocalFile(req: LocalReadRequest): Promise<LocalReadResult> {
  const start = Date.now()

  let filePath = req.filePath || ''

  // 弹出文件选择对话框
  if (!filePath) {
    const filters: { name: string; extensions: string[] }[] = []
    const types = req.fileTypes || ALL_SUPPORTED_EXTENSIONS.map(e => e.slice(1))
    filters.push({ name: '支持的文件', extensions: types })

    const result = await dialog.showOpenDialog({
      title: req.dialogTitle || '选择文件导入到知识库',
      filters,
      properties: ['openFile'],
    })

    if (result.canceled || !result.filePaths[0]) {
      return { success: false, filePath: '', fileName: '', fileType: '', error: '用户取消选择' }
    }
    filePath = result.filePaths[0]
  }

  if (!isReadPathAllowed(filePath)) {
    return { success: false, filePath: '', fileName: path.basename(filePath), fileType: '', error: '路径不在允许的读取目录中' }
  }

  if (!fs.existsSync(filePath)) {
    return { success: false, filePath, fileName: path.basename(filePath), fileType: '', error: '文件不存在' }
  }

  const stat = fs.statSync(filePath)
  const fileType = getFileType(filePath)
  const maxChars = req.maxChars || 500000
  const baseMeta = {
    sizeBytes: stat.size,
    lastModified: stat.mtime.toISOString(),
  }

  try {
    switch (fileType) {
      case 'excel': {
        const res = await readExcelFile(filePath, req.sheetName, req.headerRow, maxChars)
        return {
          success: true, filePath, fileName: path.basename(filePath), fileType,
          text: res.text, tables: res.tables,
          meta: { ...baseMeta, sheets: res.sheets },
          readTimeMs: Date.now() - start,
        }
      }
      case 'csv': {
        const res = await readCsvFile(filePath, maxChars)
        return {
          success: true, filePath, fileName: path.basename(filePath), fileType,
          text: res.text, tables: res.tables,
          meta: baseMeta,
          readTimeMs: Date.now() - start,
        }
      }
      case 'word': {
        const res = await readWordFile(filePath, maxChars)
        return {
          success: true, filePath, fileName: path.basename(filePath), fileType,
          text: res.text, meta: baseMeta,
          readTimeMs: Date.now() - start,
        }
      }
      case 'pdf': {
        const res = await readPdfFile(filePath, maxChars)
        return {
          success: true, filePath, fileName: path.basename(filePath), fileType,
          text: res.text, meta: baseMeta,
          readTimeMs: Date.now() - start,
        }
      }
      case 'text': {
        const res = readTextFile(filePath, maxChars)
        return {
          success: true, filePath, fileName: path.basename(filePath), fileType,
          text: res.text, meta: baseMeta,
          readTimeMs: Date.now() - start,
        }
      }
      default:
        return {
          success: false, filePath, fileName: path.basename(filePath), fileType,
          error: `不支持的文件类型: ${path.extname(filePath)}`,
          readTimeMs: Date.now() - start,
        }
    }
  } catch (err: unknown) {
    return {
      success: false, filePath, fileName: path.basename(filePath), fileType,
      error: (err as Error).message,
      readTimeMs: Date.now() - start,
    }
  }
}

// ────────────────────── 批量读取目录 ──────────────────────

async function readDirectory(
  dirPath: string,
  fileTypes?: string[],
  maxFiles = 50,
): Promise<LocalReadResult[]> {
  if (!isReadPathAllowed(dirPath)) return []
  if (!fs.existsSync(dirPath)) return []

  const extensions = fileTypes
    ? fileTypes.map(t => t.startsWith('.') ? t : `.${t}`)
    : ALL_SUPPORTED_EXTENSIONS

  const files = fs.readdirSync(dirPath)
    .filter(f => extensions.includes(path.extname(f).toLowerCase()))
    .slice(0, maxFiles)

  const results: LocalReadResult[] = []
  for (const file of files) {
    results.push(await readLocalFile({ filePath: path.join(dirPath, file) }))
  }
  return results
}

// ────────────────────── 导出目录监控（简易轮询） ──────────────────────

const watchedDirs = new Map<string, { timer: NodeJS.Timeout; files: Set<string> }>()

function startWatchDirectory(
  req: WatchDirectoryRequest,
  onChange: (newFiles: string[]) => void,
): void {
  stopWatchDirectory(req.dirPath)

  const extensions = (req.fileTypes || ALL_SUPPORTED_EXTENSIONS.map(e => e.slice(1)))
    .map(t => t.startsWith('.') ? t : `.${t}`)

  const knownFiles = new Set<string>()
  if (fs.existsSync(req.dirPath)) {
    for (const f of fs.readdirSync(req.dirPath)) {
      if (extensions.includes(path.extname(f).toLowerCase())) {
        knownFiles.add(f)
      }
    }
  }

  const interval = (req.intervalSeconds || 60) * 1000
  const timer = setInterval(() => {
    if (!fs.existsSync(req.dirPath)) return

    const currentFiles = fs.readdirSync(req.dirPath)
      .filter(f => extensions.includes(path.extname(f).toLowerCase()))

    const newFiles = currentFiles.filter(f => !knownFiles.has(f))
    if (newFiles.length > 0) {
      newFiles.forEach(f => knownFiles.add(f))
      onChange(newFiles.map(f => path.join(req.dirPath, f)))
    }
  }, interval)

  watchedDirs.set(req.dirPath, { timer, files: knownFiles })
}

function stopWatchDirectory(dirPath: string): void {
  const entry = watchedDirs.get(dirPath)
  if (entry) {
    clearInterval(entry.timer)
    watchedDirs.delete(dirPath)
  }
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupLocalDataReaderIPC(): void {
  ipcMain.handle('localReader:read', async (_, req: LocalReadRequest): Promise<LocalReadResult> => {
    return readLocalFile(req)
  })

  ipcMain.handle('localReader:readDirectory', async (_, dirPath: string, fileTypes?: string[]) => {
    return readDirectory(dirPath, fileTypes)
  })

  ipcMain.handle('localReader:selectAndRead', async (_, fileTypes?: string[]) => {
    return readLocalFile({ fileTypes })
  })

  ipcMain.handle('localReader:supportedTypes', () => {
    return {
      extensions: ALL_SUPPORTED_EXTENSIONS,
      types: FILE_TYPE_MAP,
    }
  })

  // 目录监控（只允许监控用户目录）
  ipcMain.handle('localReader:watchDir', async (_, req: WatchDirectoryRequest) => {
    if (!isReadPathAllowed(req.dirPath)) {
      return { watching: false, dirPath: req.dirPath, error: '路径不在允许的目录中' }
    }
    startWatchDirectory(req, (newFiles) => {
      // 通过 IPC 通知 renderer 有新文件
      const wins = BrowserWindow.getAllWindows()
      for (const win of wins) {
        if (!win.isDestroyed()) {
          win.webContents.send('localReader:newFiles', { dirPath: req.dirPath, files: newFiles })
        }
      }
    })
    return { watching: true, dirPath: req.dirPath }
  })

  ipcMain.handle('localReader:unwatchDir', async (_, dirPath: string) => {
    stopWatchDirectory(dirPath)
    return { watching: false, dirPath }
  })
}
