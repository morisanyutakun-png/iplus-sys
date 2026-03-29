"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAllMaterials } from "@/lib/queries/materials";
import { useMasteryBatch } from "@/lib/queries/lesson-records";
import { useExamMaterials } from "@/lib/queries/exam-materials";
import { useSpreadsheetKeyboard } from "@/hooks/use-spreadsheet-keyboard";
import { ScoreCell, PassCheckbox } from "./mastery-cell";
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
  Upload,
} from "lucide-react";
import type {
  Student,
  MasteryInput,
  MasteryBatchResponse,
} from "@/lib/types";

type ColInput = {
  score: number | null;
  maxScore: number | null;
  passed: boolean;
};

type Props = {
  student: Student;
  active: boolean;
  onActivate?: () => void;
  onEscape: () => void;
  onPendingChange?: (hasPending: boolean) => void;
};

export function MasterySpreadsheet({ student, active, onActivate, onEscape, onPendingChange }: Props) {
  const { data: allMaterials } = useAllMaterials();
  const { data: allExamMaterials } = useExamMaterials();
  const masteryMutation = useMasteryBatch();

  // Build node_key → max_score map from exam subjects
  const examMaxScoreMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const exam of allExamMaterials || []) {
      for (const subj of exam.subjects) {
        if (subj.node_key) {
          map.set(subj.node_key, subj.max_score);
        }
      }
    }
    return map;
  }, [allExamMaterials]);

  const [inputs, setInputs] = useState<Record<string, ColInput>>({});
  const [lastResult, setLastResult] = useState<MasteryBatchResponse | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  // Reset inputs when student changes
  useEffect(() => {
    setInputs({});
    setLastResult(null);
  }, [student.id]);

  // Build columns: one per assigned material
  const columns = useMemo(() => {
    return student.materials.map((sm) => {
      const material = allMaterials?.find((m) => m.key === sm.material_key);
      const nodes = material?.nodes
        ? [...material.nodes].sort((a, b) => a.sort_order - b.sort_order)
        : [];
      const currentNode =
        nodes.find((n) => n.sort_order === sm.pointer) ?? null;
      const nextNode =
        nodes.find((n) => n.sort_order === sm.pointer + 1) ?? null;
      const isCompleted = sm.pointer > sm.total_nodes;
      const isExam = !!material?.exam_material_id;
      const examMaxScore = currentNode ? examMaxScoreMap.get(currentNode.key) ?? null : null;
      return { sm, material, nodes, currentNode, nextNode, isCompleted, isExam, examMaxScore };
    });
  }, [student.materials, allMaterials, examMaxScoreMap]);

  // Track completed column indices
  const completedCols = useMemo(() => {
    const set = new Set<number>();
    columns.forEach((col, i) => {
      if (col.isCompleted) set.add(i);
    });
    return set;
  }, [columns]);

  const getInput = (materialKey: string): ColInput =>
    inputs[materialKey] ?? { score: null, maxScore: null, passed: false };

  const setInput = (materialKey: string, update: Partial<ColInput>) => {
    setInputs((prev) => ({
      ...prev,
      [materialKey]: { ...getInput(materialKey), ...update },
    }));
  };

  const togglePass = useCallback(
    (colIndex: number) => {
      const col = columns[colIndex];
      if (!col || col.isCompleted) return;
      const current = getInput(col.sm.material_key);
      setInput(col.sm.material_key, { passed: !current.passed });
    },
    [columns, inputs]
  );

  const pendingCount = useMemo(() => {
    let count = 0;
    for (const col of columns) {
      const input = getInput(col.sm.material_key);
      if (col.isExam) {
        if (input.score !== null) count++;
      } else {
        if (input.passed || input.score !== null) count++;
      }
    }
    return count;
  }, [inputs, columns]);

  useEffect(() => {
    onPendingChange?.(pendingCount > 0);
  }, [pendingCount, onPendingChange]);

  const handleSave = useCallback(() => {
    // Validation: 得点入力時の整合性チェック
    for (const col of columns) {
      if (col.isCompleted) continue;
      const input = getInput(col.sm.material_key);
      if (input.score === null) continue;

      // Exam materials: max_score is auto-filled from exam subject definition
      const effectiveMax = col.isExam && col.examMaxScore ? col.examMaxScore : input.maxScore;

      if (effectiveMax === null) {
        toast.error(`${col.sm.material_name}: 得点を入力した場合は満点も入力してください`);
        return;
      }
      if (effectiveMax <= 0) {
        toast.error(`${col.sm.material_name}: 満点は0より大きい値を入力してください`);
        return;
      }
      if (input.score > effectiveMax) {
        toast.error(`${col.sm.material_name}: 得点が満点(${effectiveMax})を超えています`);
        return;
      }
    }

    const records: MasteryInput[] = [];
    for (const col of columns) {
      if (col.isCompleted) continue;
      const input = getInput(col.sm.material_key);
      // For exam materials: only need score, max_score is fixed from exam subject
      if (col.isExam) {
        if (input.score === null) continue;
        if (!col.currentNode) continue;
        records.push({
          student_id: student.id,
          material_key: col.sm.material_key,
          node_key: col.currentNode.key,
          lesson_date: todayStr,
          status: "completed",
          score: input.score ?? undefined,
          max_score: col.examMaxScore ?? input.maxScore ?? undefined,
        });
      } else {
        if (!input.passed && input.score === null) continue;
        if (!col.currentNode) continue;
        records.push({
          student_id: student.id,
          material_key: col.sm.material_key,
          node_key: col.currentNode.key,
          lesson_date: todayStr,
          status: input.passed ? "completed" : "retry",
          score: input.score ?? undefined,
          max_score: input.maxScore ?? undefined,
        });
      }
    }
    if (records.length === 0) {
      toast.info("入力されたデータがありません");
      return;
    }
    masteryMutation.mutate(records, {
      onSuccess: (data) => {
        setLastResult(data);
        setInputs({});
        toast.success("採点お疲れ様でした。返却お願いします。");
      },
      onError: (err) => toast.error(`エラー: ${err.message}`),
    });
  }, [columns, inputs, student.id, todayStr, masteryMutation]);

  const handleReset = () => {
    setInputs({});
    setLastResult(null);
    toast.info("リセットしました");
  };

  const { activeCell, setActiveCell, handleKeyDown, focusTrigger } = useSpreadsheetKeyboard({
    colCount: columns.length,
    completedCols,
    onTogglePass: togglePass,
    onSave: handleSave,
    onEscape,
    enabled: active,
  });

  // Attach keyboard listener
  useEffect(() => {
    if (!active) return;
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [active, handleKeyDown]);

  // Navigation guard: warn before leaving with unsaved inputs
  useEffect(() => {
    if (pendingCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pendingCount]);

  // Click handler for cells
  const handleCellClick = (colIdx: number, editableRow: number) => {
    if (completedCols.has(colIdx)) return;
    onActivate?.();
    setActiveCell({ col: colIdx, row: editableRow });
  };

  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">教材が割り当てられていません</p>
        <p className="text-xs mt-1">「教材管理」タブで教材を追加してください</p>
      </div>
    );
  }

  // Row definitions with metadata
  const rows = [
    { key: "name",    label: "教材名",     editable: false },
    { key: "current", label: "現在の範囲", editable: false },
    { key: "score",   label: "得点",       editable: true, editRow: 0 },
    { key: "max",     label: "満点",       editable: true, editRow: 1 },
    { key: "pass",    label: "合格",       editable: true, editRow: 2 },
    { key: "next",    label: "次回の範囲", editable: false },
  ] as const;

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
                <Upload className="mr-1.5 h-4 w-4" />
                {masteryMutation.isPending ? "処理中..." : "反映 (Ctrl+S)"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Spreadsheet grid */}
      <div className="overflow-x-auto rounded-lg border border-border shadow-sm">
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `100px repeat(${columns.length}, minmax(150px, 1fr))`,
          }}
        >
          {rows.map((rowDef, rowIdx) => (
            <>
              {/* Row header (left column) */}
              <div
                key={`label-${rowIdx}`}
                className={cn(
                  "flex items-center px-3 py-2 text-xs font-semibold border-b border-r border-border select-none",
                  rowDef.key === "name"
                    ? "bg-gray-900 text-white"
                    : rowDef.editable
                    ? "bg-amber-50 text-amber-900 border-l-2 border-l-amber-400"
                    : "bg-gray-100 text-gray-500"
                )}
              >
                {rowDef.label}
              </div>

              {/* Material columns */}
              {columns.map((col, colIdx) => {
                const input = getInput(col.sm.material_key);
                const isActiveCol = active && activeCell.col === colIdx;
                const resultItem = lastResult?.results.find(
                  (r) => r.material_key === col.sm.material_key
                );

                // ── Row: Material name ──
                if (rowDef.key === "name") {
                  return (
                    <div
                      key={`${rowIdx}-${colIdx}`}
                      className={cn(
                        "flex items-center justify-center px-3 py-2 text-sm font-bold border-b border-r border-border bg-gray-900 text-white",
                        col.isCompleted && "opacity-40"
                      )}
                    >
                      {col.sm.material_name}
                    </div>
                  );
                }

                // ── Row: Current range (read-only) ──
                if (rowDef.key === "current") {
                  return (
                    <div
                      key={`${rowIdx}-${colIdx}`}
                      className={cn(
                        "flex items-center justify-center px-2 py-2 text-xs border-b border-r border-border",
                        isActiveCol ? "bg-blue-50" : "bg-gray-50",
                        col.isCompleted && "opacity-40"
                      )}
                    >
                      {col.isCompleted ? (
                        <span className="text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          完了
                        </span>
                      ) : col.currentNode ? (
                        <span className="text-center leading-tight">
                          <span className="font-medium">
                            {col.currentNode.title}
                          </span>
                          {col.currentNode.range_text && (
                            <span className="block text-[10px] text-muted-foreground">
                              {col.currentNode.range_text}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  );
                }

                // ── Row: Score input ──
                if (rowDef.key === "score") {
                  const isFocused = isActiveCol && activeCell.row === 0;
                  return (
                    <div
                      key={`${rowIdx}-${colIdx}`}
                      className={cn(
                        "flex items-center justify-center px-2 py-1.5 border-b border-r border-border transition-colors",
                        isFocused
                          ? "bg-primary/5 ring-inset ring-1 ring-primary/20"
                          : isActiveCol
                          ? "bg-amber-50/50"
                          : "bg-white"
                      )}
                      onClick={() => handleCellClick(colIdx, 0)}
                    >
                      {!col.isCompleted && (
                        <ScoreCell
                          value={input.score}
                          onChange={(val) =>
                            setInput(col.sm.material_key, { score: val })
                          }
                          isFocused={isFocused}
                          focusTrigger={focusTrigger}
                          onClick={() => handleCellClick(colIdx, 0)}
                        />
                      )}
                    </div>
                  );
                }

                // ── Row: Max score input (fixed for exam materials) ──
                if (rowDef.key === "max") {
                  const isFocused = isActiveCol && activeCell.row === 1;

                  // Exam materials: show fixed max score from exam subject
                  if (col.isExam && col.examMaxScore) {
                    return (
                      <div
                        key={`${rowIdx}-${colIdx}`}
                        className="flex items-center justify-center px-2 py-1.5 border-b border-r border-border bg-gray-50"
                      >
                        <span className="text-sm font-medium text-muted-foreground tabular-nums">
                          {col.examMaxScore}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`${rowIdx}-${colIdx}`}
                      className={cn(
                        "flex items-center justify-center px-2 py-1.5 border-b border-r border-border transition-colors",
                        isFocused
                          ? "bg-primary/5 ring-inset ring-1 ring-primary/20"
                          : isActiveCol
                          ? "bg-amber-50/50"
                          : "bg-white"
                      )}
                      onClick={() => handleCellClick(colIdx, 1)}
                    >
                      {!col.isCompleted && (
                        <ScoreCell
                          value={input.maxScore}
                          onChange={(val) =>
                            setInput(col.sm.material_key, { maxScore: val })
                          }
                          isFocused={isFocused}
                          focusTrigger={focusTrigger}
                          onClick={() => handleCellClick(colIdx, 1)}
                        />
                      )}
                    </div>
                  );
                }

                // ── Row: Pass checkbox (hidden for exam materials) ──
                if (rowDef.key === "pass") {
                  const isFocused = isActiveCol && activeCell.row === 2;
                  return (
                    <div
                      key={`${rowIdx}-${colIdx}`}
                      className={cn(
                        "flex items-center justify-center px-2 py-1.5 border-b border-r border-border transition-colors",
                        col.isExam
                          ? "bg-gray-50"
                          : input.passed
                          ? "bg-emerald-50"
                          : isFocused
                          ? "bg-primary/5 ring-inset ring-1 ring-primary/20"
                          : isActiveCol
                          ? "bg-amber-50/50"
                          : "bg-white"
                      )}
                      onClick={() => !col.isExam && handleCellClick(colIdx, 2)}
                    >
                      {!col.isCompleted && !col.isExam && (
                        <PassCheckbox
                          checked={input.passed}
                          onToggle={() => togglePass(colIdx)}
                          isFocused={isFocused}
                          focusTrigger={focusTrigger}
                        />
                      )}
                      {col.isExam && (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </div>
                  );
                }

                // ── Row: Next range (read-only; hidden for exam materials) ──
                if (rowDef.key === "next") {
                  // Exam materials: single-shot — auto-unassign after recording
                  if (col.isExam) {
                    return (
                      <div
                        key={`${rowIdx}-${colIdx}`}
                        className={cn(
                          "flex items-center justify-center px-2 py-2 text-xs border-b border-r border-border",
                          resultItem ? "bg-violet-50" : "bg-gray-50"
                        )}
                      >
                        {resultItem ? (
                          <span className="flex items-center gap-1 text-violet-600">
                            <Save className="h-3 w-3" />
                            <span className="truncate">記録済→自動解除</span>
                          </span>
                        ) : input.score !== null ? (
                          <span className="text-violet-500 text-[10px] font-medium">単発（反映で解除）</span>
                        ) : (
                          <span className="text-muted-foreground/50 text-[10px]">単発試験</span>
                        )}
                      </div>
                    );
                  }

                  let nextText = "";
                  if (resultItem) {
                    if (resultItem.advanced) {
                      nextText = resultItem.queued_node_title
                        ? `→ ${resultItem.queued_node_title}`
                        : "合格→進行";
                    } else {
                      nextText = "再実施";
                    }
                  } else if (input.passed && col.nextNode) {
                    nextText = `→ ${col.nextNode.title}`;
                  } else if (input.passed && !col.nextNode) {
                    nextText = "→ 全範囲完了";
                  } else if (!input.passed && input.score !== null && col.currentNode) {
                    nextText = `↻ ${col.currentNode.title} (再)`;
                  }

                  return (
                    <div
                      key={`${rowIdx}-${colIdx}`}
                      className={cn(
                        "flex items-center justify-center px-2 py-2 text-xs border-b border-r border-border",
                        resultItem
                          ? resultItem.advanced
                            ? "bg-green-50"
                            : "bg-gray-50"
                          : input.passed
                          ? "bg-emerald-50"
                          : "bg-gray-50"
                      )}
                    >
                      {resultItem ? (
                        <span className="flex items-center gap-1">
                          {resultItem.advanced ? (
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                          ) : (
                            <XCircle className="h-3 w-3 text-gray-500" />
                          )}
                          {resultItem.queued_node_title && (
                            <Printer className="h-3 w-3 text-blue-600" />
                          )}
                          <span className="truncate">{nextText}</span>
                        </span>
                      ) : nextText ? (
                        <span className="text-muted-foreground truncate">
                          {nextText}
                        </span>
                      ) : null}
                    </div>
                  );
                }

                return null;
              })}
            </>
          ))}
        </div>
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
      <div className="flex items-center gap-4 text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
        <span className="font-semibold text-foreground">操作:</span>
        <span>← → 教材移動</span>
        <span>↑ ↓ 行移動</span>
        <span>Enter 次の行へ</span>
        <span>Space/Enter 合格切替</span>
        <span>Ctrl+S 保存</span>
        <span>Esc 戻る</span>
      </div>
    </div>
  );
}
