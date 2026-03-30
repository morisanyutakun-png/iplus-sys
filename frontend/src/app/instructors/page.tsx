"use client";

import { useState } from "react";
import {
  useInstructors,
  useCreateInstructor,
  useDeleteInstructor,
} from "@/lib/queries/instructors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, UserCheck } from "lucide-react";

export default function InstructorsPage() {
  const { data: instructors, isLoading } = useInstructors();
  const createMutation = useCreateInstructor();
  const deleteMutation = useDeleteInstructor();
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) {
      toast.error("講師名を入力してください");
      return;
    }
    createMutation.mutate(name, {
      onSuccess: () => {
        setNewName("");
        toast.success("講師を登録しました");
      },
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success("講師を削除しました"),
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10">
          <UserCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">講師管理</h1>
          <p className="text-sm text-muted-foreground">
            定着度入力時に選択する講師を登録します
          </p>
        </div>
      </div>

      {/* Add instructor */}
      <div className="flex gap-2">
        <Input
          placeholder="講師名を入力..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="max-w-xs"
        />
        <Button onClick={handleCreate} disabled={createMutation.isPending}>
          <Plus className="mr-1.5 h-4 w-4" />
          登録
        </Button>
      </div>

      {/* Instructor list */}
      <div className="space-y-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        )}
        {instructors && instructors.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border/50 bg-muted/20">
            <UserCheck className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              講師が登録されていません
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              上のフォームから講師を追加してください
            </p>
          </div>
        )}
        {instructors?.map((inst) => (
          <div
            key={inst.id}
            className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 shrink-0">
              <UserCheck className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium flex-1">{inst.name}</span>
            <Badge variant="secondary" className="text-[10px]">
              ID: {inst.id}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(inst.id, inst.name)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
