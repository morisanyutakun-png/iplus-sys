"use client";

import { useState } from "react";
import {
  useMaterialZones,
  useToggleMaterial,
  useSavePointers,
} from "@/lib/queries/students";
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
} from "lucide-react";

type Props = {
  studentId: string;
};

export function MaterialManager({ studentId }: Props) {
  const { data: zones } = useMaterialZones(studentId);
  const toggleMutation = useToggleMaterial(studentId);
  const saveMutation = useSavePointers(studentId);

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

  return (
    <div className="space-y-6">
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
                ? Math.round((currentPointer / mat.total_nodes) * 100)
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
