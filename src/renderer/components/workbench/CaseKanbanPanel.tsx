/**
 * CaseKanbanPanel — 律所案件看板（四列拖拽视图）
 *
 * P1-2: 案件全生命周期可视化 — 待立案 / 进行中 / 待判决 / 已结案
 * 每张卡片显示：案件名、案由、截止日倒计时、负责律师
 */
import { useState, useCallback } from 'react'
import { useToolStore } from '@/stores/tool-store'
import type { WorkbenchTab } from '@/lib/solution-router'
import {
  Plus, MoreHorizontal, Clock, AlertTriangle,
  User, Scale,
} from 'lucide-react'

interface CaseCard {
  id: string
  name: string
  caseType: string
  lawyer: string
  daysLeft?: number
  amount?: string
  urgent: boolean
}

interface KanbanColumn {
  id: string
  title: string
  color: string
  bgColor: string
  cases: CaseCard[]
}

const MOCK_COLUMNS: KanbanColumn[] = [
  {
    id: 'pending', title: '待立案', color: 'text-amber-500', bgColor: 'bg-amber-500/10',
    cases: [
      { id: 'c1', name: '李某借贷纠纷', caseType: '民间借贷', lawyer: '张律师', daysLeft: 5, amount: '28 万', urgent: true },
      { id: 'c2', name: '赵某合同纠纷', caseType: '买卖合同', lawyer: '王律师', amount: '15 万', urgent: false },
    ],
  },
  {
    id: 'active', title: '进行中', color: 'text-blue-500', bgColor: 'bg-blue-500/10',
    cases: [
      { id: 'c3', name: '张某劳动仲裁案', caseType: '劳动争议', lawyer: '李律师', daysLeft: 3, amount: '12 万', urgent: true },
      { id: 'c4', name: 'XX建工合同纠纷', caseType: '建设工程', lawyer: '张律师', daysLeft: 7, amount: '180 万', urgent: false },
      { id: 'c5', name: '刘某离婚纠纷', caseType: '婚姻家事', lawyer: '王律师', daysLeft: 14, amount: '', urgent: false },
    ],
  },
  {
    id: 'judgment', title: '待判决', color: 'text-violet-500', bgColor: 'bg-violet-500/10',
    cases: [
      { id: 'c6', name: 'YY债权纠纷', caseType: '债权债务', lawyer: '李律师', daysLeft: 28, amount: '50 万', urgent: false },
    ],
  },
  {
    id: 'closed', title: '已结案', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10',
    cases: [
      { id: 'c7', name: '陈某工伤案', caseType: '工伤赔偿', lawyer: '张律师', amount: '8.5 万', urgent: false },
      { id: 'c8', name: '周某知产案', caseType: '商标侵权', lawyer: '王律师', amount: '35 万', urgent: false },
    ],
  },
]

export default function CaseKanbanPanel() {
  const { setActiveTab } = useToolStore()
  const [columns] = useState<KanbanColumn[]>(MOCK_COLUMNS)

  const goToChat = useCallback(() => {
    setActiveTab('chat' as WorkbenchTab)
  }, [setActiveTab])

  const totalActive = columns.reduce((sum, col) => sum + (col.id !== 'closed' ? col.cases.length : 0), 0)
  const urgentCount = columns.reduce((sum, col) => sum + col.cases.filter(c => c.urgent).length, 0)

  return (
    <div className="space-y-4">
      {/* 看板统计 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Scale className="w-3.5 h-3.5" />
            活跃案件 <span className="font-semibold text-foreground">{totalActive}</span>
          </span>
          {urgentCount > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <AlertTriangle className="w-3.5 h-3.5" />
              紧急 {urgentCount}
            </span>
          )}
        </div>
        <button
          onClick={goToChat}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          新建案件
        </button>
      </div>

      {/* 四列看板 */}
      <div className="grid grid-cols-4 gap-3 min-h-[400px]">
        {columns.map((col) => (
          <div key={col.id} className="flex flex-col">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className={`w-2 h-2 rounded-full ${col.bgColor.replace('/10', '')}`} />
              <span className="text-xs font-semibold text-foreground">{col.title}</span>
              <span className="text-[11px] text-muted-foreground ml-auto">{col.cases.length}</span>
            </div>
            <div className="flex-1 space-y-2">
              {col.cases.map((c) => (
                <CaseCardItem key={c.id} card={c} onOpen={goToChat} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CaseCardItem({ card, onOpen }: { card: CaseCard; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left p-3 rounded-lg border border-border/50 bg-card hover:border-primary/30 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between mb-1.5">
        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
          {card.name}
        </span>
        <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0" />
      </div>

      <div className="text-[11px] text-muted-foreground mb-2">{card.caseType}</div>

      <div className="flex items-center gap-2 flex-wrap">
        {card.daysLeft !== undefined && (
          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${card.urgent ? 'bg-red-500/10 text-red-500' : card.daysLeft <= 7 ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
            <Clock className="w-2.5 h-2.5" />
            {card.daysLeft}天
          </span>
        )}
        {card.amount && (
          <span className="text-[10px] text-muted-foreground">
            ¥{card.amount}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <User className="w-2.5 h-2.5" />
          {card.lawyer}
        </span>
      </div>
    </button>
  )
}
