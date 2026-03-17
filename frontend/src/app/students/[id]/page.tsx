"use client";

import { use, useState } from "react";
import {
  useStudent,
  useMaterialZones,
  useToggleMaterial,
  useSavePointers,
} from "@/lib/queries/students";
import { useStudentProgress } from "@/lib/queries/progress";
import { useAutoQueue } from "@/lib/queries/auto-print";
import { useStudentPrintHistory } from "@/lib/queries/auto-print";
import { useStudentAnalytics } from "@/lib/queries/analytics";
import { useLessonRecords, useBatchUpsertRecords } from "@/lib/queries/lesson-records";
import { useMaterials } from "@/lib/queries/materials";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Minus,
  Save,
  Printer,
  BookOpen,
  History,
  BarChart3,
  ClipboardEdit,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus as MinusIcon,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(
  () => import("recharts").then((m) => m.LineChart),
  { ssr: false }
);
const Line = dynamic(
  () => import("recharts").then((m) => m.Line),
  { ssr: false }
);
const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false }
);
const Bar = dynamic(
  () => import("recharts").then((m) => m.Bar),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((m) => m.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((m) => m.YAxis),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((m) => m.Tooltip),
  { ssr: false }
);
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false }
);
import type { LessonRecordUpsert } from "@/lib/types";

const ACTION_LABELS: Record<string, string> = {
  assign: "割当",
  remove: "解除",
  advance: "進行",
  manual_set: "手動",
  print: "印刷",
};

const STATUS_OPTIONS = [
  { value: "completed", label: "完了" },
  { value: "partial", label: "途中" },
  { value: "skipped", label: "スキップ" },
  { value: "retry", label: "再実施" },
];

