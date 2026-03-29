import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";
import type { UniversityScoreWeight } from "../types";

export function useUniversityWeights() {
  return useQuery({
    queryKey: ["university-weights"],
    queryFn: () =>
      apiFetch<UniversityScoreWeight[]>("/api/university-weights"),
  });
}

export function useCreateUniversityWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      university: string;
      faculty: string;
      weights: Record<string, { max: number; compressed_max: number }>;
      total_compressed_max: number;
    }) =>
      apiFetch<UniversityScoreWeight>("/api/university-weights", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["university-weights"] });
    },
  });
}

export function useUpdateUniversityWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id: number;
      name?: string;
      university?: string;
      faculty?: string;
      weights?: Record<string, { max: number; compressed_max: number }>;
      total_compressed_max?: number;
    }) => {
      const { id, ...body } = data;
      return apiFetch<UniversityScoreWeight>(`/api/university-weights/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["university-weights"] });
    },
  });
}

export function useDeleteUniversityWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/university-weights/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["university-weights"] });
    },
  });
}
