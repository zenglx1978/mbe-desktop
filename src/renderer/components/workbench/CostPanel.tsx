import type { SolutionConfig } from '@/lib/solution-router'

interface Props {
  solution: SolutionConfig
}

export default function CostPanel(_props: Props) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center text-muted-foreground">
        <div className="text-4xl mb-3">💰</div>
        <p className="text-sm">费用追踪功能即将上线</p>
      </div>
    </div>
  )
}
