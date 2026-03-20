import { useState } from 'react'

// ── FileIntel 结果类型 ──

export interface DirScanFile {
  name: string
  path: string
  type: string
  sizeHuman: string
  lastModified: string
}

export interface DirScanOutput {
  success?: boolean
  files?: DirScanFile[]
  totalFiles?: number
  totalSizeHuman?: string
  typeSummary?: Record<string, number>
  scanTimeMs?: number
}

export function DirScanResultView({ result }: { result: DirScanOutput }) {
  const [expanded, setExpanded] = useState(false)
  if (!result.success || !result.files?.length) return null

  const typeIcons: Record<string, string> = {
    excel: '📊', csv: '📋', word: '📝', pdf: '📕', text: '📄',
    image: '🖼️', ppt: '📎', other: '📁',
  }
  const visibleFiles = expanded ? result.files : result.files.slice(0, 8)

  return (
    <div className="mt-2 rounded border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20 p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
          🔍 扫描结果：{result.totalFiles} 个文件（{result.totalSizeHuman}）
        </span>
        {result.scanTimeMs && (
          <span className="text-[9px] text-blue-400">{result.scanTimeMs}ms</span>
        )}
      </div>
      {result.typeSummary && Object.keys(result.typeSummary).length > 1 && (
        <div className="flex gap-2 mb-1.5 flex-wrap">
          {Object.entries(result.typeSummary).map(([type, count]) => (
            <span key={type} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
              {typeIcons[type] ?? '📁'} {type} {count}
            </span>
          ))}
        </div>
      )}
      <div className="space-y-0.5">
        {visibleFiles.map((file, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px] text-blue-600/80 dark:text-blue-400/80 py-0.5">
            <span>{typeIcons[file.type] ?? '📁'}</span>
            <span className="truncate flex-1" title={file.path}>{file.name}</span>
            <span className="shrink-0 text-blue-400/60">{file.sizeHuman}</span>
          </div>
        ))}
      </div>
      {result.files.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-[10px] text-blue-500 hover:text-blue-700 transition-colors"
        >
          {expanded ? '收起' : `显示全部 ${result.files.length} 个文件`}
        </button>
      )}
    </div>
  )
}

export interface BatchFileItem {
  fileName: string
  fileType: string
  status: string
  classification?: string
  summary?: string
  error?: string
}

export interface BatchAnalyzeOutput {
  success?: boolean
  totalFiles?: number
  processedFiles?: number
  results?: BatchFileItem[]
  totalTimeMs?: number
}

export function BatchAnalyzeResultView({ result }: { result: BatchAnalyzeOutput }) {
  const [expanded, setExpanded] = useState(false)
  if (!result.success || !result.results?.length) return null

  const grouped: Record<string, BatchFileItem[]> = {}
  for (const item of result.results) {
    const cat = item.classification ?? item.fileType ?? '其他'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }

  const doneCount = result.results.filter(r => r.status === 'done').length
  const errorCount = result.results.filter(r => r.status === 'error').length
  const visible = expanded ? result.results : result.results.slice(0, 10)

  return (
    <div className="mt-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20 p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
          📊 批量分析：{doneCount}/{result.totalFiles} 完成
          {errorCount > 0 && <span className="text-red-500 ml-1">（{errorCount} 失败）</span>}
        </span>
        {result.totalTimeMs && (
          <span className="text-[9px] text-amber-400">{(result.totalTimeMs / 1000).toFixed(1)}s</span>
        )}
      </div>

      {Object.keys(grouped).length > 1 && (
        <div className="flex gap-2 mb-1.5 flex-wrap">
          {Object.entries(grouped).map(([cat, items]) => (
            <span key={cat} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300">
              {cat} ({items.length})
            </span>
          ))}
        </div>
      )}

      <div className="space-y-1">
        {visible.map((item, i) => (
          <div key={i} className={`text-[10px] px-1.5 py-1 rounded ${
            item.status === 'done'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300'
          }`}>
            <div className="flex items-center gap-1.5">
              <span>{item.status === 'done' ? '✓' : '✗'}</span>
              <span className="font-medium truncate">{item.fileName}</span>
              {item.classification && (
                <span className="shrink-0 px-1 py-0.5 rounded bg-amber-200/50 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300">
                  {item.classification}
                </span>
              )}
            </div>
            {item.summary && (
              <p className="mt-0.5 text-[9px] opacity-70 line-clamp-2 pl-4">{item.summary}</p>
            )}
            {item.error && (
              <p className="mt-0.5 text-[9px] text-red-500 pl-4">{item.error}</p>
            )}
          </div>
        ))}
      </div>

      {result.results.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-[10px] text-amber-500 hover:text-amber-700 transition-colors"
        >
          {expanded ? '收起' : `显示全部 ${result.results.length} 个文件`}
        </button>
      )}
    </div>
  )
}

