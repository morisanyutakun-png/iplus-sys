import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";
import type { ExamAssignment } from "../types";

export function useExamAssignments(studentId: string) {
  return useQuery({
    queryKey: ["exam-assignments", studentId],
    queryFn: () =>
      apiFetch<ExamAssignment[]>(`/api/exam-assignments/${studentId}`),
    enabled: !!studentId,
  });
}

export function useAssignExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { student_id: string; exam_material_id: number }) =>
      apiFetch<ExamAssignment>("/api/exam-assignments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-assignments"] });
    },
  });
}

export function useUnassignExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { student_id: string; exam_material_id: number }) =>
      apiFetch(`/api/exam-assignments/${data.student_id}/${data.exam_material_id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-assignments"] });
    },
  });
}
