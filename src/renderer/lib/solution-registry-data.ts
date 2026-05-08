/**
 * 行业方案注册表（聚合入口）。
 * agent 从 solution-router-agent 引入，避免与 solution-router 形成 ESM 循环依赖
 *（router 依赖本文件的 SOLUTION_REGISTRY，本文件不能再运行时依赖 router 中的 agent）。
 * 对外仍通过 `@/lib/solution-router` 的 re-export 使用 SOLUTION_REGISTRY / agent。
 *
 * 每个方案独立拆分到 solutions/<id>.ts，此文件仅做聚合。
 */
import type { SolutionConfig } from './solution-router'

import { laborDispatchSolution } from './solutions/labor-dispatch'
import { lawFirmSolution } from './solutions/law-firm'
import { financeTaxServiceSolution } from './solutions/finance-tax-service'
import { hkFinanceTaxSolution } from './solutions/hk-finance-tax'
import { constructionCostSolution } from './solutions/construction-cost'
import { clinicRespiratorySolution } from './solutions/clinic-respiratory'
import { smbOperationsSolution } from './solutions/smb-operations'
import { studyAbroadConsultingSolution } from './solutions/study-abroad-consulting'
import { educationTrainingSolution } from './solutions/education-training'
import { ecommerceBrandServiceSolution } from './solutions/ecommerce-brand-service'
import { insuranceOperationsSolution } from './solutions/insurance-operations'
import { investmentResearchSolution } from './solutions/investment-research'
import { professionalServiceMarketingSolution } from './solutions/professional-service-marketing'
import { acquisitionGrowthSolution } from './solutions/acquisition-growth'
import { governmentProcurementSolution } from './solutions/government-procurement'
import { agricultureTechSolution } from './solutions/agriculture-tech'
import { realEstateManagementSolution } from './solutions/real-estate-management'
import { ipAgencySolution } from './solutions/ip-agency'
import { taxAgencySolution } from './solutions/tax-agency'
import { pharmaceuticalComplianceSolution } from './solutions/pharmaceutical-compliance'
import { logisticsSupplyChainSolution } from './solutions/logistics-supply-chain'
import { capitalMarketsSolution } from './solutions/capital-markets'
import { oemManufacturingSolution } from './solutions/oem-manufacturing'
import { legacyErpAiSolution } from './solutions/legacy-erp-ai'

export const SOLUTION_REGISTRY: SolutionConfig[] = [
  laborDispatchSolution,
  lawFirmSolution,
  financeTaxServiceSolution,
  hkFinanceTaxSolution,
  constructionCostSolution,
  clinicRespiratorySolution,
  smbOperationsSolution,
  studyAbroadConsultingSolution,
  educationTrainingSolution,
  ecommerceBrandServiceSolution,
  insuranceOperationsSolution,
  investmentResearchSolution,
  professionalServiceMarketingSolution,
  acquisitionGrowthSolution,
  governmentProcurementSolution,
  agricultureTechSolution,
  realEstateManagementSolution,
  ipAgencySolution,
  taxAgencySolution,
  pharmaceuticalComplianceSolution,
  logisticsSupplyChainSolution,
  capitalMarketsSolution,
  oemManufacturingSolution,
  legacyErpAiSolution,
]
