/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface LegacyAgentInfo {
  dirName: string
  solutionId: string
  agentId: string
  label: string
  sessionPath: string
  hasSession: boolean
  chatHistoryCount: number
  sessionFields: string[]
}

interface MigrationResult {
  agent: string
  sessionMigrated: boolean
  conversationsMigrated: number
  messagesMigrated: number
  errors: string[]
}

/** BehaviorObserver（与 preload.ts observer 一致） */
interface ElectronObserver {
  enabled: () => Promise<boolean>
  setEnabled: (enabled: boolean) => Promise<{ success: boolean; enabled: boolean }>
  appSummary: (days?: number) => Promise<unknown[]>
  sequences: (days?: number, limit?: number) => Promise<unknown[]>
  mbeActions: (solutionId?: string, days?: number) => Promise<unknown[]>
  recentApps: (count?: number) => Promise<string[]>
  recordAction: (solutionId: string, expertId: string, label: string) => Promise<{ success: boolean }>
}

/** PatternRecognizer（与 preload.ts pattern 一致） */
/** 与主进程 db:stats 返回结构对齐（Settings 仪表盘） */
interface ElectronDbStats {
  tables: Record<string, number>
  dbSizeBytes: number
}

interface ElectronPattern {
  list: (status?: string) => Promise<unknown[]>
  analyze: () => Promise<{ patterns: unknown[]; newCount: number }>
  accept: (patternId: string) => Promise<{ success: boolean }>
  dismiss: (patternId: string) => Promise<{ success: boolean }>
  automate: (patternId: string) => Promise<{ success: boolean }>
  registerSolutionPatterns: (patterns: unknown[]) => Promise<{ success: boolean; totalRules: number }>
  onNewDiscovery: (callback: (data: unknown) => void) => () => void
}

interface ElectronAPI {
  openFile: (options?: any) => Promise<string[]>
  saveFile: (options?: any) => Promise<string | null>
  readFileBase64: (filePath: string) => Promise<{ success: boolean; data?: string; name?: string; error?: string }>
  writeFile: (filePath: string, base64Data: string) => Promise<{ success: boolean; error?: string }>
  printToPDF: (html: string) => Promise<{ success: boolean; data?: string; error?: string }>
  openPath: (filePath: string) => Promise<{ success: boolean; error?: string }>
  getAppInfo: () => Promise<{
    version: string
    name: string
    platform: string
    arch: string
    isDev: boolean
    paths: { userData: string; documents: string; dataDir: string; temp: string }
  }>
  minimize: () => void
  maximize: () => void
  close: () => void
  openExternal: (url: string) => Promise<void>
  session: {
    read: () => Promise<Record<string, any>>
    write: (data: Record<string, any>) => Promise<Record<string, any>>
    get: (key: string) => Promise<any>
    set: (key: string, value: any) => Promise<void>
    remove: (key: string) => Promise<void>
  }
  db: {
    conversations: {
      list: (solutionId: string) => Promise<any[]>
      create: (data: { id: string; solutionId: string; agentRole?: string; title?: string }) => Promise<void>
      updateTitle: (id: string, title: string) => Promise<void>
      delete: (id: string) => Promise<void>
    }
    messages: {
      list: (conversationId: string) => Promise<any[]>
      add: (data: { id: string; conversationId: string; role: string; content: string; agentRole?: string; sources?: string }) => Promise<void>
      clear: (conversationId: string) => Promise<void>
    }
    calc: {
      list: (solutionId: string) => Promise<any[]>
      add: (data: { id: string; solutionId: string; toolId: string; inputJson: string; outputJson: string; confidence?: number; source: string; conversationId?: string }) => Promise<void>
    }
    tasks: {
      list: (solutionId: string) => Promise<any[]>
      create: (data: { id: string; solutionId: string; type: string; title: string; priority?: string; dueDate?: string; relatedConversationId?: string }) => Promise<void>
      update: (id: string, updates: { status?: string; title?: string; priority?: string }) => Promise<void>
      delete: (id: string) => Promise<void>
    }
    usage: {
      track: (data: { eventType: string; solutionId?: string; agentRole?: string; toolId?: string; tabId?: string; metadata?: Record<string, unknown> }) => Promise<void>
      stats: (solutionId: string, days?: number) => Promise<any>
    }
    feedback: {
      add: (data: { solutionId: string; agentRole: string; feedbackType: string; queryText?: string; fromAgent?: string; toAgent?: string; responseTimeMs?: number }) => Promise<void>
      stats: (solutionId: string) => Promise<any>
      export: (solutionId: string, sinceTs?: string) => Promise<any[]>
      markSynced: (ids: number[]) => Promise<void>
    }
    cache: {
      get: (key: string) => Promise<any>
      set: (data: { cacheKey: string; solutionId: string; contentJson: string; priority?: number; expiresAt?: string }) => Promise<void>
      prune: (maxEntries?: number) => Promise<void>
    }
    snapshot: {
      save: (solutionId: string, version: number, snapshotJson: string) => Promise<void>
      latest: (solutionId: string) => Promise<any>
      version: (solutionId: string) => Promise<number>
      history: (solutionId: string, limit?: number) => Promise<any[]>
    }
    /** 库体量等统计（ipc db:stats） */
    stats: () => Promise<ElectronDbStats | null | undefined>
    /** 清除本地 LLM/检索等缓存条目数（ipc db:clearCache） */
    clearCache: () => Promise<number>
    backup: {
      create: () => Promise<{ ok?: boolean; path?: string; password?: string } | null | undefined>
      restore: (password?: string) => Promise<{
        ok?: boolean
        needPassword?: boolean
        filePath?: string
        tables?: string[]
        error?: string
      } | null | undefined>
      restoreWithPassword: (filePath: string, password: string) => Promise<{ ok?: boolean; error?: string } | null | undefined>
    }
  }
  runLocalCalc: (scriptPath: string, args: string[]) => Promise<{ success: boolean; result?: string; error?: string }>

