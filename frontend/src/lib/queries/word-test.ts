import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  WordBook,
  Word,
  TestRange,
  WordTestSession,
  CsvImportResponse,
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
    mutationFn: ({ bookId, csvText }: { bookId: number; csvText: string }) =>
      apiFetch<CsvImportResponse>(
        `/api/word-test/${bookId}/words/import-csv`,
        {
          method: "POST",
          body: JSON.stringify({ csv_text: csvText }),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["words"] });
      qc.invalidateQueries({ queryKey: ["word-books"] });
    },
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

// ── Test Generation ──

export function useGenerateTest() {
  return useMutation({
    mutationFn: (body: {
      word_book_id: number;
      ranges: TestRange[];
      count?: number;
    }) =>
      apiFetch<{ words: Word[]; total: number }>("/api/word-test/generate", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

// ── Test Sessions ──

export function useSaveTestSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      student_id: string;
      word_book_id: number;
      ranges: TestRange[];
      total_questions: number;
      correct_count: number;
      test_date: string;
    }) =>
      apiFetch<WordTestSession>("/api/word-test/sessions", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["word-test-sessions"] });
    },
  });
}

export function useWordTestSessions(
  studentId?: string,
  wordBookId?: number
) {
  const params = new URLSearchParams();
  if (studentId) params.set("student_id", studentId);
  if (wordBookId) params.set("word_book_id", String(wordBookId));
  const qs = params.toString();

  return useQuery({
    queryKey: ["word-test-sessions", studentId, wordBookId],
    queryFn: () =>
      apiFetch<WordTestSession[]>(
        `/api/word-test/sessions${qs ? `?${qs}` : ""}`
      ),
  });
}
