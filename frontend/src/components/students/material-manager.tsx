"use client";

import { useState, useMemo } from "react";
import {
  useMaterialZones,
  useToggleMaterial,
  useSavePointers,
  useAssignWordTest,
  useStudentMaterialNodes,
  studentPdfPreviewUrl,
} from "@/lib/queries/students";
import {
  useAcknowledgeReminder,
  useUnacknowledgeReminder,
  useAcknowledgeLowAccuracy,
  useUnacknowledgeLowAccuracy,
  useDashboard,
} from "@/lib/queries/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Minus,
  Save,
  BookOpen,
  Package,
  X,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Circle,
  TrendingDown,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  School,
  Archive,
} from "lucide-react";
import type { MaterialZoneItem } from "@/lib/types";

function NodePreviewPanel({
  studentId,
  materialKey,
}: {
  studentId: string;
  materialKey: string;
}) {
  const { data, isLoading } = useStudentMaterialNodes(studentId, materialKey);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="px-4 pb-4 pt-2">
        <div className="text-xs text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="px-4 pb-4 pt-2">
        <div className="text-xs text-muted-foreground">ノードがありません</div>
      </div>
    );
  }

  return (
    <div className="border-t border-border/40">
      {/* Node list */}
      <div className="px-4 py-3 space-y-1 max-h-48 overflow-y-auto">
        {data.nodes.map((node) => (
          <div
            key={node.key}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors",
              node.is_current
                ? "bg-primary/10 font-medium"
                : node.is_completed
                ? "text-muted-foreground"
                : ""
            )}
          >
            {/* Status icon */}
            <div className="shrink-0">
              {node.is_completed ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : node.is_current ? (
                <Circle className="h-3.5 w-3.5 text-primary fill-primary/20" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground/30" />
              )}
            </div>

            {/* Node info */}
            <span className="flex-1 truncate">
              {node.title}
              {node.range_text && (
                <span className="text-muted-foreground ml-1">({node.range_text})</span>
              )}
            </span>

            {/* Preview button */}
            {node.has_pdf && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary"
                onClick={() =>
                  setPreviewUrl(
                    studentPdfPreviewUrl(studentId, materialKey, node.sort_order)
                  )
                }
                title="PDFプレビュー"
              >
                <Eye className="h-3 w-3" />
              </Button>
            )}
            {!node.has_pdf && (
              <span className="text-[10px] text-muted-foreground/50 shrink-0">PDF無し</span>
            )}
          </div>
        ))}
      </div>

      {/* Inline PDF preview */}
      {previewUrl && (
        <div className="border-t border-border/40">
          <div className="flex items-center justify-between px-4 py-1.5 bg-muted/30">
            <span className="text-[10px] font-medium text-muted-foreground">PDFプレビュー</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => window.open(previewUrl, "_blank")}
                title="新しいタブで開く"
              >
                <FileText className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => setPreviewUrl(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <iframe
            src={previewUrl}
            className="w-full h-[500px] border-0"
            title="PDF Preview"
          />
        </div>
      )}
    </div>
  );
}

type Props = {
  studentId: string;
};

