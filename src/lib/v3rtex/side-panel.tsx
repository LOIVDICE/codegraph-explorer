import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Pages whose nav item slides the sidebar to a page-specific panel.
 * Every other page keeps the plain menu — no sliding.
 */
export const PANEL_PAGES = new Set<string>(["ast", "viz"]);

/**
 * Portal target inside the sidebar's sliding panel. Provided by the
 * dashboard once the sidebar is mounted (null during SSR / first paint).
 */
export const SidePanelContext = createContext<HTMLElement | null>(null);

/**
 * Renders children into the sidebar's sliding panel. State stays in the
 * page component; the sidebar only hosts the DOM node.
 */
export function SidePanel({ children }: { children: ReactNode }) {
  const el = useContext(SidePanelContext);
  if (!el) return null;
  return createPortal(children, el);
}
