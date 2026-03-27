import { useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react'
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

  const hasContent = input.trim() || (attachedFiles && attachedFiles.length > 0)

  return (
    <div className="border-t border-border/50 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-3 bg-secondary/30 rounded-xl border border-border/50 px-4 py-3 focus-within:border-primary/50 transition-colors">
          <textarea
            ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="输入问题，或用 📎 上传发票/文件..."
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm leading-relaxed max-h-32 placeholder:text-muted-foreground/50"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          {onAttach && <FileAttachInput onAttach={onAttach} />}
          <VoiceInput onTranscript={handleTranscript} />
          {onImage && <ScreenshotInput onImage={onImage} />}
          <button
            onClick={() => onSend()}
            disabled={!hasContent || isLoading}
            className="shrink-0 w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            {isLoading ? (
              <span className="animate-spin text-xs">⏳</span>
            ) : (
              <span className="text-sm">↑</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
