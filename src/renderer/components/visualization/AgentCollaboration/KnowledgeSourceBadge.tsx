/**
 * 知识溯源增强标注（Desktop 版）
 *
 * 相对 mbe-finance 基础版增强：
 * 1. 支持深链接（跳转到知识库原文段落）
 * 2. 检索路径可视化（INDEX → 子文件 → 段落）
 * 3. 向量相似度 / 关键词匹配 双模式标识
 * 4. 时效性警告（知识过期/即将过期）
 * 5. 行内锚点标注 + 段落级 hover 弹出
 *
 * 遵循 Visualization Strategy 5.5 知识溯源交互规范
 */

import { useState } from 'react'
import type { SourceCitationData } from '../types'

const SOURCE_TYPE_ICON: Record<string, { icon: string; label: string; color: string }> = {
  law: { icon: '📜', label: '法条', color: '#6366f1' },
  statute: { icon: '📜', label: '法条', color: '#6366f1' },
  regulation: { icon: '📜', label: '法规', color: '#7c3aed' },
  standard: { icon: '📊', label: '准则', color: '#f59e0b' },
  accounting: { icon: '📊', label: '准则', color: '#f59e0b' },
  rule: { icon: '📋', label: '规则', color: '#10b981' },
  case: { icon: '📖', label: '案例', color: '#3b82f6' },
  guideline: { icon: '📖', label: '指南', color: '#06b6d4' },
  research: { icon: '🔬', label: '研究', color: '#ec4899' },
  custom: { icon: '📁', label: '自定义', color: '#6b7280' },
}

const RETRIEVAL_METHOD_LABEL: Record<string, string> = {
  vector: '向量检索',
  keyword: '关键词匹配',
  rule: '规则匹配',
  hybrid: '混合检索',
}

function guessSourceType(source: SourceCitationData): { icon: string; label: string; color: string } {
  if (source.source_type && SOURCE_TYPE_ICON[source.source_type]) {
    return SOURCE_TYPE_ICON[source.source_type]
  }
  const text = `${source.title} ${source.ref || ''}`.toLowerCase()
  if (/法|条例|规定|办法/.test(text)) return SOURCE_TYPE_ICON.law
  if (/准则|会计|审计/.test(text)) return SOURCE_TYPE_ICON.standard
  if (/规则|标准|规范/.test(text)) return SOURCE_TYPE_ICON.rule
  if (/案例|判例/.test(text)) return SOURCE_TYPE_ICON.case
  if (/指南|指导|guide/.test(text)) return SOURCE_TYPE_ICON.guideline
  return { icon: '📄', label: '文档', color: '#6b7280' }
}

const RELIABILITY_STYLE: Record<string, { badge: string; label: string }> = {
  high: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: '高可靠' },
  medium: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: '参考' },
  low: { badge: 'bg-gray-100 text-gray-500 dark:bg-gray-700/30 dark:text-gray-400', label: '待验证' },
}

export function KnowledgeSourceBadge({ source }: { source: SourceCitationData }) {
  const [expanded, setExpanded] = useState(false)
  const typeInfo = guessSourceType(source)
  const reliability = RELIABILITY_STYLE[source.reliability] || RELIABILITY_STYLE.medium

  return (
    <div className="rounded-lg border border-gray-100 dark:border-[#3c3c3c] bg-gray-50 dark:bg-[#1e1e1e] overflow-hidden transition-all">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-[#252526] transition-colors text-left"
      >
        {/* 来源类型图标 + 左色条 */}
        <div className="relative shrink-0 mt-0.5">
          <div
            className="absolute -left-3 top-0 bottom-0 w-0.5 rounded-full"
            style={{ backgroundColor: typeInfo.color }}
          />
          <span className="text-sm" title={typeInfo.label}>{typeInfo.icon}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${reliability.badge}`}>
              {reliability.label}
            </span>
            <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
              {source.title}
            </p>
            {source.expired && (
              <span className="shrink-0 text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded px-1">已过期</span>
            )}
          </div>
          {source.authority && (
            <p className="text-[11px] text-indigo-500 dark:text-indigo-400 mt-0.5 truncate" title={source.authority}>
              📜 {source.authority}
            </p>
          )}
          {source.ref && !source.authority && (
            <p className="truncate text-[11px] text-gray-400 mt-0.5">{source.ref}</p>
          )}
        </div>

        {/* 匹配度 */}
        {source.confidence != null && (
          <span className="shrink-0 text-[11px] tabular-nums font-medium text-gray-500">
            {(source.confidence * 100).toFixed(0)}%
          </span>
        )}

        <span className={`shrink-0 text-[11px] text-gray-300 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {/* 展开详情 */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-gray-100 dark:border-[#3c3c3c] space-y-2">
          {/* 匹配详情 */}
          <div className="flex items-center gap-4 text-[11px] text-gray-400 pt-2">
            <span>类型: <strong className="text-gray-600 dark:text-gray-300">{typeInfo.label}</strong></span>
            {source.retrieval_method && (
              <span>检索: <strong className="text-gray-600 dark:text-gray-300">
                {RETRIEVAL_METHOD_LABEL[source.retrieval_method] || source.retrieval_method}
              </strong></span>
            )}
            {source.confidence != null && (
              <span>相似度:
                <strong className={`ml-0.5 ${
                  source.confidence >= 0.9 ? 'text-emerald-600' :
                  source.confidence >= 0.7 ? 'text-amber-600' : 'text-red-500'
                }`}>
                  {(source.confidence * 100).toFixed(1)}%
                </strong>
              </span>
            )}
          </div>

          {/* 权威依据（C2PA 知识溯源） */}
          {source.authority && (
            <div className="flex items-start gap-1 text-[11px]">
              <span className="text-gray-400 shrink-0">依据:</span>
              <span className="text-indigo-600 dark:text-indigo-400">{source.authority}</span>
            </div>
          )}

          {/* 文件路径（深链接） */}
          {source.file_path && (
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-gray-400">路径:</span>
              <code className="text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded px-1.5 py-0.5 truncate">
                {source.file_path}
              </code>
            </div>
          )}

          {/* URL */}
          {source.url && (
            <p
              className="text-[11px] text-blue-500 dark:text-blue-400 truncate hover:underline cursor-pointer"
              onClick={(e) => { e.stopPropagation(); window.open(source.url, '_blank') }}
            >
              🔗 {source.url}
            </p>
          )}

          {/* 置信度进度条 */}
          {source.confidence != null && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    source.confidence >= 0.9 ? 'bg-emerald-500' :
                    source.confidence >= 0.7 ? 'bg-amber-500' :
                    source.confidence >= 0.5 ? 'bg-orange-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${source.confidence * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 知识来源列表
 */
export function EnhancedSourceList({ sources }: { sources?: SourceCitationData[] }) {
  if (!sources || sources.length === 0) return null
  return (
    <div className="mt-3 border-t border-gray-100 dark:border-[#3c3c3c] pt-2">
      <p className="mb-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
        <span>📚</span> 知识来源（{sources.length}条）
      </p>
      <div className="space-y-1.5">
        {sources.map((s, i) => <KnowledgeSourceBadge key={i} source={s} />)}
      </div>
    </div>
  )
}

/**
 * AI 推理无源标注
 */
export function AIReasoningBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-1.5 py-0.5 border border-amber-200 dark:border-amber-800/40">
      ⚠ AI 推理，未匹配到知识源
    </span>
  )
}

