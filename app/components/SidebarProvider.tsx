"use client";

import { createContext, useContext, useState } from "react";

type SidebarCtx = { open: boolean; toggle: () => void };
const Ctx = createContext<SidebarCtx>({ open: true, toggle: () => {} });

export function useSidebar() {
  return useContext(Ctx);
}

export default function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Ctx.Provider value={{ open, toggle: () => setOpen((v) => !v) }}>
      {children}
    </Ctx.Provider>
  );
}
