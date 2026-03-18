import { useNavigate } from 'react-router-dom'

export default function MigrationWizard() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ← 返回
          </button>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">数据迁移</h1>
        <p className="text-muted-foreground text-sm">从旧版 Agent 迁移数据向导</p>
      </div>
    </div>
  )
}
