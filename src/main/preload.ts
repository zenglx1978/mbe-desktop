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
      restore: () => ipcRenderer.invoke('db:backup:restore'),
    },
  },

  // ── 本地 Python 计算（离线可用） ──
  runLocalCalc: (scriptPath: string, args: string[]) => ipcRenderer.invoke('calc:run', scriptPath, args),

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
