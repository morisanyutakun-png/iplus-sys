"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMaterials } from "@/lib/queries/materials";
import { useStudents } from "@/lib/queries/students";
import {
  useLessonRecords,
  useBatchUpsertRecords,
} from "@/lib/queries/lesson-records";
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
import { Save, Table2, RotateCcw } from "lucide-react";
import type { LessonRecordUpsert, Student, MaterialNode } from "@/lib/types";

type CellValue = {
  score: number | null;
  status: "completed" | "partial" | "skipped" | "retry" | "";
};

type PendingMap = Record<string, CellValue>;

function cellKey(studentId: string, nodeKey: string) {
  return `${studentId}__${nodeKey}`;
}

export default function ScoringPage() {
  const { data: materials, isLoading: matsLoading } = useMaterials();
  const { data: students, isLoading: studsLoading } = useStudents();
  const batchUpsertMutation = useBatchUpsertRecords();

  const [selectedMaterialKey, setSelectedMaterialKey] = useState("");
  const [pending, setPending] = useState<PendingMap>({});
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  // Fetch existing records for the selected material
  const { data: existingRecords } = useLessonRecords(
    undefined,
    selectedMaterialKey || undefined
  );

  const selectedMaterial = materials?.find(
    (m) => m.key === selectedMaterialKey
  );

  // Filter students who have this material assigned
  const relevantStudents = (students || []).filter((s) =>
    s.materials.some((m) => m.material_key === selectedMaterialKey)
  );

  const nodes = selectedMaterial?.nodes || [];

  // Lookup existing record value
  const getExisting = useCallback(
    (studentId: string, nodeKey: string): CellValue => {
      const rec = existingRecords?.find(
        (r) =>
          r.student_id === studentId &&
          r.node_key === nodeKey &&
          r.lesson_date === todayStr
      );
      if (rec) {
        return {
          score: rec.score ?? null,
          status: (rec.status as CellValue["status"]) || "",
        };
      }
      return { score: null, status: "" };
    },
    [existingRecords, todayStr]
  );

  const getCellValue = useCallback(
    (studentId: string, nodeKey: string): CellValue => {
      const key = cellKey(studentId, nodeKey);
      if (pending[key]) return pending[key];
      return getExisting(studentId, nodeKey);
    },
    [pending, getExisting]
  );

  const updateCell = useCallback(
    (studentId: string, nodeKey: string, value: Partial<CellValue>) => {
      const key = cellKey(studentId, nodeKey);
      setPending((prev) => {
        const existing = prev[key] || getExisting(studentId, nodeKey);
        return { ...prev, [key]: { ...existing, ...value } };
      });
    },
    [getExisting]
  );

  // Toggle pass/fail on click
  const toggleStatus = useCallback(
    (studentId: string, nodeKey: string) => {
      const current = getCellValue(studentId, nodeKey);
      let nextStatus: CellValue["status"];
      if (current.status === "" || current.status === "partial") {
        nextStatus = "completed";
      } else if (current.status === "completed") {
        nextStatus = "retry";
      } else {
        nextStatus = "";
      }
      updateCell(studentId, nodeKey, { status: nextStatus });
    },
    [getCellValue, updateCell]
  );

  const handleScoreInput = useCallback(
    (studentId: string, nodeKey: string, raw: string) => {
      const val = raw === "" ? null : Math.min(100, Math.max(0, parseInt(raw) || 0));
      updateCell(studentId, nodeKey, { score: val });
    },
    [updateCell]
  );

  const pendingCount = Object.keys(pending).length;

  const handleSave = () => {
    const records: LessonRecordUpsert[] = [];
    for (const [key, value] of Object.entries(pending)) {
      const [studentId, nodeKey] = key.split("__");
      if (!value.status && value.score === null) continue;
      records.push({
        student_id: studentId,
        material_key: selectedMaterialKey,
        node_key: nodeKey,
        lesson_date: todayStr,
        status: value.status || "completed",
        score: value.score ?? undefined,
      });
    }
    if (records.length === 0) {
      toast.info("保存するデータがありません");
      return;
    }
    batchUpsertMutation.mutate(records, {
      onSuccess: () => {
        toast.success(`${records.length}件の記録を保存しました`);
        setPending({});
      },
      onError: (err) => toast.error(`エラー: ${err.message}`),
    });
  };

  const handleReset = () => {
    setPending({});
    toast.info("変更をリセットしました");
  };

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      studentIdx: number,
      nodeIdx: number,
      type: "score" | "status"
    ) => {
      const maxRow = relevantStudents.length - 1;
      const maxCol = nodes.length - 1;

      let nextRow = studentIdx;
      let nextCol = nodeIdx;

      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        nextCol = nodeIdx < maxCol ? nodeIdx + 1 : 0;
        if (nodeIdx >= maxCol) nextRow = Math.min(studentIdx + 1, maxRow);
      } else if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        nextCol = nodeIdx > 0 ? nodeIdx - 1 : maxCol;
        if (nodeIdx <= 0) nextRow = Math.max(studentIdx - 1, 0);
      } else if (e.key === "Enter") {
        e.preventDefault();
        nextRow = Math.min(studentIdx + 1, maxRow);
      } else if (e.key === "ArrowDown") {
        nextRow = Math.min(studentIdx + 1, maxRow);
      } else if (e.key === "ArrowUp") {
        nextRow = Math.max(studentIdx - 1, 0);
      } else if (e.key === "ArrowRight" && type === "status") {
        nextCol = Math.min(nodeIdx + 1, maxCol);
      } else if (e.key === "ArrowLeft" && type === "status") {
        nextCol = Math.max(nodeIdx - 1, 0);
      } else {
        return;
      }

      const nextId = `cell-${nextRow}-${nextCol}`;
      setActiveCell(nextId);
      setTimeout(() => {
        const el = document.getElementById(nextId);
        if (el) {
          el.focus();
          if (el.tagName === "INPUT") (el as HTMLInputElement).select();
        }
      }, 0);
    },
    [relevantStudents.length, nodes.length]
  );

  const statusDisplay = (status: CellValue["status"]) => {
    switch (status) {
      case "completed":
        return { label: "\u25cb", className: "bg-red-600 text-white" };
      case "retry":
        return { label: "\u00d7", className: "bg-gray-900 text-white" };
      case "partial":
        return { label: "\u25b3", className: "bg-gray-400 text-white" };
      case "skipped":
        return { label: "-", className: "bg-gray-200 text-gray-600" };
      default:
        return { label: "", className: "bg-white" };
    }
  };

  const isLoading = matsLoading || studsLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Table2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">定着度入力</h1>
            <p className="text-sm text-muted-foreground">
              Excel風の採点・合否入力
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
                {pendingCount}件変更
              </Badge>
              <Button size="sm" variant="ghost" onClick={handleReset}>
                <RotateCcw className="mr-1 h-3 w-3" />
                リセット
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={batchUpsertMutation.isPending}
              >
                <Save className="mr-1.5 h-4 w-4" />
                {batchUpsertMutation.isPending
                  ? "保存中..."
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
            setPending({});
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
            {relevantStudents.length}名の生徒 / {nodes.length}ノード
          </span>
        )}
      </div>

      {/* Excel Grid */}
      {isLoading ? (
        <div className="h-96 rounded-xl skeleton-pulse" />
      ) : !selectedMaterial ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Table2 className="mb-3 h-12 w-12 opacity-20" />
          <p className="text-sm">教材を選択するとスプレッドシートが表示されます</p>
        </div>
      ) : relevantStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <p className="text-sm">
            この教材が割り当てられている生徒がいません
          </p>
        </div>
      ) : (
        <div
          ref={gridRef}
          className="overflow-auto rounded-lg border border-border shadow-premium"
          style={{ maxHeight: "calc(100vh - 260px)" }}
        >
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-900 text-white">
                <th className="sticky left-0 z-30 bg-gray-900 border-r border-gray-700 px-3 py-2 text-left text-xs font-bold min-w-[140px]">
                  生徒名
                </th>
                {nodes.map((node) => (
                  <th
                    key={node.key}
                    className="border-r border-gray-700 px-1 py-2 text-center text-[10px] font-semibold min-w-[70px] max-w-[90px]"
                    title={node.title}
                  >
                    <div className="truncate">{node.sort_order}</div>
                    <div className="truncate text-gray-400 font-normal">
                      {node.title}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {relevantStudents.map((student, sIdx) => (
                <tr
                  key={student.id}
                  className={
                    sIdx % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }
                >
                  <td className="sticky left-0 z-10 border-r border-b border-gray-200 px-3 py-1.5 font-medium text-xs bg-inherit">
                    {student.name}
                  </td>
                  {nodes.map((node, nIdx) => {
                    const val = getCellValue(student.id, node.key);
                    const isPending = !!pending[cellKey(student.id, node.key)];
                    const display = statusDisplay(val.status);
                    const cellId = `cell-${sIdx}-${nIdx}`;

                    return (
                      <td
                        key={node.key}
                        className={`border-r border-b border-gray-200 p-0 text-center ${
                          isPending ? "bg-red-50" : ""
                        }`}
                      >
                        <div className="flex flex-col">
                          {/* Status toggle (top half) */}
                          <button
                            id={cellId}
                            type="button"
                            className={`h-7 w-full text-xs font-bold cursor-pointer transition-colors border-b border-gray-100 ${display.className} hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-inset`}
                            onClick={() =>
                              toggleStatus(student.id, node.key)
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(e, sIdx, nIdx, "status")
                            }
                            tabIndex={0}
                          >
                            {display.label}
                          </button>
                          {/* Score input (bottom half) */}
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className="h-6 w-full text-center text-[11px] bg-transparent border-0 focus:outline-none focus:bg-red-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="-"
                            value={val.score ?? ""}
                            onChange={(e) =>
                              handleScoreInput(
                                student.id,
                                node.key,
                                e.target.value
                              )
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(e, sIdx, nIdx, "score")
                            }
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {selectedMaterial && relevantStudents.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-medium">凡例:</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-4 w-4 rounded bg-red-600 text-white text-center text-[10px] leading-4 font-bold">
              {"\u25cb"}
            </span>
            合格
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-4 w-4 rounded bg-gray-900 text-white text-center text-[10px] leading-4 font-bold">
              {"\u00d7"}
            </span>
            再実施
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-4 w-4 rounded bg-red-50 border border-red-200" />
            未保存
          </span>
          <span className="ml-auto">
            Tab/Enter でセル移動 / クリックで合否切替 / 下段にスコア入力
          </span>
        </div>
      )}
    </div>
  );
}
