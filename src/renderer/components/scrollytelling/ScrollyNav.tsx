/**
 * ScrollyNav — 右侧圆点导航指示器 + 顶部进度条
 */

interface ScrollyNavProps {
  chapters: { id: string; label: string }[]
  activeId: string
  globalProgress: number
  onNavigate: (id: string) => void
}

export default function ScrollyNav({
  chapters,
  activeId,
  globalProgress,
  onNavigate,
}: ScrollyNavProps) {
  return (
    <>
      {/* 顶部进度条 */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[2px]">
        <div
          className="h-full bg-primary transition-[width] duration-100"
          style={{ width: `${globalProgress * 100}%` }}
        />
      </div>

      {/* 右侧圆点导航 */}
      <nav
        className="fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-3"
        aria-label="章节导航"
      >
        {chapters.map(({ id, label }) => {
          const isActive = id === activeId
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="group flex items-center gap-2"
              aria-current={isActive ? 'step' : undefined}
              title={label}
            >
              {/* 标签（hover 显示） */}
              <span className="text-[10px] text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-colors duration-200 whitespace-nowrap">
                {label}
              </span>
              {/* 圆点 */}
              <span
                className={`block rounded-full transition-all duration-300 ${
                  isActive
                    ? 'w-2.5 h-2.5 bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.4)]'
                    : 'w-1.5 h-1.5 bg-muted-foreground/30 group-hover:bg-muted-foreground/60'
                }`}
              />
            </button>
          )
        })}
      </nav>
    </>
  )
}
