import { createContext, useContext } from "react";

export const SidebarSlotContext = createContext<HTMLElement | null>(null);
export const useSidebarSlot = () => useContext(SidebarSlotContext);
