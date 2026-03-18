"use client";

import { useStudent } from "@/lib/queries/students";
import { useStudentAnalytics } from "@/lib/queries/analytics";
import { useStudentProgress } from "@/lib/queries/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MasterySpreadsheet } from "./mastery-spreadsheet";
import { MaterialManager } from "./material-manager";
import {
  ClipboardCheck,
  BookOpen,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus as MinusIcon,
} from "lucide-react";
import dynamic from "next/dynamic";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(
  () => import("recharts").then((m) => m.LineChart),
  { ssr: false }
);
const Line = dynamic(
  () => import("recharts").then((m) => m.Line),
  { ssr: false }
);
const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false }
);
const Bar = dynamic(
  () => import("recharts").then((m) => m.Bar),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((m) => m.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((m) => m.YAxis),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((m) => m.Tooltip),
  { ssr: false }
);
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false }
);

type Props = {
  studentId: string;
  spreadsheetActive: boolean;
  onEnterSpreadsheet: () => void;
  onEscapeSpreadsheet: () => void;
};

const ACTION_LABELS: Record<string, string> = {
  assign: "割当",
  remove: "解除",
  advance: "進行",
  manual_set: "手動",
  print: "印刷",
};

export function StudentDetailPanel({
  studentId,
  spreadsheetActive,
  onEnterSpreadsheet,
  onEscapeSpreadsheet,
}: Props) {
  const { data: student, isLoading } = useStudent(studentId);
  const { data: analytics } = useStudentAnalytics(studentId);
  const { data: progress } = useStudentProgress(studentId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg skeleton-pulse" />
        <div className="h-4 w-64 rounded-lg skeleton-pulse" />
        <div className="h-10 w-full rounded-lg skeleton-pulse" />
        <div className="h-64 rounded-xl skeleton-pulse" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        生徒が見つかりません
      </div>
    );
  }

  const avgPercent =
    student.materials.length > 0
      ? Math.round(
          student.materials.reduce((sum, m) => sum + m.percent, 0) /
            student.materials.length
        )
      : 0;

  return (
    <div className="space-y-4">
      {/* Student header */}
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-xl font-bold">{student.name}</h2>
          <p className="text-xs text-muted-foreground">
            ID: {student.id} · {student.materials.length}教材 · 平均進捗{" "}
            {avgPercent}%
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="mastery">
        <TabsList>
          <TabsTrigger value="mastery">
            <ClipboardCheck className="mr-1.5 h-4 w-4" />
            定着度入力
          </TabsTrigger>
          <TabsTrigger value="materials">
            <BookOpen className="mr-1.5 h-4 w-4" />
            教材管理
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-1.5 h-4 w-4" />
            分析
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Mastery Spreadsheet */}
        <TabsContent value="mastery">
          <MasterySpreadsheet
            student={student}
            active={spreadsheetActive}
            onActivate={onEnterSpreadsheet}
            onEscape={onEscapeSpreadsheet}
          />
        </TabsContent>

        {/* Tab 2: Material Management */}
        <TabsContent value="materials">
          <MaterialManager studentId={studentId} />
        </TabsContent>

        {/* Tab 3: Analytics */}
        <TabsContent value="analytics" className="space-y-4">
          {analytics ? (
            <>
              {/* Pace summary cards */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Card className="border-0 shadow-premium">
                  <CardContent className="pt-5">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {analytics.pace.nodes_per_week}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        範囲/週
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-premium">
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-center gap-2">
                      {analytics.pace.trend === "improving" ? (
                        <TrendingUp className="h-5 w-5 text-emerald-500" />
                      ) : analytics.pace.trend === "declining" ? (
                        <TrendingDown className="h-5 w-5 text-destructive" />
                      ) : (
                        <MinusIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">
                        {analytics.pace.trend === "improving"
                          ? "上昇中"
                          : analytics.pace.trend === "declining"
                          ? "低下中"
                          : "安定"}
                      </span>
                    </div>
                    <p className="text-center text-xs text-muted-foreground mt-1">
                      学習ペース
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-premium">
                  <CardContent className="pt-5">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{avgPercent}%</div>
                      <p className="text-xs text-muted-foreground">
                        平均進捗率
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Completion rates bar chart */}
              {analytics.completion_rates.length > 0 && (
                <Card className="border-0 shadow-premium overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-sm">教材別完了率</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={analytics.completion_rates}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(0 0% 91%)"
                        />
                        <XAxis
                          dataKey="material_name"
                          tick={{ fontSize: 11, fill: "hsl(0 0% 45%)" }}
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={50}
                        />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(0 0% 45%)" }} />
                        <Tooltip
                          formatter={(value) => [`${value}%`, "完了率"]}
                          contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", fontSize: "13px", padding: "10px 14px" }}
                        />
                        <Bar
                          dataKey="percent"
                          fill="url(#completion-gradient)"
                          radius={[6, 6, 0, 0]}
                        />
                        <defs>
                          <linearGradient id="completion-gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#dc2626" />
                            <stop offset="100%" stopColor="#f87171" />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Progress timeline */}
              {analytics.progress_timeline.length > 0 && (
                <Card className="border-0 shadow-premium overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-sm">進捗タイムライン</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart
                        data={analytics.progress_timeline.filter(
                          (e) => e.new_pointer != null
                        )}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(0 0% 91%)"
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: "hsl(0 0% 45%)" }}
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString("ja-JP", {
                              month: "short",
                              day: "numeric",
                            })
                          }
                        />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 45%)" }} />
                        <Tooltip
                          labelFormatter={(v) =>
                            new Date(v).toLocaleDateString("ja-JP")
                          }
                          formatter={(value, name) => [
                            value,
                            name === "new_pointer" ? "ポインタ" : String(name),
                          ]}
                          contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", fontSize: "13px", padding: "10px 14px" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="new_pointer"
                          stroke="#dc2626"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: "#dc2626" }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <BarChart3 className="mr-2 h-5 w-5 opacity-30" />
              <span className="text-sm">分析データを読み込み中...</span>
            </div>
          )}

          {/* Progress history */}
          {progress?.history && progress.history.length > 0 && (
            <Card className="border-0 shadow-premium overflow-hidden">
              <CardHeader>
                <CardTitle className="text-sm">進捗履歴</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {progress.history.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded border border-border p-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {ACTION_LABELS[entry.action] || entry.action}
                        </Badge>
                        <span>{entry.material_key}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {entry.old_pointer != null &&
                          entry.new_pointer != null && (
                            <span>
                              {entry.old_pointer} → {entry.new_pointer}
                            </span>
                          )}
                        <span>
                          {new Date(entry.created_at).toLocaleString("ja-JP")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
