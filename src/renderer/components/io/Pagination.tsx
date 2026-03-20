import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface PaginationProps {
  current: number
  total: number
  pageSize: number
  onChange: (page: number) => void
  className?: string
}

/** 连续 5 个页码窗口 + 首尾与省略号（总页数≤5 时全部展示） */
function pageItems(totalPages: number, current: number): (number | 'ellipsis')[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const w = 5
  const start = Math.min(Math.max(1, current - Math.floor(w / 2)), totalPages - w + 1)
  const window = Array.from({ length: w }, (_, i) => start + i)
  const out: (number | 'ellipsis')[] = []
  const push = (x: number | 'ellipsis') => {
    if (out.length && out[out.length - 1] === x) return
    out.push(x)
  }
  if (start > 1) {
    push(1)
    if (start > 2) push('ellipsis')
  }
  window.forEach((p) => push(p))
  const lastW = window[w - 1]
  if (lastW < totalPages) {
    if (lastW < totalPages - 1) push('ellipsis')
    push(totalPages)
  }
  return out
}

const btn =
  'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md border text-xs font-medium transition-colors ' +
  'border-neutral-300 bg-neutral-100 text-neutral-800 hover:bg-neutral-200 disabled:pointer-events-none disabled:opacity-40 ' +
  'dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700'

export default function Pagination({ current, total, pageSize, onChange, className }: PaginationProps) {
  const safeSize = Math.max(1, pageSize)
  const totalPages = total <= 0 ? 1 : Math.ceil(total / safeSize)
  const page = Math.min(Math.max(1, current), totalPages)
  const from = total === 0 ? 0 : (page - 1) * safeSize + 1
  const to = total === 0 ? 0 : Math.min(page * safeSize, total)
  const items = pageItems(totalPages, page)

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400 ${className ?? ''}`}
    >
      <span className="tabular-nums">
        第 {from}-{to} 条，共 {total} 条
      </span>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className={`${btn} px-2`}
          aria-label="上一页"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {items.map((item, idx) =>
          item === 'ellipsis' ? (
            <span key={`e-${idx}`} className="px-1 text-neutral-500">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`${btn} ${item === page ? 'border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300' : ''}`}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          className={`${btn} px-2`}
          aria-label="下一页"
          disabled={page >= totalPages || total === 0}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
