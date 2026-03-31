/**
 * 聊天内嵌流程跳转芯片
 *
 * 识别 mbe:// 协议链接，渲染为可点击的流程芯片：
 *   mbe://workflow/<id>    → 跳转到工作流面板并高亮指定流程
 *   mbe://tab/<tab_name>   → 切换到指定功能标签页
 *   mbe://scenario/<id>    → 跳转到快捷场景
 *   mbe://calc/<type>      → 打开计算器工具
 *
 * 普通 URL 走默认浏览器打开。
 */

import { useCallback, type ReactNode } from 'react'
import { ArrowRight, Play, Calculator, LayoutGrid } from 'lucide-react'
import { useToolStore } from '@/stores/tool-store'
import type { WorkbenchTab } from '@/lib/solution-router'

export interface MbeLink {
  protocol: 'workflow' | 'tab' | 'scenario' | 'calc'
  id: string
}

export function parseMbeLink(href: string): MbeLink | null {
  if (!href.startsWith('mbe://')) return null
  const path = href.slice('mbe://'.length)
  const slashIdx = path.indexOf('/')
  if (slashIdx < 0) return null
  const protocol = path.slice(0, slashIdx)
  const id = path.slice(slashIdx + 1)
  if (!protocol || !id) return null
  if (!['workflow', 'tab', 'scenario', 'calc'].includes(protocol)) return null
  return { protocol: protocol as MbeLink['protocol'], id }
}

const ICON_MAP: Record<MbeLink['protocol'], typeof ArrowRight> = {
  workflow: Play,
  tab: LayoutGrid,
  scenario: ArrowRight,
  calc: Calculator,
}

const ACTION_LABEL: Record<MbeLink['protocol'], string> = {
  workflow: '执行流程',
  tab: '前往',
  scenario: '快捷场景',
  calc: '打开计算器',
}

interface WorkflowActionLinkProps {
  link: MbeLink
  children: ReactNode
}

export function WorkflowActionLink({ link, children }: WorkflowActionLinkProps) {
  const { setActiveTab, navigateToWorkflow, navigateToScenario } = useToolStore()

  const handleClick = useCallback(() => {
    switch (link.protocol) {
      case 'workflow':
        navigateToWorkflow(link.id)
        break
      case 'scenario':
        navigateToScenario(link.id)
        break
      case 'tab':
        setActiveTab(link.id as WorkbenchTab)
        break
      case 'calc':
        setActiveTab('tools')
        break
    }
  }, [link, setActiveTab, navigateToWorkflow, navigateToScenario])

  const Icon = ICON_MAP[link.protocol]

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md
        bg-primary/10 text-primary hover:bg-primary/20
        border border-primary/20 hover:border-primary/30
        text-xs font-medium transition-colors cursor-pointer
        no-underline align-baseline leading-normal"
      title={`${ACTION_LABEL[link.protocol]}：${link.id}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span>{children}</span>
      <ArrowRight className="w-3 h-3 shrink-0 opacity-50" />
    </button>
  )
}

/**
 * ReactMarkdown 自定义 <a> 渲染器
 * 拦截 mbe:// 协议 → WorkflowActionLink；其余 → 普通外链
 */
export function ChatMarkdownLink({
  href,
  children,
}: {
  href?: string
  children?: ReactNode
}) {
  if (!href) return <>{children}</>

  const mbeLink = parseMbeLink(href)
  if (mbeLink) {
    return <WorkflowActionLink link={mbeLink}>{children}</WorkflowActionLink>
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  )
}
