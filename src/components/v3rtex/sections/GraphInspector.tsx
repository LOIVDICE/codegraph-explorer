import { useMemo, useState } from "react";
import { useV3rtex } from "@/lib/v3rtex/context";
import { Card, SectionHeader, Skeleton, ErrorCard, NodeTypeBadge, EdgeTypeBadge, GradeBadge, Badge, scoreToGrade, EmptyState } from "../ui";
import type { GraphEdge, GraphNode } from "@/lib/v3rtex/api";
import { X } from "lucide-react";

type SortKey = "id" | "name" | "type" | "grade" | "health_score" | "afferent" | "efferent";

export function GraphInspector() {
  const { graph, graphLoading, graphError, refreshGraph, graphUpdated } = useV3rtex();
  const [tab, setTab] = useState<"nodes" | "edges">("nodes");
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ type: "all", grade: "all", lang: "all", q: "" });
  const [edgeFilters, setEdgeFilters] = useState({ type: "all", resolved: "all", q: "" });
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "id", dir: "asc" });
  const [detail, setDetail] = useState<GraphNode | null>(null);
  const PAGE = 50;

  const nodes = graph?.nodes ?? [];
  const edges = (graph?.edges ?? graph?.links ?? []) as GraphEdge[];

  const filteredNodes = useMemo(() => {
    const f = nodes.filter((n) => {
      if (filters.type !== "all" && n.type !== filters.type) return false;
      const g = (n.grade ?? scoreToGrade(n.health_score)).toUpperCase();
      if (filters.grade !== "all" && g !== filters.grade) return false;
      if (filters.lang !== "all" && (n.language ?? "").toLowerCase() !== filters.lang) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        if (!(`${n.id} ${n.name ?? ""}`.toLowerCase().includes(q))) return false;
      }
      return true;
    });
    const k = sort.key;
    const get = (n: GraphNode): string | number => {
      if (k === "afferent") return n.afferent_coupling ?? n.in_degree ?? 0;
      if (k === "efferent") return n.efferent_coupling ?? n.out_degree ?? 0;
      if (k === "grade") return (n.grade ?? scoreToGrade(n.health_score)).toUpperCase();
      return (n[k] as string | number) ?? "";
    };
    f.sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va < vb) return sort.dir === "asc" ? -1 : 1;
      if (va > vb) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return f;
  }, [nodes, filters, sort]);

  const filteredEdges = useMemo(() => edges.filter((e) => {
    if (edgeFilters.type !== "all" && e.type !== edgeFilters.type) return false;
    if (edgeFilters.resolved === "yes" && e.is_resolved === false) return false;
    if (edgeFilters.resolved === "no" && e.is_resolved !== false) return false;
    if (edgeFilters.q && !(`${e.source} ${e.target}`.toLowerCase().includes(edgeFilters.q.toLowerCase()))) return false;
    return true;
  }), [edges, edgeFilters]);

  const langs = Array.from(new Set(nodes.map((n) => (n.language ?? "").toLowerCase()).filter(Boolean)));
  const list = tab === "nodes" ? filteredNodes : filteredEdges;
  const pageItems = list.slice(page * PAGE, page * PAGE + PAGE);
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE));

  if (graphLoading && !graph) return <Wrap onR={refreshGraph}><Skeleton rows={10} /></Wrap>;
  if (graphError) return <Wrap onR={refreshGraph}><ErrorCard message={graphError} onRetry={refreshGraph} /></Wrap>;

  const toggleSort = (k: SortKey) => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "asc" ? "desc" : "asc" }));
  const Th = ({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`p-2 cursor-pointer select-none hover:text-foreground ${className}`} onClick={() => toggleSort(k)}>
      {children} {sort.key === k ? <span className="opacity-60">{sort.dir === "asc" ? "↑" : "↓"}</span> : null}
    </th>
  );

  return (
    <Wrap onR={refreshGraph} ts={graphUpdated}>
      <Card className="mb-3">
        <div className="flex border-b border-border">
          <button onClick={() => { setTab("nodes"); setPage(0); }} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === "nodes" ? "border-foreground" : "border-transparent text-muted-foreground"}`}>Nodes ({filteredNodes.length})</button>
          <button onClick={() => { setTab("edges"); setPage(0); }} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === "edges" ? "border-foreground" : "border-transparent text-muted-foreground"}`}>Edges ({filteredEdges.length})</button>
        </div>

        {tab === "nodes" ? (
          <div className="p-3 flex gap-2 flex-wrap border-b border-border">
            <input value={filters.q} onChange={(e) => { setFilters({ ...filters, q: e.target.value }); setPage(0); }} placeholder="Search name or ID…" className="flex-1 min-w-[200px] px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]" />
            <select value={filters.type} onChange={(e) => { setFilters({ ...filters, type: e.target.value }); setPage(0); }} className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]">
              <option value="all">All Types</option>{["FILE", "DIRECTORY", "CLASS", "FUNCTION", "VARIABLE"].map((t) => <option key={t}>{t}</option>)}
            </select>
            <select value={filters.grade} onChange={(e) => { setFilters({ ...filters, grade: e.target.value }); setPage(0); }} className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]">
              <option value="all">All Grades</option>{["A", "B", "C", "D", "E", "F"].map((g) => <option key={g}>{g}</option>)}
            </select>
            <select value={filters.lang} onChange={(e) => { setFilters({ ...filters, lang: e.target.value }); setPage(0); }} className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]">
              <option value="all">All Languages</option>{langs.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        ) : (
          <div className="p-3 flex gap-2 flex-wrap border-b border-border">
            <input value={edgeFilters.q} onChange={(e) => { setEdgeFilters({ ...edgeFilters, q: e.target.value }); setPage(0); }} placeholder="Search source / target…" className="flex-1 min-w-[200px] px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]" />
            <select value={edgeFilters.type} onChange={(e) => { setEdgeFilters({ ...edgeFilters, type: e.target.value }); setPage(0); }} className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]">
              <option value="all">All Types</option>{["CALLS", "IMPORTS", "DEFINES", "INHERITS", "CONTAINS"].map((t) => <option key={t}>{t}</option>)}
            </select>
            <select value={edgeFilters.resolved} onChange={(e) => { setEdgeFilters({ ...edgeFilters, resolved: e.target.value }); setPage(0); }} className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]">
              <option value="all">All</option><option value="yes">Resolved</option><option value="no">Unresolved</option>
            </select>
          </div>
        )}

        <div className="overflow-auto max-h-[60vh]">
          {tab === "nodes" ? (
            list.length === 0 ? <EmptyState title="No nodes match the filters." /> : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border sticky top-0 bg-[var(--surface)]">
                  <tr><Th k="id" className="text-left">ID</Th><Th k="name" className="text-left">Name</Th><Th k="type" className="text-left">Type</Th><th className="p-2 text-left">File</th><Th k="grade" className="text-center">Grade</Th><Th k="health_score" className="text-right">Health</Th><Th k="afferent" className="text-right">Aff</Th><Th k="efferent" className="text-right pr-3">Eff</Th></tr>
                </thead>
                <tbody>
                  {(pageItems as GraphNode[]).map((n) => (
                    <tr key={n.id} onClick={() => setDetail(n)} className="border-b border-border last:border-0 hover:bg-muted/60 cursor-pointer">
                      <td className="p-2 mono text-xs" title={n.id}>{n.id.length > 40 ? n.id.slice(0, 38) + "…" : n.id}</td>
                      <td className="mono text-xs">{n.name ?? "—"}</td>
                      <td><NodeTypeBadge type={n.type} /></td>
                      <td className="mono text-xs text-muted-foreground truncate max-w-[200px]">{n.file_path ?? "—"}</td>
                      <td className="text-center"><GradeBadge grade={n.grade ?? scoreToGrade(n.health_score)} /></td>
                      <td className="text-right tabular-nums mono text-xs">{n.health_score?.toFixed(2) ?? "—"}</td>
                      <td className="text-right tabular-nums">{n.afferent_coupling ?? n.in_degree ?? 0}</td>
                      <td className="text-right pr-3 tabular-nums">{n.efferent_coupling ?? n.out_degree ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            list.length === 0 ? <EmptyState title="No edges match the filters." /> : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border sticky top-0 bg-[var(--surface)]">
                  <tr><th className="p-2 text-left">ID</th><th className="p-2 text-left">Source</th><th className="p-2 text-left">Target</th><th className="p-2 text-left">Type</th><th className="p-2 text-center pr-3">Resolved</th></tr>
                </thead>
                <tbody>
                  {(pageItems as GraphEdge[]).map((e, i) => (
                    <tr key={(e.id ?? "") + i} className="border-b border-border last:border-0 hover:bg-muted/60">
                      <td className="p-2 mono text-xs">{(e.id ?? `${i}`).toString().slice(0, 24)}</td>
                      <td className="mono text-xs" title={e.source}>{e.source?.length > 30 ? e.source.slice(0, 28) + "…" : e.source}</td>
                      <td className="mono text-xs" title={e.target}>{e.target?.length > 30 ? e.target.slice(0, 28) + "…" : e.target}</td>
                      <td><EdgeTypeBadge type={e.type} /></td>
                      <td className="text-center pr-3">{e.is_resolved === false ? <Badge color="red">no</Badge> : <Badge color="green">yes</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        <div className="p-3 border-t border-border flex items-center justify-between text-xs">
          <div className="text-muted-foreground">Page {page + 1} of {totalPages} · showing {pageItems.length} of {list.length}</div>
          <div className="flex gap-1">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border border-border rounded disabled:opacity-40">Prev</button>
            <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border border-border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
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

function Wrap({ children, onR, ts }: { children: React.ReactNode; onR: () => void; ts?: number }) {
  return <div><SectionHeader title="Graph Inspector" subtitle="Component 1.5 — All nodes and edges in the graph" onRefresh={onR} updatedAt={ts} />{children}</div>;
}
