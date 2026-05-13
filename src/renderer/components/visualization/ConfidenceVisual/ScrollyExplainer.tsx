/**
 * The Pudding 风格 Scrollytelling 方案解释器
 *
 * 用滚动触发的交互式叙事替代静态营销页。
 * 每个 section 在视口中心时触发动画/高亮。
 *
 * 支持的 section 类型：
 * - hero: 全屏标题 + 背景动效
 * - comparison: 人工 vs AI 对比（渐变动画）
 * - calculator: 互动式 ROI 计算器
 * - workflow: AI 专家协作流程动画
 * - cta: 行动号召
 *
 * 参考 Visualization Strategy 2.3B
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ScrollyConfig, ScrollySection } from '../types'

interface ScrollyExplainerProps {
  config: ScrollyConfig
  className?: string
}

function useIntersectionObserver(threshold = 0.5) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const elementsRef = useRef<Map<string, HTMLElement>>(new Map())

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) elementsRef.current.set(id, el)
    else elementsRef.current.delete(id)
  }, [])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.getAttribute('data-scrolly-id'))
          }
        }
      },
      { threshold, rootMargin: '-20% 0px -20% 0px' },
    )

    const obs = observerRef.current
    for (const el of elementsRef.current.values()) {
      obs.observe(el)
    }

    return () => obs.disconnect()
  }, [threshold])

  return { activeId, register }
}

// ─── Section Renderers ──────────────────────────────────

function HeroSection({ section, active }: { section: ScrollySection; active: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center min-h-[80vh] text-center transition-all duration-700 ${
      active ? 'opacity-100 translate-y-0' : 'opacity-30 translate-y-8'
    }`}>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        {section.title}
      </h1>
      {section.subtitle && (
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-xl">
          {section.subtitle}
        </p>
      )}
      {section.content && (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-500 max-w-md">
          {section.content}
        </p>
      )}
    </div>
  )
}

function ComparisonSection({ section, active }: { section: ScrollySection; active: boolean }) {
  const data = section.data as { human_cost?: string; ai_cost?: string; human_time?: string; ai_time?: string } | undefined
  return (
    <div className={`min-h-[70vh] flex items-center justify-center transition-all duration-700 ${
      active ? 'opacity-100' : 'opacity-20'
    }`}>
      <div className="grid grid-cols-2 gap-8 max-w-2xl w-full">
        {/* 人工 */}
        <div className={`rounded-2xl border-2 p-6 text-center transition-all duration-700 ${
          active
            ? 'border-gray-300 dark:border-gray-600 opacity-50 scale-95'
            : 'border-gray-200 dark:border-gray-700 opacity-100 scale-100'
        }`}>
          <div className="text-4xl mb-3">👤👤👤</div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{section.title}</h3>
          {data?.human_cost && (
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{data.human_cost}</p>
          )}
          {data?.human_time && (
            <p className="text-xs text-gray-500 mt-1">{data.human_time}</p>
          )}
        </div>

        {/* AI */}
        <div className={`rounded-2xl border-2 p-6 text-center transition-all duration-700 ${
          active
            ? 'border-emerald-400 dark:border-emerald-600 opacity-100 scale-105 shadow-xl shadow-emerald-100 dark:shadow-emerald-900/20'
            : 'border-gray-200 dark:border-gray-700 opacity-50 scale-100'
        }`}>
          <div className="text-4xl mb-3">🤖🤖🤖</div>
          <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
            {section.subtitle || 'AI 专家团队'}
          </h3>
          {data?.ai_cost && (
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.ai_cost}</p>
          )}
          {data?.ai_time && (
            <p className="text-xs text-emerald-500 mt-1">{data.ai_time}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function CalculatorSection({ section, active }: { section: ScrollySection; active: boolean }) {
  const [inputValue, setInputValue] = useState(50)
  const data = section.data as { unit_cost_human?: number; unit_cost_ai?: number; unit_label?: string } | undefined
  const humanCost = (data?.unit_cost_human || 6000) * inputValue
  const aiCost = (data?.unit_cost_ai || 500) * inputValue
  const saving = humanCost - aiCost
  const savingPct = humanCost > 0 ? ((saving / humanCost) * 100).toFixed(0) : '0'

  return (
    <div className={`min-h-[70vh] flex items-center justify-center transition-all duration-700 ${
      active ? 'opacity-100 translate-y-0' : 'opacity-20 translate-y-8'
    }`}>
      <div className="max-w-md w-full rounded-2xl border border-gray-200 dark:border-[#3c3c3c] bg-white dark:bg-[#1e1e1e] p-8 shadow-lg">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
          {section.title}
        </h3>
        {section.subtitle && (
          <p className="text-sm text-gray-500 mb-6">{section.subtitle}</p>
        )}

        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
          {data?.unit_label || '人数'}:
          <span className="ml-2 font-bold text-lg tabular-nums">{inputValue}</span>
        </label>
        <input
          type="range"
          min={1}
          max={500}
          value={inputValue}
          onChange={e => setInputValue(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none bg-gray-200 dark:bg-gray-700 cursor-pointer accent-emerald-500"
        />

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 text-center">
            <p className="text-[11px] text-gray-500 mb-1">传统人工成本</p>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-200 tabular-nums">
              ¥{humanCost.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 text-center">
            <p className="text-[11px] text-emerald-600 mb-1">AI 专家团队</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              ¥{aiCost.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 p-4 text-center text-white">
          <p className="text-sm font-medium">每月节省</p>
          <p className="text-3xl font-bold tabular-nums">¥{saving.toLocaleString()}</p>
          <p className="text-sm opacity-80">节省 {savingPct}%</p>
        </div>
      </div>
    </div>
  )
}

function WorkflowSection({ section, active }: { section: ScrollySection; active: boolean }) {
  const [step, setStep] = useState(0)
  const steps = (section.data as { steps?: string[] })?.steps || [
    '用户提问',
    '智能路由',
    '法务专家分析',
    '财务专家计算',
    'HR 专家建议',
    '结果合并',
    '交付方案',
  ]

  useEffect(() => {
    if (!active) { setStep(0); return }
    const timer = setInterval(() => {
      setStep(prev => (prev < steps.length - 1 ? prev + 1 : prev))
    }, 800)
    return () => clearInterval(timer)
  }, [active, steps.length])

  return (
    <div className={`min-h-[70vh] flex items-center justify-center transition-all duration-700 ${
      active ? 'opacity-100' : 'opacity-20'
    }`}>
      <div className="max-w-lg w-full">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">
          {section.title}
        </h3>
        {section.subtitle && (
          <p className="text-sm text-gray-500 mb-8 text-center">{section.subtitle}</p>
        )}

        <div className="space-y-3">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-500 ${
                i < step ? 'bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/40' :
                i === step ? 'bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40 scale-[1.02] shadow-md' :
                'bg-gray-50 dark:bg-gray-800/30 border border-transparent opacity-40'
              }`}
            >
              <div className={`shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold ${
                i < step ? 'bg-emerald-500 text-white' :
                i === step ? 'bg-blue-500 text-white animate-pulse' :
                'bg-gray-200 dark:bg-gray-700 text-gray-400'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${
                i <= step ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-400'
              }`}>
                {s}
              </span>
              {i === step && (
                <span className="ml-auto text-[11px] text-blue-500 animate-pulse">处理中...</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CTASection({ section, active }: { section: ScrollySection; active: boolean }) {
  return (
    <div className={`min-h-[50vh] flex flex-col items-center justify-center text-center transition-all duration-700 ${
      active ? 'opacity-100 scale-100' : 'opacity-30 scale-95'
    }`}>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
        {section.title}
      </h2>
      {section.subtitle && (
        <p className="text-base text-gray-500 dark:text-gray-400 mb-8 max-w-md">
          {section.subtitle}
        </p>
      )}
      <button className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3 text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105">
        {section.content || '立即体验'}
      </button>
    </div>
  )
}

const SECTION_RENDERERS: Record<string, React.ComponentType<{ section: ScrollySection; active: boolean }>> = {
  hero: HeroSection,
  comparison: ComparisonSection,
  calculator: CalculatorSection,
  workflow: WorkflowSection,
  cta: CTASection,
}

// ─── Main Component ─────────────────────────────────────

export function ScrollyExplainer({ config, className = '' }: ScrollyExplainerProps) {
  const { activeId, register } = useIntersectionObserver(0.4)

  return (
    <div className={`${className}`}>
      {/* 进度指示器 */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
        {config.sections.map(section => (
          <div
            key={section.id}
            className={`h-2 w-2 rounded-full transition-all ${
              activeId === section.id
                ? 'bg-emerald-500 scale-150'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
            title={section.title}
          />
        ))}
      </div>

      {/* Sections */}
      {config.sections.map(section => {
        const Renderer = SECTION_RENDERERS[section.type] || HeroSection
        return (
          <div
            key={section.id}
            ref={el => register(section.id, el)}
            data-scrolly-id={section.id}
          >
            <Renderer section={section} active={activeId === section.id} />
          </div>
        )
      })}
    </div>
  )
}

/**
 * 劳务派遣方案的预设 Scrolly 配置
 */
export const LABOR_DISPATCH_SCROLLY: ScrollyConfig = {
  solution_id: 'labor-dispatch',
  solution_name: '劳务派遣一站式方案',
  sections: [
    {
      id: 'hero',
      type: 'hero',
      title: '你的劳务派遣公司，3 个管理岗一年花 30 万',
      subtitle: '但 AI 专家团队只需十分之一成本，7×24 不间断',
    },
    {
      id: 'compare',
      type: 'comparison',
      title: '3 个管理岗',
      subtitle: 'AI 专家团队',
      data: {
        human_cost: '¥25,000/月',
        human_time: '每天 8 小时，节假日休息',
        ai_cost: '¥2,500/月',
        ai_time: '7×24 小时，永不请假',
      },
    },
    {
      id: 'calc',
      type: 'calculator',
      title: '算算你能省多少',
      subtitle: '输入你的派遣工人数，看看 AI 专家团队替你省多少',
      data: {
        unit_cost_human: 500,
        unit_cost_ai: 50,
        unit_label: '派遣工人数',
      },
    },
    {
      id: 'workflow',
      type: 'workflow',
      title: 'AI 专家如何协作处理一次纠纷',
      subtitle: '三位 AI 专家并行分析，2 分钟给出完整方案',
      data: {
        steps: [
          '员工提出纠纷投诉',
          '智能路由到劳务派遣方案',
          '劳动法专家检索《劳动合同法》',
          '薪酬财税专家计算补偿金额',
          'HR 专家生成调解方案',
          '三方结论合并为完整报告',
          '交付：纠纷处理方案 + 法律依据 + 费用明细',
        ],
      },
    },
    {
      id: 'cta',
      type: 'cta',
      title: '让 AI 专家替你干活',
      subtitle: '一次下载，三位专家到位。数据留本地，断线也能用。',
      content: '免费体验',
    },
  ],
}
