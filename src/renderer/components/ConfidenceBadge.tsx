/**
 * 置信度视觉梯度组件
 *
 * 四级梯度：实色 → 细点 → 斜线 dithering → 虚线交叉
 * 遵循 MBE_VISUALIZATION_STRATEGY.md §5.3 规范
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'very_low'

interface ConfidenceConfig {
  label: string
  hint: string
  iconColor: string
  textColor: string
  cssClass: string
  barWidth: string
}

const CONFIDENCE_LEVELS: Record<ConfidenceLevel, ConfidenceConfig> = {
  high: {
    label: '高可信',
    hint: '有明确法条/准则/规范支撑',
    iconColor: 'text-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    cssClass: 'confidence-high',
    barWidth: '100%',
  },
  medium: {
    label: '较可信',
    hint: '有依据但存在地区/案例差异',
    iconColor: 'text-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    cssClass: 'confidence-medium',
    barWidth: '75%',
  },
  low: {
    label: '参考性',
    hint: '经验判断/行业惯例，非强制规定',
    iconColor: 'text-orange-500',
    textColor: 'text-orange-600 dark:text-orange-400',
    cssClass: 'confidence-low',
    barWidth: '50%',
  },
  very_low: {
    label: '需确认',
    hint: 'AI 推测/建议，需人工确认',
    iconColor: 'text-red-500',
    textColor: 'text-red-500 dark:text-red-400',
    cssClass: 'confidence-very-low',
    barWidth: '25%',
  },
}

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.9) return 'high'
  if (confidence >= 0.7) return 'medium'
  if (confidence >= 0.5) return 'low'
  return 'very_low'
}

export function getConfidenceCssClass(confidence: number | undefined | null): string {
  if (confidence == null) return ''
  return CONFIDENCE_LEVELS[getConfidenceLevel(confidence)].cssClass
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
      <path
        fillRule="evenodd"
        d="M10 1a.75.75 0 01.49.18l6.25 5.25a.75.75 0 01.26.57v3a8.967 8.967 0 01-4.075 7.535l-2.506 1.627a.75.75 0 01-.818 0l-2.506-1.627A8.967 8.967 0 013 10V7a.75.75 0 01.26-.57l6.25-5.25A.75.75 0 0110 1zm0 1.635L4.5 7.29V10a7.467 7.467 0 003.396 6.28L10 17.66l2.104-1.38A7.467 7.467 0 0015.5 10V7.29L10 2.635z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default function ConfidenceBadge({
  confidence,
  compact = false,
}: {
  confidence: number
  compact?: boolean
}) {
  const level = getConfidenceLevel(confidence)
  const config = CONFIDENCE_LEVELS[level]
  const pct = Math.round(confidence * 100)

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] ${config.textColor}`}
        title={`${config.label}（${pct}%）· ${config.hint}`}
      >
        {level === 'very_low' ? (
          <WarningIcon className={config.iconColor} />
        ) : (
          <ShieldIcon className={config.iconColor} />
        )}
        <span>{pct}%</span>
      </span>
    )
  }

  return (
    <div
      className="mt-2 flex items-center gap-2"
      role="status"
      aria-label={`置信度 ${pct}%：${config.hint}`}
    >
      <div className="flex items-center gap-1.5">
        {level === 'very_low' ? (
          <WarningIcon className={`w-3.5 h-3.5 ${config.iconColor}`} />
        ) : (
          <ShieldIcon className={`w-3.5 h-3.5 ${config.iconColor}`} />
        )}
        <span className={`text-[11px] font-medium ${config.textColor}`}>
          {config.label}
        </span>
      </div>

      {/* 置信度进度条 */}
      <div className="flex-1 max-w-[100px] h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            level === 'high'
              ? 'bg-emerald-500'
              : level === 'medium'
                ? 'bg-amber-500'
                : level === 'low'
                  ? 'bg-orange-500'
                  : 'bg-red-500'
          }`}
          style={{ width: config.barWidth }}
        />
      </div>

      <span className={`text-[10px] tabular-nums ${config.textColor}`}>
        {pct}%
      </span>

      {/* 低置信度显示提示 */}
      {(level === 'low' || level === 'very_low') && (
        <span className="text-[10px] text-muted-foreground/50 ml-1">
          {config.hint}
        </span>
      )}
    </div>
  )
}
