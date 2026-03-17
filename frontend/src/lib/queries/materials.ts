import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";
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
    mutationFn: (data: { key: string; name: string; aliases?: string[] }) =>
      apiFetch<Material>("/api/materials", {
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

export function useMaterial(key: string) {
  return useQuery({
    queryKey: ["materials", key],
    queryFn: () => apiFetch<Material>(`/api/materials/${key}`),
    enabled: !!key,
  });
}
