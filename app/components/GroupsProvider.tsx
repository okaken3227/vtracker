"use client";

import { createContext, useContext } from "react";

export type SidebarGroup = { id: string; name: string; color: string; icon_url?: string | null };

const GroupsContext = createContext<SidebarGroup[]>([]);

export function GroupsProvider({
  groups,
  children,
}: {
  groups: SidebarGroup[];
  children: React.ReactNode;
}) {
  return <GroupsContext.Provider value={groups}>{children}</GroupsContext.Provider>;
}

export function useGroups() {
  return useContext(GroupsContext);
}
