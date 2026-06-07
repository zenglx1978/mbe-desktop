import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'

export interface VoiceInputProps {
  onTranscript: (text: string) => void
  lang?: string
  className?: string
}

type SpeechRecognitionCtor = new () => SpeechRecognition

function getSpeechRecognitionConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    webkitSpeechRecognition?: SpeechRecognitionCtor
    SpeechRecognition?: SpeechRecognitionCtor
  }
  return w.webkitSpeechRecognition ?? w.SpeechRecognition ?? null
}

export function VoiceInput({ onTranscript, lang = 'zh-CN', className }: VoiceInputProps) {
  const [speechCtor] = useState<SpeechRecognitionCtor | null>(() => getSpeechRecognitionConstructor())
  const [isRecording, setIsRecording] = useState(false)
  const listeningRef = useRef(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const stopListening = useCallback(() => {
    listeningRef.current = false
    const rec = recognitionRef.current
    recognitionRef.current = null
    if (rec) {
      try {
        rec.stop()
      } catch {
        // Expected: SpeechRecognition 已停止；尝试 abort
        try {
          rec.abort()
        } catch {
          // Expected: 重复 stop/abort 浏览器抛错；忽略
        }
      }
    }
    setIsRecording(false)
  }, [])

  const startListening = useCallback(() => {
    if (!speechCtor) return

    const attachHandlers = (rec: SpeechRecognition) => {
      rec.continuous = true
      rec.interimResults = false
      rec.lang = lang
      rec.onresult = (event: SpeechRecognitionEvent) => {
        let chunk = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i]!.isFinal) {
            chunk += event.results[i]![0]!.transcript
          }
        }
        const text = chunk.trim()
        if (text) onTranscriptRef.current(text)
      }
      rec.onerror = (event: Event) => {
        const code = (event as { error?: string }).error
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          stopListening()
        }
      }
      rec.onend = () => {
        if (!listeningRef.current) return
        try {
          const next = new speechCtor()
          attachHandlers(next)
          recognitionRef.current = next
          next.start()
        } catch {
          // Expected: 连续识别重启失败；结束录音
          stopListening()
        }
      }
    }

    listeningRef.current = true
    const rec = new speechCtor()
    attachHandlers(rec)
    recognitionRef.current = rec
    try {
      rec.start()
      setIsRecording(true)
    } catch {
      // Expected: start() 被拒绝或浏览器限制；复位状态
      stopListening()
    }
  }, [lang, speechCtor, stopListening])

  useEffect(() => {
    return () => {
      listeningRef.current = false
      const r = recognitionRef.current
      recognitionRef.current = null
      if (r) {
        try {
          r.abort()
        } catch {
          // Expected: 卸载时 abort 竞态；忽略
        }
      }
    }
  }, [])

  const toggle = () => {
    if (isRecording) stopListening()
    else startListening()
  }

  if (!speechCtor) {
    return null
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isRecording}
      title={isRecording ? '停止语音输入' : '语音输入'}
      className={[
        'relative shrink-0 p-2 rounded-lg transition-colors',
        'text-muted-foreground hover:bg-muted hover:text-foreground',
        isRecording && 'text-red-400 hover:text-red-300 bg-red-500/10',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {isRecording ? (
        <>
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 pointer-events-none">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <MicOff className="w-4 h-4" aria-hidden />
        </>
      ) : (
        <Mic className="w-4 h-4" aria-hidden />
      )}
    </button>
  )
}
