"use client";

import { useDashboard, useAcknowledgeReminder, useUnacknowledgeReminder, useAcknowledgeLowAccuracy, useUnacknowledgeLowAccuracy } from "@/lib/queries/progress";
import { useStudents } from "@/lib/queries/students";
import { useAutoQueue } from "@/lib/queries/auto-print";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, BookOpen, Zap, Printer, AlertTriangle, TrendingUp, TrendingDown, ExternalLink, BarChart3, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import dynamic from "next/dynamic";

const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });

const COLORS = ["#dc2626", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

const TOOLTIP_STYLE = {
  borderRadius: "12px",
  border: "none",
  boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
  fontSize: "13px",
  padding: "10px 14px",
};

// Avatar color palette derived from name hash
const AVATAR_COLORS = [
  "from-rose-500 to-red-600",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-green-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-teal-600",
];

function nameToColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function CircularProgress({ percent, size = 44 }: { percent: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  const color = percent >= 90 ? "#10b981" : percent >= 70 ? "#f59e0b" : "#dc2626";

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/40" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        className="fill-foreground rotate-90 origin-center"
        fontSize={size * 0.24} fontWeight={600}
      >
        {Math.round(percent)}%
      </text>
    </svg>
  );
}

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
      <div className="h-48 rounded-2xl skeleton-pulse" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-2xl skeleton-pulse" />
        <div className="h-80 rounded-2xl skeleton-pulse" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboard();
  const { data: students, isLoading: studentsLoading } = useStudents();
  const autoQueueMutation = useAutoQueue();
  const ackMutation = useAcknowledgeReminder();
  const unackMutation = useUnacknowledgeReminder();
  const laAckMutation = useAcknowledgeLowAccuracy();
  const laUnackMutation = useUnacknowledgeLowAccuracy();

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

      {/* Nearly Complete Reminder - Redesigned */}
      {(stats?.nearly_complete || []).length > 0 && (
        <Card className="border-0 shadow-premium overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500" />
          <CardHeader className="pb-3 pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
                <AlertTriangle className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base font-semibold">完了間近リマインド</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">残り1〜2ノードで教材が完了する生徒です</p>
              </div>
              <Badge variant="secondary" className="rounded-full text-xs font-semibold">{stats!.nearly_complete.length} 件</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {stats!.nearly_complete.map((item, idx) => {
                const pct = Math.round(((item.pointer - 1) / item.total_nodes) * 100);
                return (
                  <div
                    key={`${item.student_id}-${item.material_key}`}
                    className={cn(
                      "stagger-item group flex items-center gap-4 rounded-xl border border-border/60 bg-card p-3.5 transition-all hover:shadow-md hover:border-amber-300/60",
                      item.acknowledged && "opacity-50"
                    )}
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    {/* Acknowledge checkbox */}
                    <button
                      type="button"
                      className="shrink-0 transition-colors"
                      onClick={() => {
                        if (item.acknowledged) {
                          unackMutation.mutate({ student_id: item.student_id, material_key: item.material_key });
                        } else {
                          ackMutation.mutate({ student_id: item.student_id, material_key: item.material_key });
                        }
                      }}
                      title={item.acknowledged ? "対処済みを取消" : "対処済みにする"}
                    >
                      {item.acknowledged ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40 hover:text-muted-foreground" />
                      )}
                    </button>

                    {/* Avatar */}
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${nameToColor(item.student_name)} text-white text-sm font-bold shadow-sm`}>
                      {item.student_name.charAt(0)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-semibold truncate", item.acknowledged && "line-through")}>{item.student_name}</span>
                        <span className="text-xs text-muted-foreground truncate">{item.material_name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          残り {item.remaining}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {item.pointer} / {item.total_nodes}
                        </span>
                      </div>
                    </div>

                    {/* Circular Progress */}
                    <CircularProgress percent={pct} size={44} />

                    {/* Action */}
                    <Link href={`/students?student=${item.student_id}&tab=materials`}>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Low Accuracy Reminder */}
      {(stats?.low_accuracy || []).length > 0 && (
        <Card className="border-0 shadow-premium overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 via-red-500 to-rose-500" />
          <CardHeader className="pb-3 pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-400 to-rose-500 shadow-sm">
                <TrendingDown className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base font-semibold">正答率低下リマインド</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">2回以上連続60%未満の生徒です</p>
              </div>
              <Badge variant="secondary" className="rounded-full text-xs font-semibold">{stats!.low_accuracy.length} 件</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {stats!.low_accuracy.map((item, idx) => (
                <div
                  key={`${item.student_id}-${item.material_key}-${item.node_key}`}
                  className={cn(
                    "stagger-item group flex items-center gap-4 rounded-xl border border-border/60 bg-card p-3.5 transition-all hover:shadow-md hover:border-red-300/60",
                    item.acknowledged && "opacity-50"
                  )}
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  {/* Acknowledge checkbox */}
                  <button
                    type="button"
                    className="shrink-0 transition-colors"
                    onClick={() => {
                      if (item.acknowledged) {
                        laUnackMutation.mutate({ student_id: item.student_id, material_key: item.material_key, node_key: item.node_key });
                      } else {
                        laAckMutation.mutate({ student_id: item.student_id, material_key: item.material_key, node_key: item.node_key });
                      }
                    }}
                    title={item.acknowledged ? "対処済みを取消" : "対処済みにする"}
                  >
                    {item.acknowledged ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40 hover:text-muted-foreground" />
                    )}
                  </button>

                  {/* Avatar */}
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${nameToColor(item.student_name)} text-white text-sm font-bold shadow-sm`}>
                    {item.student_name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-semibold truncate", item.acknowledged && "line-through")}>{item.student_name}</span>
                      <span className="text-xs text-muted-foreground truncate">{item.material_name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="rounded-full bg-red-100 dark:bg-red-900/50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300">
                        {item.node_title || item.node_key}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {item.streak}回連続6割未満
                        {item.latest_rates.length > 0 && ` (直近: ${Math.round(item.latest_rates[0] * 100)}%)`}
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  <Link href={`/students?student=${item.student_id}&tab=mastery`}>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
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
            {studentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={studentChartData} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 91%)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} unit="%" fontSize={11} tick={{ fill: "hsl(0 0% 45%)" }} />
                  <YAxis type="category" dataKey="name" fontSize={12} tick={{ fill: "hsl(0 0% 35%)" }} width={60} />
                  <Tooltip formatter={(v) => [`${v}%`, "進捗率"]} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="percent" fill="url(#bar-gradient)" radius={[0, 6, 6, 0]} barSize={20} />
                  <defs>
                    <linearGradient id="bar-gradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#1e40af" />
                      <stop offset="100%" stopColor="#3b82f6" />
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

        <Card className="border-0 shadow-premium overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">週間アクティビティ推移</CardTitle>
            <p className="text-xs text-muted-foreground">過去8週間の学習アクション数</p>
          </CardHeader>
          <CardContent>
            {(stats?.weekly_trend || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={stats?.weekly_trend || []} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 91%)" />
                  <XAxis dataKey="week" fontSize={11} tick={{ fill: "hsl(0 0% 45%)" }} />
                  <YAxis fontSize={11} tick={{ fill: "hsl(0 0% 45%)" }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} 件`, "アクション"]} contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="actions" stroke="#dc2626" fill="url(#area-gradient)" strokeWidth={2.5} />
                  <defs>
                    <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#dc2626" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center py-16 text-muted-foreground">
                <TrendingUp className="mb-3 h-10 w-10 opacity-20" />
                <p className="text-sm">データがありません</p>
              </div>
            )}
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

      {/* Pie Chart + Quick Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-premium overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">教材別 受講者数</CardTitle>
            <p className="text-xs text-muted-foreground">教材ごとの生徒割当数</p>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} dataKey="value" paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center py-16 text-muted-foreground">
                <BookOpen className="mb-3 h-10 w-10 opacity-20" />
                <p className="text-sm">教材の割当がありません</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Summary Card */}
        <Card className="border-0 shadow-premium overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">クイックサマリー</CardTitle>
            <p className="text-xs text-muted-foreground">現在のシステム状況</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600">
                    <Users className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">アクティブ生徒</p>
                    <p className="text-xs text-muted-foreground">教材割当済み</p>
                  </div>
                </div>
                <span className="text-2xl font-bold tabular-nums">{(students || []).filter(s => s.materials.length > 0).length}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
                    <AlertTriangle className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">完了間近</p>
                    <p className="text-xs text-muted-foreground">次の教材割当が必要</p>
                  </div>
                </div>
                <span className="text-2xl font-bold tabular-nums">{stats?.nearly_complete?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                    <TrendingUp className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">全体平均進捗</p>
                    <p className="text-xs text-muted-foreground">全生徒の平均</p>
                  </div>
                </div>
                <span className="text-2xl font-bold tabular-nums">
                  {studentChartData.length > 0
                    ? Math.round(studentChartData.reduce((s, d) => s + d.percent, 0) / studentChartData.length)
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
