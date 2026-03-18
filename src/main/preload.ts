import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (options?: unknown) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options?: unknown) => ipcRenderer.invoke('dialog:saveFile', options),

  readFileBase64: (filePath: string) => ipcRenderer.invoke('fs:readFileBase64', filePath),
  writeFile: (filePath: string, base64Data: string) => ipcRenderer.invoke('fs:writeFile', filePath, base64Data),

  printToPDF: (html: string) => ipcRenderer.invoke('export:printToPDF', html),
  openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),

  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),

  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  session: {
    read: () => ipcRenderer.invoke('session:read'),
    write: (data: Record<string, unknown>) => ipcRenderer.invoke('session:write', data),
    get: (key: string) => ipcRenderer.invoke('session:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('session:set', key, value),
    remove: (key: string) => ipcRenderer.invoke('session:remove', key),
  },

  saveBackupFile: (data: ArrayBuffer, name: string) => ipcRenderer.invoke('backup:saveFile', data, name),
  loadBackupFile: () => ipcRenderer.invoke('backup:loadFile'),

  // ── 本地数据库（对话历史持久化） ──
  db: {
    conversations: {
      list: (solutionId: string) => ipcRenderer.invoke('db:conversations:list', solutionId),
      create: (data: { id: string; solutionId: string; agentRole?: string; title?: string }) =>
        ipcRenderer.invoke('db:conversations:create', data),
      updateTitle: (id: string, title: string) => ipcRenderer.invoke('db:conversations:updateTitle', id, title),
      delete: (id: string) => ipcRenderer.invoke('db:conversations:delete', id),
    },
    messages: {
      list: (conversationId: string) => ipcRenderer.invoke('db:messages:list', conversationId),
      add: (data: { id: string; conversationId: string; role: string; content: string; agentRole?: string; sources?: string }) =>
        ipcRenderer.invoke('db:messages:add', data),
      clear: (conversationId: string) => ipcRenderer.invoke('db:messages:clear', conversationId),
    },
    calc: {
      list: (solutionId: string) => ipcRenderer.invoke('db:calc:list', solutionId),
      add: (data: { id: string; solutionId: string; toolId: string; inputJson: string; outputJson: string; confidence?: number; source: string; conversationId?: string }) =>
        ipcRenderer.invoke('db:calc:add', data),
    },
    tasks: {
      list: (solutionId: string) => ipcRenderer.invoke('db:tasks:list', solutionId),
      create: (data: { id: string; solutionId: string; type: string; title: string; priority?: string; dueDate?: string; relatedConversationId?: string }) =>
        ipcRenderer.invoke('db:tasks:create', data),
      update: (id: string, updates: { status?: string; title?: string; priority?: string }) =>
        ipcRenderer.invoke('db:tasks:update', id, updates),
      delete: (id: string) => ipcRenderer.invoke('db:tasks:delete', id),
    },
    // ── Bitter Lesson: 客户端智能 ──
    usage: {
      track: (data: { eventType: string; solutionId?: string; agentRole?: string; toolId?: string; tabId?: string; metadata?: Record<string, unknown> }) =>
        ipcRenderer.invoke('db:usage:track', data),
      stats: (solutionId: string, days?: number) =>
        ipcRenderer.invoke('db:usage:stats', solutionId, days),
    },
    feedback: {
      add: (data: { solutionId: string; agentRole: string; feedbackType: string; queryText?: string; fromAgent?: string; toAgent?: string; responseTimeMs?: number }) =>
        ipcRenderer.invoke('db:feedback:add', data),
      stats: (solutionId: string) => ipcRenderer.invoke('db:feedback:stats', solutionId),
      export: (solutionId: string, sinceTs?: string) =>
        ipcRenderer.invoke('db:feedback:export', solutionId, sinceTs),
      markSynced: (ids: number[]) => ipcRenderer.invoke('db:feedback:markSynced', ids),
    },
    cache: {
      get: (key: string) => ipcRenderer.invoke('db:cache:get', key),
      set: (data: { cacheKey: string; solutionId: string; contentJson: string; priority?: number; expiresAt?: string }) =>
        ipcRenderer.invoke('db:cache:set', data),
      prune: (maxEntries?: number) => ipcRenderer.invoke('db:cache:prune', maxEntries),
    },
    snapshot: {
      save: (solutionId: string, version: number, snapshotJson: string) =>
        ipcRenderer.invoke('db:snapshot:save', solutionId, version, snapshotJson),
      latest: (solutionId: string) => ipcRenderer.invoke('db:snapshot:latest', solutionId),
      version: (solutionId: string) => ipcRenderer.invoke('db:snapshot:version', solutionId),
      history: (solutionId: string, limit?: number) =>
        ipcRenderer.invoke('db:snapshot:history', solutionId, limit),
    },
    backup: {
      create: () => ipcRenderer.invoke('db:backup:create'),
      restore: (password?: string) => ipcRenderer.invoke('db:backup:restore', password),
      restoreWithPassword: (filePath: string, password: string) =>
        ipcRenderer.invoke('db:backup:restoreWithPassword', filePath, password),
    },
    stats: () => ipcRenderer.invoke('db:stats'),
    clearCache: () => ipcRenderer.invoke('db:clearCache'),
  },

  // ── 本地确定性计算（纯 TS，离线可用） ──
  runLocalCalc: (scriptName: string, args: string[]) => ipcRenderer.invoke('calc:run', scriptName, args),

  // ── 本地应用控制（CLI-Anything 启发，AI Agent 操控用户本机应用） ──
  localApp: {
    docgen: (request: {
      format: 'pptx' | 'xlsx' | 'docx'
      template?: string
      data: Record<string, unknown>
      outputDir?: string
      autoOpen?: boolean
      fileName?: string
    }) => ipcRenderer.invoke('localApp:docgen', request),

    open: (request: {
      action: 'open_file' | 'open_app' | 'open_url' | 'mailto'
      target: string
      args?: string[]
      withApp?: string
    }) => ipcRenderer.invoke('localApp:open', request),

    exec: (request: {
      command: string
      args: string[]
      timeout?: number
      workingDir?: string
      securityLevel: 0 | 1 | 2 | 3
    }) => ipcRenderer.invoke('localApp:exec', request),

    detect: () => ipcRenderer.invoke('localApp:detect'),

    getExportsDir: () => ipcRenderer.invoke('localApp:getExportsDir'),

    listExports: () => ipcRenderer.invoke('localApp:listExports'),

    onNotify: (callback: (data: { level: number; message: string; detail?: string }) => void) => {
      const handler = (_event: unknown, data: { level: number; message: string; detail?: string }) => callback(data)
      ipcRenderer.on('localApp:notify', handler)
      return () => ipcRenderer.removeListener('localApp:notify', handler)
    },
  },

  // ── 网页阅读器（法条/财税政策跟踪，内置 Chromium 读网页，非爬虫） ──
  webReader: {
    read: (req: {
      url: string
      selector?: string
      waitFor?: string
      timeout?: number
      extractLinks?: boolean
      extractTables?: boolean
      customScript?: string
      useMainSession?: boolean
    }) => ipcRenderer.invoke('webReader:read', req),

    readBatch: (requests: {
      url: string
      selector?: string
      waitFor?: string
      timeout?: number
      extractLinks?: boolean
      extractTables?: boolean
      useMainSession?: boolean
    }[]) => ipcRenderer.invoke('webReader:readBatch', requests),

    readPreset: (sourceKey: string) => ipcRenderer.invoke('webReader:readPreset', sourceKey),

    listPresets: () => ipcRenderer.invoke('webReader:listPresets'),

    checkChanges: (rule: {
      id: string
      url: string
      selector?: string
      intervalMinutes: number
      lastHash?: string
      label: string
    }) => ipcRenderer.invoke('webReader:checkChanges', rule),

    extract: (url: string, script: string) => ipcRenderer.invoke('webReader:extract', url, script),
  },

  // ── 本地文件阅读器（导入 Excel/CSV/PDF/Word 到知识库） ──
  localReader: {
    read: (req: {
      filePath?: string
      fileTypes?: string[]
      dialogTitle?: string
      sheetName?: string
      headerRow?: number
      maxChars?: number
    }) => ipcRenderer.invoke('localReader:read', req),

    readDirectory: (dirPath: string, fileTypes?: string[]) =>
      ipcRenderer.invoke('localReader:readDirectory', dirPath, fileTypes),

    selectAndRead: (fileTypes?: string[]) =>
      ipcRenderer.invoke('localReader:selectAndRead', fileTypes),

    supportedTypes: () => ipcRenderer.invoke('localReader:supportedTypes'),

    watchDir: (req: {
      dirPath: string
      fileTypes?: string[]
      intervalSeconds?: number
    }) => ipcRenderer.invoke('localReader:watchDir', req),

    unwatchDir: (dirPath: string) => ipcRenderer.invoke('localReader:unwatchDir', dirPath),

    onNewFiles: (callback: (data: { dirPath: string; files: string[] }) => void) =>
      ipcRenderer.on('localReader:newFiles', (_, data) => callback(data)),
  },

  // ── FileIntel（本地文件智能 — Phase 3，Agent 主动扫描/读取/批量分析） ──
  fileIntel: {
    scanDir: (req: {
      dirPath: string
      fileTypes?: string[]
      recursive?: boolean
      maxFiles?: number
      maxDepth?: number
    }) => ipcRenderer.invoke('fileIntel:scanDir', req),

    selectDir: (title?: string) => ipcRenderer.invoke('fileIntel:selectDir', title),

    parseFile: (req: {
      filePath: string
      maxChars?: number
      sheetName?: string
      headerRow?: number
    }) => ipcRenderer.invoke('fileIntel:parseFile', req),

    batchAnalyze: (req: {
      dirPath: string
      fileTypes?: string[]
      maxFiles?: number
      operation: 'classify' | 'summarize' | 'extract' | 'custom'
      prompt?: string
    }) => ipcRenderer.invoke('fileIntel:batchAnalyze', req),

    pipeline: (req: {
      steps: { action: string; params: Record<string, unknown> }[]
      inputFiles?: string[]
      outputFormat?: string
      outputPath?: string
    }) => ipcRenderer.invoke('fileIntel:pipeline', req),

    scanAndClassify: (dirPath: string, fileTypes?: string[]) =>
      ipcRenderer.invoke('fileIntel:scanAndClassify', dirPath, fileTypes),

    onBatchProgress: (callback: (data: {
      current: number; total: number; file: string; status: string
    }) => void) => {
      const handler = (_e: unknown, data: { current: number; total: number; file: string; status: string }) => callback(data)
      ipcRenderer.on('fileIntel:batchProgress', handler)
      return () => ipcRenderer.removeListener('fileIntel:batchProgress', handler)
    },

    onPipelineProgress: (callback: (data: {
      step: number; total: number; action: string; status: string
    }) => void) => {
      const handler = (_e: unknown, data: { step: number; total: number; action: string; status: string }) => callback(data)
      ipcRenderer.on('fileIntel:pipelineProgress', handler)
      return () => ipcRenderer.removeListener('fileIntel:pipelineProgress', handler)
    },
  },

  // ── 跨应用数据管道（Phase 4 — 读文件→AI分析→生成文档 一气呵成） ──
  dataPipeline: {
    execute: (config: {
      name: string
      description?: string
      steps: { type: string; label: string; params: Record<string, unknown> }[]
      agentBaseUrl?: string
      agentHeaders?: Record<string, string>
      autoOpen?: boolean
    }) => ipcRenderer.invoke('dataPipeline:execute', config),

    executeTemplate: (templateId: string, overrides?: {
      agentBaseUrl?: string
      agentHeaders?: Record<string, string>
      steps?: { type: string; label: string; params: Record<string, unknown> }[]
    }) => ipcRenderer.invoke('dataPipeline:executeTemplate', templateId, overrides || {}),

    templates: () => ipcRenderer.invoke('dataPipeline:templates'),

    onProgress: (callback: (data: {
      stepIndex: number; type: string; label: string; status: string
      error?: string; durationMs?: number
      itemProgress?: { current: number; total: number }
      output?: unknown
    }) => void) => {
      const handler = (_e: unknown, data: any) => callback(data)
      ipcRenderer.on('dataPipeline:progress', handler)
      return () => ipcRenderer.removeListener('dataPipeline:progress', handler)
    },
  },

  // ── WorkflowMiner（行为捕捉→工作流生成→成本收益测量） ──
  miner: {
    scan: () => ipcRenderer.invoke('miner:scan'),
    industry: () => ipcRenderer.invoke('miner:industry'),
    recordEfficiency: (record: {
      taskName: string
      solutionId: string
      manualDurationMs: number | null
      assistedDurationMs: number | null
      timestamp: string
    }) => ipcRenderer.invoke('miner:recordEfficiency', record),
    costBenefitReport: (solutionId: string, days?: number) =>
      ipcRenderer.invoke('miner:costBenefitReport', solutionId, days),
    efficiencyHistory: (solutionId?: string, days?: number) =>
      ipcRenderer.invoke('miner:efficiencyHistory', solutionId, days),
  },

  // ── AI 副驾驶（全局快捷键 + 剪贴板 + 悬浮窗 + 截图 + 窗口检测） ──
  copilot: {
    show: (text?: string) => ipcRenderer.invoke('copilot:show', text),
    hide: () => ipcRenderer.invoke('copilot:hide'),
    toggle: () => ipcRenderer.invoke('copilot:toggle'),
    clipboard: {
      read: () => ipcRenderer.invoke('copilot:clipboard:read'),
      write: (text: string) => ipcRenderer.invoke('copilot:clipboard:write', text),
    },
    screenshot: () => ipcRenderer.invoke('copilot:screenshot'),
    screenshotArea: () => ipcRenderer.invoke('copilot:screenshot:area'),
    activeWindow: () => ipcRenderer.invoke('copilot:activeWindow'),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke('copilot:setEnabled', enabled),
    getStatus: () => ipcRenderer.invoke('copilot:getStatus'),
    moveWindow: (x: number, y: number) => ipcRenderer.send('copilot:window:move', { x, y }),
    resizeWindow: (w: number, h: number) => ipcRenderer.send('copilot:window:resize', { width: w, height: h }),
    pin: (pinned: boolean) => ipcRenderer.send('copilot:window:pin', pinned),
    close: () => ipcRenderer.send('copilot:window:close'),
    onAnalyze: (cb: (data: { text: string }) => void) => {
      const handler = (_e: unknown, data: { text: string }) => cb(data)
      ipcRenderer.on('copilot:analyze', handler)
      return () => ipcRenderer.removeListener('copilot:analyze', handler)
    },
    onScreenshot: (cb: (data: { dataUrl: string }) => void) => {
      const handler = (_e: unknown, data: { dataUrl: string }) => cb(data)
      ipcRenderer.on('copilot:screenshot', handler)
      return () => ipcRenderer.removeListener('copilot:screenshot', handler)
    },
    onCopied: (cb: (data: { text: string }) => void) => {
      const handler = (_e: unknown, data: { text: string }) => cb(data)
      ipcRenderer.on('copilot:copied', handler)
      return () => ipcRenderer.removeListener('copilot:copied', handler)
    },
  },

  // ── Accessibility Bridge（只读，读取千牛/旺旺等本地应用聊天消息） ──
  accessibility: {
    readChat: (appKey: string) => ipcRenderer.invoke('accessibility:readChat', appKey),
    watchChat: (appKey: string, intervalMs?: number) => ipcRenderer.invoke('accessibility:watchChat', appKey, intervalMs),
    stopWatch: (appKey: string) => ipcRenderer.invoke('accessibility:stopWatch', appKey),
    stopAll: () => ipcRenderer.invoke('accessibility:stopAll'),
    supportedApps: () => ipcRenderer.invoke('accessibility:supportedApps'),
    onNewMessages: (cb: (data: { app: string; messages: unknown[]; windowTitle?: string }) => void) => {
      const handler = (_e: unknown, data: { app: string; messages: unknown[]; windowTitle?: string }) => cb(data)
      ipcRenderer.on('accessibility:newMessages', handler)
      return () => ipcRenderer.removeListener('accessibility:newMessages', handler)
    },
  },

  // ── 电商客服 Copilot（三区安全模型 + 回复管理） ──
  ecommerceCs: {
    getAppSafety: (appKey: string) => ipcRenderer.invoke('ecommerceCs:getAppSafety', appKey),
    getAllSafety: () => ipcRenderer.invoke('ecommerceCs:getAllSafety'),
    getErpProfile: (erpKey: string) => ipcRenderer.invoke('ecommerceCs:getErpProfile', erpKey),
    canWrite: (appKey: string) => ipcRenderer.invoke('ecommerceCs:canWrite', appKey),
    addReply: (reply: { customerName: string; customerQuery: string; aiReply: string; confidence: number; sourceApp: string }) =>
      ipcRenderer.invoke('ecommerceCs:addReply', reply),
    copyReply: (replyId: string) => ipcRenderer.invoke('ecommerceCs:copyReply', replyId),
    updateStatus: (replyId: string, status: string) => ipcRenderer.invoke('ecommerceCs:updateStatus', replyId, status),
    pendingReplies: () => ipcRenderer.invoke('ecommerceCs:pendingReplies'),
    stats: () => ipcRenderer.invoke('ecommerceCs:stats'),
    onNewReply: (cb: (reply: unknown) => void) => {
      const handler = (_e: unknown, data: unknown) => cb(data)
      ipcRenderer.on('ecommerceCs:newReply', handler)
      return () => ipcRenderer.removeListener('ecommerceCs:newReply', handler)
    },
    onReplyUpdated: (cb: (reply: unknown) => void) => {
      const handler = (_e: unknown, data: unknown) => cb(data)
      ipcRenderer.on('ecommerceCs:replyUpdated', handler)
      return () => ipcRenderer.removeListener('ecommerceCs:replyUpdated', handler)
    },
  },

  // ── 定时任务 + 文件监控 + 系统通知（Phase 5） ──
  scheduler: {
    create: (req: {
      type: 'cron' | 'watch' | 'once'
      label: string
      cronExpr?: string
      watchPath?: string
      watchFileTypes?: string[]
      delayMs?: number
      action: { type: string; params: Record<string, unknown> }
      solutionId?: string
      conversationId?: string
    }) => ipcRenderer.invoke('scheduler:create', req),

    list: (solutionId?: string) => ipcRenderer.invoke('scheduler:list', solutionId),

    get: (jobId: string) => ipcRenderer.invoke('scheduler:get', jobId),

    pause: (jobId: string) => ipcRenderer.invoke('scheduler:pause', jobId),

    resume: (jobId: string) => ipcRenderer.invoke('scheduler:resume', jobId),

    delete: (jobId: string) => ipcRenderer.invoke('scheduler:delete', jobId),

    trigger: (jobId: string) => ipcRenderer.invoke('scheduler:trigger', jobId),

    notify: (req: {
      title: string
      body: string
      icon?: string
      onClick?: { type: 'open_url' | 'open_file' | 'focus_app' | 'navigate'; target: string }
      alsoToast?: boolean
      urgency?: 'normal' | 'critical' | 'low'
    }) => ipcRenderer.invoke('scheduler:notify', req),

    presets: () => ipcRenderer.invoke('scheduler:presets'),

    validateCron: (expr: string) => ipcRenderer.invoke('scheduler:validateCron', expr),

    selectWatchDir: () => ipcRenderer.invoke('scheduler:selectWatchDir'),

    onJobExecuted: (callback: (data: {
      jobId: string; timestamp: string; success: boolean; output?: unknown; error?: string
    }) => void) => {
      const handler = (_e: unknown, data: any) => callback(data)
      ipcRenderer.on('scheduler:jobExecuted', handler)
      return () => ipcRenderer.removeListener('scheduler:jobExecuted', handler)
    },

    onToast: (callback: (data: {
      title: string; body: string; urgency?: string; onClick?: unknown
    }) => void) => {
      const handler = (_e: unknown, data: any) => callback(data)
      ipcRenderer.on('scheduler:toast', handler)
      return () => ipcRenderer.removeListener('scheduler:toast', handler)
    },

    onAgentQuery: (callback: (data: {
      jobId: string; label: string; query: string; agentBaseUrl?: string
      expert?: string; solutionId?: string; conversationId?: string; triggerData?: unknown
    }) => void) => {
      const handler = (_e: unknown, data: any) => callback(data)
      ipcRenderer.on('scheduler:agentQuery', handler)
      return () => ipcRenderer.removeListener('scheduler:agentQuery', handler)
    },

    onPipelineTrigger: (callback: (data: {
      jobId: string; label: string; pipelineConfig?: unknown; templateId?: string; triggerData?: unknown
    }) => void) => {
      const handler = (_e: unknown, data: any) => callback(data)
      ipcRenderer.on('scheduler:pipelineTrigger', handler)
      return () => ipcRenderer.removeListener('scheduler:pipelineTrigger', handler)
    },

    onNavigate: (callback: (data: { route: string }) => void) => {
      const handler = (_e: unknown, data: any) => callback(data)
      ipcRenderer.on('scheduler:navigate', handler)
      return () => ipcRenderer.removeListener('scheduler:navigate', handler)
    },
  },

  // ── 用户偏好记忆（Phase 6 — Agent 越用越懂你） ──
  memory: {
    getProfile: () => ipcRenderer.invoke('memory:getProfile'),
    updateProfile: (partial: Record<string, unknown>) => ipcRenderer.invoke('memory:updateProfile', partial),

    getPreferences: () => ipcRenderer.invoke('memory:getPreferences'),
    updatePreferences: (partial: Record<string, unknown>) => ipcRenderer.invoke('memory:updatePreferences', partial),

    getFacts: (solutionId?: string, category?: string, limit?: number) =>
      ipcRenderer.invoke('memory:getFacts', solutionId, category, limit),
    upsertFact: (fact: {
      category: string; key: string; value: string;
      confidence: number; source?: string; solutionId?: string
    }) => ipcRenderer.invoke('memory:upsertFact', fact),
    deleteFact: (factId: string) => ipcRenderer.invoke('memory:deleteFact', factId),

    recordParamUsage: (toolId: string, params: Record<string, unknown>) =>
      ipcRenderer.invoke('memory:recordParamUsage', toolId, params),
    getTopParams: (toolId?: string, limit?: number) =>
      ipcRenderer.invoke('memory:getTopParams', toolId, limit),

    getSummary: (solutionId?: string) => ipcRenderer.invoke('memory:getSummary', solutionId),
    getPromptText: (solutionId?: string) => ipcRenderer.invoke('memory:getPromptText', solutionId),

    learn: (userMessage: string, solutionId?: string, conversationId?: string) =>
      ipcRenderer.invoke('memory:learn', userMessage, solutionId, conversationId),

    reset: () => ipcRenderer.invoke('memory:reset'),

    onProfileUpdated: (callback: (profile: Record<string, unknown>) => void) => {
      const handler = (_e: unknown, data: Record<string, unknown>) => callback(data)
      ipcRenderer.on('memory:profileUpdated', handler)
      return () => ipcRenderer.removeListener('memory:profileUpdated', handler)
    },

    onFactsLearned: (callback: (data: { facts: unknown[]; source: string }) => void) => {
      const handler = (_e: unknown, data: { facts: unknown[]; source: string }) => callback(data)
      ipcRenderer.on('memory:factsLearned', handler)
      return () => ipcRenderer.removeListener('memory:factsLearned', handler)
    },

    onReset: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('memory:reset', handler)
      return () => ipcRenderer.removeListener('memory:reset', handler)
    },
  },

  // ── 本地轻量推理（Phase 7 — 离线意图识别 + 简单分析） ──
  inference: {
    classify: (text: string) => ipcRenderer.invoke('inference:classify', text),
    answer: (text: string, solutionId?: string) => ipcRenderer.invoke('inference:answer', text, solutionId),
    analyze: (text: string) => ipcRenderer.invoke('inference:analyze', text),
    status: () => ipcRenderer.invoke('inference:status'),
  },

  // ── 数据迁移 ──
  migration: {
    detect: () => ipcRenderer.invoke('migration:detect'),
    run: (agentIds: string[]) => ipcRenderer.invoke('migration:run', agentIds),
    status: () => ipcRenderer.invoke('migration:status'),
  },

  onAuthCallback: (callback: (data: { token: string; email: string; name: string; refreshToken: string }) => void) => {
    const handler = (_event: unknown, data: { token: string; email: string; name: string; refreshToken: string }) => callback(data)
    ipcRenderer.on('auth:callback', handler)
    return () => ipcRenderer.removeListener('auth:callback', handler)
  },

  onReferralCode: (callback: (data: { code: string }) => void) => {
    const handler = (_event: unknown, data: { code: string }) => callback(data)
    ipcRenderer.on('referral:set', handler)
    return () => ipcRenderer.removeListener('referral:set', handler)
  },

  updater: {
    check: () => ipcRenderer.send('update:check'),
    download: () => ipcRenderer.send('update:download'),
    onStatus: (callback: (data: unknown) => void) => {
      const handler = (_event: unknown, data: unknown) => callback(data)
      ipcRenderer.on('update:status', handler)
      return () => ipcRenderer.removeListener('update:status', handler)
    },
  },

  platform: process.platform,
})
