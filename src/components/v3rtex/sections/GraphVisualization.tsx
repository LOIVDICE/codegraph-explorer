import { lazy, Suspense, useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
const ForceGraph2D = lazy(() => import("react-force-graph-2d").then((m) => ({ default: m.default })));
import { useV3rtex } from "@/lib/v3rtex/context";
import { Card, SectionHeader, Skeleton, ErrorCard, NodeTypeBadge, GradeBadge, scoreToGrade, gradeColor } from "../ui";
import { useSidebarSlot } from "../SidebarPanelContext";
import type { GraphEdge, GraphNode } from "@/lib/v3rtex/api";

const EDGE_TYPES = ["CALLS", "IMPORTS", "DEFINES", "INHERITS", "CONTAINS"];
const NODE_TYPES = ["FILE", "DIRECTORY", "CLASS", "FUNCTION"];

const EDGE_COLOR: Record<string, string> = {
  CALLS: "#7c3aed", IMPORTS: "#2563eb", DEFINES: "#6b7280", INHERITS: "#d97706", CONTAINS: "#0891b2",
};

export function GraphVisualization() {
  const { graph, graphLoading, graphError, refreshGraph, graphUpdated } = useV3rtex();
  const slot = useSidebarSlot();
  const ref = useRef<{ centerAt: (x: number, y: number, ms?: number) => void; zoom: (z: number, ms?: number) => void; zoomToFit: (ms?: number, pad?: number) => void } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [nodeTypes, setNodeTypes] = useState<Record<string, boolean>>(Object.fromEntries(NODE_TYPES.map((t) => [t, true])));
  const [edgeTypes, setEdgeTypes] = useState<Record<string, boolean>>(Object.fromEntries(EDGE_TYPES.map((t) => [t, true])));
  const [mode, setMode] = useState<"GRANULAR" | "MODULAR">("GRANULAR");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

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
      const dirs = allNodes.filter((n) => n.type === "DIRECTORY" || n.type === "FILE");
      const ids = new Set(dirs.map((n) => n.id));
      return {
        nodes: dirs.filter((n) => nodeTypes[n.type ?? ""] !== false).map((n) => ({ ...n })),
        links: allEdges.filter((e) => edgeTypes[e.type] && ids.has(e.source) && ids.has(e.target)).map((e) => ({ ...e })),
      };
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
    if (searchHit && ref.current) {
      const n = searchHit as GraphNode & { x?: number; y?: number };
      if (n.x != null && n.y != null) {
        ref.current.centerAt(n.x, n.y, 800);
        ref.current.zoom(4, 800);
      }
    }
  }, [searchHit]);

  if (graphLoading && !graph) return <Wrap onR={refreshGraph}><Skeleton rows={10} /></Wrap>;
  if (graphError) return <Wrap onR={refreshGraph}><ErrorCard message={graphError} onRetry={refreshGraph} /></Wrap>;

  const nodeSize = (n: GraphNode) => n.type === "DIRECTORY" ? 8 : n.type === "FILE" ? 5 : n.type === "CLASS" ? 4 : 2.5;
  const nodeColor = (n: GraphNode) => {
    if (selected && !neighborIds.has(n.id)) return "rgba(180,180,180,0.3)";
    if (searchHit && n.id !== searchHit.id) return "rgba(180,180,180,0.2)";
    return gradeColor(n.grade ?? scoreToGrade(n.health_score));
  };

  return (
    <Wrap onR={refreshGraph} ts={graphUpdated}>
      <Card className="relative overflow-hidden" >
        <div ref={wrapRef} className="h-[calc(100vh-200px)] bg-[#fbfbf8] relative">
          {data.nodes.length > 0 && (
            <Suspense fallback={null}>
              {/* eslint-disable @typescript-eslint/no-explicit-any */}
              <ForceGraph2D
                ref={ref as never}
                width={size.w}
                height={size.h}
                graphData={data as any}
                nodeId="id"
                nodeLabel={((n: any) => `${n.name ?? n.id} (${n.type})`) as any}
                nodeVal={nodeSize as any}
                nodeColor={nodeColor as any}
                linkColor={((l: any) => {
                  if (selected) {
                    const sId = typeof l.source === "string" ? l.source : l.source?.id;
                    const tId = typeof l.target === "string" ? l.target : l.target?.id;
                    if (sId !== selected.id && tId !== selected.id) return "rgba(200,200,200,0.15)";
                  }
                  return EDGE_COLOR[l.type] ?? "#999";
                }) as any}
                linkDirectionalArrowLength={3}
                linkDirectionalArrowRelPos={1}
                linkWidth={((l: any) => hoverId && (l.source?.id === hoverId || l.target?.id === hoverId || l.source === hoverId || l.target === hoverId) ? 1.5 : 0.5) as any}
                onNodeClick={((n: any) => setSelected(n)) as any}
                onNodeHover={((n: any) => setHoverId(n?.id ?? null)) as any}
                onBackgroundClick={() => setSelected(null)}
                cooldownTicks={100}
              />
            </Suspense>
          )}

          {/* Search overlay (kept on canvas) */}
          <div className="absolute top-3 left-3 bg-[var(--surface)] border border-border rounded shadow-sm p-2 flex gap-2 items-center">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search node…" className="px-2 py-1 text-xs border border-border rounded bg-white w-56" />
          </div>
        </div>
      </Card>

      {slot && createPortal(
        <div className="flex flex-col h-full text-xs">
          {/* Controls */}
          <div className="p-3 border-b border-border space-y-3">
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
                <label key={t} className="flex items-center gap-2 py-0.5 cursor-pointer">
                  <input type="checkbox" checked={nodeTypes[t]} onChange={(e) => setNodeTypes({ ...nodeTypes, [t]: e.target.checked })} />
                  <NodeTypeBadge type={t} />
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

          {/* Selected node details */}
          <div className="p-3 border-b border-border">
            <div className="font-semibold mb-1.5">Node Details</div>
            {selected ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-semibold mono truncate">{selected.name ?? selected.id}</div>
                  <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">×</button>
                </div>
                <Row k="Type" v={<NodeTypeBadge type={selected.type} />} />
                <Row k="Grade" v={<GradeBadge grade={selected.grade ?? scoreToGrade(selected.health_score)} />} />
                <Row k="Aff" v={String(selected.afferent_coupling ?? selected.in_degree ?? 0)} />
                <Row k="Eff" v={String(selected.efferent_coupling ?? selected.out_degree ?? 0)} />
                {selected.file_path && <Row k="File" v={<span className="mono break-all">{selected.file_path}</span>} />}
              </div>
            ) : (
              <div className="text-muted-foreground italic">Click a node in the graph to view its details.</div>
            )}
          </div>
        </div>,
        slot
      )}
    </Wrap>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center gap-2"><span className="text-muted-foreground uppercase text-[10px] w-12">{k}</span><span>{v}</span></div>;
}

function Wrap({ children, onR, ts }: { children: React.ReactNode; onR: () => void; ts?: number }) {
  return <div><SectionHeader title="Graph Visualization" subtitle="Component 1.9 — Lightweight 2D force-directed view" onRefresh={onR} updatedAt={ts} />{children}</div>;
}
