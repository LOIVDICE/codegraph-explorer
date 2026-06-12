import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { V3rtexProvider } from "@/lib/v3rtex/context";
import { usePageSettings, PAGES, type PageKey } from "@/lib/v3rtex/settings";
import { usePageVersion } from "@/lib/v3rtex/page-state";
import { SidePanelContext, PANEL_PAGES } from "@/lib/v3rtex/side-panel";
import { Sidebar, type SectionKey } from "@/components/v3rtex/Sidebar";
import { Card } from "@/components/v3rtex/ui";
import { Overview } from "@/components/v3rtex/sections/Overview";
import { FileWalker } from "@/components/v3rtex/sections/FileWalker";
import { ASTExtraction } from "@/components/v3rtex/sections/ASTExtraction";
import { SymbolResolver } from "@/components/v3rtex/sections/SymbolResolver";
import { CallResolver } from "@/components/v3rtex/sections/CallResolver";
import { GraphInspector } from "@/components/v3rtex/sections/GraphInspector";
import { Complexity } from "@/components/v3rtex/sections/Complexity";
import { AntiPatterns } from "@/components/v3rtex/sections/AntiPatterns";
import { GraphVisualization } from "@/components/v3rtex/sections/GraphVisualization";
import { APITester } from "@/components/v3rtex/sections/APITester";
import { SettingsPage } from "@/components/v3rtex/sections/SettingsPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "V3RTEX L1 — Test Dashboard" },
      { name: "description", content: "Developer dashboard for inspecting V3RTEX L1 code intelligence output." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" },
    ],
  }),
  component: Dashboard,
});

const SECTIONS: Record<PageKey, () => React.ReactNode> = {
  overview: () => <Overview />,
  files: () => <FileWalker />,
  ast: () => <ASTExtraction />,
  symbols: () => <SymbolResolver />,
  calls: () => <CallResolver />,
  graph: () => <GraphInspector />,
  complexity: () => <Complexity />,
  antipatterns: () => <AntiPatterns />,
  viz: () => <GraphVisualization />,
  api: () => <APITester />,
};

function Dashboard() {
  const { enabled, toggle, reset } = usePageSettings();
  const [section, setSection] = useState<SectionKey>("files");
  // Sidebar slide state + portal target for per-page panels (ast, viz).
  const [slid, setSlid] = useState(false);
  const [panelEl, setPanelEl] = useState<HTMLElement | null>(null);
  // Bumped by resetPageState (page refresh button) so the active section
  // remounts with its default UI state in addition to the data refetch.
  const version = usePageVersion(section);

  const isDisabled = section !== "settings" && !enabled[section];

  const handleNav = (key: SectionKey) => {
    if (key === section) {
      // Page already open: never remount it — just slide to its panel.
      if (PANEL_PAGES.has(key)) setSlid(true);
      return;
    }
    setSection(key);
    setSlid(PANEL_PAGES.has(key));
  };

  return (
    <V3rtexProvider>
      <SidePanelContext.Provider value={panelEl}>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar
          active={section}
          onChange={handleNav}
          enabled={enabled}
          slid={slid}
          onBack={() => setSlid(false)}
          panelTitle={PAGES.find((p) => p.key === section)?.label ?? section}
          panelRef={setPanelEl}
        />
        <main className="flex-1 px-8 pt-8 pb-5 overflow-x-hidden">
          {section === "settings" ? (
            <SettingsPage enabled={enabled} onToggle={toggle} onReset={reset} />
          ) : isDisabled ? (
            <DisabledNotice
              label={PAGES.find((p) => p.key === section)?.label ?? section}
              onOpenSettings={() => handleNav("settings")}
            />
          ) : (
            <div key={`${section}:${version}`}>{SECTIONS[section]()}</div>
          )}
        </main>
      </div>
      </SidePanelContext.Provider>
    </V3rtexProvider>
  );
}

function DisabledNotice({ label, onOpenSettings }: { label: string; onOpenSettings: () => void }) {
  return (
    <Card className="p-10 text-center max-w-xl mx-auto mt-20">
      <div className="text-sm font-semibold">{label} is disabled</div>
      <div className="text-xs text-muted-foreground mt-2">
        This page was turned off, likely because its backend endpoint is not available.
      </div>
      <button
        onClick={onOpenSettings}
        className="mt-4 px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors"
      >
        Open Settings
      </button>
    </Card>
  );
}
