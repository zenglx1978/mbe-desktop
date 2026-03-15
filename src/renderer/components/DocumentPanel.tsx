/**
 * 文档管理面板
 *
 * 本地文件管理：上传/浏览/打开。
 * 文件存储在本地 ~/Documents/MBE Desktop/files/
 * 元数据存储在 SQLite documents 表。
 */

import { useState } from 'react'
import { useAppStore } from '@/stores/app-store'

interface DocFile {
  name: string
  path: string
  size: number
  addedAt: string
}

export default function DocumentPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [files, setFiles] = useState<DocFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const { currentSolution } = useAppStore()
  const solution = currentSolution()

  if (!visible || !solution) return null

  async function handleUpload() {
    const api = (window as any).electronAPI
    if (!api?.openFile) return

    const paths: string[] = await api.openFile({
      title: '选择文件',
      filters: [
        { name: '文档', extensions: ['pdf', 'doc', 'docx', 'txt', 'xlsx', 'xls', 'csv'] },
        { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'tiff'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })

    if (paths.length > 0) {
      const newFiles = paths.map(p => ({
        name: p.split(/[/\\]/).pop() || '未知',
        path: p,
        size: 0,
        addedAt: new Date().toISOString(),
      }))
      setFiles(prev => [...newFiles, ...prev])
    }
  }

  async function handleOpenFile(filePath: string) {
    const api = (window as any).electronAPI
    if (api?.openPath) {
      await api.openPath(filePath)
    }
  }

  function formatSize(bytes: number): string {
    if (bytes === 0) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-[640px] max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div>
            <h2 className="font-semibold text-base">文档管理</h2>
            <p className="text-xs text-muted-foreground">文件存储在本地 · 不上传到云端</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>

        {/* Upload area */}
        <div
          className={`mx-6 mt-4 p-6 rounded-lg border-2 border-dashed text-center cursor-pointer transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-border'
          }`}
          onClick={handleUpload}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false) }}
        >
          <p className="text-sm text-muted-foreground">点击或拖拽文件到此处</p>
          <p className="text-xs text-muted-foreground/50 mt-1">支持 PDF、Word、Excel、图片等</p>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {files.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground/50 py-8">
              暂无文件
            </div>
          ) : (
            <div className="space-y-1">
              {files.map((file, i) => (
                <div
                  key={i}
                  onClick={() => handleOpenFile(file.path)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <span className="text-lg">{getFileIcon(file.name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground">{formatSize(file.size)}</div>
                  </div>
                  <span className="text-xs text-muted-foreground/50 shrink-0">
                    {new Date(file.addedAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  const icons: Record<string, string> = {
    pdf: '📄', doc: '📝', docx: '📝', txt: '📋',
    xls: '📊', xlsx: '📊', csv: '📊',
    jpg: '🖼', jpeg: '🖼', png: '🖼', bmp: '🖼',
    zip: '📦', rar: '📦',
  }
  return icons[ext || ''] || '📎'
}
