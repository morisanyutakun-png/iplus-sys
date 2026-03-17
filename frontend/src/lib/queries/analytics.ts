import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { StudentAnalytics, OverviewAnalytics } from "@/lib/types";

export function useStudentAnalytics(studentId: string) {
  return useQuery({
    queryKey: ["student-analytics", studentId],
    queryFn: () =>
      apiFetch<StudentAnalytics>(`/api/analytics/students/${studentId}`),
    enabled: !!studentId,
  });
}

export function useOverviewAnalytics() {
  return useQuery({
    queryKey: ["overview-analytics"],
    queryFn: () => apiFetch<OverviewAnalytics>("/api/analytics/overview"),
  });
}
