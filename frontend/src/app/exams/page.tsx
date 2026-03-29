"use client";

import { useState, useMemo } from "react";
import {
  useExamMaterials,
  useCreateExamMaterial,
  useDeleteExamMaterial,
  useAddExamSubjectSimple,
  useDeleteExamSubject,
} from "@/lib/queries/exam-materials";
import { useStudents } from "@/lib/queries/students";
import { useStudentExamSummary } from "@/lib/queries/exam-scores";
import { useExamOverview } from "@/lib/queries/exam-analytics";
import { SubjectScoreChart } from "@/components/exams/subject-score-chart";
import { ScoreTrendChart } from "@/components/exams/score-trend-chart";
import { TargetComparisonChart } from "@/components/exams/target-comparison-chart";
import { CompressedScoreCalculator } from "@/components/exams/compressed-score-calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Upload,
  Search,
  Trash2,
  GraduationCap,
  BarChart3,
  Settings2,
  BookOpen,
  User,
  Users,
} from "lucide-react";
import type { ExamMaterial } from "@/lib/types";

export default function ExamsPage() {
  const { data: allExams, isLoading } = useExamMaterials();

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-9 w-40 rounded-xl skeleton-pulse" />
        {[1, 2].map((i) => (
          <div key={i} className="h-36 rounded-xl skeleton-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">試験管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          共通テスト・模試・大学過去問の分析と教材管理
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="analytics">
        <TabsList>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-1.5 h-4 w-4" />
            分析
          </TabsTrigger>
          <TabsTrigger value="materials">
            <BookOpen className="mr-1.5 h-4 w-4" />
            試験教材
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: 分析 ── */}
        <TabsContent value="analytics">
          <AnalyticsTab allExams={allExams || []} />
        </TabsContent>

        {/* ── Tab: 試験教材 ── */}
        <TabsContent value="materials">
          <MaterialsTab allExams={allExams || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   分析タブ
   ═══════════════════════════════════════════════════ */
function AnalyticsTab({ allExams }: { allExams: ExamMaterial[] }) {
  const { data: students } = useStudents();
  const [selectedStudentId, setSelectedStudentId] = useState("");
  // examSelect: "" = 未選択, "all" = 全試験, "common_test" = 共テ全体, "university_past" = 過去問全体, or numeric ID
  const [examSelect, setExamSelect] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");

  const commonTests = allExams.filter((e) => e.exam_type === "common_test");
  const universityPast = allExams.filter((e) => e.exam_type === "university_past");

  // Parse exam selection
  const isSpecificExam = examSelect !== "" && examSelect !== "all" && examSelect !== "common_test" && examSelect !== "university_past";
  const selectedExamId = isSpecificExam ? Number(examSelect) : 0;
  const selectedExamType = examSelect === "common_test" || examSelect === "university_past" ? examSelect : examSelect === "all" ? undefined : undefined;
  const isCrossExam = examSelect === "all" || examSelect === "common_test" || examSelect === "university_past";

  const { data: summary } = useStudentExamSummary(selectedStudentId, selectedExamId || undefined);
  const { data: overview } = useExamOverview(
    selectedExamId || undefined,
    isCrossExam ? (examSelect === "all" ? undefined : examSelect) : undefined,
    selectedGrade || undefined,
  );

  const grades = Array.from(new Set((students || []).map((s) => s.grade).filter(Boolean))) as string[];
  const latestAttempt = summary?.attempts?.[summary.attempts.length - 1];

  return (
    <div className="space-y-6">
      {/* Step 1: Select student */}
      <Card className="border-0 shadow-premium">
        <CardContent className="pt-5 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">生徒</label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="生徒を選択" />
                </SelectTrigger>
                <SelectContent>
                  {(students || []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.grade ? `(${s.grade})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">試験</label>
              <Select value={examSelect} onValueChange={setExamSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="試験を選択（または全体集計）" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">全体集計</div>
                  <SelectItem value="all">全試験</SelectItem>
                  <SelectItem value="common_test">共テ・模試 全体</SelectItem>
                  <SelectItem value="university_past">大学過去問 全体</SelectItem>
                  {commonTests.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground mt-1">共テ・模試</div>
                      {commonTests.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                      ))}
                    </>
                  )}
                  {universityPast.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground mt-1">大学過去問</div>
                      {universityPast.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">学年フィルタ</label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="全学年" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全学年</SelectItem>
                  {grades.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedStudentId && !examSelect ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <BarChart3 className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm">生徒または試験を選択して分析を表示</p>
        </div>
      ) : (
        <Tabs defaultValue="student">
          <TabsList>
            <TabsTrigger value="student">
              <User className="mr-1.5 h-4 w-4" />
              生徒別
            </TabsTrigger>
            <TabsTrigger value="class">
              <Users className="mr-1.5 h-4 w-4" />
              教室全体
            </TabsTrigger>
            {selectedStudentId && (
              <TabsTrigger value="compressed">
                <GraduationCap className="mr-1.5 h-4 w-4" />
                圧縮点
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── Student tab ── */}
          <TabsContent value="student" className="space-y-4">
            {selectedStudentId && summary ? (
              <>
                {latestAttempt && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Card className="border-0 shadow-premium">
                      <CardContent className="pt-5 text-center">
                        <div className="text-2xl font-bold">
                          {latestAttempt.total_score}
                          <span className="text-sm text-muted-foreground font-normal">/{latestAttempt.total_max}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">最新合計点</p>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-premium">
                      <CardContent className="pt-5 text-center">
                        <div className="text-2xl font-bold">{latestAttempt.percentage}%</div>
                        <p className="text-xs text-muted-foreground">最新得点率</p>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-premium">
                      <CardContent className="pt-5 text-center">
                        <div className="text-2xl font-bold">{summary.attempts.length}</div>
                        <p className="text-xs text-muted-foreground">実施回数</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {latestAttempt && (
                  <Card className="border-0 shadow-premium overflow-hidden">
                    <CardHeader><CardTitle className="text-sm">教科別得点率</CardTitle></CardHeader>
                    <CardContent>
                      <SubjectScoreChart subjects={latestAttempt.subjects} title={latestAttempt.attempt_date} />
                    </CardContent>
                  </Card>
                )}

                {latestAttempt && latestAttempt.subjects.some((s) => s.target_score != null) && (
                  <Card className="border-0 shadow-premium overflow-hidden">
                    <CardHeader><CardTitle className="text-sm">目標点との差異</CardTitle></CardHeader>
                    <CardContent>
                      <TargetComparisonChart subjects={latestAttempt.subjects} />
                    </CardContent>
                  </Card>
                )}

                {summary.attempts.length > 1 && (
                  <Card className="border-0 shadow-premium overflow-hidden">
                    <CardHeader><CardTitle className="text-sm">得点率推移</CardTitle></CardHeader>
                    <CardContent>
                      <ScoreTrendChart attempts={summary.attempts} />
                    </CardContent>
                  </Card>
                )}

                <Card className="border-0 shadow-premium overflow-hidden">
                  <CardHeader><CardTitle className="text-sm">実施履歴</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2 text-muted-foreground">日付</th>
                            <th className="text-left py-2 px-2 text-muted-foreground">試験</th>
                            <th className="text-right py-2 px-2 text-muted-foreground">合計</th>
                            <th className="text-right py-2 px-2 text-muted-foreground">得点率</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.attempts.map((a, i) => (
                            <tr key={i} className="border-b hover:bg-muted/30">
                              <td className="py-2 px-2">{a.attempt_date}</td>
                              <td className="py-2 px-2">{a.exam_name}</td>
                              <td className="py-2 px-2 text-right tabular-nums">{a.total_score}/{a.total_max}</td>
                              <td className="py-2 px-2 text-right">
                                <Badge variant={a.percentage >= 80 ? "default" : a.percentage >= 60 ? "secondary" : "destructive"} className="text-xs">
                                  {a.percentage}%
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                生徒を選択してください
              </div>
            )}
          </TabsContent>

          {/* ── Class tab ── */}
          <TabsContent value="class" className="space-y-4">
            {overview && examSelect ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="border-0 shadow-premium">
                    <CardContent className="pt-5 text-center">
                      <div className="text-2xl font-bold">{overview.class_average_total}</div>
                      <p className="text-xs text-muted-foreground">教室平均点</p>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-premium">
                    <CardContent className="pt-5 text-center">
                      <div className="text-2xl font-bold">{overview.class_average_percentage}%</div>
                      <p className="text-xs text-muted-foreground">教室平均得点率</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-0 shadow-premium overflow-hidden">
                  <CardHeader><CardTitle className="text-sm">生徒ランキング</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {overview.rankings.map((r, i) => (
                        <div key={r.student_id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                          <span className="w-6 text-center font-bold text-muted-foreground">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm">{r.student_name}</span>
                            {r.grade && <Badge variant="outline" className="ml-2 text-[10px]">{r.grade}</Badge>}
                          </div>
                          <span className="tabular-nums text-sm">{r.total_score}/{r.total_max}</span>
                          <Badge variant={r.percentage >= 80 ? "default" : r.percentage >= 60 ? "secondary" : "destructive"} className="w-14 justify-center text-xs">
                            {r.percentage}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-premium overflow-hidden">
                  <CardHeader><CardTitle className="text-sm">教科別平均</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2 text-muted-foreground">教科</th>
                            <th className="text-right py-2 px-2 text-muted-foreground">満点</th>
                            <th className="text-right py-2 px-2 text-muted-foreground">平均点</th>
                            <th className="text-right py-2 px-2 text-muted-foreground">平均率</th>
                            <th className="text-right py-2 px-2 text-muted-foreground">人数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.subject_averages.map((sa) => (
                            <tr key={sa.subject_name} className="border-b hover:bg-muted/30">
                              <td className="py-2 px-2 font-medium">{sa.subject_name}</td>
                              <td className="py-2 px-2 text-right text-muted-foreground">{sa.max_score}</td>
                              <td className="py-2 px-2 text-right tabular-nums">{sa.avg_score}</td>
                              <td className="py-2 px-2 text-right">
                                <Badge variant={sa.avg_percentage >= 80 ? "default" : sa.avg_percentage >= 60 ? "secondary" : "destructive"} className="text-xs">
                                  {sa.avg_percentage}%
                                </Badge>
                              </td>
                              <td className="py-2 px-2 text-right text-muted-foreground">{sa.student_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                試験を選択してください
              </div>
            )}
          </TabsContent>

          {/* ── Compressed score tab ── */}
          {selectedStudentId && (
            <TabsContent value="compressed" className="space-y-4">
              <CompressedScoreCalculator
                studentId={selectedStudentId}
                examMaterialId={selectedExamId || undefined}
              />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   試験教材タブ
   ═══════════════════════════════════════════════════ */
function MaterialsTab({ allExams }: { allExams: ExamMaterial[] }) {
  const createMutation = useCreateExamMaterial();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newExamType, setNewExamType] = useState<string>("common_test");
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [newUniversity, setNewUniversity] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [subTab, setSubTab] = useState<string>("common_test");

  const filtered = useMemo(
    () => allExams.filter((e) => e.exam_type === subTab && (searchQuery ? e.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)),
    [allExams, subTab, searchQuery]
  );

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("試験名を入力してください");
      return;
    }
    createMutation.mutate(
      {
        name: trimmed,
        exam_type: newExamType,
        year: newYear ? Number(newYear) : undefined,
        university: newUniversity || undefined,
        subjects: [],
      },
      {
        onSuccess: () => {
          toast.success("試験を登録しました");
          setCreateOpen(false);
          setNewName("");
          setNewYear(String(new Date().getFullYear()));
          setNewUniversity("");
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab("common_test")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              subTab === "common_test" ? "bg-blue-100 text-blue-700" : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            <FileText className="inline mr-1 h-3 w-3" />
            共テ・模試
          </button>
          <button
            type="button"
            onClick={() => setSubTab("university_past")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              subTab === "university_past" ? "bg-purple-100 text-purple-700" : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            <GraduationCap className="inline mr-1 h-3 w-3" />
            大学過去問
          </button>
          <div className="relative ml-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="検索..."
              className="pl-8 w-40 h-8 text-xs rounded-lg bg-muted/40 border-0"
            />
          </div>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-lg font-medium">
              <Plus className="mr-1.5 h-4 w-4" />
              試験追加
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>新しい試験を登録</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="mb-2 block text-sm font-medium">試験名</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例: 河合実戦模試 / 2025共テ"
                  className="h-10 rounded-xl"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">種別</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewExamType("common_test")}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all",
                      newExamType === "common_test"
                        ? "bg-blue-50 text-blue-700 border-blue-300"
                        : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <FileText className="inline mr-1.5 h-3.5 w-3.5" />
                    共テ・模試
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewExamType("university_past")}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all",
                      newExamType === "university_past"
                        ? "bg-purple-50 text-purple-700 border-purple-300"
                        : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <GraduationCap className="inline mr-1.5 h-3.5 w-3.5" />
                    大学過去問
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium">年度</label>
                  <Input value={newYear} onChange={(e) => setNewYear(e.target.value)} type="number" className="h-10 rounded-xl" />
                </div>
                {newExamType === "university_past" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium">大学名</label>
                    <Input value={newUniversity} onChange={(e) => setNewUniversity(e.target.value)} placeholder="東京大学" className="h-10 rounded-xl" />
                  </div>
                )}
              </div>
              <Button className="w-full h-10 rounded-xl font-medium" onClick={handleCreate} disabled={!newName.trim() || createMutation.isPending}>
                {createMutation.isPending ? "登録中..." : "登録する"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                登録後、教科（数学IA等）をPDF付きで追加できます
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Exam cards */}
      {filtered.length === 0 ? (
        <Card className="border-0 shadow-premium overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <FileText className="h-10 w-10 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "該当する試験がありません" : "試験がまだ登録されていません"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((exam) => (
            <ExamCard key={exam.id} exam={exam} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Exam Card
   ═══════════════════════════════════════════════════ */
function ExamCard({ exam }: { exam: ExamMaterial }) {
  const addSubjectMutation = useAddExamSubjectSimple(exam.id);
  const deleteMutation = useDeleteExamMaterial();
  const deleteSubjectMutation = useDeleteExamSubject(exam.id);

  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [answerPdfFile, setAnswerPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showSubjects, setShowSubjects] = useState(false);

  const resetForm = () => { setSubjectName(""); setMaxScore("100"); setPdfFile(null); setAnswerPdfFile(null); setIsDragging(false); };

  const handleAddSubject = () => {
    if (!subjectName.trim()) return;
    addSubjectMutation.mutate(
      { subject_name: subjectName.trim(), max_score: Number(maxScore) || 100, file: pdfFile || undefined, answerFile: answerPdfFile || undefined },
      { onSuccess: () => { toast.success("教科を追加しました"); resetForm(); setAddOpen(false); }, onError: (err) => toast.error(err.message) }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(exam.id, {
      onSuccess: () => { toast.success(`「${exam.name}」を削除しました`); setDeleteOpen(false); },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleDeleteSubject = (subjectId: number, name: string) => {
    deleteSubjectMutation.mutate(subjectId, {
      onSuccess: () => toast.success(`${name} を削除しました`),
      onError: (err) => toast.error(err.message),
    });
  };

  const totalMax = exam.subjects.reduce((s, subj) => s + subj.max_score, 0);
  const gradient = exam.exam_type === "common_test" ? "from-blue-500 to-indigo-600" : "from-purple-500 to-violet-600";

  return (
    <Card className="group border-0 shadow-sm hover:shadow-premium-lg transition-all duration-300 overflow-hidden relative">
      <div className={cn("h-1 w-full bg-gradient-to-r", gradient)} />
      <CardContent className="p-5 pt-4">
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[15px] tracking-tight truncate">{exam.name}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="secondary" className="rounded-full text-[10px] font-medium px-2 py-0">{exam.subjects.length} 教科</Badge>
              {exam.year && <span className="text-[10px] text-muted-foreground">{exam.year}年</span>}
              {exam.university && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{exam.university}</Badge>}
              {totalMax > 0 && <span className="text-[10px] text-muted-foreground">満点合計 {totalMax}点</span>}
            </div>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>試験を削除しますか？</AlertDialogTitle>
                  <AlertDialogDescription>「{exam.name}」と{exam.subjects.length}件の教科・関連スコアが完全に削除されます。</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {deleteMutation.isPending ? "削除中..." : "削除する"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent onClick={(e) => e.stopPropagation()} className="sm:max-w-md">
                <DialogHeader><DialogTitle>{exam.name} に教科追加</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="mb-2 block text-sm font-medium">教科名</label>
                      <Input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="例: 数学IA" className="h-10 rounded-xl" autoFocus />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium">満点</label>
                      <Input value={maxScore} onChange={(e) => setMaxScore(e.target.value)} type="number" className="h-10 rounded-xl" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">問題PDF（任意）</label>
                    <div
                      className={cn("relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all",
                        isDragging ? "border-primary bg-primary/5 scale-[1.02]" : pdfFile ? "border-emerald-400 bg-emerald-50/50" : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30"
                      )}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f?.type === "application/pdf") setPdfFile(f); }}
                    >
                      {pdfFile ? (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-5 w-5 text-emerald-600" /><span className="font-medium">{pdfFile.name}</span>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setPdfFile(null)}>取消</Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="mb-1 h-6 w-6 text-muted-foreground/30" /><p className="text-xs text-muted-foreground">ドラッグ&ドロップ</p>
                          <label className="mt-1 cursor-pointer text-xs font-medium text-primary hover:underline">またはファイルを選択<input type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPdfFile(f); }} /></label>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">解答PDF（任意）</label>
                    <div
                      className={cn("relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all",
                        answerPdfFile ? "border-amber-400 bg-amber-50/50" : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30"
                      )}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === "application/pdf") setAnswerPdfFile(f); }}
                    >
                      {answerPdfFile ? (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-5 w-5 text-amber-600" /><span className="font-medium">{answerPdfFile.name}</span>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setAnswerPdfFile(null)}>取消</Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="mb-1 h-6 w-6 text-muted-foreground/30" /><p className="text-xs text-muted-foreground">ドラッグ&ドロップ</p>
                          <label className="mt-1 cursor-pointer text-xs font-medium text-primary hover:underline">またはファイルを選択<input type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setAnswerPdfFile(f); }} /></label>
                        </>
                      )}
                    </div>
                  </div>
                  <Button className="w-full h-10 rounded-xl font-medium" onClick={handleAddSubject} disabled={!subjectName.trim() || addSubjectMutation.isPending}>
                    {addSubjectMutation.isPending ? "追加中..." : "追加する"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {exam.subjects.length > 0 ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {exam.subjects.map((s) => (
                <span key={s.id} className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title={`${s.subject_name} (${s.max_score}点)`} />
              ))}
            </div>
            <button type="button" onClick={() => setShowSubjects(!showSubjects)} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
              {showSubjects ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <Settings2 className="h-3 w-3" />教科を管理
            </button>
            {showSubjects && (
              <div className="rounded-lg border border-border/60 bg-muted/20 divide-y divide-border/40 overflow-hidden">
                {exam.subjects.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/40 transition-colors group/row">
                    <span className="text-muted-foreground/50 font-mono tabular-nums w-5 text-right shrink-0">{s.sort_order}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-medium truncate flex-1">{s.subject_name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{s.max_score}点</Badge>
                    <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteSubject(s.id, s.subject_name)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="px-3 py-2">
                  <Button size="sm" variant="ghost" className="h-7 w-full text-xs text-primary hover:text-primary" onClick={() => setAddOpen(true)}>
                    <Plus className="mr-1.5 h-3 w-3" />教科を追加
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-3 px-3 rounded-xl bg-muted/30 border border-dashed border-border/50">
            <FileText className="h-4 w-4 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground">教科がまだありません</span>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-primary ml-auto" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-3 w-3" />追加
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
