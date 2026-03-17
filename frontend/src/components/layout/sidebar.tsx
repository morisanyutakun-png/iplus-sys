"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Printer,
  BarChart3,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard, description: "概要とクイックアクション" },
  { href: "/students", label: "生徒", icon: Users, description: "生徒の進捗・印刷・分析" },
  { href: "/scoring", label: "定着度入力", icon: Table2, description: "Excel風の採点・合否入力" },
  { href: "/materials", label: "教材管理", icon: BookOpen, description: "教材とノード" },
  { href: "/print", label: "印刷", icon: Printer, description: "キュー・ジョブ・ログ" },
  { href: "/analytics", label: "分析", icon: BarChart3, description: "全体分析・比較" },
];

function IPlusLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="oklch(0.55 0.22 25)" />
          <stop offset="1" stopColor="oklch(0.3 0.08 20)" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="url(#logo-gradient)" />
      <text x="7" y="25" fontFamily="system-ui, -apple-system, sans-serif" fontSize="16" fontWeight="700" fill="white" letterSpacing="-0.5">
        i+
      </text>
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[280px] flex-col border-r border-sidebar-border glass">
      {/* Logo */}
      <div className="flex h-[72px] items-center gap-3 border-b border-sidebar-border px-6">
        <IPlusLogo />
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            <span className="bg-gradient-to-r from-[oklch(0.55_0.22_25)] to-[oklch(0.3_0.08_20)] bg-clip-text text-transparent">
              iPlus
            </span>
            <span className="ml-1 text-foreground/80">Sys</span>
          </h1>
          <p className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground">
            Education Platform
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        <p className="mb-3 px-3 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70">
          メニュー
        </p>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-premium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                  isActive
                    ? "bg-white/20"
                    : "bg-muted group-hover:bg-accent"
                )}
              >
                <item.icon className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="leading-tight">{item.label}</span>
                {!isActive && (
                  <span className="text-[10px] text-muted-foreground/60 leading-tight">
                    {item.description}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 p-3">
          <p className="text-xs font-semibold text-foreground">iPlus Sys v2.0</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">教材管理システム</p>
        </div>
      </div>
    </aside>
  );
}
