"use client";

import { useState } from "react";
import {
  useUniversityWeights,
  useCreateUniversityWeight,
  useDeleteUniversityWeight,
} from "@/lib/queries/university-weights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, X, GraduationCap } from "lucide-react";

type WeightEntry = { subject_name: string; max: number; compressed_max: number };

export function UniversityWeightManager() {
  const { data: weights, isLoading } = useUniversityWeights();
  const createMutation = useCreateUniversityWeight();
  const deleteMutation = useDeleteUniversityWeight();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");
  const [faculty, setFaculty] = useState("");
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [newMax, setNewMax] = useState("100");
  const [newCompressed, setNewCompressed] = useState("100");

  const handleAddEntry = () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    if (entries.some((e) => e.subject_name === trimmed)) {
      toast.error("同じ教科が既に追加されています");
      return;
    }
    setEntries([
      ...entries,
      { subject_name: trimmed, max: Number(newMax) || 100, compressed_max: Number(newCompressed) || 100 },
    ]);
    setNewSubject("");
    setNewMax("100");
    setNewCompressed("100");
  };

  const handleCreate = () => {
    if (!name.trim() || !university.trim() || !faculty.trim()) {
      toast.error("名前・大学・学部を入力してください");
      return;
    }
    if (entries.length === 0) {
      toast.error("教科を1つ以上追加してください");
      return;
    }
    const weightsObj: Record<string, { max: number; compressed_max: number }> = {};
    let totalCompressed = 0;
    for (const e of entries) {
      weightsObj[e.subject_name] = { max: e.max, compressed_max: e.compressed_max };
      totalCompressed += e.compressed_max;
    }
    createMutation.mutate(
      {
        name: name.trim(),
        university: university.trim(),
        faculty: faculty.trim(),
        weights: weightsObj,
        total_compressed_max: totalCompressed,
      },
      {
        onSuccess: () => {
          toast.success("圧縮点プロファイルを作成しました");
          setOpen(false);
          setName("");
          setUniversity("");
          setFaculty("");
          setEntries([]);
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleDelete = (id: number, wName: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success(`${wName} を削除しました`),
      onError: (e) => toast.error(e.message),
    });
  };

  if (isLoading) {
    return <div className="h-32 rounded-xl skeleton-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          大学別の共テ圧縮点を計算するための配点プロファイルを管理します。
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              プロファイル追加
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>圧縮点プロファイルを作成</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="プロファイル名 (例: 東大理一)"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  placeholder="大学名"
                />
                <Input
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  placeholder="学部・学科"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">教科配点 ({entries.length})</label>
                {entries.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-2">
                    {entries.map((e, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted">
                        <span>{e.subject_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">
                            {e.max}→{e.compressed_max}点
                          </span>
                          <button
                            onClick={() => setEntries(entries.filter((_, j) => j !== i))}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="text-xs text-right text-muted-foreground pt-1 border-t">
                      圧縮後合計: {entries.reduce((s, e) => s + e.compressed_max, 0)}点
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="教科名"
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleAddEntry()}
                  />
                  <Input
                    value={newMax}
                    onChange={(e) => setNewMax(e.target.value)}
                    type="number"
                    className="w-16"
                    placeholder="元"
                  />
                  <Input
                    value={newCompressed}
                    onChange={(e) => setNewCompressed(e.target.value)}
                    type="number"
                    className="w-16"
                    placeholder="圧縮"
                  />
                  <Button variant="outline" size="icon" onClick={handleAddEntry}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                作成
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(weights || []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <GraduationCap className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">プロファイルがまだ登録されていません</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(weights || []).map((w) => (
            <Card key={w.id} className="border-0 shadow-premium">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{w.name}</CardTitle>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>プロファイルを削除しますか？</AlertDialogTitle>
                        <AlertDialogDescription>
                          「{w.name}」を削除します。この操作は元に戻せません。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(w.id, w.name)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          削除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <p className="text-xs text-muted-foreground">
                  {w.university} {w.faculty} · 圧縮後満点 {w.total_compressed_max}点
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(w.weights).map(([subj, cfg]) => (
                    <div key={subj} className="flex items-center justify-between text-xs py-0.5">
                      <span>{subj}</span>
                      <span className="text-muted-foreground">
                        {cfg.max}→{cfg.compressed_max}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
