import { create } from 'zustand'
import type { WorkbenchTab, ToolConfig } from '@/lib/solution-router'

interface ToolState {
  activeTab: WorkbenchTab
  activeTool: ToolConfig | null
  pendingPrompt: string | null
  setActiveTab: (tab: WorkbenchTab) => void
  navigateToChat: (prompt: string) => void
  navigateToTool: (tool: ToolConfig) => void
  openTool: (tool: ToolConfig) => void
  closeTool: () => void
  consumePendingPrompt: () => string | null
}

export const useToolStore = create<ToolState>((set, get) => ({
  activeTab: 'workflows',
  activeTool: null,
  pendingPrompt: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  navigateToChat: (prompt) => set({ activeTab: 'chat', pendingPrompt: prompt }),
  navigateToTool: (tool) => set({ activeTab: 'tools', activeTool: tool }),
  openTool: (tool) => set({ activeTool: tool }),
  closeTool: () => set({ activeTool: null }),
  consumePendingPrompt: () => {
    const p = get().pendingPrompt
    if (p) set({ pendingPrompt: null })
    return p
  },
}))
