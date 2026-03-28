"use client";

import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useQueue,
  useAddToQueue,
  useRemoveFromQueue,
  useClearQueue,
  useRemoveStudentFromQueue,
  useExecutePrint,
  usePrinters,
  useAddPrinter,
  useRemovePrinter,
  useSetDefaultPrinter,
  useDiscoverPrinters,
  useRegisterPrinter,
  previewUrl,
  previewQueueItemUrl,
} from "@/lib/queries/queue";
import type { DiscoveredPrinter } from "@/lib/queries/queue";
import { useStudents } from "@/lib/queries/students";
import { useMaterials } from "@/lib/queries/materials";
import { useJobs, useLogs } from "@/lib/queries/progress";
import { useAutoQueue } from "@/lib/queries/auto-print";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
  RefreshCw,
  Eye,
  Settings,
  Star,
  Wifi,
  Loader2,
  Globe,
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

type PrinterSelectOption = {
  value: string;
  name: string;
  status: string;
  source: "configured" | "network";
  printerName?: string;
  discovered?: DiscoveredPrinter;
  needsSetup?: boolean;
};

const configuredPrinterValue = (name: string) => `configured:${name}`;
const discoveredPrinterValue = (uri: string) => `discovered:${uri}`;
const sanitizePrinterName = (name: string) =>
  name.replace(/[^a-zA-Z0-9_-]/g, "_");

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
  const { data: printerData, isFetching: printersRefreshing } = usePrinters();
  const addMutation = useAddToQueue();
  const removeMutation = useRemoveFromQueue();
  const clearQueueMutation = useClearQueue();
  const removeStudentMutation = useRemoveStudentFromQueue();
  const executeMutation = useExecutePrint();
  const autoQueueMutation = useAutoQueue();
  const addPrinterMutation = useAddPrinter();
  const removePrinterMutation = useRemovePrinter();
  const setDefaultPrinterMutation = useSetDefaultPrinter();
  const discoverMutation = useDiscoverPrinters();
  const registerMutation = useRegisterPrinter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [printerDialogOpen, setPrinterDialogOpen] = useState(false);
  const [newPrinterName, setNewPrinterName] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [selectedNode, setSelectedNode] = useState("");
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [printingStudents, setPrintingStudents] = useState<Set<string>>(
    new Set()
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );
  const [previewNodeKey, setPreviewNodeKey] = useState<string | null>(null);
  const [previewPdfType, setPreviewPdfType] = useState<string>("question");
  const [previewQueueItemId, setPreviewQueueItemId] = useState<number | null>(null);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<DiscoveredPrinter[]>([]);
  const [ipAddress, setIpAddress] = useState("");

  useEffect(() => {
    if (discoverMutation.isPending || discoveredPrinters.length > 0) return;
    discoverMutation.mutate(undefined, {
      onSuccess: (data) => setDiscoveredPrinters(data.discovered),
    });
  }, [discoverMutation, discoveredPrinters.length]);

  const selectedMat = materials?.find((m) => m.key === selectedMaterial);
  const printerOptions = useMemo(
    () => printerData?.printers ?? [],
    [printerData?.printers]
  );
  const printerSelectOptions = useMemo<PrinterSelectOption[]>(() => {
    const configured = printerOptions.map((printer) => ({
      value: configuredPrinterValue(printer.name),
      name: printer.name,
      status: printer.status,
      source: "configured" as const,
      printerName: printer.name,
    }));

    const configuredNames = new Set(printerOptions.map((printer) => printer.name));
    const discovered = discoveredPrinters
      .filter((printer) => {
        if (printer.already_configured && printer.cups_name && configuredNames.has(printer.cups_name)) {
          return false;
        }
        return true;
      })
      .map((printer) => {
        const printerName = printer.cups_name || sanitizePrinterName(printer.instance_name);
        const needsSetup = !printer.already_configured;
        return {
          value: discoveredPrinterValue(printer.uri),
          name: printer.instance_name,
          status: printer.already_configured ? "configured" : "network",
          source: "network" as const,
          printerName,
          discovered: printer,
          needsSetup,
        };
      });

    return [...configured, ...discovered];
  }, [discoveredPrinters, printerOptions]);

  const selectedPrinterOption = useMemo(
    () => printerSelectOptions.find((option) => option.value === selectedPrinter),
    [printerSelectOptions, selectedPrinter]
  );
  const activePrinterValue =
    selectedPrinter ||
    (printerData?.default ? configuredPrinterValue(printerData.default) : "");
  const effectivePrinter =
    selectedPrinterOption?.printerName || printerData?.default || "";

  const [queueFilter, setQueueFilter] = useState<"all" | "questions" | "answers">("all");

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

  const showPrintResult = (
    data: { results?: { success: boolean }[]; status?: string },
    label?: string
  ) => {
    const prefix = label ? `${label}: ` : "";
    if (!data.results || data.status === "queued") {
      toast.info(`${prefix}印刷ジョブをキューに登録しました（LAN内エージェントが処理します）`);
      return;
    }
    const successCount = data.results.filter((r) => r.success).length;
    const failCount = data.results.filter((r) => !r.success).length;
    if (failCount === 0) {
      toast.success(`${prefix}${successCount}件の印刷を実行しました`);
    } else if (successCount === 0) {
      toast.error(
        `${prefix}全${failCount}件が失敗しました（キューに残っています）`
      );
    } else {
      toast.warning(
        `${prefix}${successCount}件成功 / ${failCount}件失敗（失敗分はキューに残っています）`
      );
    }
  };

  const handlePrintAll = () => {
    ensureSelectedPrinterReady()
      .then((printerName) => {
        executeMutation.mutate(
          { printerName: printerName || undefined, useAgent: true },
          {
            onSuccess: (data) => showPrintResult(data),
            onError: (err) => toast.error(`印刷エラー: ${err.message}`),
          }
        );
      })
      .catch((err: Error) => toast.error(`印刷エラー: ${err.message}`));
  };

  const handlePrintStudent = (studentId: string, studentName: string, pdfTypes?: string[]) => {
    const key = pdfTypes ? `${studentId}:${pdfTypes.join(",")}` : studentId;
    setPrintingStudents((prev) => new Set(prev).add(key));
    const label = pdfTypes
      ? `${studentName}（${pdfTypes.some(t => t.includes("answer")) ? "解答" : "問題"}）`
      : studentName;
    ensureSelectedPrinterReady()
      .then((printerName) => {
        executeMutation.mutate(
          { printerName: printerName || undefined, studentIds: [studentId], pdfTypes, useAgent: true },
          {
            onSuccess: (data) => {
              showPrintResult(data, label);
              setPrintingStudents((prev) => {
                const next = new Set(prev);
                next.delete(key);
                return next;
              });
            },
            onError: (err) => {
              toast.error(`印刷エラー (${label}): ${err.message}`);
              setPrintingStudents((prev) => {
                const next = new Set(prev);
                next.delete(key);
                return next;
              });
            },
          }
        );
      })
      .catch((err: Error) => {
        toast.error(`印刷エラー (${label}): ${err.message}`);
        setPrintingStudents((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      });
  };

  const [autoQueueMode, setAutoQueueMode] = useState<string>("both");

  const handleAutoQueueAll = () => {
    autoQueueMutation.mutate(
      { printMode: autoQueueMode },
      {
        onSuccess: (data) =>
          toast.success(
            `${data.students}名の生徒から${data.queued}件をキューに追加しました`
          ),
        onError: (err) => toast.error(`エラー: ${err.message}`),
      }
    );
  };

  const handleRefreshPrinters = () => {
    queryClient.invalidateQueries({ queryKey: ["printers"] });
    discoverMutation.mutate(undefined, {
      onSuccess: (data) => {
        setDiscoveredPrinters(data.discovered);
        toast.success(`${data.discovered.length}台のLANプリンタ候補を更新しました`);
      },
      onError: (err) => toast.error(`プリンタ更新エラー: ${err.message}`),
    });
  };

  const handleAddPrinter = () => {
    const name = newPrinterName.trim();
    if (!name) return;
    addPrinterMutation.mutate(
      { name, is_default: printerOptions.length === 0 },
      {
        onSuccess: () => {
          toast.success(`プリンタ「${name}」を追加しました`);
          setNewPrinterName("");
          setSelectedPrinter(configuredPrinterValue(name));
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleRemovePrinter = (name: string) => {
    removePrinterMutation.mutate(name, {
      onSuccess: () => {
        toast.success(`プリンタ「${name}」を削除しました`);
        if (selectedPrinter === configuredPrinterValue(name)) setSelectedPrinter("");
      },
    });
  };

  const handleSetDefault = (name: string) => {
    setDefaultPrinterMutation.mutate(name, {
      onSuccess: () => {
        setSelectedPrinter(configuredPrinterValue(name));
        toast.success(`デフォルトを「${name}」に変更しました`);
      },
    });
  };

  const handleDiscoverPrinters = () => {
    setDiscoveredPrinters([]);
    discoverMutation.mutate(undefined, {
      onSuccess: (data) => {
        setDiscoveredPrinters(data.discovered);
        if (data.discovered.length === 0) {
          toast.info("LANプリンタが見つかりませんでした");
        } else {
          toast.success(`${data.discovered.length}台のプリンタを検出しました`);
        }
      },
      onError: (err) => toast.error(`LAN検索エラー: ${err.message}`),
    });
  };

  const handleRegisterPrinter = (printer: DiscoveredPrinter) => {
    if (printer.already_in_cups && printer.cups_name) {
      const cupsName = printer.cups_name;
      addPrinterMutation.mutate(
        { name: cupsName, is_default: printerOptions.length === 0 },
        {
          onSuccess: () => {
            toast.success(`プリンタ「${cupsName}」を登録しました`);
            setSelectedPrinter(configuredPrinterValue(cupsName));
            setDiscoveredPrinters((prev) =>
              prev.map((p) =>
                p.uri === printer.uri
                  ? { ...p, already_configured: true }
                  : p
              )
            );
          },
        }
      );
      return;
    }

    const safeName = printer.instance_name.replace(/[^a-zA-Z0-9_-]/g, "_");
    registerMutation.mutate(
      { uri: printer.uri, name: safeName, is_default: printerOptions.length === 0 },
      {
        onSuccess: () => {
          toast.success(`プリンタ「${safeName}」を登録しました`);
          setSelectedPrinter(configuredPrinterValue(safeName));
          setDiscoveredPrinters((prev) =>
            prev.map((p) =>
              p.uri === printer.uri
                ? { ...p, cups_name: safeName, already_configured: true }
                : p
            )
          );
        },
        onError: (err) => toast.error(`登録エラー: ${err.message}`),
      }
    );
  };

  const handleRegisterByIp = () => {
    const ip = ipAddress.trim();
    if (!ip) return;
    const uri = `ipp://${ip}:631/ipp/print`;
    const safeName = ip.replace(/\./g, "_");
    registerMutation.mutate(
      { uri, name: safeName, is_default: printerOptions.length === 0 },
      {
        onSuccess: () => {
          toast.success(`プリンタ（${ip}）を登録しました`);
          setIpAddress("");
          setSelectedPrinter(configuredPrinterValue(safeName));
        },
        onError: (err) => toast.error(`登録エラー: ${err.message}`),
      }
    );
  };

  const ensureSelectedPrinterReady = async () => {
    if (!selectedPrinterOption) {
      return effectivePrinter || undefined;
    }
    if (!selectedPrinterOption.needsSetup || !selectedPrinterOption.discovered) {
      return selectedPrinterOption.printerName || effectivePrinter || undefined;
    }

    const printer = selectedPrinterOption.discovered;
    if (printer.already_in_cups && printer.cups_name) {
      await addPrinterMutation.mutateAsync({
        name: printer.cups_name,
        is_default: printerOptions.length === 0,
      });
      setSelectedPrinter(configuredPrinterValue(printer.cups_name));
      setDiscoveredPrinters((prev) =>
        prev.map((item) =>
          item.uri === printer.uri
            ? { ...item, already_configured: true }
            : item
        )
      );
      return printer.cups_name;
    }

    const safeName = sanitizePrinterName(printer.instance_name);
    await registerMutation.mutateAsync({
      uri: printer.uri,
      name: safeName,
      is_default: printerOptions.length === 0,
    });
    setSelectedPrinter(configuredPrinterValue(safeName));
    setDiscoveredPrinters((prev) =>
      prev.map((item) =>
        item.uri === printer.uri
          ? { ...item, cups_name: safeName, already_configured: true }
          : item
      )
    );
    toast.success(`プリンタ「${safeName}」を利用できるようにしました`);
    return safeName;
  };

  const printerStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-emerald-500";
      case "configured":
        return "bg-emerald-500";
      case "network":
        return "bg-blue-500";
      case "unknown":
        return "bg-amber-400";
      default:
        return "bg-gray-400";
    }
  };

  const printerStatusLabel = (status: string) => {
    switch (status) {
      case "network":
        return "LAN";
      case "online":
        return "ローカル";
      case "configured":
        return "登録済";
      default:
        return "確認中";
    }
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

        {/* ─── Queue Tab ─── */}
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
              {/* Printer selector */}
              <div className="flex items-center gap-1.5">
                <Printer className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={activePrinterValue}
                  onValueChange={setSelectedPrinter}
                >
                  <SelectTrigger className="h-8 w-[280px] text-xs">
                    <SelectValue placeholder="プリンタを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {printerSelectOptions.length > 0 ? (
                      <>
                        <SelectGroup>
                          <SelectLabel>利用可能なプリンタ</SelectLabel>
                          {printerSelectOptions
                            .filter((option) => option.source === "configured")
                            .map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <span className="flex items-center gap-2">
                                  <span
                                    className={`inline-block h-2 w-2 rounded-full ${printerStatusColor(
                                      option.status
                                    )}`}
                                  />
                                  {option.name}
                                  {option.printerName === printerData?.default
                                    ? " (デフォルト)"
                                    : ""}
                                  <span className="text-muted-foreground">
                                    {printerStatusLabel(option.status)}
                                  </span>
                                </span>
                              </SelectItem>
                            ))}
                        </SelectGroup>
                        {printerSelectOptions.some((option) => option.source === "network") && (
                          <>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel>LANで見つかったプリンタ</SelectLabel>
                              {printerSelectOptions
                                .filter((option) => option.source === "network")
                                .map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <span className="flex items-center gap-2">
                                      <span
                                        className={`inline-block h-2 w-2 rounded-full ${printerStatusColor(
                                          option.status
                                        )}`}
                                      />
                                      {option.name}
                                      <span className="text-muted-foreground">
                                        {option.needsSetup ? "選択時に自動登録" : printerStatusLabel(option.status)}
                                      </span>
                                    </span>
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          </>
                        )}
                      </>
                    ) : (
                      <SelectItem value="__none" disabled>
                        プリンタ未登録
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={handleRefreshPrinters}
                  disabled={printersRefreshing}
                  title="再検出"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      printersRefreshing ? "animate-spin" : ""
                    }`}
                  />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setPrinterDialogOpen(true)}
                  title="プリンタ管理"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </div>
                <Button
                  size="sm"
                  onClick={handlePrintAll}
                  disabled={
                    !items?.length ||
                    executeMutation.isPending ||
                    registerMutation.isPending ||
                    addPrinterMutation.isPending
                  }
                >
                  <Printer className="mr-2 h-4 w-4" />
                  {executeMutation.isPending || registerMutation.isPending || addPrinterMutation.isPending
                    ? "実行中..."
                    : "全件印刷"}
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
                const isCollapsed = collapsedGroups.has(group.studentId);
                const isPrinting = printingStudents.has(group.studentId) ||
                  printingStudents.has(`${group.studentId}:${QUESTION_PDF_TYPES.join(",")}`) ||
                  printingStudents.has(`${group.studentId}:${ANSWER_PDF_TYPES.join(",")}`);
                return (
                  <Card
                    key={group.studentId}
                    className="border-0 shadow-premium overflow-hidden"
                  >
                    {/* Student header */}
                    <div className="flex items-center bg-muted/30 hover:bg-muted/50 transition-colors">
                      <button
                        type="button"
                        className="flex flex-1 items-center gap-3 px-4 py-3 cursor-pointer"
                        onClick={() => toggleGroup(group.studentId)}
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
                              <AlertDialogAction onClick={() => handleRemoveStudent(group.studentId, group.studentName)}>
                                全削除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handlePrintStudent(group.studentId, group.studentName)}
                          disabled={
                            isPrinting ||
                            executeMutation.isPending ||
                            registerMutation.isPending ||
                            addPrinterMutation.isPending
                          }
                        >
                          <Printer className="mr-1 h-3 w-3" />
                          {isPrinting ? "印刷中..." : "全印刷"}
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
                                  onClick={() => handleRemoveStudent(group.studentId, group.studentName, QUESTION_PDF_TYPES)}
                                >
                                  <Trash2 className="mr-1 h-3 w-3" />削除
                                </Button>
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-6 px-2 text-[10px]"
                                  disabled={executeMutation.isPending || printingStudents.has(`${group.studentId}:${QUESTION_PDF_TYPES.join(",")}`)}
                                  onClick={() => handlePrintStudent(group.studentId, group.studentName, QUESTION_PDF_TYPES)}
                                >
                                  <Printer className="mr-1 h-3 w-3" />
                                  {printingStudents.has(`${group.studentId}:${QUESTION_PDF_TYPES.join(",")}`) ? "印刷中..." : "印刷"}
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
                                  onClick={() => handleRemoveStudent(group.studentId, group.studentName, ANSWER_PDF_TYPES)}
                                >
                                  <Trash2 className="mr-1 h-3 w-3" />削除
                                </Button>
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-6 px-2 text-[10px]"
                                  disabled={executeMutation.isPending || printingStudents.has(`${group.studentId}:${ANSWER_PDF_TYPES.join(",")}`)}
                                  onClick={() => handlePrintStudent(group.studentId, group.studentName, ANSWER_PDF_TYPES)}
                                >
                                  <Printer className="mr-1 h-3 w-3" />
                                  {printingStudents.has(`${group.studentId}:${ANSWER_PDF_TYPES.join(",")}`) ? "印刷中..." : "印刷"}
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

        {/* ─── Jobs Tab ─── */}
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

        {/* ─── Logs Tab ─── */}
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

      {/* ─── PDF Preview Dialog ─── */}
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

      {/* ─── Printer Management Dialog ─── */}
      <Dialog open={printerDialogOpen} onOpenChange={setPrinterDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>プリンタ管理</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add printer */}
            <div className="flex gap-2">
              <Input
                placeholder="プリンタ名を入力（例: EPSON_EP_806A）"
                value={newPrinterName}
                onChange={(e) => setNewPrinterName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddPrinter()}
              />
              <Button
                onClick={handleAddPrinter}
                disabled={
                  !newPrinterName.trim() || addPrinterMutation.isPending
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                追加
              </Button>
            </div>

            {/* IP address entry */}
            <div className="flex gap-2">
              <Input
                placeholder="IPアドレス（例: 192.168.1.50）"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRegisterByIp()}
              />
              <Button
                onClick={handleRegisterByIp}
                disabled={!ipAddress.trim() || registerMutation.isPending}
                variant="outline"
              >
                <Globe className="mr-1 h-4 w-4" />
                IP登録
              </Button>
            </div>

            {/* LAN discovery */}
            <div className="space-y-2">
              <Button
                onClick={handleDiscoverPrinters}
                disabled={discoverMutation.isPending}
                variant="outline"
                className="w-full"
              >
                {discoverMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wifi className="mr-2 h-4 w-4" />
                )}
                {discoverMutation.isPending ? "LANプリンタを検索中..." : "LAN検索"}
              </Button>

              {discoveredPrinters.length > 0 && (
                <div className="space-y-1.5 rounded-lg border p-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    検出されたプリンタ ({discoveredPrinters.length}台)
                  </p>
                  {discoveredPrinters.map((dp) => (
                    <div
                      key={dp.uri}
                      className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2"
                    >
                      <Wifi className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {dp.instance_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {dp.hostname}:{dp.port}
                        </p>
                      </div>
                      {dp.already_configured ? (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          登録済
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 h-7 text-xs"
                          onClick={() => handleRegisterPrinter(dp)}
                          disabled={registerMutation.isPending}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          登録
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Printer list */}
            {printerOptions.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                プリンタが登録されていません
              </p>
            ) : (
              <div className="space-y-2">
                {printerOptions.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2"
                  >
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${printerStatusColor(
                        p.status
                      )}`}
                    />
                    <span className="flex-1 text-sm font-medium">
                      {p.name}
                    </span>
                    {p.name === printerData?.default && (
                      <Badge variant="secondary" className="text-xs">
                        デフォルト
                      </Badge>
                    )}
                    {p.status === "configured" && p.name !== printerData?.default && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-amber-500"
                        onClick={() => handleSetDefault(p.name)}
                        title="デフォルトに設定"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {p.status === "configured" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleRemovePrinter(p.name)}
                        title="削除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              メイン画面のプリンタ選択でもLAN検索結果を使えます。未登録のWi-Fiプリンタは、選んで印刷すると自動で登録されます。
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
