import { lazy, Suspense, useMemo, useRef, useState, useEffect } from "react";
const ForceGraph2D = lazy(() => import("react-force-graph-2d").then((m) => ({ default: m.default })));
const ForceGraph3D = lazy(() => import("react-force-graph-3d").then((m) => ({ default: m.default })));
import { useV3rtex } from "@/lib/v3rtex/context";
import { usePageState, resetPageState } from "@/lib/v3rtex/page-state";
import { SidePanel } from "@/lib/v3rtex/side-panel";
import { Card, SectionHeader, Skeleton, ErrorCard, GradeBadge, scoreToGrade, gradeColor } from "../ui";
import type { GraphEdge, GraphNode } from "@/lib/v3rtex/api";

const EDGE_TYPES = ["CALLS", "IMPORTS", "CONTAINS"];
const NODE_TYPES = ["FILE", "CLASS", "FUNCTION", "VARIABLE"];

const EDGE_COLOR: Record<string, string> = {
  CALLS: "#7c3aed", IMPORTS: "#2563eb", CONTAINS: "#0891b2",
};

const NODE_COLOR: Record<string, string> = {
  FILE: "#2563eb", CLASS: "#7c3aed", FUNCTION: "#059669", VARIABLE: "#d97706",
};

type GraphRef = {
  centerAt?: (x: number, y: number, ms?: number) => void;
  zoom?: (z: number, ms?: number) => void;
  zoomToFit: (ms?: number, pad?: number) => void;
};

