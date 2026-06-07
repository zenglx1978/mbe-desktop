import type {
  ElectronAccessibilityBridge,
  ElectronEcommerceCsBridge,
  ElectronInferenceBridge,
} from '@/types/api-responses'

/**
 * LocalAction Executor — Agent 指令的前端执行引擎
 *
 * 接收后端 chat_complete 中的 local_actions 列表，
 * 映射到对应的 Electron IPC 调用并执行。
 *
 * 安全等级:
 *   L0 静默 — 剪贴板写入、通知
 *   L1 通知 — 文档生成、打开应用
 *   L2 确认 — 文件读取、网页读取
 *   L3 手动 — 文件写入、CLI 执行
 */

declare const window: Window & {
  electronAPI?: {
    localApp: {
      docgen: (opts: Record<string, unknown>) => Promise<{ path: string }>
      open: (opts: Record<string, unknown>) => Promise<void>
      exec: (opts: Record<string, unknown>) => Promise<{ stdout: string }>
      detect: () => Promise<{ name: string; installed: boolean }[]>
    }
    copilot: {
      clipboard: { write: (text: string) => Promise<void> }
    }
    webReader: {
      read: (opts: Record<string, unknown>) => Promise<{ text: string; tables?: unknown[] }>
    }
    localReader: {
      read: (path: string) => Promise<{ content: string; type: string }>
    }
    fileIntel: {
      scanDir: (req: Record<string, unknown>) => Promise<unknown>
      selectDir: (title?: string) => Promise<string | null>
      parseFile: (req: Record<string, unknown>) => Promise<unknown>
      batchAnalyze: (req: Record<string, unknown>) => Promise<unknown>
      pipeline: (req: Record<string, unknown>) => Promise<unknown>
      scanAndClassify: (dirPath: string, fileTypes?: string[]) => Promise<unknown>
    }
    dataPipeline: {
      execute: (config: Record<string, unknown>) => Promise<unknown>
      executeTemplate: (templateId: string, overrides?: Record<string, unknown>) => Promise<unknown>
      templates: () => Promise<Record<string, unknown>>
      onProgress: (callback: (data: Record<string, unknown>) => void) => () => void
    }
    scheduler: {
      create: (req: Record<string, unknown>) => Promise<{ success: boolean; job?: Record<string, unknown>; error?: string }>
      list: (solutionId?: string) => Promise<Record<string, unknown>[]>
      notify: (req: Record<string, unknown>) => Promise<{ success: boolean }>
      pause: (jobId: string) => Promise<{ success: boolean }>
      resume: (jobId: string) => Promise<{ success: boolean }>
      delete: (jobId: string) => Promise<{ success: boolean }>
      trigger: (jobId: string) => Promise<{ success: boolean; result?: unknown }>
      selectWatchDir: () => Promise<string | null>
    }
    memory: {
      getProfile: () => Promise<Record<string, unknown>>
      updateProfile: (partial: Record<string, unknown>) => Promise<Record<string, unknown>>
      getPreferences: () => Promise<Record<string, unknown>>
      updatePreferences: (partial: Record<string, unknown>) => Promise<Record<string, unknown>>
      getFacts: (solutionId?: string, category?: string, limit?: number) => Promise<Record<string, unknown>[]>
      upsertFact: (fact: Record<string, unknown>) => Promise<Record<string, unknown>>
      deleteFact: (factId: string) => Promise<boolean>
      getSummary: (solutionId?: string) => Promise<Record<string, unknown>>
      getPromptText: (solutionId?: string) => Promise<string>
      learn: (userMessage: string, solutionId?: string, conversationId?: string) => Promise<unknown>
      reset: () => Promise<{ success: boolean }>
    }
    runLocalCalc: (script: string, args: Record<string, unknown>) => Promise<unknown>
    inference?: ElectronInferenceBridge
    ecommerceCs?: ElectronEcommerceCsBridge
    accessibility?: ElectronAccessibilityBridge
  }
}

// ── Types ──

