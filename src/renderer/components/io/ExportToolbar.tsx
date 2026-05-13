import { useCallback, useState } from 'react'
import { Copy, Download, Printer, Share2, Presentation } from 'lucide-react'
import { generateDesign, downloadBlob } from '@/lib/design-engine-service'

export interface ExportToolbarProps {
  content: string
  title?: string
  className?: string
}

function utf8ToBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
}

function buildPrintHtml(title: string, body: string): string {
  const esc = (t: string) =>
    t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const h = esc(title || '对话导出')
  const b = esc(body)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${h}</title><style>
body{font-family:ui-sans-serif,system-ui,sans-serif;padding:24px;background:#fff;color:#111;font-size:14px;line-height:1.6}
h1{font-size:1.25rem;margin:0 0 1rem}pre{white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,monospace;font-size:12px}
</style></head><body><h1>${h}</h1><pre>${b}</pre></body></html>`
}

const btn =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-600/80 bg-neutral-800/60 text-neutral-300 hover:bg-neutral-700/70 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors'

export default function ExportToolbar({ content, title = '对话导出', className = '' }: ExportToolbarProps) {
  const [copied, setCopied] = useState(false)
  const [pptBusy, setPptBusy] = useState(false)
  const safeName = (title || '导出').replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80)

  const copyMd = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Expected: 剪贴板权限拒绝或环境无 Clipboard API
    }
  }, [content])

  const exportMd = useCallback(async () => {
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined
    try {
      if (api?.saveFile && api?.writeFile) {
        const path = await api.saveFile({
          title: '导出 Markdown',
          defaultPath: `${safeName}.md`,
          filters: [{ name: 'Markdown 文档', extensions: ['md'] }],
        }) as string | null
        if (!path) return
        const wr = await api.writeFile(path, utf8ToBase64(content)) as { success?: boolean; error?: string }
        if (wr && typeof wr === 'object' && 'success' in wr && wr.success === false) return
        return
      }
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeName}.md`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Expected: Electron 写文件或浏览器下载失败；用户无导出文件
    }
  }, [content, safeName])

  const exportPdf = useCallback(async () => {
    const html = buildPrintHtml(title, content)
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined
    try {
      if (api?.printToPDF && api?.saveFile && api?.writeFile) {
        const pdf = await api.printToPDF(html) as { success?: boolean; data?: string; error?: string }
        if (!pdf?.success || !pdf.data) return
        const path = await api.saveFile({
          title: '导出 PDF',
          defaultPath: `${safeName}.pdf`,
          filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
        }) as string | null
        if (!path) return
        const wr = await api.writeFile(path, pdf.data) as { success?: boolean; error?: string }
        if (wr && typeof wr === 'object' && 'success' in wr && wr.success === false) return
        return
      }
      const w = window.open('', '_blank')
      if (w) {
        w.document.write(html)
        w.document.close()
        w.onload = () => {
          w.print()
          w.close()
        }
      }
    } catch {
      // Expected: PDF/打印流程失败（Electron 或 window.open）
    }
  }, [content, title, safeName])

  const exportPpt = useCallback(async () => {
    setPptBusy(true)
    try {
      const blob = await generateDesign({ markdown: content, format: 'pptx' })
      downloadBlob(blob, 'pptx', safeName)
    } catch {
      // Expected: Design Engine 不可用或渲染失败
    } finally {
      setPptBusy(false)
    }
  }, [content, safeName])

  const share = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text: content.slice(0, 120_000) })
      }
    } catch {
      // Expected: 用户取消系统分享或 Web Share 不可用
    }
  }, [content, title])

  return (
    <div className={`inline-flex items-center gap-1 ${className}`} role="toolbar" aria-label="导出与打印">
      <button type="button" className={btn} onClick={copyMd} title={copied ? '已复制' : '复制 Markdown'} aria-label="复制">
        <Copy className="h-4 w-4" />
      </button>
      <button type="button" className={btn} onClick={exportMd} title="导出 .md" aria-label="导出 Markdown">
        <Download className="h-4 w-4" />
      </button>
      <button type="button" className={btn} onClick={exportPdf} title="打印 / 导出 PDF" aria-label="打印或 PDF">
        <Printer className="h-4 w-4" />
      </button>
      <button type="button" className={btn} onClick={exportPpt} disabled={pptBusy} title={pptBusy ? '生成中…' : '渲染为 PPT'} aria-label="渲染为 PPT">
        <Presentation className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={btn}
        onClick={share}
        title={
          typeof navigator !== 'undefined' && typeof navigator.share === 'function'
            ? '系统分享'
            : '分享（浏览器不支持）'
        }
        disabled={typeof navigator === 'undefined' || typeof navigator.share !== 'function'}
        aria-label="分享"
      >
        <Share2 className="h-4 w-4" />
      </button>
      {copied ? <span className="text-[11px] text-emerald-400 whitespace-nowrap pl-0.5">已复制</span> : null}
    </div>
  )
}
