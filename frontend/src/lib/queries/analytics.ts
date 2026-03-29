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
