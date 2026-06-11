import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getIndex, listFiles, listNodes, listSymbols, listCalls, parseMeta,
  type ApiFile, type ApiAstNode, type ApiSymbol, type ApiCall, type ApiStats,
  type GraphPayload, type GraphNode, type GraphEdge,
} from "./api";

type Status = "connecting" | "connected" | "disconnected";

type Resource<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  updated: number;
};

type Ctx = {
  status: Status;
  retry: () => void;
  indexStats: ApiStats | null;

  files: Resource<ApiFile[]>;
  astNodes: Resource<ApiAstNode[]>;
  symbols: Resource<ApiSymbol[]>;
  calls: Resource<ApiCall[]>;
  refreshAll: () => void;
  /** Rows collected so far while a full dataset load is in flight. */
  progressRows: number;

  // Derived graph composed from /files, /nodes, /symbols and /calls,
  // consumed by visualization-style sections.
  graph: GraphPayload | null;
  graphLoading: boolean;
  graphError: string | null;
  refreshGraph: () => void;
  graphUpdated: number;

  stats: Record<string, unknown> | null;
  statsLoading: boolean;
  statsError: string | null;
  refreshStats: () => void;
  statsUpdated: number;

  antipatterns: Record<string, unknown> | null;
  antipatternsLoading: boolean;
  antipatternsError: string | null;
  refreshAntipatterns: () => void;
  antipatternsUpdated: number;
};

const C = createContext<Ctx | null>(null);

const MISSING_ENDPOINT_MSG = "This backend does not expose a quality-reports endpoint (expected /analysis/quality-reports). Disable this page in Settings.";

/**
 * All four list endpoints collected as one atomic unit. The dataset is only
 * committed (and the graph composed) once EVERY endpoint has been fully
 * paginated — partial data is never rendered, so the graph lays out exactly
 * once per load instead of restarting as each endpoint trickles in.
 */
type Dataset = {
  files: ApiFile[];
  astNodes: ApiAstNode[];
  symbols: ApiSymbol[];
  calls: ApiCall[];
};

