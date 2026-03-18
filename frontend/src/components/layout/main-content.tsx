"use client";

import { useSidebar } from "@/providers/sidebar-provider";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  const pathname = usePathname();

  return (
    <main
      className={cn(
        "flex-1 gradient-mesh min-h-screen transition-[margin] duration-300",
        collapsed ? "ml-[68px]" : "ml-[280px]"
      )}
    >
      <div key={pathname} className="mx-auto max-w-7xl px-8 py-8 page-enter">{children}</div>
    </main>
  );
}
