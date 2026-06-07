/**
 * 数字安全工具 — 防止 undefined/null/NaN 传入数值方法导致运行时崩溃。
 *
 * 背景：后端 API 返回的数值字段随时可能是 null / undefined，
 * 直接调用 .toFixed() / .toLocaleString() 会抛 TypeError。
 * 统一从这里调用，一处封装，全局安全。
 */

/** 将任意值安全转为有限数字，不合法时返回 fallback（默认 0）。 */
export function safeNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    if (isFinite(n)) return n
  }
  return fallback
}

/** 安全的 toFixed，相当于 safeNum(v).toFixed(digits)。 */
export function safeFixed(v: unknown, digits = 0, fallback = 0): string {
  return safeNum(v, fallback).toFixed(digits)
}

/** 安全的货币格式：¥1,234，相当于 safeNum(v).toLocaleString()。 */
export function safeCNY(v: unknown, fallback = 0): string {
  return `¥${safeNum(v, fallback).toLocaleString()}`
}

/** 安全的 toLocaleString，不带货币符号。 */
export function safeLocale(v: unknown, fallback = 0): string {
  return safeNum(v, fallback).toLocaleString()
}

/**
 * 将秒数格式化为易读时间字符串。
 * 例：3700 → "1.0 小时"，120 → "2 分钟"，45 → "45 秒"
 */
export function formatSeconds(v: unknown): string {
  const sec = safeNum(v)
  if (sec >= 3600) return `${(sec / 3600).toFixed(1)} 小时`
  if (sec >= 60)   return `${(sec / 60).toFixed(0)} 分钟`
  return `${sec.toFixed(0)} 秒`
}
