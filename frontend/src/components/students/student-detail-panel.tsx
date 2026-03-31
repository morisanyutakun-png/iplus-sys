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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  Users,
} from "lucide-react";
import { StudentCreateDialog } from "./student-create-dialog";
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


  return (
    <div className="space-y-4">
      {/* Student switcher header */}
      <div className="flex items-center gap-3 min-w-0">
        {students && students.length > 0 && onSelectStudent && (
          <select
            className="text-sm font-bold rounded-lg border px-3 py-1.5 bg-background max-w-[180px] truncate"
            value={student.id}
            onChange={(e) => onSelectStudent(e.target.value)}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.grade ? ` (${s.grade})` : ""}</option>
            ))}
          </select>
        )}
        {!students && (
          <h2 className="text-xl font-bold">{student.name}</h2>
        )}
        {isEditingName ? (
          <div className="flex items-center gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") setIsEditingName(false);
              }}
              className="h-8 w-36 text-sm"
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
              className="h-8 w-20 text-sm"
              placeholder="学年"
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={handleSaveName} disabled={updateMutation.isPending}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsEditingName(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0" onClick={handleStartEdit} title="名前・学年を編集">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        <span className="text-xs text-muted-foreground shrink-0">
          {student.materials.length}教材 · 進捗{avgPercent}%
        </span>
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
            <TabsTrigger value="students">
              <Users className="mr-1.5 h-4 w-4" />
              生徒一覧
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

        {/* Tab 4: Student List */}
        <TabsContent value="students" className="space-y-4">
          <StudentListTab
            students={students || []}
            currentStudentId={studentId}
            onSelectStudent={onSelectStudent}
            onTabChange={onTabChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Student List Tab ── */
function StudentListTab({
  students,
  currentStudentId,
  onSelectStudent,
  onTabChange,
}: {
  students: StudentListItem[];
  currentStudentId: string;
  onSelectStudent?: (id: string) => void;
  onTabChange?: (tab: string) => void;
}) {
  const router = useRouter();
  const deleteMutation = useDeleteStudent();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = students.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  const handleDelete = (student: StudentListItem) => {
    if (!window.confirm(`「${student.name}」を削除しますか？この操作は元に戻せません。`)) return;
    deleteMutation.mutate(student.id, {
      onSuccess: () => {
        if (student.id === currentStudentId && students.length > 1) {
          const next = students.find((s) => s.id !== student.id);
          if (next && onSelectStudent) onSelectStudent(next.id);
        }
      },
    });
  };

  const goTo = (studentId: string, tab: string) => {
    onSelectStudent?.(studentId);
    onTabChange?.(tab);
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="名前またはIDで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm rounded-lg border px-3 py-2 bg-background pl-9"
          />
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        <StudentCreateDialog />
      </div>

      <div className="space-y-2">
        {filtered.map((s) => {
          const avgPercent = s.materials.length > 0
            ? Math.round(s.materials.reduce((a, m) => a + m.percent, 0) / s.materials.length)
            : 0;
          const isCurrent = s.id === currentStudentId;
          return (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 transition-all cursor-pointer",
                isCurrent ? "border-primary/40 bg-primary/5" : "border-border/60 hover:border-border hover:shadow-sm"
              )}
              onClick={() => onSelectStudent?.(s.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{s.name}</span>
                  {s.grade && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{s.grade}</Badge>}
                  {isCurrent && <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">表示中</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">{s.materials.length}教材 · 進捗{avgPercent}%</span>
              </div>
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => goTo(s.id, "mastery")}>
                  <ClipboardCheck className="mr-1 h-3 w-3" />入力
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => goTo(s.id, "materials")}>
                  <BookOpen className="mr-1 h-3 w-3" />割当
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => goTo(s.id, "analytics")}>
                  <BarChart3 className="mr-1 h-3 w-3" />分析
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(s)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
