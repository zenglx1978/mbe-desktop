import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, X } from 'lucide-react'

export interface ScreenshotInputProps {
  onImage: (base64: string, filename: string) => void
  className?: string
}

const ACCEPT = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp'

function fileToBase64(file: File): Promise<{ b64: string; name: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const data = r.result as string
      const i = data.indexOf(',')
      resolve({ b64: i >= 0 ? data.slice(i + 1) : data, name: file.name || 'image.png' })
    }
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })
}

const btn =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-600/80 bg-neutral-800/60 text-neutral-300 hover:bg-neutral-700/70 hover:text-white transition-colors'

export default function ScreenshotInput({ onImage, className = '' }: ScreenshotInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [thumb, setThumb] = useState<string | null>(null)
  const thumbRef = useRef<string | null>(null)

  const clearThumb = useCallback(() => {
    if (thumbRef.current) URL.revokeObjectURL(thumbRef.current)
    thumbRef.current = null
    setThumb(null)
  }, [])

  useEffect(() => () => {
    if (thumbRef.current) URL.revokeObjectURL(thumbRef.current)
  }, [])

  const pick = useCallback(() => inputRef.current?.click(), [])

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file || !file.type.startsWith('image/')) return
      try {
        const { b64, name } = await fileToBase64(file)
        clearThumb()
        const url = URL.createObjectURL(file)
        thumbRef.current = url
        setThumb(url)
        onImage(b64, name)
      } catch {
        // Expected: FileReader 或对象 URL 失败；不更新缩略图
      }
    },
    [onImage, clearThumb],
  )

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      void handleFile(f ?? null)
      e.target.value = ''
    },
    [handleFile],
  )

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input,textarea,[contenteditable="true"]')) return
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile()
          if (f) {
            e.preventDefault()
            void handleFile(f)
            break
          }
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleFile])

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={onChange} aria-hidden />
      <button type="button" className={btn} onClick={pick} title="选择图片或粘贴截图（非输入框聚焦时 Ctrl+V）" aria-label="图片">
        <Camera className="h-4 w-4" />
      </button>
      {thumb && (
        <div className="relative h-8 w-8 shrink-0 rounded border border-neutral-600 overflow-hidden">
          <img src={thumb} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 hover:opacity-100"
            onClick={clearThumb}
            aria-label="清除预览"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
