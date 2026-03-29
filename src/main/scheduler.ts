// Scheduler — 定时任务 + 文件监控 + 系统通知 引擎
// Phase 5: 将 MBE Desktop 从被动应答升级为主动式 AI 助手
//
// 三大能力：
//   1. Cron 定时任务 — node-cron 驱动，用户说"每周一提醒我审查到期合同"
//   2. 文件监控 — chokidar 驱动，用户说"有新发票到 Downloads 时自动识别入账"
//   3. 系统通知 — Electron Notification，不只是应用内 Toast，桌面级弹窗

import { ipcMain, Notification, BrowserWindow, shell, app } from 'electron'
import cron from 'node-cron'
import chokidar from 'chokidar'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import { isReadPathAllowed, isSafeUrl } from './safe-path'

type CronScheduledTask = ReturnType<typeof cron.schedule>
type ChokidarFSWatcher = ReturnType<typeof chokidar.watch>

// ────────────────────── 类型定义 ──────────────────────

export type ScheduledJobType = 'cron' | 'watch' | 'once'

export type JobStatus = 'active' | 'paused' | 'completed' | 'failed'

export interface ScheduledJob {
  id: string
  type: ScheduledJobType
  label: string
  /** cron 表达式（type=cron 时必填），如 "0 9 * * 1" = 每周一 9 点 */
  cronExpr?: string
  /** 监控路径（type=watch 时必填） */
  watchPath?: string
  /** 监控的文件类型过滤 */
  watchFileTypes?: string[]
  /** 一次性延迟执行（type=once，毫秒） */
  delayMs?: number
  /** 触发时的回调动作 */
  action: ScheduledAction
  /** 关联的方案 / 会话 */
  solutionId?: string
  conversationId?: string
  status: JobStatus
  /** 执行次数 */
  runCount: number
  /** 最后一次运行的时间戳 */
  lastRunAt?: string
  /** 下次预计运行时间（cron 类型） */
  nextRunAt?: string
  createdAt: string
  updatedAt: string
}

export type ScheduledActionType =
  | 'notify'          // 发系统通知
  | 'agent_query'     // 调用 Agent 咨询
  | 'pipeline'        // 触发数据管道
  | 'open_app'        // 打开文件/应用
  | 'custom_ipc'      // 发自定义 IPC 事件到 renderer

export interface ScheduledAction {
  type: ScheduledActionType
  params: Record<string, unknown>
}

export interface NotifyRequest {
  title: string
  body: string
  icon?: string
  /** 点击通知时执行的动作 */
  onClick?: { type: 'open_url' | 'open_file' | 'focus_app' | 'navigate'; target: string }
  /** 是否同时发到 renderer 作为应用内 Toast */
  alsoToast?: boolean
  urgency?: 'normal' | 'critical' | 'low'
}

interface CreateJobRequest {
  type: ScheduledJobType
  label: string
  cronExpr?: string
  watchPath?: string
  watchFileTypes?: string[]
  delayMs?: number
  action: ScheduledAction
  solutionId?: string
  conversationId?: string
}

export interface JobExecutionResult {
  jobId: string
  timestamp: string
  success: boolean
  output?: unknown
  error?: string
}

// ────────────────────── Module State ──────────────────────

let mainWindow: BrowserWindow | null = null
const activeJobs = new Map<string, {
  job: ScheduledJob
  cronTask?: CronScheduledTask
  watcher?: ChokidarFSWatcher
  timer?: ReturnType<typeof setTimeout>
}>()

let dbAdapter: {
  exec: (sql: string) => void
  prepare: (sql: string) => {
    all: (...args: unknown[]) => Record<string, unknown>[]
    get: (...args: unknown[]) => Record<string, unknown> | undefined
    run: (...args: unknown[]) => { changes: number }
  }
} | null = null

// ────────────────────── 模块初始化 ──────────────────────

export function setSchedulerMainWindow(win: BrowserWindow): void {
  mainWindow = win
}

export function setSchedulerDb(db: typeof dbAdapter): void {
  dbAdapter = db
}

function emitToRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

// ────────────────────── 系统通知 ──────────────────────

