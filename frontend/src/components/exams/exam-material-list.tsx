"use client";

import { useState } from "react";
import { useExamMaterials, useDeleteExamMaterial } from "@/lib/queries/exam-materials";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Search, Trash2, ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { ExamMaterialForm } from "./exam-material-form";
import type { ExamMaterial } from "@/lib/types";

type Props = {
  examType: "common_test" | "university_past";
};

export function ExamMaterialList({ examType }: Props) {
  const { data: materials, isLoading } = useExamMaterials(examType);
  const deleteMutation = useDeleteExamMaterial();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = (materials || []).filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (m: ExamMaterial) => {
    deleteMutation.mutate(m.id, {
      onSuccess: () => toast.success(`${m.name} を削除しました`),
      onError: (e) => toast.error(e.message),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl skeleton-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="試験を検索..."
            className="pl-9"
          />
        </div>
        <ExamMaterialForm defaultExamType={examType} />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BookOpen className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">
            {search ? "該当する試験が見つかりません" : "試験がまだ登録されていません"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const isExpanded = expandedId === m.id;
            return (
              <Card key={m.id} className="border-0 shadow-premium overflow-hidden">
                <CardContent className="p-0">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  >
                    <button className="text-muted-foreground">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{m.name}</span>
                        {m.year && (
                          <Badge variant="outline" className="text-[10px]">
                            {m.year}年
                          </Badge>
                        )}
                        {m.university && (
                          <Badge variant="secondary" className="text-[10px]">
                            {m.university}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.subjects.length}教科 · 満点合計{" "}
                        {m.subjects.reduce((sum, s) => sum + s.max_score, 0)}点
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>試験を削除しますか？</AlertDialogTitle>
                          <AlertDialogDescription>
                            「{m.name}」と関連するスコアデータがすべて削除されます。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(m)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            削除する
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {isExpanded && (
                    <div className="border-t px-4 py-3 bg-muted/30">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        教科一覧
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {m.subjects.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm"
                          >
                            <span>{s.subject_name}</span>
                            <span className="text-muted-foreground text-xs">
                              {s.max_score}点
                            </span>
                          </div>
                        ))}
                      </div>
                      {m.faculty && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {m.university} {m.faculty} {m.exam_period}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
