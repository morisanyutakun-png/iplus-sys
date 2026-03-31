"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAllMaterials } from "@/lib/queries/materials";
import { useMasteryBatch } from "@/lib/queries/lesson-records";
import { useExamMaterials } from "@/lib/queries/exam-materials";
import { useInstructors } from "@/lib/queries/instructors";
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
  StudentMaterialInfo,
  Material,
  MasteryInput,
  MasteryBatchResponse,
} from "@/lib/types";
import {
  getSubjectSortIndex,
  getSubjectHeaderColor,
  getWordTestHeaderColor,
  EXAM_HEADER_COLOR,
} from "@/lib/subjects";

// ── Column sorting & header colors ──

type ColObj = { sm: StudentMaterialInfo; material?: Material; isExam: boolean };

function getColumnSortKey(col: ColObj): number {
  const subject = col.material?.subject ?? "";
  if (col.sm.material_key.startsWith("単語:")) {
    return getSubjectSortIndex(subject);
  }
  if (col.isExam) {
    return 1000 + getSubjectSortIndex(subject);
  }
  return 100 + getSubjectSortIndex(subject);
}

function getHeaderColor(col: ColObj): string {
  const subject = col.material?.subject ?? "";
  if (col.isExam) return EXAM_HEADER_COLOR;
  if (col.sm.material_key.startsWith("単語:")) return getWordTestHeaderColor(subject);
  return getSubjectHeaderColor(subject);
}

type ColInput = {
  score: number | null;
  maxScore: number | null;
  passed: boolean;
  skipped: boolean;
};

type StudentListItem = {
  id: string;
  name: string;
  grade?: string | null;
  materials: { percent: number }[];
};

type Props = {
  student: Student;
  active: boolean;
  onActivate?: () => void;
  onEscape: () => void;
  onPendingChange?: (hasPending: boolean) => void;
  instructorId?: number | null;
  onInstructorChange?: (id: number | null) => void;
  students?: StudentListItem[];
  onSelectStudent?: (id: string) => void;
};

