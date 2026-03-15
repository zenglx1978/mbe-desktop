import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

type Step = 'detect' | 'select' | 'running' | 'done'

export default function MigrationWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('detect')
  const [legacyAgents, setLegacyAgents] = useState<LegacyAgentInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<MigrationResult[]>([])
  const [migrationStatus, setMigrationStatus] = useState<{ migrated: string[] }>({ migrated: [] })

  const detect = useCallback(async () => {
    const api = window.electronAPI
    if (!api) return
    const [agents, status] = await Promise.all([api.migration.detect(), api.migration.status()])
    setLegacyAgents(agents)
    setMigrationStatus(status)
    const available = new Set(agents.filter(a => !status.migrated.includes(a.agentId)).map(a => a.agentId))
    setSelected(available)
    setStep('select')
  }, [])

  useEffect(() => { detect() }, [detect])

  const toggleAgent = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runMigration = async () => {
    if (selected.size === 0) return
    setStep('running')
    const api = window.electronAPI
    if (!api) return
    const res = await api.migration.run(Array.from(selected))
    setResults(res)
    setStep('done')
  }

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-8">
      <div className="max-w-2xl w-full space-y-8">
        {/* 标题 */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">数据迁移向导</h1>
          <p className="text-muted-foreground">
            将旧版 MBE Agent 的数据导入到 MBE Desktop 统一平台
          </p>
        </div>

        {/* 步骤指示器 */}
        <div className="flex justify-center gap-2">
          {(['detect', 'select', 'running', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step === s ? 'bg-primary text-primary-foreground' :
                (['detect', 'select', 'running', 'done'].indexOf(step) > i ? 'bg-primary/30 text-primary-foreground' : 'bg-muted text-muted-foreground')
              }`}>
                {i + 1}
              </div>
              {i < 3 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* 检测中 */}
        {step === 'detect' && (
          <div className="text-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">正在检测已安装的旧版 Agent...</p>
          </div>
        )}

        {/* 选择 */}
        {step === 'select' && (
          <div className="space-y-6">
            {legacyAgents.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="text-4xl">✓</div>
                <p className="text-lg font-medium">未检测到旧版 Agent 数据</p>
                <p className="text-muted-foreground text-sm">
                  如果您之前安装过独立版 MBE Agent，请确保其数据目录位于 ~/Documents/ 下
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  检测到 {legacyAgents.length} 个旧版 Agent，勾选需要迁移的数据：
                </p>
                <div className="space-y-3">
                  {legacyAgents.map(agent => {
                    const alreadyMigrated = migrationStatus.migrated.includes(agent.agentId)
                    return (
                      <label
                        key={agent.agentId}
                        className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                          alreadyMigrated ? 'border-border/50 opacity-50' :
                          selected.has(agent.agentId) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(agent.agentId)}
                          onChange={() => !alreadyMigrated && toggleAgent(agent.agentId)}
                          disabled={alreadyMigrated}
                          className="w-4 h-4 rounded accent-primary"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{agent.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {agent.dirName} · {agent.sessionFields.length} 个配置项
                            {alreadyMigrated && ' · 已迁移'}
                          </div>
                        </div>
                        {agent.hasSession && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                            可迁移
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <button
                onClick={() => navigate('/pick')}
                className="px-6 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {legacyAgents.length === 0 ? '返回' : '跳过'}
              </button>
              {legacyAgents.length > 0 && selected.size > 0 && (
                <button
                  onClick={runMigration}
                  className="px-6 py-2.5 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                >
                  开始迁移 ({selected.size})
                </button>
              )}
            </div>
          </div>
        )}

        {/* 迁移中 */}
        {step === 'running' && (
          <div className="text-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-lg font-medium">正在迁移数据...</p>
            <p className="text-sm text-muted-foreground mt-2">请勿关闭应用</p>
          </div>
        )}

        {/* 完成 */}
        {step === 'done' && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="text-4xl mb-2">{totalErrors === 0 ? '✓' : '!'}</div>
              <p className="text-lg font-medium">
                {totalErrors === 0 ? '迁移完成' : '迁移完成（部分错误）'}
              </p>
            </div>

            <div className="space-y-3">
              {results.map((r, i) => (
                <div key={i} className="p-4 rounded-lg border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.agent}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.errors.length === 0 ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {r.errors.length === 0 ? '成功' : `${r.errors.length} 个错误`}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>Session: {r.sessionMigrated ? '已导入' : '无需迁移'}</p>
                    <p>对话: {r.conversationsMigrated} 条 · 消息: {r.messagesMigrated} 条</p>
                  </div>
                  {r.errors.length > 0 && (
                    <div className="text-xs text-red-400 mt-1 space-y-0.5">
                      {r.errors.map((e, j) => <p key={j}>{e}</p>)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => navigate('/pick')}
                className="px-6 py-2.5 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
              >
                进入 MBE Desktop
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
