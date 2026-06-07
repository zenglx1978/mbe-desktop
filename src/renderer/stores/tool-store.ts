import { create } from 'zustand'
import type { WorkbenchTab, ToolConfig } from '@/lib/solution-router'

export interface SelectedStock {
  ticker: string
  name: string
  market: 'A' | 'HK' | 'US'
}

interface ToolState {
  activeTab: WorkbenchTab
  activeTool: ToolConfig | null
  pendingPrompt: string | null
  pendingWorkflowId: string | null
  pendingScenarioId: string | null
  /** 当前选中的研究标的，全局共享，消除各面板重复输入 */
  selectedStock: SelectedStock | null
  /** 从工作流结果传入 Design Engine 的预填 Markdown（用完即清） */
  pendingDesignMarkdown: string | null
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
  setSelectedStock: (stock: SelectedStock | null) => void
  /** 选中股票并跳转到研究工作流 */
  selectStockAndResearch: (stock: SelectedStock, workflowId?: string) => void
  /** 将工作流结果 Markdown 传给 Design Engine，并跳转到该 tab */
  navigateToDesignEngine: (markdown: string) => void
  consumePendingDesignMarkdown: () => string | null
}

export const useToolStore = create<ToolState>((set, get) => ({
  activeTab: 'workflows',
  activeTool: null,
  pendingPrompt: null,
  pendingWorkflowId: null,
  pendingScenarioId: null,
  selectedStock: null,
  pendingDesignMarkdown: null,
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
  setSelectedStock: (stock) => set({ selectedStock: stock }),
  selectStockAndResearch: (stock, workflowId) => {
    set({
      selectedStock: stock,
      activeTab: 'workflows' as WorkbenchTab,
      pendingWorkflowId: workflowId ?? 'stock_screening',
      pendingScenarioId: null,
    })
  },
  navigateToDesignEngine: (markdown) => set({
    activeTab: 'design-engine' as WorkbenchTab,
    pendingDesignMarkdown: markdown,
  }),
  consumePendingDesignMarkdown: () => {
    const md = get().pendingDesignMarkdown
    if (md) set({ pendingDesignMarkdown: null })
    return md
  },
}))
