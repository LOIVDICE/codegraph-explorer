import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useV3rtex } from "@/lib/v3rtex/context";
import { usePageState, resetPageState } from "@/lib/v3rtex/page-state";
import { Card, SectionHeader, Skeleton, ErrorCard, GradeBadge, gradeColor, scoreToGrade } from "../ui";
import { DataTable, type Column } from "../DataTable";
import type { GraphEdge, GraphNode } from "@/lib/v3rtex/api";
import { X } from "lucide-react";

export function Complexity() {
  const { graph, graphLoading, graphError, refreshGraph, graphUpdated } = useV3rtex();
  const [filters, setFilters] = usePageState("complexity:filters", { grade: "all", file: "" });
  const [detail, setDetail] = usePageState<GraphNode | null>("complexity:detail", null);
  // The header reload button resets this page's UI params before refetching.
  const refresh = () => { resetPageState("complexity"); refreshGraph(); };

  const fns = useMemo(() => (graph?.nodes ?? []).filter((n) => n.type === "FUNCTION"), [graph]);
  const edges = (graph?.edges ?? graph?.links ?? []) as GraphEdge[];

  const filtered = useMemo(() => fns.filter((f) => {
    const g = (f.grade ?? scoreToGrade(f.health_score)).toUpperCase();
    if (filters.grade !== "all" && g !== filters.grade) return false;
    if (filters.file && !(f.file_path ?? "").toLowerCase().includes(filters.file.toLowerCase())) return false;
    return true;
  }), [fns, filters]);

  const distribution = useMemo(() => {
    const m: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    fns.forEach((f) => { const g = (f.grade ?? scoreToGrade(f.health_score)).toUpperCase(); if (m[g] != null) m[g]++; });
    return Object.entries(m).map(([k, v]) => ({ name: k, value: v }));
  }, [fns]);

  if (graphLoading && !graph) return <Wrap onR={refresh}><Skeleton rows={10} /></Wrap>;
  if (graphError) return <Wrap onR={refresh}><ErrorCard message={graphError} onRetry={refreshGraph} /></Wrap>;

  return (
    <Wrap onR={refresh} ts={graphUpdated}>
      <div className="grid grid-cols-[320px_1fr] gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2">Grade Distribution</div>
          <div className="h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {distribution.map((d) => <Cell key={d.name} fill={gradeColor(d.name)} />)}
                </Pie>
                <Tooltip formatter={(v: number, n) => [`${v} (${((v / Math.max(1, fns.length)) * 100).toFixed(1)}%)`, `Grade ${n}`]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-1 mt-2 text-xs">
            {distribution.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: gradeColor(d.name) }} />
                <span className="mono">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Filters</div>
          <div className="grid grid-cols-2 gap-2">
            <select value={filters.grade} onChange={(e) => setFilters({ ...filters, grade: e.target.value })} className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]">
              <option value="all">All Grades</option>{["A", "B", "C", "D", "E", "F"].map((g) => <option key={g}>{g}</option>)}
            </select>
            <input value={filters.file} onChange={(e) => setFilters({ ...filters, file: e.target.value })} placeholder="File path…" className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]" />
          </div>
          <div className="mt-3 text-xs text-muted-foreground">{fns.length} functions total</div>
        </Card>
      </div>

      <Card className="p-4">
        <DataTable
          rows={filtered}
          rowKey={(f) => f.id}
          stateKey="complexity:table"
          maxHeight="60vh"
          searchPlaceholder="Search function name or ID…"
          emptyTitle="No functions match."
          onRowClick={(f) => setDetail(f)}
          initialSort={{ columnId: "cc", dir: "desc" }}
          columns={fnCols}
        />
      </Card>

      {detail && (
        <FunctionDetail node={detail} edges={edges} onClose={() => setDetail(null)} />
      )}
    </Wrap>
  );
}

const gradeOf = (f: GraphNode) => (f.grade ?? scoreToGrade(f.health_score)).toUpperCase();

