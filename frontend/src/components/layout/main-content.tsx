"use client";

import { useSidebar } from "@/providers/sidebar-provider";
import { cn } from "@/lib/utils";

export function MainContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <main
      className={cn(
        "flex-1 gradient-mesh min-h-screen transition-[margin] duration-300",
        collapsed ? "ml-[68px]" : "ml-[280px]"
      )}
    >
      <div className="mx-auto max-w-7xl px-8 py-8 page-enter">{children}</div>
    </main>
  );
}
