// FileIntel — MBE Desktop Phase 3 本地文件智能
//
// 用户授权一个目录后，Agent 可以：
//   1. scanDir     — 扫描目录（仅返回元数据，不读内容）
//   2. selectDir   — 让用户选择目录（对话框）
//   3. parseFile   — 解析文件为结构化 JSON
//   4. batchAnalyze — 批量扫描+分类+摘要（逐个处理带进度）
//   5. pipeline    — 读入 → Agent 处理 → 输出的管道
//
// 安全模型：L2 确认 → 只读扫描 → 结果摘要 → 用户选择后深入分析

import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

// ────────────────────── 类型 ──────────────────────

export interface FileInfo {
  name: string
  path: string
  ext: string
  type: string
  sizeBytes: number
  sizeHuman: string
  lastModified: string
  created: string
  isDirectory: boolean
}

export interface ScanDirRequest {
  dirPath: string
  fileTypes?: string[]
  recursive?: boolean
  maxFiles?: number
  maxDepth?: number
}

export interface ScanDirResult {
  success: boolean
  dirPath: string
  files: FileInfo[]
  totalFiles: number
  totalSize: number
  totalSizeHuman: string
  typeSummary: Record<string, number>
  error?: string
  scanTimeMs: number
}

export interface ParseFileRequest {
  filePath: string
  maxChars?: number
  sheetName?: string
  headerRow?: number
}

export interface ParsedFile {
  success: boolean
  filePath: string
  fileName: string
  fileType: string
  text: string
  sections?: { heading: string; content: string }[]
  tables?: Record<string, string>[][]
  pages?: { pageNum: number; text: string }[]
  meta: {
    sizeBytes: number
    lastModified: string
    sheets?: string[]
    pageCount?: number
    wordCount: number
    charCount: number
  }
  parseTimeMs: number
  error?: string
}

export interface BatchAnalyzeRequest {
  dirPath: string
  fileTypes?: string[]
  maxFiles?: number
  operation: 'classify' | 'summarize' | 'extract' | 'custom'
  prompt?: string
}

export interface BatchFileResult {
  filePath: string
  fileName: string
  fileType: string
  sizeBytes: number
  status: 'pending' | 'processing' | 'done' | 'error'
  classification?: string
  summary?: string
  extractedData?: Record<string, unknown>
  error?: string
}

export interface BatchAnalyzeResult {
  success: boolean
  dirPath: string
  totalFiles: number
  processedFiles: number
  results: BatchFileResult[]
  totalTimeMs: number
  error?: string
}

export interface PipelineStep {
  action: 'read' | 'transform' | 'filter' | 'merge' | 'write'
  params: Record<string, unknown>
}

export interface PipelineRequest {
  steps: PipelineStep[]
  inputFiles?: string[]
  outputFormat?: 'xlsx' | 'docx' | 'json' | 'csv'
  outputPath?: string
}

export interface PipelineResult {
  success: boolean
  stepsCompleted: number
  totalSteps: number
  outputPath?: string
  outputData?: unknown
  error?: string
  pipelineTimeMs: number
}

// ────────────────────── 工具函数 ──────────────────────

const FILE_TYPE_MAP: Record<string, string[]> = {
  excel: ['.xlsx', '.xls', '.xlsm', '.xlsb'],
  csv: ['.csv', '.tsv'],
  word: ['.docx', '.doc'],
  pdf: ['.pdf'],
  text: ['.txt', '.md', '.json', '.xml', '.yaml', '.yml'],
  image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'],
  ppt: ['.pptx', '.ppt'],
}

const ALL_EXTENSIONS = Object.values(FILE_TYPE_MAP).flat()