function sendSystemNotification(req: NotifyRequest): void {
  if (!Notification.isSupported()) {
    console.warn('[Scheduler] 系统通知不可用，降级为应用内 Toast')
    emitToRenderer('scheduler:toast', { title: req.title, body: req.body, urgency: req.urgency })
    return
  }

  const iconPath = getNotificationIcon()
  const notification = new Notification({
    title: req.title,
    body: req.body,
    icon: iconPath || undefined,
    urgency: req.urgency ?? 'normal',
    silent: req.urgency === 'low',
  })

  notification.on('click', () => {
    if (req.onClick) {
      handleNotificationClick(req.onClick)
    } else {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    }
  })

  notification.show()

  if (req.alsoToast !== false) {
    emitToRenderer('scheduler:toast', {
      title: req.title,
      body: req.body,
      urgency: req.urgency,
      onClick: req.onClick,
    })
  }
}

function getNotificationIcon(): string {
  const candidates = [
    path.join(app.getAppPath(), 'resources', 'icon.png'),
    path.join(app.getAppPath(), 'build', 'icon.png'),
    path.join(__dirname, '..', 'renderer', 'favicon.png'),
  ]
  return candidates.find(p => fs.existsSync(p)) ?? ''
}

function handleNotificationClick(onClick: NonNullable<NotifyRequest['onClick']>): void {
  switch (onClick.type) {
    case 'open_url':
      if (isSafeUrl(onClick.target)) {
        shell.openExternal(onClick.target)
      }
      break
    case 'open_file':
      if (isReadPathAllowed(onClick.target)) {
        shell.openPath(path.resolve(onClick.target))
      }
      break
    case 'navigate':
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
        const ALLOWED_ROUTES = ['/', '/settings', '/pick', '/migrate', '/data-source-setup', '/copilot', '/kb-graph', '/deepmind']
        const ALLOWED_PREFIXES = ['/solution/', '/analytics/']
        const safeRoute = String(onClick.target).replace(/[^a-zA-Z0-9/\-_]/g, '')
        const routeAllowed = ALLOWED_ROUTES.includes(safeRoute)
          || ALLOWED_PREFIXES.some(p => safeRoute.startsWith(p))
        if (!routeAllowed) break
        emitToRenderer('scheduler:navigate', { route: safeRoute })
      }
      break
    case 'focus_app':
    default:
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
      break
  }
}

// ────────────────────── 任务执行 ──────────────────────

