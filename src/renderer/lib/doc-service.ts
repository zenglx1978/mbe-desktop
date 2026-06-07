/**
 * Document Service — 用户文档 CRUD（后端持久化 + localStorage 降级）
 */
import { API_BASE, authFetch } from '@/lib/api-client'
import type { AccountDocumentApiRow, AccountDocumentsListResponse } from '@/types/api-responses'

export type DocType = 'report' | 'contract' | 'voucher' | 'checklist' | 'note' | 'other'

export interface DocItem {
  id: string
  title: string
  type: DocType
  content: string
  createdAt: string
  updatedAt: string
  source?: string
  solutionId?: string
}

const LS_PREFIX = 'mbe_docs_'

function lsKey(solutionId: string) {
  return `${LS_PREFIX}${solutionId}`
}

function readLS(solutionId: string): DocItem[] {
  try {
    return JSON.parse(localStorage.getItem(lsKey(solutionId)) || '[]')
  } catch {
    // Expected: localStorage 文档缓存非合法 JSON；按空列表
    return []
  }
}

function writeLS(solutionId: string, docs: DocItem[]) {
  localStorage.setItem(lsKey(solutionId), JSON.stringify(docs))
}

export async function fetchDocs(solutionId: string): Promise<DocItem[]> {
  try {
    const params = new URLSearchParams({ solution_id: solutionId, limit: '200' })
    const resp = await authFetch(`${API_BASE}/api/v1/account/documents?${params}`, {
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) throw new Error(`${resp.status}`)
    const data = (await resp.json()) as AccountDocumentsListResponse
    const docs: DocItem[] = (data.documents || []).map((d: AccountDocumentApiRow) => ({
      id: d.id,
      title: d.title,
      type: d.type as DocType,
      content: d.content,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      source: d.source,
      solutionId: d.solutionId,
    }))
    writeLS(solutionId, docs)
    return docs
  } catch {
    // Expected: 远端文档列表失败；读本地缓存
    return readLS(solutionId)
  }
}

export async function createDoc(
  solutionId: string,
  title: string,
  type: DocType,
  content: string,
): Promise<DocItem> {
  const fallback: DocItem = {
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title, type, content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: 'manual',
    solutionId,
  }

  try {
    const resp = await authFetch(`${API_BASE}/api/v1/account/documents`, {
      method: 'POST',
      body: JSON.stringify({ title, doc_type: type, content, solution_id: solutionId }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) throw new Error(`${resp.status}`)
    const d = (await resp.json()) as AccountDocumentApiRow
    return {
      id: d.id,
      title: d.title,
      type: d.type as DocType,
      content: d.content,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      source: d.source,
      solutionId: d.solutionId,
    }
  } catch {
    // Expected: 远端创建失败；写入本地降级草稿
    const docs = readLS(solutionId)
    writeLS(solutionId, [fallback, ...docs])
    return fallback
  }
}

export async function updateDoc(
  docId: string,
  updates: { title?: string; doc_type?: string; content?: string },
  solutionId?: string,
): Promise<boolean> {
  try {
    const resp = await authFetch(`${API_BASE}/api/v1/account/documents/${docId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
      signal: AbortSignal.timeout(15_000),
    })
    if (resp.ok && solutionId) {
      const docs = readLS(solutionId)
      const idx = docs.findIndex(d => d.id === docId)
      if (idx >= 0) {
        const doc = docs[idx]!
        if (updates.title) doc.title = updates.title
        if (updates.doc_type) doc.type = updates.doc_type as DocType
        if (updates.content) doc.content = updates.content
        doc.updatedAt = new Date().toISOString()
        writeLS(solutionId, docs)
      }
    }
    return resp.ok
  } catch {
    if (solutionId) {
      const docs = readLS(solutionId)
      const idx = docs.findIndex(d => d.id === docId)
      if (idx >= 0) {
        const doc = docs[idx]!
        if (updates.title) doc.title = updates.title
        if (updates.doc_type) doc.type = updates.doc_type as DocType
        if (updates.content) doc.content = updates.content
        doc.updatedAt = new Date().toISOString()
        writeLS(solutionId, docs)
        return true
      }
    }
    return false
  }
}

export async function deleteDoc(solutionId: string, docId: string): Promise<boolean> {
  try {
    const resp = await authFetch(`${API_BASE}/api/v1/account/documents/${docId}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(15_000),
    })
    if (resp.ok) {
      const docs = readLS(solutionId)
      writeLS(solutionId, docs.filter(d => d.id !== docId))
    }
    return resp.ok
  } catch {
    // Expected: 远端删除失败；仍同步本地缓存
    const docs = readLS(solutionId)
    writeLS(solutionId, docs.filter(d => d.id !== docId))
    return true
  }
}
