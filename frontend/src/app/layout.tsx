import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { QueryProvider } from "@/providers/query-provider";
import { SidebarProvider } from "@/providers/sidebar-provider";
import { MainContent } from "@/components/layout/main-content";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "iPlus Sys - 教材管理システム",
  description: "塾向け教材印刷・定着度管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <SidebarProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <MainContent>{children}</MainContent>
            </div>
          </SidebarProvider>
          <Toaster richColors position="top-right" />
        </QueryProvider>
      </body>
    </html>
  );
}
