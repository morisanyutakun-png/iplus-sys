import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";
import type { Student, MaterialZones } from "../types";

export function useStudents() {
  return useQuery({
    queryKey: ["students"],
    queryFn: () =>
      apiFetch<{ students: Student[] }>("/api/students").then(
        (r) => r.students
      ),
  });
}

export function useStudent(id: string) {
  return useQuery({
    queryKey: ["students", id],
    queryFn: () => apiFetch<Student>(`/api/students/${id}`),
    enabled: !!id,
  });
}

export function useMaterialZones(studentId: string) {
  return useQuery({
    queryKey: ["material-zones", studentId],
    queryFn: () =>
      apiFetch<MaterialZones>(`/api/students/${studentId}/materials-zones`),
    enabled: !!studentId,
  });
}

export function useToggleMaterial(studentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { material_key: string; action: string }) =>
      apiFetch(`/api/students/${studentId}/materials`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["material-zones", studentId] });
    },
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; name: string }) =>
      apiFetch("/api/students", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) =>
      apiFetch(`/api/students/${studentId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useSavePointers(studentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pointers: Record<string, number>) =>
      apiFetch(`/api/students/${studentId}/pointers`, {
        method: "PUT",
        body: JSON.stringify({ pointers }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["students", studentId] });
      qc.invalidateQueries({ queryKey: ["material-zones", studentId] });
      qc.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}
