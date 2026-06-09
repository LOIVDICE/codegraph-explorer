import { useMemo, useState } from "react";
import { useV3rtex } from "@/lib/v3rtex/context";
import { Card, SectionHeader, Skeleton, ErrorCard, Badge, LangBadge, formatBytes, relTime, EmptyState } from "../ui";
import type { GraphNode } from "@/lib/v3rtex/api";
import { Copy } from "lucide-react";

export function FileWalker() {
  const { graph, graphLoading, graphError, refreshGraph, graphUpdated } = useV3rtex();
  const [q, setQ] = useState("");
  const [lang, setLang] = useState("all");
  const [statusF, setStatusF] = useState("all");

  const files = useMemo(() => (graph?.nodes ?? []).filter((n) => n.type === "FILE"), [graph]);
  const langCounts = useMemo(() => {
    const m: Record<string, number> = {};
    files.forEach((f) => { const l = (f.language ?? "unknown").toLowerCase(); m[l] = (m[l] ?? 0) + 1; });
    return m;
  }, [files]);

  const filtered = useMemo(() => files.filter((f) => {
    if (q && !(f.file_path ?? "").toLowerCase().includes(q.toLowerCase())) return false;
    if (lang !== "all" && (f.language ?? "").toLowerCase() !== lang) return false;
    if (statusF === "errors" && !f.has_syntax_errors) return false;
    if (statusF === "empty" && !f.is_empty) return false;
    if (statusF === "large" && !f.is_large) return false;
    return true;
  }), [files, q, lang, statusF]);

  if (graphLoading && !graph) return <Wrap onR={refreshGraph}><Skeleton rows={10} /></Wrap>;
  if (graphError) return <Wrap onR={refreshGraph}><ErrorCard message={graphError} onRetry={refreshGraph} /></Wrap>;

  return (
    <Wrap onR={refreshGraph} ts={graphUpdated}>
      <Card className="p-4 mb-4">
        <div className="text-xs text-muted-foreground mb-2">{files.length} files by language</div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(langCounts).map(([l, c]) => {
            const max = Math.max(...Object.values(langCounts));
            return (
              <div key={l} className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded">
                <LangBadge lang={l} />
                <span className="text-xs mono tabular-nums">{c}</span>
                <div className="w-16 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                  <div className="h-full bg-foreground" style={{ width: `${(c / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex gap-2 mb-3 items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search file path…" className="flex-1 px-3 py-1.5 text-sm border border-border rounded bg-[var(--surface)]" />
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="px-2 py-1.5 text-sm border border-border rounded bg-[var(--surface)]">
          <option value="all">All Languages</option>
          {Object.keys(langCounts).map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="px-2 py-1.5 text-sm border border-border rounded bg-[var(--surface)]">
          <option value="all">All Statuses</option>
          <option value="errors">Has Errors</option>
          <option value="empty">Empty</option>
          <option value="large">Large</option>
        </select>
        <div className="text-xs text-muted-foreground mono tabular-nums">{filtered.length} / {files.length}</div>
      </div>

      {filtered.length === 0 ? <EmptyState title="No files match the current filters." /> : (
        <Card>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border sticky top-0 bg-[var(--surface)]">
                <tr>
                  <th className="text-left p-3">Path</th>
                  <th className="text-left">Lang</th>
                  <th className="text-right">Size</th>
                  <th className="text-left pl-4">Hash</th>
                  <th className="text-left">Status</th>
                  <th className="text-right pr-3">Modified</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f: GraphNode) => (
                  <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 mono text-xs">{f.file_path ?? f.name ?? f.id}</td>
                    <td><LangBadge lang={f.language} /></td>
                    <td className="text-right tabular-nums mono text-xs">{formatBytes(f.size)}</td>
                    <td className="pl-4">
                      {f.hash ? (
                        <button onClick={() => navigator.clipboard.writeText(f.hash!)} className="mono text-xs hover:underline inline-flex items-center gap-1">
                          {f.hash.slice(0, 8)}<Copy size={10} />
                        </button>
                      ) : "—"}
                    </td>
                    <td className="space-x-1">
                      {f.is_empty && <Badge color="gray">EMPTY</Badge>}
                      {f.is_large && <Badge color="amber">LARGE</Badge>}
                      {f.has_syntax_errors && <Badge color="red">ERRORS</Badge>}
                    </td>
                    <td className="text-right pr-3 text-xs text-muted-foreground">{relTime(f.last_modified)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Wrap>
  );
}

function Wrap({ children, onR, ts }: { children: React.ReactNode; onR: () => void; ts?: number }) {
  return <div><SectionHeader title="File Walker" subtitle="Component 1.1 — Discovered project files" onRefresh={onR} updatedAt={ts} />{children}</div>;
}
