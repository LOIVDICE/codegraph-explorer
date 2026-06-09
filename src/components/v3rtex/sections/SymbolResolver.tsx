import { useMemo } from "react";
import { useV3rtex } from "@/lib/v3rtex/context";
import { Card, SectionHeader, Skeleton, ErrorCard, Badge, EmptyState } from "../ui";
import type { GraphEdge } from "@/lib/v3rtex/api";

export function SymbolResolver() {
  const { graph, graphLoading, graphError, refreshGraph, graphUpdated } = useV3rtex();

  const data = useMemo(() => {
    const edges = ((graph?.edges ?? graph?.links ?? []) as GraphEdge[]).filter((e) => e.type === "IMPORTS");
    const resolved = edges.filter((e) => e.is_resolved !== false && e.target);
    const unresolvedExt = edges.filter((e) => e.is_resolved === false && (e.reason === "STDLIB" || e.reason === "THIRD_PARTY" || e.reason === "NOT_FOUND" || !(e as { is_dynamic?: boolean }).is_dynamic));
    const unresolvedDyn = edges.filter((e) => (e as { is_dynamic?: boolean }).is_dynamic === true || e.reason === "DYNAMIC");
    return { edges, resolved, unresolvedExt, unresolvedDyn };
  }, [graph]);

  if (graphLoading && !graph) return <Wrap onR={refreshGraph}><Skeleton rows={10} /></Wrap>;
  if (graphError) return <Wrap onR={refreshGraph}><ErrorCard message={graphError} onRetry={refreshGraph} /></Wrap>;

  const total = data.edges.length || 1;
  const rate = (data.resolved.length / total) * 100;
  const rateColor = rate > 90 ? "var(--grade-a)" : rate >= 70 ? "var(--grade-c)" : "var(--grade-f)";

  return (
    <Wrap onR={refreshGraph} ts={graphUpdated}>
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Resolution Rate</div>
          <div className="mono text-sm tabular-nums">{data.resolved.length} / {data.edges.length} ({rate.toFixed(1)}%)</div>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${rate}%`, background: rateColor }} />
        </div>
      </Card>

      <Card className="mb-4">
        <Header label="Resolved Imports" count={data.resolved.length} />
        {data.resolved.length === 0 ? <EmptyState title="No resolved imports." /> : (
          <ScrollTable headers={["Source", "Statement", "Target", "Type"]} rows={data.resolved.map((e) => [
            <span className="mono text-xs">{shortId(e.source)}</span>,
            <span className="mono text-xs text-muted-foreground">{(e as { statement?: string }).statement ?? (e as { module?: string }).module ?? "—"}</span>,
            <span className="mono text-xs">{shortId(e.target)}</span>,
            <Badge color="blue">{e.resolution ?? "DIRECT"}</Badge>,
          ])} />
        )}
      </Card>

      <Card className="mb-4">
        <Header label="Unresolved — External" count={data.unresolvedExt.length} />
        {data.unresolvedExt.length === 0 ? <EmptyState title="No external unresolved imports." /> : (
          <ScrollTable headers={["Source", "Module", "Symbols", "Reason"]} rowClass="bg-amber-50/40" rows={data.unresolvedExt.map((e) => [
            <span className="mono text-xs">{shortId(e.source)}</span>,
            <span className="mono text-xs">{(e as { module?: string }).module ?? "—"}</span>,
            <span className="mono text-xs">{((e as { symbols?: string[] }).symbols ?? []).join(", ")}</span>,
            <Badge color="amber">{e.reason ?? "THIRD_PARTY"}</Badge>,
          ])} />
        )}
      </Card>

      <Card>
        <Header label="Unresolved — Dynamic" count={data.unresolvedDyn.length} />
        <div className="px-4 pb-3 text-xs text-muted-foreground">
          Dynamic imports (importlib, __import__) cannot be resolved statically. These are flagged but not edges in the graph.
        </div>
        {data.unresolvedDyn.length === 0 ? <EmptyState title="No dynamic imports detected." /> : (
          <ScrollTable headers={["Source", "Pattern", "Line"]} rowClass="bg-red-50/40" rows={data.unresolvedDyn.map((e) => [
            <span className="mono text-xs">{shortId(e.source)}</span>,
            <span className="mono text-xs">{(e as { pattern?: string }).pattern ?? (e as { module?: string }).module ?? "—"}</span>,
            e.line_number ?? "—",
          ])} />
        )}
      </Card>
    </Wrap>
  );
}

function shortId(s: string) { return s && s.length > 50 ? s.slice(0, 47) + "…" : s; }

function Header({ label, count }: { label: string; count: number }) {
  return <div className="p-4 border-b border-border flex items-center justify-between"><div className="text-sm font-semibold">{label}</div><div className="mono text-xs tabular-nums text-muted-foreground">{count}</div></div>;
}

function ScrollTable({ headers, rows, rowClass = "" }: { headers: string[]; rows: React.ReactNode[][]; rowClass?: string }) {
  return (
    <div className="overflow-auto max-h-[400px]">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b border-border sticky top-0 bg-[var(--surface)]">
          <tr>{headers.map((h) => <th key={h} className="text-left p-3">{h}</th>)}</tr>
        </thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i} className={`border-b border-border last:border-0 ${rowClass}`}>{r.map((c, j) => <td key={j} className="p-3">{c}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Wrap({ children, onR, ts }: { children: React.ReactNode; onR: () => void; ts?: number }) {
  return <div><SectionHeader title="Symbol Resolver" subtitle="Component 1.3 — Import resolution outcomes" onRefresh={onR} updatedAt={ts} />{children}</div>;
}
