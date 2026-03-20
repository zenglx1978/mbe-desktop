import { useState } from 'react'
import type { SourceCitation, SourceReliability } from '@/stores/chat-store'

const RELIABILITY_CONFIG: Record<
  SourceReliability,
  { label: string; color: string; bgColor: string; dotColor: string }
> = {
  high: {
    label: '权威来源',
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    dotColor: 'bg-emerald-500',
  },
  medium: {
    label: '一般来源',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    dotColor: 'bg-amber-500',
  },
  low: {
    label: '参考来源',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-900/30',
    dotColor: 'bg-gray-400',
  },
}

function ReliabilityDot({ level }: { level?: SourceReliability }) {
  const config = RELIABILITY_CONFIG[level ?? 'medium']
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${config.dotColor} shrink-0`}
      title={config.label}
    />
  )
}

function SourceCard({
  source,
  index,
  isExpanded,
  onToggle,
}: {
  source: SourceCitation
  index: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const reliability = source.reliability ?? 'medium'
  const config = RELIABILITY_CONFIG[reliability]
  const confidencePct = source.confidence != null ? Math.round(source.confidence * 100) : null

  return (
    <div
      className={`rounded-lg border transition-all duration-200 ${
        isExpanded
          ? 'border-primary/30 bg-primary/5'
          : 'border-border/30 hover:border-primary/20 hover:bg-secondary/30'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-2 px-3 py-2 text-left"
        aria-expanded={isExpanded}
      >
        <span className="text-[10px] font-mono text-primary/60 mt-0.5 shrink-0 w-4 text-right">
          [{index + 1}]
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <ReliabilityDot level={reliability} />
            <span className="text-xs font-medium text-foreground truncate">
              {source.title}
            </span>
            {source.expired && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 shrink-0">
                已过期
              </span>
            )}
          </div>
          {source.ref && !isExpanded && (
            <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">
              {source.ref}
            </p>
          )}
        </div>
        <span
          className={`text-muted-foreground/40 text-[10px] mt-1 shrink-0 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        >
          ▾
        </span>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/20 mx-3">
          <div className="pt-2 space-y-1.5">
            {source.ref && (
              <div className="flex items-start gap-2 text-[11px]">
                <span className="text-muted-foreground/50 shrink-0 w-12">引用</span>
                <span className="text-foreground/80">{source.ref}</span>
              </div>
            )}
            {source.url && (
              <div className="flex items-start gap-2 text-[11px]">
                <span className="text-muted-foreground/50 shrink-0 w-12">来源</span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary/70 hover:text-primary underline truncate"
                >
                  {source.url}
                </a>
              </div>
            )}
            <div className="flex items-center gap-3 text-[11px]">
              <span className={`flex items-center gap-1 ${config.color}`}>
                <ReliabilityDot level={reliability} />
                {config.label}
              </span>
              {confidencePct != null && (
                <span className="text-muted-foreground/60">
                  置信度 {confidencePct}%
                </span>
              )}
              {source.expired && (
                <span className="text-red-500 dark:text-red-400">
                  ⚠ 数据可能已过期
                </span>
              )}
            </div>
            {source.snippet && (
              <div className="mt-1.5 text-[11px] text-foreground/70 bg-secondary/40 rounded px-2 py-1.5 leading-relaxed">
                {source.snippet}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SourcePanel({ sources }: { sources: SourceCitation[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  if (!sources || sources.length === 0) return null

  const highCount = sources.filter(s => s.reliability === 'high').length
  const hasExpired = sources.some(s => s.expired)

  return (
    <div className="mt-2.5" aria-label={`${sources.length} 个知识来源`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-200 ${
          isOpen
            ? 'bg-primary/5 border border-primary/20'
            : 'bg-secondary/30 hover:bg-secondary/50 border border-transparent'
        }`}
        aria-expanded={isOpen}
      >
        <svg
          className="w-3.5 h-3.5 text-primary/60 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <span className="text-xs text-foreground/70 flex-1">
          基于 <strong className="font-semibold text-foreground/90">{sources.length}</strong> 个知识来源
          {highCount > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 ml-1.5">
              · {highCount} 个权威
            </span>
          )}
          {hasExpired && (
            <span className="text-amber-500 ml-1.5">· 含过期数据</span>
          )}
        </span>
        <span
          className={`text-muted-foreground/40 text-xs transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          ▾
        </span>
      </button>

      {isOpen && (
        <div className="mt-1.5 space-y-1">
          {sources.map((src, i) => (
            <SourceCard
              key={i}
              source={src}
              index={i}
              isExpanded={expandedIdx === i}
              onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
