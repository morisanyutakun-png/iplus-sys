"use client";

import { useState, useCallback } from "react";
import { useMaterials } from "@/lib/queries/materials";
import { useStudents } from "@/lib/queries/students";
import { useMasteryBatch } from "@/lib/queries/lesson-records";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Save,
  ClipboardCheck,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Printer,
  ArrowRight,
} from "lucide-react";
import type { MasteryInput, MasteryBatchResponse, Student } from "@/lib/types";

type InputState = "completed" | "retry" | null;

type StudentInput = {
  status: InputState;
  score: number | null;
};

export default function ScoringPage() {
  const { data: materials, isLoading: matsLoading } = useMaterials();
  const { data: students, isLoading: studsLoading } = useStudents();
  const masteryMutation = useMasteryBatch();

  const [selectedMaterialKey, setSelectedMaterialKey] = useState("");
  const [inputs, setInputs] = useState<Record<string, StudentInput>>({});
  const [lastResult, setLastResult] = useState<MasteryBatchResponse | null>(
    null
  );

  const todayStr = new Date().toISOString().split("T")[0];

  const selectedMaterial = materials?.find(
    (m) => m.key === selectedMaterialKey
  );

  // Filter students who have this material assigned
  const relevantStudents = (students || []).filter((s) =>
    s.materials.some((m) => m.material_key === selectedMaterialKey)
  );

  const nodes = selectedMaterial?.nodes
    ? [...selectedMaterial.nodes].sort((a, b) => a.sort_order - b.sort_order)
    : [];

  // Get the current node for a student based on their pointer
  const getCurrentNode = useCallback(
    (student: Student) => {
      const sm = student.materials.find(
        (m) => m.material_key === selectedMaterialKey
      );
      if (!sm) return null;
      const pointer = sm.pointer;
      return nodes.find((n) => n.sort_order === pointer) || null;
    },
    [selectedMaterialKey, nodes]
  );

  const getStudentPointer = useCallback(
    (student: Student) => {
      const sm = student.materials.find(
        (m) => m.material_key === selectedMaterialKey
      );
      return sm?.pointer ?? 1;
    },
    [selectedMaterialKey]
  );

  const getInput = (studentId: string): StudentInput => {
    return inputs[studentId] || { status: null, score: null };
  };

  const setInput = (studentId: string, update: Partial<StudentInput>) => {
    setInputs((prev) => ({
      ...prev,
      [studentId]: { ...getInput(studentId), ...update },
    }));
  };

  const toggleStatus = (studentId: string) => {
    const current = getInput(studentId).status;
    let next: InputState;
    if (current === null) next = "completed";
    else if (current === "completed") next = "retry";
    else next = null;
    setInput(studentId, { status: next });
  };

  const pendingCount = Object.values(inputs).filter(
    (v) => v.status !== null
  ).length;

  const handleSave = () => {
    const records: MasteryInput[] = [];
    for (const student of relevantStudents) {
      const input = getInput(student.id);
      if (input.status === null) continue;

      const currentNode = getCurrentNode(student);
      if (!currentNode) continue;

      records.push({
        student_id: student.id,
        material_key: selectedMaterialKey,
        node_key: currentNode.key,
        lesson_date: todayStr,
        status: input.status,
        score: input.score ?? undefined,
      });
    }

    if (records.length === 0) {
      toast.info("入力されたデータがありません");
      return;
    }

    masteryMutation.mutate(records, {
      onSuccess: (data) => {
        setLastResult(data);
        setInputs({});
        toast.success(
          `${data.processed}件処理: ${data.advanced}件合格進行 / ${data.retried}件再実施 / ${data.queued}件印刷キュー追加`
        );
      },
      onError: (err) => toast.error(`エラー: ${err.message}`),
    });
  };

  const handleReset = () => {
    setInputs({});
    setLastResult(null);
    toast.info("リセットしました");
  };

  const isLoading = matsLoading || studsLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">定着度入力</h1>
            <p className="text-sm text-muted-foreground">
              合格→次へ進む / 不合格→再実施 / 自動で印刷キューに追加
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {todayStr}
          </Badge>
          {pendingCount > 0 && (
            <>
              <Badge variant="secondary" className="text-xs">
                {pendingCount}件入力済
              </Badge>
              <Button size="sm" variant="ghost" onClick={handleReset}>
                <RotateCcw className="mr-1 h-3 w-3" />
                リセット
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={masteryMutation.isPending}
              >
                <Save className="mr-1.5 h-4 w-4" />
                {masteryMutation.isPending
                  ? "処理中..."
                  : `${pendingCount}件を保存`}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Material selector */}
      <div className="flex items-center gap-3">
        <Select
          value={selectedMaterialKey}
          onValueChange={(v) => {
            setSelectedMaterialKey(v);
            setInputs({});
            setLastResult(null);
          }}
        >
          <SelectTrigger className="w-80">
            <SelectValue placeholder="教材を選択してください" />
          </SelectTrigger>
          <SelectContent>
            {(materials || []).map((m) => (
              <SelectItem key={m.key} value={m.key}>
                {m.name} ({m.nodes.length}ノード)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedMaterial && (
          <span className="text-sm text-muted-foreground">
            {relevantStudents.length}名の生徒
          </span>
        )}
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="h-96 rounded-xl skeleton-pulse" />
      ) : !selectedMaterial ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <ClipboardCheck className="mb-3 h-12 w-12 opacity-20" />
          <p className="text-sm">
            教材を選択すると生徒ごとの定着度入力が表示されます
          </p>
        </div>
      ) : relevantStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <p className="text-sm">
            この教材が割り当てられている生徒がいません
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Table header */}
          <div className="grid grid-cols-[180px_1fr_100px_80px_1fr] gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold">
            <div>生徒名</div>
            <div>現在の範囲</div>
            <div className="text-center">スコア</div>
            <div className="text-center">結果</div>
            <div>次回の範囲</div>
          </div>

          {/* Student rows */}
          {relevantStudents.map((student) => {
            const currentNode = getCurrentNode(student);
            const pointer = getStudentPointer(student);
            const totalNodes = nodes.length;
            const isCompleted = pointer > totalNodes;
            const input = getInput(student.id);

            // Determine next node preview
            let nextPreview = "";
            if (input.status === "completed" && pointer + 1 <= totalNodes) {
              const nextNode = nodes.find(
                (n) => n.sort_order === pointer + 1
              );
              nextPreview = nextNode
                ? `→ ${nextNode.sort_order}. ${nextNode.title}`
                : "";
            } else if (input.status === "retry" && currentNode) {
              nextPreview = `↻ ${currentNode.sort_order}. ${currentNode.title} (再)`;
            }

            // Check last result for this student
            const resultItem = lastResult?.results.find(
              (r) => r.student_id === student.id
            );

            return (
              <div
                key={student.id}
                className={`grid grid-cols-[180px_1fr_100px_80px_1fr] gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
                  isCompleted
                    ? "bg-green-50 border-green-200 opacity-60"
                    : input.status === "completed"
                    ? "bg-red-50 border-red-200"
                    : input.status === "retry"
                    ? "bg-gray-100 border-gray-300"
                    : "bg-white border-border hover:bg-gray-50"
                }`}
              >
                {/* Student name */}
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {student.name}
                  </span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {pointer}/{totalNodes}
                  </Badge>
                </div>

                {/* Current node */}
                <div className="flex items-center text-sm">
                  {isCompleted ? (
                    <span className="text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      全範囲完了
                    </span>
                  ) : currentNode ? (
                    <span>
                      <span className="font-mono text-xs text-muted-foreground mr-1.5">
                        {currentNode.sort_order}.
                      </span>
                      <span className="font-medium">{currentNode.title}</span>
                      {currentNode.range_text && (
                        <span className="text-muted-foreground ml-1.5 text-xs">
                          ({currentNode.range_text})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>

                {/* Score input */}
                <div className="flex items-center justify-center">
                  {!isCompleted && (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="h-8 w-16 text-center text-sm rounded border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="-"
                      value={input.score ?? ""}
                      onChange={(e) => {
                        const val =
                          e.target.value === ""
                            ? null
                            : Math.min(
                                100,
                                Math.max(0, parseInt(e.target.value) || 0)
                              );
                        setInput(student.id, { score: val });
                      }}
                    />
                  )}
                </div>

                {/* Pass/Fail toggle */}
                <div className="flex items-center justify-center">
                  {!isCompleted && (
                    <button
                      type="button"
                      className={`h-8 w-14 rounded-md text-sm font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                        input.status === "completed"
                          ? "bg-red-600 text-white focus:ring-red-400"
                          : input.status === "retry"
                          ? "bg-gray-800 text-white focus:ring-gray-500"
                          : "bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200 focus:ring-gray-300"
                      }`}
                      onClick={() => toggleStatus(student.id)}
                    >
                      {input.status === "completed"
                        ? "○"
                        : input.status === "retry"
                        ? "×"
                        : "—"}
                    </button>
                  )}
                </div>

                {/* Next range preview / result */}
                <div className="flex items-center text-sm">
                  {resultItem ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      {resultItem.advanced ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-gray-500" />
                      )}
                      <span
                        className={
                          resultItem.advanced
                            ? "text-green-700"
                            : "text-gray-600"
                        }
                      >
                        {resultItem.advanced ? "合格→進行" : "再実施"}
                      </span>
                      {resultItem.queued_node_title && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Printer className="h-3 w-3" />
                          {resultItem.queued_node_title}
                        </span>
                      )}
                    </span>
                  ) : nextPreview ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" />
                      {nextPreview}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Last result summary */}
      {lastResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="text-sm font-semibold text-green-800 mb-2">
            処理結果
          </h3>
          <div className="flex gap-6 text-sm">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              合格進行: {lastResult.advanced}件
            </span>
            <span className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-gray-500" />
              再実施: {lastResult.retried}件
            </span>
            <span className="flex items-center gap-1.5">
              <Printer className="h-4 w-4 text-blue-600" />
              印刷キュー追加: {lastResult.queued}件
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      {selectedMaterial && relevantStudents.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-medium">操作:</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-4 w-6 rounded bg-red-600 text-white text-center text-[10px] leading-4 font-bold">
              ○
            </span>
            合格（次へ進む）
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-4 w-6 rounded bg-gray-800 text-white text-center text-[10px] leading-4 font-bold">
              ×
            </span>
            再実施（同じ範囲）
          </span>
          <span className="ml-auto text-muted-foreground">
            結果ボタンをクリックで切替 → 保存で自動的に印刷キューに追加
          </span>
        </div>
      )}
    </div>
  );
}
