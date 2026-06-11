import { useEffect, useMemo, useState } from "react";
import { useV3rtex } from "@/lib/v3rtex/context";
import { getFile, parseMeta, type ApiAstNode, type ApiFileDetail } from "@/lib/v3rtex/api";
import { Card, SectionHeader, Skeleton, ErrorCard, Badge } from "../ui";
import { DataTable, type Column } from "../DataTable";

const TABS = ["Functions", "Classes", "Imports", "Variables", "Calls"] as const;
type Tab = typeof TABS[number];

export function ASTExtraction() {
  const { files: filesRes, refreshAll } = useV3rtex();
  const files = useMemo(() => filesRes.data ?? [], [filesRes.data]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Functions");
  const [detail, setDetail] = useState<ApiFileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => { if (!selected && files.length) setSelected(files[0].id); }, [files, selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true); setErr(null);
    getFile(selected).then((r) => {
      if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
      setDetail(r.data);
    }).catch((e) => setErr((e as Error).message ?? String(e))).finally(() => setLoading(false));
  }, [selected]);

  const children = useMemo<ApiAstNode[]>(() => detail?.nodes ?? [], [detail]);

  const fns = children.filter((c) => c.node_type === "function_definition");
  const cls = children.filter((c) => c.node_type === "class_definition");
  const imps = children.filter((c) => c.category === "imports");
  const vars = children.filter((c) => c.category === "variables");
  const calls = children.filter((c) => c.node_type === "call");

  const filteredFiles = files.filter((f) => !q || (f.relative_path ?? "").toLowerCase().includes(q.toLowerCase()));

  if (filesRes.loading && !filesRes.data) return <Wrap onR={refreshAll}><Skeleton rows={10} /></Wrap>;
  if (filesRes.error) return <Wrap onR={refreshAll}><ErrorCard message={filesRes.error} onRetry={refreshAll} /></Wrap>;

  return (
    <Wrap onR={refreshAll} ts={filesRes.updated}>
      <div className="grid grid-cols-[300px_1fr] gap-4 h-[calc(100vh-180px)]">
        <Card className="flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter files…" className="w-full px-2 py-1.5 text-xs border border-border rounded bg-[var(--surface)]" />
          </div>
          <div className="flex-1 overflow-auto">
            {filteredFiles.map((f) => (
              <button key={f.id} onClick={() => setSelected(f.id)} className={`w-full text-left px-3 py-2 text-xs mono border-b border-border hover:bg-muted ${selected === f.id ? "bg-muted font-semibold" : ""}`}>
                {f.relative_path ?? f.name}
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <div className="border-b border-border">
            <div className="flex">
              {TABS.map((t) => {
                const count = t === "Functions" ? fns.length : t === "Classes" ? cls.length : t === "Imports" ? imps.length : t === "Variables" ? vars.length : calls.length;
                return (
                  <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    {t} <span className="ml-1 text-[10px] mono tabular-nums">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {loading ? <Skeleton rows={6} /> : err ? <ErrorCard message={err} /> : (
              <>
                {tab === "Functions" && <DataTable rows={fns} rowKey={(n) => n.id} maxHeight="calc(100vh - 360px)" searchPlaceholder="Search functions…" emptyTitle="No functions in this file." columns={fnCols} />}
                {tab === "Classes" && <DataTable rows={cls} rowKey={(n) => n.id} maxHeight="calc(100vh - 360px)" searchPlaceholder="Search classes…" emptyTitle="No classes in this file." columns={clsCols} />}
                {tab === "Imports" && <DataTable rows={imps} rowKey={(n) => n.id} maxHeight="calc(100vh - 360px)" searchPlaceholder="Search imports…" emptyTitle="No imports in this file." columns={impCols} />}
                {tab === "Variables" && <DataTable rows={vars} rowKey={(n) => n.id} maxHeight="calc(100vh - 360px)" searchPlaceholder="Search variables…" emptyTitle="No variables in this file." columns={varCols} />}
                {tab === "Calls" && <DataTable rows={calls} rowKey={(n) => n.id} maxHeight="calc(100vh - 360px)" searchPlaceholder="Search calls…" emptyTitle="No calls in this file." columns={callCols} />}
              </>
            )}
          </div>
        </Card>
      </div>
    </Wrap>
  );
}

const fnCols: Column<ApiAstNode>[] = [
  { id: "name", header: "Name", cellClassName: "mono text-xs", sortValue: (f) => f.qualified_name ?? f.name ?? f.id, searchText: (f) => `${f.qualified_name ?? ""} ${f.name ?? ""}`, cell: (f) => f.qualified_name ?? f.name ?? f.id },
  { id: "params", header: "Params", cellClassName: "mono text-xs text-muted-foreground", searchText: (f) => String(parseMeta(f).parameters ?? ""), cell: (f) => String(parseMeta(f).parameters ?? "—") },
  { id: "start", header: "Start", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (f) => f.start_line, cell: (f) => f.start_line ?? "—" },
  { id: "end", header: "End", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (f) => f.end_line, cell: (f) => f.end_line ?? "—" },
  { id: "flags", header: "Flags", cell: (f) => { const m = parseMeta(f); return <span className="space-x-1">{m.is_async === true && <Badge color="blue">async</Badge>}{m.is_anonymous === true && <Badge color="violet">anon</Badge>}</span>; } },
  { id: "doc", header: "Docstring", cellClassName: "text-xs text-muted-foreground", searchText: (f) => String(parseMeta(f).docstring ?? ""), cell: (f) => { const d = String(parseMeta(f).docstring ?? ""); return <span title={d} className="line-clamp-1">{d.slice(0, 60) || "—"}</span>; } },
];

const clsCols: Column<ApiAstNode>[] = [
  { id: "name", header: "Name", cellClassName: "mono text-xs", sortValue: (c) => c.name ?? "", searchText: (c) => c.name ?? "", cell: (c) => c.name ?? "—" },
  { id: "qname", header: "Qualified Name", cellClassName: "mono text-xs text-muted-foreground", sortValue: (c) => c.qualified_name ?? "", searchText: (c) => c.qualified_name ?? "", cell: (c) => c.qualified_name ?? "—" },
  { id: "start", header: "Start", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (c) => c.start_line, cell: (c) => c.start_line ?? "—" },
  { id: "end", header: "End", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (c) => c.end_line, cell: (c) => c.end_line ?? "—" },
  { id: "doc", header: "Docstring", cellClassName: "text-xs text-muted-foreground", searchText: (c) => String(parseMeta(c).docstring ?? ""), cell: (c) => { const d = String(parseMeta(c).docstring ?? ""); return <span title={d} className="line-clamp-1">{d.slice(0, 60) || "—"}</span>; } },
];

const impCols: Column<ApiAstNode>[] = [
  { id: "module", header: "Module", cellClassName: "mono text-xs", sortValue: (i) => String(parseMeta(i).module ?? ""), searchText: (i) => String(parseMeta(i).module ?? ""), cell: (i) => String(parseMeta(i).module ?? "—") },
  { id: "symbols", header: "Symbols", cellClassName: "mono text-xs", searchText: (i) => { const m = parseMeta(i); return Array.isArray(m.symbols) ? (m.symbols as string[]).join(", ") : (i.name ?? ""); }, cell: (i) => { const m = parseMeta(i); return Array.isArray(m.symbols) ? (m.symbols as string[]).join(", ") : (i.name ?? "—"); } },
  { id: "alias", header: "Alias", cellClassName: "mono text-xs", cell: (i) => String(parseMeta(i).alias ?? "—") },
  { id: "resolution", header: "Resolution", sortValue: (i) => String(parseMeta(i).resolution ?? ""), cell: (i) => { const r = String(parseMeta(i).resolution ?? "UNKNOWN"); return <Badge color={r === "INTERNAL" ? "blue" : "amber"}>{r}</Badge>; } },
  { id: "target", header: "Target", cellClassName: "mono text-xs text-muted-foreground", searchText: (i) => String(parseMeta(i).target_file_path ?? ""), cell: (i) => String(parseMeta(i).target_file_path ?? "—") },
];

const varCols: Column<ApiAstNode>[] = [
  { id: "name", header: "Name", cellClassName: "mono text-xs", sortValue: (v) => v.name ?? "", searchText: (v) => v.name ?? "", cell: (v) => v.name ?? "—" },
  { id: "line", header: "Line", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (v) => v.start_line, cell: (v) => v.start_line ?? "—" },
  { id: "scope", header: "Scope", sortValue: (v) => (parseMeta(v).is_module_level === true ? "module" : "local"), cell: (v) => parseMeta(v).is_module_level === true ? <Badge color="green">module</Badge> : <Badge color="gray">local</Badge> },
  { id: "text", header: "Text", cellClassName: "mono text-xs text-muted-foreground", searchText: (v) => v.text ?? "", cell: (v) => <span className="line-clamp-1">{(v.text ?? "").slice(0, 70)}</span> },
];

const callCols: Column<ApiAstNode>[] = [
  { id: "callee", header: "Callee", cellClassName: "mono text-xs", sortValue: (c) => c.name ?? "", searchText: (c) => c.name ?? "", cell: (c) => c.name ?? "—" },
  { id: "enclosing", header: "Enclosing Fn", cellClassName: "mono text-xs text-muted-foreground", searchText: (c) => String(parseMeta(c).enclosing_fn ?? ""), cell: (c) => { const m = parseMeta(c); const e = typeof m.enclosing_fn === "string" ? m.enclosing_fn : null; return e ? shortId(e) : "module"; } },
  { id: "line", header: "Line", headerClassName: "text-right", cellClassName: "text-right tabular-nums", sortValue: (c) => c.start_line, cell: (c) => c.start_line ?? "—" },
  { id: "resolution", header: "Resolution", sortValue: (c) => String(parseMeta(c).resolution ?? ""), cell: (c) => { const r = String(parseMeta(c).resolution ?? "UNKNOWN"); return <Badge color={r === "UNRESOLVED" ? "amber" : r === "EXTERNAL" ? "gray" : "green"}>{r}</Badge>; } },
];

function shortId(s: string) { return s.length > 50 ? s.slice(0, 47) + "…" : s; }

function Wrap({ children, onR, ts }: { children: React.ReactNode; onR: () => void; ts?: number }) {
  return <div><SectionHeader title="AST Extraction" subtitle="Component 1.2 — Parsed entities per file (GET /files/{id})" onRefresh={onR} updatedAt={ts} />{children}</div>;
}
