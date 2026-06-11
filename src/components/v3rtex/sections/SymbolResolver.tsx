import { useMemo } from "react";
import { useV3rtex } from "@/lib/v3rtex/context";
import { parseHops, type ApiSymbol } from "@/lib/v3rtex/api";
import { Card, SectionHeader, Skeleton, ErrorCard, Badge } from "../ui";
import { DataTable, type Column } from "../DataTable";

export function SymbolResolver() {
  const { symbols: symbolsRes, refreshAll } = useV3rtex();

  const data = useMemo(() => {
    const all = symbolsRes.data ?? [];
    const resolved = all.filter((s) => s.target_node_id != null);
    const external = all.filter((s) => s.target_node_id == null && s.external_module != null);
    const unresolved = all.filter((s) => s.target_node_id == null && s.external_module == null);
    return { all, resolved, external, unresolved };
  }, [symbolsRes.data]);

  if (symbolsRes.loading && !symbolsRes.data) return <Wrap onR={refreshAll}><Skeleton rows={10} /></Wrap>;
  if (symbolsRes.error) return <Wrap onR={refreshAll}><ErrorCard message={symbolsRes.error} onRetry={refreshAll} /></Wrap>;

  const total = data.all.length || 1;
  const rate = (data.resolved.length / total) * 100;
  const rateColor = rate > 90 ? "var(--grade-a)" : rate >= 70 ? "var(--grade-c)" : "var(--grade-f)";

  return (
    <Wrap onR={refreshAll} ts={symbolsRes.updated}>
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Resolution Rate</div>
          <div className="mono text-sm tabular-nums">{data.resolved.length} / {data.all.length} ({rate.toFixed(1)}%)</div>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${rate}%`, background: rateColor }} />
        </div>
      </Card>

      <Card className="p-4 mb-4">
        <Header label="Resolved Imports" count={data.resolved.length} />
        <DataTable rows={data.resolved} rowKey={(s) => s.id} maxHeight="400px" searchPlaceholder="Search resolved imports…" emptyTitle="No resolved imports." columns={resolvedCols} />
      </Card>

      <Card className="p-4 mb-4">
        <Header label="Unresolved — External Modules" count={data.external.length} />
        <DataTable rows={data.external} rowKey={(s) => s.id} maxHeight="400px" searchPlaceholder="Search external imports…" emptyTitle="No external imports." columns={externalCols} rowClassName={() => "bg-amber-50/40"} />
      </Card>

      <Card className="p-4">
        <Header label="Unresolved — Other" count={data.unresolved.length} />
        <div className="pb-3 text-xs text-muted-foreground">Imports without a resolved target node or a known external module.</div>
        <DataTable rows={data.unresolved} rowKey={(s) => s.id} maxHeight="400px" searchPlaceholder="Search unresolved…" emptyTitle="Nothing unresolved." columns={unresolvedCols} rowClassName={() => "bg-red-50/40"} />
      </Card>
    </Wrap>
  );
}

const resolvedCols: Column<ApiSymbol>[] = [
  { id: "source", header: "Source File", cellClassName: "mono text-xs", sortValue: (s) => s.import_file_id, searchText: (s) => s.import_file_id, cell: (s) => fileLabel(s.import_file_id) },
  { id: "statement", header: "Statement", cellClassName: "mono text-xs text-muted-foreground", searchText: (s) => s.import_text, cell: (s) => s.import_text },
  { id: "symbol", header: "Symbol", cellClassName: "mono text-xs", sortValue: (s) => s.symbol_name, searchText: (s) => s.symbol_name, cell: (s) => s.symbol_name },
  { id: "target", header: "Target", cellClassName: "mono text-xs", searchText: (s) => `${s.target_qualified_name ?? ""} ${s.target_name ?? ""}`, cell: (s) => s.target_qualified_name ?? s.target_name ?? shortId(s.target_node_id ?? "") },
  { id: "resolution", header: "Resolution", sortValue: (s) => s.resolution, cell: (s) => <Badge color="blue">{s.resolution}</Badge> },
  { id: "hops", header: "Hops", sortValue: (s) => parseHops(s.hops).length, cell: (s) => <HopsCell hops={s} /> },
];

const externalCols: Column<ApiSymbol>[] = [
  { id: "source", header: "Source File", cellClassName: "mono text-xs", sortValue: (s) => s.import_file_id, searchText: (s) => s.import_file_id, cell: (s) => fileLabel(s.import_file_id) },
  { id: "statement", header: "Statement", cellClassName: "mono text-xs text-muted-foreground", searchText: (s) => s.import_text, cell: (s) => s.import_text },
  { id: "symbol", header: "Symbol", cellClassName: "mono text-xs", sortValue: (s) => s.symbol_name, searchText: (s) => s.symbol_name, cell: (s) => s.symbol_name },
  { id: "module", header: "External Module", sortValue: (s) => s.external_module ?? "", searchText: (s) => s.external_module ?? "", cell: (s) => <Badge color="amber">{s.external_module}</Badge> },
];

const unresolvedCols: Column<ApiSymbol>[] = [
  { id: "source", header: "Source File", cellClassName: "mono text-xs", sortValue: (s) => s.import_file_id, searchText: (s) => s.import_file_id, cell: (s) => fileLabel(s.import_file_id) },
  { id: "statement", header: "Statement", cellClassName: "mono text-xs text-muted-foreground", searchText: (s) => s.import_text, cell: (s) => s.import_text },
  { id: "symbol", header: "Symbol", cellClassName: "mono text-xs", sortValue: (s) => s.symbol_name, searchText: (s) => s.symbol_name, cell: (s) => s.symbol_name },
  { id: "resolution", header: "Resolution", sortValue: (s) => s.resolution, cell: (s) => <Badge color="red">{s.resolution}</Badge> },
];

function fileLabel(fileId: string) {
  return shortId(fileId.replace(/\.\.py$/, ""));
}

function shortId(s: string) { return s && s.length > 50 ? s.slice(0, 47) + "…" : s; }

function HopsCell({ hops }: { hops: ApiSymbol }) {
  const list = parseHops(hops.hops);
  if (!list.length) return <span className="text-xs text-muted-foreground">direct</span>;
  return <span className="mono text-[10px] text-muted-foreground" title={list.join(" → ")}>{list.length} hop{list.length > 1 ? "s" : ""}</span>;
}

function Header({ label, count }: { label: string; count: number }) {
  return <div className="flex items-center justify-between mb-3"><div className="text-sm font-semibold">{label}</div><div className="mono text-xs tabular-nums text-muted-foreground">{count}</div></div>;
}

function Wrap({ children, onR, ts }: { children: React.ReactNode; onR: () => void; ts?: number }) {
  return <div><SectionHeader title="Symbol Resolver" subtitle="Component 1.3 — Import resolution outcomes (GET /symbols)" onRefresh={onR} updatedAt={ts} />{children}</div>;
}
