import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiUrl } from "../api";
import type { Material } from "../types";

export function useMaterials() {
  return useQuery({
    queryKey: ["materials"],
    queryFn: () =>
      apiFetch<{ materials: Material[] }>("/api/materials").then(
        (r) => r.materials
      ),
  });
}

export function useCreateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string }) =>
      apiFetch<Material>("/api/materials/simple", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

export function useAddNode(materialKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      key: string;
      title: string;
      range_text?: string;
      pdf_relpath?: string;
      duplex?: boolean;
    }) =>
      apiFetch(`/api/materials/${materialKey}/nodes`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

export function useAddNodeSimple(materialKey: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, file }: { title: string; file?: File }) => {
      const formData = new FormData();
      formData.append("title", title);
      if (file) formData.append("file", file);
      const res = await fetch(
        apiUrl(`/api/materials/${encodeURIComponent(materialKey)}/nodes/simple`),
        { method: "POST", body: formData }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`追加に失敗: ${text}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["pdfs"] });
    },
  });
}

export function useMaterial(key: string) {
  return useQuery({
    queryKey: ["materials", key],
    queryFn: () => apiFetch<Material>(`/api/materials/${key}`),
    enabled: !!key,
  });
}
