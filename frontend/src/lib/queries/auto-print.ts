import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { NextPrintItem, PrintLogEntry } from "@/lib/types";

export function useNextPrints(studentId: string) {
  return useQuery({
    queryKey: ["next-prints", studentId],
    queryFn: () =>
      apiFetch<{ items: NextPrintItem[] }>(
        `/api/print/students/${studentId}/next-prints`
      ),
    select: (data) => data.items,
    enabled: !!studentId,
  });
}

export function useAutoQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params?: { studentIds?: string[]; printMode?: string }) =>
      apiFetch<{ queued: number; students: number }>("/api/print/auto-queue", {
        method: "POST",
        body: JSON.stringify({
          student_ids: params?.studentIds ?? null,
          print_mode: params?.printMode ?? "both",
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["next-prints"] });
    },
  });
}

export function useStudentPrintHistory(studentId: string) {
  return useQuery({
    queryKey: ["print-history", studentId],
    queryFn: () =>
      apiFetch<{ logs: PrintLogEntry[] }>(
        `/api/print/students/${studentId}/print-history`
      ),
    select: (data) => data.logs,
    enabled: !!studentId,
  });
}
