import { create } from 'zustand'
import type { WorkbenchTab, ToolConfig } from '@/lib/solution-router'

interface ToolState {
  activeTab: WorkbenchTab
  activeTool: ToolConfig | null
  pendingPrompt: string | null
  pendingWorkflowId: string | null
  pendingScenarioId: string | null
  setActiveTab: (tab: WorkbenchTab) => void
  navigateToChat: (prompt: string) => void
  navigateToTool: (tool: ToolConfig) => void
  navigateToWorkflow: (workflowId: string) => void
  navigateToScenario: (scenarioId: string) => void
  openTool: (tool: ToolConfig) => void
  closeTool: () => void
  consumePendingPrompt: () => string | null
  consumePendingWorkflowId: () => string | null
  consumePendingScenarioId: () => string | null
}

export const useToolStore = create<ToolState>((set, get) => ({
  activeTab: 'workflows',
  activeTool: null,
  pendingPrompt: null,
  pendingWorkflowId: null,
  pendingScenarioId: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  navigateToChat: (prompt) => set({ activeTab: 'chat', pendingPrompt: prompt }),
  navigateToTool: (tool) => set({ activeTab: 'tools', activeTool: tool }),
  navigateToWorkflow: (workflowId) => set({ activeTab: 'workflows', pendingWorkflowId: workflowId, pendingScenarioId: null }),
  navigateToScenario: (scenarioId) => set({ activeTab: 'workflows', pendingScenarioId: scenarioId, pendingWorkflowId: null }),
  openTool: (tool) => set({ activeTool: tool }),
  closeTool: () => set({ activeTool: null }),
  consumePendingPrompt: () => {
    const p = get().pendingPrompt
    if (p) set({ pendingPrompt: null })
    return p
  },
  consumePendingWorkflowId: () => {
    const id = get().pendingWorkflowId
    if (id) set({ pendingWorkflowId: null })
    return id
  },
  consumePendingScenarioId: () => {
    const id = get().pendingScenarioId
    if (id) set({ pendingScenarioId: null })
    return id
  },
}))