async function executeJobAction(job: ScheduledJob, triggerData?: unknown): Promise<JobExecutionResult> {
  const result: JobExecutionResult = {
    jobId: job.id,
    timestamp: new Date().toISOString(),
    success: false,
  }

  try {
    const { action } = job
    switch (action.type) {
      case 'notify': {
        sendSystemNotification({
          title: (action.params.title as string) ?? job.label,
          body: (action.params.body as string) ?? '',
          urgency: (action.params.urgency as NotifyRequest['urgency']) ?? 'normal',
          onClick: action.params.onClick as NotifyRequest['onClick'],
          alsoToast: action.params.alsoToast as boolean ?? true,
        })
        result.success = true
        result.output = { notified: true }
        break
      }

      case 'agent_query': {
        const agentUrl = (action.params.agentBaseUrl as string) ?? 'http://localhost:8002'
        const query = (action.params.query as string) ?? job.label
        const expert = action.params.expert as string | undefined

        // 将查询通知到 renderer 并期望它发起聊天
        emitToRenderer('scheduler:agentQuery', {
          jobId: job.id,
          label: job.label,
          agentBaseUrl: agentUrl,
          query,
          expert,
          solutionId: job.solutionId,
          conversationId: job.conversationId,
          triggerData,
        })
        result.success = true
        result.output = { queued: true, query }
        break
      }

      case 'pipeline': {
        emitToRenderer('scheduler:pipelineTrigger', {
          jobId: job.id,
          label: job.label,
          pipelineConfig: action.params.pipeline_config,
          templateId: action.params.template_id,
          triggerData,
        })
        result.success = true
        result.output = { triggered: true }
        break
      }

      case 'open_app': {
        const target = (action.params.target as string) ?? ''
        if (target && isReadPathAllowed(target)) {
          await shell.openPath(path.resolve(target))
          result.success = true
          result.output = { opened: target }
        } else {
          result.error = target ? '路径不在允许的目录中' : '缺少目标路径'
        }
        break
      }

      case 'custom_ipc': {
        const channel = (action.params.channel as string) ?? 'scheduler:custom'
        emitToRenderer(channel, {
          jobId: job.id,
          ...action.params.data as Record<string, unknown>,
          triggerData,
        })
        result.success = true
        result.output = { emitted: channel }
        break
      }

      default:
        throw new Error(`未知的 action 类型: ${action.type}`)
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  }

  // 更新任务状态
  const entry = activeJobs.get(job.id)
  if (entry) {
    entry.job.runCount += 1
    entry.job.lastRunAt = result.timestamp
    entry.job.updatedAt = result.timestamp
    if (job.type === 'once') {
      entry.job.status = result.success ? 'completed' : 'failed'
    }
    persistJob(entry.job)
  }

  emitToRenderer('scheduler:jobExecuted', result)
  return result
}

// ────────────────────── Cron 调度 ──────────────────────

function startCronJob(job: ScheduledJob): CronScheduledTask | null {
  if (!job.cronExpr || !cron.validate(job.cronExpr)) {
    console.error(`[Scheduler] 无效 cron 表达式: ${job.cronExpr}`)
    return null
  }

  const task = cron.schedule(job.cronExpr, () => {
    executeJobAction(job)
  }, {
    timezone: 'Asia/Shanghai',
  })

  return task
}

// ────────────────────── 文件监控 ──────────────────────

function startFileWatcher(job: ScheduledJob): ChokidarFSWatcher | null {
  if (!job.watchPath) {
    console.error('[Scheduler] watch 类型任务缺少 watchPath')
    return null
  }

  if (!isReadPathAllowed(job.watchPath)) {
    console.error(`[Scheduler] watchPath 不在允许的目录中: ${job.watchPath}`)
    return null
  }

  if (!fs.existsSync(job.watchPath)) {
    try {
      fs.mkdirSync(job.watchPath, { recursive: true })
    } catch {
      console.error(`[Scheduler] 无法创建监控目录: ${job.watchPath}`)
      return null
    }
  }

  const extensions = (job.watchFileTypes ?? []).map(t => t.startsWith('.') ? t : `.${t}`)

  const watcher = chokidar.watch(job.watchPath, {
    ignored: /(^|[/\\])\../,   // 忽略隐藏文件
    persistent: true,
    ignoreInitial: true,        // 只监听新变化
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 500,
    },
    depth: 1,
  })

  watcher.on('add', (filePath: string) => {
    if (extensions.length > 0) {
      const ext = path.extname(filePath).toLowerCase()
      if (!extensions.includes(ext)) return
    }

    const fileName = path.basename(filePath)
    console.log(`[Scheduler] 检测到新文件: ${fileName} → 触发任务 "${job.label}"`)

    executeJobAction(job, {
      event: 'file_added',
      filePath,
      fileName,
      dirPath: path.dirname(filePath),
    })
  })

  watcher.on('change', (filePath: string) => {
    if (extensions.length > 0) {
      const ext = path.extname(filePath).toLowerCase()
      if (!extensions.includes(ext)) return
    }

    if (job.action.params.watchChange === true) {
      executeJobAction(job, {
        event: 'file_changed',
        filePath,
        fileName: path.basename(filePath),
        dirPath: path.dirname(filePath),
      })
    }
  })

  watcher.on('error', (err: unknown) => {
    console.error(`[Scheduler] 文件监控错误 (${job.watchPath}):`, err instanceof Error ? err.message : err)
  })

  return watcher
}

// ────────────────────── 一次性延迟任务 ──────────────────────

function startOnceTimer(job: ScheduledJob): ReturnType<typeof setTimeout> | null {
  const delayMs = job.delayMs ?? 0
  if (delayMs <= 0) {
    executeJobAction(job)
    return null
  }

  return setTimeout(() => {
    executeJobAction(job)
  }, delayMs)
}

// ────────────────────── CRUD ──────────────────────