export function MasterySpreadsheet({ student, active, onActivate, onEscape, onPendingChange, instructorId, onInstructorChange, students, onSelectStudent }: Props) {
  const { data: allMaterials } = useAllMaterials();
  const { data: allExamMaterials } = useExamMaterials();
  const { data: instructors } = useInstructors();
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

  // Instructor: use prop if provided, otherwise local state fallback
  const selectedInstructorId = instructorId ?? null;
  const setSelectedInstructorId = (id: number | null) => onInstructorChange?.(id);

  const todayStr = new Date().toISOString().split("T")[0];

  // Reset inputs when student changes
  useEffect(() => {
    setInputs({});
    setLastResult(null);
  }, [student.id]);

  // Build columns: one per assigned material, sorted by subject group
  const columns = useMemo(() => {
    return student.materials
      .map((sm) => {
        const material = allMaterials?.find((m) => m.key === sm.material_key);
        const nodes = material?.nodes
          ? [...material.nodes].sort((a, b) => a.sort_order - b.sort_order)
          : [];
        const currentNode =
          nodes.find((n) => n.sort_order === sm.pointer) ?? null;
        const nextNode =
          nodes.find((n) => n.sort_order === sm.pointer + 1) ?? null;
        const isWordTest = sm.material_key.startsWith("単語:");
        const effectiveTotal = sm.max_node || sm.total_nodes;
        const isReviewMode = isWordTest && sm.pointer > effectiveTotal;
        const isCompleted = !isWordTest && sm.pointer > effectiveTotal;
        const isExam = !!material?.exam_material_id;
        // In review mode, use the last node as reference
        const reviewNode = isReviewMode && nodes.length > 0 ? nodes[nodes.length - 1] : null;
        const effectiveCurrentNode = isReviewMode ? reviewNode : currentNode;
        const examMaxScore = effectiveCurrentNode ? examMaxScoreMap.get(effectiveCurrentNode.key) ?? null : null;
        return { sm, material, nodes, currentNode: effectiveCurrentNode, nextNode, isCompleted, isExam, examMaxScore, isWordTest, isReviewMode };
      })
      .sort((a, b) => getColumnSortKey(a) - getColumnSortKey(b));
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
    inputs[materialKey] ?? { score: null, maxScore: null, passed: false, skipped: false };

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
      if (current.skipped) return; // Can't toggle pass when skipped
      setInput(col.sm.material_key, { passed: !current.passed });
    },
    [columns, inputs]
  );

  const toggleSkip = useCallback(
    (colIndex: number) => {
      const col = columns[colIndex];
      if (!col || col.isCompleted) return;
      const current = getInput(col.sm.material_key);
      const newSkipped = !current.skipped;
      // When marking as skipped, clear other inputs
      if (newSkipped) {
        setInput(col.sm.material_key, { skipped: true, score: null, maxScore: null, passed: false });
      } else {
        setInput(col.sm.material_key, { skipped: false });
      }
    },
    [columns, inputs]
  );

  // Count columns that have input and total active (non-completed) columns
  const { pendingCount, activeCount } = useMemo(() => {
    let pending = 0;
    let active = 0;
    for (const col of columns) {
      if (col.isCompleted) continue;
      active++;
      const input = getInput(col.sm.material_key);
      if (input.skipped) {
        pending++;
      } else if (col.isExam) {
        if (input.score !== null) pending++;
      } else {
        if (input.passed || input.score !== null) pending++;
      }
    }
    return { pendingCount: pending, activeCount: active };
  }, [inputs, columns]);

  const allFilled = activeCount > 0 && pendingCount === activeCount;

  useEffect(() => {
    onPendingChange?.(pendingCount > 0);
  }, [pendingCount, onPendingChange]);

  const handleSave = useCallback(() => {
    // Validation: 講師選択チェック
    if (!selectedInstructorId) {
      toast.error("講師を選択してから反映してください");
      return;
    }

    // Validation: 全項目入力チェック
    if (!allFilled) {
      toast.error("全ての教材の入力を完了してから反映してください");
      return;
    }

    // Validation: 得点入力時の整合性チェック
    for (const col of columns) {
      if (col.isCompleted) continue;
      const input = getInput(col.sm.material_key);
      if (input.skipped || input.score === null) continue;

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

      // Skipped: send as retry with no score (same range repeats)
      if (input.skipped) {
        if (!col.currentNode) continue;
        records.push({
          student_id: student.id,
          material_key: col.sm.material_key,
          node_key: col.currentNode.key,
          lesson_date: todayStr,
          status: "retry",
          instructor_id: selectedInstructorId ?? undefined,
        });
        continue;
      }

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
          instructor_id: selectedInstructorId ?? undefined,
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
          instructor_id: selectedInstructorId ?? undefined,
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
  }, [columns, inputs, student.id, todayStr, masteryMutation, allFilled, selectedInstructorId]);

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
    { key: "skip",    label: "未実施",     editable: true, editRow: 3 },
    { key: "score",   label: "得点",       editable: true, editRow: 0 },
    { key: "max",     label: "満点",       editable: true, editRow: 1 },
    { key: "pass",    label: "合格",       editable: true, editRow: 2 },
    { key: "next",    label: "次回の範囲", editable: false },
  ] as const;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {/* Student switcher */}
          {students && students.length > 0 && onSelectStudent && (
            <select
              className="text-xs font-semibold rounded-md border px-2 py-1 bg-background max-w-[140px]"
              value={student.id}
              onChange={(e) => onSelectStudent(e.target.value)}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.grade ? ` (${s.grade})` : ""}</option>
              ))}
            </select>
          )}
          <Badge variant="outline" className="text-xs">
            {todayStr}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {student.materials.length}教材
          </span>
          <span className="text-xs text-muted-foreground">|</span>
          <select
            className={cn(
              "text-xs rounded-md border px-2 py-1 bg-background",
              !selectedInstructorId && "text-muted-foreground border-amber-300"
            )}
            value={selectedInstructorId ?? ""}
            onChange={(e) => setSelectedInstructorId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">講師を選択...</option>
            {instructors?.map((inst) => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <>
              <Badge variant={allFilled ? "secondary" : "outline"} className={cn("text-xs", !allFilled && "text-amber-600 border-amber-300")}>
                {pendingCount}/{activeCount}件入力済
              </Badge>
              <Button size="sm" variant="ghost" onClick={handleReset}>
                <RotateCcw className="mr-1 h-3 w-3" />
                リセット
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!allFilled || masteryMutation.isPending}
                title={!allFilled ? "全ての教材を入力してください" : ""}
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
                        `flex items-center justify-center px-3 py-2 text-sm font-bold border-b border-r border-border text-white ${getHeaderColor(col)}`,
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
                      ) : col.isReviewMode ? (
                        <span className="text-center leading-tight">
                          <span className="font-medium text-violet-600">総復習</span>
                          <span className="block text-[10px] text-muted-foreground">
                            ランダム出題
                          </span>
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

                // ── Row: Skip (未実施) checkbox ──
                if (rowDef.key === "skip") {
                  return (
                    <div
                      key={`${rowIdx}-${colIdx}`}
                      className={cn(
                        "flex items-center justify-center px-2 py-1.5 border-b border-r border-border transition-colors",
                        input.skipped
                          ? "bg-orange-50"
                          : "bg-white"
                      )}
                      onClick={() => !col.isCompleted && toggleSkip(colIdx)}
                    >
                      {!col.isCompleted && (
                        <PassCheckbox
                          checked={input.skipped}
                          onToggle={() => toggleSkip(colIdx)}
                          isFocused={false}
                          variant="skip"
                        />
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
                        input.skipped
                          ? "bg-orange-50/50 opacity-40"
                          : isFocused
                          ? "bg-primary/5 ring-inset ring-1 ring-primary/20"
                          : isActiveCol
                          ? "bg-amber-50/50"
                          : "bg-white"
                      )}
                      onClick={() => !input.skipped && handleCellClick(colIdx, 0)}
                    >
                      {!col.isCompleted && !input.skipped && (
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
                        className={cn(
                          "flex items-center justify-center px-2 py-1.5 border-b border-r border-border bg-gray-50",
                          input.skipped && "opacity-40"
                        )}
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
                        input.skipped
                          ? "bg-orange-50/50 opacity-40"
                          : isFocused
                          ? "bg-primary/5 ring-inset ring-1 ring-primary/20"
                          : isActiveCol
                          ? "bg-amber-50/50"
                          : "bg-white"
                      )}
                      onClick={() => !input.skipped && handleCellClick(colIdx, 1)}
                    >
                      {!col.isCompleted && !input.skipped && (
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
                        col.isExam || input.skipped
                          ? input.skipped ? "bg-orange-50/50 opacity-40" : "bg-gray-50"
                          : input.passed
                          ? "bg-emerald-50"
                          : isFocused
                          ? "bg-primary/5 ring-inset ring-1 ring-primary/20"
                          : isActiveCol
                          ? "bg-amber-50/50"
                          : "bg-white"
                      )}
                      onClick={() => !col.isExam && !input.skipped && handleCellClick(colIdx, 2)}
                    >
                      {!col.isCompleted && !col.isExam && !input.skipped && (
                        <PassCheckbox
                          checked={input.passed}
                          onToggle={() => togglePass(colIdx)}
                          isFocused={isFocused}
                          focusTrigger={focusTrigger}
                        />
                      )}
                      {(col.isExam || input.skipped) && (
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
                  } else if (input.skipped) {
                    nextText = `↻ 同じ範囲を再実施`;
                  } else if (col.isReviewMode) {
                    // Word test review mode: always generates next review
                    nextText = "→ 総復習（次回）";
                  } else if (input.passed && col.nextNode) {
                    nextText = `→ ${col.nextNode.title}`;
                  } else if (input.passed && !col.nextNode && col.isWordTest) {
                    nextText = "→ 総復習へ";
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
