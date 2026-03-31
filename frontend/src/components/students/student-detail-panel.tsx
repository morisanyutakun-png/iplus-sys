"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStudent, useUpdateStudent, useDeleteStudent } from "@/lib/queries/students";
import { useStudentAnalytics, useStudentAccuracy } from "@/lib/queries/analytics";
import { useDashboard } from "@/lib/queries/progress";
import { LearningPaceChart } from "./learning-pace-chart";
import { ProgressTimelineChart } from "./progress-timeline-chart";
import { AccuracyTrendChart } from "./accuracy-trend-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { MasterySpreadsheet } from "./mastery-spreadsheet";
import { MaterialManager } from "./material-manager";
import {
  ClipboardCheck,
  BookOpen,
  BarChart3,
  Pencil,
  Trash2,
  Check,
  X,
  AlertTriangle,
  TrendingDown,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "@/lib/recharts-imports";
import { TOOLTIP_STYLE, AXIS_TICK_STYLE, GRID_PROPS } from "@/lib/chart-config";

type StudentListItem = {
  id: string;
  name: string;
  grade?: string | null;
  materials: { percent: number }[];
};

type Props = {
  studentId: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  instructorId?: number | null;
  onInstructorChange?: (id: number | null) => void;
  students?: StudentListItem[];
  onSelectStudent?: (id: string) => void;
  spreadsheetActive: boolean;
  onEnterSpreadsheet: () => void;
  onEscapeSpreadsheet: () => void;
  onPendingChange?: (hasPending: boolean) => void;
};

export function StudentDetailPanel({
  studentId,
  activeTab = "mastery",
  onTabChange,
  instructorId,
  onInstructorChange,
  students,
  onSelectStudent,
  spreadsheetActive,
  onEnterSpreadsheet,
  onEscapeSpreadsheet,
  onPendingChange,
}: Props) {
  const { data: student, isLoading } = useStudent(studentId);
  const { data: analytics } = useStudentAnalytics(studentId);
  const { data: accuracyData } = useStudentAccuracy(studentId);
  const { data: dashboard } = useDashboard();

  const nearlyComplete = (dashboard?.nearly_complete || []).filter(
    (item) => item.student_id === studentId
  );
  const lowAccuracy = (dashboard?.low_accuracy || []).filter(
    (item) => item.student_id === studentId
  );
  const router = useRouter();
  const updateMutation = useUpdateStudent();
  const deleteMutation = useDeleteStudent();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGrade, setEditGrade] = useState("");

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

  const handleStartEdit = () => {
    setEditName(student.name);
    setEditGrade(student.grade || "");
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    const trimmedName = editName.trim();
    const trimmedGrade = editGrade.trim();
    if (!trimmedName) {
      setIsEditingName(false);
      return;
    }
    const nameChanged = trimmedName !== student.name;
    const gradeChanged = trimmedGrade !== (student.grade || "");
    if (!nameChanged && !gradeChanged) {
      setIsEditingName(false);
      return;
    }
    updateMutation.mutate(
      {
        id: student.id,
        ...(nameChanged && { name: trimmedName }),
        ...(gradeChanged && { grade: trimmedGrade }),
      },
      {
        onSuccess: () => {
          toast.success("生徒情報を更新しました");
          setIsEditingName(false);
        },
        onError: () => toast.error("更新に失敗しました"),
      }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(student.id, {
      onSuccess: () => {
        toast.success(`${student.name} を削除しました`);
        router.replace("/students");
      },
      onError: () => toast.error("削除に失敗しました"),
    });
  };

  return (
    <div className="space-y-4">
      {/* Student header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") setIsEditingName(false);
                }}
                className="h-8 w-48 text-lg font-bold"
                placeholder="生徒名"
                autoFocus
              />
              <Input
                value={editGrade}
                onChange={(e) => setEditGrade(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") setIsEditingName(false);
                }}
                className="h-8 w-24 text-sm"
                placeholder="学年"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-green-600 hover:text-green-700"
                onClick={handleSaveName}
                disabled={updateMutation.isPending}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setIsEditingName(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{student.name}</h2>
              {student.grade && (
                <Badge variant="outline" className="text-xs">{student.grade}</Badge>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={handleStartEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            ID: {student.id} · {student.materials.length}教材 · 平均進捗{" "}
            {avgPercent}%
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive shrink-0"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              削除
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>生徒を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                「{student.name}」を完全に削除します。割り当て中の教材データ・進捗履歴もすべて削除されます。この操作は元に戻せません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                削除する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Tabs + Reminder banners */}
      <Tabs value={activeTab} onValueChange={onTabChange}>
        <div className="flex items-center gap-3 flex-wrap">
          <TabsList className="shrink-0">
            <TabsTrigger value="mastery">
              <ClipboardCheck className="mr-1.5 h-4 w-4" />
              定着度入力
            </TabsTrigger>
            <TabsTrigger value="materials">
              <BookOpen className="mr-1.5 h-4 w-4" />
              割り当て管理
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="mr-1.5 h-4 w-4" />
            分析
            </TabsTrigger>
          </TabsList>

          {/* Reminder banners inline with tabs */}
          {nearlyComplete.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 px-3 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                完了間近 {nearlyComplete.length}件
              </span>
              <div className="flex items-center gap-1">
                {nearlyComplete.slice(0, 3).map((item) => (
                  <Badge key={item.material_key} variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600 dark:text-amber-400">
                    {item.material_name} 残{item.remaining}
                  </Badge>
                ))}
                {nearlyComplete.length > 3 && (
                  <span className="text-[10px] text-amber-500">+{nearlyComplete.length - 3}</span>
                )}
              </div>
            </div>
          )}
          {lowAccuracy.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/40 px-3 py-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-red-600 shrink-0" />
              <span className="text-xs font-medium text-red-700 dark:text-red-300">
                定着度不足 {lowAccuracy.length}件
              </span>
            </div>
          )}
        </div>

        {/* Tab 1: Mastery Spreadsheet */}
        <TabsContent value="mastery">
          <MasterySpreadsheet
            student={student}
            active={spreadsheetActive}
            onActivate={onEnterSpreadsheet}
            onEscape={onEscapeSpreadsheet}
            onPendingChange={onPendingChange}
            instructorId={instructorId ?? null}
            onInstructorChange={onInstructorChange}
            students={students}
            onSelectStudent={onSelectStudent}
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
              {/* Fitness Rate Card */}
              <Card className="border-0 shadow-premium">
                <CardContent className="py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">教材適合度</p>
                      <p className="text-xs text-muted-foreground mt-0.5">正答率80%〜100%未満の割合（未実施除外）</p>
                    </div>
                    <div className="text-right">
                      {accuracyData?.fitness_rate != null ? (
                        <div className="text-3xl font-bold tabular-nums">
                          {accuracyData.fitness_rate}
                          <span className="text-lg text-muted-foreground font-normal">%</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">データなし</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Completion Rates - Horizontal Bar, full width */}
              {analytics.completion_rates.length > 0 && (
                <Card className="border-0 shadow-premium overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-sm">教材別完了率</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(200, analytics.completion_rates.length * 40)}>
                      <BarChart data={analytics.completion_rates} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid {...GRID_PROPS} />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          tick={AXIS_TICK_STYLE}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <YAxis
                          dataKey="material_name"
                          type="category"
                          tick={{ fontSize: 11, fill: "hsl(0 0% 35%)" }}
                          width={120}
                        />
                        <Tooltip
                          formatter={(value) => [`${value}%`, "完了率"]}
                          contentStyle={TOOLTIP_STYLE}
                        />
                        <Bar
                          dataKey="percent"
                          fill="url(#completion-gradient)"
                          radius={[0, 6, 6, 0]}
                          barSize={20}
                        />
                        <defs>
                          <linearGradient id="completion-gradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#dc2626" />
                            <stop offset="100%" stopColor="#f87171" />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Learning Pace - full width */}
              {Object.keys(analytics.pace.weekly_detail).length > 0 && (
                <Card className="border-0 shadow-premium overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-sm">学習ペース推移</CardTitle>
                    <p className="text-xs text-muted-foreground">週ごとのアクション数</p>
                  </CardHeader>
                  <CardContent>
                    <LearningPaceChart weeklyDetail={analytics.pace.weekly_detail} />
                  </CardContent>
                </Card>
              )}

              {/* Progress Timeline (full width) */}
              {analytics.progress_timeline.length > 0 && analytics.completion_rates.length > 0 && (
                <Card className="border-0 shadow-premium overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-sm">教材別進捗タイムライン</CardTitle>
                    <p className="text-xs text-muted-foreground">各教材の累積進捗率の推移</p>
                  </CardHeader>
                  <CardContent>
                    <ProgressTimelineChart
                      timeline={analytics.progress_timeline}
                      completionRates={analytics.completion_rates}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Accuracy Trend (full width, if data exists) */}
              {accuracyData && accuracyData.entries.length > 0 && (
                <Card className="border-0 shadow-premium overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-sm">正答率推移</CardTitle>
                    <p className="text-xs text-muted-foreground">教材別の正答率（60%以下は注意ライン）</p>
                  </CardHeader>
                  <CardContent>
                    <AccuracyTrendChart data={accuracyData.entries} />
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

        </TabsContent>
      </Tabs>
    </div>
  );
}
