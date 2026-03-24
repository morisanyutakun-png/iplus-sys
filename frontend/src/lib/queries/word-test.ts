import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  WordBook,
  Word,
  CsvImportResponse,
  ColumnMapping,
  DetectColumnsResponse,
} from "@/lib/types";

// ── Word Books ──

export function useWordBooks() {
  return useQuery({
    queryKey: ["word-books"],
    queryFn: () => apiFetch<WordBook[]>("/api/word-test"),
  });
}

export function useCreateWordBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      apiFetch<WordBook>("/api/word-test", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["word-books"] });
    },
  });
}

export function useDeleteWordBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookId: number) =>
      apiFetch<{ ok: boolean }>(`/api/word-test/${bookId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["word-books"] });
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["material-zones"] });
    },
  });
}

// ── Words ──

export function useWords(bookId: number | null, from?: number, to?: number) {
  const params = new URLSearchParams();
  if (from !== undefined) params.set("from", String(from));
  if (to !== undefined) params.set("to", String(to));
  const qs = params.toString();

  return useQuery({
    queryKey: ["words", bookId, from, to],
    queryFn: () =>
      apiFetch<Word[]>(
        `/api/word-test/${bookId}/words${qs ? `?${qs}` : ""}`
      ),
    enabled: bookId !== null,
  });
}

export function useImportCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      bookId,
      csvText,
      columnMapping,
    }: {
      bookId: number;
      csvText: string;
      columnMapping?: ColumnMapping;
    }) =>
      apiFetch<CsvImportResponse>(
        `/api/word-test/${bookId}/words/import-csv`,
        {
          method: "POST",
          body: JSON.stringify({
            csv_text: csvText,
            column_mapping: columnMapping ?? null,
          }),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["words"] });
      qc.invalidateQueries({ queryKey: ["word-books"] });
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}

export function useDetectColumns() {
  return useMutation({
    mutationFn: (csvText: string) =>
      apiFetch<DetectColumnsResponse>("/api/word-test/detect-columns", {
        method: "POST",
        body: JSON.stringify({ csv_text: csvText }),
      }),
  });
}

export function useDeleteAllWords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookId: number) =>
      apiFetch<{ ok: boolean }>(`/api/word-test/${bookId}/words`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["words"] });
      qc.invalidateQueries({ queryKey: ["word-books"] });
    },
  });
}