export function V3rtexProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("connecting");
  const [indexStats, setIndexStats] = useState<ApiStats | null>(null);
  const [tick, setTick] = useState(0);

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(0);
  const [progressRows, setProgressRows] = useState(0);

  // health polling against the index endpoint
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const r = await getIndex();
        if (cancelled) return;
        const ok = r.status >= 200 && r.status < 300;
        setStatus(ok ? "connected" : "disconnected");
        if (ok && r.data?.stats) {
          // keep identity stable when stats haven't changed to avoid re-renders
          setIndexStats((prev) => prev && JSON.stringify(prev) === JSON.stringify(r.data.stats) ? prev : r.data.stats);
        }
      } catch {
        if (!cancelled) setStatus("disconnected");
      }
    };
    check();
    const i = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(i); };
  }, [tick]);

  const refreshAll = () => {
    setLoading(true);
    setError(null);
    setProgressRows(0);
    // per-source cumulative row counts, summed for the progress indicator
    const counts = [0, 0, 0, 0];
    const track = (i: number) => (n: number) => {
      counts[i] = n;
      setProgressRows(counts[0] + counts[1] + counts[2] + counts[3]);
    };
    Promise.all([
      listFiles(track(0)),
      listNodes({}, track(1)),
      listSymbols(track(2)),
      listCalls(track(3)),
    ])
      .then(([f, n, s, c]) => {
        const bad = [f, n, s, c].find((r) => r.status >= 400);
        if (bad) throw new Error(`HTTP ${bad.status}`);
        // single atomic commit: everything is fully collected at this point
        setDataset({ files: f.data, astNodes: n.data, symbols: s.data, calls: c.data });
        setUpdated(Date.now());
      })
      .catch((e) => setError((e as Error).message ?? String(e)))
      .finally(() => setLoading(false));
  };

  // initial fetch once connected
  const [fetched, setFetched] = useState(false);
  useEffect(() => {
    if (status === "connected" && !fetched) { setFetched(true); refreshAll(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, fetched]);

  // Resource views over the atomic dataset (keeps the per-section API)
  const files = useMemo<Resource<ApiFile[]>>(() => ({ data: dataset?.files ?? null, loading, error, updated }), [dataset, loading, error, updated]);
  const astNodes = useMemo<Resource<ApiAstNode[]>>(() => ({ data: dataset?.astNodes ?? null, loading, error, updated }), [dataset, loading, error, updated]);
  const symbols = useMemo<Resource<ApiSymbol[]>>(() => ({ data: dataset?.symbols ?? null, loading, error, updated }), [dataset, loading, error, updated]);
  const calls = useMemo<Resource<ApiCall[]>>(() => ({ data: dataset?.calls ?? null, loading, error, updated }), [dataset, loading, error, updated]);

  // ----- derived graph (FILE / CLASS / FUNCTION / VARIABLE nodes; CONTAINS / IMPORTS / CALLS edges)
  // Composed exclusively from the atomic dataset, so it is built exactly once
  // per complete load — never from partially collected data.
  const graph = useMemo<GraphPayload | null>(() => {
    if (!dataset) return null;
    const fileById = new Map(dataset.files.map((f) => [f.id, f]));
    const astById = new Map(dataset.astNodes.map((n) => [n.id, n]));
    const nodes: GraphNode[] = dataset.files.map((f) => ({
      id: f.id,
      name: f.name,
      type: "FILE",
      file_id: f.id,
      file_path: f.relative_path,
      language: f.language ?? undefined,
      size: f.size,
      hash: f.hash,
      is_empty: !!f.is_empty,
      is_large: !!f.is_large,
      has_syntax_errors: !!f.has_syntax_errors,
      last_modified: f.last_modified,
    }));

    const defs = dataset.astNodes.filter((n) => n.node_type === "class_definition" || n.node_type === "function_definition");
    const defIds = new Set(defs.map((d) => d.id));
    defs.forEach((d) => {
      const meta = parseMeta(d);
      nodes.push({
        id: d.id,
        name: d.qualified_name ?? d.name ?? d.id,
        type: d.node_type === "class_definition" ? "CLASS" : "FUNCTION",
        file_id: d.file_id,
        file_path: fileById.get(d.file_id)?.relative_path,
        start_line: d.start_line,
        end_line: d.end_line,
        parent_id: d.parent_id ?? undefined,
        is_async: meta.is_async === true,
        docstring: typeof meta.docstring === "string" ? meta.docstring : undefined,
      });
    });

    const edges: GraphEdge[] = [];
    defs.forEach((d) => {
      const source = d.parent_id && defIds.has(d.parent_id) ? d.parent_id : d.file_id;
      edges.push({ source, target: d.id, type: "CONTAINS" });
    });

    // Imports target the actual imported node (class / function / variable),
    // not the file that contains it. Targets that are not definitions
    // (e.g. module-level assignments) are added as VARIABLE nodes.
    const nodeIds = new Set(nodes.map((n) => n.id));
    dataset.symbols.forEach((s) => {
      if (!s.target_node_id) return;
      if (!nodeIds.has(s.target_node_id)) {
        const t = astById.get(s.target_node_id);
        if (!t) return;
        nodes.push({
          id: t.id,
          name: t.qualified_name ?? t.name ?? t.id,
          type: "VARIABLE",
          file_id: t.file_id,
          file_path: fileById.get(t.file_id)?.relative_path,
          start_line: t.start_line,
          end_line: t.end_line,
        });
        nodeIds.add(t.id);
        edges.push({ source: t.file_id, target: t.id, type: "CONTAINS" });
      }
      edges.push({
        source: s.import_file_id,
        target: s.target_node_id,
        type: "IMPORTS",
        is_resolved: true,
        resolution: s.resolution,
        statement: s.import_text,
      });
    });

    dataset.calls.forEach((c) => {
      if (c.callee_node_id) {
        edges.push({
          source: c.caller_node_id,
          target: c.callee_node_id,
          type: "CALLS",
          is_resolved: true,
          resolution: c.resolution,
          line_number: c.call_site_line ?? undefined,
        });
      }
    });

    return { nodes, edges };
  }, [dataset]);

  const stats = useMemo<Record<string, unknown> | null>(
    () => (indexStats ? { ...indexStats } : null),
    [indexStats]
  );

  return (
    <C.Provider value={{
      status, retry: () => setTick((t) => t + 1), indexStats,
      files, astNodes, symbols, calls, refreshAll, progressRows,
      graph, graphLoading: loading, graphError: error, refreshGraph: refreshAll, graphUpdated: updated,
      stats, statsLoading: false, statsError: null, refreshStats: () => setTick((t) => t + 1), statsUpdated: updated,
      antipatterns: null, antipatternsLoading: false, antipatternsError: MISSING_ENDPOINT_MSG,
      refreshAntipatterns: () => {}, antipatternsUpdated: 0,
    }}>{children}</C.Provider>
  );
}

export function useV3rtex() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useV3rtex outside provider");
  return ctx;
}
