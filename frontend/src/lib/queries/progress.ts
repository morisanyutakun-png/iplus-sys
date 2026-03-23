import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";
import type { DashboardStats, ProgressEntry, PrintLogEntry, PrintJob } from "../types";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardStats>("/api/progress/dashboard"),
  });
}

export function useStudentProgress(studentId: string) {
  return useQuery({
    queryKey: ["progress", studentId],
    queryFn: () =>
      apiFetch<{
        student_id: string;
        student_name: string;
        materials: {
          material_key: string;
          material_name: string;
          pointer: number;
          total_nodes: number;
          percent: number;
        }[];
        history: ProgressEntry[];
      }>(`/api/progress/student/${studentId}`),
    enabled: !!studentId,
  });
}

export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: () =>
      apiFetch<{ jobs: PrintJob[] }>("/api/jobs").then((r) => r.jobs),
  });
}

export function useLogs() {
  return useQuery({
    queryKey: ["logs"],
    queryFn: () =>
      apiFetch<{ logs: PrintLogEntry[] }>("/api/logs").then((r) => r.logs),
  });
}

export function useAcknowledgeReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { student_id: string; material_key: string }) =>
      apiFetch("/api/progress/acknowledge-reminder", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUnacknowledgeReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { student_id: string; material_key: string }) =>
      apiFetch("/api/progress/unacknowledge-reminder", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useAcknowledgeLowAccuracy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { student_id: string; material_key: string; node_key: string }) =>
      apiFetch("/api/progress/acknowledge-low-accuracy", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUnacknowledgeLowAccuracy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { student_id: string; material_key: string; node_key: string }) =>
      apiFetch("/api/progress/unacknowledge-low-accuracy", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
