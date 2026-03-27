import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiUrl } from "../api";
import type { Student, MaterialZones } from "../types";

export interface MaterialNodePreview {
  key: string;
  title: string;
  sort_order: number;
  range_text: string;
  has_pdf: boolean;
  is_current: boolean;
  is_completed: boolean;
}

export interface StudentMaterialNodes {
  student_id: string;
  material_key: string;
  pointer: number;
  max_node: number | null;
  nodes: MaterialNodePreview[];
}

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

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; name: string }) =>
      apiFetch(`/api/students/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: data.name }),
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

export function useAssignWordTest(studentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      word_book_id: number;
      start_num: number;
      end_num: number;
      words_per_test: number;
      questions_per_test: number;
    }) =>
      apiFetch(`/api/students/${studentId}/assign-word-test`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["material-zones", studentId] });
    },
  });
}

export function useStudentMaterialNodes(studentId: string, materialKey: string | null) {
  return useQuery({
    queryKey: ["student-material-nodes", studentId, materialKey],
    queryFn: () =>
      apiFetch<StudentMaterialNodes>(
        `/api/students/${studentId}/material-nodes/${encodeURIComponent(materialKey!)}`
      ),
    enabled: !!studentId && !!materialKey,
  });
}

export function studentPdfPreviewUrl(
  studentId: string,
  materialKey: string,
  nodeSortOrder: number
): string {
  return apiUrl(
    `/api/students/${studentId}/preview-pdf/${encodeURIComponent(materialKey)}?node_sort_order=${nodeSortOrder}`
  );
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
