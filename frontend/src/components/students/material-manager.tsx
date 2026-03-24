"use client";

import { useState, useMemo } from "react";
import {
  useMaterialZones,
  useToggleMaterial,
  useSavePointers,
  useAssignWordTest,
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
import { Progress } from "@/components/ui/progress";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";

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
  const assigned = zones?.assigned || [];
  const source = zones?.source || [];

  // Filter nearly complete items for this student from dashboard data
  const nearlyComplete = (dashboard?.nearly_complete || []).filter(
    (item) => item.student_id === studentId
  );

  // Filter low accuracy items for this student
  const lowAccuracy = (dashboard?.low_accuracy || []).filter(
    (item) => item.student_id === studentId
  );

  return (
    <div className="space-y-6">
      {/* ── Unified Assigned Materials ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-6 w-6 rounded-md bg-blue-500/10">
              <BookOpen className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold">教材一覧</h3>
            {assigned.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full">
                {assigned.length}
              </Badge>
            )}
          </div>
          {hasChanges && (
            <Button
              size="sm"
              onClick={handleSavePointers}
              disabled={saveMutation.isPending}
              className="h-7 px-3 text-xs rounded-lg shadow-sm"
            >
              <Save className="mr-1.5 h-3 w-3" />
              {saveMutation.isPending ? "保存中..." : "ポインタ保存"}
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {assigned.map((mat) => {
            const currentPointer = editedPointers[mat.key] ?? mat.pointer ?? 1;
            const completed = currentPointer - 1;
            const total = mat.max_node || mat.total_nodes;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            const isEdited = editedPointers[mat.key] !== undefined;
            const strokeColor = pct >= 90 ? "#10b981" : pct >= 50 ? "#3b82f6" : pct > 0 ? "#f59e0b" : "#d1d5db";
            const size = 44;
            const sw = 4;
            const r = (size - sw) / 2;
            const circ = 2 * Math.PI * r;
            const offset = circ - (Math.min(pct, 100) / 100) * circ;

            // Check if this material has a nearly complete reminder
            const nearlyItem = nearlyComplete.find((nc) => nc.material_key === mat.key);

            return (
              <div
                key={mat.key}
                className={cn(
                  "group relative rounded-xl border transition-all duration-200",
                  "bg-card hover:shadow-md",
                  isEdited
                    ? "border-primary/30 bg-primary/[0.02]"
                    : nearlyItem
                    ? "border-amber-300/60 dark:border-amber-700/40"
                    : "border-border/60 hover:border-border"
                )}
              >
                <div className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    {/* Circular Progress */}
                    <svg width={size} height={size} className="shrink-0 -rotate-90">
                      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={sw} className="text-muted/40" />
                      <circle
                        cx={size / 2} cy={size / 2} r={r} fill="none"
                        stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
                        strokeDasharray={circ} strokeDashoffset={offset}
                        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}
                      />
                      <text
                        x={size / 2} y={size / 2}
                        textAnchor="middle" dominantBaseline="central"
                        className="fill-foreground rotate-90 origin-center"
                        fontSize={size * 0.24} fontWeight={600}
                      >
                        {pct}%
                      </text>
                    </svg>

                    {/* Material info + stepper */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold truncate pr-2">{mat.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {nearlyItem && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full border-amber-300 text-amber-600 dark:text-amber-400">
                              残り{nearlyItem.remaining}
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={() => handleToggle(mat.key, "remove")}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-2">
                        <Progress
                          value={Math.min(pct, 100)}
                          className="h-1.5"
                        />
                      </div>

                      {/* Stepper row */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          {completed}/{total} 完了
                        </span>
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6 rounded-l-md rounded-r-none border-r-0"
                            onClick={() =>
                              handlePointerChange(mat.key, currentPointer - 1, total)
                            }
                            disabled={currentPointer <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <div className="flex items-center h-6 px-2 border-y border-border bg-muted/30 text-xs font-mono tabular-nums min-w-[48px] justify-center">
                            {currentPointer}/{total}
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6 rounded-r-md rounded-l-none border-l-0"
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
              </div>
            );
          })}

          {assigned.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl border border-dashed border-border/50 bg-muted/20">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted/50 mb-3">
                <BookOpen className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">教材が割り当てられていません</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                下の一覧から教材を追加できます
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Reminders Section ── */}
      {(nearlyComplete.length > 0 || lowAccuracy.length > 0) && (
        <div className="space-y-4">
          {/* Nearly Complete Reminder */}
          {nearlyComplete.length > 0 && (
            <div className="rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200/40 dark:border-amber-800/30">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  完了間近リマインド
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full ml-auto">
                  {nearlyComplete.length} 件
                </Badge>
              </div>
              <div className="p-3 space-y-2">
                {nearlyComplete.map((item) => (
                  <div
                    key={`${item.student_id}-${item.material_key}`}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
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

          {/* Low Accuracy Reminder (2 consecutive below 60%) */}
          {lowAccuracy.length > 0 && (
            <div className="rounded-xl border border-red-200/60 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/20 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-200/40 dark:border-red-800/30">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                  定着度不足リマインド
                </span>
                <span className="text-[10px] text-red-500/70 dark:text-red-400/70 ml-1">
                  2回連続6割未満
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full ml-auto">
                  {lowAccuracy.length} 件
                </Badge>
              </div>
              <div className="p-3 space-y-2">
                {lowAccuracy.map((item) => (
                  <div
                    key={`${item.student_id}-${item.material_key}-${item.node_key}`}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
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

      {/* ── Available Materials ── */}
      {source.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/10">
              <Package className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold">追加可能な教材</h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full">
              {source.length}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {source.map((mat) => (
              <button
                key={mat.key}
                type="button"
                onClick={() => handleSourceClick(mat)}
                disabled={toggleMutation.isPending || assignWordTest.isPending}
                className={cn(
                  "group/add flex items-center gap-3 rounded-xl border border-border/50 px-3 py-2.5",
                  "bg-card hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-sm",
                  "transition-all duration-200 text-left cursor-pointer",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-lg shrink-0",
                  "bg-primary/10 text-primary",
                  "group-hover/add:bg-primary group-hover/add:text-primary-foreground",
                  "transition-all duration-200"
                )}>
                  <Plus className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium truncate block">{mat.name}</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
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

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">テストあたりの語数</label>
                <Select
                  value={String(wtWordsPerTest)}
                  onValueChange={(v) => setWtWordsPerTest(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50語</SelectItem>
                    <SelectItem value="100">100語</SelectItem>
                    <SelectItem value="200">200語</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preview */}
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="text-xs font-medium mb-1.5">
                  {wtPreviewTests.length}テスト生成されます
                </div>
                <div className="flex flex-wrap gap-1">
                  {wtPreviewTests.map((range) => (
                    <Badge key={range} variant="outline" className="text-[10px]">
                      {range}
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

      {/* All assigned state */}
      {source.length === 0 && assigned.length > 0 && (
        <div className="flex items-center gap-2 py-3 px-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
          <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
            全ての教材が割り当て済みです
          </span>
        </div>
      )}
    </div>
  );
}
