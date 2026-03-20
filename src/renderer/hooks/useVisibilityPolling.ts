import { useEffect, useRef } from 'react'

/**
 * 仅在页面可见时按间隔执行回调；隐藏时暂停，恢复可见时立即执行一次再继续轮询。
 */
export function useVisibilityPolling(
  callback: () => void,
  intervalMs: number,
  enabled = true,
): void {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return

    let intervalId: ReturnType<typeof setInterval> | null = null

    const runIfVisible = () => {
      if (document.visibilityState === 'hidden') return
      cbRef.current()
    }

    const clearPoll = () => {
      if (intervalId != null) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const startPoll = () => {
      clearPoll()
      intervalId = setInterval(runIfVisible, intervalMs)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        runIfVisible()
        startPoll()
      } else {
        clearPoll()
      }
    }

    if (document.visibilityState === 'visible') {
      runIfVisible()
      startPoll()
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearPoll()
    }
  }, [intervalMs, enabled])
}
