import { useCallback, useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { VoiceInput, ScreenshotInput, FileAttachInput, type AttachedFile } from '@/components/io'

export interface ChatInputBarProps {
  input: string
  setInput: Dispatch<SetStateAction<string>>
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onKeyDown: (e: React.KeyboardEvent) => void
  onSend: () => void
  onImage?: (base64: string, filename: string) => void
  onAttach?: (files: AttachedFile[]) => void
  attachedFiles?: AttachedFile[]
  isLoading: boolean
}

/** max chars per message */
const MAX_CHARS = 4_000
/** show counter when above this */
const CHAR_WARN_THRESHOLD = 300

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ChatInputBar({
  input,
  setInput,
  textareaRef,
  onKeyDown,
  onSend,
  onImage,
  onAttach,
  attachedFiles,
  isLoading,
}: ChatInputBarProps) {
  const handleTranscript = useCallback(
    (text: string) => setInput((prev: string) => (prev ? `${prev} ${text}` : text)),
    [setInput],
  )

  const charCount = input.length
  const charsLeft = MAX_CHARS - charCount
  const showCounter = charCount >= CHAR_WARN_THRESHOLD
  const isNearLimit = charCount >= MAX_CHARS * 0.9
  const isOverLimit = charCount > MAX_CHARS

  const hasContent = (input.trim() || (attachedFiles && attachedFiles.length > 0)) && !isOverLimit

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (e.target.value.length <= MAX_CHARS) {
        setInput(e.target.value)
      }
    },
    [setInput],
  )

  // B7: dynamic textarea height (replaces experimental fieldSizing CSS)
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [input, textareaRef])

  return (
    <div className="border-t border-border/50 p-4">
      <div className="max-w-3xl mx-auto space-y-1.5">
        {/* attached files list */}
        {attachedFiles && attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {attachedFiles.map((f, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/50 border border-border/40 text-xs text-muted-foreground"
              >
                <span>📎</span>
                <span className="max-w-[120px] truncate">{f.name || `文件 ${i + 1}`}</span>
                {'size' in f && typeof f.size === 'number' && (
                  <span className="text-muted-foreground/50">· {fmtFileSize(f.size)}</span>
                )}
              </div>
            ))}
            <span className="self-center text-[11px] text-muted-foreground/40">最大 10MB/文件</span>
          </div>
        )}

        {/* input area */}
        <div className={`flex items-end gap-3 bg-secondary/30 rounded-xl border px-4 py-3 focus-within:border-primary/50 transition-colors ${
          isOverLimit ? 'border-red-500/50' : 'border-border/50'
        }`}>
          <textarea
            ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
            value={input}
            onChange={handleChange}
            onKeyDown={onKeyDown}
            placeholder="输入问题，或用 📎 上传发票/文件..."
            rows={1}
            maxLength={MAX_CHARS}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm leading-relaxed overflow-y-auto placeholder:text-muted-foreground/50"
          />
          {onAttach && <FileAttachInput onAttach={onAttach} />}
          <VoiceInput onTranscript={handleTranscript} />
          {onImage && <ScreenshotInput onImage={onImage} />}
          {/* A1: Lucide Send / Loader2 icons + aria labels */}
          <button
            onClick={() => onSend()}
            disabled={!hasContent || isLoading}
            aria-label={isLoading ? 'sending' : 'send message'}
            aria-busy={isLoading}
            className="shrink-0 w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* char counter — only near limit */}
        {showCounter && (
          <div className="flex justify-end pr-1">
            <span className={`text-[11px] tabular-nums transition-colors ${
              isOverLimit ? 'text-red-500 font-medium' :
              isNearLimit ? 'text-amber-500' :
              'text-muted-foreground/40'
            }`}>
              {isOverLimit
                ? `已超出 ${-charsLeft} 字`
                : `${charCount} / ${MAX_CHARS.toLocaleString()}`
              }
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
