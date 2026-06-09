import { useMemo } from "react";
import { useV3rtex } from "@/lib/v3rtex/context";
import { Card, SectionHeader, Skeleton, ErrorCard, GradeBadge, gradeColor, scoreToGrade } from "./ui";
import type { GraphEdge, GraphNode } from "@/lib/v3rtex/api";

export function Overview() {
  const { graph, graphLoading, graphError, refreshGraph, graphUpdated, stats, refreshStats } = useV3rtex();

  const computed = useMemo(() => {
    const nodes: GraphNode[] = graph?.nodes ?? [];
    const edges: GraphEdge[] = (graph?.edges ?? graph?.links ?? []) as GraphEdge[];
    const byType = (t: string) => nodes.filter((n) => n.type === t);
    const files = byType("FILE");
    const fns = byType("FUNCTION");
    const cls = byType("CLASS");
    const importEdges = edges.filter((e) => e.type === "IMPORTS");
    const resolvedImports = importEdges.filter((e) => e.is_resolved !== false);
    const callEdges = edges.filter((e) => e.type === "CALLS");
    const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    let totalScore = 0, scored = 0;
    fns.forEach((f) => {
      const g = (f.grade ?? scoreToGrade(f.health_score)).toUpperCase();
      if (gradeCounts[g] != null) gradeCounts[g]++;
      if (typeof f.health_score === "number") { totalScore += f.health_score; scored++; }
    });
    const top5 = [...fns]
      .filter((f) => typeof f.cyclomatic_complexity === "number")
      .sort((a, b) => (b.cyclomatic_complexity ?? 0) - (a.cyclomatic_complexity ?? 0))
      .slice(0, 5);
    return { nodes, edges, files, fns, cls, importEdges, resolvedImports, callEdges, gradeCounts, avgScore: scored ? totalScore / scored : null, top5 };
  }, [graph]);

  const handleRefresh = () => { refreshGraph(); refreshStats(); };

  if (graphLoading && !graph) return <SectionWrap title="Overview" onRefresh={handleRefresh}><Skeleton rows={8} /></SectionWrap>;
  if (graphError) return <SectionWrap title="Overview" onRefresh={handleRefresh}><ErrorCard message={graphError} onRetry={handleRefresh} /></SectionWrap>;
  if (!graph) return <SectionWrap title="Overview" onRefresh={handleRefresh}><Skeleton /></SectionWrap>;

  const s = stats ?? {};
  const importResolveRate = computed.importEdges.length ? (computed.resolvedImports.length / computed.importEdges.length) * 100 : 0;
  const apCount = (s.antipatterns_count as number) ?? null;
  const scanMs = (s.scan_duration_ms as number) ?? null;
  const avgGrade = computed.avgScore != null ? scoreToGrade(computed.avgScore) : "";

  const cards = [
    { label: "Files Scanned", value: computed.files.length },
    { label: "Functions", value: computed.fns.length },
    { label: "Classes", value: computed.cls.length },
    { label: "Import Statements", value: computed.importEdges.length },
    { label: "Resolved Imports", value: computed.resolvedImports.length, hint: `${importResolveRate.toFixed(1)}%` },
    { label: "Unresolved Imports", value: computed.importEdges.length - computed.resolvedImports.length },
    { label: "CALLS Edges", value: computed.callEdges.length },
    { label: "Graph Nodes", value: computed.nodes.length },
    { label: "Graph Edges", value: computed.edges.length },
    { label: "Avg Complexity", value: computed.avgScore?.toFixed(2) ?? "—", badge: avgGrade },
    { label: "Anti-Patterns", value: apCount ?? "—" },
    { label: "Scan Duration", value: scanMs != null ? `${scanMs} ms` : "—" },
  ];

  const total = Object.values(computed.gradeCounts).reduce((a, b) => a + b, 0) || 1;

  return (
    <SectionWrap title="Overview" subtitle="Aggregate summary across all V3RTEX L1 components" onRefresh={handleRefresh} updatedAt={graphUpdated}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{c.label}</div>
            <div className="flex items-end gap-2 mt-2">
              <div className="text-2xl font-semibold tabular-nums">{String(c.value)}</div>
              {"badge" in c && c.badge ? <GradeBadge grade={c.badge} /> : null}
              {"hint" in c && c.hint ? <div className="text-xs text-muted-foreground mb-1">{c.hint}</div> : null}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5 mt-4">
        <div className="text-sm font-semibold mb-3">Complexity Distribution</div>
        <div className="flex h-8 rounded overflow-hidden border border-border">
          {(["A", "B", "C", "D", "E", "F"] as const).map((g) => {
            const c = computed.gradeCounts[g];
            const pct = (c / total) * 100;
            if (pct === 0) return null;
            return (
              <div key={g} title={`${g}: ${c} (${pct.toFixed(1)}%)`} style={{ width: `${pct}%`, background: gradeColor(g) }} className="flex items-center justify-center text-white text-xs font-semibold">
                {pct > 6 ? `${g} ${pct.toFixed(0)}%` : ""}
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs">
          {(["A", "B", "C", "D", "E", "F"] as const).map((g) => (
            <div key={g} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: gradeColor(g) }} />
              <span className="mono">{g}: {computed.gradeCounts[g]}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 mt-4">
        <div className="text-sm font-semibold mb-3">Top 5 Most Complex Functions</div>
        {computed.top5.length === 0 ? (
          <div className="text-xs text-muted-foreground">No complexity data available.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr><th className="text-left py-2">Function</th><th className="text-left">File</th><th className="text-right">CC</th><th className="text-center">Grade</th><th className="text-right">Aff</th><th className="text-right">Eff</th></tr>
            </thead>
            <tbody>
              {computed.top5.map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0">
                  <td className="py-2 mono text-xs">{f.name ?? f.id}</td>
                  <td className="mono text-xs text-muted-foreground truncate max-w-[280px]">{f.file_path ?? "—"}</td>
                  <td className="text-right tabular-nums">{f.cyclomatic_complexity}</td>
                  <td className="text-center"><GradeBadge grade={f.grade ?? scoreToGrade(f.health_score)} /></td>
                  <td className="text-right tabular-nums">{f.afferent_coupling ?? f.in_degree ?? 0}</td>
                  <td className="text-right tabular-nums">{f.efferent_coupling ?? f.out_degree ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </SectionWrap>
  );
}

function SectionWrap({ title, subtitle, onRefresh, updatedAt, children }: { title: string; subtitle?: string; onRefresh?: () => void; updatedAt?: number; children: React.ReactNode }) {
  return <div><SectionHeader title={title} subtitle={subtitle} onRefresh={onRefresh} updatedAt={updatedAt} />{children}</div>;
}
