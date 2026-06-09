import { useState } from "react";
import { Card, SectionHeader, formatBytes } from "../ui";
import { apiFetch } from "@/lib/v3rtex/api";
import { Copy } from "lucide-react";

const ENDPOINTS = [
  { label: "GET /graph", path: "/graph", needsId: false },
  { label: "GET /stats", path: "/stats", needsId: false },
  { label: "GET /antipatterns", path: "/antipatterns", needsId: false },
  { label: "GET /node/:id", path: "/node/", needsId: true },
  { label: "GET /health", path: "/health", needsId: false },
];

type HistoryItem = { ts: number; path: string; status: number; ms: number; size: number; raw: string };

export function APITester() {
  const [endpoint, setEndpoint] = useState(ENDPOINTS[0].path);
  const [nodeId, setNodeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ status: number; ms: number; size: number; raw: string; data: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const cur = ENDPOINTS.find((e) => e.path === endpoint)!;

  const send = async () => {
    const path = cur.needsId ? `${endpoint}${encodeURIComponent(nodeId)}` : endpoint;
    setLoading(true); setError(null);
    try {
      const r = await apiFetch(path);
      setResponse(r);
      setHistory((h) => [{ ts: Date.now(), path, status: r.status, ms: r.ms, size: r.size, raw: r.raw }, ...h].slice(0, 10));
    } catch (e: unknown) {
      setError((e as Error).message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (s: number) => s >= 200 && s < 300 ? "text-green-700 bg-green-100" : "text-red-700 bg-red-100";
  const pretty = response ? safeJson(response.raw) : "";

  return (
    <div>
      <SectionHeader title="API Tester" subtitle="Manually invoke and inspect any V3RTEX L1 endpoint" />
      <div className="grid grid-cols-[340px_1fr] gap-4">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Endpoint</div>
          <select value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="w-full px-2 py-2 text-sm border border-border rounded bg-[var(--surface)] mb-3">
            {ENDPOINTS.map((e) => <option key={e.path} value={e.path}>{e.label}</option>)}
          </select>
          {cur.needsId && (
            <input value={nodeId} onChange={(e) => setNodeId(e.target.value)} placeholder="Node ID" className="w-full px-2 py-2 text-sm mono border border-border rounded bg-[var(--surface)] mb-3" />
          )}
          <button onClick={send} disabled={loading || (cur.needsId && !nodeId)} className="w-full px-3 py-2 text-sm bg-foreground text-background rounded disabled:opacity-50 hover:opacity-90 transition">
            {loading ? "Sending…" : "Send"}
          </button>

          <div className="mt-6">
            <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">History</div>
            <div className="space-y-1">
              {history.length === 0 ? <div className="text-xs text-muted-foreground">No requests yet.</div> : history.map((h, i) => (
                <button key={i} onClick={() => setResponse({ status: h.status, ms: h.ms, size: h.size, raw: h.raw, data: safeParse(h.raw) })} className="w-full text-left text-xs p-2 rounded border border-border hover:bg-muted">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded mono text-[10px] ${statusColor(h.status)}`}>{h.status}</span>
                    <span className="mono truncate flex-1">{h.path}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 mono">{h.ms}ms · {formatBytes(h.size)}</div>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden flex flex-col">
          {error && <div className="p-4 bg-red-50 text-red-800 text-sm border-b border-red-200">{error}</div>}
          {response && (
            <>
              <div className="p-3 border-b border-border flex items-center gap-3 text-xs">
                <span className={`px-2 py-0.5 rounded mono font-semibold ${statusColor(response.status)}`}>{response.status}</span>
                <span className="mono">{response.ms} ms</span>
                <span className="mono">{formatBytes(response.size)}</span>
                <button onClick={() => navigator.clipboard.writeText(response.raw)} className="ml-auto inline-flex items-center gap-1 px-2 py-1 border border-border rounded hover:bg-muted"><Copy size={12} /> Copy</button>
              </div>
              <pre className="flex-1 overflow-auto p-4 mono text-[11px] bg-zinc-950 text-zinc-100 max-h-[70vh]">{pretty}</pre>
            </>
          )}
          {!response && !error && (
            <div className="p-10 text-center text-sm text-muted-foreground">Send a request to see the response here.</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function safeParse(s: string): unknown { try { return JSON.parse(s); } catch { return s; } }
function safeJson(s: string): string { try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; } }
