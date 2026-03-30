import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { StudentAnalytics } from "@/lib/types";

export function useStudentAnalytics(studentId: string) {
  return useQuery({
    queryKey: ["student-analytics", studentId],
    queryFn: () =>
      apiFetch<StudentAnalytics>(`/api/analytics/students/${studentId}`),
    enabled: !!studentId,
  });
}

export type AccuracyEntry = {
  date: string;
  material_key: string;
  material_name: string;
  accuracy_rate: number;
};

export function useStudentAccuracy(studentId: string) {
  return useQuery({
    queryKey: ["student-accuracy", studentId],
    queryFn: () =>
      apiFetch<{ entries: AccuracyEntry[] }>(`/api/analytics/students/${studentId}/accuracy`),
    enabled: !!studentId,
  });
}
