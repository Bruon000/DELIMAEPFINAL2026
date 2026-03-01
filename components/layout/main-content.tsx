"use client";

import { useSidebar } from "./sidebar-context";

export function MainContent({ children }: { children: React.ReactNode }) {
  const { width } = useSidebar();
  return (
    <main
      className="flex-1 transition-[margin-left] duration-200"
      style={{ marginLeft: width }}
    >
      {children}
    </main>
  );
}
