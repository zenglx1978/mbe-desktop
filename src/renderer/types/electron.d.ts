interface ElectronDbBackup {
  create: () => Promise<{ ok?: boolean; path?: string; password?: string } | undefined>
  restore: () => Promise<{
    ok?: boolean; needPassword?: boolean; filePath?: string;
    tables?: string[]; error?: string
  } | undefined>
  restoreWithPassword: (path: string, password: string) => Promise<{ ok?: boolean; error?: string } | undefined>
}

interface ElectronDb {
  stats: () => Promise<unknown>
  backup: ElectronDbBackup
  clearCache: () => Promise<number>
  conversations: Record<string, (...args: unknown[]) => Promise<unknown>>
  messages: Record<string, (...args: unknown[]) => Promise<unknown>>
  calc: Record<string, (...args: unknown[]) => Promise<unknown>>
  tasks: Record<string, (...args: unknown[]) => Promise<unknown>>
  usage: Record<string, (...args: unknown[]) => Promise<unknown>>
  feedback: Record<string, (...args: unknown[]) => Promise<unknown>>
  cache: Record<string, (...args: unknown[]) => Promise<unknown>>
}

interface ElectronMiner {
  costBenefitReport: (solutionId: string, period: string) => Promise<unknown>
  [key: string]: (...args: unknown[]) => Promise<unknown>
}

interface ElectronAPI {
  openFile: (options?: unknown) => Promise<unknown>
  saveFile: (options?: unknown) => Promise<unknown>
  readFileBase64: (filePath: string) => Promise<string>
  writeFile: (filePath: string, base64Data: string) => Promise<void>
  printToPDF: (html: string) => Promise<unknown>
  openPath: (filePath: string) => Promise<void>
  getAppInfo: () => Promise<unknown>
  minimize: () => void
  maximize: () => void
  close: () => void
  openExternal: (url: string) => Promise<void>
  session: Record<string, (...args: unknown[]) => Promise<unknown>>
  db: ElectronDb
  miner: ElectronMiner
  [key: string]: unknown
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
