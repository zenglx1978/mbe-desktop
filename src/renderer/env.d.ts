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
    backup: {
      create: () => Promise<{ path?: string } | null>
      restore: () => Promise<{ ok?: boolean } | null>
    }
  }
  runLocalCalc: (scriptPath: string, args: string[]) => Promise<{ success: boolean; result?: string; error?: string }>
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
    onStatus: (callback: (data: any) => void) => () => void
  }
  platform: string
}

interface Window {
  electronAPI?: ElectronAPI
}
