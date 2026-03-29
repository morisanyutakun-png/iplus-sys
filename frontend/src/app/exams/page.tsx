"use client";

import { useState, useMemo } from "react";
import {
  useExamMaterials,
  useCreateExamMaterial,
  useDeleteExamMaterial,
  useAddExamSubjectSimple,
  useDeleteExamSubject,
} from "@/lib/queries/exam-materials";
import { Card, CardContent } from "@/components/ui/card";
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
  Scale,
  BarChart3,
  ClipboardCheck,
  Settings2,
  Pencil,
} from "lucide-react";
import { UniversityWeightManager } from "@/components/exams/university-weight-manager";
import Link from "next/link";
import type { ExamMaterial, ExamSubject } from "@/lib/types";

export default function ExamsPage() {
  const { data: allExams, isLoading } = useExamMaterials();
  const createMutation = useCreateExamMaterial();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newExamType, setNewExamType] = useState<string>("common_test");
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [newUniversity, setNewUniversity] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const commonTests = useMemo(
    () => (allExams || []).filter((e) => e.exam_type === "common_test" && (searchQuery ? e.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)),
    [allExams, searchQuery]
  );
  const universityPast = useMemo(
    () => (allExams || []).filter((e) => e.exam_type === "university_past" && (searchQuery ? e.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)),
    [allExams, searchQuery]
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">試験管理</h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge variant="secondary" className="rounded-full text-xs">
              {(allExams || []).length} 試験
            </Badge>
            <Badge variant="secondary" className="rounded-full text-xs">
              {(allExams || []).reduce((s, e) => s + e.subjects.length, 0)} 教科
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="試験を検索..."
              className="pl-10 w-56 h-10 rounded-xl bg-muted/40 border-0"
            />
          </div>
          <Link href="/exams/scores">
            <Button variant="outline" size="sm">
              <ClipboardCheck className="mr-1.5 h-4 w-4" />
              スコア入力
            </Button>
          </Link>
          <Link href="/exams/analytics">
            <Button variant="outline" size="sm">
              <BarChart3 className="mr-1.5 h-4 w-4" />
              分析
            </Button>
          </Link>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 rounded-xl shadow-premium font-medium">
                <Plus className="mr-2 h-4 w-4" />
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
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
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
                    <Input
                      value={newYear}
                      onChange={(e) => setNewYear(e.target.value)}
                      type="number"
                      className="h-10 rounded-xl"
                    />
                  </div>
                  {newExamType === "university_past" && (
                    <div>
                      <label className="mb-2 block text-sm font-medium">大学名</label>
                      <Input
                        value={newUniversity}
                        onChange={(e) => setNewUniversity(e.target.value)}
                        placeholder="東京大学"
                        className="h-10 rounded-xl"
                      />
                    </div>
                  )}
                </div>
                <Button
                  className="w-full h-10 rounded-xl font-medium"
                  onClick={handleCreate}
                  disabled={!newName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? "登録中..." : "登録する"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  登録後、教科（数学IA等）をPDF付きで追加できます
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="common_test">
        <TabsList>
          <TabsTrigger value="common_test">
            <FileText className="mr-1.5 h-4 w-4" />
            共テ・模試
          </TabsTrigger>
          <TabsTrigger value="university_past">
            <GraduationCap className="mr-1.5 h-4 w-4" />
            大学過去問
          </TabsTrigger>
          <TabsTrigger value="weights">
            <Scale className="mr-1.5 h-4 w-4" />
            圧縮点設定
          </TabsTrigger>
        </TabsList>

        <TabsContent value="common_test">
          <ExamList exams={commonTests} emptyMessage="共テ・模試がまだ登録されていません" />
        </TabsContent>
        <TabsContent value="university_past">
          <ExamList exams={universityPast} emptyMessage="大学過去問がまだ登録されていません" />
        </TabsContent>
        <TabsContent value="weights">
          <UniversityWeightManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Exam List ── */
function ExamList({ exams, emptyMessage }: { exams: ExamMaterial[]; emptyMessage: string }) {
  if (exams.length === 0) {
    return (
      <Card className="border-0 shadow-premium overflow-hidden">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <FileText className="h-10 w-10 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {exams.map((exam) => (
        <ExamCard key={exam.id} exam={exam} />
      ))}
    </div>
  );
}

