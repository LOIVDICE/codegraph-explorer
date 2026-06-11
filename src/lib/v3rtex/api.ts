// Proxied through Vite (see vite.config.ts) to http://127.0.0.1:7331,
// because the backend does not send CORS headers.
export const API_BASE = "/v3rtex-api";

// ---------------------------------------------------------------------------
// Raw shapes returned by the V3RTEX API (http://127.0.0.1:7331)
// Endpoints: /  /files  /files/{id}  /nodes  /nodes/{id}  /symbols  /calls
// ---------------------------------------------------------------------------

export type ApiStats = {
  directories: number;
  files: number;
  nodes: number;
  symbol_edges: number;
  call_edges: number;
};

export type ApiIndex = {
  endpoints: string[];
  stats: ApiStats;
};

export type ApiFile = {
  id: string;
  directory_id: string | null;
  path: string;
  name: string;
  relative_path: string;
  language: string | null;
  size: number;
  line_count: number;
  encoding: string;
  hash: string;
  last_modified: number;
  is_empty: 0 | 1;
  is_large: 0 | 1;
  has_syntax_errors: 0 | 1;
  warnings: string;
};

export type ApiAstNode = {
  id: string;
  file_id: string;
  parent_id: string | null;
  category: string;
  node_type: string;
  name: string | null;
  qualified_name: string | null;
  start_line: number;
  end_line: number;
  start_column: number;
  end_column: number;
  text: string;
  metadata: string;
};

export type ApiSymbol = {
  id: number;
  import_node_id: string;
  symbol_name: string;
  target_node_id: string | null;
  external_module: string | null;
  resolution: string;
  hops: string;
  import_text: string;
  import_file_id: string;
  target_name: string | null;
  target_qualified_name: string | null;
  target_file_id: string | null;
};

export type ApiCall = {
  id: number;
  caller_node_id: string;
  callee_node_id: string | null;
  call_site_node_id: string;
  edge_type: string;
  resolution: string;
  hops: string;
  caller_name: string | null;
  caller_qualified_name: string | null;
  caller_file_id: string;
  callee_name: string | null;
  callee_qualified_name: string | null;
  callee_file_id: string | null;
  call_site_text: string;
  call_site_line: number | null;
};

export type ApiFileDetail = ApiFile & { nodes: ApiAstNode[] };

// ---------------------------------------------------------------------------
// Derived graph shapes consumed by visualization / inspector components
// ---------------------------------------------------------------------------

export type GraphNode = {
  id: string;
  name?: string;
  type?: string;
  file_path?: string;
  language?: string;
  size?: number;
  hash?: string;
  is_empty?: boolean;
  is_large?: boolean;
  has_syntax_errors?: boolean;
  last_modified?: string | number;
  grade?: string;
  health_score?: number;
  cyclomatic_complexity?: number;
  maintainability_index?: number;
  afferent_coupling?: number;
  efferent_coupling?: number;
  in_degree?: number;
  out_degree?: number;
  start_line?: number;
  end_line?: number;
  params?: string[];
  decorators?: string[];
  is_async?: boolean;
  is_generator?: boolean;
  is_constant?: boolean;
  docstring?: string;
  body_text?: string;
  base_classes?: string[];
  module?: string;
  symbols?: string[];
  alias?: string;
  import_type?: string;
  callee_name?: string;
  raw_callee?: string;
  caller?: string;
  line_number?: number;
  resolution?: string;
  reason?: string;
  inferred_type?: string;
  parent_id?: string;
  [k: string]: unknown;
};

export type GraphEdge = {
  id?: string;
  source: string;
  target: string;
  type: string;
  is_resolved?: boolean;
  resolution?: string;
  line_number?: number;
  reason?: string;
  [k: string]: unknown;
};

