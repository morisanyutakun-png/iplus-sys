import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";
import type { ExamScore, ExamScoreUpsert, StudentExamSummary } from "../types";

export function useExamScores(studentId?: string, examMaterialId?: number) {
  return useQuery({
    queryKey: ["exam-scores", studentId, examMaterialId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (studentId) params.set("student_id", studentId);
      if (examMaterialId) params.set("exam_material_id", String(examMaterialId));
      const qs = params.toString();
      return apiFetch<ExamScore[]>(`/api/exam-scores${qs ? `?${qs}` : ""}`);
    },
  });
}

export function useBatchUpsertExamScores() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scores: ExamScoreUpsert[]) =>
      apiFetch<{ upserted: number }>("/api/exam-scores/batch", {
        method: "POST",
        body: JSON.stringify({ scores }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-scores"] });
      qc.invalidateQueries({ queryKey: ["exam-summary"] });
      qc.invalidateQueries({ queryKey: ["exam-analytics"] });
    },
  });
}

export function useStudentExamSummary(studentId: string, examMaterialId?: number) {
  return useQuery({
    queryKey: ["exam-summary", studentId, examMaterialId],
    queryFn: () => {
      const params = examMaterialId ? `?exam_material_id=${examMaterialId}` : "";
      return apiFetch<StudentExamSummary>(
        `/api/exam-scores/student/${studentId}/summary${params}`
      );
    },
    enabled: !!studentId,
  });
}
