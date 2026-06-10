import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useV3rtex } from "@/lib/v3rtex/context";
import { getNode, type GraphNode } from "@/lib/v3rtex/api";
import { Card, SectionHeader, Skeleton, ErrorCard, Badge, EmptyState } from "../ui";
import { useSidebarSlot } from "../SidebarPanelContext";

const TABS = ["Functions", "Classes", "Imports", "Variables", "Calls"] as const;
type Tab = typeof TABS[number];

export function ASTExtraction() {
  const { graph, graphLoading, graphError, refreshGraph, graphUpdated } = useV3rtex();
  const slot = useSidebarSlot();
  const files = useMemo(() => (graph?.nodes ?? []).filter((n) => n.type === "FILE"), [graph]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Functions");
  const [detail, setDetail] = useState<(GraphNode & { children?: GraphNode[] }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => { if (!selected && files.length) setSelected(files[0].id); }, [files, selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true); setErr(null);
    getNode(selected).then((r) => {
      if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
      setDetail(r.data);
    }).catch((e) => setErr(e.message ?? String(e))).finally(() => setLoading(false));
  }, [selected]);

  const children = useMemo<GraphNode[]>(() => {
    if (detail?.children?.length) return detail.children;
    if (!selected) return [];
    const all = graph?.nodes ?? [];
    return all.filter((n) => n.parent_id === selected || (n.file_path && detail && n.file_path === detail.file_path && n.id !== selected));
  }, [detail, selected, graph]);

  const byType = (t: string) => children.filter((c) => c.type === t);
  const fns = byType("FUNCTION");
  const cls = byType("CLASS");
  const imps = children.filter((c) => c.type === "IMPORT" || (c as { kind?: string }).kind === "import" || c.module);
  const vars = byType("VARIABLE");
  const calls = children.filter((c) => c.type === "CALL" || c.callee_name);

  const filteredFiles = files.filter((f) => !q || (f.file_path ?? "").toLowerCase().includes(q.toLowerCase()));

  const fileListPanel = (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter files…"
          className="w-full px-2 py-1.5 text-xs border border-border rounded bg-white"
        />
      </div>
      <div className="flex-1 overflow-auto">
        {filteredFiles.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelected(f.id)}
            className={`w-full text-left px-3 py-2 text-xs mono border-b border-border hover:bg-muted break-all ${selected === f.id ? "bg-muted font-semibold" : ""}`}
          >
            {f.file_path ?? f.name}
          </button>
        ))}
        {filteredFiles.length === 0 && <div className="p-4 text-xs text-muted-foreground">No files.</div>}
      </div>
    </div>
  );

  if (graphLoading && !graph) return <Wrap onR={refreshGraph}><Skeleton rows={10} /></Wrap>;
  if (graphError) return <Wrap onR={refreshGraph}><ErrorCard message={graphError} onRetry={refreshGraph} /></Wrap>;

  return (
    <Wrap onR={refreshGraph} ts={graphUpdated}>
      {slot && createPortal(fileListPanel, slot)}

      <Card className="flex flex-col overflow-hidden h-[calc(100vh-180px)]">
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
              {tab === "Functions" && <Table headers={["Name", "Params", "Start", "End", "Flags", "Decorators", "Docstring"]} rows={fns.map((f) => [
                <span className="mono text-xs">{f.name ?? f.id}</span>,
                <span className="mono text-xs text-muted-foreground">{(f.params ?? []).join(", ")}</span>,
                f.start_line ?? "—", f.end_line ?? "—",
                <span className="space-x-1">{f.is_async && <Badge color="blue">async</Badge>}{f.is_generator && <Badge color="violet">gen</Badge>}</span>,
                <span className="space-x-1">{(f.decorators ?? []).map((d, i) => <Badge key={i} color="amber">{d}</Badge>)}</span>,
                <span title={f.docstring} className="text-xs text-muted-foreground line-clamp-1">{(f.docstring ?? "").slice(0, 60)}</span>,
              ])} />}
              {tab === "Classes" && <Table headers={["Name", "Bases", "Methods", "Start", "End", "Decorators"]} rows={cls.map((c) => [
                <span className="mono text-xs">{c.name}</span>,
                <span className="space-x-1">{(c.base_classes ?? []).map((b, i) => <Badge key={i} color="violet">{b}</Badge>)}</span>,
                (c as { methods?: unknown[] }).methods?.length ?? "—",
                c.start_line ?? "—", c.end_line ?? "—",
                <span className="space-x-1">{(c.decorators ?? []).map((d, i) => <Badge key={i} color="amber">{d}</Badge>)}</span>,
              ])} />}
              {tab === "Imports" && <Table headers={["Module", "Symbols", "Alias", "Type"]} rows={imps.map((i) => [
                <span className="mono text-xs">{i.module ?? "—"}</span>,
                <span className="mono text-xs">{(i.symbols ?? []).join(", ")}</span>,
                <span className="mono text-xs">{i.alias ?? "—"}</span>,
                <Badge color="blue">{(i.import_type ?? "SIMPLE").toString().toUpperCase()}</Badge>,
              ])} />}
              {tab === "Variables" && <Table headers={["Name", "Type", "Line", "Const"]} rows={vars.map((v) => [
                <span className="mono text-xs">{v.name}</span>,
                <span className="mono text-xs text-muted-foreground">{v.inferred_type ?? "—"}</span>,
                v.line_number ?? v.start_line ?? "—",
                v.is_constant ? <Badge color="green">const</Badge> : "—",
              ])} />}
              {tab === "Calls" && <Table headers={["Callee", "Caller", "Line", "Resolved"]} rows={calls.map((c) => [
                <span className="mono text-xs">{c.callee_name ?? c.raw_callee ?? "—"}</span>,
                <span className="mono text-xs">{c.caller ?? "—"}</span>,
                c.line_number ?? "—",
                c.resolution ? <Badge color="green">RESOLVED</Badge> : <Badge color="amber">UNRESOLVED</Badge>,
              ])} />}
            </>
          )}
        </div>
      </Card>
    </Wrap>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <EmptyState title="No items to display in this category." />;
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-muted-foreground border-b border-border">
        <tr>{headers.map((h) => <th key={h} className="text-left py-2 pr-3">{h}</th>)}</tr>
      </thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i} className="border-b border-border last:border-0">
          {r.map((c, j) => <td key={j} className="py-2 pr-3">{c}</td>)}
        </tr>
      ))}</tbody>
    </table>
  );
}

function Wrap({ children, onR, ts }: { children: React.ReactNode; onR: () => void; ts?: number }) {
  return <div><SectionHeader title="AST Extraction" subtitle="Component 1.2 — Tree-sitter parsed entities per file" onRefresh={onR} updatedAt={ts} />{children}</div>;
}
