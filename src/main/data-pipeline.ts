// DataPipeline — MBE Desktop Phase 4 跨应用数据管道
//
// 核心场景：
//   "读取客户名单.xlsx → 分析每个客户 → 生成跟进方案.docx"
//   "把这个 Word 合同翻译成英文 → 保存新 Word"
//   "把多个 PDF 发票合并到一个 Excel 汇总表"
//
// 架构：
//   read(FileIntel) → ai_process(Agent HTTP) → generate(DocGen) → open(shell)
//
// AI 步骤通过 HTTP POST 调用 Agent 后端的 /consult 或 /chat 端点，
// 不走 WebSocket（管道需要同步等待每条结果）。

import { app, ipcMain, BrowserWindow, shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { isReadPathAllowed, isWritePathAllowed } from './safe-path'
import { generateXlsx } from './docgen/xlsx-engine'
import { generateDocx } from './docgen/docx-engine'
import { generatePptx } from './docgen/pptx-engine'

// ────────────────────── 类型定义 ──────────────────────

export type PipelineStepType = 'read' | 'read_dir' | 'ai_process' | 'ai_each' | 'transform' | 'generate' | 'open'

export interface PipelineStepDef {
  type: PipelineStepType
  label: string
  params: Record<string, unknown>
}

export interface PipelineConfig {
  id?: string
  name: string
  description?: string
  steps: PipelineStepDef[]
  agentBaseUrl?: string
  agentHeaders?: Record<string, string>
  autoOpen?: boolean
}

export interface PipelineStepResult {
  stepIndex: number
  type: PipelineStepType
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
  output?: unknown
  error?: string
  durationMs?: number
  itemProgress?: { current: number; total: number }
}

export interface PipelineResult {
  success: boolean
  name: string
  totalSteps: number
  completedSteps: number
  stepResults: PipelineStepResult[]
  outputFiles: string[]
  totalDurationMs: number
  error?: string
}

interface ParsedFileData {
  success: boolean
  filePath: string
  fileName: string
  fileType: string
  text: string
  sections?: { heading: string; content: string }[]
  tables?: Record<string, string>[][]
  pages?: { pageNum: number; text: string }[]
  meta: Record<string, unknown>
}

// ────────────────────── 主窗口引用 ──────────────────────

let mainWindowRef: BrowserWindow | null = null

export function setPipelineMainWindow(win: BrowserWindow | null): void {
  mainWindowRef = win
}

function emitProgress(data: PipelineStepResult): void {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return
  mainWindowRef.webContents.send('dataPipeline:progress', data)
}

// ────────────────────── 工具函数 ──────────────────────

function getExportsDir(): string {
  const docs = app.getPath('documents')
  const dir = path.join(docs, 'MBE Desktop', 'exports')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function generateFileName(format: string, prefix?: string): string {
  const now = new Date()
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${prefix || 'MBE'}_${ts}.${format}`
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ────────────────────── Agent HTTP 调用 ──────────────────────

async function callAgent(
  baseUrl: string,
  query: string,
  headers?: Record<string, string>,
  timeout = 60000,
): Promise<{ answer: string; data?: Record<string, unknown> }> {
  const candidates = [
    `${baseUrl}/consult`,
    `${baseUrl}/chat`,
  ]

  const body = JSON.stringify({
    query, request: query, question: query, message: query, stream: false,
  })

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  for (const url of candidates) {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: reqHeaders,
        body,
      }, timeout)

      if (!response.ok) continue

      const data = await response.json()
      const answer = data.answer || data.text || data.content || data.message || ''
      if (answer) return { answer, data }
    } catch {
      // 下一个端点
    }
  }

  throw new Error(`Agent 不可达: ${baseUrl}`)
}

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Agent 请求超时')), timeoutMs)
    fetch(url, init)
      .then(r => { clearTimeout(timer); resolve(r) })
      .catch(e => { clearTimeout(timer); reject(e) })
  })
}

// ────────────────────── 文件解析（复用 FileIntel） ──────────────────────

async function parseFile(filePath: string, maxChars = 200000): Promise<ParsedFileData> {
  // 动态导入 file-intel 的解析功能
  const fileIntel = await import('./file-intel')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (fileIntel as any).default?.parseFile?.({ filePath, maxChars })
    ?? invokeParseFile(filePath, maxChars)
  return result
}

async function invokeParseFile(filePath: string, maxChars: number): Promise<ParsedFileData> {
  // 通过 IPC 调用已注册的 fileIntel:parseFile
  return new Promise((resolve) => {
    const handler = ipcMain.listeners('fileIntel:parseFile')
    if (handler.length === 0) {
      resolve({
        success: false, filePath, fileName: path.basename(filePath),
        fileType: 'unknown', text: '', meta: {},
      } as ParsedFileData)
      return
    }
    // 直接读取文件的简化实现
    try {
      const ext = path.extname(filePath).toLowerCase()
      if (['.txt', '.md', '.json', '.csv', '.xml', '.yaml', '.yml'].includes(ext)) {
        const text = fs.readFileSync(filePath, 'utf-8').slice(0, maxChars)
        resolve({
          success: true, filePath, fileName: path.basename(filePath),
          fileType: ext.slice(1), text, meta: { charCount: text.length },
        } as ParsedFileData)
      } else {
        resolve({
          success: true, filePath, fileName: path.basename(filePath),
          fileType: ext.slice(1), text: `[需要通过 fileIntel:parseFile 解析 ${ext} 文件]`,
          meta: {},
        } as ParsedFileData)
      }
    } catch (err) {
      resolve({
        success: false, filePath, fileName: path.basename(filePath),
        fileType: 'unknown', text: '', meta: {},
        error: (err as Error).message,
      } as ParsedFileData & { error: string })
    }
  })
}

// ────────────────────── 管道引擎 ──────────────────────

export async function executePipeline(config: PipelineConfig): Promise<PipelineResult> {
  const startTime = Date.now()
  const stepResults: PipelineStepResult[] = []
  const outputFiles: string[] = []
  let currentData: unknown = null
  let completedSteps = 0

  for (let i = 0; i < config.steps.length; i++) {
    const step = config.steps[i]
    const stepResult: PipelineStepResult = {
      stepIndex: i,
      type: step.type,
      label: step.label,
      status: 'running',
    }
    stepResults.push(stepResult)
    emitProgress(stepResult)

    const stepStart = Date.now()
    try {
      switch (step.type) {
        case 'read':
          currentData = await stepRead(step.params)
          break

        case 'read_dir':
          currentData = await stepReadDir(step.params)
          break

        case 'ai_process':
          currentData = await stepAiProcess(step.params, currentData, config, stepResult)
          break

        case 'ai_each':
          currentData = await stepAiEach(step.params, currentData, config, stepResult)
          break

        case 'transform':
          currentData = stepTransform(step.params, currentData)
          break

        case 'generate':
          currentData = await stepGenerate(step.params, currentData, outputFiles)
          break

        case 'open':
          await stepOpen(outputFiles)
          break
      }

      stepResult.status = 'done'
      stepResult.output = summarizeOutput(currentData)
      stepResult.durationMs = Date.now() - stepStart
      completedSteps++
    } catch (err) {
      stepResult.status = 'error'
      stepResult.error = (err as Error).message
      stepResult.durationMs = Date.now() - stepStart
      emitProgress(stepResult)

      return {
        success: false,
        name: config.name,
        totalSteps: config.steps.length,
        completedSteps,
        stepResults,
        outputFiles,
        totalDurationMs: Date.now() - startTime,
        error: `步骤 ${i + 1}（${step.label}）失败: ${(err as Error).message}`,
      }
    }

    emitProgress(stepResult)
  }

  return {
    success: true,
    name: config.name,
    totalSteps: config.steps.length,
    completedSteps,
    stepResults,
    outputFiles,
    totalDurationMs: Date.now() - startTime,
  }
}

// ────────────────────── Step: read ──────────────────────

async function stepRead(params: Record<string, unknown>): Promise<ParsedFileData[]> {
  const files = params.files as string[] ?? []
  const maxChars = (params.maxChars as number) ?? 200000
  const results: ParsedFileData[] = []

  for (const filePath of files) {
    if (!isReadPathAllowed(filePath)) {
      results.push({
        success: false, filePath, fileName: path.basename(filePath),
        fileType: 'unknown', text: '', meta: { error: '路径不在允许的目录中' },
      } as ParsedFileData)
      continue
    }
    if (!fs.existsSync(filePath)) {
      results.push({
        success: false, filePath, fileName: path.basename(filePath),
        fileType: 'unknown', text: '', meta: {},
      } as ParsedFileData)
      continue
    }
    const parsed = await parseFile(filePath, maxChars)
    results.push(parsed)
  }

  return results
}

// ────────────────────── Step: read_dir ──────────────────────

async function stepReadDir(params: Record<string, unknown>): Promise<ParsedFileData[]> {
  const dirPath = params.dirPath as string
  const fileTypes = params.fileTypes as string[] | undefined
  const maxFiles = (params.maxFiles as number) ?? 50
  const maxChars = (params.maxChars as number) ?? 100000

  if (!dirPath || !isReadPathAllowed(dirPath)) {
    throw new Error(`目录不在允许的目录中: ${dirPath}`)
  }
  if (!fs.existsSync(dirPath)) {
    throw new Error(`目录不存在: ${dirPath}`)
  }

  const extFilter = fileTypes
    ? fileTypes.map(t => t.startsWith('.') ? t : `.${t}`)
    : ['.xlsx', '.xls', '.csv', '.docx', '.pdf', '.txt', '.md', '.json']

  const entries = fs.readdirSync(dirPath)
    .filter(f => {
      const ext = path.extname(f).toLowerCase()
      return extFilter.includes(ext) && !f.startsWith('.') && !f.startsWith('~$')
    })
    .slice(0, maxFiles)

  const results: ParsedFileData[] = []
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry)
    const parsed = await parseFile(fullPath, maxChars)
    results.push(parsed)
  }

  return results
}

// ────────────────────── Step: ai_process ──────────────────────

async function stepAiProcess(
  params: Record<string, unknown>,
  currentData: unknown,
  config: PipelineConfig,
  stepResult: PipelineStepResult,
): Promise<unknown> {
  const agentUrl = (params.agentBaseUrl as string) || config.agentBaseUrl
  if (!agentUrl) throw new Error('ai_process 步骤需要 agentBaseUrl')

  const prompt = params.prompt as string ?? '请分析以下内容：'
  const outputFormat = params.outputFormat as string ?? 'text'

  // 将当前数据序列化为文本输入
  const inputText = serializeForAgent(currentData, params)

  const fullPrompt = `${prompt}\n\n---\n${inputText}\n---\n\n${
    outputFormat === 'json' ? '请以 JSON 格式返回结果。' : ''
  }`

  stepResult.itemProgress = { current: 0, total: 1 }
  emitProgress(stepResult)

  const result = await callAgent(agentUrl, fullPrompt, config.agentHeaders)

  stepResult.itemProgress = { current: 1, total: 1 }

  if (outputFormat === 'json') {
    try {
      const jsonMatch = result.answer.match(/```json\s*([\s\S]*?)```/)
        ?? result.answer.match(/\{[\s\S]*\}/)
        ?? result.answer.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] ?? jsonMatch[0])
      }
    } catch { /* 返回原始文本 */ }
  }

  return { answer: result.answer, rawData: result.data }
}

// ────────────────────── Step: ai_each ──────────────────────

async function stepAiEach(
  params: Record<string, unknown>,
  currentData: unknown,
  config: PipelineConfig,
  stepResult: PipelineStepResult,
): Promise<unknown[]> {
  const agentUrl = (params.agentBaseUrl as string) || config.agentBaseUrl
  if (!agentUrl) throw new Error('ai_each 步骤需要 agentBaseUrl')

  const prompt = params.prompt as string ?? '请分析以下内容：'
  const outputFormat = params.outputFormat as string ?? 'text'
  const concurrency = Math.min((params.concurrency as number) ?? 1, 3)

  const items = normalizeToArray(currentData)
  const results: unknown[] = []

  stepResult.itemProgress = { current: 0, total: items.length }
  emitProgress(stepResult)

  if (concurrency <= 1) {
    for (let i = 0; i < items.length; i++) {
      const itemText = serializeForAgent(items[i], params)
      const fullPrompt = `${prompt}\n\n---\n第 ${i + 1}/${items.length} 项：\n${itemText}\n---`

      try {
        const result = await callAgent(agentUrl, fullPrompt, config.agentHeaders)
        results.push({
          index: i,
          input: summarizeOutput(items[i]),
          answer: result.answer,
          success: true,
        })
      } catch (err) {
        results.push({
          index: i,
          input: summarizeOutput(items[i]),
          error: (err as Error).message,
          success: false,
        })
      }

      stepResult.itemProgress = { current: i + 1, total: items.length }
      emitProgress(stepResult)
    }
  } else {
    // 并发处理
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency)
      const batchResults = await Promise.allSettled(
        batch.map((item, j) => {
          const idx = i + j
          const itemText = serializeForAgent(item, params)
          const fullPrompt = `${prompt}\n\n---\n第 ${idx + 1}/${items.length} 项：\n${itemText}\n---`
          return callAgent(agentUrl, fullPrompt, config.agentHeaders)
            .then(r => ({ index: idx, input: summarizeOutput(item), answer: r.answer, success: true }))
        }),
      )

      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          results.push(r.value)
        } else {
          results.push({ success: false, error: r.reason?.message ?? '未知错误' })
        }
      }

      stepResult.itemProgress = { current: Math.min(i + concurrency, items.length), total: items.length }
      emitProgress(stepResult)
    }
  }

  return results
}

// ────────────────────── Step: transform ──────────────────────

function stepTransform(
  params: Record<string, unknown>,
  currentData: unknown,
): unknown {
  const operation = params.operation as string

  switch (operation) {
    case 'filter': {
      const arr = normalizeToArray(currentData)
      const field = params.field as string
      const value = params.value as string
      if (field && value) {
        return arr.filter((item: any) => {
          const v = item[field] ?? item.text ?? ''
          return String(v).includes(value)
        })
      }
      return arr.filter((item: any) => item.success !== false)
    }

    case 'merge_text': {
      const arr = normalizeToArray(currentData)
      return arr.map((item: any, i: number) => {
        const name = item.fileName ?? item.input ?? `第${i + 1}项`
        const text = item.text ?? item.answer ?? JSON.stringify(item)
        return `=== ${name} ===\n${text}`
      }).join('\n\n')
    }

    case 'extract_answers': {
      const arr = normalizeToArray(currentData)
      return arr
        .filter((item: any) => item.success && item.answer)
        .map((item: any) => ({
          input: item.input,
          answer: item.answer,
          index: item.index,
        }))
    }

    case 'to_table': {
      const arr = normalizeToArray(currentData)
      return arr.map((item: any, i: number) => {
        if (typeof item === 'object' && item !== null) return item
        return { index: i, value: String(item) }
      })
    }

    case 'flatten_tables': {
      const arr = normalizeToArray(currentData)
      const allRows: Record<string, string>[] = []
      for (const item of arr) {
        if ((item as ParsedFileData).tables) {
          for (const table of (item as ParsedFileData).tables ?? []) {
            allRows.push(...table)
          }
        }
      }
      return allRows
    }

    case 'custom': {
      // 安全限制: 自定义 JS 表达式已禁用（new Function 存在代码注入风险）
      return currentData
    }

    default:
      return currentData
  }
}

// ────────────────────── Step: generate ──────────────────────

async function stepGenerate(
  params: Record<string, unknown>,
  currentData: unknown,
  outputFiles: string[],
): Promise<unknown> {
  const format = (params.format as string) ?? 'xlsx'
  const title = (params.title as string) ?? 'MBE AI 分析报告'
  const outputDir = (params.outputDir as string) ?? getExportsDir()
  const theme = (params.theme as string) ?? 'mbe'
  const fileName = (params.fileName as string) ?? generateFileName(format, title.slice(0, 10))
  if (!isWritePathAllowed(outputDir)) {
    throw new Error(`输出目录不在允许的目录中: ${outputDir}`)
  }
  const filePath = path.join(outputDir, fileName)

  let buffer: Buffer

  switch (format) {
    case 'xlsx':
      buffer = await generateXlsx(buildXlsxPayload(currentData, title, theme), undefined)
      break

    case 'docx':
      buffer = await generateDocx(buildDocxPayload(currentData, title, theme), undefined)
      break

    case 'pptx':
      buffer = await generatePptx(buildPptxPayload(currentData, title), undefined)
      break

    case 'json': {
      const json = JSON.stringify(currentData, null, 2)
      fs.writeFileSync(filePath, json, 'utf-8')
      outputFiles.push(filePath)
      return { filePath, fileSize: json.length, format: 'json' }
    }

    case 'csv': {
      const csv = buildCsvContent(currentData)
      fs.writeFileSync(filePath, csv, 'utf-8')
      outputFiles.push(filePath)
      return { filePath, fileSize: csv.length, format: 'csv' }
    }

    default:
      throw new Error(`不支持的输出格式: ${format}`)
  }

  fs.writeFileSync(filePath, buffer)
  const stats = fs.statSync(filePath)
  outputFiles.push(filePath)

  return {
    filePath,
    fileSize: stats.size,
    fileSizeHuman: humanSize(stats.size),
    format,
  }
}

// ────────────────────── Step: open ──────────────────────

async function stepOpen(outputFiles: string[]): Promise<void> {
  for (const f of outputFiles) {
    if (isReadPathAllowed(f) && fs.existsSync(f)) {
      await shell.openPath(f)
    }
  }
}

// ────────────────────── 数据序列化 ──────────────────────

function serializeForAgent(data: unknown, params?: Record<string, unknown>): string {
  if (typeof data === 'string') return data.slice(0, 50000)

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0]
    // ParsedFileData 数组
    if (first && typeof first === 'object' && 'text' in first) {
      return (data as ParsedFileData[]).map(f =>
        `【${f.fileName}】\n${f.text?.slice(0, 10000) ?? ''}`
      ).join('\n\n---\n\n').slice(0, 50000)
    }
    // 通用对象数组
    return JSON.stringify(data, null, 2).slice(0, 50000)
  }

  if (typeof data === 'object' && data !== null) {
    if ('text' in data) return (data as ParsedFileData).text?.slice(0, 50000) ?? ''
    return JSON.stringify(data, null, 2).slice(0, 50000)
  }

  return String(data).slice(0, 50000)
}

function normalizeToArray(data: unknown): any[] {
  if (Array.isArray(data)) return data
  if (typeof data === 'object' && data !== null) return [data]
  if (typeof data === 'string') return [{ text: data }]
  return []
}

function summarizeOutput(data: unknown): unknown {
  if (typeof data === 'string') return data.slice(0, 500)
  if (Array.isArray(data)) return { type: 'array', count: data.length }
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (obj.filePath) return { filePath: obj.filePath, fileSize: obj.fileSize }
    if (obj.answer) return { answer: (obj.answer as string).slice(0, 200) }
    return { type: 'object', keys: Object.keys(obj).slice(0, 10) }
  }
  return data
}

// ────────────────────── DocGen Payload 构建 ──────────────────────

function buildXlsxPayload(data: unknown, title: string, theme: string): Record<string, unknown> {
  const items = normalizeToArray(data)

  // 如果是 AI 逐项处理结果
  if (items.length > 0 && items[0]?.answer) {
    return {
      title,
      theme,
      sheets: [{
        name: '分析结果',
        headers: [
          { text: '序号', width: 8 },
          { text: '输入', width: 30 },
          { text: 'AI 分析结果', width: 60 },
          { text: '状态', width: 10 },
        ],
        rows: items.map((item: any, i: number) => ({
          序号: i + 1,
          输入: String(item.input ?? ''),
          'AI 分析结果': String(item.answer ?? item.error ?? ''),
          状态: item.success ? '完成' : '失败',
        })),
        autoFilter: true,
      }],
    }
  }

  // 如果是表格数据
  if (items.length > 0 && typeof items[0] === 'object' && !items[0]?.text) {
    const keys = Object.keys(items[0]).slice(0, 20)
    return {
      title,
      theme,
      sheets: [{
        name: '数据',
        headers: keys.map(k => ({ text: k, width: Math.max(k.length * 2 + 4, 15) })),
        rows: items.map((item: any) => {
          const row: Record<string, string> = {}
          for (const k of keys) row[k] = String(item[k] ?? '')
          return row
        }),
        autoFilter: true,
      }],
    }
  }

  // 通用：单列文本
  return {
    title,
    theme,
    sheets: [{
      name: '结果',
      headers: [{ text: '序号', width: 8 }, { text: '内容', width: 80 }],
      rows: items.map((item: any, i: number) => ({
        序号: i + 1,
        内容: typeof item === 'string' ? item : JSON.stringify(item).slice(0, 2000),
      })),
    }],
  }
}

function buildDocxPayload(data: unknown, title: string, theme: string): Record<string, unknown> {
  const items = normalizeToArray(data)
  const sections: Record<string, unknown>[] = []

  if (items.length > 0 && items[0]?.answer) {
    for (const item of items) {
      if (item.input) {
        sections.push({ type: 'heading', level: 2, text: String(item.input) })
      }
      if (item.answer) {
        // 将 AI 回答按段落拆分
        const paras = String(item.answer).split('\n').filter((s: string) => s.trim())
        for (const p of paras) {
          if (p.startsWith('# ') || p.startsWith('## ') || p.startsWith('### ')) {
            const hLevel = p.startsWith('### ') ? 3 : p.startsWith('## ') ? 2 : 1
            sections.push({ type: 'heading', level: hLevel, text: p.replace(/^#+\s*/, '') })
          } else if (p.startsWith('- ') || p.startsWith('* ')) {
            sections.push({ type: 'bullets', items: [p.replace(/^[-*]\s*/, '')] })
          } else {
            sections.push({ type: 'paragraph', text: p })
          }
        }
        sections.push({ type: 'pagebreak' })
      }
    }
  } else if (typeof data === 'string') {
    const paras = data.split('\n').filter(s => s.trim())
    for (const p of paras) {
      sections.push({ type: 'paragraph', text: p })
    }
  } else {
    sections.push({
      type: 'paragraph',
      text: JSON.stringify(data, null, 2),
    })
  }

  return {
    title,
    theme,
    author: 'MBE AI 专家',
    date: new Date().toLocaleDateString('zh-CN'),
    hasToc: sections.length > 5,
    sections,
  }
}

function buildPptxPayload(data: unknown, title: string): Record<string, unknown> {
  const items = normalizeToArray(data)
  return {
    title,
    slides: items.slice(0, 20).map((item: any, i: number) => ({
      title: item.input ?? `第 ${i + 1} 项`,
      content: item.answer ?? (typeof item === 'string' ? item : JSON.stringify(item)),
    })),
  }
}

function buildCsvContent(data: unknown): string {
  const items = normalizeToArray(data)
  if (items.length === 0) return ''

  const first = items[0]
  if (typeof first !== 'object' || first === null) {
    return items.map(String).join('\n')
  }

  const keys = Object.keys(first)
  const header = keys.map(k => `"${k}"`).join(',')
  const rows = items.map((item: any) =>
    keys.map(k => `"${String(item[k] ?? '').replace(/"/g, '""')}"`).join(','),
  )
  return [header, ...rows].join('\n')
}

