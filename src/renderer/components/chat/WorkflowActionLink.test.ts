/**
 * WorkflowActionLink — parseMbeLink 单元测试
 *
 * 纯函数测试，无需 DOM 环境。
 * 验证 mbe:// 协议解析的正确性和边界情况。
 */
import { describe, it, expect } from 'vitest'
import { parseMbeLink, type MbeLink } from './WorkflowActionLink'

describe('parseMbeLink', () => {
  // ── 正常解析 ──

  it('解析 workflow 链接', () => {
    const result = parseMbeLink('mbe://workflow/monthly_closing')
    expect(result).toEqual<MbeLink>({ protocol: 'workflow', id: 'monthly_closing' })
  })

  it('解析 tab 链接', () => {
    const result = parseMbeLink('mbe://tab/reports')
    expect(result).toEqual<MbeLink>({ protocol: 'tab', id: 'reports' })
  })

  it('解析 scenario 链接', () => {
    const result = parseMbeLink('mbe://scenario/bank_reconcile')
    expect(result).toEqual<MbeLink>({ protocol: 'scenario', id: 'bank_reconcile' })
  })

  it('解析 calc 链接', () => {
    const result = parseMbeLink('mbe://calc/vat')
    expect(result).toEqual<MbeLink>({ protocol: 'calc', id: 'vat' })
  })

  it('解析带连字符的 tab ID', () => {
    const result = parseMbeLink('mbe://tab/tax-filing')
    expect(result).toEqual<MbeLink>({ protocol: 'tab', id: 'tax-filing' })
  })

  it('解析带多级路径的 workflow ID', () => {
    const result = parseMbeLink('mbe://workflow/audit/planning')
    expect(result).toEqual<MbeLink>({ protocol: 'workflow', id: 'audit/planning' })
  })

  // ── 非 mbe:// 链接返回 null ──

  it('普通 HTTP 链接返回 null', () => {
    expect(parseMbeLink('https://example.com')).toBeNull()
  })

  it('普通 HTTPS 链接返回 null', () => {
    expect(parseMbeLink('https://mbe.hi-maker.com/pricing')).toBeNull()
  })

  it('mailto 链接返回 null', () => {
    expect(parseMbeLink('mailto:test@example.com')).toBeNull()
  })

  it('空字符串返回 null', () => {
    expect(parseMbeLink('')).toBeNull()
  })

  // ── 不合法的 mbe:// 链接 ──

  it('未知协议类型返回 null', () => {
    expect(parseMbeLink('mbe://unknown/something')).toBeNull()
  })

  it('缺少 ID 返回 null', () => {
    expect(parseMbeLink('mbe://workflow/')).toBeNull()
  })

  it('缺少斜杠返回 null', () => {
    expect(parseMbeLink('mbe://workflow')).toBeNull()
  })

  it('仅 mbe:// 前缀返回 null', () => {
    expect(parseMbeLink('mbe://')).toBeNull()
  })

  // ── 边界情况 ──

  it('大小写敏感（protocol 必须小写）', () => {
    expect(parseMbeLink('mbe://Workflow/test')).toBeNull()
    expect(parseMbeLink('mbe://WORKFLOW/test')).toBeNull()
  })

  it('mbe:// 前缀是精确匹配', () => {
    expect(parseMbeLink('xmbe://workflow/test')).toBeNull()
    expect(parseMbeLink('MBE://workflow/test')).toBeNull()
  })
})