export type LocalActionType =
  | 'docgen'
  | 'app_open'
  | 'app_read'
  | 'calculate'
  | 'file_read'
  | 'file_write'
  | 'web_read'
  | 'clipboard_write'
  | 'notify'
  | 'kb_query'
  | 'dir_scan'
  | 'batch_analyze'
  | 'pipeline'
  | 'schedule'
  | 'watch'
  | 'system_notify'
  | 'memory_save'
  | 'memory_recall'
  | 'offline_hint'
  | 'show_copilot_card'
  | 'accessibility_read'

export interface LocalAction {
  type: LocalActionType
  label: string
  target?: string
  params?: Record<string, unknown>
  auto_execute?: boolean
  security_level?: number
  depends_on?: number
}

export type ActionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface ActionResult {
  index: number
  action: LocalAction
  status: ActionStatus
  output?: unknown
  error?: string
}

// ── Security ──

const DEFAULT_SECURITY: Record<LocalActionType, number> = {
  clipboard_write: 0,
  notify: 0,
  kb_query: 0,
  show_copilot_card: 0,
  docgen: 1,
  app_open: 1,
  calculate: 1,
  system_notify: 1,
  memory_save: 1,
  accessibility_read: 1,
  file_read: 2,
  web_read: 2,
  app_read: 2,
  dir_scan: 2,
  batch_analyze: 2,
  pipeline: 2,
  schedule: 2,
  watch: 2,
  memory_recall: 0,
  offline_hint: 0,
  file_write: 3,
}

function effectiveSecurityLevel(action: LocalAction): number {
  return action.security_level ?? DEFAULT_SECURITY[action.type] ?? 2
}

function canAutoExecute(action: LocalAction): boolean {
  return action.auto_execute === true && effectiveSecurityLevel(action) <= 1
}

// ── Executor ──

type ProgressCallback = (result: ActionResult) => void