export type GraphPayload = {
  nodes: GraphNode[];
  edges?: GraphEdge[];
  links?: GraphEdge[];
};

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<{ data: T; status: number; ms: number; size: number; raw: string }> {
  const start = performance.now();
  const res = await fetch(`${API_BASE}${path}`, init);
  const raw = await res.text();
  const ms = Math.round(performance.now() - start);
  let data: unknown = null;
  try { data = JSON.parse(raw); } catch { data = raw; }
  return { data: data as T, status: res.status, ms, size: new Blob([raw]).size, raw };
}

// Per-request cap enforced by the API (see openapi: limit max = 1000).
const MAX_LIMIT = 1000;
// Safety ceiling so a misbehaving/huge dataset can never spin forever.
// 500 pages * 1000 = up to 500k rows.
const MAX_PAGES = 500;

export type PagedResult<T> = {
  /** All rows accumulated across every page. */
  data: T[];
  /** Last HTTP status seen (the failing one if a page errored). */
  status: number;
  /** Number of requests made. */
  pages: number;
  /** True if the safety ceiling was hit before exhausting the data. */
  truncated: boolean;
};

/**
 * Fetches every page of a list endpoint by walking `offset` until a short
 * page is returned. This makes any list endpoint resilient to datasets
 * larger than the API's per-request `limit`.
 */
export async function fetchAllPaged<T>(
  basePath: string,
  key: string,
  extra?: Record<string, string>,
  onRows?: (rowsSoFar: number) => void
): Promise<PagedResult<T>> {
  const all: T[] = [];
  let offset = 0;
  let status = 200;
  let pages = 0;
  for (; pages < MAX_PAGES; pages++) {
    const q = new URLSearchParams({ limit: String(MAX_LIMIT), offset: String(offset), ...(extra ?? {}) });
    const res = await apiFetch<Record<string, unknown>>(`${basePath}?${q}`);
    status = res.status;
    if (res.status >= 400) return { data: all, status, pages: pages + 1, truncated: false };
    const rows = (res.data?.[key] as T[] | undefined) ?? [];
    all.push(...rows);
    onRows?.(all.length);
    if (rows.length < MAX_LIMIT) return { data: all, status, pages: pages + 1, truncated: false };
    offset += MAX_LIMIT;
  }
  // Hit the page ceiling — return what we have and flag it.
  if (typeof console !== "undefined") {
    console.warn(`[v3rtex] ${basePath} exceeded ${MAX_PAGES} pages (${all.length} rows); data may be truncated.`);
  }
  return { data: all, status, pages, truncated: true };
}

export async function getIndex() { return apiFetch<ApiIndex>("/"); }
export async function listFiles(onRows?: (n: number) => void) { return fetchAllPaged<ApiFile>("/files", "files", undefined, onRows); }
export async function getFile(id: string) { return apiFetch<ApiFileDetail>(`/files/${encodeURIComponent(id)}`); }
export async function listNodes(params: { file_id?: string; category?: string; name?: string } = {}, onRows?: (n: number) => void) {
  const extra: Record<string, string> = {};
  if (params.file_id) extra.file_id = params.file_id;
  if (params.category) extra.category = params.category;
  if (params.name) extra.name = params.name;
  return fetchAllPaged<ApiAstNode>("/nodes", "nodes", extra, onRows);
}
export async function getNodeDetail(id: string) { return apiFetch<ApiAstNode>(`/nodes/${encodeURIComponent(id)}`); }
export async function listSymbols(onRows?: (n: number) => void) { return fetchAllPaged<ApiSymbol>("/symbols", "symbols", undefined, onRows); }
export async function listCalls(onRows?: (n: number) => void) { return fetchAllPaged<ApiCall>("/calls", "calls", undefined, onRows); }

/** Parses the JSON-string `metadata` column of an AST node. */
export function parseMeta(node: ApiAstNode): Record<string, unknown> {
  try { return JSON.parse(node.metadata) as Record<string, unknown>; } catch { return {}; }
}

export function parseHops(hops: string): string[] {
  try { const v = JSON.parse(hops); return Array.isArray(v) ? v : []; } catch { return []; }
}
