/**
 * Workflow / Scenario 图标映射（MBE-P2: SVG 替代 emoji）
 *
 * WorkflowPanel 统一引用，场景/工作流的 icon 字段映射为 Lucide 组件。
 */
import {
  School, ClipboardList, Plane, PenLine, Coins, Stamp,
  FolderOpen, Lightbulb, BookOpen, Target,
  ShoppingCart, Receipt, Link2, Search, Landmark,
  FileText, Briefcase, Calculator, Stethoscope,
  Clock, RefreshCw, CheckCircle2, XCircle,
  ArrowRight, Columns2,
  TrendingUp, DollarSign, Shield,
  Package, CheckCircle, Crosshair,
  type LucideIcon,
} from 'lucide-react'

/** 工作流/场景 icon 字段 → Lucide 组件 */
const ICON_MAP: Record<string, LucideIcon> = {
  '🏫': School,
  '📋': ClipboardList,
  '✈️': Plane,
  '📝': PenLine,
  '💰': Coins,
  '🛂': Stamp,
  '📂': FolderOpen,
  '📒': BookOpen,
  '💡': Lightbulb,
  '🎯': Target,
  '🛒': ShoppingCart,
  '📊': Receipt,
  '🔗': Link2,
  '🔍': Search,
  '🏛️': Landmark,
  '📄': FileText,
  '💼': Briefcase,
  '🧮': Calculator,
  '🩺': Stethoscope,
  '⚖️': Briefcase,
  '🔄': RefreshCw,
}

export function getWorkflowIcon(emoji: string): LucideIcon {
  return ICON_MAP[emoji] ?? ClipboardList
}

/** 步骤执行状态图标 */
export const STATUS_ICONS: Record<string, LucideIcon> = {
  pending: Clock,
  running: RefreshCw,
  done: CheckCircle2,
  error: XCircle,
}

/** 编排模式 */
export const ORCHESTRATION_META: Record<string, { icon: LucideIcon; label: string; desc: string }> = {
  sequential: { icon: ArrowRight, label: '流水线', desc: '步骤间传递结果，依次执行' },
  parallel:   { icon: Columns2,   label: '并行合并', desc: '多 Expert 同时执行，结果合并' },
}

/** 利润维度标签 */
export const PROFIT_DIM_META: Record<string, { icon: LucideIcon; label: string; cls: string }> = {
  revenue:        { icon: TrendingUp,  label: '增收', cls: 'text-green-400' },
  cost_saving:    { icon: DollarSign,  label: '降本', cls: 'text-blue-400' },
  loss_avoidance: { icon: Shield,      label: '避损', cls: 'text-amber-400' },
}

/** 交付物/成功标准/期望输出图标 */
export const DELIVERABLE_ICON = Package
export const SUCCESS_ICON = CheckCircle
export const EXPECTED_ICON = Crosshair