async function executeSingle(
  action: LocalAction,
  prevOutput?: unknown,
): Promise<unknown> {
  const api = window.electronAPI
  if (!api) throw new Error('Electron API 不可用（非桌面端）')

  switch (action.type) {
    case 'docgen': {
      const result = await api.localApp.docgen({
        format: action.params?.format ?? 'xlsx',
        fileName: action.params?.title ?? action.params?.fileName ?? '导出文档',
        data: action.params?.data ?? prevOutput ?? {},
        autoOpen: action.params?.auto_open ?? action.params?.autoOpen ?? true,
      })
      return result
    }

    case 'app_open': {
      await api.localApp.open({
        action: action.params?.action ?? 'open_app',
        target: action.target ?? '',
        ...action.params,
      })
      return { opened: action.target }
    }

    case 'clipboard_write': {
      const text = (action.params?.text as string) ?? String(prevOutput ?? '')
      await api.copilot.clipboard.write(text)
      return { copied: true, length: text.length }
    }

    case 'calculate': {
      const tool = action.params?.tool as string
      if (!tool) throw new Error('calculate 操作缺少 tool 参数')
      const { tool: _t, ...calcParams } = action.params ?? {}
      const result = await api.runLocalCalc(tool, calcParams)
      return result
    }

    case 'file_read': {
      if (!action.target) throw new Error('file_read 操作缺少 target 路径')
      const result = await api.localReader.read(action.target)
      return result
    }

    case 'web_read': {
      if (!action.target) throw new Error('web_read 操作缺少 target URL')
      const result = await api.webReader.read({
        url: action.target,
        useMainSession: action.params?.use_main_session ?? false,
      })
      return result
    }

    case 'notify': {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(
          (action.params?.title as string) ?? action.label,
          { body: (action.params?.body as string) ?? '' },
        )
      }
      return { notified: true }
    }

    case 'kb_query': {
      // KB 查询在后端执行，前端仅标记为完成
      return { queried: true, domain: action.params?.domain, query: action.params?.query }
    }

    case 'app_read': {
      // 通过 WebReader 读取应用的 Web 版本
      if (!action.target) throw new Error('app_read 操作缺少 target')
      const appUrls: Record<string, string> = {
        eastmoney: 'https://quote.eastmoney.com/',
        ths: 'https://www.10jqka.com.cn/',
        wind: 'https://www.wind.com.cn/',
      }
      const appUrl = appUrls[action.target] ?? action.target
      const readResult = await api.webReader.read({
        url: appUrl,
        useMainSession: true,
      })
      return readResult
    }

    case 'file_write': {
      const writeResult = await api.localApp.docgen({
        format: action.params?.format ?? 'txt',
        title: action.params?.title ?? '输出文件',
        data: action.params?.data ?? prevOutput ?? {},
        auto_open: action.params?.auto_open ?? false,
      })
      return writeResult
    }

    case 'dir_scan': {
      if (!api.fileIntel) throw new Error('FileIntel 不可用（非桌面端或版本过旧）')
      let dirPath = action.target
      if (!dirPath) {
        dirPath = await api.fileIntel.selectDir('选择要扫描的目录') ?? undefined
        if (!dirPath) throw new Error('用户取消目录选择')
      }
      const scanResult = await api.fileIntel.scanDir({
        dirPath,
        fileTypes: action.params?.file_types,
        recursive: action.params?.recursive ?? false,
        maxFiles: action.params?.max_files ?? 500,
      })
      return scanResult
    }

    case 'batch_analyze': {
      if (!api.fileIntel) throw new Error('FileIntel 不可用（非桌面端或版本过旧）')
      let batchDir = action.target
      if (!batchDir) {
        batchDir = await api.fileIntel.selectDir('选择要批量分析的目录') ?? undefined
        if (!batchDir) throw new Error('用户取消目录选择')
      }
      const batchResult = await api.fileIntel.batchAnalyze({
        dirPath: batchDir,
        fileTypes: action.params?.file_types,
        maxFiles: action.params?.max_files ?? 100,
        operation: action.params?.operation ?? 'classify',
        prompt: action.params?.prompt,
      })
      return batchResult
    }

    case 'schedule': {
      if (!api.scheduler) throw new Error('Scheduler 不可用（非桌面端或版本过旧）')
      const jobType = (action.params?.job_type as string) ?? 'cron'
      const createReq: Record<string, unknown> = {
        type: jobType,
        label: action.label,
        cronExpr: action.params?.cron_expr,
        action: action.params?.action ?? { type: 'notify', params: { title: action.label, body: '' } },
        solutionId: action.params?.solution_id,
      }
      const schedResult = await api.scheduler.create(createReq)
      if (!schedResult.success) throw new Error(schedResult.error ?? '创建定时任务失败')
      return schedResult.job
    }

    case 'watch': {
      if (!api.scheduler) throw new Error('Scheduler 不可用（非桌面端或版本过旧）')
      let watchPath = action.target ?? (action.params?.watch_path as string)
      if (!watchPath && api.scheduler.selectWatchDir) {
        watchPath = await api.scheduler.selectWatchDir() ?? ''
        if (!watchPath) throw new Error('用户取消目录选择')
      }
      const watchReq: Record<string, unknown> = {
        type: 'watch',
        label: action.label,
        watchPath,
        watchFileTypes: action.params?.watch_file_types,
        action: action.params?.action ?? { type: 'notify', params: { title: '文件变化', body: watchPath } },
        solutionId: action.params?.solution_id,
      }
      const watchResult = await api.scheduler.create(watchReq)
      if (!watchResult.success) throw new Error(watchResult.error ?? '创建文件监控失败')
      return watchResult.job
    }

    case 'system_notify': {
      if (api.scheduler) {
        await api.scheduler.notify({
          title: (action.params?.title as string) ?? action.label,
          body: (action.params?.body as string) ?? '',
          urgency: (action.params?.urgency as string) ?? 'normal',
          onClick: action.params?.onClick as Record<string, unknown>,
        })
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(
          (action.params?.title as string) ?? action.label,
          { body: (action.params?.body as string) ?? '' },
        )
      }
      return { notified: true }
    }

    case 'pipeline': {
      // Phase 4: 优先使用 DataPipeline（跨应用 AI 管道）
      const hasPipelineConfig = action.params?.pipeline_config || action.params?.template_id
      if (hasPipelineConfig && api.dataPipeline) {
        // 模板模式
        if (action.params?.template_id && !action.params?.pipeline_config) {
          const templateId = action.params.template_id as string
          const overrides: Record<string, unknown> = {}
          if (action.params?.agent_base_url) overrides.agentBaseUrl = action.params.agent_base_url
          if (action.params?.step_overrides) overrides.steps = action.params.step_overrides

          // 如果模板需要目录但没指定，弹出选择
          const dirTemplates = ['contract-review', 'invoice-summary', 'multi-file-merge']
          if (dirTemplates.includes(templateId) && api.fileIntel) {
            const dirPath = await api.fileIntel.selectDir(`选择要处理的文件目录`)
            if (!dirPath) throw new Error('用户取消目录选择')
            // 覆盖第一个 read_dir 步骤的路径
            overrides.firstDirPath = dirPath
          }
          return await api.dataPipeline.executeTemplate(templateId, overrides)
        }

        // 完整配置模式
        const config = action.params!.pipeline_config as Record<string, unknown>

        // 检查是否需要目录/文件选择
        const steps = (config.steps ?? []) as { type: string; params: Record<string, unknown> }[]
        for (const step of steps) {
          if (step.type === 'read_dir' && !step.params?.dirPath && api.fileIntel) {
            const dirPath = await api.fileIntel.selectDir(`选择要处理的文件目录`)
            if (!dirPath) throw new Error('用户取消目录选择')
            step.params = { ...step.params, dirPath }
          }
          if (step.type === 'read' && api.fileIntel) {
            const files = (step.params?.files ?? []) as string[]
            if (files.length === 0) {
              const dirPath = await api.fileIntel.selectDir('选择包含文件的目录')
              if (!dirPath) throw new Error('用户取消文件选择')
              step.params = { ...step.params, files: [], dirPath }
              step.type = 'read_dir'
            }
          }
        }

        return await api.dataPipeline.execute(config)
      }

      // Phase 3 降级: 简单文件管道
      if (!api.fileIntel) throw new Error('FileIntel 不可用（非桌面端或版本过旧）')
      const pipeResult = await api.fileIntel.pipeline({
        steps: (action.params?.steps as { action: string; params: Record<string, unknown> }[]) ?? [],
        inputFiles: action.params?.input_files as string[],
        outputFormat: (action.params?.output_format as string) ?? 'xlsx',
        outputPath: action.params?.output_path as string,
      })
      return pipeResult
    }

    case 'memory_save': {
      if (!api.memory) throw new Error('记忆模块不可用（非桌面端或版本过旧）')
      const fact = await api.memory.upsertFact({
        category: (action.params?.category as string) ?? 'custom',
        key: (action.params?.key as string) ?? action.label,
        value: (action.params?.value as string) ?? '',
        confidence: (action.params?.confidence as number) ?? 0.8,
        source: 'agent_action',
      })
      return { saved: true, fact }
    }

    case 'memory_recall': {
      if (!api.memory) throw new Error('记忆模块不可用（非桌面端或版本过旧）')
      const summary = await api.memory.getSummary(
        action.params?.solutionId as string | undefined,
      )
      return { recalled: true, summary }
    }

    case 'offline_hint': {
      const inferApi = window.electronAPI?.inference
      if (inferApi?.answer) {
        const query = (action.params?.query as string) ?? ''
        const result = await inferApi.answer(query)
        return { offline: true, ...result }
      }
      return { offline: true, text: '离线推理引擎不可用', source: 'fallback', confidence: 0 }
    }

    case 'show_copilot_card': {
      const replyText = (action.params?.text as string) ?? String(prevOutput ?? '')
      const ecsApi = window.electronAPI?.ecommerceCs
      if (ecsApi?.addReply) {
        const reply = await ecsApi.addReply({
          customerName: (action.params?.customer_name as string) ?? '客户',
          customerQuery: (action.params?.customer_query as string) ?? '',
          aiReply: replyText,
          confidence: (action.params?.confidence as number) ?? 0.8,
          sourceApp: (action.params?.source_app as string) ?? 'unknown',
        })
        await api.copilot.clipboard.write(replyText)
        return { copilotCard: true, replyId: reply.id, copied: true }
      }
      await api.copilot.clipboard.write(replyText)
      return { copilotCard: true, copied: true, text: replyText }
    }

    case 'accessibility_read': {
      const accApi = window.electronAPI?.accessibility
      if (!accApi) throw new Error('Accessibility Bridge 不可用（非 Windows 桌面端）')
      const appKey = (action.target ?? action.params?.app) as string
      if (!appKey) throw new Error('accessibility_read 缺少目标应用')
      const chatResult = await accApi.readChat?.(appKey)
      if (chatResult === undefined) {
        throw new Error('accessibility_read：readChat 不可用')
      }
      return chatResult
    }

    default:
      throw new Error(`未知操作类型: ${action.type}`)
  }
}