// ── Phase 4: 跨应用数据管道结果 ──

export interface PipelineStepOutput {
  stepIndex: number
  type: string
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
  output?: unknown
  error?: string
  durationMs?: number
  itemProgress?: { current: number; total: number }
}

export interface PipelineOutput {
  success?: boolean
  name?: string
  totalSteps?: number
  completedSteps?: number
  stepResults?: PipelineStepOutput[]
  outputFiles?: string[]
  totalDurationMs?: number
  error?: string
}

export function PipelineResultView({ result }: { result: PipelineOutput }) {
  const [expanded, setExpanded] = useState(false)

  if (!result.stepResults?.length && !result.error) return null

  const stepTypeIcons: Record<string, string> = {
    read: '📖', read_dir: '📂', ai_process: '🤖', ai_each: '🧠',
    transform: '🔄', generate: '📄', open: '🚀',
  }

  const completedSteps = result.completedSteps ?? 0
  const totalSteps = result.totalSteps ?? 0
  const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  const borderColor = result.success ? 'border-indigo-200 dark:border-indigo-800'
    : result.error ? 'border-red-200 dark:border-red-800' : 'border-purple-200 dark:border-purple-800'
  const bgColor = result.success ? 'bg-indigo-50/30 dark:bg-indigo-950/20'
    : result.error ? 'bg-red-50/30 dark:bg-red-950/20' : 'bg-purple-50/30 dark:bg-purple-950/20'

  return (
    <div className={`mt-2 rounded border ${borderColor} ${bgColor} p-2`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
          🔗 {result.name ?? '数据管道'} — {completedSteps}/{totalSteps} 步
          {result.success && ' ✓'}
        </span>
        {result.totalDurationMs && (
          <span className="text-[9px] text-indigo-400">{(result.totalDurationMs / 1000).toFixed(1)}s</span>
        )}
      </div>

      {/* 进度条 */}
      <div className="h-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            result.error ? 'bg-red-500' : result.success ? 'bg-indigo-500' : 'bg-purple-500 animate-pulse'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* 步骤列表 */}
      {result.stepResults && (
        <div className="space-y-0.5">
          {(expanded ? result.stepResults : result.stepResults.slice(0, 5)).map((step) => (
            <div
              key={step.stepIndex}
              className={`flex items-center gap-1.5 text-[10px] px-1.5 py-1 rounded ${
                step.status === 'done'
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                  : step.status === 'running'
                    ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 animate-pulse'
                    : step.status === 'error'
                      ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300'
                      : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <span>{stepTypeIcons[step.type] ?? '⚡'}</span>
              <span className={`${step.status === 'done' ? '' : 'font-medium'}`}>
                {step.status === 'done' ? '✓' : step.status === 'running' ? '◉' : step.status === 'error' ? '✗' : '○'}
              </span>
              <span className="truncate flex-1">{step.label}</span>
              {step.itemProgress && step.status === 'running' && (
                <span className="shrink-0 text-blue-400">
                  {step.itemProgress.current}/{step.itemProgress.total}
                </span>
              )}
              {step.durationMs != null && step.status === 'done' && (
                <span className="shrink-0 opacity-50">{(step.durationMs / 1000).toFixed(1)}s</span>
              )}
            </div>
          ))}
        </div>
      )}

      {result.stepResults && result.stepResults.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-[10px] text-indigo-500 hover:text-indigo-700 transition-colors"
        >
          {expanded ? '收起' : `显示全部 ${result.stepResults.length} 个步骤`}
        </button>
      )}

      {/* 输出文件 */}
      {result.outputFiles && result.outputFiles.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-indigo-200/50 dark:border-indigo-800/50">
          <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">输出文件：</span>
          {result.outputFiles.map((f, i) => {
            const fileName = f.split(/[/\\]/).pop() ?? f
            return (
              <span key={i} className="text-[10px] text-indigo-500 dark:text-indigo-400 ml-1.5">
                📄 {fileName}
              </span>
            )
          })}
        </div>
      )}

      {/* 错误信息 */}
      {result.error && (
        <div className="mt-1.5 text-[10px] text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/30 rounded px-2 py-1">
          ⚠ {result.error}
        </div>
      )}
    </div>
  )
}