export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: student, isLoading } = useStudent(id);
  const { data: zones } = useMaterialZones(id);
  const { data: progress } = useStudentProgress(id);
  const { data: printHistory } = useStudentPrintHistory(id);
  const { data: analytics } = useStudentAnalytics(id);
  const { data: allMaterials } = useMaterials();
  const toggleMutation = useToggleMaterial(id);
  const saveMutation = useSavePointers(id);
  const autoQueueMutation = useAutoQueue();
  const batchUpsertMutation = useBatchUpsertRecords();

  const [editedPointers, setEditedPointers] = useState<Record<string, number>>(
    {}
  );

  // Lesson record state
  const [selectedMaterialKey, setSelectedMaterialKey] = useState("");
  const { data: lessonRecords } = useLessonRecords(
    id,
    selectedMaterialKey || undefined
  );
  const [pendingRecords, setPendingRecords] = useState<
    Record<string, LessonRecordUpsert>
  >({});

  const selectedMaterial = allMaterials?.find(
    (m) => m.key === selectedMaterialKey
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (!student) {
    return <div>生徒が見つかりません</div>;
  }

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

  const handlePointerChange = (materialKey: string, value: number) => {
    setEditedPointers((prev) => ({ ...prev, [materialKey]: value }));
  };

  const handleSavePointers = () => {
    saveMutation.mutate(editedPointers, {
      onSuccess: () => {
        toast.success("ポインタを保存しました");
        setEditedPointers({});
      },
    });
  };

  const handleAutoQueue = () => {
    autoQueueMutation.mutate([id], {
      onSuccess: (data) =>
        toast.success(`${data.queued}件をキューに追加しました`),
      onError: (err) => toast.error(`エラー: ${err.message}`),
    });
  };

  // Lesson record helpers
  const todayStr = new Date().toISOString().split("T")[0];

  const updatePendingRecord = (
    nodeKey: string,
    field: string,
    value: string | number | null
  ) => {
    const key = `${nodeKey}_${todayStr}`;
    setPendingRecords((prev) => {
      const existing = prev[key] ?? {
        student_id: id,
        material_key: selectedMaterialKey,
        node_key: nodeKey,
        lesson_date: todayStr,
        status: "completed",
      };
      return {
        ...prev,
        [key]: { ...existing, [field]: value },
      };
    });
  };

  const handleSaveRecords = () => {
    const records = Object.values(pendingRecords);
    if (records.length === 0) return;
    batchUpsertMutation.mutate(records, {
      onSuccess: () => {
        toast.success(`${records.length}件の記録を保存しました`);
        setPendingRecords({});
      },
      onError: (err) => toast.error(`エラー: ${err.message}`),
    });
  };

  // Existing record lookup
  const getExistingRecord = (nodeKey: string) => {
    return lessonRecords?.find(
      (r) => r.node_key === nodeKey && r.lesson_date === todayStr
    );
  };

  // Stats
  const avgPercent =
    student.materials.length > 0
      ? Math.round(
          student.materials.reduce((sum, m) => sum + m.percent, 0) /
            student.materials.length
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/students">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{student.name}</h1>
            <p className="text-sm text-muted-foreground">
              ID: {student.id} · {student.materials.length}教材 · 平均進捗{" "}
              {avgPercent}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleAutoQueue}>
            <Printer className="mr-2 h-4 w-4" />
            次回分を印刷
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="materials">
        <TabsList>
          <TabsTrigger value="materials">
            <BookOpen className="mr-1.5 h-4 w-4" />
            教材・進捗
          </TabsTrigger>
          <TabsTrigger value="records">
            <ClipboardEdit className="mr-1.5 h-4 w-4" />
            実施記録
          </TabsTrigger>
          <TabsTrigger value="print-history">
            <History className="mr-1.5 h-4 w-4" />
            印刷履歴
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-1.5 h-4 w-4" />
            分析
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Materials & Progress */}
        <TabsContent value="materials" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">割当済み教材</CardTitle>
                {Object.keys(editedPointers).length > 0 && (
                  <Button
                    size="sm"
                    onClick={handleSavePointers}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    保存
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {(zones?.assigned || []).map((mat) => {
                  const currentPointer =
                    editedPointers[mat.key] ?? mat.pointer ?? 1;
                  const nextNode = student.materials.find(
                    (m) => m.material_key === mat.key
                  );
                  return (
                    <div
                      key={mat.key}
                      className="rounded-lg border p-4 transition-colors hover:bg-accent/50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{mat.name}</span>
                          {nextNode?.next_node_title && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              次: {nextNode.next_node_title}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleToggle(mat.key, "remove")}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          ポインタ:
                        </span>
                        <Input
                          type="number"
                          min={1}
                          max={mat.total_nodes}
                          value={currentPointer}
                          onChange={(e) =>
                            handlePointerChange(
                              mat.key,
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="h-8 w-20"
                        />
                        <span className="text-sm text-muted-foreground">
                          / {mat.total_nodes}
                        </span>
                      </div>
                      <Progress
                        value={
                          mat.total_nodes > 0
                            ? (currentPointer / mat.total_nodes) * 100
                            : 0
                        }
                        className="mt-2"
                      />
                    </div>
                  );
                })}
                {(!zones?.assigned || zones.assigned.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    教材が割り当てられていません
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">未割当教材</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(zones?.source || []).map((mat) => (
                  <div
                    key={mat.key}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <span className="font-medium">{mat.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({mat.total_nodes} ノード)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary"
                      onClick={() => handleToggle(mat.key, "assign")}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {(!zones?.source || zones.source.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    全ての教材が割り当て済みです
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Progress Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">進捗履歴</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(progress?.history || []).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">
                        {ACTION_LABELS[entry.action] || entry.action}
                      </Badge>
                      <span>{entry.material_key}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.old_pointer != null &&
                        entry.new_pointer != null && (
                          <span>
                            {entry.old_pointer} → {entry.new_pointer}
                          </span>
                        )}
                      <span className="text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString("ja-JP")}
                      </span>
                    </div>
                  </div>
                ))}
                {(!progress?.history || progress.history.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    履歴はまだありません
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Lesson Records */}
        <TabsContent value="records" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Select
                value={selectedMaterialKey}
                onValueChange={(v) => {
                  setSelectedMaterialKey(v);
                  setPendingRecords({});
                }}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="教材を選択" />
                </SelectTrigger>
                <SelectContent>
                  {(zones?.assigned || []).map((mat) => (
                    <SelectItem key={mat.key} value={mat.key}>
                      {mat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {todayStr}
              </span>
            </div>
            {Object.keys(pendingRecords).length > 0 && (
              <Button
                size="sm"
                onClick={handleSaveRecords}
                disabled={batchUpsertMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {batchUpsertMutation.isPending
                  ? "保存中..."
                  : `${Object.keys(pendingRecords).length}件を保存`}
              </Button>
            )}
          </div>

          {selectedMaterial ? (
            <Card className="border-0 shadow-premium overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider w-12">
                        #
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">
                        ノード
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider w-32">
                        ステータス
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider w-24">
                        スコア
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">
                        メモ
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMaterial.nodes.map((node) => {
                      const pendingKey = `${node.key}_${todayStr}`;
                      const existing = getExistingRecord(node.key);
                      const pending = pendingRecords[pendingKey];
                      return (
                        <TableRow key={node.key}>
                          <TableCell className="text-xs text-muted-foreground">
                            {node.sort_order}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {node.title}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={
                                pending?.status ||
                                existing?.status ||
                                ""
                              }
                              onValueChange={(v) =>
                                updatePendingRecord(node.key, "status", v)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              placeholder="-"
                              className="h-8 w-20 text-xs"
                              defaultValue={
                                pending?.score ?? existing?.score ?? ""
                              }
                              onBlur={(e) => {
                                const val = e.target.value
                                  ? parseInt(e.target.value)
                                  : null;
                                updatePendingRecord(node.key, "score", val);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="メモ"
                              className="h-8 text-xs"
                              defaultValue={
                                pending?.notes ?? existing?.notes ?? ""
                              }
                              onBlur={(e) =>
                                updatePendingRecord(
                                  node.key,
                                  "notes",
                                  e.target.value || null
                                )
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card className="py-16">
              <CardContent className="text-center">
                <ClipboardEdit className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">
                  教材を選択してください
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 3: Print History */}
        <TabsContent value="print-history">
          <Card className="border-0 shadow-premium overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-12 text-xs font-semibold uppercase tracking-wider">
                      状態
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">
                      教材
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">
                      ノード
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">
                      メッセージ
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">
                      日時
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(printHistory || []).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {log.success ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        ) : log.success === false ? (
                          <XCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.material_name || log.material_key || "-"}
                      </TableCell>
                      <TableCell>
                        {log.node_name || log.node_key || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.message || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("ja-JP")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!printHistory || printHistory.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-16 text-center">
                        <Printer className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground">
                          印刷履歴はまだありません
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Analytics */}
        <TabsContent value="analytics" className="space-y-6">
          {analytics ? (
            <>
              {/* Pace summary */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        {analytics.pace.nodes_per_week}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        ノード/週
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-center gap-2">
                      {analytics.pace.trend === "improving" ? (
                        <TrendingUp className="h-6 w-6 text-emerald-500" />
                      ) : analytics.pace.trend === "declining" ? (
                        <TrendingDown className="h-6 w-6 text-destructive" />
                      ) : (
                        <MinusIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                      <span className="text-lg font-medium">
                        {analytics.pace.trend === "improving"
                          ? "上昇中"
                          : analytics.pace.trend === "declining"
                          ? "低下中"
                          : "安定"}
                      </span>
                    </div>
                    <p className="text-center text-sm text-muted-foreground mt-1">
                      学習ペース
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold">{avgPercent}%</div>
                      <p className="text-sm text-muted-foreground">
                        平均進捗率
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Completion rates bar chart */}
              {analytics.completion_rates.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">教材別完了率</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.completion_rates}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                        />
                        <XAxis
                          dataKey="material_name"
                          tick={{ fontSize: 12 }}
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value) => [
                            `${value}%`,
                            "完了率",
                          ]}
                        />
                        <Bar
                          dataKey="percent"
                          fill="oklch(0.5 0.2 25)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Progress timeline */}
              {analytics.progress_timeline.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">進捗タイムライン</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart
                        data={analytics.progress_timeline.filter(
                          (e) => e.new_pointer != null
                        )}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString("ja-JP", {
                              month: "short",
                              day: "numeric",
                            })
                          }
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          labelFormatter={(v) =>
                            new Date(v).toLocaleDateString("ja-JP")
                          }
                          formatter={(value, name) => [
                            value,
                            name === "new_pointer" ? "ポインタ" : name,
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="new_pointer"
                          stroke="oklch(0.5 0.2 25)"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="py-16">
              <CardContent className="text-center">
                <BarChart3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">
                  分析データを読み込み中...
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