/* ── Exam Card (like MaterialCard) ── */
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

  const resetForm = () => {
    setSubjectName("");
    setMaxScore("100");
    setPdfFile(null);
    setAnswerPdfFile(null);
    setIsDragging(false);
  };

  const handleAddSubject = () => {
    if (!subjectName.trim()) return;
    addSubjectMutation.mutate(
      {
        subject_name: subjectName.trim(),
        max_score: Number(maxScore) || 100,
        file: pdfFile || undefined,
        answerFile: answerPdfFile || undefined,
      },
      {
        onSuccess: () => {
          toast.success("教科を追加しました");
          resetForm();
          setAddOpen(false);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(exam.id, {
      onSuccess: () => {
        toast.success(`「${exam.name}」を削除しました`);
        setDeleteOpen(false);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleDeleteSubject = (subjectId: number, subjectName: string) => {
    deleteSubjectMutation.mutate(subjectId, {
      onSuccess: () => toast.success(`${subjectName} を削除しました`),
      onError: (err) => toast.error(err.message),
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") setPdfFile(file);
  };

  const totalMax = exam.subjects.reduce((s, subj) => s + subj.max_score, 0);
  const gradient = exam.exam_type === "common_test"
    ? "from-blue-500 to-indigo-600"
    : "from-purple-500 to-violet-600";

  return (
    <Card className="group border-0 shadow-sm hover:shadow-premium-lg transition-all duration-300 overflow-hidden relative">
      <div className={cn("h-1 w-full bg-gradient-to-r", gradient)} />
      <CardContent className="p-5 pt-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[15px] tracking-tight truncate">{exam.name}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="secondary" className="rounded-full text-[10px] font-medium px-2 py-0">
                {exam.subjects.length} 教科
              </Badge>
              {exam.year && (
                <span className="text-[10px] text-muted-foreground">{exam.year}年</span>
              )}
              {exam.university && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{exam.university}</Badge>
              )}
              {totalMax > 0 && (
                <span className="text-[10px] text-muted-foreground">満点合計 {totalMax}点</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>試験を削除しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    「{exam.name}」と{exam.subjects.length}件の教科・関連スコアが完全に削除されます。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMutation.isPending ? "削除中..." : "削除する"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent onClick={(e) => e.stopPropagation()} className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{exam.name} に教科追加</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="mb-2 block text-sm font-medium">教科名</label>
                      <Input
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        placeholder="例: 数学IA"
                        className="h-10 rounded-xl"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium">満点</label>
                      <Input
                        value={maxScore}
                        onChange={(e) => setMaxScore(e.target.value)}
                        type="number"
                        className="h-10 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Question PDF */}
                  <div>
                    <label className="mb-2 block text-sm font-medium">問題PDF（任意）</label>
                    <div
                      className={cn(
                        "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all",
                        isDragging
                          ? "border-primary bg-primary/5 scale-[1.02]"
                          : pdfFile
                            ? "border-emerald-400 bg-emerald-50/50"
                            : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30"
                      )}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                    >
                      {pdfFile ? (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-5 w-5 text-emerald-600" />
                          <span className="font-medium">{pdfFile.name}</span>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setPdfFile(null)}>
                            取消
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="mb-1 h-6 w-6 text-muted-foreground/30" />
                          <p className="text-xs text-muted-foreground">ドラッグ&ドロップ</p>
                          <label className="mt-1 cursor-pointer text-xs font-medium text-primary hover:underline">
                            またはファイルを選択
                            <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) setPdfFile(f);
                            }} />
                          </label>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Answer PDF */}
                  <div>
                    <label className="mb-2 block text-sm font-medium">解答PDF（任意）</label>
                    <div
                      className={cn(
                        "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all",
                        answerPdfFile
                          ? "border-amber-400 bg-amber-50/50"
                          : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30"
                      )}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const f = e.dataTransfer.files[0];
                        if (f?.type === "application/pdf") setAnswerPdfFile(f);
                      }}
                    >
                      {answerPdfFile ? (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-5 w-5 text-amber-600" />
                          <span className="font-medium">{answerPdfFile.name}</span>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setAnswerPdfFile(null)}>
                            取消
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="mb-1 h-6 w-6 text-muted-foreground/30" />
                          <p className="text-xs text-muted-foreground">ドラッグ&ドロップ</p>
                          <label className="mt-1 cursor-pointer text-xs font-medium text-primary hover:underline">
                            またはファイルを選択
                            <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) setAnswerPdfFile(f);
                            }} />
                          </label>
                        </>
                      )}
                    </div>
                  </div>

                  <Button
                    className="w-full h-10 rounded-xl font-medium"
                    onClick={handleAddSubject}
                    disabled={!subjectName.trim() || addSubjectMutation.isPending}
                  >
                    {addSubjectMutation.isPending ? "追加中..." : "追加する"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Subject list */}
        {exam.subjects.length > 0 ? (
          <div className="space-y-2">
            {/* Dot summary */}
            <div className="flex items-center gap-1">
              <div className="flex flex-wrap gap-1 flex-1">
                {exam.subjects.map((s) => (
                  <span
                    key={s.id}
                    className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"
                    title={`${s.subject_name} (${s.max_score}点)`}
                  />
                ))}
              </div>
            </div>

            {/* Manage toggle */}
            <button
              type="button"
              onClick={() => setShowSubjects(!showSubjects)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {showSubjects ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <Settings2 className="h-3 w-3" />
              教科を管理
            </button>

            {/* Expandable subject list */}
            {showSubjects && (
              <div className="rounded-lg border border-border/60 bg-muted/20 divide-y divide-border/40 overflow-hidden">
                {exam.subjects.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/40 transition-colors group/row"
                  >
                    <span className="text-muted-foreground/50 font-mono tabular-nums w-5 text-right shrink-0">
                      {s.sort_order}
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-medium truncate flex-1">{s.subject_name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                      {s.max_score}点
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteSubject(s.id, s.subject_name)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="px-3 py-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-full text-xs text-primary hover:text-primary"
                    onClick={() => setAddOpen(true)}
                  >
                    <Plus className="mr-1.5 h-3 w-3" />
                    教科を追加
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-3 px-3 rounded-xl bg-muted/30 border border-dashed border-border/50">
            <FileText className="h-4 w-4 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground">教科がまだありません</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-primary ml-auto"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="mr-1 h-3 w-3" />
              追加
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
