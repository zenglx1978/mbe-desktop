/**
 * Tab SVG 图标映射（MBE-P2: 使用 SVG 专业图标，不使用 emoji）
 *
 * WorkbenchTabs + Sidebar 统一引用此处，保证一致性（C2 重复原则）。
 */
import {
  MessageSquare, BarChart3, Wrench, FileText, CheckSquare,
  ShieldCheck, Coins, Landmark, LayoutDashboard,
  Calendar, Palette, Settings, LogOut, PanelLeftClose, PanelLeft,
  TrendingUp, Users, Wallet, Sparkles, Target, GitMerge,
  Building2, Link2, Radio,
  ClipboardList, BookOpen, Receipt, FileBarChart, Lightbulb,
  Scale, FileSignature, FilePen, BadgeDollarSign,
  UserCheck, Banknote, ShieldAlert, Gavel,
  Search, Briefcase, Globe, FileCheck,
  type LucideIcon,
} from 'lucide-react'

export interface TabMeta {
  icon: LucideIcon
  label: string
}

export const TAB_ICON_MAP: Record<string, TabMeta> = {
  chat:           { icon: MessageSquare,   label: 'AI 对话' },
  workflows:      { icon: Landmark,        label: '业务流程' },
  dashboard:      { icon: LayoutDashboard, label: '仪表盘' },
  tools:          { icon: Wrench,          label: '计算工具' },
  documents:      { icon: FileText,        label: '文档' },
  tasks:          { icon: CheckSquare,     label: '任务' },
  approvals:      { icon: ShieldCheck,     label: '审批' },
  costs:          { icon: Coins,           label: '费用' },
  scheduler:      { icon: Calendar,        label: '调度' },
  designer:       { icon: Palette,         label: '设计器' },
  efficiency:     { icon: TrendingUp,      label: '效率报告' },
  automation:     { icon: Sparkles,        label: '自动化' },
  clients:        { icon: Users,           label: '客户沟通' },
  roi:            { icon: BarChart3,       label: 'ROI 分析' },
  scout:          { icon: Target,          label: '标的评估' },
  account:        { icon: Wallet,          label: '账户' },
  pipeline:       { icon: GitMerge,        label: '销售漏斗' },
  brands:         { icon: Building2,       label: '品牌台账' },
  'erp-sync':     { icon: Link2,           label: 'ERP 同步' },
  // QuickBooks 风格: 任务导向 tab（P0-1）
  today:          { icon: ClipboardList,   label: '今日待办' },
  bookkeeping:    { icon: BookOpen,        label: '记账' },
  invoices:       { icon: Receipt,         label: '发票' },
  'tax-filing':   { icon: FileBarChart,    label: '报税' },
  reports:        { icon: BarChart3,       label: '报表' },
  'tax-planning': { icon: Lightbulb,       label: '税务筹划' },
  // 律所方案: 任务导向 tab
  cases:          { icon: Scale,           label: '案件' },
  contracts:      { icon: FileSignature,   label: '合同' },
  'legal-docs':   { icon: FilePen,         label: '文书' },
  billing:        { icon: BadgeDollarSign, label: '收费' },
  // 劳务派遣方案: 任务导向 tab
  employees:      { icon: UserCheck,      label: '员工' },
  payroll:        { icon: Banknote,       label: '薪资' },
  compliance:     { icon: ShieldAlert,    label: '合规' },
  disputes:       { icon: Gavel,          label: '纠纷' },
  // 投研方案: 任务导向 tab
  research:         { icon: Search,       label: '研究' },
  portfolio:        { icon: Briefcase,    label: '组合' },
  macro:            { icon: Globe,        label: '宏观' },
  'compliance-pub': { icon: FileCheck,    label: '合规发布' },
  'dispatch-dashboard': { icon: Radio,  label: 'Dispatch 控制台' },
}

export const SIDEBAR_ACTIONS = {
  switchSolution: { icon: Building2,   label: '切换方案' },
  settings:  { icon: Settings,         label: '设置' },
  logout:    { icon: LogOut,           label: '退出登录' },
  collapse:  { icon: PanelLeftClose,   label: '收起' },
  expand:    { icon: PanelLeft,        label: '展开' },
} as const

export function getTabMeta(tab: string): TabMeta {
  return TAB_ICON_MAP[tab] ?? { icon: MessageSquare, label: tab }
}