const fnCols: Column<GraphNode>[] = [
  { id: "name", header: "Function", cellClassName: "mono text-xs", sortValue: (f) => f.name ?? f.id, searchText: (f) => `${f.name ?? ""} ${f.id}`, cell: (f) => f.name ?? f.id },
  { id: "file", header: "File", cellClassName: "mono text-xs text-muted-foreground", searchText: (f) => f.file_path ?? "", sortValue: (f) => f.file_path ?? "", cell: (f) => <span className="truncate inline-block max-w-[260px] align-bottom">{f.file_path ?? "—"}</span> },
  { id: "cc", header: "CC", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (f) => f.cyclomatic_complexity ?? -1, cell: (f) => <span style={{ color: gradeColor(gradeOf(f)) }}>{f.cyclomatic_complexity ?? "—"}</span> },
  { id: "mi", header: "MI", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (f) => f.maintainability_index ?? -1, cell: (f) => f.maintainability_index?.toFixed(1) ?? "—" },
  { id: "health", header: "Health", sortValue: (f) => f.health_score ?? -1, cell: (f) => (
    <div className="h-2 bg-muted rounded-full overflow-hidden w-32">
      <div className="h-full" style={{ width: `${(f.health_score ?? 0) * 100}%`, background: gradeColor(gradeOf(f)) }} />
    </div>
  ) },
  { id: "grade", header: "Grade", headerClassName: "text-center", cellClassName: "text-center", sortValue: (f) => gradeOf(f), cell: (f) => <GradeBadge grade={gradeOf(f)} size="lg" /> },
  { id: "aff", header: "Aff", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (f) => f.afferent_coupling ?? f.in_degree ?? 0, cell: (f) => f.afferent_coupling ?? f.in_degree ?? 0 },
  { id: "eff", header: "Eff", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (f) => f.efferent_coupling ?? f.out_degree ?? 0, cell: (f) => f.efferent_coupling ?? f.out_degree ?? 0 },
];

function FunctionDetail({ node, edges, onClose }: { node: GraphNode; edges: GraphEdge[]; onClose: () => void }) {
  const callsIn = edges.filter((e) => e.type === "CALLS" && e.target === node.id);
  const callsOut = edges.filter((e) => e.type === "CALLS" && e.source === node.id);
  const body = (node.body_text ?? "").split("\n").slice(0, 10).join("\n");
  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-[var(--surface)] border-l border-border shadow-xl z-50 overflow-auto">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="text-sm font-semibold mono truncate">{node.name ?? node.id}</div>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X size={16} /></button>
      </div>
      <div className="p-4 space-y-4 text-xs">
        <div>
          <div className="text-muted-foreground uppercase tracking-wider mb-1">Qualified ID</div>
          <div className="mono break-all">{node.id}</div>
        </div>
        <div>
          <div className="text-muted-foreground uppercase tracking-wider mb-1">File</div>
          <div className="mono">{node.file_path}{node.start_line ? `:${node.start_line}` : ""}</div>
        </div>
        {node.docstring && (
          <div>
            <div className="text-muted-foreground uppercase tracking-wider mb-1">Docstring</div>
            <div className="italic">{node.docstring}</div>
          </div>
        )}
        {body && (
          <div>
            <div className="text-muted-foreground uppercase tracking-wider mb-1">Body (first 10 lines)</div>
            <pre className="bg-zinc-900 text-zinc-100 p-3 rounded mono text-[11px] overflow-auto">{body}</pre>
          </div>
        )}
        <div>
          <div className="text-muted-foreground uppercase tracking-wider mb-1">Incoming Calls ({callsIn.length})</div>
          <div className="space-y-1">{callsIn.length === 0 ? <span className="text-muted-foreground">None</span> : callsIn.map((c, i) => <div key={i} className="mono">{c.source}</div>)}</div>
        </div>
        <div>
          <div className="text-muted-foreground uppercase tracking-wider mb-1">Outgoing Calls ({callsOut.length})</div>
          <div className="space-y-1">{callsOut.length === 0 ? <span className="text-muted-foreground">None</span> : callsOut.map((c, i) => <div key={i} className="mono">{c.target}</div>)}</div>
        </div>
      </div>
    </div>
  );
}

function Wrap({ children, onR, ts }: { children: React.ReactNode; onR: () => void; ts?: number }) {
  return <div><SectionHeader title="Complexity" subtitle="Component 1.6 — Radon-based scoring per function" onRefresh={onR} updatedAt={ts} />{children}</div>;
}