export function MaterialManager({ studentId }: Props) {
  const { data: zones } = useMaterialZones(studentId);
  const { data: dashboard } = useDashboard();
  const toggleMutation = useToggleMaterial(studentId);
  const saveMutation = useSavePointers(studentId);
  const assignWordTest = useAssignWordTest(studentId);
  const ackMutation = useAcknowledgeReminder();
  const unackMutation = useUnacknowledgeReminder();
  const ackLowMutation = useAcknowledgeLowAccuracy();
  const unackLowMutation = useUnacknowledgeLowAccuracy();

  const [editedPointers, setEditedPointers] = useState<
    Record<string, number>
  >({});

  // Preview expand state
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null);

  // Word test assignment dialog state
  const [wordTestDialog, setWordTestDialog] = useState<{
    open: boolean;
    materialKey: string;
    materialName: string;
    wordBookId: number;
    totalWords: number;
  } | null>(null);
  const [wtStartNum, setWtStartNum] = useState(1);
  const [wtEndNum, setWtEndNum] = useState(100);
  const [wtWordsPerTest, setWtWordsPerTest] = useState(100);
  const [wtQuestionsPerTest, setWtQuestionsPerTest] = useState(50);
  const [wtRowsPerSide, setWtRowsPerSide] = useState<30 | 50>(50);

  const handleToggle = (materialKey: string, action: "assign" | "remove") => {
    toggleMutation.mutate(
      { material_key: materialKey, action },
      {
        onSuccess: () =>
          toast.success(
            action === "assign" ? "教材を割り当てました" : "教材を解除しました"
          ),
      }
    );
  };

  const handleSourceClick = (mat: { key: string; name: string; total_nodes: number; word_book_id?: number; total_words?: number }) => {
    if (mat.word_book_id && mat.total_words) {
      // Open word test assignment dialog
      setWordTestDialog({
        open: true,
        materialKey: mat.key,
        materialName: mat.name,
        wordBookId: mat.word_book_id,
        totalWords: mat.total_words,
      });
      setWtStartNum(1);
      setWtEndNum(mat.total_words);
      setWtWordsPerTest(100);
      setWtQuestionsPerTest(50);
      setWtRowsPerSide(50);
    } else {
      handleToggle(mat.key, "assign");
    }
  };

  const handleAssignWordTest = () => {
    if (!wordTestDialog) return;
    assignWordTest.mutate(
      {
        word_book_id: wordTestDialog.wordBookId,
        start_num: wtStartNum,
        end_num: wtEndNum,
        words_per_test: wtWordsPerTest,
        questions_per_test: wtQuestionsPerTest,
        rows_per_side: wtRowsPerSide,
      },
      {
        onSuccess: () => {
          toast.success("単語テスト教材を割り当てました（PDF生成完了）");
          setWordTestDialog(null);
        },
        onError: () => {
          toast.error("割り当てに失敗しました");
        },
      }
    );
  };

  // Preview: how many tests will be generated
  const wtPreviewTests = useMemo(() => {
    if (!wordTestDialog) return [];
    const tests: string[] = [];
    for (let i = wtStartNum; i <= wtEndNum; i += wtWordsPerTest) {
      const end = Math.min(i + wtWordsPerTest - 1, wtEndNum);
      tests.push(`${i}-${end}`);
    }
    return tests;
  }, [wordTestDialog, wtStartNum, wtEndNum, wtWordsPerTest]);

  const handlePointerChange = (materialKey: string, value: number, max: number) => {
    const clamped = Math.max(1, Math.min(value, max));
    setEditedPointers((prev) => ({ ...prev, [materialKey]: clamped }));
  };

  const handleSavePointers = () => {
    saveMutation.mutate(editedPointers, {
      onSuccess: () => {
        toast.success("ポインタを保存しました");
        setEditedPointers({});
      },
    });
  };

  const hasChanges = Object.keys(editedPointers).length > 0;
  const allAssigned = zones?.assigned || [];
  const allSource = zones?.source || [];

  // Split assigned into regular vs exam
  const assigned = useMemo(() => allAssigned.filter((m) => !m.exam_material_id), [allAssigned]);
  const assignedExam = useMemo(() => allAssigned.filter((m) => !!m.exam_material_id), [allAssigned]);

  const allCompleted = zones?.completed || [];

  // Split completed into regular vs exam
  const completedRegular = useMemo(() => allCompleted.filter((m) => !m.exam_material_id), [allCompleted]);
  const completedExam = useMemo(() => allCompleted.filter((m) => !!m.exam_material_id), [allCompleted]);

  // Split source into regular vs exam, group exams by exam_name
  const source = useMemo(() => allSource.filter((m) => !m.exam_material_id), [allSource]);
  const sourceExamGroups = useMemo(() => {
    const exams = allSource.filter((m) => !!m.exam_material_id);
    const groups: Record<string, { exam_name: string; exam_type: string; exam_year?: number; exam_university?: string; exam_faculty?: string; items: MaterialZoneItem[] }> = {};
    for (const m of exams) {
      const groupKey = `${m.exam_material_id}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          exam_name: m.exam_name || m.name,
          exam_type: m.exam_type || "common_test",
          exam_year: m.exam_year,
          exam_university: m.exam_university,
          exam_faculty: m.exam_faculty,
          items: [],
        };
      }
      groups[groupKey].items.push(m);
    }
    return Object.values(groups);
  }, [allSource]);

  // Filter nearly complete items for this student from dashboard data
  const nearlyComplete = (dashboard?.nearly_complete || []).filter(
    (item) => item.student_id === studentId
  );

  // Filter low accuracy items for this student
  const lowAccuracy = (dashboard?.low_accuracy || []).filter(
    (item) => item.student_id === studentId
  );

  return (
    <div className="space-y-8">
      {/* ── Assigned Materials (Grid Cards) ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-500/10">
              <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">教材一覧</h3>
              <p className="text-[11px] text-muted-foreground">
                {assigned.length}教材 割り当て中
                {assignedExam.length > 0 && ` / ${assignedExam.length}試験 実施中`}
              </p>
            </div>
          </div>
          {hasChanges && (
            <Button
              size="sm"
              onClick={handleSavePointers}
              disabled={saveMutation.isPending}
              className="h-8 px-4 text-xs rounded-lg shadow-sm"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saveMutation.isPending ? "保存中..." : "ポインタ保存"}
            </Button>
          )}
        </div>

        {assigned.length === 0 && assignedExam.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border-2 border-dashed border-border/50 bg-muted/10">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted/50 mb-4">
              <BookOpen className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">教材が割り当てられていません</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              下の一覧から教材を追加してください
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assigned.map((mat) => {
              const currentPointer = editedPointers[mat.key] ?? mat.pointer ?? 1;
              const completed = Math.min(currentPointer - 1, mat.max_node || mat.total_nodes);
              const total = mat.max_node || mat.total_nodes;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              const isWordTest = mat.key.startsWith("単語:");
              const isReviewMode = isWordTest && currentPointer > total;
              const isEdited = editedPointers[mat.key] !== undefined;
              const strokeColor = isReviewMode ? "#8b5cf6" : pct >= 90 ? "#10b981" : pct >= 50 ? "#3b82f6" : pct > 0 ? "#f59e0b" : "#d1d5db";
              const bgGlow = isReviewMode ? "shadow-violet-200/30 dark:shadow-violet-800/20" : pct >= 90 ? "shadow-emerald-200/30 dark:shadow-emerald-800/20" : pct >= 50 ? "shadow-blue-200/30 dark:shadow-blue-800/20" : "";
              const size = 64;
              const sw = 5;
              const r = (size - sw) / 2;
              const circ = 2 * Math.PI * r;
              const offset = circ - (Math.min(pct, 100) / 100) * circ;

              // Check if this material has a nearly complete reminder
              const nearlyItem = nearlyComplete.find((nc) => nc.material_key === mat.key);

              return (
                <div
                  key={mat.key}
                  className={cn(
                    "group relative rounded-2xl border transition-all duration-300",
                    "hover:shadow-lg hover:-translate-y-0.5",
                    bgGlow && `shadow-md ${bgGlow}`,
                    isReviewMode
                      ? "bg-gradient-to-br from-violet-50/60 to-violet-100/30 dark:from-violet-950/30 dark:to-violet-900/10 border-violet-300/60 dark:border-violet-700/40"
                      : "bg-card",
                    isEdited
                      ? "border-primary/40 ring-2 ring-primary/10"
                      : nearlyItem && !isReviewMode
                      ? "border-amber-300/60 dark:border-amber-700/40"
                      : !isReviewMode
                      ? "border-border/60 hover:border-border"
                      : ""
                  )}
                >
                  <div className="p-4">
                    {/* Top row: badges */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isReviewMode && (
                          <Badge className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 border-0">
                            総復習中
                          </Badge>
                        )}
                        {nearlyItem && (
                          <Badge className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-0">
                            残り{nearlyItem.remaining}
                          </Badge>
                        )}
                        {isWordTest && !isReviewMode && (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full">
                            単語テスト
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() =>
                            setExpandedMaterial(
                              expandedMaterial === mat.key ? null : mat.key
                            )
                          }
                          title="PDFプレビュー"
                        >
                          {expandedMaterial === mat.key ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={() => handleToggle(mat.key, "remove")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Main content: circle + info */}
                    <div className="flex items-center gap-4">
                      {/* Large circular progress */}
                      <div className="relative shrink-0">
                        <svg width={size} height={size} className="-rotate-90" overflow="visible">
                          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={sw} className="text-muted/30" />
                          <circle
                            cx={size / 2} cy={size / 2} r={r} fill="none"
                            stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
                            strokeDasharray={circ} strokeDashoffset={offset}
                            style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-base font-bold tabular-nums">{pct}%</span>
                        </div>
                      </div>

                      {/* Material info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold truncate mb-2">{mat.name}</h4>

                        {/* Progress bar (visual complement) */}
                        <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden mb-2">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              backgroundColor: strokeColor,
                            }}
                          />
                        </div>

                        {/* Stepper row */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {completed}/{total} 完了
                          </span>
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 rounded-l-lg rounded-r-none border-r-0"
                              onClick={() =>
                                handlePointerChange(mat.key, currentPointer - 1, total)
                              }
                              disabled={currentPointer <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <div className="flex items-center h-7 px-2.5 border-y border-border bg-muted/30 text-xs font-mono tabular-nums min-w-[52px] justify-center">
                              {currentPointer}/{total}
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 rounded-r-lg rounded-l-none border-l-0"
                              onClick={() =>
                                handlePointerChange(mat.key, currentPointer + 1, total)
                              }
                              disabled={currentPointer >= total}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Node Preview Panel */}
                  {expandedMaterial === mat.key && (
                    <NodePreviewPanel studentId={studentId} materialKey={mat.key} />
                  )}
                </div>
              );
            })}

            {/* Assigned Exam Cards in same grid */}
            {assignedExam.map((mat) => (
              <div
                key={mat.key}
                className="group relative rounded-2xl border border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/50 to-violet-100/20 dark:from-violet-950/30 dark:to-violet-900/10 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 shadow-sm shadow-violet-200/20"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Badge className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 border-0">
                      反映待ち
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => handleToggle(mat.key, "remove")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-14 w-14 rounded-xl bg-violet-100/80 dark:bg-violet-900/50 shrink-0">
                      {mat.exam_type === "university_past" ? (
                        <School className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                      ) : (
                        <GraduationCap className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold truncate mb-1">{mat.name}</h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">
                          {mat.exam_type === "common_test" ? "共通テスト" : "大学過去問"}
                        </span>
                        {mat.exam_year && (
                          <span className="text-[11px] text-muted-foreground">{mat.exam_year}年</span>
                        )}
                        {mat.exam_university && (
                          <span className="text-[11px] text-muted-foreground">{mat.exam_university}</span>
                        )}
                        {mat.exam_faculty && (
                          <span className="text-[11px] text-muted-foreground">{mat.exam_faculty}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Reminders Section ── */}
      {(nearlyComplete.length > 0 || lowAccuracy.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nearly Complete Reminder */}
          {nearlyComplete.length > 0 && (
            <div className="rounded-2xl border border-amber-200/60 dark:border-amber-800/40 bg-gradient-to-br from-amber-50/60 to-amber-100/20 dark:from-amber-950/30 dark:to-amber-900/10 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-amber-200/40 dark:border-amber-800/30">
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    完了間近リマインド
                  </span>
                </div>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full">
                  {nearlyComplete.length} 件
                </Badge>
              </div>
              <div className="p-3 space-y-2">
                {nearlyComplete.map((item) => (
                  <div
                    key={`${item.student_id}-${item.material_key}`}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                      item.acknowledged
                        ? "bg-amber-100/30 dark:bg-amber-900/10 opacity-50"
                        : "bg-white/60 dark:bg-white/5 border border-amber-200/40 dark:border-amber-800/30"
                    )}
                  >
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
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                      ) : (
                        <Circle className="h-4.5 w-4.5 text-muted-foreground/40 hover:text-amber-500" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm font-medium", item.acknowledged && "line-through")}>{item.material_name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          残り {item.remaining}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {item.pointer} / {item.total_nodes}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low Accuracy Reminder */}
          {lowAccuracy.length > 0 && (
            <div className="rounded-2xl border border-red-200/60 dark:border-red-800/40 bg-gradient-to-br from-red-50/60 to-red-100/20 dark:from-red-950/30 dark:to-red-900/10 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-red-200/40 dark:border-red-800/30">
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-red-100 dark:bg-red-900/50">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-red-700 dark:text-red-300">
                    定着度不足リマインド
                  </span>
                  <span className="text-[10px] text-red-500/70 dark:text-red-400/70 ml-1.5">
                    2回連続6割未満
                  </span>
                </div>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full">
                  {lowAccuracy.length} 件
                </Badge>
              </div>
              <div className="p-3 space-y-2">
                {lowAccuracy.map((item) => (
                  <div
                    key={`${item.student_id}-${item.material_key}-${item.node_key}`}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                      item.acknowledged
                        ? "bg-red-100/30 dark:bg-red-900/10 opacity-50"
                        : "bg-white/60 dark:bg-white/5 border border-red-200/40 dark:border-red-800/30"
                    )}
                  >
                    <button
                      type="button"
                      className="shrink-0 transition-colors"
                      onClick={() => {
                        if (item.acknowledged) {
                          unackLowMutation.mutate({
                            student_id: item.student_id,
                            material_key: item.material_key,
                            node_key: item.node_key,
                          });
                        } else {
                          ackLowMutation.mutate({
                            student_id: item.student_id,
                            material_key: item.material_key,
                            node_key: item.node_key,
                          });
                        }
                      }}
                      title={item.acknowledged ? "対処済みを取消" : "対処済みにする"}
                    >
                      {item.acknowledged ? (
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                      ) : (
                        <Circle className="h-4.5 w-4.5 text-muted-foreground/40 hover:text-red-500" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm font-medium", item.acknowledged && "line-through")}>
                        {item.material_name}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="rounded-full bg-red-100 dark:bg-red-900/50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300">
                          {item.node_title || item.node_key}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {item.streak}回連続6割未満
                          {item.latest_rates.length > 0 && ` (直近: ${Math.round(item.latest_rates[0] * 100)}%)`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Completed Materials ── */}
      {(completedRegular.length > 0 || completedExam.length > 0) && (
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-500/10">
              <Archive className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">実施済み教材</h3>
              <p className="text-[11px] text-muted-foreground">
                {completedRegular.length + completedExam.length}教材 完了
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {completedExam.map((mat) => (
              <div
                key={mat.key}
                className="group flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-slate-50/30 dark:bg-slate-900/20 px-3 py-3 transition-all hover:shadow-sm hover:border-slate-300"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800/50 shrink-0">
                  {mat.exam_type === "university_past" ? (
                    <School className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  ) : (
                    <GraduationCap className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block text-muted-foreground">{mat.name}</span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {mat.exam_type === "common_test" ? "共通テスト" : "大学過去問"}
                    {mat.exam_year ? ` ${mat.exam_year}年` : ""}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary shrink-0"
                  onClick={() => handleToggle(mat.key, "assign")}
                  title="再割り当て"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {completedRegular.map((mat) => (
              <div
                key={mat.key}
                className="group flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-slate-50/30 dark:bg-slate-900/20 px-3 py-3 transition-all hover:shadow-sm hover:border-slate-300"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800/50 shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block text-muted-foreground">{mat.name}</span>
                  <span className="text-[10px] text-muted-foreground/70">
                    <Layers className="h-2.5 w-2.5 inline mr-0.5" />
                    {mat.archived_pointer || mat.total_nodes} / {mat.total_nodes} 完了
                    {mat.archived_at && ` · ${new Date(mat.archived_at).toLocaleDateString("ja-JP")}`}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary shrink-0"
                  onClick={() => handleSourceClick(mat)}
                  title="再割り当て"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Available Regular Materials (Grid) ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/10">
            <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-bold">追加可能な教材</h3>
            <p className="text-[11px] text-muted-foreground">
              クリックで割り当て
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full ml-auto">
            {source.length}
          </Badge>
        </div>

        {source.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center rounded-2xl border-2 border-dashed border-border/50 bg-muted/10">
            <Package className="h-7 w-7 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">追加可能な教材はありません</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {source.map((mat) => (
              <button
                key={mat.key}
                type="button"
                onClick={() => handleSourceClick(mat)}
                disabled={toggleMutation.isPending || assignWordTest.isPending}
                className={cn(
                  "group/add relative flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-3 py-4",
                  "border-emerald-200/60 dark:border-emerald-800/40",
                  "hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20",
                  "hover:shadow-md hover:-translate-y-0.5",
                  "transition-all duration-200 text-center cursor-pointer",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center h-10 w-10 rounded-xl shrink-0",
                  "bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
                  "group-hover/add:bg-emerald-500 group-hover/add:text-white group-hover/add:scale-110",
                  "transition-all duration-200"
                )}>
                  <Plus className="h-5 w-5" />
                </div>
                <div className="min-w-0 w-full">
                  <span className="text-xs font-semibold truncate block">{mat.name}</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 justify-center">
                    {mat.word_book_id ? (
                      <>
                        <FileText className="h-2.5 w-2.5" />
                        {mat.total_words}語
                      </>
                    ) : (
                      <>
                        <Layers className="h-2.5 w-2.5" />
                        {mat.total_nodes} 範囲
                      </>
                    )}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Available Exam Materials (grouped by exam) ── */}
      {sourceExamGroups.length > 0 && (
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-violet-500/10">
              <GraduationCap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">追加可能な試験教材</h3>
              <p className="text-[11px] text-muted-foreground">
                科目単位で追加できます
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sourceExamGroups.map((group) => {
              const isCommon = group.exam_type === "common_test";
              return (
                <div
                  key={group.exam_name}
                  className={cn(
                    "rounded-2xl border overflow-hidden transition-all hover:shadow-md",
                    isCommon
                      ? "border-blue-200/60 dark:border-blue-800/40"
                      : "border-orange-200/60 dark:border-orange-800/40"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 border-b",
                      isCommon
                        ? "bg-gradient-to-r from-blue-50/70 to-blue-100/30 dark:from-blue-950/30 dark:to-blue-900/10 border-blue-200/40 dark:border-blue-800/30"
                        : "bg-gradient-to-r from-orange-50/70 to-orange-100/30 dark:from-orange-950/30 dark:to-orange-900/10 border-orange-200/40 dark:border-orange-800/30"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center h-9 w-9 rounded-xl shrink-0",
                      isCommon ? "bg-blue-100 dark:bg-blue-900/50" : "bg-orange-100 dark:bg-orange-900/50"
                    )}>
                      {isCommon ? (
                        <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <School className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-bold">{group.exam_name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 rounded-full",
                            isCommon
                              ? "border-blue-300 text-blue-600 dark:text-blue-400"
                              : "border-orange-300 text-orange-600 dark:text-orange-400"
                          )}
                        >
                          {isCommon ? "共通テスト" : "大学過去問"}
                        </Badge>
                        {group.exam_year && (
                          <span className="text-[10px] text-muted-foreground">{group.exam_year}年</span>
                        )}
                        {group.exam_university && (
                          <span className="text-[10px] text-muted-foreground">{group.exam_university}</span>
                        )}
                        {group.exam_faculty && (
                          <span className="text-[10px] text-muted-foreground">{group.exam_faculty}</span>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full shrink-0">
                      {group.items.length}科目
                    </Badge>
                  </div>

                  <div className="p-3 grid grid-cols-2 gap-2">
                    {group.items.map((mat) => {
                      const subjectName = mat.name.replace(group.exam_name, "").trim() || mat.name;
                      return (
                        <button
                          key={mat.key}
                          type="button"
                          onClick={() => handleToggle(mat.key, "assign")}
                          disabled={toggleMutation.isPending}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border-2 border-dashed border-border/40 px-3 py-2.5",
                            "bg-card hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-sm hover:-translate-y-0.5",
                            "transition-all duration-200 text-left cursor-pointer",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                          )}
                        >
                          <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-xs font-semibold truncate">{subjectName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All assigned state */}
      {allSource.length === 0 && sourceExamGroups.length === 0 && allCompleted.length === 0 && (assigned.length > 0 || assignedExam.length > 0) && (
        <div className="flex items-center gap-3 py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-50/60 to-emerald-100/30 dark:from-emerald-950/30 dark:to-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/30">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span className="text-sm text-emerald-700 dark:text-emerald-300 font-semibold">
            全ての教材が割り当て済みです
          </span>
        </div>
      )}

      {/* Word Test Assignment Dialog */}
      <Dialog
        open={wordTestDialog?.open ?? false}
        onOpenChange={(open) => {
          if (!open) setWordTestDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>単語テスト割り当て</DialogTitle>
          </DialogHeader>
          {wordTestDialog && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{wordTestDialog.materialName}</span>
                <Badge variant="secondary">{wordTestDialog.totalWords}語</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">開始番号</label>
                  <Input
                    type="number"
                    min={1}
                    max={wordTestDialog.totalWords}
                    value={wtStartNum}
                    onChange={(e) => setWtStartNum(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">終了番号</label>
                  <Input
                    type="number"
                    min={wtStartNum}
                    max={wordTestDialog.totalWords}
                    value={wtEndNum}
                    onChange={(e) => setWtEndNum(Math.min(wordTestDialog.totalWords, parseInt(e.target.value) || wordTestDialog.totalWords))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">範囲サイズ</label>
                  <Input
                    type="number"
                    min={1}
                    max={wordTestDialog.totalWords}
                    value={wtWordsPerTest}
                    onChange={(e) => setWtWordsPerTest(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">出題数（各側）</label>
                  <Input
                    type="number"
                    min={1}
                    max={wtRowsPerSide}
                    value={wtQuestionsPerTest}
                    onChange={(e) => setWtQuestionsPerTest(Math.max(1, Math.min(wtRowsPerSide, parseInt(e.target.value) || 1)))}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">行数（各側）</label>
                <div className="flex gap-2">
                  {([30, 50] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setWtRowsPerSide(n);
                        if (wtQuestionsPerTest > n) setWtQuestionsPerTest(n);
                      }}
                      className={cn(
                        "flex-1 py-1.5 rounded-md text-sm font-medium border transition-colors",
                        wtRowsPerSide === n
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
                      )}
                    >
                      {n}行
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="text-xs font-medium mb-1.5">
                  {wtPreviewTests.length}テスト生成されます
                </div>
                <div className="text-[10px] text-muted-foreground mb-1.5">
                  各テスト: 左側＝復習{wtQuestionsPerTest}問（過去範囲からランダム）、右側＝新出{wtQuestionsPerTest}問（範囲からランダム）
                </div>
                <div className="flex flex-wrap gap-1">
                  {wtPreviewTests.map((range, idx) => (
                    <Badge key={range} variant="outline" className="text-[10px]">
                      {range}{idx === 0 ? "（復習なし）" : ""}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleAssignWordTest}
                disabled={assignWordTest.isPending || wtStartNum > wtEndNum}
                className="w-full"
              >
                {assignWordTest.isPending ? "生成・割り当て中..." : "割り当て（PDF生成）"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
