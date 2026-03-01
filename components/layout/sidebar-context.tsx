"use client";

import * as React from "react";

type SidebarContext = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  width: number;
};

const Context = React.createContext<SidebarContext | null>(null);

export function SidebarProvider({
  children,
  defaultCollapsed = false,
}: {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const width = collapsed ? 64 : 260;
  const value = React.useMemo(
    () => ({ collapsed, setCollapsed, width }),
    [collapsed]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSidebar() {
  const ctx = React.useContext(Context);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
