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
import { Trophy, BookOpen, Activity } from "lucide-react";
import Link from "next/link";

function percentColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  if (pct >= 20) return "bg-orange-500";
  return "bg-red-500";
}

export default function AnalyticsPage() {
  const { data: analytics, isLoading } = useOverviewAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 rounded-lg skeleton-pulse" />
        <div className="h-64 rounded-2xl skeleton-pulse" />
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
            <Trophy className="h-4 w-4" />
            生徒ランキング（平均進捗率順）
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                  完了ノード数
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.student_rankings.map((r, idx) => (
                <TableRow key={r.student_id}>
                  <TableCell className="font-bold text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/students/${r.student_id}`}
                      className="font-medium hover:underline"
                    >
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${percentColor(r.avg_percent)}`}
                          style={{ width: `${Math.min(r.avg_percent, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {r.avg_percent}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{r.total_nodes_completed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Completion Heatmap */}
      {studentIds.length > 0 && materialKeys.length > 0 && (
        <Card className="border-0 shadow-premium overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
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
                        href={`/students/${sid}`}
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
                            className={`mx-auto flex h-8 w-full items-center justify-center rounded text-xs font-medium text-white ${percentColor(pct)}`}
                            style={{ opacity: Math.max(0.3, pct / 100) }}
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
        {analytics.material_difficulty.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4" />
                教材別分析
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.material_difficulty}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar
                    dataKey="avg_pace"
                    fill="oklch(0.5 0.2 25)"
                    name="平均ペース"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Weekly Activity */}
        {analytics.weekly_activity.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                週次アクティビティ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.weekly_activity}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="prints_count"
                    stroke="oklch(0.5 0.2 25)"
                    strokeWidth={2}
                    name="印刷"
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="records_count"
                    stroke="oklch(0.35 0.05 25)"
                    strokeWidth={2}
                    name="記録"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
