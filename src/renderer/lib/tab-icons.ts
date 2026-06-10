/**
 * Tab SVG 图标映射（MBE-P2: 使用 SVG 专业图标，不使用 emoji）
 *
 * WorkbenchTabs + Sidebar 统一引用此处，保证一致性（C2 重复原则）。
 * HK 繁體方案透過 getTabMetaForSolution() 取得本地化標籤。
 */
import {
  MessageSquare, BarChart3, Wrench, FileText, CheckSquare,
  ShieldCheck, Coins, Landmark, LayoutDashboard,
  Calendar, Palette, Settings, LogOut, PanelLeftClose, PanelLeft,
  TrendingUp, Users, Wallet, Sparkles, Target, GitMerge,
  Building2, Link2, Radio, FileImage,
  ClipboardList, BookOpen, Receipt, FileBarChart, Lightbulb,
  Scale, FileSignature, FilePen, BadgeDollarSign,
  UserCheck, Banknote, ShieldAlert, Gavel,
  Search, Briefcase, Globe, FileCheck, Network, Rocket,
  GitBranch, Download, ListChecks, ClipboardCheck, Store,
  Layers, Timer, FlaskConical,
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
  'design-engine':      { icon: FileImage, label: 'Design Engine' },
  'knowledge-graph':    { icon: Network,   label: '知识图谱' },
  'business-plan':      { icon: Rocket,    label: '商业计划书' },
  'consolidated':       { icon: GitBranch,   label: '合并报表' },
  'mises-export':       { icon: Download,    label: '研报导出' },
  'report-distill':     { icon: Layers,      label: '研报蒸馏' },
  'distill-scheduler':  { icon: Timer,       label: '定时抓取' },
  'backtest':           { icon: FlaskConical, label: '回测验证' },
  'ipo-prep':           { icon: ListChecks,      label: 'IPO 准备' },
  'audit-report':      { icon: ClipboardCheck,  label: '审计报告' },
  'neeq':              { icon: Store,           label: '新三板' },
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

// ── 香港財稅方案繁體中文 Tab 標籤覆寫 ──────────────────────────────────────
const HK_TAB_LABEL_MAP: Record<string, string> = {
  chat:           'AI 對話',
  workflows:      '業務流程',
  dashboard:      '儀表板',
  tools:          '計算工具',
  documents:      '文件',
  tasks:          '任務',
  approvals:      '審批',
  costs:          '費用',
  scheduler:      '排程',
  designer:       '設計器',
  efficiency:     '效率報告',
  automation:     '自動化',
  clients:        '客戶溝通',
  today:          '今日待辦',
  bookkeeping:    '帳務處理',
  invoices:       '單據管理',
  'tax-filing':   '報稅申報',
  reports:        '財務報表',
  'tax-planning': '稅務規劃',
  cases:          '案件',
  contracts:      '合約',
  'legal-docs':   '法律文書',
  billing:        '收費',
  research:       '研究',
  portfolio:      '組合',
  macro:          '宏觀',
}

/**
 * 取得 Tab 元資料，香港財稅方案使用繁體中文標籤。
 * 其他方案退回通用 getTabMeta()。
 */
export function getTabMetaForSolution(tab: string, solutionId?: string | null): TabMeta {
  const base = TAB_ICON_MAP[tab] ?? { icon: MessageSquare, label: tab }
  if (solutionId === 'hk-finance-tax') {
    return { icon: base.icon, label: HK_TAB_LABEL_MAP[tab] ?? base.label }
  }
  return base
}

// ── 香港財稅方案側欄操作按鈕繁體中文標籤 ────────────────────────────────────
const HK_SIDEBAR_ACTION_LABELS = {
  navLabel:     '主導航',
  notLoggedIn:  '未登入',
  copilot:      'AI 副駕駛',
  copilotTitle: 'AI 副駕駛 (Ctrl+Shift+Space)',
  switchSolution: '切換方案',
  settings:     '設定',
  logout:       '登出',
  quit:         '結束應用',
  collapse:     '收起',
  expand:       '展開',
} as const

const DEFAULT_SIDEBAR_ACTION_LABELS = {
  navLabel:     '主导航',
  notLoggedIn:  '未登录',
  copilot:      'AI 副驾驶',
  copilotTitle: 'AI 副驾驶 (Ctrl+Shift+Space)',
  switchSolution: '切换方案',
  settings:     '设置',
  logout:       '退出登录',
  quit:         '退出应用',
  collapse:     '收起',
  expand:       '展开',
} as const

/**
 * 取得側欄操作按鈕標籤，香港財稅方案使用繁體中文。
 */
export function getSidebarLabels(solutionId?: string | null) {
  return solutionId === 'hk-finance-tax'
    ? HK_SIDEBAR_ACTION_LABELS
    : DEFAULT_SIDEBAR_ACTION_LABELS
}
