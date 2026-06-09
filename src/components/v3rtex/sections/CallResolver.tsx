import { useMemo, useState } from "react";
import { useV3rtex } from "@/lib/v3rtex/context";
import { Card, SectionHeader, Skeleton, ErrorCard, Badge, EmptyState } from "../ui";
import type { GraphEdge } from "@/lib/v3rtex/api";

export function CallResolver() {
  const { graph, graphLoading, graphError, refreshGraph, graphUpdated } = useV3rtex();
  const [q, setQ] = useState("");
  const [conf, setConf] = useState("all");

  const { resolved, unresolved } = useMemo(() => {
    const edges = ((graph?.edges ?? graph?.links ?? []) as GraphEdge[]).filter((e) => e.type === "CALLS");
    return {
      resolved: edges.filter((e) => e.is_resolved !== false && e.target),
      unresolved: edges.filter((e) => e.is_resolved === false || !e.target),
    };
  }, [graph]);

  const filteredR = resolved.filter((e) => {
    if (conf !== "all" && (e.resolution ?? "").toUpperCase() !== conf) return false;
    if (!q) return true;
    const s = `${e.source} ${e.target}`.toLowerCase();
    return s.includes(q.toLowerCase());
  });

  if (graphLoading && !graph) return <Wrap onR={refreshGraph}><Skeleton rows={10} /></Wrap>;
  if (graphError) return <Wrap onR={refreshGraph}><ErrorCard message={graphError} onRetry={refreshGraph} /></Wrap>;

  return (
    <Wrap onR={refreshGraph} ts={graphUpdated}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-4"><div className="text-[10px] uppercase text-muted-foreground font-medium">CALLS Edges</div><div className="text-2xl font-semibold mt-1 tabular-nums">{resolved.length}</div></Card>
        <Card className="p-4"><div className="text-[10px] uppercase text-muted-foreground font-medium">Unresolved Calls</div><div className="text-2xl font-semibold mt-1 tabular-nums">{unresolved.length}</div><div className="text-xs text-muted-foreground mt-1">Not included in graph edges; do not affect complexity scoring.</div></Card>
      </div>

      <Card className="mb-4">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <div className="text-sm font-semibold mr-auto">Resolved Calls</div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search caller / callee…" className="px-2 py-1 text-xs border border-border rounded bg-[var(--surface)]" />
          <select value={conf} onChange={(e) => setConf(e.target.value)} className="px-2 py-1 text-xs border border-border rounded bg-[var(--surface)]">
            <option value="all">All Confidence</option><option value="EXACT">EXACT</option><option value="HEURISTIC">HEURISTIC</option><option value="INFERRED">INFERRED</option>
          </select>
        </div>
        {filteredR.length === 0 ? <EmptyState title="No resolved calls match." /> : (
          <div className="overflow-auto max-h-[420px]">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border sticky top-0 bg-[var(--surface)]">
                <tr><th className="text-left p-3">Caller</th><th className="text-left">Callee</th><th className="text-right">Line</th><th className="text-center pr-3">Confidence</th></tr>
              </thead>
              <tbody>
                {filteredR.map((e, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-3 mono text-xs">{e.source}</td>
                    <td className="mono text-xs">{e.target}</td>
                    <td className="text-right tabular-nums">{e.line_number ?? "—"}</td>
                    <td className="text-center pr-3"><Badge color={e.resolution === "EXACT" ? "green" : e.resolution === "HEURISTIC" ? "amber" : "blue"}>{e.resolution ?? "EXACT"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="p-4 border-b border-border text-sm font-semibold">Unresolved Calls</div>
        {unresolved.length === 0 ? <EmptyState title="All calls resolved." /> : (
          <div className="overflow-auto max-h-[420px]">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border sticky top-0 bg-[var(--surface)]">
                <tr><th className="text-left p-3">Caller</th><th className="text-left">Raw Callee</th><th className="text-center pr-3">Reason</th></tr>
              </thead>
              <tbody>
                {unresolved.map((e, i) => (
                  <tr key={i} className="border-b border-border last:border-0 bg-red-50/30">
                    <td className="p-3 mono text-xs">{e.source}</td>
                    <td className="mono text-xs">{(e as { raw_callee?: string }).raw_callee ?? e.target ?? "—"}</td>
                    <td className="text-center pr-3"><Badge color="red">{e.reason ?? "UNKNOWN"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Wrap>
  );
}

function Wrap({ children, onR, ts }: { children: React.ReactNode; onR: () => void; ts?: number }) {
  return <div><SectionHeader title="Call Resolver" subtitle="Component 1.4 — CALLS edge resolution outcomes" onRefresh={onR} updatedAt={ts} />{children}</div>;
}
