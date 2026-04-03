/**
 * Solution SVG 图标映射（MBE-P2: 使用 SVG 专业图标，不使用 emoji）
 *
 * 所有使用方案图标的页面统一从此处导入，确保一致性（C2 重复原则）。
 */
import {
  HardHat, Scale, Calculator, Building2, Stethoscope,
  Briefcase, Plane, GraduationCap, ShoppingBag, ShieldCheck,
  TrendingUp, Landmark, type LucideIcon,
} from 'lucide-react'

export const SOLUTION_ICON_MAP: Record<string, LucideIcon> = {
  'labor-dispatch': HardHat,
  'law-firm': Scale,
  'finance-tax-service': Calculator,
  'hk-finance-tax': Landmark,
  'construction-cost': Building2,
  'clinic-respiratory': Stethoscope,
  'smb-operations': Briefcase,
  'study-abroad-consulting': Plane,
  'education-training': GraduationCap,
  'ecommerce-brand-service': ShoppingBag,
  'insurance-operations': ShieldCheck,
  'investment-research': TrendingUp,
}

export const DEFAULT_ICON: LucideIcon = Briefcase

export function getSolutionIcon(solutionId: string): LucideIcon {
  return SOLUTION_ICON_MAP[solutionId] ?? DEFAULT_ICON
}
