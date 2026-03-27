/**
 * RBAC 角色切换面板 — QuickBooks "Users & Roles" 对标
 *
 * 提供角色选择、权限预览和品牌分配功能。
 * 桌面端无后端时作为本地角色模拟器，连接 monorepo 后自动同步。
 */
import { useState, useCallback, useMemo } from 'react'
import { Shield, Check, Lock, Eye, Users, ChevronDown } from 'lucide-react'
import {
  ROLE_DEFINITIONS, loadRBACConfig, saveRBACConfig,
  type RoleId, type RBACConfig, type Permission,
} from '@/lib/rbac'
import { useBrandStore } from '@/stores/brand-store'

const PERMISSION_LABELS: Record<string, string> = {
  'brand:create': '创建品牌', 'brand:edit': '编辑品牌', 'brand:delete': '删除品牌', 'brand:view': '查看品牌',
  'settlement:create': '创建结算', 'settlement:edit_status': '修改结算状态', 'settlement:reconcile': '执行对账',
  'settlement:view': '查看结算', 'settlement:print': '打印结算单',
  'erp:manage': '管理 ERP', 'erp:import': '导入数据', 'erp:run_recon': '执行对账',
  'scheduler:manage': '管理调度', 'scheduler:execute': '手动执行',
  'report:view': '查看报表', 'report:export': '导出报表',
  'audit:view': '查看审计日志', 'settings:manage': '系统设置',
}

export default function RBACSettingsPanel({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<RBACConfig>(loadRBACConfig)
  const [expandedRole, setExpandedRole] = useState<RoleId | null>(null)
  const { brands } = useBrandStore()

  const currentRole = ROLE_DEFINITIONS[config.currentRole]
  const allRoles = useMemo(() => Object.values(ROLE_DEFINITIONS), [])

  const handleSelectRole = useCallback((roleId: RoleId) => {
    const next = { ...config, currentRole: roleId }
    setConfig(next)
    saveRBACConfig(next)
  }, [config])

  const toggleBrandAssignment = useCallback((brandId: string) => {
    const assigned = config.assignedBrandIds.includes(brandId)
      ? config.assignedBrandIds.filter((id) => id !== brandId)
      : [...config.assignedBrandIds, brandId]
    const next = { ...config, assignedBrandIds: assigned }
    setConfig(next)
    saveRBACConfig(next)
  }, [config])

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...config, userName: e.target.value }
    setConfig(next)
    saveRBACConfig(next)
  }, [config])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground rounded-2xl shadow-2xl max-w-[600px] w-full max-h-[85vh] overflow-y-auto">
        <div className="p-6 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">角色与权限</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">关闭</button>
        </div>

        <div className="p-6 space-y-6">
          {/* 当前用户 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">用户名称</label>
            <input
              type="text"
              value={config.userName}
              onChange={handleNameChange}
              className="w-full px-3 py-2 bg-muted/30 border border-border/40 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* 角色列表 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">选择角色</label>
            <div className="space-y-2">
              {allRoles.map((role) => {
                const selected = config.currentRole === role.id
                const expanded = expandedRole === role.id
                return (
                  <div key={role.id} className={`rounded-xl border transition-all ${selected ? 'border-primary/40 bg-primary/5' : 'border-border/30 hover:border-border/60'}`}>
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer"
                      onClick={() => handleSelectRole(role.id)}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground'}`}>
                        {selected ? <Check className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{role.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{role.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{role.permissions.length} 权限</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setExpandedRole(expanded ? null : role.id) }}
                          className="p-1 hover:bg-muted/50 rounded"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-border/20">
                        <div className="grid grid-cols-2 gap-1">
                          {(Object.keys(PERMISSION_LABELS) as Permission[]).map((perm) => {
                            const has = role.permissions.includes(perm)
                            return (
                              <div key={perm} className={`flex items-center gap-1.5 text-xs py-0.5 ${has ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                                {has ? <Check className="w-3 h-3 text-green-500" /> : <Lock className="w-3 h-3" />}
                                {PERMISSION_LABELS[perm]}
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Eye className="w-3 h-3" />
                          品牌范围: {role.brandScope === 'all' ? '所有品牌' : '仅分配的品牌'}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          可用 Tab: {role.allowedTabs.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 品牌分配（仅 operator 角色可见） */}
          {currentRole.brandScope === 'assigned' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">分配品牌（{config.assignedBrandIds.length}/{brands.length}）</label>
              {brands.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无品牌，请先在品牌台账中创建</p>
              ) : (
                <div className="space-y-1">
                  {brands.map((brand) => {
                    const assigned = config.assignedBrandIds.includes(brand.id)
                    return (
                      <label
                        key={brand.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${assigned ? 'bg-primary/5 border border-primary/30' : 'hover:bg-muted/30 border border-transparent'}`}
                      >
                        <input
                          type="checkbox"
                          checked={assigned}
                          onChange={() => toggleBrandAssignment(brand.id)}
                          className="rounded"
                        />
                        <span className="text-sm">{brand.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{brand.platforms.join(', ')}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
