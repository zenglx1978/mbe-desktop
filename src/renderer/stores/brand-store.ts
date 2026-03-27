/**
 * 品牌台账 Store — QuickBooks "Chart of Accounts" 理念
 *
 * 品牌是 TP/代运营公司的核心资产，每个品牌相当于一个"会计科目"。
 * 双写策略：Zustand (响应式 UI) + SQLite (持久化 + 审计追踪)。
 * localStorage 作为 Zustand 自身 persist 的后备，SQLite 作为主存储。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { upsertBrand, upsertSettlement, deleteBrandRow, logAudit } from '@/lib/database'
import { execute as undoExecute, moveToTrash, type TrashedItem } from '@/lib/undo-manager'

export type SettlementStatus = 'draft' | 'confirmed' | 'invoiced' | 'paid'
export type BrandStatus = 'active' | 'onboarding' | 'paused' | 'churned'
export type SLATier = 'standard' | 'premium' | 'vip'

export interface ReconciliationData {
  gmv: number
  commission: number
  deductions: number
  finalPayable: number
  source: string
  reconciledAt: string
}

export interface Settlement {
  id: string
  brandId: string
  month: string
  gmv: number
  baseServiceFee: number
  performanceCommission: number
  totalAmount: number
  taxAmount: number
  status: SettlementStatus
  createdAt: string
  updatedAt: string
  notes?: string
  reconciliation?: ReconciliationData
}

export interface BrandPnL {
  brandId: string
  brandName: string
  totalGmv: number
  totalRevenue: number
  totalDeductions: number
  totalReceivable: number
  totalPaid: number
  profit: number
  months: { month: string; gmv: number; revenue: number; status: SettlementStatus }[]
}

export interface Brand {
  id: string
  name: string
  category: string
  platforms: string[]
  contractRate: number
  performanceRate: number
  fixedMonthlyFee: number
  slaTier: SLATier
  status: BrandStatus
  contactPerson?: string
  contractExpiry?: string
  monthlyGmvTarget?: number
  createdAt: string
  updatedAt: string
}

interface BrandStore {
  brands: Brand[]
  settlements: Settlement[]
  activeBrandId: string | null

  addBrand: (brand: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateBrand: (id: string, patch: Partial<Brand>) => void
  removeBrand: (id: string) => void
  setActiveBrand: (id: string | null) => void

  addSettlement: (settlement: Omit<Settlement, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateSettlementStatus: (id: string, status: SettlementStatus) => void
  setReconciliation: (settlementId: string, data: ReconciliationData) => void

  getBrandSettlements: (brandId: string) => Settlement[]
  getTotalReceivable: () => number
  getTotalGMV: () => number
  getBrandPnL: (brandId: string) => BrandPnL | null
  getAllBrandPnL: () => BrandPnL[]
}

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const now = () => new Date().toISOString()

export const useBrandStore = create<BrandStore>()(
  persist(
    (set, get) => ({
      brands: [],
      settlements: [],
      activeBrandId: null,

      addBrand: (data) => {
        const brand: Brand = { ...data, id: genId(), createdAt: now(), updatedAt: now() }
        set((s) => ({ brands: [...s.brands, brand] }))
        try {
          upsertBrand({ ...brand, platforms: brand.platforms, contactPerson: brand.contactPerson ?? null, contractExpiry: brand.contractExpiry ?? null, monthlyGmvTarget: brand.monthlyGmvTarget ?? null })
          logAudit('brand', brand.id, 'create')
        } catch { /* SQLite 未初始化时静默降级 */ }
      },

      updateBrand: (id, patch) => {
        const old = get().brands.find((b) => b.id === id)
        set((s) => ({
          brands: s.brands.map((b) =>
            b.id === id ? { ...b, ...patch, updatedAt: now() } : b,
          ),
        }))
        try {
          const updated = get().brands.find((b) => b.id === id)
          if (updated) {
            upsertBrand({ ...updated, contactPerson: updated.contactPerson ?? null, contractExpiry: updated.contractExpiry ?? null, monthlyGmvTarget: updated.monthlyGmvTarget ?? null })
            const changes = Object.entries(patch)
              .filter(([k]) => k !== 'updatedAt')
              .map(([field, newValue]) => ({ field, oldValue: old ? String((old as any)[field] ?? '') : null, newValue: String(newValue ?? '') }))
            if (changes.length) logAudit('brand', id, 'update', changes)
          }
        } catch { /* 降级 */ }
      },

      removeBrand: (id) => {
        const brand = get().brands.find((b) => b.id === id)
        if (!brand) return

        const trashItem: TrashedItem = {
          id: brand.id, type: 'brand', data: brand,
          deletedAt: Date.now(), deletedBy: 'user',
        }

        undoExecute({
          id: `delete-brand-${id}-${Date.now()}`,
          label: `删除品牌「${brand.name}」`,
          timestamp: Date.now(),
          doFn: () => {
            set((s) => ({
              brands: s.brands.filter((b) => b.id !== id),
              activeBrandId: s.activeBrandId === id ? null : s.activeBrandId,
            }))
            moveToTrash(trashItem)
            try { deleteBrandRow(id); logAudit('brand', id, 'soft_delete') } catch { /* 降级 */ }
          },
          undoFn: () => {
            set((s) => ({ brands: [...s.brands, brand] }))
            try {
              upsertBrand({ ...brand, contactPerson: brand.contactPerson ?? null, contractExpiry: brand.contractExpiry ?? null, monthlyGmvTarget: brand.monthlyGmvTarget ?? null })
              logAudit('brand', id, 'restore')
            } catch { /* 降级 */ }
          },
        })
      },

      setActiveBrand: (id) => set({ activeBrandId: id }),

      addSettlement: (data) => {
        const settlement: Settlement = {
          ...data,
          id: genId(),
          createdAt: now(),
          updatedAt: now(),
        }
        set((s) => ({ settlements: [...s.settlements, settlement] }))
        try {
          const recon = settlement.reconciliation
          upsertSettlement({
            ...settlement, notes: settlement.notes ?? null,
            reconGmv: recon?.gmv ?? null, reconCommission: recon?.commission ?? null,
            reconDeductions: recon?.deductions ?? null, reconFinalPayable: recon?.finalPayable ?? null,
            reconSource: recon?.source ?? null, reconAt: recon?.reconciledAt ?? null,
          })
          logAudit('settlement', settlement.id, 'create')
        } catch { /* 降级 */ }
      },

      updateSettlementStatus: (id, status) => {
        const old = get().settlements.find((s) => s.id === id)
        set((s) => ({
          settlements: s.settlements.map((st) =>
            st.id === id ? { ...st, status, updatedAt: now() } : st,
          ),
        }))
        try {
          const updated = get().settlements.find((s) => s.id === id)
          if (updated) {
            const recon = updated.reconciliation
            upsertSettlement({
              ...updated, notes: updated.notes ?? null,
              reconGmv: recon?.gmv ?? null, reconCommission: recon?.commission ?? null,
              reconDeductions: recon?.deductions ?? null, reconFinalPayable: recon?.finalPayable ?? null,
              reconSource: recon?.source ?? null, reconAt: recon?.reconciledAt ?? null,
            })
            logAudit('settlement', id, 'update', [{ field: 'status', oldValue: old?.status ?? null, newValue: status }])
          }
        } catch { /* 降级 */ }
      },

      setReconciliation: (settlementId, data) => {
        set((s) => ({
          settlements: s.settlements.map((st) =>
            st.id === settlementId
              ? { ...st, reconciliation: data, updatedAt: now() }
              : st,
          ),
        }))
        try {
          const updated = get().settlements.find((s) => s.id === settlementId)
          if (updated) {
            const recon = updated.reconciliation
            upsertSettlement({
              ...updated, notes: updated.notes ?? null,
              reconGmv: recon?.gmv ?? null, reconCommission: recon?.commission ?? null,
              reconDeductions: recon?.deductions ?? null, reconFinalPayable: recon?.finalPayable ?? null,
              reconSource: recon?.source ?? null, reconAt: recon?.reconciledAt ?? null,
            })
            logAudit('settlement', settlementId, 'update', [
              { field: 'reconciliation', oldValue: null, newValue: data.source },
            ])
          }
        } catch { /* 降级 */ }
      },

      getBrandSettlements: (brandId) =>
        get().settlements.filter((s) => s.brandId === brandId),

      getTotalReceivable: () =>
        get()
          .settlements.filter((s) => s.status !== 'paid')
          .reduce((sum, s) => sum + s.totalAmount, 0),

      getTotalGMV: () =>
        get().settlements.reduce((sum, s) => sum + s.gmv, 0),

      getBrandPnL: (brandId) => {
        const brand = get().brands.find((b) => b.id === brandId)
        if (!brand) return null
        const ss = get().settlements.filter((s) => s.brandId === brandId)
        const totalRevenue = ss.reduce((sum, s) => sum + s.totalAmount, 0)
        const totalDeductions = ss.reduce((sum, s) => s.reconciliation?.deductions || 0 + sum, 0)
        return {
          brandId,
          brandName: brand.name,
          totalGmv: ss.reduce((sum, s) => sum + s.gmv, 0),
          totalRevenue,
          totalDeductions,
          totalReceivable: ss.filter((s) => s.status !== 'paid').reduce((sum, s) => sum + s.totalAmount, 0),
          totalPaid: ss.filter((s) => s.status === 'paid').reduce((sum, s) => sum + s.totalAmount, 0),
          profit: totalRevenue - totalDeductions,
          months: ss
            .sort((a, b) => b.month.localeCompare(a.month))
            .map((s) => ({ month: s.month, gmv: s.gmv, revenue: s.totalAmount, status: s.status })),
        }
      },

      getAllBrandPnL: () => {
        const { brands } = get()
        return brands.map((b) => get().getBrandPnL(b.id)!).filter(Boolean)
      },
    }),
    {
      name: 'mbe-brand-store',
      version: 1,
    },
  ),
)
