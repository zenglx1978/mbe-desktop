/**
 * 客户门户 — 输入区与搜索/快捷回复等 UI 状态
 */
import { create } from 'zustand'

export interface ClientInputState {
  /** 主输入框 */
  inputText: string
  /** 发送可见范围 */
  sendTarget: string | string[]
  /** 主区 Tab */
  activeTab: 'chat' | 'docs' | 'tasks' | 'stats'

  showSearch: boolean
  searchQuery: string

  showQuickReplies: boolean
  qrCategory: string
  showCreateQR: boolean
  newQRTitle: string
  newQRContent: string
  newQRCat: string

  showAIMenu: boolean

  /** / 命令面板（预留，与快捷插入协同） */
  slashMenuOpen: boolean
  slashFilter: string

  /** 待上传附件队列（与隐藏 file input 配合） */
  stagedFiles: File[]

  setInputText: (v: string) => void
  clearInputText: () => void
  setSendTarget: (v: string | string[]) => void
  setActiveTab: (v: 'chat' | 'docs' | 'tasks' | 'stats') => void

  setShowSearch: (v: boolean) => void
  setSearchQuery: (v: string) => void
  closeSearchPanel: () => void

  setShowQuickReplies: (v: boolean) => void
  setQrCategory: (v: string) => void
  setShowCreateQR: (v: boolean) => void
  setNewQRTitle: (v: string) => void
  setNewQRContent: (v: string) => void
  setNewQRCat: (v: string) => void
  resetQuickReplyForm: () => void

  setShowAIMenu: (v: boolean) => void

  setSlashMenuOpen: (v: boolean) => void
  setSlashFilter: (v: string) => void

  setStagedFiles: (files: File[]) => void
  addStagedFile: (file: File) => void
  clearStagedFiles: () => void
  removeStagedFile: (index: number) => void
}

export const useClientInputStore = create<ClientInputState>((set, get) => ({
  inputText: '',
  sendTarget: 'all',
  activeTab: 'chat',

  showSearch: false,
  searchQuery: '',

  showQuickReplies: false,
  qrCategory: '',
  showCreateQR: false,
  newQRTitle: '',
  newQRContent: '',
  newQRCat: 'general',

  showAIMenu: false,

  slashMenuOpen: false,
  slashFilter: '',

  stagedFiles: [],

  setInputText: (v) => set({ inputText: v }),
  clearInputText: () => set({ inputText: '' }),
  setSendTarget: (v) => set({ sendTarget: v }),
  setActiveTab: (v) => set({ activeTab: v }),

  setShowSearch: (v) => set({ showSearch: v }),
  setSearchQuery: (v) => set({ searchQuery: v }),
  closeSearchPanel: () => set({ showSearch: false, searchQuery: '' }),

  setShowQuickReplies: (v) => set({ showQuickReplies: v }),
  setQrCategory: (v) => set({ qrCategory: v }),
  setShowCreateQR: (v) => set({ showCreateQR: v }),
  setNewQRTitle: (v) => set({ newQRTitle: v }),
  setNewQRContent: (v) => set({ newQRContent: v }),
  setNewQRCat: (v) => set({ newQRCat: v }),
  resetQuickReplyForm: () => set({
    showCreateQR: false,
    newQRTitle: '',
    newQRContent: '',
  }),

  setShowAIMenu: (v) => set({ showAIMenu: v }),

  setSlashMenuOpen: (v) => set({ slashMenuOpen: v }),
  setSlashFilter: (v) => set({ slashFilter: v }),

  setStagedFiles: (files) => set({ stagedFiles: [...files] }),
  addStagedFile: (file) => set({ stagedFiles: [...get().stagedFiles, file] }),
  clearStagedFiles: () => set({ stagedFiles: [] }),
  removeStagedFile: (index) => set({
    stagedFiles: get().stagedFiles.filter((_, i) => i !== index),
  }),
}))