  // ── 本地应用控制（LocalAppBridge — CLI-Anything 启发） ──
  localApp: {
    docgen: (request: {
      format: 'pptx' | 'xlsx' | 'docx'
      template?: string
      data: Record<string, unknown>
      outputDir?: string
      autoOpen?: boolean
      fileName?: string
    }) => Promise<{ success: boolean; filePath?: string; fileSize?: number; error?: string }>

    open: (request: {
      action: 'open_file' | 'open_app' | 'open_url' | 'mailto'
      target: string
      args?: string[]
      withApp?: string
    }) => Promise<{ success: boolean; error?: string }>

    exec: (request: {
      command: string
      args: string[]
      timeout?: number
      workingDir?: string
      securityLevel: 0 | 1 | 2 | 3
    }) => Promise<{
      success: boolean
      stdout?: string
      stderr?: string
      exitCode?: number
      parsedJson?: Record<string, unknown>
      error?: string
    }>

    detect: () => Promise<{ name: string; available: boolean; path?: string; version?: string }[]>

    getExportsDir: () => Promise<string>

    listExports: () => Promise<{ name: string; size: number; created: string; format: string }[]>

    onNotify: (callback: (data: { level: number; message: string; detail?: string }) => void) => () => void
  }

  // ── WorkflowMiner（行为捕捉→工作流生成→成本收益测量） ──
  miner: {
    scan: () => Promise<{
      scannedAt: string
      apps: { name: string; publisher?: string; installPath?: string; category: string }[]
      industryGuesses: { industry: string; confidence: number; matchedApps: string[]; suggestedSolution: string }[]
    }>
    industry: () => Promise<{ industry: string; confidence: number; matchedApps: string[]; suggestedSolution: string }[]>
    recordEfficiency: (record: {
      taskName: string
      solutionId: string
      manualDurationMs: number | null
      assistedDurationMs: number | null
      timestamp: string
    }) => Promise<{ success: boolean }>
    costBenefitReport: (solutionId: string, days?: number) => Promise<{
      solutionId: string
      period: string
      taskCount: number
      totalManualMs: number
      totalAssistedMs: number
      savedMs: number
      savedPercent: number
      tasks: { name: string; count: number; avgManualMs: number; avgAssistedMs: number; savedPercent: number }[]
    }>
    efficiencyHistory: (solutionId?: string, days?: number) => Promise<{
      taskName: string; solutionId: string; manualDurationMs: number | null; assistedDurationMs: number | null; timestamp: string
    }[]>
  }

  observer: ElectronObserver
  pattern: ElectronPattern

  migration: {
    detect: () => Promise<LegacyAgentInfo[]>
    run: (agentIds: string[]) => Promise<MigrationResult[]>
    status: () => Promise<{ migrated: string[]; hasMigrated: boolean }>
  }
  saveBackupFile: (data: ArrayBuffer, name: string) => Promise<{ success: boolean; path?: string; error?: string }>
  loadBackupFile: () => Promise<{ data: ArrayBuffer; name: string } | null>
  onAuthCallback: (callback: (data: { token: string; email: string; name: string; refreshToken: string }) => void) => () => void
  updater: {
    check: () => void
    download: () => void
    onStatus: (callback: (data: {
      status: 'available' | 'downloading' | 'installing' | 'error'
      version?: string
      progress?: number
      error?: string
      bytesPerSecond?: number
      transferred?: number
      total?: number
    }) => void) => () => void
  }
  scheduler?: {
    notify: (req: {
      title: string
      body: string
      urgency?: 'normal' | 'critical' | 'low'
      onClick?: { type: string; target: string }
      alsoToast?: boolean
    }) => Promise<{ success: boolean }>
    onToast: (callback: (data: { title: string; body: string; urgency?: string }) => void) => () => void
  }
  platform: string
}

interface Window {
  electronAPI?: ElectronAPI
}
