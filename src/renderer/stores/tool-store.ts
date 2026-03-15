import { create } from 'zustand'
import type { WorkbenchTab, ToolConfig } from '@/lib/solution-router'
import { useAdaptiveUIStore } from '@/stores/adaptive-ui-store'
import { useAppStore } from '@/stores/app-store'

interface ToolState {
  /** 当前活动 Tab */
  activeTab: WorkbenchTab
  /** 当前打开的工具（在 tools Tab 中） */
  activeTool: ToolConfig | null

  setActiveTab: (tab: WorkbenchTab) => void
  openTool: (tool: ToolConfig) => void
  closeTool: () => void
  /** 从 Slash 命令或侧边栏打开工具：切 Tab + 设置工具 */
  navigateToTool: (tool: ToolConfig) => void
}

export const useToolStore = create<ToolState>((set) => ({
  activeTab: 'chat',
  activeTool: null,

  setActiveTab: (tab) => {
    set({ activeTab: tab })
    const solutionId = useAppStore.getState().currentSolutionId
    if (solutionId) {
      useAdaptiveUIStore.getState().trackTabSwitch(solutionId, tab)
    }
  },

  openTool: (tool) => set({ activeTool: tool }),

  closeTool: () => set({ activeTool: null }),

  navigateToTool: (tool) => set({ activeTab: 'tools', activeTool: tool }),
}))
