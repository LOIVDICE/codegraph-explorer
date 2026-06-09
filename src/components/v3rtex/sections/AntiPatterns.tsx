import { useV3rtex } from "@/lib/v3rtex/context";
import { Card, SectionHeader, Skeleton, ErrorCard, Badge, EmptyState, relTime } from "../ui";
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
          {gods.length === 0 ? <div className="p-4"><EmptyState title="No god objects detected." /></div> : (
            <div className="overflow-auto max-h-[340px]">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border sticky top-0 bg-[var(--surface)]">
                  <tr><th className="text-left p-3">Node</th><th>Type</th><th className="text-right">Aff</th><th className="text-right">Eff</th><th className="text-right pr-3">Total</th></tr>
                </thead>
                <tbody>
                  {[...gods].sort((a, b) => (b.total ?? 0) - (a.total ?? 0)).map((g, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="p-3 mono text-xs">{g.name ?? g.id}</td>
                      <td><Badge color="violet">{g.type ?? "—"}</Badge></td>
                      <td className="text-right tabular-nums">{g.afferent ?? 0}</td>
                      <td className="text-right tabular-nums">{g.efferent ?? 0}</td>
                      <td className="text-right pr-3 tabular-nums font-semibold">{g.total ?? ((g.afferent ?? 0) + (g.efferent ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <Header icon={<Info size={14} className="text-blue-600" />} title="Dead Code" severity="LOW" count={dead.length} />
          <div className="px-4 pt-3 text-xs text-muted-foreground">These functions have zero callers within the project. They may be entry points called externally — verify before removing.</div>
          {dead.length === 0 ? <div className="p-4"><EmptyState title="No dead code detected." /></div> : (
            <div className="overflow-auto max-h-[340px]">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border sticky top-0 bg-[var(--surface)]">
                  <tr><th className="text-left p-3">Function</th><th className="text-left">File</th><th className="text-right">Line</th><th className="text-right pr-3">Modified</th></tr>
                </thead>
                <tbody>
                  {dead.map((d, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="p-3 mono text-xs">{d.name ?? d.id}</td>
                      <td className="mono text-xs text-muted-foreground truncate max-w-[200px]">{d.file_path ?? "—"}</td>
                      <td className="text-right tabular-nums">{d.line_number ?? "—"}</td>
                      <td className="text-right pr-3 text-xs text-muted-foreground">{relTime(d.last_modified)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
