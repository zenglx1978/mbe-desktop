/**
 * Graph API 服务层 — 知识图谱 REST 端点调用
 * 后端服务: graph_api.py (port 8090), Nginx 路由: /api/graph/*
 */

import { API_BASE, authFetch } from '@/lib/api-client'

const PREFIX = `${API_BASE}/api/graph`

// ── 类型定义 ──────────────────────────────────────────────

export interface GraphStats {
  nodes: number
  edges: number
  communities: number
  node_types: Record<string, number>
  avg_degree: number
  density: number
  load_time_sec: number
}

export interface CommunityItem {
  id: number
  label: string
  size: number
  top_nodes: string[]
}

export interface GraphNode {
  id: string
  label: string
  type: string
  community: number
  community_label: string
  degree: number
  [key: string]: unknown
}

export interface GraphEdge {
  source: string
  target: string
  type: string
  weight: number
}

export interface SearchResult {
  query: string
  count: number
  results: GraphNode[]
}

export interface NodeDetail {
  node: GraphNode
  neighbors: Array<{
    node: GraphNode
    edge_type: string
    weight: number
    direction: string
  }>
}

export interface CommunityDetail {
  community_id: number
  label: string
  node_count: number
  edge_count: number
  nodes: GraphNode[]
}

// ── API 调用 ──────────────────────────────────────────────

export async function fetchGraphHealth(): Promise<{ status: string } | null> {
  try {
    const res = await authFetch(`${PREFIX}/health`)
    if (res.ok) return res.json()
    return null
  } catch {
    return null
  }
}

export async function fetchGraphStats(): Promise<GraphStats> {
  const res = await authFetch(`${PREFIX}/stats`)
  if (!res.ok) throw new Error(`Graph stats failed (${res.status})`)
  return res.json()
}

export async function fetchCommunities(
  minSize = 0,
  limit = 50,
): Promise<CommunityItem[]> {
  const params = new URLSearchParams()
  if (minSize > 0) params.set('min_size', String(minSize))
  if (limit !== 50) params.set('limit', String(limit))
  const qs = params.toString()
  const res = await authFetch(`${PREFIX}/communities${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(`Communities failed (${res.status})`)
  const data = await res.json()
  return data.communities ?? data
}

export async function searchNodes(
  query: string,
  nodeType?: string,
  limit = 20,
): Promise<SearchResult> {
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  if (nodeType) params.set('type', nodeType)
  const res = await authFetch(`${PREFIX}/search?${params}`)
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  return res.json()
}

export async function fetchNodeDetail(nodeId: string): Promise<NodeDetail> {
  const res = await authFetch(`${PREFIX}/node/${encodeURIComponent(nodeId)}`)
  if (!res.ok) throw new Error(`Node detail failed (${res.status})`)
  return res.json()
}

export async function fetchCommunityDetail(
  communityId: number,
): Promise<CommunityDetail> {
  const res = await authFetch(
    `${PREFIX}/community/${communityId}`,
  )
  if (!res.ok) throw new Error(`Community detail failed (${res.status})`)
  return res.json()
}
