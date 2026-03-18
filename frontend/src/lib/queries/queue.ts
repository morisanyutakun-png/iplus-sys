import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";
import type { QueueItem } from "../types";

export function useQueue() {
  return useQuery({
    queryKey: ["queue"],
    queryFn: () =>
      apiFetch<{ items: QueueItem[] }>("/api/queue").then((r) => r.items),
  });
}

export function useAddToQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      student_id: string;
      material_key: string;
      node_key?: string;
    }) =>
      apiFetch("/api/queue", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
}

export function useRemoveFromQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/queue/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
}

export function useReorderQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemIds: number[]) =>
      apiFetch("/api/queue/reorder", {
        method: "POST",
        body: JSON.stringify({ item_ids: itemIds }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
}

export function useExecutePrint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (printerName?: string) =>
      apiFetch<{ job_id: string; results: unknown[] }>("/api/jobs/execute", {
        method: "POST",
        body: JSON.stringify({ printer_name: printerName }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["logs"] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function usePrinters() {
  return useQuery({
    queryKey: ["printers"],
    queryFn: () =>
      apiFetch<{ printers: string[]; default: string }>("/api/jobs/printers"),
  });
}