function classifyFile(ext: string): string {
  const lower = ext.toLowerCase()
  for (const [type, exts] of Object.entries(FILE_TYPE_MAP)) {
    if (exts.includes(lower)) return type
  }
  return 'other'
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function buildFileInfo(fullPath: string, stat: fs.Stats): FileInfo {
  const ext = path.extname(fullPath).toLowerCase()
  return {
    name: path.basename(fullPath),
    path: fullPath,
    ext,
    type: classifyFile(ext),
    sizeBytes: stat.size,
    sizeHuman: humanSize(stat.size),
    lastModified: stat.mtime.toISOString(),
    created: stat.birthtime.toISOString(),
    isDirectory: stat.isDirectory(),
  }
}

// ────────────────────── 1. scanDir — 目录元数据扫描 ──────────────────────

async function scanDirectory(req: ScanDirRequest): Promise<ScanDirResult> {
  const start = Date.now()
  const dirPath = req.dirPath
  const maxFiles = req.maxFiles ?? 500
  const maxDepth = req.maxDepth ?? 3
  const recursive = req.recursive ?? false

  if (!fs.existsSync(dirPath)) {
    return {
      success: false, dirPath, files: [], totalFiles: 0,
      totalSize: 0, totalSizeHuman: '0 B', typeSummary: {},
      error: `目录不存在: ${dirPath}`, scanTimeMs: Date.now() - start,
    }
  }

  const allowedExts = req.fileTypes
    ? req.fileTypes.map(t => t.startsWith('.') ? t.toLowerCase() : `.${t.toLowerCase()}`)
    : null

  const files: FileInfo[] = []
  const typeSummary: Record<string, number> = {}
  let totalSize = 0

  function walk(dir: string, depth: number): void {
    if (files.length >= maxFiles) return
    if (recursive && depth > maxDepth) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) break

      const fullPath = path.join(dir, entry.name)

      if (entry.name.startsWith('.') || entry.name.startsWith('~$')) continue

      if (entry.isDirectory()) {
        if (recursive) walk(fullPath, depth + 1)
        continue
      }

      if (!entry.isFile()) continue

      const ext = path.extname(entry.name).toLowerCase()
      if (allowedExts && !allowedExts.includes(ext)) continue
      if (!allowedExts && !ALL_EXTENSIONS.includes(ext)) continue

      try {
        const stat = fs.statSync(fullPath)
        const info = buildFileInfo(fullPath, stat)
        files.push(info)
        totalSize += stat.size
        typeSummary[info.type] = (typeSummary[info.type] || 0) + 1
      } catch {
        // 跳过无法访问的文件
      }
    }
  }

  walk(dirPath, 0)

  files.sort((a, b) => b.lastModified.localeCompare(a.lastModified))

  return {
    success: true,
    dirPath,
    files,
    totalFiles: files.length,
    totalSize,
    totalSizeHuman: humanSize(totalSize),
    typeSummary,
    scanTimeMs: Date.now() - start,
  }
}

// ────────────────────── 2. selectDir — 目录选择对话框 ──────────────────────

async function selectDirectory(title?: string): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: title || '选择要扫描的目录',
    properties: ['openDirectory'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return result.filePaths[0]
}

// ────────────────────── 3. parseFile — 结构化解析 ──────────────────────

