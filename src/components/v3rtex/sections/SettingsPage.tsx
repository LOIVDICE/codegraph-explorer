import { Card, SectionHeader, Badge } from "../ui";
import { PAGES, type EnabledMap, type PageKey } from "@/lib/v3rtex/settings";

export function SettingsPage({
  enabled, onToggle, onReset,
}: { enabled: EnabledMap; onToggle: (k: PageKey) => void; onReset: () => void }) {
  return (
    <div>
      <SectionHeader
        title="Page Settings"
        subtitle="Enable or disable dashboard pages. Pages whose backend endpoint is missing can be turned off to avoid broken views."
        right={
          <button onClick={onReset} className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors">
            Reset to defaults
          </button>
        }
      />

      <Card>
        <div className="p-4 border-b border-border grid grid-cols-[24px_1fr_1fr_120px] gap-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">
          <span />
          <span>Page</span>
          <span>Endpoint dependency</span>
          <span className="text-right">Backend status</span>
        </div>
        {PAGES.map((p) => (
          <label
            key={p.key}
            className="p-4 border-b border-border last:border-0 grid grid-cols-[24px_1fr_1fr_120px] gap-3 items-center cursor-pointer hover:bg-muted/50"
          >
            <input
              type="checkbox"
              checked={enabled[p.key]}
              onChange={() => onToggle(p.key)}
              className="w-4 h-4 accent-foreground"
            />
            <span className={`text-sm font-medium ${enabled[p.key] ? "" : "text-muted-foreground line-through"}`}>
              {p.label}
            </span>
            <span className="mono text-xs text-muted-foreground">{p.endpoint}</span>
            <span className="text-right">
              {p.available
                ? <Badge color="green">Available</Badge>
                : <Badge color="red">Missing</Badge>}
            </span>
          </label>
        ))}
      </Card>

      <Card className="p-4 mt-4">
        <div className="text-xs text-muted-foreground leading-relaxed">
          Pages marked <Badge color="red">Missing</Badge> depend on endpoints not served by the connected backend
          (<span className="mono">127.0.0.1:7331</span>), which currently exposes
          <span className="mono"> /files</span>, <span className="mono">/files/{"{id}"}</span>,
          <span className="mono"> /nodes</span>, <span className="mono">/nodes/{"{id}"}</span>,
          <span className="mono"> /symbols</span> and <span className="mono">/calls</span>.
          Enabling a missing page will show incomplete or empty data.
        </div>
      </Card>
    </div>
  );
}
