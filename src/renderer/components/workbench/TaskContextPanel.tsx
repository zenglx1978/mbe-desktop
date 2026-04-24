/**
 * TaskContextPanel — QuickBooks 风格任务上下文面板
 *
 * P0-3: 把"辅助工具"提升为主要任务场景
 * P1-4: Workflow 卡片简化 — 只显示"开始"按钮，点进去再展开步骤
 *
 * 每个 taskId（bookkeeping/invoices/tax-filing/reports/tax-planning）
 * 有自己的场景描述、快捷操作和关联工作流。
 */
import { useState, lazy, Suspense } from 'react'
import { useToolStore } from '@/stores/tool-store'
import type { SolutionConfig, WorkflowConfig } from '@/lib/solution-router'

const CaseKanbanPanel = lazy(() => import('./CaseKanbanPanel'))
const EmployeeKanbanPanel = lazy(() => import('./EmployeeKanbanPanel'))
const WatchlistPanel = lazy(() => import('./WatchlistPanel'))
import {
  Play, ChevronDown, ChevronRight, CheckCircle2,
  FileText, Receipt, Calculator, AlertTriangle,
  Sparkles, ArrowRight,
  Scale, FileSignature, FilePen, BadgeDollarSign,
  Clock, Gavel,
  UserPlus, Users, Banknote, ShieldAlert, ClipboardList,
  Search, Briefcase, Globe, FileCheck, TrendingUp, BarChart3, Target,
} from 'lucide-react'

interface Props {
  solution: SolutionConfig
  taskId: string
}

interface TaskContext {
  title: string
  description: string
  icon: React.ReactNode
  workflowIds: string[]
  scenarioIds: string[]
  quickActions: { label: string; prompt: string; icon: React.ReactNode }[]
  toolIds: string[]
}

