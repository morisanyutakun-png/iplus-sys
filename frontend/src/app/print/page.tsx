"use client";

import { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useQueue,
  useAddToQueue,
  useRemoveFromQueue,
  useClearQueue,
  useRemoveStudentFromQueue,
  previewUrl,
  previewQueueItemUrl,
  fetchMergedPdfBlob,
  useUndoPrintJob,
} from "@/lib/queries/queue";
import { useStudents } from "@/lib/queries/students";
import { useMaterials } from "@/lib/queries/materials";
import { useJobs, useLogs } from "@/lib/queries/progress";
import { useAutoQueue } from "@/lib/queries/auto-print";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Plus,
  Trash2,
  Printer,
  Zap,
  ClipboardList,
  CheckCircle,
  XCircle,
  ScrollText,
  ChevronDown,
  ChevronRight,
  User,
  Eye,
  Loader2,
  Undo2,
} from "lucide-react";
import type { QueueItem } from "@/lib/types";

const JOB_STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "outline" | "secondary" | "destructive" }
> = {
  created: { label: "作成済", variant: "outline" },
  sending: { label: "送信中", variant: "secondary" },
  completed: { label: "完了", variant: "default" },
  failed: { label: "失敗", variant: "destructive" },
};

function isAnswerType(pdfType: string) {
  return pdfType === "answer" || pdfType === "recheck_answer";
}

function pdfTypeLabel(pdfType: string) {
  switch (pdfType) {
    case "answer": return "解答";
    case "recheck_question": return "リチェック";
    case "recheck_answer": return "リチェック解答";
    default: return "問題";
  }
}

function pdfTypeBadgeVariant(pdfType: string): "default" | "outline" | "secondary" {
  if (isAnswerType(pdfType)) return "secondary";
  if (pdfType === "recheck_question") return "default";
  return "outline";
}

const QUESTION_PDF_TYPES = ["question", "recheck_question"];
const ANSWER_PDF_TYPES = ["answer", "recheck_answer"];

type StudentGroup = {
  studentId: string;
  studentName: string;
  studentGrade?: string;
  questionItems: QueueItem[];
  answerItems: QueueItem[];
};

