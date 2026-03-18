"use client";

import { useState } from "react";
import { useCreateStudent } from "@/lib/queries/students";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function StudentCreateDialog() {
  const createMutation = useCreateStudent();
  const [open, setOpen] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    if (!newId.trim() || !newName.trim()) return;
    createMutation.mutate(
      { id: newId.trim(), name: newName.trim() },
      {
        onSuccess: () => {
          toast.success("生徒を登録しました");
          setOpen(false);
          setNewId("");
          setNewName("");
        },
        onError: (err) => {
          toast.error(`登録に失敗しました: ${err.message}`);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          生徒追加
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>生徒登録</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              生徒ID（Classroom ID）
            </label>
            <Input
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="例: 123456789"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              生徒氏名
            </label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例: 山田太郎"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>
          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={
              !newId.trim() || !newName.trim() || createMutation.isPending
            }
          >
            登録
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
