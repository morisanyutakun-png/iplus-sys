"use client";

import { useState, useMemo } from "react";
import {
  useQueue,
  useAddToQueue,
  useRemoveFromQueue,
  useExecutePrint,
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
  const { data: items, isLoading: queueLoading } = useQueue();
  const { data: students } = useStudents();
  const { data: materials } = useMaterials();
  const { data: jobs } = useJobs();
  const { data: logs } = useLogs();
  const addMutation = useAddToQueue();
  const removeMutation = useRemoveFromQueue();
  const executeMutation = useExecutePrint();
  const autoQueueMutation = useAutoQueue();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [selectedNode, setSelectedNode] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

  const selectedMat = materials?.find((m) => m.key === selectedMaterial);

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

  const handlePrint = () => {
    executeMutation.mutate(undefined, {
      onSuccess: () => toast.success("印刷ジョブを実行しました"),
      onError: (err) => toast.error(`印刷エラー: ${err.message}`),
    });
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

  return (
    <div className="space-y-6">
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

        {/* Queue Tab - Per-Student Grouped */}
        <TabsContent value="queue" className="space-y-4">
          <div className="flex items-center gap-2">
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
                        ノード
                      </label>
                      <Select
                        value={selectedNode}
                        onValueChange={setSelectedNode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="ノードを選択（任意）" />
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
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={!items?.length || executeMutation.isPending}
            >
              <Printer className="mr-2 h-4 w-4" />
              {executeMutation.isPending ? "実行中..." : "印刷実行"}
            </Button>
          </div>

          {/* Grouped queue display */}
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
                return (
                  <Card
                    key={group.studentId}
                    className="border-0 shadow-premium overflow-hidden"
                  >
                    {/* Group header */}
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
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

                    {/* Group items */}
                    {!isCollapsed && (
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/10">
                              <TableHead className="text-xs">教材</TableHead>
                              <TableHead className="text-xs">ノード</TableHead>
                              <TableHead className="text-xs w-20">
                                ステータス
                              </TableHead>
                              <TableHead className="w-12"></TableHead>
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
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => handleRemove(item.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
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
                      ノード
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
    </div>
  );
}
