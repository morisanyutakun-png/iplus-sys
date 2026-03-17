import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiUrl } from "../api";

interface PdfFile {
  name: string;
  path: string;
  size: number;
}

interface PdfDirectory {
  name: string;
  path: string;
}

interface PdfListResponse {
  files: PdfFile[];
  directories: PdfDirectory[];
}

interface PdfTreeEntry {
  directory: string;
  files: PdfFile[];
}

export function usePdfList(prefix: string = "") {
  return useQuery({
    queryKey: ["pdfs", "list", prefix],
    queryFn: () => {
      const params = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
      return apiFetch<PdfListResponse>(`/api/pdfs${params}`);
    },
  });
}

export function usePdfTree() {
  return useQuery({
    queryKey: ["pdfs", "tree"],
    queryFn: () =>
      apiFetch<{ tree: PdfTreeEntry[] }>("/api/pdfs/tree").then((r) => r.tree),
  });
}

export function useUploadPdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      materialKey,
    }: {
      file: File;
      materialKey?: string;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      const params = materialKey
        ? `?material_key=${encodeURIComponent(materialKey)}`
        : "";
      const res = await fetch(`${apiUrl(`/api/pdfs/upload${params}`)}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Upload failed: ${text}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pdfs"] });
    },
  });
}

export function useDeletePdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) =>
      apiFetch(`/api/pdfs/${encodeURIComponent(path)}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pdfs"] });
    },
  });
}

export function pdfFileUrl(path: string): string {
  return apiUrl(`/api/pdfs/file/${encodeURIComponent(path)}`);
}
