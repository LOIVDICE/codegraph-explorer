import { useEffect, useState } from "react";

export type PageKey =
  | "overview" | "files" | "ast" | "symbols" | "calls"
  | "graph" | "complexity" | "antipatterns" | "viz" | "api";

export type PageDef = {
  key: PageKey;
  label: string;
  endpoint: string;
  /** Whether the backend actually serves the data this page needs. */
  available: boolean;
};

export const PAGES: PageDef[] = [
  { key: "overview", label: "Overview", endpoint: "/dashboard/summary", available: false },
  { key: "files", label: "File Walker", endpoint: "/files", available: true },
  { key: "ast", label: "AST Extraction", endpoint: "/files/{id}", available: true },
  { key: "symbols", label: "Symbol Resolver", endpoint: "/symbols", available: true },
  { key: "calls", label: "Call Resolver", endpoint: "/calls", available: true },
  { key: "graph", label: "Graph Inspector", endpoint: "/analysis/structural-graph", available: false },
  { key: "complexity", label: "Complexity", endpoint: "/dashboard/summary", available: false },
  { key: "antipatterns", label: "Anti-Patterns", endpoint: "/analysis/quality-reports", available: false },
  { key: "viz", label: "Graph Viz", endpoint: "/files + /nodes + /symbols + /calls", available: true },
  { key: "api", label: "API Tester", endpoint: "any endpoint", available: true },
];

export type EnabledMap = Record<PageKey, boolean>;

const STORAGE_KEY = "v3rtex.enabledPages";

export function defaultEnabled(): EnabledMap {
  return Object.fromEntries(PAGES.map((p) => [p.key, p.available])) as EnabledMap;
}

function load(): EnabledMap {
  const defaults = defaultEnabled();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as Partial<EnabledMap>;
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

export function usePageSettings() {
  const [enabled, setEnabled] = useState<EnabledMap>(defaultEnabled);

  // localStorage is only readable on the client
  useEffect(() => { setEnabled(load()); }, []);

  const persist = (next: EnabledMap) => {
    setEnabled(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  return {
    enabled,
    toggle: (key: PageKey) => persist({ ...enabled, [key]: !enabled[key] }),
    reset: () => persist(defaultEnabled()),
  };
}
