import { useV3rtex } from "@/lib/v3rtex/context";
import { Card, SectionHeader, Skeleton, ErrorCard, Badge, EmptyState, relTime } from "../ui";
import { DataTable, type Column } from "../DataTable";
import { ArrowRight, AlertOctagon, AlertTriangle, Info } from "lucide-react";

type Cycle = string[];
type GodObj = { id: string; name?: string; type?: string; afferent?: number; efferent?: number; total?: number };
type Dead = { id: string; name?: string; file_path?: string; line_number?: number; last_modified?: string | number };
type Chain = string[];

export function AntiPatterns() {
  const { antipatterns, antipatternsLoading, antipatternsError, refreshAntipatterns, antipatternsUpdated } = useV3rtex();

  if (antipatternsLoading && !antipatterns) return <Wrap onR={refreshAntipatterns}><Skeleton rows={10} /></Wrap>;
  if (antipatternsError) return <Wrap onR={refreshAntipatterns}><ErrorCard message={antipatternsError} onRetry={refreshAntipatterns} /></Wrap>;

  const ap = antipatterns ?? {};
  const cycles: Cycle[] = (ap.circular_dependencies as Cycle[]) ?? (ap.cycles as Cycle[]) ?? [];
  const gods: GodObj[] = (ap.god_objects as GodObj[]) ?? [];
  const dead: Dead[] = (ap.dead_code as Dead[]) ?? [];
  const chains: Chain[] = (ap.deep_chains as Chain[]) ?? [];
  const godThreshold = (ap.god_threshold as number) ?? 15;
  const chainThreshold = (ap.chain_threshold as number) ?? 8;

  const high = cycles.length;
  const medium = gods.length + chains.length;
  const low = dead.length;

  return (
    <Wrap onR={refreshAntipatterns} ts={antipatternsUpdated}>
      <Card className="p-4 mb-4 flex gap-3 items-center">
        <div className="text-sm font-semibold mr-auto">Severity Summary</div>
        <SeverityCount level="HIGH" count={high} />
        <SeverityCount level="MEDIUM" count={medium} />
        <SeverityCount level="LOW" count={low} />
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <Header icon={<AlertOctagon size={14} className="text-red-600" />} title="Circular Dependencies" severity="HIGH" count={cycles.length} />
          <div className="p-4">
            {cycles.length === 0 ? <EmptyState title="No circular dependencies detected." /> : (
              <div className="space-y-3">
                {cycles.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1 p-2 bg-red-50 rounded border border-red-200">
                    {c.map((node, j) => (
                      <span key={j} className="flex items-center gap-1">
                        <span className="mono text-xs bg-white px-2 py-0.5 rounded border border-red-200">{node}</span>
                        {j < c.length - 1 && <ArrowRight size={12} className="text-red-500" />}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <Header icon={<AlertTriangle size={14} className="text-amber-600" />} title="God Objects" severity="MEDIUM" count={gods.length} note={`threshold: ${godThreshold}`} />
          <div className="p-4">
            <DataTable
              rows={gods}
              rowKey={(g, i) => g.id ?? i}
              maxHeight="340px"
              searchPlaceholder="Search god objects…"
              emptyTitle="No god objects detected."
              initialSort={{ columnId: "total", dir: "desc" }}
              columns={godCols}
            />
          </div>
        </Card>

        <Card>
          <Header icon={<Info size={14} className="text-blue-600" />} title="Dead Code" severity="LOW" count={dead.length} />
          <div className="px-4 pt-3 text-xs text-muted-foreground">These functions have zero callers within the project. They may be entry points called externally — verify before removing.</div>
          <div className="p-4">
            <DataTable
              rows={dead}
              rowKey={(d, i) => d.id ?? i}
              maxHeight="340px"
              searchPlaceholder="Search dead code…"
              emptyTitle="No dead code detected."
              columns={deadCols}
            />
          </div>
        </Card>

        <Card>
          <Header icon={<AlertTriangle size={14} className="text-amber-600" />} title="Deep Call Chains" severity="MEDIUM" count={chains.length} note={`threshold: ${chainThreshold} hops`} />
          <div className="p-4">
            {chains.length === 0 ? <EmptyState title="No deep call chains detected." /> : (
              <div className="space-y-3">
                {chains.map((c, i) => (
                  <div key={i} className="p-2 bg-amber-50 rounded border border-amber-200">
                    <div className="text-[10px] text-amber-800 mb-1">Length: {c.length}</div>
                    <div className="flex flex-wrap items-center gap-1">
                      {c.map((node, j) => (
                        <span key={j} className="flex items-center gap-1">
                          <span className={`mono text-xs px-2 py-0.5 rounded border ${j === 0 ? "bg-amber-200 border-amber-400 font-semibold" : j === c.length - 1 ? "bg-red-200 border-red-400 font-semibold" : "bg-white border-amber-200"}`}>{node}</span>
                          {j < c.length - 1 && <ArrowRight size={12} className="text-amber-500" />}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </Wrap>
  );
}

const godCols: Column<GodObj>[] = [
  { id: "node", header: "Node", cellClassName: "mono text-xs", sortValue: (g) => g.name ?? g.id, searchText: (g) => `${g.name ?? ""} ${g.id}`, cell: (g) => g.name ?? g.id },
  { id: "type", header: "Type", sortValue: (g) => g.type ?? "", cell: (g) => <Badge color="violet">{g.type ?? "—"}</Badge> },
  { id: "aff", header: "Aff", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (g) => g.afferent ?? 0, cell: (g) => g.afferent ?? 0 },
  { id: "eff", header: "Eff", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (g) => g.efferent ?? 0, cell: (g) => g.efferent ?? 0 },
  { id: "total", header: "Total", headerClassName: "text-right", cellClassName: "text-right tabular-nums font-semibold", sortValue: (g) => g.total ?? ((g.afferent ?? 0) + (g.efferent ?? 0)), cell: (g) => g.total ?? ((g.afferent ?? 0) + (g.efferent ?? 0)) },
];

const deadCols: Column<Dead>[] = [
  { id: "fn", header: "Function", cellClassName: "mono text-xs", sortValue: (d) => d.name ?? d.id, searchText: (d) => `${d.name ?? ""} ${d.id}`, cell: (d) => d.name ?? d.id },
  { id: "file", header: "File", cellClassName: "mono text-xs text-muted-foreground", sortValue: (d) => d.file_path ?? "", searchText: (d) => d.file_path ?? "", cell: (d) => <span className="truncate inline-block max-w-[200px] align-bottom">{d.file_path ?? "—"}</span> },
  { id: "line", header: "Line", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (d) => d.line_number ?? 0, cell: (d) => d.line_number ?? "—" },
  { id: "modified", header: "Modified", headerClassName: "text-right", cellClassName: "text-right text-xs text-muted-foreground", sortValue: (d) => Number(d.last_modified) || 0, cell: (d) => relTime(d.last_modified) },
];

function SeverityCount({ level, count }: { level: "HIGH" | "MEDIUM" | "LOW"; count: number }) {
  const color = level === "HIGH" ? "red" : level === "MEDIUM" ? "amber" : "blue";
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-border">
      <Badge color={color}>{level}</Badge>
      <span className="text-sm font-semibold tabular-nums">{count}</span>
    </div>
  );
}

function Header({ icon, title, severity, count, note }: { icon: React.ReactNode; title: string; severity: string; count: number; note?: string }) {
  return (
    <div className="p-4 border-b border-border flex items-center gap-2">
      {icon}
      <div className="text-sm font-semibold mr-auto">{title}</div>
      {note && <span className="text-[10px] text-muted-foreground mono">{note}</span>}
      <Badge color={severity === "HIGH" ? "red" : severity === "MEDIUM" ? "amber" : "blue"}>{severity}</Badge>
      <span className="text-xs mono tabular-nums">{count}</span>
    </div>
  );
}

function Wrap({ children, onR, ts }: { children: React.ReactNode; onR: () => void; ts?: number }) {
  return <div><SectionHeader title="Anti-Patterns" subtitle="Component 1.7 — Graph-algorithm-based detection" onRefresh={onR} updatedAt={ts} />{children}</div>;
}
