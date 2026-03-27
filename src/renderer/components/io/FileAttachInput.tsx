import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { Paperclip, X, FileText, Image } from 'lucide-react'

export interface AttachedFile {
  file: File
  name: string
  type: string
  preview?: string
}

export interface FileAttachInputProps {
  onAttach: (files: AttachedFile[]) => void
  className?: string
  maxFiles?: number
  maxSizeMB?: number
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.tiff,.tif,.bmp,.webp,.ofd'

const btn =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-600/80 bg-neutral-800/60 text-neutral-300 hover:bg-neutral-700/70 hover:text-white transition-colors'

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <Image className="h-3 w-3" />
  return <FileText className="h-3 w-3" />
}

export default function FileAttachInput({
  onAttach,
  className = '',
  maxFiles = 10,
  maxSizeMB = 20,
}: FileAttachInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [attached, setAttached] = useState<AttachedFile[]>([])

  const pick = useCallback(() => inputRef.current?.click(), [])

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return
      const newFiles: AttachedFile[] = []
      const maxBytes = maxSizeMB * 1024 * 1024

      for (let i = 0; i < Math.min(fileList.length, maxFiles); i++) {
        const f = fileList[i]
        if (f.size > maxBytes) continue

        const af: AttachedFile = {
          file: f,
          name: f.name,
          type: f.type,
          preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
        }
        newFiles.push(af)
      }

      if (newFiles.length > 0) {
        const merged = [...attached, ...newFiles].slice(0, maxFiles)
        setAttached(merged)
        onAttach(merged)
      }
    },
    [attached, onAttach, maxFiles, maxSizeMB],
  )

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files)
      e.target.value = ''
    },
    [handleFiles],
  )

  const removeFile = useCallback(
    (idx: number) => {
      const file = attached[idx]
      if (file?.preview) URL.revokeObjectURL(file.preview)
      const next = attached.filter((_, i) => i !== idx)
      setAttached(next)
      onAttach(next)
    },
    [attached, onAttach],
  )

  const clearAll = useCallback(() => {
    for (const f of attached) {
      if (f.preview) URL.revokeObjectURL(f.preview)
    }
    setAttached([])
    onAttach([])
  }, [attached, onAttach])

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={onChange}
        aria-hidden
      />
      <button
        type="button"
        className={btn}
        onClick={pick}
        title="上传文件（发票 PDF、图片等，最大 20MB）"
        aria-label="附件"
      >
        <Paperclip className="h-4 w-4" />
      </button>
      {attached.length > 0 && (
        <div className="flex items-center gap-1 max-w-[200px] overflow-x-auto">
          {attached.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="relative flex items-center gap-1 h-7 px-1.5 rounded bg-neutral-700/60 border border-neutral-600/50 text-xs text-neutral-300 shrink-0 max-w-[120px]"
              title={f.name}
            >
              {f.preview ? (
                <img src={f.preview} alt="" className="h-5 w-5 rounded object-cover" />
              ) : (
                getFileIcon(f.type)
              )}
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-0.5 text-neutral-400 hover:text-white"
                aria-label={`移除 ${f.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {attached.length > 1 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-neutral-500 hover:text-red-400 shrink-0 px-1"
            >
              清除
            </button>
          )}
        </div>
      )}
    </div>
  )
}
