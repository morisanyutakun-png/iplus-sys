import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  LessonRecord,
  LessonRecordUpsert,
  MasteryInput,
  MasteryBatchResponse,
} from "@/lib/types";

export function useLessonRecords(
  studentId?: string,
  materialKey?: string,
  dateFrom?: string,
  dateTo?: string
) {
  const params = new URLSearchParams();
  if (studentId) params.set("student_id", studentId);
  if (materialKey) params.set("material_key", materialKey);
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();

  return useQuery({
    queryKey: ["lesson-records", studentId, materialKey, dateFrom, dateTo],
    queryFn: () =>
      apiFetch<{ records: LessonRecord[] }>(
        `/api/lesson-records${qs ? `?${qs}` : ""}`
      ),
    select: (data) => data.records,
  });
}

export function useBatchUpsertRecords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (records: LessonRecordUpsert[]) =>
      apiFetch<{ upserted: number }>("/api/lesson-records/batch", {
        method: "POST",
        body: JSON.stringify({ records }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson-records"] });
    },
  });
}

export function useMasteryBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (records: MasteryInput[]) =>
      apiFetch<MasteryBatchResponse>(
        "/api/lesson-records/batch-with-progress",
        {
          method: "POST",
          body: JSON.stringify({ records }),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson-records"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}
