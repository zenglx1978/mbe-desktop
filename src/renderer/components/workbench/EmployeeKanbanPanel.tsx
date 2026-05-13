/**
 * EmployeeKanbanPanel — 劳务派遣员工花名册看板
 *
 * 四列：待入职 → 在岗 → 待退回 → 已离职
 * Mock 数据，后续对接 HR Agent API
 */
import { Users, UserPlus, UserMinus, UserX } from 'lucide-react'

interface Employee {
  name: string
  position: string
  employer: string
  daysLeft?: number
  salary?: string
}

interface KanbanColumn {
  title: string
  icon: React.ReactNode
  color: string
  bgColor: string
  borderColor: string
  items: Employee[]
}

const COLUMNS: KanbanColumn[] = [
  {
    title: '待入职',
    icon: <UserPlus className="w-4 h-4" />,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    items: [
      { name: '赵某', position: '仓库管理员', employer: 'XX物流', daysLeft: 3 },
      { name: '钱某', position: '装配工', employer: 'YY制造', daysLeft: 5 },
    ],
  },
  {
    title: '在岗',
    icon: <Users className="w-4 h-4" />,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    items: [
      { name: '孙某', position: '叉车司机', employer: 'XX物流', salary: '¥6,500' },
      { name: '李某', position: '质检员', employer: 'YY制造', salary: '¥5,800' },
      { name: '周某', position: '客服专员', employer: 'ZZ科技', salary: '¥5,200' },
    ],
  },
  {
    title: '待退回',
    icon: <UserMinus className="w-4 h-4" />,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    items: [
      { name: '吴某', position: '装配工', employer: 'YY制造', daysLeft: 7 },
    ],
  },
  {
    title: '已离职',
    icon: <UserX className="w-4 h-4" />,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20',
    items: [
      { name: '郑某', position: '保安', employer: 'AA物业' },
      { name: '王某', position: '清洁工', employer: 'AA物业' },
    ],
  },
]

export default function EmployeeKanbanPanel() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {COLUMNS.map((col) => (
        <div key={col.title} className={`rounded-xl border ${col.borderColor} bg-card overflow-hidden`}>
          <div className={`flex items-center gap-2 px-3 py-2 ${col.bgColor}`}>
            <span className={col.color}>{col.icon}</span>
            <span className={`text-xs font-semibold ${col.color}`}>{col.title}</span>
            <span className={`ml-auto text-[11px] font-bold ${col.color} bg-background/60 px-1.5 py-0.5 rounded-full`}>
              {col.items.length}
            </span>
          </div>
          <div className="p-2 space-y-1.5">
            {col.items.map((emp) => (
              <div
                key={emp.name}
                className="p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="text-xs font-medium text-foreground">{emp.name}</div>
                <div className="text-[11px] text-muted-foreground">{emp.position} · {emp.employer}</div>
                {emp.daysLeft != null && (
                  <div className={`text-[11px] mt-0.5 ${emp.daysLeft <= 3 ? 'text-red-500' : 'text-amber-500'}`}>
                    {emp.daysLeft} 天后到岗
                  </div>
                )}
                {emp.salary && (
                  <div className="text-[11px] text-emerald-500 mt-0.5">{emp.salary}/月</div>
                )}
              </div>
            ))}
            {col.items.length === 0 && (
              <div className="text-[11px] text-muted-foreground text-center py-4">暂无</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
