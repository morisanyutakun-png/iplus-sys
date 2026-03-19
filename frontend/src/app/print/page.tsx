"use client";

import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useQueue,
  useAddToQueue,
  useRemoveFromQueue,
  useExecutePrint,
  usePrinters,
  useAddPrinter,
  useRemovePrinter,
  useSetDefaultPrinter,
  useDiscoverPrinters,
  useRegisterPrinter,
  previewUrl,
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

type StudentGroup = {
  studentId: string;
  studentName: string;
  items: QueueItem[];
};

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
  const [discoveredPrinters, setDiscoveredPrinters] = useState<DiscoveredPrinter[]>([]);
  const [ipAddress, setIpAddress] = useState("");

  // Set default printer when data loads
  useEffect(() => {
    if (printerData?.default && !selectedPrinter) {
      setSelectedPrinter(printerData.default);
    }
  }, [printerData, selectedPrinter]);

  const selectedMat = materials?.find((m) => m.key === selectedMaterial);
  const printerOptions = printerData?.printers ?? [];
  const effectivePrinter = selectedPrinter || printerData?.default || "";

  // Group queue items by student
  const groupedQueue = useMemo<StudentGroup[]>(() => {
    if (!items || items.length === 0) return [];
    const map = new Map<string, StudentGroup>();
    for (const item of items) {
      const key = item.student_id;
      if (!map.has(key)) {
        map.set(key, {
          studentId: key,
          studentName: item.student_name || key,
          items: [],
        });
      }
      map.get(key)!.items.push(item);
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

  const showPrintResult = (
    data: { results: { success: boolean }[] },
    label?: string
  ) => {
    const successCount = data.results.filter((r) => r.success).length;
    const failCount = data.results.filter((r) => !r.success).length;
    const prefix = label ? `${label}: ` : "";
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
    executeMutation.mutate(
      { printerName: effectivePrinter || undefined },
      {
        onSuccess: (data) => showPrintResult(data),
        onError: (err) => toast.error(`印刷エラー: ${err.message}`),
      }
    );
  };

  const handlePrintStudent = (studentId: string, studentName: string) => {
    setPrintingStudents((prev) => new Set(prev).add(studentId));
    executeMutation.mutate(
      { printerName: effectivePrinter || undefined, studentIds: [studentId] },
      {
        onSuccess: (data) => {
          showPrintResult(data, studentName);
          setPrintingStudents((prev) => {
            const next = new Set(prev);
            next.delete(studentId);
            return next;
          });
        },
        onError: (err) => {
          toast.error(`印刷エラー (${studentName}): ${err.message}`);
          setPrintingStudents((prev) => {
            const next = new Set(prev);
            next.delete(studentId);
            return next;
          });
        },
      }
    );
  };

  const handleAutoQueueAll = () => {
    autoQueueMutation.mutate(undefined, {
      onSuccess: (data) =>
        toast.success(
          `${data.students}名の生徒から${data.queued}件をキューに追加しました`
        ),
      onError: (err) => toast.error(`エラー: ${err.message}`),
    });
  };

  const handleRefreshPrinters = () => {
    queryClient.invalidateQueries({ queryKey: ["printers"] });
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
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleRemovePrinter = (name: string) => {
    removePrinterMutation.mutate(name, {
      onSuccess: () => {
        toast.success(`プリンタ「${name}」を削除しました`);
        if (selectedPrinter === name) setSelectedPrinter("");
      },
    });
  };

  const handleSetDefault = (name: string) => {
    setDefaultPrinterMutation.mutate(name, {
      onSuccess: () => toast.success(`デフォルトを「${name}」に変更しました`),
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
      addPrinterMutation.mutate(
        { name: printer.cups_name, is_default: printerOptions.length === 0 },
        {
          onSuccess: () => {
            toast.success(`プリンタ「${printer.cups_name}」を登録しました`);
            setDiscoveredPrinters((prev) =>
              prev.map((p) =>
                p.uri === printer.uri ? { ...p, already_configured: true } : p
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
          setDiscoveredPrinters((prev) =>
            prev.map((p) =>
              p.uri === printer.uri ? { ...p, already_configured: true } : p
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
        },
        onError: (err) => toast.error(`登録エラー: ${err.message}`),
      }
    );
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
        return " (LAN)";
      case "online":
        return " (ローカル)";
      default:
        return "";
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
                  value={effectivePrinter}
                  onValueChange={setSelectedPrinter}
                >
                  <SelectTrigger className="h-8 w-[280px] text-xs">
                    <SelectValue placeholder="プリンタを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {printerOptions.length > 0 ? (
                      printerOptions.map((p) => (
                        <SelectItem key={p.name} value={p.name}>
                          <span className="flex items-center gap-2">
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${printerStatusColor(
                                p.status
                              )}`}
                            />
                            {p.name}
                            {p.name === printerData?.default
                              ? " (デフォルト)"
                              : ""}
                            {printerStatusLabel(p.status)}
                          </span>
                        </SelectItem>
                      ))
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
                disabled={!items?.length || executeMutation.isPending}
              >
                <Printer className="mr-2 h-4 w-4" />
                {executeMutation.isPending ? "実行中..." : "全件印刷"}
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
                const isPrinting = printingStudents.has(group.studentId);
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
                        <Badge variant="secondary" className="text-xs">
                          {group.items.length}件
                        </Badge>
                      </button>
                      <div className="flex items-center gap-1.5 pr-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() =>
                            handlePrintStudent(
                              group.studentId,
                              group.studentName
                            )
                          }
                          disabled={isPrinting || executeMutation.isPending}
                        >
                          <Printer className="mr-1 h-3 w-3" />
                          {isPrinting ? "印刷中..." : "印刷"}
                        </Button>
                      </div>
                    </div>

                    {/* Queue items */}
                    {!isCollapsed && (
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/10">
                              <TableHead className="text-xs">教材</TableHead>
                              <TableHead className="text-xs">範囲</TableHead>
                              <TableHead className="text-xs w-20">
                                ステータス
                              </TableHead>
                              <TableHead className="w-20"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="text-sm">
                                  {item.material_name || item.material_key}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {item.node_name || item.node_key || "-"}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      item.status === "pending"
                                        ? "outline"
                                        : "default"
                                    }
                                    className="text-xs"
                                  >
                                    {item.status === "pending"
                                      ? "待機中"
                                      : item.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {item.node_key && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                                        onClick={() =>
                                          setPreviewNodeKey(item.node_key!)
                                        }
                                        title="プレビュー"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      onClick={() => handleRemove(item.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
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
        open={!!previewNodeKey}
        onOpenChange={(open) => !open && setPreviewNodeKey(null)}
      >
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>PDF プレビュー</DialogTitle>
          </DialogHeader>
          {previewNodeKey && (
            <iframe
              src={previewUrl(previewNodeKey)}
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
              プリンタ名を手動入力するか、IPアドレスを入力するか、LAN検索で自動検出できます。
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
