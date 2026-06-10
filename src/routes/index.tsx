import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { V3rtexProvider } from "@/lib/v3rtex/context";
import { Sidebar, SECTIONS_WITH_PANEL, type SectionKey } from "@/components/v3rtex/Sidebar";
import { SidebarSlotContext } from "@/components/v3rtex/SidebarPanelContext";
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

function Dashboard() {
  const [section, setSection] = useState<SectionKey>("overview");
  const [panelOpen, setPanelOpen] = useState(false);
  const [slotEl, setSlotEl] = useState<HTMLDivElement | null>(null);

  const handleNav = (k: SectionKey) => {
    if (k === section) {
      // Same section clicked: toggle panel if available; otherwise no-op (avoid reload).
      if (SECTIONS_WITH_PANEL.has(k)) setPanelOpen((o) => !o);
      return;
    }
    setSection(k);
    setPanelOpen(SECTIONS_WITH_PANEL.has(k));
  };

  return (
    <V3rtexProvider>
      <SidebarSlotContext.Provider value={slotEl}>
        <div className="flex min-h-screen bg-background text-foreground">
          <Sidebar
            active={section}
            panelOpen={panelOpen}
            onNavClick={handleNav}
            onClosePanel={() => setPanelOpen(false)}
            setSlotEl={setSlotEl}
          />
          <main className="flex-1 p-8 overflow-x-hidden">
            {section === "overview" && <Overview />}
            {section === "files" && <FileWalker />}
            {section === "ast" && <ASTExtraction />}
            {section === "symbols" && <SymbolResolver />}
            {section === "calls" && <CallResolver />}
            {section === "graph" && <GraphInspector />}
            {section === "complexity" && <Complexity />}
            {section === "antipatterns" && <AntiPatterns />}
            {section === "viz" && <GraphVisualization />}
            {section === "api" && <APITester />}
          </main>
        </div>
      </SidebarSlotContext.Provider>
    </V3rtexProvider>
  );
}
