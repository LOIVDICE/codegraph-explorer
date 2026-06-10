import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useV3rtex } from "@/lib/v3rtex/context";
import { Card, SectionHeader, Skeleton, ErrorCard, GradeBadge, gradeColor, scoreToGrade, EmptyState } from "../ui";
import type { GraphEdge, GraphNode } from "@/lib/v3rtex/api";
import { X, ArrowLeft } from "lucide-react";

export function Complexity() {
  const { graph, graphLoading, graphError, refreshGraph, graphUpdated } = useV3rtex();
  const [filters, setFilters] = useState({ grade: "all", file: "", q: "" });
  const [sortBy, setSortBy] = useState<"cc" | "mi" | "health" | "name">("cc");
  const [detail, setDetail] = useState<GraphNode | null>(null);

  const fns = useMemo(() => (graph?.nodes ?? []).filter((n) => n.type === "FUNCTION"), [graph]);
  const edges = (graph?.edges ?? graph?.links ?? []) as GraphEdge[];

  const filtered = useMemo(() => {
    const out = fns.filter((f) => {
      const g = (f.grade ?? scoreToGrade(f.health_score)).toUpperCase();
      if (filters.grade !== "all" && g !== filters.grade) return false;
      if (filters.file && !(f.file_path ?? "").toLowerCase().includes(filters.file.toLowerCase())) return false;
      if (filters.q && !(f.name ?? f.id).toLowerCase().includes(filters.q.toLowerCase())) return false;
      return true;
    });
    out.sort((a, b) => {
      if (sortBy === "name") return (a.name ?? "").localeCompare(b.name ?? "");
      if (sortBy === "mi") return (b.maintainability_index ?? 0) - (a.maintainability_index ?? 0);
      if (sortBy === "health") return (b.health_score ?? 0) - (a.health_score ?? 0);
      return (b.cyclomatic_complexity ?? 0) - (a.cyclomatic_complexity ?? 0);
    });
    return out;
  }, [fns, filters, sortBy]);

  const distribution = useMemo(() => {
    const m: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    fns.forEach((f) => { const g = (f.grade ?? scoreToGrade(f.health_score)).toUpperCase(); if (m[g] != null) m[g]++; });
    return Object.entries(m).map(([k, v]) => ({ name: k, value: v }));
  }, [fns]);

  if (graphLoading && !graph) return <Wrap onR={refreshGraph}><Skeleton rows={10} /></Wrap>;
  if (graphError) return <Wrap onR={refreshGraph}><ErrorCard message={graphError} onRetry={refreshGraph} /></Wrap>;

  return (
    <Wrap onR={refreshGraph} ts={graphUpdated}>
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
          <div className="grid grid-cols-3 gap-2">
            <select value={filters.grade} onChange={(e) => setFilters({ ...filters, grade: e.target.value })} className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]">
              <option value="all">All Grades</option>{["A", "B", "C", "D", "E", "F"].map((g) => <option key={g}>{g}</option>)}
            </select>
            <input value={filters.file} onChange={(e) => setFilters({ ...filters, file: e.target.value })} placeholder="File path…" className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]" />
            <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Function name…" className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]" />
          </div>
          <div className="mt-3 text-xs text-muted-foreground">Showing {filtered.length} of {fns.length} functions</div>
        </Card>
      </div>

      {filtered.length === 0 ? <EmptyState title="No functions match." /> : (
        <Card>
          <div className="overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border sticky top-0 bg-[var(--surface)]">
                <tr>
                  <th onClick={() => setSortBy("name")} className="text-left p-2 cursor-pointer">Function</th>
                  <th className="text-left">File</th>
                  <th onClick={() => setSortBy("cc")} className="text-right cursor-pointer">CC</th>
                  <th onClick={() => setSortBy("mi")} className="text-right cursor-pointer">MI</th>
                  <th onClick={() => setSortBy("health")} className="text-left cursor-pointer w-40">Health</th>
                  <th className="text-center">Grade</th>
                  <th className="text-right">Aff</th>
                  <th className="text-right pr-3">Eff</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => {
                  const g = (f.grade ?? scoreToGrade(f.health_score)).toUpperCase();
                  return (
                    <tr key={f.id} onClick={() => setDetail(f)} className="border-b border-border last:border-0 hover:bg-muted/60 cursor-pointer">
                      <td className="p-2 mono text-xs">{f.name ?? f.id}</td>
                      <td className="mono text-xs text-muted-foreground truncate max-w-[260px]">{f.file_path ?? "—"}</td>
                      <td className="text-right tabular-nums" style={{ color: gradeColor(g) }}>{f.cyclomatic_complexity ?? "—"}</td>
                      <td className="text-right tabular-nums">{f.maintainability_index?.toFixed(1) ?? "—"}</td>
                      <td>
                        <div className="h-2 bg-muted rounded-full overflow-hidden w-32">
                          <div className="h-full" style={{ width: `${(f.health_score ?? 0) * 100}%`, background: gradeColor(g) }} />
                        </div>
                      </td>
                      <td className="text-center"><GradeBadge grade={g} size="lg" /></td>
                      <td className="text-right tabular-nums">{f.afferent_coupling ?? f.in_degree ?? 0}</td>
                      <td className="text-right pr-3 tabular-nums">{f.efferent_coupling ?? f.out_degree ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {detail && (
        <FunctionDetail node={detail} edges={edges} onClose={() => setDetail(null)} />
      )}
    </Wrap>
  );
}

function FunctionDetail({ node, edges, onClose }: { node: GraphNode; edges: GraphEdge[]; onClose: () => void }) {
  const callsIn = edges.filter((e) => e.type === "CALLS" && e.target === node.id);
  const callsOut = edges.filter((e) => e.type === "CALLS" && e.source === node.id);
  const body = (node.body_text ?? "").split("\n").slice(0, 10).join("\n");
  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-[var(--surface)] border-l border-border shadow-xl z-50 overflow-auto">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1 hover:bg-muted rounded" title="Back to list">
            <ArrowLeft size={16} />
          </button>
          <div className="text-sm font-semibold mono truncate">{node.name ?? node.id}</div>
        </div>
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
