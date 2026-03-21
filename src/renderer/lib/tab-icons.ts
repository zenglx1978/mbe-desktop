/**
 * Tab SVG 图标映射（MBE-P2: 使用 SVG 专业图标，不使用 emoji）
 *
 * WorkbenchTabs + Sidebar 统一引用此处，保证一致性（C2 重复原则）。
 */
import {
  MessageSquare, BarChart3, Wrench, FileText, CheckSquare,
  ShieldCheck, Coins, Landmark, LayoutDashboard,
  Calendar, Palette, Settings, LogOut, PanelLeftClose, PanelLeft,
  TrendingUp, Users, Wallet, Sparkles,
  type LucideIcon,
} from 'lucide-react'

export interface TabMeta {
  icon: LucideIcon
  label: string
}

export const TAB_ICON_MAP: Record<string, TabMeta> = {
  chat:       { icon: MessageSquare,   label: 'AI 对话' },
  workflows:  { icon: Landmark,        label: '业务流程' },
  dashboard:  { icon: LayoutDashboard, label: '仪表盘' },
  tools:      { icon: Wrench,          label: '计算工具' },
  documents:  { icon: FileText,        label: '文档' },
  tasks:      { icon: CheckSquare,     label: '任务' },
  approvals:  { icon: ShieldCheck,     label: '审批' },
  costs:      { icon: Coins,           label: '费用' },
  scheduler:  { icon: Calendar,        label: '调度' },
  designer:   { icon: Palette,         label: '设计器' },
  efficiency: { icon: TrendingUp,      label: '效率报告' },
  automation: { icon: Sparkles,        label: '自动化' },
  clients:    { icon: Users,           label: '客户沟通' },
  roi:        { icon: BarChart3,       label: 'ROI 分析' },
  account:    { icon: Wallet,         label: '账户' },
}

export const SIDEBAR_ACTIONS = {
  settings:  { icon: Settings,         label: '设置' },
  logout:    { icon: LogOut,           label: '退出登录' },
  collapse:  { icon: PanelLeftClose,   label: '收起' },
  expand:    { icon: PanelLeft,        label: '展开' },
} as const

export function getTabMeta(tab: string): TabMeta {
  return TAB_ICON_MAP[tab] ?? { icon: MessageSquare, label: tab }
}
