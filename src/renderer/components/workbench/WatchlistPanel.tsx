/**
 * WatchlistPanel — 投研方案自选股看板
 *
 * P1-1: 四列看板（关注/持仓/候选/清仓），每张卡片显示核心指标
 */
import { TrendingUp, TrendingDown, Minus, Search } from 'lucide-react'
import { useToolStore } from '@/stores/tool-store'

interface StockCard {
  code: string
  name: string
  price: number
  change: number
  pe: number
  misesScore?: number
  note: string
  market?: 'A' | 'HK' | 'US'
}

const MOCK_COLUMNS: { id: string; title: string; color: string; cards: StockCard[] }[] = [
  {
    id: 'watching', title: '关注', color: 'border-blue-500/30 bg-blue-500/5',
    cards: [
      { code: '688256', name: '寒武纪', price: 285.60, change: 4.2, pe: -1, misesScore: 3.8, note: 'AI算力龙头，关注年报', market: 'A' },
      { code: '002475', name: '立讯精密', price: 38.50, change: -1.3, pe: 22.5, misesScore: 4.1, note: '果链+汽车，估值合理区间', market: 'A' },
      { code: '300750', name: '宁德时代', price: 198.00, change: 0.8, pe: 18.2, misesScore: 4.5, note: '全球电池龙头', market: 'A' },
      { code: 'NVDA', name: 'NVIDIA', price: 875.30, change: 2.1, pe: 65.3, misesScore: 4.8, note: 'AI算力霸主，注意估值', market: 'US' },
      { code: 'MSFT', name: 'Microsoft', price: 425.10, change: 0.5, pe: 35.8, misesScore: 4.6, note: 'AI+云双轮驱动', market: 'US' },
    ],
  },
  {
    id: 'holding', title: '持仓', color: 'border-emerald-500/30 bg-emerald-500/5',
    cards: [
      { code: '600519', name: '贵州茅台', price: 1580.00, change: -0.3, pe: 24.1, misesScore: 4.7, note: '底仓 15%，止损位 1450', market: 'A' },
      { code: '000858', name: '五粮液', price: 142.80, change: 1.1, pe: 19.8, misesScore: 4.2, note: '底仓 10%', market: 'A' },
      { code: 'AAPL', name: 'Apple', price: 178.50, change: -0.6, pe: 28.5, misesScore: 4.4, note: '持仓 8%，关注AI布局', market: 'US' },
    ],
  },
  {
    id: 'candidate', title: '候选', color: 'border-amber-500/30 bg-amber-500/5',
    cards: [
      { code: '002230', name: '科大讯飞', price: 52.30, change: 3.5, pe: 95.0, misesScore: 3.2, note: '估值偏高，等回调到45', market: 'A' },
      { code: '688111', name: '金山办公', price: 298.00, change: -2.1, pe: 72.0, misesScore: 3.6, note: 'AI办公龙头，右侧信号待确认', market: 'A' },
    ],
  },
  {
    id: 'exited', title: '已清仓', color: 'border-gray-500/30 bg-gray-500/5',
    cards: [
      { code: '300059', name: '东方财富', price: 18.20, change: -0.8, pe: 28.0, note: '互联网券商格局恶化，已止盈' },
    ],
  },
]

export default function WatchlistPanel() {
  const { selectStockAndResearch, selectedStock } = useToolStore()

  const handleCardClick = (card: StockCard) => {
    selectStockAndResearch({
      ticker: card.code,
      name: card.name,
      market: card.market ?? 'A',
    }, 'stock_screening')
  }

  return (
    <div className="flex-1 overflow-x-auto p-4">
      {/* 当前选中提示 */}
      {selectedStock && (
        <div className="mb-3 px-3 py-2 rounded-lg border border-primary/20 bg-primary/5 text-xs text-primary flex items-center gap-2 max-w-max">
          <Search className="w-3 h-3 shrink-0" />
          当前研究标的：<span className="font-semibold">{selectedStock.name}（{selectedStock.ticker}）</span>
          <span className="text-muted-foreground">· 点击任意股票卡片切换</span>
        </div>
      )}
      <div className="flex gap-4 min-w-max">
        {MOCK_COLUMNS.map((col) => (
          <div key={col.id} className="w-72 shrink-0">
            <div className={`rounded-xl border p-3 ${col.color}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
                <span className="text-xs text-muted-foreground">{col.cards.length} 只</span>
              </div>
              <div className="space-y-2">
                {col.cards.map((card) => {
                  const isSelected = selectedStock?.ticker === card.code
                  return (
                    <div
                      key={card.code}
                      onClick={() => handleCardClick(card)}
                      className={`p-3 rounded-lg bg-card border transition-all cursor-pointer group relative
                        ${isSelected
                          ? 'border-primary/60 shadow-sm ring-1 ring-primary/20'
                          : 'border-border/40 hover:border-primary/30 hover:shadow-sm'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground">{card.name}</span>
                          <span className="text-[11px] text-muted-foreground">{card.code}</span>
                          {isSelected && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">研究中</span>
                          )}
                        </div>
                        <ChangeIndicator change={card.change} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1.5">
                        <span>¥{card.price.toLocaleString()}</span>
                        <span>PE {card.pe > 0 ? card.pe.toFixed(1) : '亏损'}</span>
                        {card.misesScore && (
                          <span className={`font-medium ${card.misesScore >= 4 ? 'text-emerald-500' : card.misesScore >= 3 ? 'text-amber-500' : 'text-red-500'}`}>
                            M {card.misesScore.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground line-clamp-1">{card.note}</div>
                      {/* hover 时显示研究提示 */}
                      {!isSelected && (
                        <div className="absolute inset-0 rounded-lg bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-xs text-primary font-medium flex items-center gap-1">
                            <Search className="w-3 h-3" /> 点击开始研究
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChangeIndicator({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs font-medium text-red-500">
        <TrendingUp className="w-3 h-3" />+{change.toFixed(1)}%
      </span>
    )
  }
  if (change < 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-500">
        <TrendingDown className="w-3 h-3" />{change.toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
      <Minus className="w-3 h-3" />0.0%
    </span>
  )
}