async function parseFile(req: ParseFileRequest): Promise<ParsedFile> {
  const start = Date.now()
  const { filePath, maxChars = 500000 } = req

  if (!fs.existsSync(filePath)) {
    return {
      success: false, filePath, fileName: path.basename(filePath),
      fileType: 'unknown', text: '', meta: { sizeBytes: 0, lastModified: '', wordCount: 0, charCount: 0 },
      error: '文件不存在', parseTimeMs: Date.now() - start,
    }
  }

  const stat = fs.statSync(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const fileType = classifyFile(ext)
  const baseMeta = { sizeBytes: stat.size, lastModified: stat.mtime.toISOString() }

  try {
    switch (fileType) {
      case 'excel':
        return await parseExcel(filePath, req, baseMeta, start)
      case 'csv':
        return parseCsv(filePath, maxChars, baseMeta, start)
      case 'word':
        return await parseWord(filePath, maxChars, baseMeta, start)
      case 'pdf':
        return await parsePdf(filePath, maxChars, baseMeta, start)
      case 'text':
        return parseText(filePath, maxChars, baseMeta, start)
      default:
        return {
          success: false, filePath, fileName: path.basename(filePath), fileType,
          text: '', meta: { ...baseMeta, wordCount: 0, charCount: 0 },
          error: `不支持解析的文件类型: ${ext}`, parseTimeMs: Date.now() - start,
        }
    }
  } catch (err) {
    return {
      success: false, filePath, fileName: path.basename(filePath), fileType,
      text: '', meta: { ...baseMeta, wordCount: 0, charCount: 0 },
      error: (err as Error).message, parseTimeMs: Date.now() - start,
    }
  }
}

async function parseExcel(
  filePath: string, req: ParseFileRequest,
  baseMeta: { sizeBytes: number; lastModified: string }, start: number,
): Promise<ParsedFile> {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)

  const sheetNames = workbook.worksheets.map(ws => ws.name)
  const maxChars = req.maxChars ?? 500000
  const headerRow = req.headerRow ?? 1
  const allTables: Record<string, string>[][] = []
  const textParts: string[] = []
  let totalChars = 0

  const targetSheets = req.sheetName
    ? workbook.worksheets.filter(ws => ws.name === req.sheetName)
    : workbook.worksheets

  for (const ws of targetSheets) {
    if (totalChars >= maxChars) break
    textParts.push(`[Sheet: ${ws.name}]`)
    const rows: Record<string, string>[] = []
    let headers: string[] = []

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (totalChars >= maxChars) return
      const cells = row.values as (string | number | null | undefined)[]
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
        values.forEach((val, i) => { rowObj[headers[i] || `col${i}`] = val })
        rows.push(rowObj)
        const line = values.join('\t')
        textParts.push(line)
        totalChars += line.length
      }
    })

    if (rows.length > 0) allTables.push(rows)
  }

  const text = textParts.join('\n')
  return {
    success: true, filePath, fileName: path.basename(filePath), fileType: 'excel',
    text, tables: allTables,
    meta: { ...baseMeta, sheets: sheetNames, wordCount: text.split(/\s+/).length, charCount: text.length },
    parseTimeMs: Date.now() - start,
  }
}

function parseCsv(
  filePath: string, maxChars: number,
  baseMeta: { sizeBytes: number; lastModified: string }, start: number,
): ParsedFile {
  const raw = fs.readFileSync(filePath, 'utf-8').slice(0, maxChars)
  const separator = filePath.endsWith('.tsv') ? '\t' : ','
  const lines = raw.split('\n').filter(l => l.trim())
  if (lines.length === 0) {
    return {
      success: true, filePath, fileName: path.basename(filePath), fileType: 'csv',
      text: '', tables: [], meta: { ...baseMeta, wordCount: 0, charCount: 0 },
      parseTimeMs: Date.now() - start,
    }
  }

  const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ''))
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(separator).map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    vals.forEach((val, j) => { row[headers[j] || `col${j}`] = val })
    rows.push(row)
  }

  return {
    success: true, filePath, fileName: path.basename(filePath), fileType: 'csv',
    text: raw, tables: rows.length > 0 ? [rows] : [],
    meta: { ...baseMeta, wordCount: raw.split(/\s+/).length, charCount: raw.length },
    parseTimeMs: Date.now() - start,
  }
}

