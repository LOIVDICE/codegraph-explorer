import { useMemo, useState } from "react";
import { useV3rtex } from "@/lib/v3rtex/context";
import { Card, SectionHeader, Skeleton, ErrorCard, NodeTypeBadge, EdgeTypeBadge, GradeBadge, Badge, scoreToGrade } from "../ui";
import { DataTable, type Column } from "../DataTable";
import type { GraphEdge, GraphNode } from "@/lib/v3rtex/api";
import { X } from "lucide-react";

export function GraphInspector() {
  const { graph, graphLoading, graphError, refreshGraph, graphUpdated } = useV3rtex();
  const [tab, setTab] = useState<"nodes" | "edges">("nodes");
  const [nodeFilters, setNodeFilters] = useState({ type: "all", grade: "all", lang: "all" });
  const [edgeFilters, setEdgeFilters] = useState({ type: "all", resolved: "all" });
  const [detail, setDetail] = useState<GraphNode | null>(null);

  const nodes = graph?.nodes ?? [];
  const edges = (graph?.edges ?? graph?.links ?? []) as GraphEdge[];

  const filteredNodes = useMemo(() => nodes.filter((n) => {
    if (nodeFilters.type !== "all" && n.type !== nodeFilters.type) return false;
    const g = (n.grade ?? scoreToGrade(n.health_score)).toUpperCase();
    if (nodeFilters.grade !== "all" && g !== nodeFilters.grade) return false;
    if (nodeFilters.lang !== "all" && (n.language ?? "").toLowerCase() !== nodeFilters.lang) return false;
    return true;
  }), [nodes, nodeFilters]);

  const filteredEdges = useMemo(() => edges.filter((e) => {
    if (edgeFilters.type !== "all" && e.type !== edgeFilters.type) return false;
    if (edgeFilters.resolved === "yes" && e.is_resolved === false) return false;
    if (edgeFilters.resolved === "no" && e.is_resolved !== false) return false;
    return true;
  }), [edges, edgeFilters]);

  const langs = Array.from(new Set(nodes.map((n) => (n.language ?? "").toLowerCase()).filter(Boolean)));
  const nodeTypes = Array.from(new Set(nodes.map((n) => n.type ?? "").filter(Boolean)));
  const edgeTypeOpts = Array.from(new Set(edges.map((e) => e.type).filter(Boolean)));

  if (graphLoading && !graph) return <Wrap onR={refreshGraph}><Skeleton rows={10} /></Wrap>;
  if (graphError) return <Wrap onR={refreshGraph}><ErrorCard message={graphError} onRetry={refreshGraph} /></Wrap>;

  return (
    <Wrap onR={refreshGraph} ts={graphUpdated}>
      <Card className="p-4 mb-3">
        <div className="flex border-b border-border -mx-4 -mt-4 mb-4 px-4">
          <button onClick={() => setTab("nodes")} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === "nodes" ? "border-foreground" : "border-transparent text-muted-foreground"}`}>Nodes ({filteredNodes.length})</button>
          <button onClick={() => setTab("edges")} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === "edges" ? "border-foreground" : "border-transparent text-muted-foreground"}`}>Edges ({filteredEdges.length})</button>
        </div>

        {tab === "nodes" ? (
          <DataTable
            rows={filteredNodes}
            rowKey={(n) => n.id}
            maxHeight="60vh"
            searchPlaceholder="Search name or ID…"
            emptyTitle="No nodes match the filters."
            onRowClick={(n) => setDetail(n)}
            columns={nodeCols}
            extraControls={
              <>
                <select value={nodeFilters.type} onChange={(e) => setNodeFilters({ ...nodeFilters, type: e.target.value })} className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]">
                  <option value="all">All Types</option>{nodeTypes.map((t) => <option key={t}>{t}</option>)}
                </select>
                <select value={nodeFilters.grade} onChange={(e) => setNodeFilters({ ...nodeFilters, grade: e.target.value })} className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]">
                  <option value="all">All Grades</option>{["A", "B", "C", "D", "E", "F"].map((g) => <option key={g}>{g}</option>)}
                </select>
                <select value={nodeFilters.lang} onChange={(e) => setNodeFilters({ ...nodeFilters, lang: e.target.value })} className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]">
                  <option value="all">All Languages</option>{langs.map((l) => <option key={l}>{l}</option>)}
                </select>
              </>
            }
          />
        ) : (
          <DataTable
            rows={filteredEdges}
            rowKey={(e, i) => (e.id ?? "") + i}
            maxHeight="60vh"
            searchPlaceholder="Search source / target…"
            emptyTitle="No edges match the filters."
            columns={edgeCols}
            extraControls={
              <>
                <select value={edgeFilters.type} onChange={(e) => setEdgeFilters({ ...edgeFilters, type: e.target.value })} className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]">
                  <option value="all">All Types</option>{edgeTypeOpts.map((t) => <option key={t}>{t}</option>)}
                </select>
                <select value={edgeFilters.resolved} onChange={(e) => setEdgeFilters({ ...edgeFilters, resolved: e.target.value })} className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]">
                  <option value="all">All</option><option value="yes">Resolved</option><option value="no">Unresolved</option>
                </select>
              </>
            }
          />
        )}
      </Card>

      {detail && (
        <div className="fixed inset-y-0 right-0 w-[480px] bg-[var(--surface)] border-l border-border shadow-xl z-50 overflow-auto">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold truncate mr-2">{detail.name ?? detail.id}</div>
            <button onClick={() => setDetail(null)} className="p-1 hover:bg-muted rounded"><X size={16} /></button>
          </div>
          <div className="p-4 space-y-3">
            {Object.entries(detail).map(([k, v]) => (
              <div key={k} className="text-xs">
                <div className="text-muted-foreground mono uppercase tracking-wider text-[10px]">{k}</div>
                <div className="mono break-all">{typeof v === "object" ? JSON.stringify(v) : String(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Wrap>
  );
}

const nodeCols: Column<GraphNode>[] = [
  { id: "id", header: "ID", cellClassName: "mono text-xs", sortValue: (n) => n.id, searchText: (n) => n.id, cell: (n) => <span title={n.id}>{n.id.length > 40 ? n.id.slice(0, 38) + "…" : n.id}</span> },
  { id: "name", header: "Name", cellClassName: "mono text-xs", sortValue: (n) => n.name ?? "", searchText: (n) => n.name ?? "", cell: (n) => n.name ?? "—" },
  { id: "type", header: "Type", sortValue: (n) => n.type ?? "", cell: (n) => <NodeTypeBadge type={n.type} /> },
  { id: "file", header: "File", cellClassName: "mono text-xs text-muted-foreground", searchText: (n) => n.file_path ?? "", sortValue: (n) => n.file_path ?? "", cell: (n) => <span className="truncate inline-block max-w-[200px] align-bottom">{n.file_path ?? "—"}</span> },
  { id: "grade", header: "Grade", headerClassName: "text-center", cellClassName: "text-center", sortValue: (n) => (n.grade ?? scoreToGrade(n.health_score)).toUpperCase(), cell: (n) => <GradeBadge grade={n.grade ?? scoreToGrade(n.health_score)} /> },
  { id: "health", header: "Health", headerClassName: "text-right", cellClassName: "text-right tabular-nums mono text-xs", sortValue: (n) => n.health_score ?? -1, cell: (n) => n.health_score?.toFixed(2) ?? "—" },
  { id: "aff", header: "Aff", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (n) => n.afferent_coupling ?? n.in_degree ?? 0, cell: (n) => n.afferent_coupling ?? n.in_degree ?? 0 },
  { id: "eff", header: "Eff", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (n) => n.efferent_coupling ?? n.out_degree ?? 0, cell: (n) => n.efferent_coupling ?? n.out_degree ?? 0 },
];

const edgeCols: Column<GraphEdge>[] = [
  { id: "id", header: "ID", cellClassName: "mono text-xs", cell: (e) => (e.id ?? "—").toString().slice(0, 24) },
  { id: "source", header: "Source", cellClassName: "mono text-xs", sortValue: (e) => e.source, searchText: (e) => e.source, cell: (e) => <span title={e.source}>{e.source?.length > 30 ? e.source.slice(0, 28) + "…" : e.source}</span> },
  { id: "target", header: "Target", cellClassName: "mono text-xs", sortValue: (e) => e.target, searchText: (e) => e.target, cell: (e) => <span title={e.target}>{e.target?.length > 30 ? e.target.slice(0, 28) + "…" : e.target}</span> },
  { id: "type", header: "Type", sortValue: (e) => e.type, cell: (e) => <EdgeTypeBadge type={e.type} /> },
  { id: "resolved", header: "Resolved", headerClassName: "text-center", cellClassName: "text-center", sortValue: (e) => (e.is_resolved === false ? 0 : 1), cell: (e) => e.is_resolved === false ? <Badge color="red">no</Badge> : <Badge color="green">yes</Badge> },
];

function Wrap({ children, onR, ts }: { children: React.ReactNode; onR: () => void; ts?: number }) {
  return <div><SectionHeader title="Graph Inspector" subtitle="Component 1.5 — All nodes and edges in the graph" onRefresh={onR} updatedAt={ts} />{children}</div>;
}
