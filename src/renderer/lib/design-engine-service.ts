import { API_BASE, authFetch } from '@/lib/api-client'

// ── 类型定义 ──────────────────────────────────────────────

export type DesignFormat = 'png' | 'pdf' | 'svg' | 'pptx'
export type DesignTheme = 'dark' | 'light'

export interface GenerateRequest {
  markdown: string
  format: DesignFormat
  page?: number
  theme?: DesignTheme
  agent?: string
}

export interface DesignHealthResponse {
  status: string
  formats: string[]
}

// ── API 调用 ──────────────────────────────────────────────

export async function checkDesignHealth(): Promise<DesignHealthResponse | null> {
  try {
    const res = await authFetch(`${API_BASE}/api/design/health`)
    if (res.ok) return res.json()
    return null
  } catch {
    return null
  }
}

export async function generateDesign(req: GenerateRequest): Promise<Blob> {
  const res = await authFetch(`${API_BASE}/api/design/generate`, {
    method: 'POST',
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `生成失败 (HTTP ${res.status})`)
  }
  return res.blob()
}

// ── 工具函数 ──────────────────────────────────────────────

const MEDIA_EXT: Record<DesignFormat, string> = {
  png: '.png',
  pdf: '.pdf',
  svg: '.svg',
  pptx: '.pptx',
}

export function downloadBlob(blob: Blob, format: DesignFormat, stem = 'design') {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${stem}${MEDIA_EXT[format]}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
