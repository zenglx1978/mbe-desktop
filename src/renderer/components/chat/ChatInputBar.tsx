import type { RefObject } from 'react'

export interface ChatInputBarProps {
  input: string
  setInput: (value: string) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onKeyDown: (e: React.KeyboardEvent) => void
  onSend: () => void
  isLoading: boolean
}

export function ChatInputBar({
  input,
  setInput,
  textareaRef,
  onKeyDown,
  onSend,
  isLoading,
}: ChatInputBarProps) {
  return (
    <div className="border-t border-border/50 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-3 bg-secondary/30 rounded-xl border border-border/50 px-4 py-3 focus-within:border-primary/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="输入问题，或点击上方决策链快速开始..."
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm leading-relaxed max-h-32 placeholder:text-muted-foreground/50"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={() => onSend()}
            disabled={!input.trim() || isLoading}
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