async function parseWord(
  filePath: string, maxChars: number,
  baseMeta: { sizeBytes: number; lastModified: string }, start: number,
): Promise<ParsedFile> {
  let text = ''
  const sections: { heading: string; content: string }[] = []

  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ path: filePath })
    text = result.value.slice(0, maxChars)

    // 尝试提取结构化段落
    const htmlResult = await mammoth.convertToHtml({ path: filePath })
    const html = htmlResult.value
    const headingRegex = /<h(\d)[^>]*>(.*?)<\/h\1>/gi
    let match: RegExpExecArray | null
    let lastIdx = 0
    let lastHeading = '（无标题段落）'

    while ((match = headingRegex.exec(html)) !== null) {
      const beforeContent = html.slice(lastIdx, match.index).replace(/<[^>]+>/g, ' ').trim()
      if (beforeContent) {
        sections.push({ heading: lastHeading, content: beforeContent.slice(0, 2000) })
      }
      lastHeading = match[2].replace(/<[^>]+>/g, '').trim()
      lastIdx = match.index + match[0].length
    }
    const remaining = html.slice(lastIdx).replace(/<[^>]+>/g, ' ').trim()
    if (remaining) {
      sections.push({ heading: lastHeading, content: remaining.slice(0, 2000) })
    }
  } catch {
    // mammoth 不可用时降级读取 XML
    try {
      const JSZip = (await import('jszip')).default
      const data = fs.readFileSync(filePath)
      const zip = await JSZip.loadAsync(data)
      const docXml = await zip.file('word/document.xml')?.async('string')
      if (docXml) {
        text = docXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxChars)
      }
    } catch {
      text = '[无法读取 .docx 文件]'
    }
  }

  return {
    success: true, filePath, fileName: path.basename(filePath), fileType: 'word',
    text, sections: sections.length > 0 ? sections : undefined,
    meta: { ...baseMeta, wordCount: text.split(/\s+/).length, charCount: text.length },
    parseTimeMs: Date.now() - start,
  }
}

