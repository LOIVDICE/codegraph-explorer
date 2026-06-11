import { useV3rtex } from "@/lib/v3rtex/context";
import type { EnabledMap, PageKey } from "@/lib/v3rtex/settings";
import {
  LayoutDashboard, FolderTree, FileCode2, Link2, PhoneCall,
  Database, Gauge, AlertTriangle, Network, TerminalSquare, Activity, Settings, Ban,
} from "lucide-react";

export type SectionKey = PageKey | "settings";

const nav: { key: PageKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "files", label: "File Walker", icon: FolderTree },
  { key: "ast", label: "AST Extraction", icon: FileCode2 },
  { key: "symbols", label: "Symbol Resolver", icon: Link2 },
  { key: "calls", label: "Call Resolver", icon: PhoneCall },
  { key: "graph", label: "Graph Inspector", icon: Database },
  { key: "complexity", label: "Complexity", icon: Gauge },
  { key: "antipatterns", label: "Anti-Patterns", icon: AlertTriangle },
  { key: "viz", label: "Visualization", icon: Network },
  { key: "api", label: "API Tester", icon: TerminalSquare },
];

export function Sidebar({
  active, onChange, enabled,
}: { active: SectionKey; onChange: (k: SectionKey) => void; enabled: EnabledMap }) {
  const { status, retry } = useV3rtex();
  return (
    <aside className="w-64 bg-[var(--surface)] border-r border-border h-screen sticky top-0 flex flex-col">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-foreground text-background flex items-center justify-center">
            <Activity size={14} />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">V3RTEX L1</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Test Dashboard</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 overflow-y-auto">
        {nav.map((n) => {
          const Icon = n.icon;
          const isActive = active === n.key;
          const isEnabled = enabled[n.key];
          if (!isEnabled) {
            return (
              <div
                key={n.key}
                title="Disabled in Settings"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5 text-zinc-400 cursor-not-allowed select-none"
              >
                <Icon size={15} />
                <span className="line-through">{n.label}</span>
                <Ban size={11} className="ml-auto" />
              </div>
            );
          }
          return (
            <button
              key={n.key}
              onClick={() => onChange(n.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors text-left ${
                isActive ? "bg-foreground text-background font-medium" : "text-zinc-700 hover:bg-muted"
              }`}
            >
              <Icon size={15} />
              {n.label}
            </button>
          );
        })}
        <div className="border-t border-border my-2" />
        <button
          onClick={() => onChange("settings")}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors text-left ${
            active === "settings" ? "bg-foreground text-background font-medium" : "text-zinc-700 hover:bg-muted"
          }`}
        >
          <Settings size={15} />
          Settings
        </button>
      </nav>
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            status === "connected" ? "bg-green-500" : status === "connecting" ? "bg-amber-500" : "bg-red-500"
          }`} />
          <span className="text-xs font-medium">
            {status === "connected" ? "Connected" : status === "connecting" ? "Connecting…" : "Disconnected"}
          </span>
          {status === "disconnected" && (
            <button onClick={retry} className="ml-auto text-[10px] px-2 py-0.5 rounded border border-border hover:bg-muted">Retry</button>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground mono mt-1.5">127.0.0.1:7331</div>
      </div>
    </aside>
  );
}
