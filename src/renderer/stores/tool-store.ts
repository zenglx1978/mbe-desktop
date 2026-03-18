import { create } from 'zustand'
import type { WorkbenchTab, ToolConfig } from '@/lib/solution-router'

interface ToolState {
  activeTab: WorkbenchTab
  activeTool: ToolConfig | null
  setActiveTab: (tab: WorkbenchTab) => void
  navigateToTool: (tool: ToolConfig) => void
  openTool: (tool: ToolConfig) => void
  closeTool: () => void
}

export const useToolStore = create<ToolState>((set) => ({
  activeTab: 'workflows',
  activeTool: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  navigateToTool: (tool) => set({ activeTab: 'tools', activeTool: tool }),
  openTool: (tool) => set({ activeTool: tool }),
  closeTool: () => set({ activeTool: null }),
}))
