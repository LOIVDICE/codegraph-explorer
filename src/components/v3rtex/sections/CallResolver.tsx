import { useMemo, useState } from "react";
import { useV3rtex } from "@/lib/v3rtex/context";
import { parseHops, type ApiCall } from "@/lib/v3rtex/api";
import { Card, SectionHeader, Skeleton, ErrorCard, Badge } from "../ui";
import { DataTable, type Column } from "../DataTable";

export function CallResolver() {
  const { calls: callsRes, refreshAll } = useV3rtex();
  const [resF, setResF] = useState("all");

  const { all, resolved, unresolved, resolutions } = useMemo(() => {
    const all = callsRes.data ?? [];
    return {
      all,
      resolved: all.filter((c) => c.callee_node_id != null),
      unresolved: all.filter((c) => c.callee_node_id == null),
      resolutions: Array.from(new Set(all.map((c) => c.resolution))).sort(),
    };
  }, [callsRes.data]);

  const filteredR = useMemo(
    () => (resF === "all" ? resolved : resolved.filter((c) => c.resolution === resF)),
    [resolved, resF]
  );

  if (callsRes.loading && !callsRes.data) return <Wrap onR={refreshAll}><Skeleton rows={10} /></Wrap>;
  if (callsRes.error) return <Wrap onR={refreshAll}><ErrorCard message={callsRes.error} onRetry={refreshAll} /></Wrap>;

  return (
    <Wrap onR={refreshAll} ts={callsRes.updated}>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4"><div className="text-[10px] uppercase text-muted-foreground font-medium">Call Edges</div><div className="text-2xl font-semibold mt-1 tabular-nums">{all.length}</div></Card>
        <Card className="p-4"><div className="text-[10px] uppercase text-muted-foreground font-medium">Resolved</div><div className="text-2xl font-semibold mt-1 tabular-nums">{resolved.length}</div></Card>
        <Card className="p-4"><div className="text-[10px] uppercase text-muted-foreground font-medium">Unresolved</div><div className="text-2xl font-semibold mt-1 tabular-nums">{unresolved.length}</div></Card>
      </div>

      <Card className="p-4 mb-4">
        <div className="text-sm font-semibold mb-3">Resolved Calls</div>
        <DataTable
          rows={filteredR}
          rowKey={(c) => c.id}
          maxHeight="420px"
          searchPlaceholder="Search caller / callee / call site…"
          emptyTitle="No resolved calls match."
          columns={resolvedCols}
          extraControls={
            <select value={resF} onChange={(e) => setResF(e.target.value)} className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]">
              <option value="all">All Resolutions</option>
              {resolutions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          }
        />
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Unresolved Calls</div>
        <DataTable
          rows={unresolved}
          rowKey={(c) => c.id}
          maxHeight="420px"
          searchPlaceholder="Search caller / call site…"
          emptyTitle="All calls resolved."
          columns={unresolvedCols}
          rowClassName={() => "bg-red-50/30"}
        />
      </Card>
    </Wrap>
  );
}

const resolvedCols: Column<ApiCall>[] = [
  { id: "caller", header: "Caller", cellClassName: "mono text-xs", sortValue: (c) => c.caller_qualified_name ?? c.caller_name ?? "", searchText: (c) => `${c.caller_qualified_name ?? ""} ${c.caller_name ?? ""}`, cell: (c) => c.caller_qualified_name ?? c.caller_name ?? "—" },
  { id: "callee", header: "Callee", cellClassName: "mono text-xs", sortValue: (c) => c.callee_qualified_name ?? c.callee_name ?? "", searchText: (c) => `${c.callee_qualified_name ?? ""} ${c.callee_name ?? ""}`, cell: (c) => c.callee_qualified_name ?? c.callee_name ?? "—" },
  { id: "site", header: "Call Site", cellClassName: "mono text-xs text-muted-foreground", searchText: (c) => c.call_site_text, cell: (c) => c.call_site_text },
  { id: "line", header: "Line", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (c) => c.call_site_line ?? 0, cell: (c) => c.call_site_line ?? "—" },
  { id: "resolution", header: "Resolution", headerClassName: "text-center", cellClassName: "text-center", sortValue: (c) => c.resolution, cell: (c) => <Badge color={c.resolution === "DIRECT" || c.resolution === "INTERNAL" ? "green" : c.resolution === "IMPORTED" ? "blue" : "amber"}>{c.resolution}</Badge> },
  { id: "hops", header: "Hops", headerClassName: "text-center", cellClassName: "text-center text-xs text-muted-foreground", sortValue: (c) => parseHops(c.hops).length, cell: (c) => { const h = parseHops(c.hops); return <span title={h.join(" → ")}>{h.length || "—"}</span>; } },
];

const unresolvedCols: Column<ApiCall>[] = [
  { id: "caller", header: "Caller", cellClassName: "mono text-xs", sortValue: (c) => c.caller_qualified_name ?? c.caller_name ?? "", searchText: (c) => `${c.caller_qualified_name ?? ""} ${c.caller_name ?? ""}`, cell: (c) => c.caller_qualified_name ?? c.caller_name ?? "—" },
  { id: "site", header: "Call Site", cellClassName: "mono text-xs", searchText: (c) => c.call_site_text, cell: (c) => c.call_site_text },
  { id: "line", header: "Line", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (c) => c.call_site_line ?? 0, cell: (c) => c.call_site_line ?? "—" },
  { id: "resolution", header: "Resolution", headerClassName: "text-center", cellClassName: "text-center", sortValue: (c) => c.resolution, cell: (c) => <Badge color="red">{c.resolution}</Badge> },
];

function Wrap({ children, onR, ts }: { children: React.ReactNode; onR: () => void; ts?: number }) {
  return <div><SectionHeader title="Call Resolver" subtitle="Component 1.4 — Call edge resolution outcomes (GET /calls)" onRefresh={onR} updatedAt={ts} />{children}</div>;
}