// ────────────────────── 预置管道模板 ──────────────────────

export function getPipelineTemplates(): Record<string, Omit<PipelineConfig, 'agentBaseUrl' | 'agentHeaders'>> {
  return {
    'contract-review': {
      name: '合同批量审查',
      description: '读取目录下所有合同 → 逐个送法律 Agent 审查 → 生成审查报告',
      steps: [
        { type: 'read_dir', label: '读取合同文件', params: { fileTypes: ['docx', 'pdf'] } },
        { type: 'ai_each', label: 'AI 逐份审查', params: { prompt: '请审查以下合同，识别风险条款、缺失条款、不合理条款，标注风险等级（高/中/低），并给出修改建议。' } },
        { type: 'generate', label: '生成审查报告', params: { format: 'docx', title: '合同批量审查报告' } },
        { type: 'open', label: '打开报告', params: {} },
      ],
    },
    'invoice-summary': {
      name: '发票汇总入账',
      description: '读取发票 PDF → AI 识别发票信息 → 汇总到 Excel',
      steps: [
        { type: 'read_dir', label: '读取发票文件', params: { fileTypes: ['pdf', 'jpg', 'png'] } },
        { type: 'ai_each', label: 'AI 识别发票', params: { prompt: '请从以下内容中提取发票信息，返回 JSON 格式：{发票号, 日期, 卖方, 金额, 税额, 类型}', outputFormat: 'json' } },
        { type: 'transform', label: '提取成功项', params: { operation: 'filter' } },
        { type: 'generate', label: '生成汇总表', params: { format: 'xlsx', title: '发票汇总表' } },
        { type: 'open', label: '打开汇总表', params: {} },
      ],
    },
    'customer-analysis': {
      name: '客户名单分析',
      description: '读取客户名单 Excel → AI 分析每个客户 → 生成跟进方案 Word',
      steps: [
        { type: 'read', label: '读取客户名单', params: {} },
        { type: 'transform', label: '提取表格数据', params: { operation: 'flatten_tables' } },
        { type: 'ai_each', label: 'AI 分析客户', params: { prompt: '请分析以下客户信息，给出客户画像、跟进优先级（高/中/低）、推荐跟进策略和话术要点。' } },
        { type: 'generate', label: '生成跟进方案', params: { format: 'docx', title: '客户跟进方案' } },
        { type: 'open', label: '打开方案', params: {} },
      ],
    },
    'financial-analysis': {
      name: '财务报表分析',
      description: '读取财务 Excel → AI 分析财务状况 → 生成分析报告',
      steps: [
        { type: 'read', label: '读取财务报表', params: {} },
        { type: 'ai_process', label: 'AI 财务分析', params: { prompt: '请对以下财务数据进行全面分析，包括：1.关键财务指标计算 2.同比/环比变动分析 3.风险提示 4.优化建议。请用专业财务语言。' } },
        { type: 'generate', label: '生成分析报告', params: { format: 'docx', title: '财务分析报告' } },
        { type: 'open', label: '打开报告', params: {} },
      ],
    },
    'document-translation': {
      name: '文档翻译',
      description: '读取 Word/PDF → AI 翻译 → 生成新文档',
      steps: [
        { type: 'read', label: '读取原文档', params: {} },
        { type: 'ai_process', label: 'AI 翻译', params: { prompt: '请将以下中文内容翻译为专业英文，保持原有格式和段落结构。' } },
        { type: 'generate', label: '生成译文', params: { format: 'docx', title: '翻译文档' } },
        { type: 'open', label: '打开译文', params: {} },
      ],
    },
    'multi-file-merge': {
      name: '多文件合并汇总',
      description: '读取目录下所有表格 → 合并 → 输出汇总 Excel',
      steps: [
        { type: 'read_dir', label: '读取所有表格', params: { fileTypes: ['xlsx', 'csv'] } },
        { type: 'transform', label: '合并表格数据', params: { operation: 'flatten_tables' } },
        { type: 'generate', label: '生成汇总表', params: { format: 'xlsx', title: '数据汇总表' } },
        { type: 'open', label: '打开汇总表', params: {} },
      ],
    },
  }
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupDataPipelineIPC(): void {
  ipcMain.handle('dataPipeline:execute', async (_, config: PipelineConfig): Promise<PipelineResult> => {
    return executePipeline(config)
  })

  ipcMain.handle('dataPipeline:templates', (): Record<string, unknown> => {
    return getPipelineTemplates()
  })

  ipcMain.handle('dataPipeline:executeTemplate', async (
    _, templateId: string, overrides: Partial<PipelineConfig>,
  ): Promise<PipelineResult> => {
    const templates = getPipelineTemplates()
    const template = templates[templateId]
    if (!template) {
      return {
        success: false, name: templateId, totalSteps: 0, completedSteps: 0,
        stepResults: [], outputFiles: [], totalDurationMs: 0,
        error: `未知管道模板: ${templateId}`,
      }
    }

    const config: PipelineConfig = {
      ...template,
      ...overrides,
      steps: overrides.steps ?? template.steps,
    }

    return executePipeline(config)
  })
}