const TASK_CONTEXTS: Record<string, TaskContext> = {
  bookkeeping: {
    title: '记账',
    description: '发票归集 → 凭证生成 → 科目校验，AI 替你完成 90% 的记账工作',
    icon: <Receipt className="w-5 h-5" />,
    workflowIds: ['monthly_bookkeeping'],
    scenarioIds: [],
    quickActions: [
      { label: '上传发票生成凭证', prompt: '帮我把这张发票生成记账凭证', icon: <Receipt className="w-4 h-4" /> },
      { label: '批量录入银行流水', prompt: '帮我录入本月银行回单', icon: <FileText className="w-4 h-4" /> },
      { label: '核对科目余额', prompt: '检查本月科目余额是否平衡', icon: <CheckCircle2 className="w-4 h-4" /> },
    ],
    toolIds: ['voucher-gen', 'iit', 'vat'],
  },
  invoices: {
    title: '发票',
    description: '发票真伪验证、合规审查、进销项匹配，确保每张发票安全可用',
    icon: <Receipt className="w-5 h-5" />,
    workflowIds: [],
    scenarioIds: ['invoice_check'],
    quickActions: [
      { label: '批量验真', prompt: '帮我验证这批发票的真伪', icon: <CheckCircle2 className="w-4 h-4" /> },
      { label: '进销项匹配', prompt: '检查本月进销项是否匹配，有无异常', icon: <AlertTriangle className="w-4 h-4" /> },
      { label: '发票合规审查', prompt: '检查这批发票是否合规，抬头、税号、金额是否正确', icon: <FileText className="w-4 h-4" /> },
    ],
    toolIds: ['vat'],
  },
  'tax-filing': {
    title: '报税',
    description: '自动计算各税种应纳税额，生成申报数据，提醒截止日期',
    icon: <Calculator className="w-5 h-5" />,
    workflowIds: ['monthly_bookkeeping'],
    scenarioIds: [],
    quickActions: [
      { label: '本月税务申报', prompt: '帮我计算本月税务申报金额', icon: <Calculator className="w-4 h-4" /> },
      { label: '个税代扣代缴', prompt: '帮我计算本月员工个税代扣代缴金额', icon: <Calculator className="w-4 h-4" /> },
      { label: '企业所得税预缴', prompt: '帮我计算本季度企业所得税预缴金额', icon: <Calculator className="w-4 h-4" /> },
      { label: '附加税计算', prompt: '帮我计算本月城建税和教育费附加', icon: <Calculator className="w-4 h-4" /> },
    ],
    toolIds: ['iit', 'vat', 'cit-quarterly'],
  },
  reports: {
    title: '报表',
    description: '资产负债表、利润表、现金流量表 — AI 自动编制和勾稽校验',
    icon: <FileText className="w-5 h-5" />,
    workflowIds: ['monthly_bookkeeping'],
    scenarioIds: ['annual_audit'],
    quickActions: [
      { label: '编制三大报表', prompt: '帮我编制本月资产负债表、利润表和现金流量表', icon: <FileText className="w-4 h-4" /> },
      { label: '报表勾稽校验', prompt: '检查三大报表的勾稽关系是否正确', icon: <CheckCircle2 className="w-4 h-4" /> },
      { label: '年审材料准备', prompt: '准备年度审计需要的材料清单和注意事项', icon: <AlertTriangle className="w-4 h-4" /> },
    ],
    toolIds: [],
  },
  'tax-planning': {
    title: '税务筹划',
    description: '在合法合规前提下降低企业综合税负，每年节税 3-30 万',
    icon: <Sparkles className="w-5 h-5" />,
    workflowIds: ['tax_planning'],
    scenarioIds: ['tax_calc'],
    quickActions: [
      { label: '测算当前税负', prompt: '测算当前企业整体税负率，和行业平均对标', icon: <Calculator className="w-4 h-4" /> },
      { label: '小微企业优惠', prompt: '检查我是否符合小微企业优惠条件，能省多少税', icon: <Sparkles className="w-4 h-4" /> },
      { label: '研发加计扣除', prompt: '评估我的研发费用加计扣除额度', icon: <Calculator className="w-4 h-4" /> },
      { label: '股权结构税务', prompt: '分析当前股权结构的税务影响和优化空间', icon: <FileText className="w-4 h-4" /> },
    ],
    toolIds: ['iit', 'vat', 'cit-quarterly', 'stamp-tax'],
  },
  'business-plan': {
    title: '商业计划书',
    description: '融资 BP 写作 → IPO 板块评估 → 合规诊断，AI 2 周工作量压缩到 3 小时',
    icon: <TrendingUp className="w-5 h-5" />,
    workflowIds: ['bp_writing', 'ipo_board_matching'],
    scenarioIds: ['bp_angel', 'bp_series_a', 'ipo_match'],
    quickActions: [
      { label: '天使轮 BP 起草', prompt: '帮我为融资客户起草天使轮商业计划书，包含市场分析和商业模式', icon: <TrendingUp className="w-4 h-4" /> },
      { label: 'A 轮 BP 写作', prompt: '客户准备启动 A 轮融资，帮我生成完整14章商业计划书', icon: <TrendingUp className="w-4 h-4" /> },
      { label: 'IPO 板块评估', prompt: '客户净利润连续3年超3000万，推荐哪个A股上市板块？', icon: <BarChart3 className="w-4 h-4" /> },
      { label: '股权架构税务', prompt: '融资前股权架构调整，持股平台 vs 个人直接持股哪种税务更优？', icon: <Calculator className="w-4 h-4" /> },
      { label: 'IPO 合规预检', prompt: '客户冲刺 IPO，帮我做12大类合规预检，重点排查关联交易和股权历史', icon: <CheckCircle2 className="w-4 h-4" /> },
    ],
    toolIds: ['bp-wizard'],
  },

  // ── 律所方案任务上下文 ──
  cases: {
    title: '案件管理',
    description: '案件全生命周期：立案 → 证据 → 开庭 → 判决 → 执行，截止日自动提醒',
    icon: <Scale className="w-5 h-5" />,
    workflowIds: ['case_management'],
    scenarioIds: ['case_analysis', 'compensation_calc'],
    quickActions: [
      { label: '新建案件', prompt: '帮我立案登记一个新的民事诉讼案件', icon: <Scale className="w-4 h-4" /> },
      { label: '分析案情', prompt: '帮我分析这个案件的争议焦点和诉讼策略', icon: <FileText className="w-4 h-4" /> },
      { label: '计算赔偿', prompt: '帮我计算这个案件的赔偿金额', icon: <Calculator className="w-4 h-4" /> },
      { label: '查诉讼时效', prompt: '判断案件是否在诉讼时效内', icon: <Clock className="w-4 h-4" /> },
      { label: '庭审转写', prompt: '上传庭审录音进行转写和法律要点提取', icon: <Gavel className="w-4 h-4" /> },
    ],
    toolIds: ['compensation', 'litigation-fee', 'statute'],
  },
  contracts: {
    title: '合同管理',
    description: '合同审查 → 风险标注 → 修改建议 → 到期跟踪，逐条标注高风险条款',
    icon: <FileSignature className="w-5 h-5" />,
    workflowIds: ['contract_lifecycle'],
    scenarioIds: ['contract_review'],
    quickActions: [
      { label: '审查合同', prompt: '帮我审查这份合同，标注风险条款并给出修改建议', icon: <FileSignature className="w-4 h-4" /> },
      { label: '起草合同', prompt: '帮我起草一份合同', icon: <FilePen className="w-4 h-4" /> },
      { label: '违约金计算', prompt: '帮我计算违约金和定金双倍返还', icon: <Calculator className="w-4 h-4" /> },
      { label: '合同到期提醒', prompt: '列出即将到期的合同', icon: <AlertTriangle className="w-4 h-4" /> },
    ],
    toolIds: ['compensation', 'litigation-fee'],
  },
  'legal-docs': {
    title: '法律文书',
    description: '律师函、起诉状、答辩状、代理词 — AI 生成初稿 + 律师修改终稿',
    icon: <FilePen className="w-5 h-5" />,
    workflowIds: ['legal_writing'],
    scenarioIds: ['legal_doc_gen'],
    quickActions: [
      { label: '起草律师函', prompt: '帮我起草一份律师函', icon: <FilePen className="w-4 h-4" /> },
      { label: '起诉状', prompt: '帮我起草民事起诉状', icon: <FileText className="w-4 h-4" /> },
      { label: '答辩状', prompt: '帮我起草答辩状', icon: <FileText className="w-4 h-4" /> },
      { label: '代理词', prompt: '帮我起草代理词', icon: <Gavel className="w-4 h-4" /> },
    ],
    toolIds: [],
  },
  billing: {
    title: '收费管理',
    description: '诉讼费计算 + 律师费报价 + 客户账单 + 代收代付台账',
    icon: <BadgeDollarSign className="w-5 h-5" />,
    workflowIds: [],
    scenarioIds: ['fee_calc'],
    quickActions: [
      { label: '计算诉讼费', prompt: '帮我计算案件受理费', icon: <Calculator className="w-4 h-4" /> },
      { label: '律师费报价', prompt: '根据案件情况给出律师费报价参考', icon: <BadgeDollarSign className="w-4 h-4" /> },
      { label: '生成客户账单', prompt: '帮我生成本月客户账单', icon: <Receipt className="w-4 h-4" /> },
      { label: '本月创收统计', prompt: '统计本月律所收入和待收', icon: <Sparkles className="w-4 h-4" /> },
    ],
    toolIds: ['litigation-fee', 'compensation'],
  },

  // ── 劳务派遣方案任务上下文 ──
  employees: {
    title: '员工管理',
    description: '入离职全流程 + 派遣状态追踪 + 合同到期提醒 + 花名册管理',
    icon: <Users className="w-5 h-5" />,
    workflowIds: ['onboarding'],
    scenarioIds: ['batch_onboard'],
    quickActions: [
      { label: '新员工入职', prompt: '启动新员工入职派遣流程', icon: <UserPlus className="w-4 h-4" /> },
      { label: '批量入职', prompt: '20名新员工同时入职的流程和注意事项', icon: <Users className="w-4 h-4" /> },
      { label: '合同续签', prompt: '列出即将到期的劳动合同，给出续签方案', icon: <ClipboardList className="w-4 h-4" /> },
      { label: '员工退回', prompt: '用工单位要退回派遣工，分析退回方案和补偿', icon: <AlertTriangle className="w-4 h-4" /> },
    ],
    toolIds: ['labor-compensation', 'probation-salary', 'annual-leave'],
  },
  payroll: {
    title: '薪资结算',
    description: '考勤汇总 → 工资计算 → 社保扣缴 → 个税 → 发放，零差错批量结算',
    icon: <Banknote className="w-5 h-5" />,
    workflowIds: ['payroll_settlement'],
    scenarioIds: ['social_insurance'],
    quickActions: [
      { label: '月度薪资结算', prompt: '启动本月薪资结算流程', icon: <Banknote className="w-4 h-4" /> },
      { label: '加班费计算', prompt: '计算本月派遣工加班费', icon: <Calculator className="w-4 h-4" /> },
      { label: '社保核算', prompt: '检查本月社保缴纳基数和金额', icon: <ShieldAlert className="w-4 h-4" /> },
      { label: '个税代扣', prompt: '计算本月派遣工个税代扣代缴金额', icon: <Calculator className="w-4 h-4" /> },
    ],
    toolIds: ['salary-tax', 'overtime-calc'],
  },
  compliance: {
    title: '合规检查',
    description: '用工比例 ≤ 10%、三性岗位、同工同酬、合同合规 — 一键全面体检',
    icon: <ShieldAlert className="w-5 h-5" />,
    workflowIds: [],
    scenarioIds: ['contract_check', 'overtime_risk'],
    quickActions: [
      { label: '派遣比例检测', prompt: '检查当前派遣用工比例是否超过10%法定上限', icon: <ShieldAlert className="w-4 h-4" /> },
      { label: '审查派遣协议', prompt: '审查劳务派遣协议的合规性', icon: <FileText className="w-4 h-4" /> },
      { label: '三性岗位核查', prompt: '检查派遣岗位是否符合临时性、辅助性、替代性要求', icon: <CheckCircle2 className="w-4 h-4" /> },
      { label: '同工同酬检查', prompt: '检查派遣工与正式工的薪酬差异是否合规', icon: <ClipboardList className="w-4 h-4" /> },
    ],
    toolIds: ['dispatch-ratio', 'labor-compensation'],
  },
  disputes: {
    title: '纠纷处理',
    description: '事实认定 → 法律分析 → 赔偿计算 → 应对策略，三位专家流水线协作',
    icon: <Gavel className="w-5 h-5" />,
    workflowIds: ['dispute_resolution'],
    scenarioIds: ['dismiss'],
    quickActions: [
      { label: '辞退方案', prompt: '公司想辞退一名员工，分析合法的辞退方案和经济补偿', icon: <Gavel className="w-4 h-4" /> },
      { label: '赔偿计算', prompt: '计算经济补偿金 N/N+1/2N', icon: <Calculator className="w-4 h-4" /> },
      { label: '仲裁应对', prompt: '员工申请了劳动仲裁，帮我分析应对策略', icon: <AlertTriangle className="w-4 h-4" /> },
      { label: '工伤处理', prompt: '员工发生工伤，分析工伤认定和赔偿方案', icon: <FileText className="w-4 h-4" /> },
    ],
    toolIds: ['labor-compensation', 'litigation-fee'],
  },
  // ── 投研方案: 任务导向 tab ──
  research: {
    title: '研究',
    description: '行业深度 → 个股筛选 → 估值建模 → 投资建议，从发现到交付一站完成',
    icon: <Search className="w-5 h-5" />,
    workflowIds: ['stock_research', 'four_pillar_full'],
    scenarioIds: ['pillar_stock', 'ai_chain'],
    quickActions: [
      { label: '个股深度分析', prompt: '对指定个股进行深度分析，输出投资建议', icon: <Search className="w-4 h-4" /> },
      { label: '行业深度研究', prompt: '对指定行业进行深度分析，含竞争格局和核心标的', icon: <BarChart3 className="w-4 h-4" /> },
      { label: 'MISES 五维评分', prompt: '对指定个股进行 MISES 五维评分', icon: <Target className="w-4 h-4" /> },
      { label: 'AI 产业链分析', prompt: '分析 AI 产业链上下游投资机会', icon: <TrendingUp className="w-4 h-4" /> },
    ],
    toolIds: ['mises-score', 'financial-ratio', 'valuation-calc'],
  },
  portfolio: {
    title: '组合',
    description: '持仓回顾 → 风险暴露 → 估值检查 → 调仓建议，纪律化组合管理',
    icon: <Briefcase className="w-5 h-5" />,
    workflowIds: ['four_pillar_full'],
    scenarioIds: ['pillar_operation', 'four_pillar_dashboard'],
    quickActions: [
      { label: '持仓检视', prompt: '回顾当前持仓的表现和风险暴露', icon: <Briefcase className="w-4 h-4" /> },
      { label: '调仓建议', prompt: '根据最新市场信号给出调仓方案', icon: <ArrowRight className="w-4 h-4" /> },
      { label: '风险计算', prompt: '计算当前组合的行业集中度和最大回撤', icon: <AlertTriangle className="w-4 h-4" /> },
      { label: '收益归因', prompt: '分析组合收益来源和超额收益贡献', icon: <BarChart3 className="w-4 h-4" /> },
    ],
    toolIds: ['financial-ratio', 'stamp-tax'],
  },
  macro: {
    title: '宏观',
    description: 'WorldMonitor 全球信号 → GEI/DPI/MEI 评分 → BUY/CASH 决策 → 行业轮动',
    icon: <Globe className="w-5 h-5" />,
    workflowIds: ['four_pillar_full'],
    scenarioIds: ['pillar_macro', 'pillar_hotspot', 'macro_report'],
    quickActions: [
      { label: '该不该买（BUY/CASH）', prompt: '当前市场环境下应该加仓还是减仓？', icon: <TrendingUp className="w-4 h-4" /> },
      { label: '全球宏观报告', prompt: '生成全球宏观市场环境报告', icon: <Globe className="w-4 h-4" /> },
      { label: '行业轮动', prompt: '当前最值得关注的行业板块有哪些？', icon: <BarChart3 className="w-4 h-4" /> },
      { label: '地缘风险评估', prompt: '当前地缘政治风险对市场的影响评估', icon: <AlertTriangle className="w-4 h-4" /> },
    ],
    toolIds: ['financial-ratio'],
  },
  'compliance-pub': {
    title: '合规发布',
    description: '内容审查 → 利益冲突 → 信息披露 → 免责声明 → 发布清单，合规前置零风险',
    icon: <FileCheck className="w-5 h-5" />,
    workflowIds: [],
    scenarioIds: ['report_review'],
    quickActions: [
      { label: '研报合规审查', prompt: '审查研报内容的合规性：来源标注、预测规范、利益冲突', icon: <FileCheck className="w-4 h-4" /> },
      { label: '免责声明生成', prompt: '为研报生成标准免责声明和风险提示', icon: <FileText className="w-4 h-4" /> },
      { label: '信息披露检查', prompt: '检查研报是否满足信息披露要求', icon: <ClipboardList className="w-4 h-4" /> },
      { label: '利益冲突审查', prompt: '检查是否存在未披露的利益冲突', icon: <AlertTriangle className="w-4 h-4" /> },
    ],
    toolIds: [],
  },
}

