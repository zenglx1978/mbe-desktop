/**
 * Graph API 服务层 — 知识图谱 REST 端点调用
 * 后端服务: graph_api.py (port 8090), Nginx 路由: /api/graph/*
 *
 * 字段适配说明：后端 graph_api.py 返回的字段名与前端接口有差异，
 * 此文件在服务层做统一映射，避免组件层处理原始 API 差异。
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

// ── 内部适配工具 ───────────────────────────────────────────

/** 将后端 _slim_node / 全量 node 适配为前端 GraphNode */
function adaptNode(raw: Record<string, unknown>): GraphNode {
  return {
    id: String(raw.id ?? ''),
    label: String(raw.label ?? raw.id ?? ''),
    type: String(raw.type ?? raw.file_type ?? raw.node_type ?? 'unknown'),
    community: Number(raw.community ?? -1),
    community_label: String(raw.community_label ?? ''),
    degree: Number(raw.degree ?? 0),
    ...raw,
  } as GraphNode
}

// ── API 调用 ──────────────────────────────────────────────

/**
 * 健康检查。
 * 返回 null 表示服务不可用或数据未加载；
 * 只有在 loaded: true 时才视为可用。
 */
export async function fetchGraphHealth(): Promise<{ status: string } | null> {
  try {
    const res = await authFetch(`${PREFIX}/health`)
    if (!res.ok) return null
    const data = await res.json()
    // loaded: false 时图谱还没有数据，视为不可用
    if (!data?.loaded) return null
    return data
  } catch {
    return null
  }
}

export async function fetchGraphStats(): Promise<GraphStats> {
  const res = await authFetch(`${PREFIX}/stats`)
  if (!res.ok) throw new Error(`Graph stats failed (${res.status})`)
  const raw = await res.json()
  const nodes = raw.total_nodes ?? raw.nodes ?? 0
  const edges = raw.total_edges ?? raw.edges ?? 0
  const communities = raw.total_communities ?? raw.communities ?? 0
  return {
    nodes,
    edges,
    communities,
    node_types: (raw.file_types ?? raw.node_types ?? {}) as Record<string, number>,
    avg_degree: raw.avg_degree != null
      ? Number(raw.avg_degree)
      : nodes > 0 ? Number(((edges * 2) / nodes).toFixed(2)) : 0,
    density: raw.density ?? 0,
    load_time_sec: raw.load_time_sec ?? 0,
  }
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
  // 后端返回 { total, communities: [...] }
  const list: unknown[] = data.communities ?? (Array.isArray(data) ? data : [])
  return list.map((c: unknown) => {
    const raw = c as Record<string, unknown>
    return {
      id: Number(raw.id ?? 0),
      label: String(raw.label ?? ''),
      size: Number(raw.size ?? 0),
      top_nodes: (raw.top_nodes as string[]) ?? [],
    }
  })
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
  const raw = await res.json()
  return {
    query: String(raw.query ?? query),
    count: Number(raw.count ?? raw.total ?? (raw.results as unknown[])?.length ?? 0),
    results: ((raw.results as Record<string, unknown>[]) ?? []).map(adaptNode),
  }
}

/**
 * 获取节点详情 + 邻居。
 * 后端将节点和邻居分为两个接口，此处合并调用后统一返回。
 */
export async function fetchNodeDetail(nodeId: string): Promise<NodeDetail> {
  const encoded = encodeURIComponent(nodeId)
  const [nodeRes, nbRes] = await Promise.all([
    authFetch(`${PREFIX}/node/${encoded}`),
    authFetch(`${PREFIX}/neighbors/${encoded}?depth=1&limit=50`),
  ])
  if (!nodeRes.ok) throw new Error(`Node detail failed (${nodeRes.status})`)
  const rawNode = (await nodeRes.json()) as Record<string, unknown>
  const node = adaptNode(rawNode)

  let neighbors: NodeDetail['neighbors'] = []
  if (nbRes.ok) {
    const nbData = (await nbRes.json()) as Record<string, unknown>
    const nbNodes = (nbData.nodes as Record<string, unknown>[]) ?? []
    const nbEdges = (nbData.edges as Record<string, unknown>[]) ?? []

    // 建立邻居节点 Map，方便 edge 查找
    const nodeMap = new Map<string, GraphNode>(
      nbNodes.map((n) => [String(n.id), adaptNode(n)]),
    )

    // 按 edge 构建带方向的邻居列表
    neighbors = nbEdges
      .map((edge) => {
        const src = String(edge.source ?? '')
        const tgt = String(edge.target ?? '')
        const isOutgoing = src === nodeId
        const neighborId = isOutgoing ? tgt : src
        const neighborNode = nodeMap.get(neighborId)
        if (!neighborNode) return null
        return {
          node: neighborNode,
          edge_type: String(edge.relation ?? edge.type ?? ''),
          weight: Number(edge.weight ?? 1),
          direction: isOutgoing ? 'outgoing' : 'incoming',
        }
      })
      .filter((x): x is NodeDetail['neighbors'][number] => x !== null)

    // 如果没有 edges 数据但有 nodes，生成简单列表
    if (neighbors.length === 0 && nbNodes.length > 0) {
      neighbors = nbNodes.map((n) => ({
        node: adaptNode(n),
        edge_type: '',
        weight: 1,
        direction: 'outgoing',
      }))
    }
  }

  return { node, neighbors }
}

export async function fetchCommunityDetail(
  communityId: number,
): Promise<CommunityDetail> {
  const res = await authFetch(`${PREFIX}/community/${communityId}`)
  if (!res.ok) throw new Error(`Community detail failed (${res.status})`)
  const raw = (await res.json()) as Record<string, unknown>
  return {
    community_id: Number(raw.community_id ?? communityId),
    label: String(raw.label ?? ''),
    node_count: Number(raw.node_count ?? raw.total_nodes ?? raw.returned ?? 0),
    edge_count: Number(raw.edge_count ?? 0),
    nodes: ((raw.nodes as Record<string, unknown>[]) ?? []).map(adaptNode),
  }
}
