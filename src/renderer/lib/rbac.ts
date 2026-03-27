/**
 * RBAC 角色权限系统 — QuickBooks "Multi-User / Roles" 对标
 *
 * 客户端 RBAC：角色定义 → Tab 可见性 → 操作权限 → 品牌级数据隔离。
 * 桌面端离线可用，后续可与 monorepo 用户 API 同步。
 */
import type { WorkbenchTab } from './solution-router'

export type RoleId = 'owner' | 'manager' | 'operator' | 'viewer' | 'accountant'

export interface Role {
  id: RoleId
  name: string
  description: string
  allowedTabs: WorkbenchTab[]
  permissions: Permission[]
  brandScope: 'all' | 'assigned'
}

export type Permission =
  | 'brand:create' | 'brand:edit' | 'brand:delete' | 'brand:view'
  | 'settlement:create' | 'settlement:edit_status' | 'settlement:reconcile' | 'settlement:view' | 'settlement:print'
  | 'erp:manage' | 'erp:import' | 'erp:run_recon'
  | 'scheduler:manage' | 'scheduler:execute'
  | 'report:view' | 'report:export'
  | 'audit:view'
  | 'settings:manage'

export const ROLE_DEFINITIONS: Record<RoleId, Role> = {
  owner: {
    id: 'owner',
    name: '老板 / 所有者',
    description: '完全控制权，可看到所有品牌和所有功能',
    allowedTabs: ['chat', 'brands', 'workflows', 'scheduler', 'erp-sync', 'tools', 'dashboard'],
    permissions: [
      'brand:create', 'brand:edit', 'brand:delete', 'brand:view',
      'settlement:create', 'settlement:edit_status', 'settlement:reconcile', 'settlement:view', 'settlement:print',
      'erp:manage', 'erp:import', 'erp:run_recon',
      'scheduler:manage', 'scheduler:execute',
      'report:view', 'report:export',
      'audit:view',
      'settings:manage',
    ],
    brandScope: 'all',
  },
  manager: {
    id: 'manager',
    name: '运营总监',
    description: '管理所有品牌，可创建结算但不能删除品牌',
    allowedTabs: ['chat', 'brands', 'workflows', 'scheduler', 'erp-sync', 'tools', 'dashboard'],
    permissions: [
      'brand:create', 'brand:edit', 'brand:view',
      'settlement:create', 'settlement:edit_status', 'settlement:reconcile', 'settlement:view', 'settlement:print',
      'erp:import', 'erp:run_recon',
      'scheduler:execute',
      'report:view', 'report:export',
      'audit:view',
    ],
    brandScope: 'all',
  },
  operator: {
    id: 'operator',
    name: '品牌运营',
    description: '只能操作分配给自己的品牌，不能创建/删除品牌',
    allowedTabs: ['chat', 'brands', 'workflows', 'tools', 'dashboard'],
    permissions: [
      'brand:view',
      'settlement:create', 'settlement:view', 'settlement:print',
      'erp:import',
      'report:view',
    ],
    brandScope: 'assigned',
  },
  accountant: {
    id: 'accountant',
    name: '财务 / 结算专员',
    description: '专注结算和对账，可以看到所有品牌的财务数据',
    allowedTabs: ['chat', 'brands', 'erp-sync', 'dashboard'],
    permissions: [
      'brand:view',
      'settlement:create', 'settlement:edit_status', 'settlement:reconcile', 'settlement:view', 'settlement:print',
      'erp:import', 'erp:run_recon',
      'report:view', 'report:export',
      'audit:view',
    ],
    brandScope: 'all',
  },
  viewer: {
    id: 'viewer',
    name: '只读查看者',
    description: '只能查看仪表盘和报表，不能做任何修改',
    allowedTabs: ['chat', 'dashboard'],
    permissions: [
      'brand:view',
      'settlement:view',
      'report:view',
    ],
    brandScope: 'all',
  },
}

// ─── 当前用户状态 ───

const STORAGE_KEY = 'mbe-rbac-config'

export interface RBACConfig {
  currentRole: RoleId
  assignedBrandIds: string[]
  userName: string
}

function getDefaultConfig(): RBACConfig {
  return { currentRole: 'owner', assignedBrandIds: [], userName: '管理员' }
}

export function loadRBACConfig(): RBACConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? { ...getDefaultConfig(), ...JSON.parse(stored) } : getDefaultConfig()
  } catch {
    return getDefaultConfig()
  }
}

export function saveRBACConfig(config: RBACConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function getCurrentRole(): Role {
  const config = loadRBACConfig()
  return ROLE_DEFINITIONS[config.currentRole] || ROLE_DEFINITIONS.owner
}

export function hasPermission(permission: Permission): boolean {
  return getCurrentRole().permissions.includes(permission)
}

export function canAccessTab(tab: WorkbenchTab): boolean {
  return getCurrentRole().allowedTabs.includes(tab)
}

export function getVisibleTabs(enabledTabs: WorkbenchTab[]): WorkbenchTab[] {
  const role = getCurrentRole()
  return enabledTabs.filter((tab) => role.allowedTabs.includes(tab))
}

export function canAccessBrand(brandId: string): boolean {
  const config = loadRBACConfig()
  const role = ROLE_DEFINITIONS[config.currentRole]
  if (role.brandScope === 'all') return true
  return config.assignedBrandIds.includes(brandId)
}

export function getAccessibleBrandIds(): string[] | 'all' {
  const config = loadRBACConfig()
  const role = ROLE_DEFINITIONS[config.currentRole]
  if (role.brandScope === 'all') return 'all'
  return config.assignedBrandIds
}
