import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getHealth, getGraph, getStats, getAntipatterns, type GraphPayload } from "./api";

type Status = "connecting" | "connected" | "disconnected";

type Ctx = {
  status: Status;
  retry: () => void;
  graph: GraphPayload | null;
  graphLoading: boolean;
  graphError: string | null;
  refreshGraph: () => void;
  graphUpdated: number;
  stats: Record<string, unknown> | null;
  statsLoading: boolean;
  statsError: string | null;
  refreshStats: () => void;
  statsUpdated: number;
  antipatterns: Record<string, unknown> | null;
  antipatternsLoading: boolean;
  antipatternsError: string | null;
  refreshAntipatterns: () => void;
  antipatternsUpdated: number;
};

const C = createContext<Ctx | null>(null);

export function V3rtexProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("connecting");
  const [tick, setTick] = useState(0);

  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [graphLoading, setGL] = useState(false);
  const [graphError, setGE] = useState<string | null>(null);
  const [graphUpdated, setGU] = useState(0);

  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [statsLoading, setSL] = useState(false);
  const [statsError, setSE] = useState<string | null>(null);
  const [statsUpdated, setSU] = useState(0);

  const [antipatterns, setAP] = useState<Record<string, unknown> | null>(null);
  const [apLoading, setAPL] = useState(false);
  const [apError, setAPE] = useState<string | null>(null);
  const [apUpdated, setAPU] = useState(0);

  // health polling
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const r = await getHealth();
        if (!cancelled) setStatus(r.status >= 200 && r.status < 500 ? "connected" : "disconnected");
      } catch {
        if (!cancelled) setStatus("disconnected");
      }
    };
    check();
    const i = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(i); };
  }, [tick]);

  const refreshGraph = () => {
    setGL(true); setGE(null);
    getGraph().then(r => {
      if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
      setGraph(r.data); setGU(Date.now());
    }).catch(e => setGE(e.message ?? String(e))).finally(() => setGL(false));
  };
  const refreshStats = () => {
    setSL(true); setSE(null);
    getStats().then(r => {
      if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
      setStats(r.data); setSU(Date.now());
    }).catch(e => setSE(e.message ?? String(e))).finally(() => setSL(false));
  };
  const refreshAntipatterns = () => {
    setAPL(true); setAPE(null);
    getAntipatterns().then(r => {
      if (r.status >= 400) throw new Error(`HTTP ${r.status}`);
      setAP(r.data); setAPU(Date.now());
    }).catch(e => setAPE(e.message ?? String(e))).finally(() => setAPL(false));
  };

  // initial fetch when connected
  useEffect(() => {
    if (status === "connected" && !graph && !graphLoading && !graphError) refreshGraph();
    if (status === "connected" && !stats && !statsLoading && !statsError) refreshStats();
    if (status === "connected" && !antipatterns && !apLoading && !apError) refreshAntipatterns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <C.Provider value={{
      status, retry: () => setTick(t => t + 1),
      graph, graphLoading, graphError, refreshGraph, graphUpdated,
      stats, statsLoading, statsError, refreshStats, statsUpdated,
      antipatterns, antipatternsLoading: apLoading, antipatternsError: apError, refreshAntipatterns, antipatternsUpdated: apUpdated,
    }}>{children}</C.Provider>
  );
}

export function useV3rtex() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useV3rtex outside provider");
  return ctx;
}
