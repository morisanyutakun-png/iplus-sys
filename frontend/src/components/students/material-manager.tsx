"use client";

import { useState } from "react";
import {
  useMaterialZones,
  useToggleMaterial,
  useSavePointers,
} from "@/lib/queries/students";
import { useAcknowledgeReminder, useUnacknowledgeReminder, useDashboard } from "@/lib/queries/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus,
  Minus,
  Save,
  BookOpen,
  Package,
  ChevronUp,
  ChevronDown,
  X,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Circle,
} from "lucide-react";

type Props = {
  studentId: string;
};

export function MaterialManager({ studentId }: Props) {
  const { data: zones } = useMaterialZones(studentId);
  const { data: dashboard } = useDashboard();
  const toggleMutation = useToggleMaterial(studentId);
  const saveMutation = useSavePointers(studentId);
  const ackMutation = useAcknowledgeReminder();
  const unackMutation = useUnacknowledgeReminder();

  const [editedPointers, setEditedPointers] = useState<
    Record<string, number>
  >({});

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

  const handlePointerChange = (materialKey: string, value: number, max: number) => {
    const clamped = Math.max(1, Math.min(value, max));
    setEditedPointers((prev) => ({ ...prev, [materialKey]: clamped }));
  };

  const handleSavePointers = () => {
    saveMutation.mutate(editedPointers, {
      onSuccess: () => {
        toast.success("ポインタを保存しました");
        setEditedPointers({});
      },
    });
  };

  const hasChanges = Object.keys(editedPointers).length > 0;
  const assigned = zones?.assigned || [];
  const source = zones?.source || [];

  // Filter nearly complete items for this student from dashboard data
  const nearlyComplete = (dashboard?.nearly_complete || []).filter(
    (item) => item.student_id === studentId
  );

  return (
    <div className="space-y-6">
      {/* ── Material Overview Summary ── */}
      {assigned.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500" />
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center h-6 w-6 rounded-md bg-blue-500/10">
                <BookOpen className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold">実施教材</h3>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full">
                {assigned.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {assigned.map((mat) => {
                const currentPointer = editedPointers[mat.key] ?? mat.pointer ?? 1;
                const completed = currentPointer - 1;
                const total = mat.total_nodes;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                const strokeColor = pct >= 90 ? "#10b981" : pct >= 50 ? "#3b82f6" : pct > 0 ? "#f59e0b" : "#d1d5db";
                const barColor = pct >= 90 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : pct > 0 ? "bg-amber-500" : "bg-gray-300";
                const size = 48;
                const sw = 4;
                const r = (size - sw) / 2;
                const circ = 2 * Math.PI * r;
                const offset = circ - (Math.min(pct, 100) / 100) * circ;

                return (
                  <div
                    key={mat.key}
                    className="flex items-center gap-3 rounded-lg bg-muted/30 border border-border/40 px-3 py-2.5 transition-all hover:bg-muted/50"
                  >
                    {/* Circular Progress */}
                    <svg width={size} height={size} className="shrink-0 -rotate-90">
                      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={sw} className="text-muted/40" />
                      <circle
                        cx={size / 2} cy={size / 2} r={r} fill="none"
                        stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
                        strokeDasharray={circ} strokeDashoffset={offset}
                        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}
                      />
                      <text
                        x={size / 2} y={size / 2}
                        textAnchor="middle" dominantBaseline="central"
                        className="fill-foreground rotate-90 origin-center"
                        fontSize={size * 0.24} fontWeight={600}
                      >
                        {pct}%
                      </text>
                    </svg>
                    {/* Material info */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold truncate block">{mat.name}</span>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="h-1.5 flex-1 rounded-full bg-muted/60">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {completed}/{total}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Nearly Complete Reminder ── */}
      {nearlyComplete.length > 0 && (
        <div className="rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200/40 dark:border-amber-800/30">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              完了間近リマインド
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full ml-auto">
              {nearlyComplete.length} 件
            </Badge>
          </div>
          <div className="p-3 space-y-2">
            {nearlyComplete.map((item) => (
              <div
                key={`${item.student_id}-${item.material_key}`}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                  item.acknowledged
                    ? "bg-amber-100/30 dark:bg-amber-900/10 opacity-50"
                    : "bg-white/60 dark:bg-white/5 border border-amber-200/40 dark:border-amber-800/30"
                )}
              >
                <button
                  type="button"
                  className="shrink-0 transition-colors"
                  onClick={() => {
                    if (item.acknowledged) {
                      unackMutation.mutate({ student_id: item.student_id, material_key: item.material_key });
                    } else {
                      ackMutation.mutate({ student_id: item.student_id, material_key: item.material_key });
                    }
                  }}
                  title={item.acknowledged ? "対処済みを取消" : "対処済みにする"}
                >
                  {item.acknowledged ? (
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                  ) : (
                    <Circle className="h-4.5 w-4.5 text-muted-foreground/40 hover:text-amber-500" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={cn("text-sm font-medium", item.acknowledged && "line-through")}>{item.material_name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                      残り {item.remaining}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {item.pointer} / {item.total_nodes}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Assigned Materials ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold">割当済み教材</h3>
            {assigned.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full">
                {assigned.length}
              </Badge>
            )}
          </div>
          {hasChanges && (
            <Button
              size="sm"
              onClick={handleSavePointers}
              disabled={saveMutation.isPending}
              className="h-7 px-3 text-xs rounded-lg shadow-sm"
            >
              <Save className="mr-1.5 h-3 w-3" />
              {saveMutation.isPending ? "保存中..." : "ポインタ保存"}
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {assigned.map((mat) => {
            const currentPointer = editedPointers[mat.key] ?? mat.pointer ?? 1;
            const percent =
              mat.total_nodes > 0
                ? Math.round(((currentPointer - 1) / mat.total_nodes) * 100)
                : 0;
            const isEdited = editedPointers[mat.key] !== undefined;

            return (
              <div
                key={mat.key}
                className={cn(
                  "group relative rounded-xl border transition-all duration-200",
                  "bg-card hover:shadow-md",
                  isEdited
                    ? "border-primary/30 bg-primary/[0.02]"
                    : "border-border/60 hover:border-border"
                )}
              >
                {/* Left accent */}
                <div className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-gradient-to-b from-primary/60 to-primary/20" />

                <div className="pl-4 pr-3 py-3">
                  {/* Top row: name + actions */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold truncate pr-2">{mat.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={cn(
                        "text-xs font-bold tabular-nums",
                        percent >= 80 ? "text-emerald-600 dark:text-emerald-400" :
                        percent >= 40 ? "text-amber-600 dark:text-amber-400" :
                        "text-muted-foreground"
                      )}>
                        {percent}%
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => handleToggle(mat.key, "remove")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2.5">
                    <Progress
                      value={Math.min(percent, 100)}
                      className="h-1.5"
                    />
                  </div>

                  {/* Stepper row */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {mat.total_nodes} 範囲
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 rounded-l-md rounded-r-none border-r-0"
                        onClick={() =>
                          handlePointerChange(mat.key, currentPointer - 1, mat.total_nodes)
                        }
                        disabled={currentPointer <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <div className="flex items-center h-6 px-2 border-y border-border bg-muted/30 text-xs font-mono tabular-nums min-w-[48px] justify-center">
                        {currentPointer}/{mat.total_nodes}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-6 w-6 rounded-r-md rounded-l-none border-l-0"
                        onClick={() =>
                          handlePointerChange(mat.key, currentPointer + 1, mat.total_nodes)
                        }
                        disabled={currentPointer >= mat.total_nodes}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {assigned.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl border border-dashed border-border/50 bg-muted/20">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted/50 mb-3">
                <BookOpen className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">教材が割り当てられていません</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                下の一覧から教材を追加できます
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Available Materials ── */}
      {source.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/10">
              <Package className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold">追加可能な教材</h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full">
              {source.length}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {source.map((mat) => (
              <button
                key={mat.key}
                type="button"
                onClick={() => handleToggle(mat.key, "assign")}
                disabled={toggleMutation.isPending}
                className={cn(
                  "group/add flex items-center gap-3 rounded-xl border border-border/50 px-3 py-2.5",
                  "bg-card hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-sm",
                  "transition-all duration-200 text-left cursor-pointer",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-lg shrink-0",
                  "bg-primary/10 text-primary",
                  "group-hover/add:bg-primary group-hover/add:text-primary-foreground",
                  "transition-all duration-200"
                )}>
                  <Plus className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium truncate block">{mat.name}</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Layers className="h-2.5 w-2.5" />
                    {mat.total_nodes} 範囲
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All assigned state */}
      {source.length === 0 && assigned.length > 0 && (
        <div className="flex items-center gap-2 py-3 px-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
          <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
            全ての教材が割り当て済みです
          </span>
        </div>
      )}
    </div>
  );
}
