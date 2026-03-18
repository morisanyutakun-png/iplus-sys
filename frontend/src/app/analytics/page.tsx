"use client";

import { useOverviewAnalytics } from "@/lib/queries/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import dynamic from "next/dynamic";

const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
import { Trophy, BookOpen, Activity, BarChart3 } from "lucide-react";
import Link from "next/link";

const TOOLTIP_STYLE = {
  borderRadius: "12px",
  border: "none",
  boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
  fontSize: "13px",
  padding: "10px 14px",
};

function heatmapColor(pct: number): string {
  // Continuous HSL gradient: 0% = red (0°), 100% = green (120°)
  const hue = Math.round(pct * 1.2);
  return `hsl(${hue}, 65%, 45%)`;
}

function percentBadgeColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300";
  if (pct >= 50) return "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300";
  if (pct >= 20) return "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300";
}

export default function AnalyticsPage() {
  const { data: analytics, isLoading } = useOverviewAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg skeleton-pulse" />
          <div className="h-4 w-64 rounded-lg skeleton-pulse" />
        </div>
        <div className="h-64 rounded-2xl skeleton-pulse" />
        <div className="h-64 rounded-2xl skeleton-pulse" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-80 rounded-2xl skeleton-pulse" />
          <div className="h-80 rounded-2xl skeleton-pulse" />
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  // Build heatmap: rows = students, cols = materials
  const studentIds = [
    ...new Set(analytics.completion_heatmap.map((h) => h.student_id)),
  ];
  const materialKeys = [
    ...new Set(analytics.completion_heatmap.map((h) => h.material_key)),
  ];
  const heatmapLookup = new Map(
    analytics.completion_heatmap.map((h) => [
      `${h.student_id}_${h.material_key}`,
      h,
    ])
  );
  const materialNames = new Map(
    analytics.completion_heatmap.map((h) => [h.material_key, h.material_name])
  );
  const studentNames = new Map(
    analytics.completion_heatmap.map((h) => [h.student_id, h.student_name])
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">分析</h1>
        <p className="mt-1 text-muted-foreground">
          全体の学習状況を把握・比較
        </p>
      </div>

      {/* Student Rankings */}
      <Card className="border-0 shadow-premium overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-amber-500" />
            生徒ランキング（平均進捗率順）
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {analytics.student_rankings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-12 text-xs font-semibold uppercase tracking-wider">
                    順位
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">
                    生徒名
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">
                    平均進捗率
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">
                    完了範囲数
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.student_rankings.map((r, idx) => (
                  <TableRow key={r.student_id} className="transition-colors">
                    <TableCell className="font-bold text-muted-foreground">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/students?id=${r.student_id}`}
                        className="font-medium hover:underline"
                      >
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-28 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
                            style={{ width: `${Math.min(r.avg_percent, 100)}%` }}
                          />
                        </div>
                        <Badge className={`rounded-full text-[10px] font-semibold ${percentBadgeColor(r.avg_percent)}`}>
                          {r.avg_percent}%
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium tabular-nums">{r.total_nodes_completed}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <Trophy className="mb-3 h-10 w-10 opacity-20" />
              <p className="text-sm">ランキングデータがありません</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completion Heatmap */}
      {studentIds.length > 0 && materialKeys.length > 0 && (
        <Card className="border-0 shadow-premium overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-blue-500" />
              教材完了ヒートマップ
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider sticky left-0 bg-muted/30 z-10">
                    生徒
                  </TableHead>
                  {materialKeys.map((mk) => (
                    <TableHead
                      key={mk}
                      className="text-xs font-semibold text-center min-w-[80px]"
                    >
                      {materialNames.get(mk) || mk}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentIds.map((sid) => (
                  <TableRow key={sid}>
                    <TableCell className="font-medium sticky left-0 bg-background z-10">
                      <Link
                        href={`/students?id=${sid}`}
                        className="hover:underline"
                      >
                        {studentNames.get(sid) || sid}
                      </Link>
                    </TableCell>
                    {materialKeys.map((mk) => {
                      const entry = heatmapLookup.get(`${sid}_${mk}`);
                      const pct = entry?.percent ?? 0;
                      return (
                        <TableCell key={mk} className="text-center p-1">
                          <div
                            className="mx-auto flex h-9 w-full items-center justify-center rounded-lg text-xs font-semibold text-white transition-all"
                            style={{ backgroundColor: heatmapColor(pct) }}
                          >
                            {pct}%
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Material Difficulty */}
        <Card className="border-0 shadow-premium overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-violet-500" />
              教材別分析
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.material_difficulty.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.material_difficulty}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 91%)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "hsl(0 0% 45%)" }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(0 0% 45%)" }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar
                    dataKey="avg_pace"
                    fill="url(#difficulty-gradient)"
                    name="平均ペース"
                    radius={[6, 6, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="difficulty-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center py-16 text-muted-foreground">
                <BarChart3 className="mb-3 h-10 w-10 opacity-20" />
                <p className="text-sm">データがありません</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Activity */}
        <Card className="border-0 shadow-premium overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-cyan-500" />
              週次アクティビティ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.weekly_activity.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.weekly_activity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 91%)" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(0 0% 45%)" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(0 0% 45%)" }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend verticalAlign="top" height={36} iconType="circle" formatter={(value) => <span className="text-xs">{value}</span>} />
                  <Line
                    type="monotone"
                    dataKey="prints_count"
                    stroke="#dc2626"
                    strokeWidth={2.5}
                    name="印刷"
                    dot={{ r: 3, fill: "#dc2626" }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="records_count"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    name="記録"
                    dot={{ r: 3, fill: "#2563eb" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center py-16 text-muted-foreground">
                <Activity className="mb-3 h-10 w-10 opacity-20" />
                <p className="text-sm">データがありません</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
