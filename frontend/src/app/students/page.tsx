"use client";

import { useState } from "react";
import Link from "next/link";
import { useStudents, useCreateStudent } from "@/lib/queries/students";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
import { Settings, Plus, Printer } from "lucide-react";
import { useAutoQueue } from "@/lib/queries/auto-print";

export default function StudentsPage() {
  const { data: students, isLoading } = useStudents();
  const createMutation = useCreateStudent();
  const autoQueueMutation = useAutoQueue();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    if (!newId.trim() || !newName.trim()) return;
    createMutation.mutate(
      { id: newId.trim(), name: newName.trim() },
      {
        onSuccess: () => {
          toast.success("生徒を登録しました");
          setDialogOpen(false);
          setNewId("");
          setNewName("");
        },
        onError: (err) => {
          toast.error(`登録に失敗しました: ${err.message}`);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">生徒管理</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{students?.length || 0} 名</Badge>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
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
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={
                    !newId.trim() ||
                    !newName.trim() ||
                    createMutation.isPending
                  }
                >
                  登録
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(students || []).map((student) => {
          const avgPercent =
            student.materials.length > 0
              ? student.materials.reduce((a, m) => a + m.percent, 0) /
                student.materials.length
              : 0;

          return (
            <Card key={student.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{student.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      ID: {student.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="次回分を印刷"
                      onClick={(e) => {
                        e.preventDefault();
                        autoQueueMutation.mutate([student.id], {
                          onSuccess: (data) =>
                            toast.success(`${data.queued}件をキューに追加`),
                        });
                      }}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Link href={`/students/${student.id}`}>
                      <Button variant="ghost" size="icon">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">総合進捗</span>
                    <span className="font-medium">
                      {Math.round(avgPercent)}%
                    </span>
                  </div>
                  <Progress value={avgPercent} />
                </div>

                <div className="mt-4 space-y-2">
                  {student.materials.map((mat) => (
                    <div
                      key={mat.material_key}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="truncate max-w-[140px]">
                        {mat.material_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {mat.pointer}/{mat.total_nodes}
                        </span>
                        <div className="h-1.5 w-16 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.min(mat.percent, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {student.materials.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      教材未割当
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
