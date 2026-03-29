import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";
import type { ExamScoreTarget } from "../types";

export function useExamTargets(studentId: string) {
  return useQuery({
    queryKey: ["exam-targets", studentId],
    queryFn: () =>
      apiFetch<ExamScoreTarget[]>(`/api/exam-targets/${studentId}`),
    enabled: !!studentId,
  });
}

export function useBatchSetTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targets: {
      student_id: string;
      exam_material_id: number;
      exam_subject_id: number;
      target_score: number;
    }[]) =>
      apiFetch<{ upserted: number }>("/api/exam-targets/batch", {
        method: "POST",
        body: JSON.stringify({ targets }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-targets"] });
      qc.invalidateQueries({ queryKey: ["exam-summary"] });
    },
  });
}

export function useDeleteExamTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { student_id: string; exam_subject_id: number }) =>
      apiFetch(`/api/exam-targets/${data.student_id}/${data.exam_subject_id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-targets"] });
    },
  });
}
