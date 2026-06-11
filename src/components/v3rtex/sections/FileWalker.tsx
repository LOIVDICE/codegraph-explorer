import { useMemo, useState } from "react";
import { useV3rtex } from "@/lib/v3rtex/context";
import { Card, SectionHeader, Skeleton, ErrorCard, Badge, LangBadge, formatBytes, relTime } from "../ui";
import { DataTable, type Column } from "../DataTable";
import type { ApiFile } from "@/lib/v3rtex/api";
import { Copy } from "lucide-react";

export function FileWalker() {
  const { files: filesRes, refreshAll } = useV3rtex();
  const [lang, setLang] = useState("all");
  const [statusF, setStatusF] = useState("all");

  const files = useMemo(() => filesRes.data ?? [], [filesRes.data]);
  const langCounts = useMemo(() => {
    const m: Record<string, number> = {};
    files.forEach((f) => { const l = (f.language ?? "unknown").toLowerCase(); m[l] = (m[l] ?? 0) + 1; });
    return m;
  }, [files]);

  const filtered = useMemo(() => files.filter((f) => {
    if (lang !== "all" && (f.language ?? "").toLowerCase() !== lang) return false;
    if (statusF === "errors" && !f.has_syntax_errors) return false;
    if (statusF === "empty" && !f.is_empty) return false;
    if (statusF === "large" && !f.is_large) return false;
    return true;
  }), [files, lang, statusF]);

  const columns = useMemo<Column<ApiFile>[]>(() => [
    {
      id: "path", header: "Path",
      sortValue: (f) => f.relative_path ?? f.name,
      searchText: (f) => `${f.relative_path ?? ""} ${f.path ?? ""} ${f.name ?? ""}`,
      cellClassName: "mono text-xs",
      cell: (f) => <span title={f.path}>{f.relative_path ?? f.name}</span>,
    },
    {
      id: "lang", header: "Lang",
      sortValue: (f) => (f.language ?? "").toLowerCase(),
      cell: (f) => <LangBadge lang={f.language ?? undefined} />,
    },
    {
      id: "size", header: "Size",
      sortValue: (f) => f.size ?? 0,
      headerClassName: "text-right", cellClassName: "text-right tabular-nums mono text-xs",
      cell: (f) => formatBytes(f.size),
    },
    {
      id: "lines", header: "Lines",
      sortValue: (f) => f.line_count ?? 0,
      headerClassName: "text-right", cellClassName: "text-right tabular-nums mono text-xs",
      cell: (f) => f.line_count,
    },
    {
      id: "hash", header: "Hash",
      searchText: (f) => f.hash ?? "",
      cell: (f) => f.hash ? (
        <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(f.hash); }} className="mono text-xs hover:underline inline-flex items-center gap-1">
          {f.hash.slice(0, 8)}<Copy size={10} />
        </button>
      ) : "—",
    },
    {
      id: "status", header: "Status",
      sortValue: (f) => `${f.has_syntax_errors}${f.is_large}${f.is_empty}`,
      cellClassName: "space-x-1",
      cell: (f) => (
        <>
          {!!f.is_empty && <Badge color="gray">EMPTY</Badge>}
          {!!f.is_large && <Badge color="amber">LARGE</Badge>}
          {!!f.has_syntax_errors && <Badge color="red">ERRORS</Badge>}
          {!f.is_empty && !f.is_large && !f.has_syntax_errors && <span className="text-muted-foreground text-xs">OK</span>}
        </>
      ),
    },
    {
      id: "modified", header: "Modified",
      sortValue: (f) => Number(f.last_modified) || 0,
      headerClassName: "text-right", cellClassName: "text-right text-xs text-muted-foreground",
      cell: (f) => relTime(f.last_modified),
    },
  ], []);

  if (filesRes.loading && !filesRes.data) return <Wrap onR={refreshAll}><Skeleton rows={10} /></Wrap>;
  if (filesRes.error) return <Wrap onR={refreshAll}><ErrorCard message={filesRes.error} onRetry={refreshAll} /></Wrap>;

  return (
    <Wrap onR={refreshAll} ts={filesRes.updated}>
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

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(f) => f.id}
        searchPlaceholder="Search file path or hash…"
        emptyTitle="No files match the current filters."
        extraControls={
          <>
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]">
              <option value="all">All Languages</option>
              {Object.keys(langCounts).map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]">
              <option value="all">All Statuses</option>
              <option value="errors">Has Errors</option>
              <option value="empty">Empty</option>
              <option value="large">Large</option>
            </select>
          </>
        }
      />
    </Wrap>
  );
}

function Wrap({ children, onR, ts }: { children: React.ReactNode; onR: () => void; ts?: number }) {
  return <div><SectionHeader title="File Walker" subtitle="Component 1.1 — Discovered project files (GET /files)" onRefresh={onR} updatedAt={ts} />{children}</div>;
}
