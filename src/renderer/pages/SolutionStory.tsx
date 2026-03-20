/**
 * SolutionStory — 方案 Scrollytelling 交互叙事页
 *
 * 五幕结构，滚动驱动：
 *   1. 痛点共鸣（数字逐字浮现）
 *   2. AI 专家团队登场（头像依次亮起）
 *   3. 工作流演示（时间线推进）
 *   4. ROI 数字跳动（计数器）
 *   5. CTA 行动召唤
 *
 * The Pudding 风格：一次只讲一件事，滚动控制节奏。
 */

import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { useScrollytelling } from '@/hooks/useScrollytelling'
import ScrollySection from '@/components/scrollytelling/ScrollySection'
import ScrollyNav from '@/components/scrollytelling/ScrollyNav'
import PainPointChapter from '@/components/scrollytelling/chapters/PainPointChapter'
import ExpertsChapter from '@/components/scrollytelling/chapters/ExpertsChapter'
import WorkflowChapter from '@/components/scrollytelling/chapters/WorkflowChapter'
import ROIChapter from '@/components/scrollytelling/chapters/ROIChapter'
import CTAChapter from '@/components/scrollytelling/chapters/CTAChapter'
import { SOLUTION_REGISTRY } from '@/lib/solution-router'
import { getSolutionIcon } from '@/lib/solution-icons'

const CHAPTER_IDS = ['pain', 'experts', 'workflow', 'roi', 'cta']
const CHAPTER_LABELS = [
  { id: 'pain', label: '痛点' },
  { id: 'experts', label: '专家' },
  { id: 'workflow', label: '场景' },
  { id: 'roi', label: '价值' },
  { id: 'cta', label: '开始' },
]

export default function SolutionStory() {
  const { solutionId } = useParams<{ solutionId: string }>()
  const navigate = useNavigate()
  const setSolution = useAppStore((s) => s.setSolution)

  const solution = useMemo(
    () => SOLUTION_REGISTRY.find((s) => s.id === solutionId),
    [solutionId],
  )

  const {
    activeChapterId,
    chapters,
    registerChapter,
    scrollTo,
    globalProgress,
  } = useScrollytelling(CHAPTER_IDS)

  const handleStart = useCallback(() => {
    if (solution) {
      setSolution(solution.id)
      navigate('/', { replace: true })
    }
  }, [solution, setSolution, navigate])

  if (!solution) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <p className="text-lg">方案未找到</p>
          <button
            className="mt-4 text-sm text-primary hover:underline"
            onClick={() => navigate('/pick')}
          >
            返回方案选择
          </button>
        </div>
      </div>
    )
  }

  const IconComponent = getSolutionIcon(solution.id)
  const agents = solution.agents.map((a) => ({
    name: a.role,
    description: a.handles,
  }))

  const scenarios = solution.scenarios.map((s) => ({
    label: s.label,
    icon: s.icon,
    expectedOutcome: s.expectedOutcome ?? '',
    profitImpact: s.profitImpact,
  }))

  const painChapter = chapters.get('pain')
  const expertsChapter = chapters.get('experts')
  const workflowChapter = chapters.get('workflow')
  const roiChapter = chapters.get('roi')
  const ctaChapter = chapters.get('cta')

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* 导航 */}
      <ScrollyNav
        chapters={CHAPTER_LABELS}
        activeId={activeChapterId}
        globalProgress={globalProgress}
        onNavigate={scrollTo}
      />

      {/* 返回按钮 */}
      <button
        className="fixed top-4 left-4 z-50 text-xs text-muted-foreground/50 hover:text-foreground transition-colors flex items-center gap-1"
        onClick={() => navigate('/pick')}
      >
        ← 返回
      </button>

      {/* 第一幕：痛点 */}
      <ScrollySection
        id="pain"
        sectionRef={registerChapter('pain')}
        progress={painChapter?.progress ?? 0}
        visible={painChapter?.visible ?? false}
        scrollHeight={4}
      >
        <PainPointChapter
          progress={painChapter?.progress ?? 0}
          tagline={solution.tagline}
          description={solution.description}
          profitMetrics={solution.profitMetrics}
          valueEquivalent={solution.valueEquivalent}
        />
      </ScrollySection>

      {/* 第二幕：AI 专家登场 */}
      <ScrollySection
        id="experts"
        sectionRef={registerChapter('experts')}
        progress={expertsChapter?.progress ?? 0}
        visible={expertsChapter?.visible ?? false}
        scrollHeight={3}
      >
        <ExpertsChapter
          progress={expertsChapter?.progress ?? 0}
          solutionName={solution.name}
          agents={agents}
          entrepreneurPurpose={solution.entrepreneurPurpose}
        />
      </ScrollySection>

      {/* 第三幕：工作流场景 */}
      <ScrollySection
        id="workflow"
        sectionRef={registerChapter('workflow')}
        progress={workflowChapter?.progress ?? 0}
        visible={workflowChapter?.visible ?? false}
        scrollHeight={4}
      >
        <WorkflowChapter
          progress={workflowChapter?.progress ?? 0}
          scenarios={scenarios}
        />
      </ScrollySection>

      {/* 第四幕：ROI */}
      <ScrollySection
        id="roi"
        sectionRef={registerChapter('roi')}
        progress={roiChapter?.progress ?? 0}
        visible={roiChapter?.visible ?? false}
        scrollHeight={4}
      >
        <ROIChapter
          progress={roiChapter?.progress ?? 0}
          profitMetrics={solution.profitMetrics}
          valueEquivalent={solution.valueEquivalent}
        />
      </ScrollySection>

      {/* 第五幕：CTA */}
      <ScrollySection
        id="cta"
        sectionRef={registerChapter('cta')}
        progress={ctaChapter?.progress ?? 0}
        visible={ctaChapter?.visible ?? false}
        scrollHeight={2}
      >
        <CTAChapter
          progress={ctaChapter?.progress ?? 0}
          solutionName={solution.name}
          solutionIcon={solution.icon}
          solutionColor={solution.color}
          IconComponent={IconComponent}
          tagline={solution.tagline}
          onStart={handleStart}
        />
      </ScrollySection>
    </div>
  )
}
