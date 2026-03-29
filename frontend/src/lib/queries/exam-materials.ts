import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiUrl } from "../api";
import type { ExamMaterial } from "../types";

export function useExamMaterials(examType?: string) {
  return useQuery({
    queryKey: ["exam-materials", examType],
    queryFn: () => {
      const params = examType ? `?exam_type=${examType}` : "";
      return apiFetch<ExamMaterial[]>(`/api/exam-materials${params}`);
    },
  });
}

export function useExamMaterial(id: number) {
  return useQuery({
    queryKey: ["exam-materials", id],
    queryFn: () => apiFetch<ExamMaterial>(`/api/exam-materials/${id}`),
    enabled: !!id,
  });
}

export function useCreateExamMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      exam_type: string;
      year?: number;
      university?: string;
      faculty?: string;
      exam_period?: string;
      subjects?: { subject_name: string; max_score: number }[];
    }) =>
      apiFetch<ExamMaterial>("/api/exam-materials", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-materials"] });
    },
  });
}

export function useDeleteExamMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/exam-materials/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-materials"] });
    },
  });
}

export function useAddExamSubject(materialId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { subject_name: string; max_score: number }) =>
      apiFetch(`/api/exam-materials/${materialId}/subjects`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-materials"] });
    },
  });
}

export function useAddExamSubjectSimple(materialId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      subject_name,
      max_score,
      file,
      answerFile,
    }: {
      subject_name: string;
      max_score: number;
      file?: File;
      answerFile?: File;
    }) => {
      const formData = new FormData();
      formData.append("subject_name", subject_name);
      formData.append("max_score", String(max_score));
      if (file) formData.append("file", file);
      if (answerFile) formData.append("answer_file", answerFile);
      const res = await fetch(
        apiUrl(`/api/exam-materials/${materialId}/subjects/simple`),
        { method: "POST", body: formData }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`追加に失敗: ${text}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-materials"] });
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["pdfs"] });
    },
  });
}

export function useDeleteExamSubject(materialId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subjectId: number) =>
      apiFetch(`/api/exam-materials/${materialId}/subjects/${subjectId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-materials"] });
    },
  });
}
