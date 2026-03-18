"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useMaterials } from "@/lib/queries/materials";
import { useMasteryBatch } from "@/lib/queries/lesson-records";
import { useSpreadsheetKeyboard } from "@/hooks/use-spreadsheet-keyboard";
import { ScoreCell, StatusCell } from "./mastery-cell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Save,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Printer,
  ArrowRight,
} from "lucide-react";
import type {
  Student,
  MasteryInput,
  MasteryBatchResponse,
  StudentMaterialInfo,
  MaterialNode,
} from "@/lib/types";

type InputState = "completed" | "retry" | null;
type RowInput = { status: InputState; score: number | null };

type Props = {
  student: Student;
  active: boolean;
  onEscape: () => void;
};

export function MasterySpreadsheet({ student, active, onEscape }: Props) {
  const { data: allMaterials } = useMaterials();
  const masteryMutation = useMasteryBatch();

  const [inputs, setInputs] = useState<Record<string, RowInput>>({});
  const [lastResult, setLastResult] = useState<MasteryBatchResponse | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  // Reset inputs when student changes
  useEffect(() => {
    setInputs({});
    setLastResult(null);
  }, [student.id]);

  // Build rows: one per assigned material
  const rows = useMemo(() => {
    return student.materials.map((sm) => {
      const material = allMaterials?.find((m) => m.key === sm.material_key);
      const nodes = material?.nodes
        ? [...material.nodes].sort((a, b) => a.sort_order - b.sort_order)
        : [];
      const currentNode = nodes.find((n) => n.sort_order === sm.pointer) ?? null;
      const isCompleted = sm.pointer > sm.total_nodes;
      return { sm, material, nodes, currentNode, isCompleted };
    });
  }, [student.materials, allMaterials]);

  const getInput = (materialKey: string): RowInput =>
    inputs[materialKey] ?? { status: null, score: null };

  const setInput = (materialKey: string, update: Partial<RowInput>) => {
    setInputs((prev) => ({
      ...prev,
      [materialKey]: { ...getInput(materialKey), ...update },
    }));
  };

  const toggleStatus = useCallback(
    (rowIndex: number) => {
      const row = rows[rowIndex];
      if (!row || row.isCompleted) return;
      const current = getInput(row.sm.material_key).status;
      let next: InputState;
      if (current === null) next = "completed";
      else if (current === "completed") next = "retry";
      else next = null;
      setInput(row.sm.material_key, { status: next });
    },
    [rows, inputs]
  );

  const pendingCount = Object.values(inputs).filter(
    (v) => v.status !== null
  ).length;

  const handleSave = useCallback(() => {
    const records: MasteryInput[] = [];
    for (const row of rows) {
      if (row.isCompleted) continue;
      const input = getInput(row.sm.material_key);
      if (input.status === null) continue;
      if (!row.currentNode) continue;
      records.push({
        student_id: student.id,
        material_key: row.sm.material_key,
        node_key: row.currentNode.key,
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
          `${data.processed}件処理: ${data.advanced}件合格 / ${data.retried}件再実施 / ${data.queued}件印刷キュー追加`
        );
      },
      onError: (err) => toast.error(`エラー: ${err.message}`),
    });
  }, [rows, inputs, student.id, todayStr, masteryMutation]);

  const handleReset = () => {
    setInputs({});
    setLastResult(null);
    toast.info("リセットしました");
  };

  const { activeCell, handleKeyDown } = useSpreadsheetKeyboard({
    rowCount: rows.length,
    onToggleStatus: toggleStatus,
    onSave: handleSave,
    onEscape,
    enabled: active,
  });

  // Attach keyboard listener
  useEffect(() => {
    if (!active) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, handleKeyDown]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">教材が割り当てられていません</p>
        <p className="text-xs mt-1">「教材管理」タブで教材を追加してください</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {todayStr}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {student.materials.length}教材
          </span>
        </div>
        <div className="flex items-center gap-2">
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
                  : `保存 (Ctrl+S)`}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Spreadsheet grid */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[180px_1fr_70px_80px_80px_1fr] gap-px bg-gray-900 text-white text-xs font-semibold">
          <div className="px-3 py-2">教材</div>
          <div className="px-3 py-2">現在のノード</div>
          <div className="px-3 py-2 text-center">進捗</div>
          <div className="px-3 py-2 text-center">点数</div>
          <div className="px-3 py-2 text-center">結果</div>
          <div className="px-3 py-2">次回</div>
        </div>

        {/* Rows */}
        {rows.map((row, rowIndex) => {
          const input = getInput(row.sm.material_key);
          const isScoreFocused =
            active && activeCell.row === rowIndex && activeCell.col === 0;
          const isStatusFocused =
            active && activeCell.row === rowIndex && activeCell.col === 1;

          // Next preview
          let nextPreview = "";
          if (
            input.status === "completed" &&
            row.sm.pointer + 1 <= row.sm.total_nodes
          ) {
            const nextNode = row.nodes.find(
              (n) => n.sort_order === row.sm.pointer + 1
            );
            nextPreview = nextNode
              ? `→ ${nextNode.sort_order}. ${nextNode.title}`
              : "";
          } else if (input.status === "retry" && row.currentNode) {
            nextPreview = `↻ ${row.currentNode.sort_order}. ${row.currentNode.title} (再)`;
          }

          // Result from last save
          const resultItem = lastResult?.results.find(
            (r) => r.material_key === row.sm.material_key
          );

          return (
            <div
              key={row.sm.material_key}
              className={cn(
                "grid grid-cols-[180px_1fr_70px_80px_80px_1fr] gap-px border-t border-border transition-colors",
                row.isCompleted
                  ? "bg-green-50 opacity-60"
                  : input.status === "completed"
                  ? "bg-red-50"
                  : input.status === "retry"
                  ? "bg-gray-100"
                  : "bg-white hover:bg-gray-50",
                active &&
                  activeCell.row === rowIndex &&
                  "ring-1 ring-inset ring-primary/40"
              )}
            >
              {/* Material name */}
              <div className="flex items-center px-3 py-2.5">
                <span className="text-sm font-medium truncate">
                  {row.sm.material_name}
                </span>
              </div>

              {/* Current node */}
              <div className="flex items-center px-3 py-2.5 text-sm">
                {row.isCompleted ? (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    全範囲完了
                  </span>
                ) : row.currentNode ? (
                  <span className="truncate">
                    <span className="font-mono text-xs text-muted-foreground mr-1.5">
                      {row.currentNode.sort_order}.
                    </span>
                    <span className="font-medium">{row.currentNode.title}</span>
                    {row.currentNode.range_text && (
                      <span className="text-muted-foreground ml-1.5 text-xs">
                        ({row.currentNode.range_text})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>

              {/* Progress */}
              <div className="flex items-center justify-center px-2 py-2.5">
                <Badge variant="outline" className="text-[10px]">
                  {row.sm.pointer}/{row.sm.total_nodes}
                </Badge>
              </div>

              {/* Score input */}
              <div className="flex items-center justify-center px-2 py-2.5">
                {!row.isCompleted && (
                  <ScoreCell
                    value={input.score}
                    onChange={(val) =>
                      setInput(row.sm.material_key, { score: val })
                    }
                    isFocused={isScoreFocused}
                  />
                )}
              </div>

              {/* Status toggle */}
              <div className="flex items-center justify-center px-2 py-2.5">
                {!row.isCompleted && (
                  <StatusCell
                    value={input.status}
                    onToggle={() => toggleStatus(rowIndex)}
                    isFocused={isStatusFocused}
                  />
                )}
              </div>

              {/* Next preview / result */}
              <div className="flex items-center px-3 py-2.5 text-sm">
                {resultItem ? (
                  <span className="flex items-center gap-1.5 text-xs">
                    {resultItem.advanced ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-gray-500" />
                    )}
                    <span
                      className={
                        resultItem.advanced ? "text-green-700" : "text-gray-600"
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
                  <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    {nextPreview}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Last result summary */}
      {lastResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
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
              印刷キュー: {lastResult.queued}件
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium">操作:</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-4 w-6 rounded bg-red-600 text-white text-center text-[10px] leading-4 font-bold">
            ○
          </span>
          合格
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-4 w-6 rounded bg-gray-800 text-white text-center text-[10px] leading-4 font-bold">
            ×
          </span>
          再実施
        </span>
        <span className="ml-auto">
          ↑↓←→ セル移動 · Enter/Space 合否切替 · Ctrl+S 保存 · Esc 生徒リストへ
        </span>
      </div>
    </div>
  );
}
