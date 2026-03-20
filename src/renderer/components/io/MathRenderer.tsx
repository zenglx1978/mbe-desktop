import katex from 'katex'
import 'katex/dist/katex.min.css'
import { Fragment, useMemo } from 'react'

export interface MathRendererProps {
  content: string
  className?: string
}

type Piece = { kind: 'text'; text: string } | { kind: 'inline'; latex: string } | { kind: 'block'; latex: string }

/** 块级 $$...$$ 与行内 $...$（未闭合则保留原文） */
function parseMath(content: string): Piece[] {
  const out: Piece[] = []
  let i = 0
  const n = content.length

  const pushInline = (chunk: string) => {
    if (!chunk) return
    let j = 0
    while (j < chunk.length) {
      const s = chunk.indexOf('$', j)
      if (s === -1) {
        out.push({ kind: 'text', text: chunk.slice(j) })
        break
      }
      if (chunk[s + 1] === '$') {
        if (s > j) out.push({ kind: 'text', text: chunk.slice(j, s) })
        out.push({ kind: 'text', text: '$$' })
        j = s + 2
        continue
      }
      if (s > j) out.push({ kind: 'text', text: chunk.slice(j, s) })
      const e = chunk.indexOf('$', s + 1)
      if (e === -1) {
        out.push({ kind: 'text', text: chunk.slice(s) })
        break
      }
      out.push({ kind: 'inline', latex: chunk.slice(s + 1, e) })
      j = e + 1
    }
  }

  while (i < n) {
    const bs = content.indexOf('$$', i)
    if (bs === -1) {
      pushInline(content.slice(i))
      break
    }
    if (bs > i) pushInline(content.slice(i, bs))
    const be = content.indexOf('$$', bs + 2)
    if (be === -1) {
      out.push({ kind: 'text', text: content.slice(bs) })
      break
    }
    out.push({ kind: 'block', latex: content.slice(bs + 2, be) })
    i = be + 2
  }
  return out
}

function renderLatex(latex: string, display: boolean): string {
  try {
    return katex.renderToString(latex.trim(), {
      displayMode: display,
      throwOnError: true,
      strict: 'ignore',
      trust: false,
    })
  } catch {
    // Expected: KaTeX 无法渲染非法 LaTeX；下方回退为原始定界符
    return ''
  }
}

export default function MathRenderer({ content, className }: MathRendererProps) {
  const pieces = useMemo(() => parseMath(content), [content])

  return (
    <div
      className={`text-sm text-neutral-800 dark:text-neutral-200 [&_.katex]:text-inherit [&_.katex-display]:my-2 ${className ?? ''}`}
    >
      {pieces.map((p, idx) => {
        if (p.kind === 'text') {
          return <Fragment key={idx}>{p.text}</Fragment>
        }
        const html = renderLatex(p.latex, p.kind === 'block')
        if (!html) {
          const raw = p.kind === 'block' ? `$$${p.latex}$$` : `$${p.latex}$`
          return (
            <code
              key={idx}
              className="rounded bg-neutral-200/80 px-1 font-mono text-xs text-amber-900 dark:bg-neutral-700/80 dark:text-amber-200"
            >
              {raw}
            </code>
          )
        }
        if (p.kind === 'block') {
          return (
            <div
              key={idx}
              className="overflow-x-auto py-1"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        }
        return <span key={idx} dangerouslySetInnerHTML={{ __html: html }} />
      })}
    </div>
  )
}
