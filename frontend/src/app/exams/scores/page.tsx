"use client";

import { useState } from "react";
import { useStudents } from "@/lib/queries/students";
import { useExamMaterials } from "@/lib/queries/exam-materials";
import { useExamScores } from "@/lib/queries/exam-scores";
import { useExamAssignments, useAssignExam, useUnassignExam } from "@/lib/queries/exam-assignments";
import { ExamScoreGrid } from "@/components/exams/exam-score-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowLeft, UserPlus, UserMinus } from "lucide-react";
import Link from "next/link";
import type { ExamMaterial } from "@/lib/types";

export default function ExamScoresPage() {
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedExamId, setSelectedExamId] = useState<number>(0);

  const { data: students } = useStudents();
  const { data: allExams } = useExamMaterials();
  const { data: assignments } = useExamAssignments(selectedStudentId);
  const { data: scores } = useExamScores(selectedStudentId, selectedExamId || undefined);
  const assignMutation = useAssignExam();
  const unassignMutation = useUnassignExam();

  const selectedExam = allExams?.find((e) => e.id === selectedExamId);
  const assignedExamIds = new Set((assignments || []).map((a) => a.exam_material_id));
  const isAssigned = selectedExamId ? assignedExamIds.has(selectedExamId) : false;

  const handleAssign = () => {
    if (!selectedStudentId || !selectedExamId) return;
    assignMutation.mutate(
      { student_id: selectedStudentId, exam_material_id: selectedExamId },
      {
        onSuccess: () => toast.success("試験を割り当てました"),
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleUnassign = () => {
    if (!selectedStudentId || !selectedExamId) return;
    unassignMutation.mutate(
      { student_id: selectedStudentId, exam_material_id: selectedExamId },
      {
        onSuccess: () => toast.success("試験割り当てを解除しました"),
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/exams">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">スコア入力</h1>
          <p className="text-sm text-muted-foreground">
            生徒と試験を選択してスコアを入力
          </p>
        </div>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">生徒</label>
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger>
              <SelectValue placeholder="生徒を選択" />
            </SelectTrigger>
            <SelectContent>
              {(students || []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} {s.grade ? `(${s.grade})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">試験</label>
          <Select
            value={selectedExamId ? String(selectedExamId) : ""}
            onValueChange={(v) => setSelectedExamId(Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="試験を選択" />
            </SelectTrigger>
            <SelectContent>
              {(allExams || []).map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name}
                  {assignedExamIds.has(e.id) ? " ✓" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Assignment control */}
      {selectedStudentId && selectedExamId > 0 && (
        <div className="flex items-center gap-3">
          {isAssigned ? (
            <Badge variant="secondary" className="gap-1">
              割り当て済み
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-muted-foreground hover:text-destructive"
                onClick={handleUnassign}
                disabled={unassignMutation.isPending}
              >
                <UserMinus className="h-3 w-3" />
              </Button>
            </Badge>
          ) : (
            <Button variant="outline" size="sm" onClick={handleAssign} disabled={assignMutation.isPending}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              この生徒に割り当て
            </Button>
          )}
        </div>
      )}

      {/* Score Grid */}
      {selectedStudentId && selectedExam ? (
        <Card className="border-0 shadow-premium">
          <CardHeader>
            <CardTitle className="text-sm">
              {selectedExam.name} — スコア入力
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExamScoreGrid
              key={`${selectedStudentId}-${selectedExamId}`}
              studentId={selectedStudentId}
              examMaterial={selectedExam}
              existingScores={scores || []}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm">生徒と試験を選択してください</p>
        </div>
      )}
    </div>
  );
}
