/**
 * useScrollytelling — 滚动驱动叙事 hook
 *
 * IntersectionObserver 检测章节可见性 + 滚动进度百分比，
 * 不依赖任何第三方动画库，纯 Web API 实现。
 */

import { useEffect, useRef, useState, useCallback } from 'react'

export interface ScrollyChapter {
  id: string
  ref: React.RefObject<HTMLDivElement | null>
  progress: number   // 0-1, 章节内滚动进度
  visible: boolean
}

interface UseScrollytellingReturn {
  /** 当前活跃章节 ID */
  activeChapterId: string
  /** 各章节的进度 Map */
  chapters: Map<string, ScrollyChapter>
  /** 注册章节 ref */
  registerChapter: (id: string) => React.RefObject<HTMLDivElement | null>
  /** 导航到指定章节 */
  scrollTo: (id: string) => void
  /** 全局滚动进度 0-1 */
  globalProgress: number
}

export function useScrollytelling(chapterIds: string[]): UseScrollytellingReturn {
  const refsMap = useRef<Map<string, React.RefObject<HTMLDivElement | null>>>(new Map())
  const [activeChapterId, setActiveChapterId] = useState(chapterIds[0] ?? '')
  const [progressMap, setProgressMap] = useState<Map<string, number>>(new Map())
  const [visibleSet, setVisibleSet] = useState<Set<string>>(new Set())
  const [globalProgress, setGlobalProgress] = useState(0)

  const registerChapter = useCallback((id: string) => {
    if (!refsMap.current.has(id)) {
      const ref = { current: null } as React.RefObject<HTMLDivElement | null>
      refsMap.current.set(id, ref)
    }
    return refsMap.current.get(id)!
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const newVisible = new Set(visibleSet)
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-scrolly-id')
          if (!id) return
          if (entry.isIntersecting) {
            newVisible.add(id)
          } else {
            newVisible.delete(id)
          }
        })
        setVisibleSet(newVisible)

        // 优先取最靠前的可见章节
        for (const cid of chapterIds) {
          if (newVisible.has(cid)) {
            setActiveChapterId(cid)
            break
          }
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '-10% 0px -10% 0px' },
    )

    refsMap.current.forEach((ref, id) => {
      if (ref.current) {
        ref.current.setAttribute('data-scrolly-id', id)
        observer.observe(ref.current)
      }
    })

    return () => observer.disconnect()
  }, [chapterIds, visibleSet])

  // 滚动进度追踪
  useEffect(() => {
    let ticking = false

    const handleScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const newProgress = new Map<string, number>()
        const viewportH = window.innerHeight

        refsMap.current.forEach((ref, id) => {
          if (!ref.current) return
          const rect = ref.current.getBoundingClientRect()
          const sectionH = rect.height
          if (sectionH === 0) {
            newProgress.set(id, 0)
            return
          }
          // 当元素顶部到达视口底部时 progress=0，离开视口顶部时 progress=1
          const raw = (viewportH - rect.top) / (viewportH + sectionH)
          newProgress.set(id, Math.max(0, Math.min(1, raw)))
        })

        setProgressMap(newProgress)

        // 全局进度
        const scrollTop = window.scrollY || document.documentElement.scrollTop
        const docH = document.documentElement.scrollHeight - window.innerHeight
        setGlobalProgress(docH > 0 ? Math.min(1, scrollTop / docH) : 0)

        ticking = false
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = useCallback((id: string) => {
    const ref = refsMap.current.get(id)
    ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const chapters = new Map<string, ScrollyChapter>()
  chapterIds.forEach((id) => {
    chapters.set(id, {
      id,
      ref: refsMap.current.get(id) ?? { current: null },
      progress: progressMap.get(id) ?? 0,
      visible: visibleSet.has(id),
    })
  })

  return { activeChapterId, chapters, registerChapter, scrollTo, globalProgress }
}

/** 工具函数：将 0-1 进度映射到子区间 */
export function subProgress(progress: number, start: number, end: number): number {
  if (progress <= start) return 0
  if (progress >= end) return 1
  return (progress - start) / (end - start)
}

/** 工具函数：ease-out 缓动 */
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** 工具函数：数字弹跳动画值 */
export function animateNumber(target: number, progress: number): number {
  return Math.round(target * easeOut(progress))
}
