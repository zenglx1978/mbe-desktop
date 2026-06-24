/** Electron 安全剪贴板写入（navigator.clipboard 在部分桌面环境会静默失败） */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fallback below */
  }

  const api = window.electronAPI
  if (api?.writeClipboardText) {
    return Boolean(await api.writeClipboardText(text))
  }

  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
