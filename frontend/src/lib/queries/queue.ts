import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiUrl } from "../api";
import type { QueueItem } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
      pdf_type?: string;
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

export function useClearQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch("/api/queue/all", { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
  });
}

export function useRemoveStudentFromQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, pdfTypes }: { studentId: string; pdfTypes?: string[] }) => {
      const params = pdfTypes?.length ? `?pdf_types=${pdfTypes.join(",")}` : "";
      return apiFetch(`/api/queue/student/${encodeURIComponent(studentId)}${params}`, { method: "DELETE" });
    },
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
  pdfTypes?: string[];
  useAgent?: boolean;
};

export function useExecutePrint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: ExecutePrintParams) =>
      apiFetch<{ job_id: string; status?: string; results?: PrintResult[] }>("/api/jobs/execute", {
        method: "POST",
        body: JSON.stringify({
          printer_name: params.printerName,
          student_ids: params.studentIds,
          pdf_types: params.pdfTypes,
          use_agent: params.useAgent ?? true,
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

export function useAddPrinter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; is_default?: boolean }) =>
      apiFetch("/api/jobs/printers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["printers"] }),
  });
}

export function useRemovePrinter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch(`/api/jobs/printers/${encodeURIComponent(name)}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["printers"] }),
  });
}

export function useSetDefaultPrinter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch(`/api/jobs/printers/${encodeURIComponent(name)}/default`, {
        method: "PUT",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["printers"] }),
  });
}

export type DiscoveredPrinter = {
  instance_name: string;
  hostname: string;
  port: number;
  uri: string;
  cups_name?: string;
  already_in_cups: boolean;
  already_configured: boolean;
};

export function useDiscoverPrinters() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ discovered: DiscoveredPrinter[] }>("/api/jobs/printers/discover"),
  });
}

export function useRegisterPrinter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { uri: string; name: string; is_default?: boolean }) =>
      apiFetch("/api/jobs/printers/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["printers"] }),
  });
}

export function previewUrl(nodeKey: string, pdfType: string = "question"): string {
  return apiUrl(`/api/jobs/preview/${encodeURIComponent(nodeKey)}?pdf_type=${pdfType}`);
}

export function previewQueueItemUrl(itemId: number): string {
  return apiUrl(`/api/jobs/preview/queue/${itemId}`);
}

export async function fetchMergedPdfBlob(params?: {
  studentIds?: string[];
  pdfTypes?: string[];
}): Promise<{ blob: Blob; missingCount: number; jobId: string }> {
  const res = await fetch(`${API_BASE}/api/jobs/merge-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      student_ids: params?.studentIds,
      pdf_types: params?.pdfTypes,
    }),
  });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`PDF結合エラー: ${errorBody}`);
  }
  const missingCount = parseInt(res.headers.get("X-Missing-Count") || "0", 10);
  const jobId = res.headers.get("X-Job-Id") || "";
  const blob = await res.blob();
  return { blob, missingCount, jobId };
}

export function useUndoPrintJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      apiFetch<{ status: string; job_id: string; restored: number }>(
        `/api/jobs/${encodeURIComponent(jobId)}/undo`,
        { method: "POST" }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}