function QueueItemRow({ item, onRemove, onPreview }: {
  item: QueueItem;
  onRemove: (id: number) => void;
  onPreview: (item: QueueItem) => void;
}) {
  return (
    <TableRow>
      <TableCell className="text-sm">
        {item.material_name || item.material_key}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {item.node_name || item.node_key || "-"}
      </TableCell>
      <TableCell>
        <Badge variant={pdfTypeBadgeVariant(item.pdf_type)} className="text-xs">
          {pdfTypeLabel(item.pdf_type)}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {(item.node_key || item.generated_pdf) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => onPreview(item)}
              title="プレビュー"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function PrintPage() {
  const queryClient = useQueryClient();
  const { data: items } = useQueue();
  const { data: students } = useStudents();
  const { data: materials } = useMaterials();
  const { data: jobs } = useJobs();
  const { data: logs } = useLogs();
  const addMutation = useAddToQueue();
  const removeMutation = useRemoveFromQueue();
  const clearQueueMutation = useClearQueue();
  const removeStudentMutation = useRemoveStudentFromQueue();
  const autoQueueMutation = useAutoQueue();
  const undoMutation = useUndoPrintJob();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [selectedNode, setSelectedNode] = useState("");
  const [merging, setMerging] = useState(false);
  const [mergingKey, setMergingKey] = useState<string | null>(null);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );
  const [previewNodeKey, setPreviewNodeKey] = useState<string | null>(null);
  const [previewPdfType, setPreviewPdfType] = useState<string>("question");
  const [previewQueueItemId, setPreviewQueueItemId] = useState<number | null>(null);

  const selectedMat = materials?.find((m) => m.key === selectedMaterial);

  const [queueFilter, setQueueFilter] = useState<"all" | "questions" | "answers">("all");
  const [autoQueueMode, setAutoQueueMode] = useState<string>("both");

  // Group queue items by student, split into question/answer groups
  const groupedQueue = useMemo<StudentGroup[]>(() => {
    if (!items || items.length === 0) return [];
    const map = new Map<string, StudentGroup>();
    for (const item of items) {
      const key = item.student_id;
      if (!map.has(key)) {
        map.set(key, {
          studentId: key,
          studentName: item.student_name || key,
          studentGrade: item.student_grade,
          questionItems: [],
          answerItems: [],
        });
      }
      const group = map.get(key)!;
      if (isAnswerType(item.pdf_type)) {
        group.answerItems.push(item);
      } else {
        group.questionItems.push(item);
      }
    }
    return Array.from(map.values());
  }, [items]);

  const toggleGroup = (studentId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleAdd = () => {
    if (!selectedStudent || !selectedMaterial) return;
    addMutation.mutate(
      {
        student_id: selectedStudent,
        material_key: selectedMaterial,
        node_key: selectedNode || undefined,
      },
      {
        onSuccess: () => {
          toast.success("キューに追加しました");
          setDialogOpen(false);
          setSelectedStudent("");
          setSelectedMaterial("");
          setSelectedNode("");
        },
      }
    );
  };

  const handleRemove = (id: number) => {
    removeMutation.mutate(id, {
      onSuccess: () => toast.success("キューから削除しました"),
    });
  };

  const handleClearAll = () => {
    clearQueueMutation.mutate(undefined, {
      onSuccess: (data) => toast.success(`${(data as { deleted: number }).deleted}件をキューから削除しました`),
      onError: () => toast.error("全削除に失敗しました"),
    });
  };

  const handleRemoveStudent = (studentId: string, studentName: string, pdfTypes?: string[]) => {
    const label = pdfTypes ? (pdfTypes.some(t => t.includes("answer")) ? "解答" : "問題") : "";
    removeStudentMutation.mutate(
      { studentId, pdfTypes },
      {
        onSuccess: (data) => toast.success(`${studentName}の${label}${(data as { deleted: number }).deleted}件を削除しました`),
        onError: () => toast.error("削除に失敗しました"),
      }
    );
  };

  const handleAutoQueueAll = () => {
    autoQueueMutation.mutate(
      { printMode: autoQueueMode },
      {
        onSuccess: (data) =>
          toast.success(
            `${data.students}名の生徒から${data.queued}件をキューに追加しました`
          ),
        onError: (err: Error) => toast.error(`エラー: ${err.message}`),
      }
    );
  };

  // Open merged PDF in a new tab for printing.
  // The window is opened synchronously inside the click handler to avoid
  // Safari / macOS popup-blocker, then navigated to the blob URL once ready.
  const openMergedPdf = useCallback(async (params?: {
    studentIds?: string[];
    pdfTypes?: string[];
    key?: string;
  }) => {
    const loadingKey = params?.key || "all";
    if (loadingKey === "all") setMerging(true);
    else setMergingKey(loadingKey);

    // Open window synchronously (user-gesture context) so it won't be blocked
    const printWindow = window.open("about:blank", "_blank");
    if (printWindow) {
      printWindow.document.title = "PDF を準備中...";
      printWindow.document.write(`<!DOCTYPE html><html><head><title>PDF を準備中...</title>
        <style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,sans-serif;color:#666}
        .spinner{width:24px;height:24px;border:3px solid #e5e7eb;border-top-color:#6366f1;border-radius:50%;animation:spin .6s linear infinite;margin-right:12px}
        @keyframes spin{to{transform:rotate(360deg)}}</style></head>
        <body><div class="spinner"></div>PDF を結合しています...</body></html>`);
      printWindow.document.close();
    }

    try {
      const { blob, missingCount, jobId } = await fetchMergedPdfBlob({
        studentIds: params?.studentIds,
        pdfTypes: params?.pdfTypes,
      });

      if (missingCount > 0) {
        toast.warning(`${missingCount}件のPDFが見つかりませんでした（スキップ済）`);
      }

      // Save job ID for undo, refresh queue
      if (jobId) setLastJobId(jobId);
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });

      const url = URL.createObjectURL(blob);

      if (printWindow && !printWindow.closed) {
        // Write an HTML page with an embedded PDF iframe that auto-triggers print
        printWindow.document.open();
        printWindow.document.write(`<!DOCTYPE html><html><head><title>印刷プレビュー</title>
          <style>*{margin:0;padding:0}html,body{height:100%;overflow:hidden}
          iframe{border:none;width:100%;height:100%}</style></head>
          <body><iframe id="pdf" src="${url}"></iframe>
          <script>
            var iframe = document.getElementById("pdf");
            iframe.onload = function() {
              setTimeout(function() {
                try { iframe.contentWindow.print(); }
                catch(e) { window.print(); }
              }, 500);
            };
          </script></body></html>`);
        printWindow.document.close();
      } else {
        // Fallback: window was closed or blocked — download instead
        const a = document.createElement("a");
        a.href = url;
        a.download = "print_preview.pdf";
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (err) {
      if (printWindow && !printWindow.closed) printWindow.close();
      toast.error(err instanceof Error ? err.message : "PDF結合に失敗しました");
    } finally {
      if (loadingKey === "all") setMerging(false);
      else setMergingKey(null);
    }
  }, [queryClient]);

  const handlePrintAll = () => {
    openMergedPdf();
  };

  const handlePrintStudent = (studentId: string, studentName: string, pdfTypes?: string[]) => {
    const key = pdfTypes ? `${studentId}:${pdfTypes.join(",")}` : studentId;
    openMergedPdf({ studentIds: [studentId], pdfTypes, key });
  };

  const handleUndo = () => {
    if (!lastJobId) return;
    undoMutation.mutate(lastJobId, {
      onSuccess: (data) => {
        toast.success(`印刷キューを復元しました（${data.restored}件）`);
        setLastJobId(null);
      },
      onError: (err: Error) => toast.error(`復元エラー: ${err.message}`),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">印刷</h1>
        <p className="mt-1 text-muted-foreground">
          印刷キュー・ジョブ履歴・ログを管理
        </p>
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">
            キュー
            {items && items.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {items.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="jobs">ジョブ履歴</TabsTrigger>
          <TabsTrigger value="logs">ログ</TabsTrigger>
        </TabsList>

        {/* Queue Tab */}
        <TabsContent value="queue" className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Select value={autoQueueMode} onValueChange={setAutoQueueMode}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">問題+解答</SelectItem>
                  <SelectItem value="questions_only">問題のみ</SelectItem>
                  <SelectItem value="answers_only">解答のみ</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAutoQueueAll}
                disabled={autoQueueMutation.isPending}
              >
                <Zap className="mr-2 h-4 w-4" />
                {autoQueueMutation.isPending
                  ? "処理中..."
                  : "全生徒の次回分を自動追加"}
              </Button>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!items?.length || clearQueueMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  全削除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>キューを全削除</AlertDialogTitle>
                  <AlertDialogDescription>
                    印刷キューのアイテム{items?.length || 0}件をすべて削除しますか？この操作は取り消せません。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll}>全削除</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex items-center gap-1 border rounded-lg p-0.5">
              {(["all", "questions", "answers"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setQueueFilter(mode)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    queueFilter === mode
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode === "all" ? "全て" : mode === "questions" ? "問題" : "解答"}
                </button>
              ))}
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  手動追加
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>キューに追加</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      生徒
                    </label>
                    <Select
                      value={selectedStudent}
                      onValueChange={setSelectedStudent}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="生徒を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {(students || []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      教材
                    </label>
                    <Select
                      value={selectedMaterial}
                      onValueChange={(v) => {
                        setSelectedMaterial(v);
                        setSelectedNode("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="教材を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {(materials || []).map((m) => (
                          <SelectItem key={m.key} value={m.key}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedMat && (
                    <div>
                      <label className="mb-1 block text-sm font-medium">
                        範囲
                      </label>
                      <Select
                        value={selectedNode}
                        onValueChange={setSelectedNode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="範囲を選択（任意）" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedMat.nodes.map((n) => (
                            <SelectItem key={n.key} value={n.key}>
                              {n.sort_order}. {n.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={handleAdd}
                    disabled={
                      !selectedStudent ||
                      !selectedMaterial ||
                      addMutation.isPending
                    }
                  >
                    追加
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="ml-auto flex items-center gap-2">
              {lastJobId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUndo}
                  disabled={undoMutation.isPending}
                >
                  {undoMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Undo2 className="mr-2 h-4 w-4" />
                  )}
                  {undoMutation.isPending ? "復元中..." : "元に戻す"}
                </Button>
              )}
              <Button
                size="sm"
                onClick={handlePrintAll}
                disabled={!items?.length || merging}
              >
                {merging ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                {merging ? "PDF結合中..." : "全て印刷"}
              </Button>
            </div>
          </div>

          {/* Student-grouped queue */}
          {groupedQueue.length === 0 ? (
            <Card className="border-0 shadow-premium">
              <CardContent className="py-16 text-center">
                <Printer className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">
                  キューは空です
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {groupedQueue.map((group) => {
                const studentKey = group.studentId;
                const isPrinting = mergingKey === studentKey ||
                  mergingKey === `${studentKey}:${QUESTION_PDF_TYPES.join(",")}` ||
                  mergingKey === `${studentKey}:${ANSWER_PDF_TYPES.join(",")}`;
                const isCollapsed = collapsedGroups.has(studentKey);
                return (
                  <Card
                    key={studentKey}
                    className="border-0 shadow-premium overflow-hidden"
                  >
                    {/* Student header */}
                    <div className="flex items-center bg-muted/30 hover:bg-muted/50 transition-colors">
                      <button
                        type="button"
                        className="flex flex-1 items-center gap-3 px-4 py-3 cursor-pointer"
                        onClick={() => toggleGroup(studentKey)}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                        <User className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">
                          {group.studentName}
                        </span>
                        {group.studentGrade && (
                          <Badge variant="outline" className="text-[10px]">{group.studentGrade}</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">問{group.questionItems.length}</Badge>
                        <Badge variant="secondary" className="text-[10px]">解{group.answerItems.length}</Badge>
                      </button>
                      <div className="flex items-center gap-1.5 pr-3">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              disabled={removeStudentMutation.isPending}
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              全削除
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{group.studentName}のキューを全削除</AlertDialogTitle>
                              <AlertDialogDescription>
                                {group.studentName}のキューアイテム{group.questionItems.length + group.answerItems.length}件をすべて削除しますか？
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemoveStudent(studentKey, group.studentName)}>
                                全削除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handlePrintStudent(studentKey, group.studentName)}
                          disabled={isPrinting || merging}
                        >
                          {isPrinting ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Printer className="mr-1 h-3 w-3" />
                          )}
                          {isPrinting ? "結合中..." : "印刷"}
                        </Button>
                      </div>
                    </div>

                    {/* Queue items - split into question/answer groups */}
                    {!isCollapsed && (
                      <CardContent className="p-0 divide-y divide-border/40">
                        {(queueFilter === "all" || queueFilter === "questions") && group.questionItems.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50/50 dark:bg-blue-950/20 border-b border-border/30">
                              <Badge variant="outline" className="text-[10px] font-semibold">問題</Badge>
                              <span className="text-xs text-muted-foreground">{group.questionItems.length}件</span>
                              <div className="ml-auto flex items-center gap-1">
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                                  disabled={removeStudentMutation.isPending}
                                  onClick={() => handleRemoveStudent(studentKey, group.studentName, QUESTION_PDF_TYPES)}
                                >
                                  <Trash2 className="mr-1 h-3 w-3" />削除
                                </Button>
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-6 px-2 text-[10px]"
                                  disabled={merging || mergingKey === `${studentKey}:${QUESTION_PDF_TYPES.join(",")}`}
                                  onClick={() => handlePrintStudent(studentKey, group.studentName, QUESTION_PDF_TYPES)}
                                >
                                  {mergingKey === `${studentKey}:${QUESTION_PDF_TYPES.join(",")}` ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <Printer className="mr-1 h-3 w-3" />
                                  )}
                                  {mergingKey === `${studentKey}:${QUESTION_PDF_TYPES.join(",")}` ? "結合中..." : "印刷"}
                                </Button>
                              </div>
                            </div>
                            <Table>
                              <TableBody>
                                {group.questionItems.map((item) => (
                                  <QueueItemRow key={item.id} item={item} onRemove={handleRemove} onPreview={(qi) => { if (qi.generated_pdf) { setPreviewQueueItemId(qi.id); } else { setPreviewNodeKey(qi.node_key!); setPreviewPdfType(qi.pdf_type || "question"); } }} />
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        {(queueFilter === "all" || queueFilter === "answers") && group.answerItems.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50/50 dark:bg-amber-950/20 border-b border-border/30">
                              <Badge variant="secondary" className="text-[10px] font-semibold">解答</Badge>
                              <span className="text-xs text-muted-foreground">{group.answerItems.length}件</span>
                              <div className="ml-auto flex items-center gap-1">
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                                  disabled={removeStudentMutation.isPending}
                                  onClick={() => handleRemoveStudent(studentKey, group.studentName, ANSWER_PDF_TYPES)}
                                >
                                  <Trash2 className="mr-1 h-3 w-3" />削除
                                </Button>
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-6 px-2 text-[10px]"
                                  disabled={merging || mergingKey === `${studentKey}:${ANSWER_PDF_TYPES.join(",")}`}
                                  onClick={() => handlePrintStudent(studentKey, group.studentName, ANSWER_PDF_TYPES)}
                                >
                                  {mergingKey === `${studentKey}:${ANSWER_PDF_TYPES.join(",")}` ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <Printer className="mr-1 h-3 w-3" />
                                  )}
                                  {mergingKey === `${studentKey}:${ANSWER_PDF_TYPES.join(",")}` ? "結合中..." : "印刷"}
                                </Button>
                              </div>
                            </div>
                            <Table>
                              <TableBody>
                                {group.answerItems.map((item) => (
                                  <QueueItemRow key={item.id} item={item} onRemove={handleRemove} onPreview={(qi) => { if (qi.generated_pdf) { setPreviewQueueItemId(qi.id); } else { setPreviewNodeKey(qi.node_key!); setPreviewPdfType(qi.pdf_type || "question"); } }} />
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        {((queueFilter === "questions" && group.questionItems.length === 0) ||
                          (queueFilter === "answers" && group.answerItems.length === 0)) && (
                          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                            該当するアイテムがありません
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs">
          <Card className="border-0 shadow-premium overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">
                      ジョブID
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">
                      ステータス
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">
                      アイテム数
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">
                      不足PDF
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">
                      作成日時
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">
                      実行日時
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(jobs || []).map((job, idx) => {
                    const status = JOB_STATUS_MAP[job.status] || {
                      label: job.status,
                      variant: "outline" as const,
                    };
                    return (
                      <TableRow
                        key={job.id}
                        className="stagger-item hover:bg-muted/20 transition-colors"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <TableCell className="font-mono text-xs">
                          {job.id}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={status.variant}
                            className="rounded-full"
                          >
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{job.item_count}</TableCell>
                        <TableCell>
                          {job.missing > 0 ? (
                            <Badge
                              variant="destructive"
                              className="rounded-full"
                            >
                              {job.missing}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/50">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(job.created_at).toLocaleString("ja-JP")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {job.executed_at
                            ? new Date(job.executed_at).toLocaleString("ja-JP")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!jobs || jobs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center">
                        <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground">
                          ジョブ履歴はまだありません
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card className="border-0 shadow-premium overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-12 text-xs font-semibold uppercase tracking-wider">
                      状態
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">
                      生徒
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">
                      教材
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">
                      範囲
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">
                      タイプ
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">
                      日時
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(logs || []).map((log, idx) => (
                    <TableRow
                      key={log.id}
                      className="stagger-item hover:bg-muted/20 transition-colors"
                      style={{ animationDelay: `${idx * 20}ms` }}
                    >
                      <TableCell>
                        {log.success ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        ) : log.success === false ? (
                          <XCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.student_name || log.student_id || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.material_name || log.material_key || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.node_name || log.node_key || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="rounded-full text-xs"
                        >
                          {log.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("ja-JP")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!logs || logs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center">
                        <ScrollText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground">
                          ログはまだありません
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PDF Preview Dialog */}
      <Dialog
        open={!!(previewNodeKey || previewQueueItemId)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewNodeKey(null);
            setPreviewQueueItemId(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>PDF プレビュー</DialogTitle>
          </DialogHeader>
          {(previewNodeKey || previewQueueItemId) && (
            <iframe
              src={previewQueueItemId
                ? previewQueueItemUrl(previewQueueItemId)
                : previewUrl(previewNodeKey!, previewPdfType)
              }
              className="w-full flex-1 rounded border"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
