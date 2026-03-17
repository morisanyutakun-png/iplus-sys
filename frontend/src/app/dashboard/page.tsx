"use client";

import { useDashboard } from "@/lib/queries/progress";
import { useStudents } from "@/lib/queries/students";
import { useAutoQueue } from "@/lib/queries/auto-print";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, BookOpen, TrendingUp, Zap, Printer } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#f97316", "#eab308"];

const ACTION_LABELS: Record<string, string> = {
  assign: "教材割当",
  remove: "教材解除",
  advance: "進行",
  manual_set: "手動設定",
  print: "印刷実行",
};

function ProgressRing({ value, size = 56, strokeWidth = 5 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/40" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="url(#ring-gradient)" strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" style={{ animation: "progress-fill 1s ease-out" }} />
      <defs>
        <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
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

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-lg skeleton-pulse" />
        <div className="h-4 w-64 rounded-lg skeleton-pulse" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
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

  const studentChartData = (students || []).map((s) => {
    const totalPercent = s.materials.length > 0
      ? s.materials.reduce((acc, m) => acc + m.percent, 0) / s.materials.length : 0;
    return { name: s.name, percent: Math.round(totalPercent) };
  });

  const materialCounts: Record<string, number> = {};
  (students || []).forEach((s) => {
    s.materials.forEach((m) => {
      materialCounts[m.material_name] = (materialCounts[m.material_name] || 0) + 1;
    });
  });
  const pieData = Object.entries(materialCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ダッシュボード</h1>
          <p className="mt-1 text-muted-foreground">システムの概要と進捗状況</p>
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="生徒数" value={stats?.total_students || 0} subtitle="登録済み生徒" icon={Users} gradient="bg-gradient-to-br from-indigo-500 to-purple-600" />
        <StatCard title="教材数" value={stats?.total_materials || 0} subtitle="登録済み教材" icon={BookOpen} gradient="bg-gradient-to-br from-emerald-500 to-teal-600" />
        <StatCard title="アクティブ割当" value={stats?.active_assignments || 0} subtitle="進行中の割当" icon={TrendingUp} gradient="bg-gradient-to-br from-amber-500 to-orange-600" />
        <Card className="card-hover stat-card border-0 shadow-premium overflow-hidden h-full">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">平均進捗</p>
                <p className="text-3xl font-bold tracking-tight">{stats?.avg_completion || 0}%</p>
                <p className="text-xs text-muted-foreground">全生徒の平均</p>
              </div>
              <ProgressRing value={stats?.avg_completion || 0} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-premium overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">生徒別 進捗率</CardTitle>
            <p className="text-xs text-muted-foreground">各生徒の平均教材進捗</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={studentChartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 91%)" />
                <XAxis dataKey="name" fontSize={11} tick={{ fill: "hsl(0 0% 45%)" }} />
                <YAxis domain={[0, 100]} unit="%" fontSize={11} tick={{ fill: "hsl(0 0% 45%)" }} />
                <Tooltip formatter={(v) => [`${v}%`, "進捗率"]} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", fontSize: "13px" }} />
                <Bar dataKey="percent" fill="url(#bar-gradient)" radius={[6, 6, 0, 0]} />
                <defs>
                  <linearGradient id="bar-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

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
      </div>

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