async function parsePdf(
  filePath: string, maxChars: number,
  baseMeta: { sizeBytes: number; lastModified: string }, start: number,
): Promise<ParsedFile> {
  try {
    const pdfModule = await import('pdf-parse')
    const pdfParse = (pdfModule.default ?? pdfModule) as unknown as (buf: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>
    const buf = fs.readFileSync(filePath)
    const data = await pdfParse(buf)
    const text = data.text.slice(0, maxChars)

    // 按分页符拆分页
    const rawPages = data.text.split(/\f/)
    const pages = rawPages.map((p: string, i: number) => ({
      pageNum: i + 1,
      text: p.trim().slice(0, 5000),
    })).filter((p: { text: string }) => p.text.length > 0)

    return {
      success: true, filePath, fileName: path.basename(filePath), fileType: 'pdf',
      text, pages: pages.length > 1 ? pages : undefined,
      meta: {
        ...baseMeta, pageCount: data.numpages,
        wordCount: text.split(/\s+/).length, charCount: text.length,
      },
      parseTimeMs: Date.now() - start,
    }
  } catch {
    return {
      success: false, filePath, fileName: path.basename(filePath), fileType: 'pdf',
      text: '', meta: { ...baseMeta, wordCount: 0, charCount: 0 },
      error: '无法解析 PDF（请确保 pdf-parse 已安装）', parseTimeMs: Date.now() - start,
    }
  }
}

function parseText(
  filePath: string, maxChars: number,
  baseMeta: { sizeBytes: number; lastModified: string }, start: number,
): ParsedFile {
  const raw = fs.readFileSync(filePath, 'utf-8').slice(0, maxChars)
  return {
    success: true, filePath, fileName: path.basename(filePath), fileType: 'text',
    text: raw,
    meta: { ...baseMeta, wordCount: raw.split(/\s+/).length, charCount: raw.length },
    parseTimeMs: Date.now() - start,
  }
}

// ────────────────────── 4. batchAnalyze — 批量扫描+分类+摘要 ──────────────────────

let mainWindowRef: BrowserWindow | null = null

export function setFileIntelMainWindow(win: BrowserWindow | null): void {
  mainWindowRef = win
}

function sendProgress(channel: string, data: unknown): void {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return
  mainWindowRef.webContents.send(channel, data)
}

async function batchAnalyze(req: BatchAnalyzeRequest): Promise<BatchAnalyzeResult> {
  const start = Date.now()

  const scan = await scanDirectory({
    dirPath: req.dirPath,
    fileTypes: req.fileTypes,
    maxFiles: req.maxFiles ?? 100,
  })

  if (!scan.success) {
    return {
      success: false, dirPath: req.dirPath, totalFiles: 0, processedFiles: 0,
      results: [], totalTimeMs: Date.now() - start, error: scan.error,
    }
  }

  const parsableFiles = scan.files.filter(f =>
    ['excel', 'csv', 'word', 'pdf', 'text'].includes(f.type),
  )

  const results: BatchFileResult[] = []

  for (let i = 0; i < parsableFiles.length; i++) {
    const file = parsableFiles[i]
    const batchItem: BatchFileResult = {
      filePath: file.path,
      fileName: file.name,
      fileType: file.type,
      sizeBytes: file.sizeBytes,
      status: 'processing',
    }

    sendProgress('fileIntel:batchProgress', {
      current: i + 1,
      total: parsableFiles.length,
      file: file.name,
      status: 'processing',
    })

    try {
      const parsed = await parseFile({ filePath: file.path, maxChars: 50000 })
      if (!parsed.success) {
        batchItem.status = 'error'
        batchItem.error = parsed.error
      } else {
        batchItem.status = 'done'
        batchItem.summary = generateQuickSummary(parsed)

        if (req.operation === 'classify' || req.operation === 'custom') {
          batchItem.classification = classifyByContent(parsed, file)
        }

        if (req.operation === 'extract') {
          batchItem.extractedData = extractKeyData(parsed)
        }
      }
    } catch (err) {
      batchItem.status = 'error'
      batchItem.error = (err as Error).message
    }

    results.push(batchItem)

    sendProgress('fileIntel:batchProgress', {
      current: i + 1,
      total: parsableFiles.length,
      file: file.name,
      status: batchItem.status,
    })
  }

  return {
    success: true,
    dirPath: req.dirPath,
    totalFiles: parsableFiles.length,
    processedFiles: results.filter(r => r.status === 'done').length,
    results,
    totalTimeMs: Date.now() - start,
  }
}

function generateQuickSummary(parsed: ParsedFile): string {
  const parts: string[] = []
  parts.push(`${parsed.fileName}（${parsed.fileType}）`)
  parts.push(`${parsed.meta.charCount} 字`)

  if (parsed.meta.sheets?.length) {
    parts.push(`${parsed.meta.sheets.length} 个工作表`)
  }
  if (parsed.meta.pageCount) {
    parts.push(`${parsed.meta.pageCount} 页`)
  }
  if (parsed.tables?.length) {
    const totalRows = parsed.tables.reduce((sum, t) => sum + t.length, 0)
    parts.push(`${totalRows} 行数据`)
  }
  if (parsed.sections?.length) {
    parts.push(`${parsed.sections.length} 个段落`)
  }

  const preview = parsed.text.slice(0, 200).replace(/\s+/g, ' ').trim()
  if (preview) {
    parts.push(`\n摘要: ${preview}...`)
  }

  return parts.join(' | ')
}

function classifyByContent(parsed: ParsedFile, file: FileInfo): string {
  const text = (parsed.text + file.name).toLowerCase()

  const patterns: [string, RegExp][] = [
    ['合同', /合同|协议|contract|agreement/],
    ['发票', /发票|invoice|税额|fapiao/],
    ['财务报表', /资产负债|利润表|现金流|balance sheet|income statement/],
    ['薪资', /工资|薪酬|salary|payroll|社保/],
    ['简历', /简历|resume|cv|求职|应聘/],
    ['法律文书', /判决书|裁定|起诉|律师|法院|诉讼/],
    ['医疗报告', /诊断|化验|病历|检查报告|医院|患者/],
    ['工程资料', /工程量|定额|清单|造价|施工/],
    ['客户名单', /客户|联系人|电话|手机|email|公司名/],
    ['会议记录', /会议|纪要|议程|参会|决议/],
    ['数据表格', /数据|统计|汇总|明细|台账/],
  ]

  for (const [label, regex] of patterns) {
    if (regex.test(text)) return label
  }
  return '其他文档'
}

function extractKeyData(parsed: ParsedFile): Record<string, unknown> {
  const result: Record<string, unknown> = {
    wordCount: parsed.meta.wordCount,
    charCount: parsed.meta.charCount,
    fileType: parsed.fileType,
  }

  if (parsed.tables?.length) {
    result.tableCount = parsed.tables.length
    result.totalRows = parsed.tables.reduce((sum, t) => sum + t.length, 0)
    if (parsed.tables[0]?.length > 0) {
      result.columnHeaders = Object.keys(parsed.tables[0][0])
    }
  }
  if (parsed.meta.pageCount) result.pageCount = parsed.meta.pageCount
  if (parsed.meta.sheets) result.sheets = parsed.meta.sheets
  if (parsed.sections?.length) {
    result.sectionHeadings = parsed.sections.map(s => s.heading)
  }

  // 抽取金额（¥/元/万/亿）
  const moneyRegex = /[¥￥]?\s*([\d,.]+)\s*(万元|亿元|元)/g
  const amounts: string[] = []
  let m: RegExpExecArray | null
  const searchText = parsed.text.slice(0, 10000)
  while ((m = moneyRegex.exec(searchText)) !== null) {
    amounts.push(`${m[1]}${m[2]}`)
    if (amounts.length >= 20) break
  }
  if (amounts.length > 0) result.amounts = amounts

  // 抽取日期
  const dateRegex = /(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号]?/g
  const dates: string[] = []
  let d: RegExpExecArray | null
  while ((d = dateRegex.exec(searchText)) !== null) {
    dates.push(`${d[1]}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}`)
    if (dates.length >= 20) break
  }
  if (dates.length > 0) result.dates = [...new Set(dates)]

  return result
}

// ────────────────────── 5. pipeline — 读入→处理→输出 ──────────────────────

async function executePipeline(req: PipelineRequest): Promise<PipelineResult> {
  const start = Date.now()
  const { steps, inputFiles } = req
  let currentData: unknown = null
  let stepsCompleted = 0

  try {
    for (const step of steps) {
      sendProgress('fileIntel:pipelineProgress', {
        step: stepsCompleted + 1,
        total: steps.length,
        action: step.action,
        status: 'running',
      })

      switch (step.action) {
        case 'read': {
          const files = (step.params.files as string[]) ?? inputFiles ?? []
          const results: ParsedFile[] = []
          for (const f of files) {
            results.push(await parseFile({
              filePath: f,
              maxChars: (step.params.maxChars as number) ?? 200000,
            }))
          }
          currentData = results
          break
        }

        case 'filter': {
          if (!Array.isArray(currentData)) break
          const filterType = step.params.type as string
          const filterValue = step.params.value as string
          if (filterType === 'fileType') {
            currentData = (currentData as ParsedFile[]).filter(
              f => f.fileType === filterValue,
            )
          } else if (filterType === 'contains') {
            currentData = (currentData as ParsedFile[]).filter(
              f => f.text.includes(filterValue),
            )
          } else if (filterType === 'minSize') {
            currentData = (currentData as ParsedFile[]).filter(
              f => f.meta.sizeBytes >= (step.params.minBytes as number ?? 0),
            )
          }
          break
        }

        case 'transform': {
          if (!Array.isArray(currentData)) break
          const transformOp = step.params.operation as string
          if (transformOp === 'summarize') {
            currentData = (currentData as ParsedFile[]).map(f => ({
              fileName: f.fileName,
              fileType: f.fileType,
              summary: generateQuickSummary(f),
              classification: classifyByContent(f, {
                name: f.fileName, path: f.filePath, ext: '', type: f.fileType,
                sizeBytes: f.meta.sizeBytes, sizeHuman: '', lastModified: '', created: '',
                isDirectory: false,
              }),
            }))
          } else if (transformOp === 'extract_tables') {
            currentData = (currentData as ParsedFile[])
              .filter(f => f.tables && f.tables.length > 0)
              .flatMap(f => f.tables ?? [])
          } else if (transformOp === 'merge_text') {
            currentData = (currentData as ParsedFile[])
              .map(f => `=== ${f.fileName} ===\n${f.text}`)
              .join('\n\n')
          }
          break
        }

        case 'merge': {
          // 合并所有表格数据到一个大表
          if (!Array.isArray(currentData)) break
          const allRows: Record<string, string>[] = []
          for (const item of currentData as (ParsedFile | Record<string, string>)[]) {
            if ('tables' in item && Array.isArray((item as ParsedFile).tables)) {
              for (const table of (item as ParsedFile).tables ?? []) {
                allRows.push(...table)
              }
            } else if (typeof item === 'object' && !('tables' in item)) {
              allRows.push(item as Record<string, string>)
            }
          }
          currentData = allRows
          break
        }

        case 'write': {
          const outputPath = (step.params.outputPath as string) ?? req.outputPath
          const format = (step.params.format as string) ?? req.outputFormat ?? 'json'

          if (format === 'json' && outputPath) {
            fs.writeFileSync(outputPath, JSON.stringify(currentData, null, 2), 'utf-8')
          }
          // xlsx/docx 的写入交给 LocalAppBridge.docgen，此处仅标记输出路径
          break
        }
      }

      stepsCompleted++
      sendProgress('fileIntel:pipelineProgress', {
        step: stepsCompleted,
        total: steps.length,
        action: step.action,
        status: 'done',
      })
    }

    return {
      success: true,
      stepsCompleted,
      totalSteps: steps.length,
      outputPath: req.outputPath,
      outputData: currentData,
      pipelineTimeMs: Date.now() - start,
    }
  } catch (err) {
    return {
      success: false,
      stepsCompleted,
      totalSteps: steps.length,
      error: (err as Error).message,
      pipelineTimeMs: Date.now() - start,
    }
  }
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupFileIntelIPC(): void {
  // 1. 扫描目录（仅元数据）
  ipcMain.handle('fileIntel:scanDir', async (_, req: ScanDirRequest): Promise<ScanDirResult> => {
    return scanDirectory(req)
  })

  // 2. 选择目录
  ipcMain.handle('fileIntel:selectDir', async (_, title?: string): Promise<string | null> => {
    return selectDirectory(title)
  })

  // 3. 结构化解析文件
  ipcMain.handle('fileIntel:parseFile', async (_, req: ParseFileRequest): Promise<ParsedFile> => {
    return parseFile(req)
  })

  // 4. 批量分析
  ipcMain.handle('fileIntel:batchAnalyze', async (_, req: BatchAnalyzeRequest): Promise<BatchAnalyzeResult> => {
    return batchAnalyze(req)
  })

  // 5. 管道处理
  ipcMain.handle('fileIntel:pipeline', async (_, req: PipelineRequest): Promise<PipelineResult> => {
    return executePipeline(req)
  })

  // 6. 快捷方法: 扫描+分类（一步到位）
  ipcMain.handle('fileIntel:scanAndClassify', async (_, dirPath: string, fileTypes?: string[]): Promise<{
    scan: ScanDirResult
    classified: Record<string, FileInfo[]>
  }> => {
    const scan = await scanDirectory({ dirPath, fileTypes })
    const classified: Record<string, FileInfo[]> = {}
    for (const file of scan.files) {
      const cat = file.type
      if (!classified[cat]) classified[cat] = []
      classified[cat].push(file)
    }
    return { scan, classified }
  })
}