// ── 香港財稅方案任務上下文（HK-specific，無增值稅/個稅/企業所得稅）──
const HK_TASK_CONTEXTS: Record<string, TaskContext> = {
  bookkeeping: {
    title: '帳務處理',
    description: '銀行月結單歸集 → 會計分錄生成 → 科目校驗，AI 替您完成 90% 的記帳工作',
    icon: <Receipt className="w-5 h-5" />,
    workflowIds: ['monthly_bookkeeping'],
    scenarioIds: [],
    quickActions: [
      { label: '上傳銀行月結單生成分錄', prompt: '幫我根據銀行月結單生成會計分錄', icon: <Receipt className="w-4 h-4" /> },
      { label: '核對應收應付款項', prompt: '幫我核對本月應收款項和應付款項餘額', icon: <FileText className="w-4 h-4" /> },
      { label: '校驗科目餘額', prompt: '檢查本月科目餘額是否平衡，有無異常', icon: <CheckCircle2 className="w-4 h-4" /> },
    ],
    toolIds: [],
  },
  invoices: {
    title: '單據管理',
    description: '商業收據、採購單據歸集與合規審查，確保每份憑證真實可用，符合 IRD 要求',
    icon: <Receipt className="w-5 h-5" />,
    workflowIds: [],
    scenarioIds: [],
    quickActions: [
      { label: '上傳並整理商業收據', prompt: '幫我整理和歸類這批商業收據', icon: <CheckCircle2 className="w-4 h-4" /> },
      { label: '核對採購單據完整性', prompt: '核對本月採購單據是否完整，有無缺漏', icon: <AlertTriangle className="w-4 h-4" /> },
      { label: '單據合規審查（IRD 要求）', prompt: '檢查這批單據是否符合 IRD 要求，金額、日期、供應商資料是否齊全', icon: <FileText className="w-4 h-4" /> },
    ],
    toolIds: [],
  },
  'tax-filing': {
    title: '報稅',
    description: '利得稅、薪俸稅、物業稅 — 自動計算應繳稅款，生成 IRD 申報數據，提醒截止日',
    icon: <Calculator className="w-5 h-5" />,
    workflowIds: [],
    scenarioIds: [],
    quickActions: [
      { label: '利得稅計算（Profits Tax 16.5%）', prompt: '幫我計算本年度公司應繳利得稅，適用稅率 16.5%', icon: <Calculator className="w-4 h-4" /> },
      { label: '薪俸稅代扣核算', prompt: '幫我核算員工薪俸稅代扣款項及月末申報', icon: <Calculator className="w-4 h-4" /> },
      { label: '物業稅申報準備', prompt: '幫我準備物業稅申報所需材料和計算稅額', icon: <FileText className="w-4 h-4" /> },
      { label: '稅務豁免資格查詢', prompt: '查詢我的公司是否符合離岸收入豁免或其他利得稅豁免條件', icon: <Sparkles className="w-4 h-4" /> },
    ],
    toolIds: [],
  },
  reports: {
    title: '財務報告',
    description: 'HKFRS 合規財務報告 — 資產負債表、損益表、現金流量表，AI 自動編制與勾稽校驗',
    icon: <FileText className="w-5 h-5" />,
    workflowIds: ['monthly_bookkeeping'],
    scenarioIds: ['annual_audit'],
    quickActions: [
      { label: '編制 HKFRS 三大報表', prompt: '按 HKFRS 標準幫我編制資產負債表、損益表和現金流量表', icon: <FileText className="w-4 h-4" /> },
      { label: '報表勾稽校驗', prompt: '檢查三大報表的勾稽關係是否正確，有無差異', icon: <CheckCircle2 className="w-4 h-4" /> },
      { label: '年度審計材料準備', prompt: '準備年度審計所需的材料清單和注意事項（AFRC 要求）', icon: <AlertTriangle className="w-4 h-4" /> },
    ],
    toolIds: [],
  },
  'tax-planning': {
    title: '稅務規劃',
    description: '在合法合規前提下降低香港及跨境綜合稅負，利用 HK/內地 DTA 及全球最低稅規劃節稅',
    icon: <Sparkles className="w-5 h-5" />,
    workflowIds: [],
    scenarioIds: [],
    quickActions: [
      { label: '稅負率測算與行業對標', prompt: '測算當前企業整體稅負率，與香港同行業平均水平對標', icon: <Calculator className="w-4 h-4" /> },
      { label: 'HK/內地 DTA 稅務規劃', prompt: '分析香港與內地稅務協定（DTA）的節稅機會和最優架構', icon: <Sparkles className="w-4 h-4" /> },
      { label: '轉移定價合規評估', prompt: '評估關聯交易轉移定價的合規風險和文件要求', icon: <FileText className="w-4 h-4" /> },
      { label: 'OECD 全球最低稅評估', prompt: '評估我的企業是否受 OECD Pillar Two 全球最低稅（15%）影響', icon: <Calculator className="w-4 h-4" /> },
    ],
    toolIds: [],
  },
}