/**
 * 按顺序执行一组 LocalAction，支持依赖链和进度回调
 */
export async function executeActions(
  actions: LocalAction[],
  onProgress?: ProgressCallback,
): Promise<ActionResult[]> {
  const results: ActionResult[] = []

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!
    const result: ActionResult = { index: i, action, status: 'running' }
    onProgress?.(result)

    try {
      let prevOutput: unknown
      if (action.depends_on != null && action.depends_on < results.length) {
        prevOutput = results[action.depends_on]!.output
      }

      result.output = await executeSingle(action, prevOutput)
      result.status = 'completed'
    } catch (err) {
      result.status = 'failed'
      result.error = err instanceof Error ? err.message : String(err)
    }

    results.push(result)
    onProgress?.(result)
  }

  return results
}

/**
 * 过滤出可自动执行的操作
 */
export function getAutoExecutableActions(actions: LocalAction[]): LocalAction[] {
  return actions.filter(canAutoExecute)
}

/**
 * 过滤出需要用户确认的操作
 */
export function getManualActions(actions: LocalAction[]): LocalAction[] {
  return actions.filter(a => !canAutoExecute(a))
}

/**
 * 检查是否在 Electron 环境中
 */
export function isElectronAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

/**
 * 获取操作类型的中文标签
 */
