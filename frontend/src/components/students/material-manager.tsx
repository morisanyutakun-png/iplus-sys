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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Minus, Save, ChevronDown, ChevronRight } from "lucide-react";

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
  const [showUnassigned, setShowUnassigned] = useState(false);

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

  const hasChanges = Object.keys(editedPointers).length > 0;

  return (
    <div className="space-y-4">
      {/* Assigned materials header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">割当済み教材</h3>
        {hasChanges && (
          <Button
            size="sm"
            onClick={handleSavePointers}
            disabled={saveMutation.isPending}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            ポインタ保存
          </Button>
        )}
      </div>

      {/* Assigned list */}
      <div className="space-y-2">
        {(zones?.assigned || []).map((mat) => {
          const currentPointer = editedPointers[mat.key] ?? mat.pointer ?? 1;
          const percent =
            mat.total_nodes > 0
              ? Math.round((currentPointer / mat.total_nodes) * 100)
              : 0;

          return (
            <div
              key={mat.key}
              className="rounded-lg border border-border p-3 transition-colors hover:bg-accent/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{mat.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {currentPointer}/{mat.total_nodes}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleToggle(mat.key, "remove")}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={Math.min(percent, 100)} className="flex-1" />
                <Input
                  type="number"
                  min={1}
                  max={mat.total_nodes}
                  value={currentPointer}
                  onChange={(e) =>
                    handlePointerChange(mat.key, parseInt(e.target.value) || 1)
                  }
                  className="h-7 w-16 text-xs text-center"
                />
              </div>
            </div>
          );
        })}
        {(!zones?.assigned || zones.assigned.length === 0) && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            教材が割り当てられていません
          </p>
        )}
      </div>

      {/* Unassigned materials (collapsible) */}
      <div>
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          onClick={() => setShowUnassigned(!showUnassigned)}
        >
          {showUnassigned ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          未割当教材
          {zones?.source && zones.source.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {zones.source.length}
            </Badge>
          )}
        </button>

        {showUnassigned && (
          <div className="mt-2 space-y-1.5">
            {(zones?.source || []).map((mat) => (
              <div
                key={mat.key}
                className="flex items-center justify-between rounded-lg border border-border p-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{mat.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({mat.total_nodes}ノード)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary"
                  onClick={() => handleToggle(mat.key, "assign")}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {(!zones?.source || zones.source.length === 0) && (
              <p className="text-sm text-muted-foreground py-2">
                全ての教材が割り当て済みです
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
