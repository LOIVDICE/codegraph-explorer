export const API_BASE = "http://localhost:7331";

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

export async function getGraph() { return apiFetch<GraphPayload>("/graph"); }
export async function getStats() { return apiFetch<Record<string, unknown>>("/stats"); }
export async function getAntipatterns() { return apiFetch<Record<string, unknown>>("/antipatterns"); }
export async function getNode(id: string) { return apiFetch<GraphNode & { children?: GraphNode[] }>(`/node/${encodeURIComponent(id)}`); }
export async function getHealth() { return apiFetch<unknown>("/health"); }