export function getActionTypeLabel(type: LocalActionType): string {
  const labels: Record<LocalActionType, string> = {
    docgen: '生成文档',
    app_open: '打开应用',
    app_read: '读取应用',
    calculate: '本地计算',
    file_read: '读取文件',
    file_write: '写入文件',
    web_read: '读取网页',
    clipboard_write: '复制到剪贴板',
    notify: '系统通知',
    kb_query: '知识查询',
    dir_scan: '扫描目录',
    batch_analyze: '批量分析',
    pipeline: '数据管道',
    schedule: '定时任务',
    watch: '文件监控',
    system_notify: '系统通知',
    memory_save: '记住信息',
    memory_recall: '回忆信息',
    offline_hint: '离线推理',
    show_copilot_card: 'AI 回复（待粘贴）',
    accessibility_read: '读取应用消息',
  }
  return labels[type] ?? type
}

/**
 * 获取操作类型对应的图标名
 */
export function getActionIcon(type: LocalActionType): string {
  const icons: Record<LocalActionType, string> = {
    docgen: '📄',
    app_open: '🚀',
    app_read: '👁',
    calculate: '🧮',
    file_read: '📂',
    file_write: '💾',
    web_read: '🌐',
    clipboard_write: '📋',
    notify: '🔔',
    kb_query: '📚',
    dir_scan: '🔍',
    batch_analyze: '📊',
    pipeline: '🔗',
    schedule: '⏰',
    watch: '👁',
    system_notify: '🔔',
    memory_save: '🧠',
    memory_recall: '💭',
    offline_hint: '📡',
    show_copilot_card: '💬',
    accessibility_read: '🔎',
  }
  return icons[type] ?? '⚡'
}

/**
 * 判断操作列表是否构成一个操作链（有依赖关系）
 */
export function isActionChain(actions: LocalAction[]): boolean {
  return actions.some(a => a.depends_on != null)
}

/**
 * 计算操作链的总步骤和完成进度
 */
export function getChainProgress(
  actions: LocalAction[],
  statuses: Record<number, string>,
): { total: number; completed: number; percent: number } {
  const total = actions.length
  const completed = Object.values(statuses).filter(
    s => s === 'auto_done' || s === 'user_done' || s === 'completed',
  ).length
  return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 }
}

/**
 * 获取安全等级的中文描述
 */
export function getSecurityLabel(level: number): string {
  const labels: Record<number, string> = {
    0: '自动执行',
    1: '自动执行并通知',
    2: '需要确认',
    3: '需要手动操作',
  }
  return labels[level] ?? '需要确认'
}
