import { useEffect, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-[var(--surface)] border border-border rounded-lg ${className}`}>{children}</div>;
}

export function SectionHeader({
  title, subtitle, updatedAt, onRefresh, right,
}: { title: string; subtitle?: string; updatedAt?: number; onRefresh?: () => void; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6 gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {right}
        {updatedAt ? <LastUpdated ts={updatedAt} /> : null}
        {onRefresh && (
          <button onClick={onRefresh} className="p-2 rounded-md border border-border hover:bg-muted transition-colors" title="Refresh">
            <RefreshCw size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function LastUpdated({ ts }: { ts: number }) {
  const [, force] = useState(0);
  useEffect(() => { const i = setInterval(() => force(x => x + 1), 1000); return () => clearInterval(i); }, []);
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  return <span className="text-xs text-muted-foreground mono">Updated {s}s ago</span>;
}

export function Badge({ children, color = "gray" }: { children: ReactNode; color?: string }) {
  const map: Record<string, string> = {
    gray: "bg-zinc-100 text-zinc-700",
    blue: "bg-blue-100 text-blue-700",
    yellow: "bg-yellow-100 text-yellow-800",
    cyan: "bg-cyan-100 text-cyan-700",
    violet: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    green: "bg-green-100 text-green-700",
    lime: "bg-lime-100 text-lime-800",
    orange: "bg-orange-100 text-orange-800",
  };
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${map[color] ?? map.gray}`}>{children}</span>;
}

export function GradeBadge({ grade, size = "sm" }: { grade?: string | null; size?: "sm" | "lg" }) {
  if (!grade) return <span className="text-muted-foreground text-xs">—</span>;
  const g = grade.toUpperCase();
  const colors: Record<string, string> = {
    A: "bg-[var(--grade-a)] text-white",
    B: "bg-[var(--grade-b)] text-white",
    C: "bg-[var(--grade-c)] text-white",
    D: "bg-[var(--grade-d)] text-white",
    E: "bg-[var(--grade-f)] text-white",
    F: "bg-[var(--grade-f)] text-white",
  };
  const sz = size === "lg" ? "w-8 h-8 text-sm" : "w-6 h-6 text-xs";
  return <span className={`inline-flex items-center justify-center rounded font-bold ${sz} ${colors[g] ?? "bg-zinc-300"}`}>{g}</span>;
}

export function EdgeTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    CALLS: "bg-violet-100 text-violet-700",
    IMPORTS: "bg-blue-100 text-blue-700",
    DEFINES: "bg-gray-100 text-gray-700",
    INHERITS: "bg-amber-100 text-amber-800",
    CONTAINS: "bg-cyan-100 text-cyan-700",
  };
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${map[type] ?? "bg-zinc-100 text-zinc-700"}`}>{type}</span>;
}

export function NodeTypeBadge({ type }: { type?: string }) {
  if (!type) return null;
  const map: Record<string, string> = {
    FILE: "bg-blue-50 text-blue-700 border-blue-200",
    DIRECTORY: "bg-cyan-50 text-cyan-700 border-cyan-200",
    CLASS: "bg-violet-50 text-violet-700 border-violet-200",
    FUNCTION: "bg-emerald-50 text-emerald-700 border-emerald-200",
    VARIABLE: "bg-zinc-50 text-zinc-700 border-zinc-200",
  };
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${map[type] ?? "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>{type}</span>;
}

export function LangBadge({ lang }: { lang?: string }) {
  if (!lang) return null;
  const l = lang.toLowerCase();
  const map: Record<string, string> = {
    python: "blue", py: "blue",
    javascript: "yellow", js: "yellow",
    typescript: "cyan", ts: "cyan",
    tsx: "violet", jsx: "violet",
  };
  return <Badge color={map[l] ?? "gray"}>{lang}</Badge>;
}

export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 bg-muted rounded animate-pulse" />
      ))}
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="p-6 border-red-200 bg-red-50">
      <div className="text-sm font-semibold text-red-800">Request failed</div>
      <div className="text-xs mono text-red-700 mt-2 break-all">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 px-3 py-1.5 text-xs rounded border border-red-300 bg-white hover:bg-red-100 transition-colors">Retry</button>
      )}
    </Card>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card className="p-10 text-center">
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="text-xs text-muted-foreground mt-2">{hint}</div>}
    </Card>
  );
}

export function formatBytes(n?: number) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function relTime(input?: string | number) {
  if (input == null) return "—";
  const t = typeof input === "number" ? input : Date.parse(input);
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - (t < 1e12 ? t * 1000 : t);
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function gradeColor(g?: string) {
  const v: Record<string, string> = { A: "var(--grade-a)", B: "var(--grade-b)", C: "var(--grade-c)", D: "var(--grade-d)", E: "var(--grade-f)", F: "var(--grade-f)" };
  return v[(g ?? "").toUpperCase()] ?? "#a1a1aa";
}

export function scoreToGrade(s?: number): string {
  if (s == null) return "";
  if (s >= 0.9) return "A";
  if (s >= 0.8) return "B";
  if (s >= 0.65) return "C";
  if (s >= 0.5) return "D";
  if (s >= 0.35) return "E";
  return "F";
}