export function GraphVisualization() {
  const { graph, graphLoading, graphError, refreshGraph, graphUpdated, progressRows } = useV3rtex();
  const ref = useRef<GraphRef | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [nodeTypes, setNodeTypes] = usePageState<Record<string, boolean>>("viz:nodeTypes", () => Object.fromEntries(NODE_TYPES.map((t) => [t, true])));
  const [edgeTypes, setEdgeTypes] = usePageState<Record<string, boolean>>("viz:edgeTypes", () => Object.fromEntries(EDGE_TYPES.map((t) => [t, true])));
  const [mode, setMode] = usePageState<"GRANULAR" | "MODULAR">("viz:mode", "GRANULAR");
  const [dim, setDim] = usePageState<"2D" | "3D">("viz:dim", "2D");
  const [search, setSearch] = usePageState("viz:search", "");
  const [selected, setSelected] = usePageState<GraphNode | null>("viz:selected", null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverLink, setHoverLink] = useState<unknown>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      const r = wrapRef.current!.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    if (!graph) return { nodes: [], links: [] };
    const allNodes = graph.nodes;
    const allEdges = (graph.edges ?? graph.links ?? []) as GraphEdge[];
    if (mode === "MODULAR") {
      // Aggregate everything to file level: an edge between two nodes becomes
      // an edge between their containing files.
      const fileNodes = allNodes.filter((n) => n.type === "FILE");
      const fileIds = new Set(fileNodes.map((n) => n.id));
      const nodeFile = new Map(allNodes.map((n) => [n.id, (n.file_id as string) ?? n.id]));
      const seen = new Set<string>();
      const links: GraphEdge[] = [];
      allEdges.forEach((e) => {
        if (e.type === "CONTAINS" || !edgeTypes[e.type]) return;
        const s = nodeFile.get(e.source) ?? e.source;
        const t = nodeFile.get(e.target) ?? e.target;
        if (s === t || !fileIds.has(s) || !fileIds.has(t)) return;
        const k = `${s}|${t}|${e.type}`;
        if (seen.has(k)) return;
        seen.add(k);
        links.push({ source: s, target: t, type: e.type });
      });
      return { nodes: fileNodes.map((n) => ({ ...n })), links };
    }
    const filteredNodes = allNodes.filter((n) => nodeTypes[n.type ?? ""] !== false);
    const ids = new Set(filteredNodes.map((n) => n.id));
    return {
      nodes: filteredNodes.map((n) => ({ ...n })),
      links: allEdges.filter((e) => edgeTypes[e.type] && ids.has(e.source) && ids.has(e.target)).map((e) => ({ ...e })),
    };
  }, [graph, nodeTypes, edgeTypes, mode]);

  const neighborIds = useMemo(() => {
    if (!selected) return new Set<string>();
    const s = new Set<string>([selected.id]);
    (data.links as GraphEdge[]).forEach((e) => {
      if (e.source === selected.id) s.add(e.target as string);
      if (e.target === selected.id) s.add(e.source as string);
    });
    return s;
  }, [selected, data.links]);

  const searchHit = useMemo(() => {
    if (!search) return null;
    return (data.nodes as GraphNode[]).find((n) => (n.name ?? n.id).toLowerCase().includes(search.toLowerCase()));
  }, [search, data.nodes]);

  useEffect(() => {
    if (dim !== "2D") return;
    if (searchHit && ref.current?.centerAt && ref.current.zoom) {
      const n = searchHit as GraphNode & { x?: number; y?: number };
      if (n.x != null && n.y != null) {
        ref.current.centerAt(n.x, n.y, 800);
        ref.current.zoom(4, 800);
      }
    }
  }, [searchHit, dim]);

  // The header reload button resets this page's UI params before refetching.
  const refresh = () => { resetPageState("viz"); refreshGraph(); };

  if (graphError) return <Wrap onR={refresh}><ErrorCard message={graphError} onRetry={refreshGraph} /></Wrap>;
  // The graph is only composed once ALL endpoints are fully paginated, so it
  // renders exactly once with the complete dataset — never partial data.
  if (!graph) {
    return (
      <Wrap onR={refresh}>
        <Card className="p-8 mb-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-foreground animate-pulse" />
            <div>
              <div className="text-sm font-semibold">Collecting full dataset…</div>
              <div className="text-xs text-muted-foreground mt-0.5 mono tabular-nums">
                {progressRows.toLocaleString()} rows loaded from /files, /nodes, /symbols and /calls
              </div>
            </div>
          </div>
        </Card>
        <Skeleton rows={10} />
      </Wrap>
    );
  }

  const nodeSize = (n: GraphNode) => n.type === "FILE" ? 5 : n.type === "CLASS" ? 4 : n.type === "FUNCTION" ? 2.5 : 2;
  const nodeColor = (n: GraphNode) => {
    if (selected && !neighborIds.has(n.id)) return "rgba(180,180,180,0.3)";
    if (searchHit && n.id !== searchHit.id) return "rgba(180,180,180,0.2)";
    // Type color always matches the legend in the controls panel.
    return NODE_COLOR[n.type ?? ""] ?? gradeColor(n.grade ?? scoreToGrade(n.health_score));
  };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const commonProps = {
    width: size.w,
    height: size.h,
    graphData: data as any,
    nodeId: "id",
    nodeLabel: ((n: any) => `${n.name ?? n.id} (${n.type})`) as any,
    nodeVal: nodeSize as any,
    nodeColor: nodeColor as any,
    linkColor: ((l: any) => {
      if (selected) {
        const sId = typeof l.source === "string" ? l.source : l.source?.id;
        const tId = typeof l.target === "string" ? l.target : l.target?.id;
        if (sId !== selected.id && tId !== selected.id) return "rgba(200,200,200,0.15)";
      }
      return EDGE_COLOR[l.type] ?? "#999";
    }) as any,
    linkDirectionalArrowLength: 3,
    linkDirectionalArrowRelPos: 1,
    linkLabel: ((l: any) => l.type) as any,
    linkWidth: ((l: any) => {
      if (hoverLink === l) return 2;
      return hoverId && (l.source?.id === hoverId || l.target?.id === hoverId || l.source === hoverId || l.target === hoverId) ? 1.5 : 0.5;
    }) as any,
    onLinkHover: ((l: any) => setHoverLink(l ?? null)) as any,
    onNodeClick: ((n: any) => setSelected(n)) as any,
    onNodeHover: ((n: any) => setHoverId(n?.id ?? null)) as any,
    onBackgroundClick: () => setSelected(null),
    cooldownTicks: 100,
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <Wrap onR={refresh} ts={graphUpdated}>
      {/* Graph parameters + node details live in the sidebar's sliding panel. */}
      <SidePanel>
        <div className="p-3 space-y-3 text-xs border-b border-border">
          <div>
            <div className="font-semibold mb-1.5">View</div>
            <div className="flex gap-1">
              {(["2D", "3D"] as const).map((d) => (
                <button key={d} onClick={() => setDim(d)} className={`flex-1 px-2 py-1 rounded border ${dim === d ? "bg-foreground text-background border-foreground" : "border-border"}`}>
                  {d === "2D" ? "Flat 2D" : "3D Interactive"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="font-semibold mb-1.5">Mode</div>
            <div className="flex gap-1">
              {(["GRANULAR", "MODULAR"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`flex-1 px-2 py-1 rounded border ${mode === m ? "bg-foreground text-background border-foreground" : "border-border"}`}>{m}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="font-semibold mb-1.5">Node Types</div>
            {NODE_TYPES.map((t) => (
              <label key={t} className={`flex items-center gap-2 py-0.5 cursor-pointer ${mode === "MODULAR" && t !== "FILE" ? "opacity-40" : ""}`}>
                <input type="checkbox" checked={nodeTypes[t]} disabled={mode === "MODULAR" && t !== "FILE"} onChange={(e) => setNodeTypes({ ...nodeTypes, [t]: e.target.checked })} />
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: NODE_COLOR[t] }} />
                <span className="mono">{t}</span>
              </label>
            ))}
          </div>
          <div>
            <div className="font-semibold mb-1.5">Edge Types</div>
            {EDGE_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-2 py-0.5 cursor-pointer">
                <input type="checkbox" checked={edgeTypes[t]} onChange={(e) => setEdgeTypes({ ...edgeTypes, [t]: e.target.checked })} />
                <span className="w-3 h-0.5" style={{ background: EDGE_COLOR[t] }} />
                <span className="mono">{t}</span>
              </label>
            ))}
          </div>
          <button onClick={() => ref.current?.zoomToFit(400, 50)} className="w-full px-2 py-1 border border-border rounded hover:bg-muted">Reset Camera</button>
        </div>

        {/* Node details: empty until a node is clicked on the graph. */}
        <div className="p-3 text-xs flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Node Details</div>
            {selected && <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">×</button>}
          </div>
          {selected ? (
            <div className="space-y-1.5">
              <div className="font-semibold mono truncate mb-1" title={selected.name ?? selected.id}>{selected.name ?? selected.id}</div>
              <Row k="Type" v={
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: NODE_COLOR[selected.type ?? ""] ?? "#a1a1aa" }} />
                  <span className="mono">{selected.type}</span>
                </span>
              } />
              <Row k="Grade" v={<GradeBadge grade={selected.grade ?? scoreToGrade(selected.health_score)} />} />
              <Row k="Aff" v={String(selected.afferent_coupling ?? selected.in_degree ?? 0)} />
              <Row k="Eff" v={String(selected.efferent_coupling ?? selected.out_degree ?? 0)} />
              {selected.file_path && <Row k="File" v={<span className="mono break-all">{selected.file_path}</span>} />}
            </div>
          ) : (
            <div className="text-muted-foreground">Click a node on the graph to inspect it.</div>
          )}
        </div>
      </SidePanel>

      <Card className="relative overflow-hidden flex-1 min-h-0">
        <div ref={wrapRef} className="h-full bg-[#fbfbf8] relative">
          {data.nodes.length > 0 && (
            <Suspense fallback={null}>
              {dim === "2D" ? (
                <ForceGraph2D key="fg-2d" ref={ref as never} {...commonProps} />
              ) : (
                <ForceGraph3D key="fg-3d" ref={ref as never} {...commonProps} backgroundColor="#fbfbf8" linkOpacity={0.45} />
              )}
            </Suspense>
          )}

          {/* Search overlay */}
          <div className="absolute top-3 left-3 bg-[var(--surface)] border border-border rounded shadow-sm p-2 flex gap-2 items-center">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search node…" className="px-2 py-1 text-xs border border-border rounded bg-white w-56" />
          </div>

          {/* Refresh-in-flight indicator: old graph stays until the new full dataset is committed */}
          {graphLoading && (
            <div className="absolute bottom-3 right-3 bg-[var(--surface)] border border-border rounded shadow-sm px-3 py-1.5 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Collecting… <span className="mono tabular-nums">{progressRows.toLocaleString()}</span> rows
            </div>
          )}

        </div>
      </Card>
    </Wrap>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center gap-2"><span className="text-muted-foreground uppercase text-[10px] w-12">{k}</span><span>{v}</span></div>;
}

function Wrap({ children, onR, ts }: { children: React.ReactNode; onR: () => void; ts?: number }) {
  // Full height of the main area (100vh minus its p-8 top + bottom padding)
  // so the graph canvas ends exactly at the page's bottom padding.
  return <div className="h-[calc(100vh-64px)] flex flex-col"><SectionHeader title="Graph Visualization" subtitle="Component 1.9 — Force-directed view composed from /files, /nodes, /symbols and /calls" onRefresh={onR} updatedAt={ts} />{children}</div>;
}
