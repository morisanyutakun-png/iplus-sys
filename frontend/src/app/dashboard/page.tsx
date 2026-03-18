"use client";

import { useDashboard } from "@/lib/queries/progress";
import { useStudents } from "@/lib/queries/students";
import { useAutoQueue } from "@/lib/queries/auto-print";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, BookOpen, Zap, Printer, AlertTriangle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import dynamic from "next/dynamic";

const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });

const COLORS = ["#dc2626", "#991b1b", "#ef4444", "#b91c1c", "#7f1d1d", "#f87171", "#450a0a", "#fca5a5"];

const ACTION_LABELS: Record<string, string> = {
  assign: "教材割当",
  remove: "教材解除",
  advance: "進行",
  manual_set: "手動設定",
  print: "印刷実行",
};

function StatCard({ title, value, subtitle, icon: Icon, gradient }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}) {
  return (
    <Card className="card-hover stat-card border-0 shadow-premium overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${gradient}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const color =
    percent >= 90 ? "bg-emerald-500" :
    percent >= 50 ? "bg-blue-500" :
    percent > 0 ? "bg-amber-500" :
    "bg-gray-300";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full max-w-[100px] rounded-full bg-muted/60">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums w-10 text-right">{Math.round(percent)}%</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-lg skeleton-pulse" />
        <div className="h-4 w-64 rounded-lg skeleton-pulse" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-2xl skeleton-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboard();
  const { data: students, isLoading: studentsLoading } = useStudents();
  const autoQueueMutation = useAutoQueue();

  const handleAutoQueueAll = () => {
    autoQueueMutation.mutate(undefined, {
      onSuccess: (data) =>
        toast.success(
          `${data.students}名の生徒から${data.queued}件をキューに追加しました`
        ),
      onError: (err) => toast.error(`エラー: ${err.message}`),
    });
  };

  if (statsLoading || studentsLoading) return <LoadingSkeleton />;

  // Bar chart data: student progress sorted by avg_percent
  const studentChartData = (stats?.student_progress || [])
    .map((s) => ({ name: s.student_name, percent: s.avg_percent }))
    .sort((a, b) => b.percent - a.percent);

  // Pie chart data: material enrollment counts
  const materialCounts: Record<string, number> = {};
  (students || []).forEach((s) => {
    s.materials.forEach((m) => {
      materialCounts[m.material_name] = (materialCounts[m.material_name] || 0) + 1;
    });
  });
  const pieData = Object.entries(materialCounts).map(([name, value]) => ({ name, value }));

  // Collect all unique material names for table header
  const allMaterials = new Map<string, string>();
  (stats?.student_progress || []).forEach((sp) => {
    sp.materials.forEach((m) => {
      if (!allMaterials.has(m.material_key)) {
        allMaterials.set(m.material_key, m.material_name);
      }
    });
  });
  const materialList = Array.from(allMaterials.entries());

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ダッシュボード</h1>
          <p className="mt-1 text-muted-foreground">進捗状況とリマインド</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleAutoQueueAll}
            disabled={autoQueueMutation.isPending}
          >
            <Zap className="mr-2 h-4 w-4" />
            {autoQueueMutation.isPending ? "処理中..." : "全生徒の次回分をキューに追加"}
          </Button>
          <Link href="/print">
            <Button size="sm" variant="default">
              <Printer className="mr-2 h-4 w-4" />
              印刷ページへ
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard title="生徒数" value={stats?.total_students || 0} subtitle="登録済み生徒" icon={Users} gradient="bg-gradient-to-br from-red-600 to-red-800" />
        <StatCard title="教材数" value={stats?.total_materials || 0} subtitle="登録済み教材" icon={BookOpen} gradient="bg-gradient-to-br from-gray-800 to-black" />
        <StatCard title="今週の学習" value={stats?.weekly_actions || 0} subtitle="advance + print アクション" icon={Zap} gradient="bg-gradient-to-br from-red-500 to-red-700" />
      </div>

      {/* Nearly Complete Reminder */}
      {(stats?.nearly_complete || []).length > 0 && (
        <Card className="border-0 shadow-premium overflow-hidden border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base font-semibold">完了間近リマインド</CardTitle>
              <Badge variant="secondary" className="rounded-full ml-auto">{stats!.nearly_complete.length} 件</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">残り1〜2ノードで教材が完了する生徒です。次の教材割当を検討してください。</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats!.nearly_complete.map((item, idx) => (
                <div key={`${item.student_id}-${item.material_key}`} className="stagger-item flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30 p-3.5 transition-colors hover:bg-amber-100/60 dark:hover:bg-amber-950/50" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{item.student_name}</span>
                    <span className="text-sm text-muted-foreground">{item.material_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-amber-100 dark:bg-amber-900 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                      残り {item.remaining} ノード
                    </span>
                    <span className="text-xs font-medium tabular-nums">
                      {item.pointer}/{item.total_nodes} ({Math.round(item.pointer / item.total_nodes * 100)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row: Student Progress Bar + Weekly Activity Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-premium overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">生徒別 平均進捗率</CardTitle>
            <p className="text-xs text-muted-foreground">各生徒の全教材平均（進捗率順）</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={studentChartData} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 91%)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} unit="%" fontSize={11} tick={{ fill: "hsl(0 0% 45%)" }} />
                <YAxis type="category" dataKey="name" fontSize={12} tick={{ fill: "hsl(0 0% 35%)" }} width={60} />
                <Tooltip formatter={(v) => [`${v}%`, "進捗率"]} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", fontSize: "13px" }} />
                <Bar dataKey="percent" fill="url(#bar-gradient)" radius={[0, 6, 6, 0]} barSize={20} />
                <defs>
                  <linearGradient id="bar-gradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#991b1b" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-premium overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">週間アクティビティ推移</CardTitle>
            <p className="text-xs text-muted-foreground">過去8週間の学習アクション数</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={stats?.weekly_trend || []} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 91%)" />
                <XAxis dataKey="week" fontSize={11} tick={{ fill: "hsl(0 0% 45%)" }} />
                <YAxis fontSize={11} tick={{ fill: "hsl(0 0% 45%)" }} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} 件`, "アクション"]} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", fontSize: "13px" }} />
                <Area type="monotone" dataKey="actions" stroke="#dc2626" fill="url(#area-gradient)" strokeWidth={2} />
                <defs>
                  <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#dc2626" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Student x Material Progress Table */}
      {(stats?.student_progress || []).length > 0 && materialList.length > 0 && (
        <Card className="border-0 shadow-premium overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">生徒 x 教材 進捗一覧</CardTitle>
            <p className="text-xs text-muted-foreground">各生徒の教材ごとの進捗状況</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="py-2 px-3 text-left font-semibold text-muted-foreground">生徒名</th>
                    {materialList.map(([key, name]) => (
                      <th key={key} className="py-2 px-3 text-left font-semibold text-muted-foreground max-w-[140px] truncate" title={name}>{name}</th>
                    ))}
                    <th className="py-2 px-3 text-left font-semibold text-muted-foreground">平均</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.student_progress || [])
                    .sort((a, b) => b.avg_percent - a.avg_percent)
                    .map((sp) => {
                      const matMap = new Map(sp.materials.map((m) => [m.material_key, m]));
                      return (
                        <tr key={sp.student_id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 font-medium">{sp.student_name}</td>
                          {materialList.map(([key]) => {
                            const mat = matMap.get(key);
                            return (
                              <td key={key} className="py-2.5 px-3">
                                {mat ? <ProgressBar percent={mat.percent} /> : <span className="text-xs text-muted-foreground">-</span>}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-3">
                            <span className="text-sm font-semibold tabular-nums">{sp.avg_percent}%</span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pie Chart: Material Enrollment */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-premium overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">教材別 受講者数</CardTitle>
            <p className="text-xs text-muted-foreground">教材ごとの生徒割当数</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} dataKey="value" paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", fontSize: "13px" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Empty space or future chart slot */}
        <div />
      </div>

      {/* Recent Activity */}
      <Card className="border-0 shadow-premium overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">最近のアクティビティ</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">直近の操作履歴</p>
            </div>
            <Badge variant="secondary" className="rounded-full">{stats?.recent_activity?.length || 0} 件</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(stats?.recent_activity || []).slice(0, 10).map((entry, idx) => (
              <div key={entry.id} className="stagger-item flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-3.5 transition-colors hover:bg-muted/60" style={{ animationDelay: `${idx * 50}ms` }}>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="rounded-full text-xs">{ACTION_LABELS[entry.action] || entry.action}</Badge>
                  <span className="text-sm font-medium">{entry.student_id}</span>
                  <span className="text-sm text-muted-foreground">{entry.material_key}</span>
                </div>
                <div className="flex items-center gap-3">
                  {entry.old_pointer != null && entry.new_pointer != null && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{entry.old_pointer} → {entry.new_pointer}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString("ja-JP")}</span>
                </div>
              </div>
            ))}
            {(!stats?.recent_activity || stats.recent_activity.length === 0) && (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <TrendingUp className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">アクティビティはまだありません</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
