/**
 * 通用文档上传组件
 * 支持拖拽/粘贴/选文件，上传后调用 AI 分析 API。
 */

import { useState, useRef, useCallback } from 'react'
import type { ToolConfig } from '@/lib/solution-router'

export interface UploadedFile {
  name: string
  size: number
  type: string
  /** 文件内容（base64 或纯文本） */
  content: string
  contentType: 'base64' | 'text'
}

interface Props {
  tool: ToolConfig
  color: string
  onFileReady: (file: UploadedFile) => void
}

export default function DocumentUploader({ tool, color, onFileReady }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const acceptStr = tool.acceptTypes?.join(',') || '*'

  const processFile = useCallback(async (file: File) => {
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const text = await file.text()
      onFileReady({
        name: file.name,
        size: file.size,
        type: file.type,
        content: text,
        contentType: 'text',
      })
    } else {
      const buffer = await file.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
      onFileReady({
        name: file.name,
        size: file.size,
        type: file.type,
        content: base64,
        contentType: 'base64',
      })
    }
  }, [onFileReady])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handlePasteSubmit() {
    const text = pasteText.trim()
    if (!text) return
    onFileReady({
      name: '粘贴的文本',
      size: text.length,
      type: 'text/plain',
      content: text,
      contentType: 'text',
    })
  }

  async function handleElectronOpen() {
    const api = (window as any).electronAPI
    if (!api?.openFile) {
      fileRef.current?.click()
      return
    }
    const paths: string[] = await api.openFile({
      title: `选择文件 — ${tool.name}`,
      filters: [
        { name: '文档', extensions: ['pdf', 'doc', 'docx', 'txt'] },
        { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'webp'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })
    if (paths.length > 0) {
      const filePath = paths[0]!
      const fileName = filePath.split(/[/\\]/).pop() || '文件'
      try {
        const base64 = await api.readFileBase64(filePath)
        onFileReady({
          name: fileName,
          size: base64.length,
          type: guessType(fileName),
          content: base64,
          contentType: 'base64',
        })
      } catch {
        // Electron 读取失败，fallback 到浏览器文件选择
        fileRef.current?.click()
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* 拖拽/点击上传区 */}
      <div
        className={`relative p-8 rounded-xl border-2 border-dashed text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border/50 hover:border-primary/30 hover:bg-secondary/20'
        }`}
        onClick={handleElectronOpen}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="text-4xl mb-3">{tool.icon}</div>
        <p className="text-sm font-medium">拖拽文件到此处，或点击选择文件</p>
        <p className="text-xs text-muted-foreground mt-1.5">
          支持 {tool.acceptTypes?.map(t => t.replace('.', '')).join('、') || '所有格式'}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept={acceptStr}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* 粘贴文本模式 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border/30" />
        <button
          onClick={() => setPasteMode(!pasteMode)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {pasteMode ? '收起粘贴区' : '或直接粘贴文本内容'}
        </button>
        <div className="flex-1 h-px bg-border/30" />
      </div>

      {pasteMode && (
        <div className="space-y-3">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="将合同/文档内容粘贴到此处..."
            rows={8}
            className="w-full px-4 py-3 rounded-xl border border-border/50 bg-secondary/20 text-sm resize-none outline-none focus:border-primary/50 transition-colors"
          />
          <button
            onClick={handlePasteSubmit}
            disabled={!pasteText.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40 hover:opacity-90"
            style={{ backgroundColor: color }}
          >
            开始分析
          </button>
        </div>
      )}
    </div>
  )
}

function guessType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    bmp: 'image/bmp', tiff: 'image/tiff', webp: 'image/webp',
  }
  return map[ext] || 'application/octet-stream'
}
