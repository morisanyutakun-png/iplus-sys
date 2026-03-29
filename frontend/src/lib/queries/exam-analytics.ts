import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";
import type { CompressedScoreResult, ExamOverview } from "../types";

export function useExamOverview(
  examMaterialId?: number,
  examType?: string,
  grade?: string,
  attemptDate?: string,
) {
  return useQuery({
    queryKey: ["exam-analytics", "overview", examMaterialId, examType, grade, attemptDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (examMaterialId) params.set("exam_material_id", String(examMaterialId));
      if (examType) params.set("exam_type", examType);
      if (grade) params.set("grade", grade);
      if (attemptDate) params.set("attempt_date", attemptDate);
      return apiFetch<ExamOverview>(`/api/exam-analytics/overview?${params}`);
    },
    // Always enabled — either specific exam or cross-exam aggregation
    enabled: true,
  });
}

export function useCompressedScore(studentId: string, weightId: number, examMaterialId?: number) {
  return useQuery({
    queryKey: ["exam-analytics", "compressed", studentId, weightId, examMaterialId],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("weight_id", String(weightId));
      if (examMaterialId) params.set("exam_material_id", String(examMaterialId));
      return apiFetch<CompressedScoreResult>(
        `/api/exam-analytics/compressed/${studentId}?${params}`
      );
    },
    enabled: !!studentId && !!weightId,
  });
}
