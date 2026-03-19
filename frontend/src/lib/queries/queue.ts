import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiUrl } from "../api";
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

type PrintResult = { student: string; material: string; node: string; success: boolean; message: string };

type ExecutePrintParams = {
  printerName?: string;
  studentIds?: string[];
};

export function useExecutePrint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: ExecutePrintParams) =>
      apiFetch<{ job_id: string; results: PrintResult[] }>("/api/jobs/execute", {
        method: "POST",
        body: JSON.stringify({
          printer_name: params.printerName,
          student_ids: params.studentIds,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["logs"] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export type PrinterInfo = { name: string; status: string; uri?: string };

export function usePrinters() {
  return useQuery({
    queryKey: ["printers"],
    queryFn: () =>
      apiFetch<{ printers: PrinterInfo[]; default: string }>("/api/jobs/printers"),
  });
}

export function previewUrl(nodeKey: string): string {
  return apiUrl(`/api/jobs/preview/${encodeURIComponent(nodeKey)}`);
}