function createJob(req: CreateJobRequest): ScheduledJob {
  const now = new Date().toISOString()
  const job: ScheduledJob = {
    id: randomUUID(),
    type: req.type,
    label: req.label,
    cronExpr: req.cronExpr,
    watchPath: req.watchPath,
    watchFileTypes: req.watchFileTypes,
    delayMs: req.delayMs,
    action: req.action,
    solutionId: req.solutionId,
    conversationId: req.conversationId,
    status: 'active',
    runCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  // 启动
  let cronTask: CronScheduledTask | undefined
  let watcher: ChokidarFSWatcher | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  switch (job.type) {
    case 'cron':
      cronTask = startCronJob(job) ?? undefined
      if (!cronTask) {
        job.status = 'failed'
      }
      break
    case 'watch':
      watcher = startFileWatcher(job) ?? undefined
      if (!watcher) {
        job.status = 'failed'
      }
      break
    case 'once':
      timer = startOnceTimer(job) ?? undefined
      break
  }

  activeJobs.set(job.id, { job, cronTask, watcher, timer })
  persistJob(job)

  return job
}

function pauseJob(jobId: string): boolean {
  const entry = activeJobs.get(jobId)
  if (!entry || entry.job.status !== 'active') return false

  if (entry.cronTask) entry.cronTask.stop()
  if (entry.watcher) entry.watcher.close()
  if (entry.timer) clearTimeout(entry.timer)

  entry.job.status = 'paused'
  entry.job.updatedAt = new Date().toISOString()
  persistJob(entry.job)
  return true
}

function resumeJob(jobId: string): boolean {
  const entry = activeJobs.get(jobId)
  if (!entry || entry.job.status !== 'paused') return false

  switch (entry.job.type) {
    case 'cron':
      if (entry.cronTask) {
        entry.cronTask.start()
      } else {
        entry.cronTask = startCronJob(entry.job) ?? undefined
      }
      break
    case 'watch':
      entry.watcher = startFileWatcher(entry.job) ?? undefined
      break
    case 'once':
      entry.timer = startOnceTimer(entry.job) ?? undefined
      break
  }

  entry.job.status = 'active'
  entry.job.updatedAt = new Date().toISOString()
  persistJob(entry.job)
  return true
}

function deleteJob(jobId: string): boolean {
  const entry = activeJobs.get(jobId)
  if (!entry) return false

  if (entry.cronTask) entry.cronTask.stop()
  if (entry.watcher) entry.watcher.close()
  if (entry.timer) clearTimeout(entry.timer)

  activeJobs.delete(jobId)
  removeJobFromDb(jobId)
  return true
}

function listJobs(solutionId?: string): ScheduledJob[] {
  const jobs: ScheduledJob[] = []
  for (const entry of activeJobs.values()) {
    if (solutionId && entry.job.solutionId !== solutionId) continue
    jobs.push({ ...entry.job })
  }
  return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function getJob(jobId: string): ScheduledJob | null {
  const entry = activeJobs.get(jobId)
  return entry ? { ...entry.job } : null
}

// ────────────────────── 持久化（SQLite） ──────────────────────

function persistJob(job: ScheduledJob): void {
  if (!dbAdapter) return
  try {
    dbAdapter.prepare(`
      INSERT OR REPLACE INTO scheduled_jobs
        (id, type, label, cron_expr, watch_path, watch_file_types, delay_ms,
         action_json, solution_id, conversation_id, status, run_count,
         last_run_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id, job.type, job.label, job.cronExpr ?? null,
      job.watchPath ?? null,
      job.watchFileTypes ? JSON.stringify(job.watchFileTypes) : null,
      job.delayMs ?? null,
      JSON.stringify(job.action),
      job.solutionId ?? null, job.conversationId ?? null,
      job.status, job.runCount, job.lastRunAt ?? null,
      job.createdAt, job.updatedAt,
    )
  } catch (err) {
    console.error('[Scheduler] 持久化失败:', err)
  }
}

function removeJobFromDb(jobId: string): void {
  if (!dbAdapter) return
  try {
    dbAdapter.prepare('DELETE FROM scheduled_jobs WHERE id = ?').run(jobId)
  } catch (err) {
    console.error('[Scheduler] 删除持久化记录失败:', err)
  }
}

function loadPersistedJobs(): void {
  if (!dbAdapter) return
  try {
    const rows = dbAdapter.prepare(
      "SELECT * FROM scheduled_jobs WHERE status IN ('active', 'paused')"
    ).all()

    for (const row of rows) {
      const job: ScheduledJob = {
        id: row.id as string,
        type: row.type as ScheduledJobType,
        label: row.label as string,
        cronExpr: row.cron_expr as string | undefined,
        watchPath: row.watch_path as string | undefined,
        watchFileTypes: row.watch_file_types ? JSON.parse(row.watch_file_types as string) : undefined,
        delayMs: row.delay_ms as number | undefined,
        action: JSON.parse(row.action_json as string),
        solutionId: row.solution_id as string | undefined,
        conversationId: row.conversation_id as string | undefined,
        status: row.status as JobStatus,
        runCount: (row.run_count as number) ?? 0,
        lastRunAt: row.last_run_at as string | undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }

      let cronTask: CronScheduledTask | undefined
      let watcher: ChokidarFSWatcher | undefined

      if (job.status === 'active') {
        switch (job.type) {
          case 'cron':
            cronTask = startCronJob(job) ?? undefined
            break
          case 'watch':
            watcher = startFileWatcher(job) ?? undefined
            break
          // once 类型不恢复，已过期
        }
      }

      activeJobs.set(job.id, { job, cronTask, watcher })
    }

    if (rows.length > 0) {
      console.log(`[Scheduler] 恢复了 ${rows.length} 个持久化任务`)
    }
  } catch (err) {
    console.error('[Scheduler] 加载持久化任务失败:', err)
  }
}

// ────────────────────── Cron 预设 ──────────────────────

export interface CronPreset {
  id: string
  label: string
  cronExpr: string
  description: string
}

function getCronPresets(): CronPreset[] {
  return [
    { id: 'weekday_9am', label: '工作日早 9 点', cronExpr: '0 9 * * 1-5', description: '周一到周五每天 9:00' },
    { id: 'monday_9am', label: '每周一早 9 点', cronExpr: '0 9 * * 1', description: '每周一 9:00' },
    { id: 'friday_5pm', label: '每周五下午 5 点', cronExpr: '0 17 * * 5', description: '每周五 17:00' },
    { id: 'daily_9am', label: '每天早 9 点', cronExpr: '0 9 * * *', description: '每天 9:00' },
    { id: 'monthly_1st', label: '每月 1 号早 9 点', cronExpr: '0 9 1 * *', description: '每月 1 号 9:00' },
    { id: 'monthly_15th', label: '每月 15 号早 9 点', cronExpr: '0 9 15 * *', description: '每月 15 号 9:00' },
    { id: 'quarterly', label: '每季度首日早 9 点', cronExpr: '0 9 1 1,4,7,10 *', description: '1/4/7/10 月 1 号 9:00' },
    { id: 'every_30min', label: '每 30 分钟', cronExpr: '*/30 * * * *', description: '每隔 30 分钟' },
    { id: 'every_hour', label: '每小时', cronExpr: '0 * * * *', description: '每小时整点' },
  ]
}

// ────────────────────── 销毁 ──────────────────────

export function destroyScheduler(): void {
  for (const entry of activeJobs.values()) {
    if (entry.cronTask) entry.cronTask.stop()
    if (entry.watcher) entry.watcher.close()
    if (entry.timer) clearTimeout(entry.timer)
  }
  activeJobs.clear()
  console.log('[Scheduler] 已停止所有任务')
}

// ────────────────────── IPC 注册 ──────────────────────

export function setupSchedulerIPC(): void {
  // 创建任务
  ipcMain.handle('scheduler:create', async (_, req: CreateJobRequest) => {
    try {
      const job = createJob(req)
      return { success: true, job }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // 列出任务
  ipcMain.handle('scheduler:list', async (_, solutionId?: string) => {
    return listJobs(solutionId)
  })

  // 获取单个任务
  ipcMain.handle('scheduler:get', async (_, jobId: string) => {
    return getJob(jobId)
  })

  // 暂停任务
  ipcMain.handle('scheduler:pause', async (_, jobId: string) => {
    return { success: pauseJob(jobId) }
  })

  // 恢复任务
  ipcMain.handle('scheduler:resume', async (_, jobId: string) => {
    return { success: resumeJob(jobId) }
  })

  // 删除任务
  ipcMain.handle('scheduler:delete', async (_, jobId: string) => {
    return { success: deleteJob(jobId) }
  })

  // 手动触发（调试/测试用）
  ipcMain.handle('scheduler:trigger', async (_, jobId: string) => {
    const entry = activeJobs.get(jobId)
    if (!entry) return { success: false, error: '任务不存在' }
    const result = await executeJobAction(entry.job)
    return { success: result.success, result }
  })

  // 系统通知
  ipcMain.handle('scheduler:notify', async (_, req: NotifyRequest) => {
    sendSystemNotification(req)
    return { success: true }
  })

  // Cron 预设
  ipcMain.handle('scheduler:presets', async () => {
    return getCronPresets()
  })

  // 验证 cron 表达式
  ipcMain.handle('scheduler:validateCron', async (_, expr: string) => {
    return { valid: cron.validate(expr), expr }
  })

  // 选择监控目录
  ipcMain.handle('scheduler:selectWatchDir', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      title: '选择要监控的文件夹',
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })
}

// ────────────────────── 启动（恢复持久化任务） ──────────────────────

export function initScheduler(): void {
  loadPersistedJobs()
  console.log(`[Scheduler] 初始化完成，当前活跃任务: ${activeJobs.size}`)
}