// ── 投研方案宏观信号 mock 数据 ──
const MACRO_SIGNALS = [
  { name: '美股(SPX)', signal: 'BUY', score: 78, color: 'text-green-500' },
  { name: 'A股(沪深300)', signal: 'BUY', score: 65, color: 'text-green-500' },
  { name: '美元指数', signal: 'CASH', score: 42, color: 'text-red-500' },
  { name: 'VIX 恐慌', signal: 'LOW', score: 82, color: 'text-green-500' },
  { name: '10Y 美债', signal: 'WATCH', score: 55, color: 'text-amber-500' },
  { name: '黄金', signal: 'BUY', score: 71, color: 'text-green-500' },
  { name: '原油', signal: 'CASH', score: 38, color: 'text-red-500' },
]

// ── 投研方案合规清单 mock 数据 ──
const COMPLIANCE_CHECKLIST = [
  { item: '来源标注完整', status: 'pass' as const },
  { item: '无短期精确预测', status: 'pass' as const },
  { item: '利益冲突已披露', status: 'warn' as const },
  { item: '免责声明完整', status: 'pass' as const },
  { item: '投资建议标注风险等级', status: 'fail' as const },
]

export default function TaskContextPanel({ solution, taskId }: Props) {
  const { setActiveTab, navigateToChat } = useToolStore()
  const isHkSolution = solution.id === 'hk-finance-tax'
  const ctx = isHkSolution
    ? (HK_TASK_CONTEXTS[taskId] ?? TASK_CONTEXTS[taskId])
    : TASK_CONTEXTS[taskId]
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null)

  if (!ctx) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        未知任務類型: {taskId}
      </div>
    )
  }

  const relatedWorkflows = solution.workflows.filter(w => ctx.workflowIds.includes(w.id))
  const relatedScenarios = solution.scenarios.filter(s => ctx.scenarioIds.includes(s.id))
  const relatedTools = solution.tools.filter(t => ctx.toolIds.includes(t.id))

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* 任务标题 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            {ctx.icon}
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">{ctx.title}</h2>
            <p className="text-sm text-muted-foreground">{ctx.description}</p>
          </div>
        </div>

        {/* 快捷操作 — 一键直达 */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">我要...</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ctx.quickActions.map((qa, i) => (
              <QuickActionCard
                key={i}
                icon={qa.icon}
                label={qa.label}
                onClick={() => navigateToChat(qa.prompt)}
              />
            ))}
          </div>
        </section>

        {/* P1-1: 员工花名册看板（仅 employees tab） */}
        {taskId === 'employees' && (
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">👷 员工花名册</h3>
            <Suspense fallback={<div className="h-40 flex items-center justify-center text-xs text-muted-foreground">加载中...</div>}>
              <EmployeeKanbanPanel />
            </Suspense>
          </section>
        )}

        {/* P2-2: 合规检测概览（仅 compliance tab） */}
        {taskId === 'compliance' && (
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">🛡️ 合规状态</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {COMPLIANCE_STATUS.map((item) => (
                <div key={item.label} className="p-3 rounded-lg border border-border/50 bg-card">
                  <div className="text-[11px] text-muted-foreground">{item.label}</div>
                  <div className={`text-lg font-bold mt-1 ${item.color}`}>{item.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* P2-3: 薪资统计概览（仅 payroll tab） */}
        {taskId === 'payroll' && (
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">💰 本月薪资概览</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {PAYROLL_STATS.map((stat) => (
                <div key={stat.label} className="p-3 rounded-lg border border-border/50 bg-card">
                  <div className="text-[11px] text-muted-foreground">{stat.label}</div>
                  <div className={`text-lg font-bold mt-1 ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* P1-2: 案件看板（仅 cases tab） */}
        {taskId === 'cases' && (
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">📋 案件看板</h3>
            <Suspense fallback={<div className="h-40 flex items-center justify-center text-xs text-muted-foreground">加载中...</div>}>
              <CaseKanbanPanel />
            </Suspense>
          </section>
        )}

        {/* P2-2: 合同模板库（仅 contracts tab） */}
        {taskId === 'contracts' && (
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">📄 合同模板</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CONTRACT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => navigateToChat(`帮我起草一份${tpl.name}（${tpl.desc}）`)}
                  className="text-left p-3 rounded-lg border border-border/50 bg-card hover:border-primary/30 hover:shadow-sm transition-all group"
                >
                  <div className="text-lg mb-1">{tpl.icon}</div>
                  <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{tpl.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{tpl.desc}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* P2-3: 律所收费统计（仅 billing tab） */}
        {taskId === 'billing' && (
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">💰 本月收费概览</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {BILLING_STATS.map((stat) => (
                <div key={stat.label} className="p-3 rounded-lg border border-border/50 bg-card">
                  <div className="text-[11px] text-muted-foreground">{stat.label}</div>
                  <div className={`text-lg font-bold mt-1 ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 投研: 自选股看板（仅 portfolio tab） */}
        {taskId === 'portfolio' && (
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">📊 自选股看板</h3>
            <Suspense fallback={<div className="h-40 flex items-center justify-center text-xs text-muted-foreground">加载中...</div>}>
              <WatchlistPanel />
            </Suspense>
          </section>
        )}

        {/* 投研: 宏观信号面板（仅 macro tab） */}
        {taskId === 'macro' && (
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">🌐 WorldMonitor 全球信号</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {MACRO_SIGNALS.map((s) => (
                <div key={s.name} className="p-3 rounded-lg border border-border/50 bg-card">
                  <div className="text-[11px] text-muted-foreground">{s.name}</div>
                  <div className={`text-lg font-bold mt-1 ${s.color}`}>{s.signal}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.score >= 70 ? 'bg-green-500' : s.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${s.score}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{s.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 投研: 合规发布清单（仅 compliance-pub tab） */}
        {taskId === 'compliance-pub' && (
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">✅ 研报发布合规清单</h3>
            <div className="space-y-2">
              {COMPLIANCE_CHECKLIST.map((c) => (
                <div key={c.item} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40 bg-card">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${c.status === 'pass' ? 'bg-green-500/15 text-green-500' : c.status === 'warn' ? 'bg-amber-500/15 text-amber-500' : 'bg-red-500/15 text-red-500'}`}>
                    {c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✕'}
                  </div>
                  <span className="text-sm text-foreground">{c.item}</span>
                  <span className={`ml-auto text-xs ${c.status === 'pass' ? 'text-green-500' : c.status === 'warn' ? 'text-amber-500' : 'text-red-500'}`}>
                    {c.status === 'pass' ? '通过' : c.status === 'warn' ? '需复核' : '未通过'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* P1-4: 简化的 Workflow 卡片 — 只显示标题+"开始"，展开看步骤 */}
        {relatedWorkflows.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">完整流程</h3>
            <div className="space-y-3">
              {relatedWorkflows.map((wf) => (
                <WorkflowCard
                  key={wf.id}
                  workflow={wf}
                  expanded={expandedWorkflow === wf.id}
                  onToggle={() => setExpandedWorkflow(expandedWorkflow === wf.id ? null : wf.id)}
                  onStart={() => setActiveTab('workflows')}
                  locale={isHkSolution ? 'hk' : undefined}
                />
              ))}
            </div>
          </section>
        )}

        {/* 内联计算器 */}
        {relatedTools.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">{isHkSolution ? '計算器' : '计算器'}</h3>
            <div className="flex flex-wrap gap-2">
              {relatedTools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTab('tools')}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-card text-sm hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <span>{tool.icon}</span>
                  <span className="text-foreground">{tool.name}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 相关场景 */}
        {relatedScenarios.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">{isHkSolution ? '常用場景' : '常用场景'}</h3>
            <div className="space-y-2">
              {relatedScenarios.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => navigateToChat(sc.prompt)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:border-primary/30 transition-colors text-left"
                >
                  <span className="text-lg">{sc.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{sc.label}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{sc.expectedOutcome}</div>
                  </div>
                  {sc.profitImpact && (
                    <span className="text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {sc.profitImpact.amount.slice(0, 20)}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function QuickActionCard({ icon, label, onClick }: {
  icon: React.ReactNode; label: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
    >
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <span className="text-sm font-medium text-foreground flex-1">{label}</span>
      <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
    </button>
  )
}

/** P1-4: Workflow 卡片 — 默认折叠，只显示名称+开始按钮 */
function WorkflowCard({ workflow, expanded, onToggle, onStart, locale }: {
  workflow: WorkflowConfig; expanded: boolean
  onToggle: () => void; onStart: () => void; locale?: 'hk'
}) {
  const isHk = locale === 'hk'
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <span className="text-lg">{workflow.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">{workflow.name}</div>
          <div className="text-xs text-muted-foreground">{workflow.deliverable}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            <Play className="w-3 h-3" />
            {isHk ? '開始' : '开始'}
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
            title={expanded ? (isHk ? '收起步驟' : '收起步骤') : (isHk ? '查看步驟' : '查看步骤')}
          >
            {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {/* P1-4: 展开后才显示步骤详情 */}
      {expanded && (
        <div className="border-t border-border/30 px-4 py-3 bg-muted/20">
          <div className="text-xs text-muted-foreground mb-2">
            {workflow.steps.length} {isHk ? '個步驟' : '个步骤'} · {workflow.mode === 'sequential' ? (isHk ? '按順序執行' : '按顺序执行') : (isHk ? '並行執行' : '并行执行')}
          </div>
          <div className="space-y-2">
            {workflow.steps.map((step, i) => (
              <div key={step.id} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground">{step.label}</div>
                  <div className="text-[11px] text-muted-foreground">{step.goal}</div>
                  {step.profitImpact && (
                    <div className="text-[10px] text-primary mt-0.5">
                      💰 {step.profitImpact.amount}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-border/20">
            <div className="text-[11px] text-muted-foreground">
              ✅ 交付物: {workflow.deliverable}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── P2-2: 合同模板库数据 ──
const CONTRACT_TEMPLATES = [
  { id: 'buy-sell', icon: '🤝', name: '买卖合同', desc: '货物/设备买卖' },
  { id: 'lease', icon: '🏠', name: '租赁合同', desc: '房屋/设备租赁' },
  { id: 'labor', icon: '👔', name: '劳动合同', desc: '全日制/非全日制' },
  { id: 'service', icon: '🔧', name: '服务合同', desc: '技术/咨询服务' },
  { id: 'loan', icon: '💳', name: '借款合同', desc: '企业/个人借贷' },
  { id: 'partnership', icon: '📊', name: '合伙协议', desc: '合伙/股东协议' },
  { id: 'construction', icon: '🏗️', name: '建设工程合同', desc: '施工/监理' },
  { id: 'ip-license', icon: '💡', name: '知识产权许可', desc: '专利/商标许可' },
  { id: 'nda', icon: '🔒', name: '保密协议', desc: 'NDA/竞业限制' },
]

// ── 劳务派遣: 合规检测概览数据 ──
const COMPLIANCE_STATUS = [
  { label: '派遣比例', value: '8.2%', sub: '上限 10%（合规）', color: 'text-emerald-500' },
  { label: '到期合同', value: '3 份', sub: '30 天内到期', color: 'text-amber-500' },
  { label: '三性合规', value: '通过', sub: '全部岗位达标', color: 'text-emerald-500' },
  { label: '同工同酬', value: '1 项偏差', sub: '物流岗薪资差 12%', color: 'text-red-500' },
]

// ── 劳务派遣: 薪资统计概览数据 ──
const PAYROLL_STATS = [
  { label: '应发工资', value: '¥48.6 万', sub: '156 人', color: 'text-foreground' },
  { label: '社保代缴', value: '¥12.3 万', sub: '企业+个人', color: 'text-blue-500' },
  { label: '个税代扣', value: '¥1.8 万', sub: '累计预扣法', color: 'text-amber-500' },
  { label: '实发合计', value: '¥34.5 万', sub: '扣除社保+个税', color: 'text-emerald-500' },
]

// ── P2-3: 律所收费统计数据 ──
const BILLING_STATS = [
  { label: '本月应收', value: '¥12.8 万', sub: '8 个案件', color: 'text-foreground' },
  { label: '已收款', value: '¥8.2 万', sub: '占比 64%', color: 'text-emerald-500' },
  { label: '待收款', value: '¥4.6 万', sub: '3 笔逾期', color: 'text-amber-500' },
  { label: '代收代付', value: '¥3.5 万', sub: '诉讼费/鉴定费', color: 'text-blue-500' },
]
