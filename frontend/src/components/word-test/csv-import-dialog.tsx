"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { useImportCsv, useDetectColumns } from "@/lib/queries/word-test";
import type { ColumnMapping, CsvParseMode } from "@/lib/types";

interface Props {
  bookId: number;
  bookName: string;
}

type ColRole = "number" | "word" | "translation" | "ignore";
type QuoteFamily = "double" | "single";

const ROLE_LABELS: Record<ColRole, string> = {
  number: "番号",
  word: "英単語",
  translation: "訳",
  ignore: "無視",
};

const PARSE_MODE_LABELS: Record<CsvParseMode, string> = {
  line_break: "改行モード",
  comma_only: '","のみモード',
};

const DOUBLE_QUOTES = new Set(['"', "“", "”", "„", "‟", "＂"]);
const SINGLE_QUOTES = new Set(["'", "‘", "’", "＇"]);

interface ParsedRow {
  number: number;
  question: string;
  answer: string;
  error?: string;
}

function normalizeCsvSource(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B\u200C\u200D\u2060]/g, "");
}

function quoteFamily(ch?: string): QuoteFamily | null {
  if (!ch) return null;
  if (DOUBLE_QUOTES.has(ch)) return "double";
  if (SINGLE_QUOTES.has(ch)) return "single";
  return null;
}

function cleanParsedCell(value: string): string {
  return value.replace(/^[\s\u00A0\u3000]+|[\s\u00A0\u3000]+$/g, "");
}

function nextMeaningfulChar(text: string, start: number): string | null {
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (!/[\u200B\u200C\u200D\u2060]/.test(ch)) {
      return ch;
    }
  }
  return null;
}

function countUnquotedDelimiters(text: string, delimiter: string): number {
  let count = 0;
  let activeQuote: QuoteFamily | null = null;

  for (const ch of text) {
    if (/[\u200B\u200C\u200D\u2060]/.test(ch)) continue;
    const currentQuote = quoteFamily(ch);
    if (activeQuote) {
      if (currentQuote === activeQuote) {
        activeQuote = null;
      }
      continue;
    }
    if (currentQuote) {
      activeQuote = currentQuote;
      continue;
    }
    if (ch === delimiter) {
      count++;
    }
  }

  return count;
}

function chooseLineDelimiter(text: string): "\t" | "," {
  const sampleLines = normalizeCsvSource(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);

  const tabCount = sampleLines.reduce(
    (sum, line) => sum + countUnquotedDelimiters(line, "\t"),
    0
  );
  const commaCount = sampleLines.reduce(
    (sum, line) => sum + countUnquotedDelimiters(line, ","),
    0
  );

  return tabCount > commaCount ? "\t" : ",";
}

function inferExpectedColumns(rows: string[][]): number {
  const flatCells = rows.flat();
  const numericPositions = flatCells
    .slice(0, 50)
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => /^\d+$/.test(value ?? ""))
    .map(({ index }) => index);

  if (numericPositions.length >= 2 && numericPositions[0] === 0) {
    const gapCounts = new Map<number, number>();
    for (let i = 1; i < numericPositions.length; i++) {
      const gap = numericPositions[i] - numericPositions[i - 1];
      if (gap > 0) {
        gapCounts.set(gap, (gapCounts.get(gap) ?? 0) + 1);
      }
    }
    const bestGap = [...gapCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (bestGap && bestGap > 0) {
      return bestGap;
    }
  }

  const scoreGrouping = (width: number): number => {
    const rowCount = Math.floor(flatCells.length / width);
    if (rowCount < 2) return 0;

    let score = 0;
    for (let column = 0; column < width; column++) {
      const values = Array.from({ length: rowCount }, (_, rowIndex) => {
        return flatCells[rowIndex * width + column];
      }).filter(Boolean);

      if (values.length === 0) continue;

      const numericRatio =
        values.filter((value) => /^\d+$/.test(value)).length / values.length;
      const japaneseRatio =
        values.filter((value) => /[\u3040-\u30ff\u3400-\u9fff]/.test(value)).length /
        values.length;
      const latinRatio =
        values.filter((value) => /[A-Za-z]/.test(value)).length / values.length;

      score += Math.max(numericRatio, japaneseRatio, latinRatio);
    }

    if (flatCells.length % width === 0) {
      score += 0.2;
    }

    return score;
  };

  let bestWidth = 0;
  let bestScore = -1;
  for (let width = 2; width <= Math.min(6, flatCells.length); width++) {
    const score = scoreGrouping(width);
    if (score > bestScore) {
      bestWidth = width;
      bestScore = score;
    }
  }
  if (bestWidth > 0) {
    return bestWidth;
  }

  if (flatCells.length >= 3 && /^\d+$/.test(flatCells[0] ?? "")) {
    return 3;
  }
  if (flatCells.length >= 2) {
    return 2;
  }
  return Math.max(1, flatCells.length);
}

function tokenizeCsvLikeRows(text: string, parseMode: CsvParseMode): string[][] {
  const normalized = normalizeCsvSource(text);
  if (!normalized.trim()) return [];

  const delimiter = parseMode === "comma_only" ? "," : chooseLineDelimiter(normalized);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let activeQuote: QuoteFamily | null = null;

  const flushCell = () => {
    currentRow.push(cleanParsedCell(currentCell));
    currentCell = "";
  };

  const flushRow = () => {
    if (currentRow.length > 0 && currentRow.some((cell) => cell !== "")) {
      rows.push([...currentRow]);
    }
    currentRow = [];
  };

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (/[\u200B\u200C\u200D\u2060]/.test(ch)) continue;

    const currentQuote = quoteFamily(ch);
    if (activeQuote) {
      if (currentQuote === activeQuote) {
        const nextChar = normalized[i + 1];
        if (quoteFamily(nextChar) === activeQuote) {
          currentCell += activeQuote === "double" ? '"' : "'";
          i++;
          continue;
        }
        activeQuote = null;
        continue;
      }
      currentCell += ch;
      continue;
    }

    if (currentQuote && cleanParsedCell(currentCell) === "") {
      activeQuote = currentQuote;
      continue;
    }

    if (ch === delimiter) {
      flushCell();
      continue;
    }

    if (ch === "\n") {
      if (parseMode === "line_break") {
        flushCell();
        flushRow();
      } else {
        const upcoming = nextMeaningfulChar(normalized, i + 1);
        if (currentCell && upcoming !== null && upcoming !== "," && !/\s$/.test(currentCell)) {
          currentCell += " ";
        }
      }
      continue;
    }

    currentCell += ch;
  }

  flushCell();
  flushRow();
  return rows;
}

function parseCsvRows(
  text: string,
  parseMode: CsvParseMode,
  expectedColumns?: number
): string[][] {
  const rows = tokenizeCsvLikeRows(text, parseMode);
  if (parseMode !== "comma_only") return rows;

  const flatCells = rows.flat();
  if (flatCells.length === 0) return [];

  const groupSize = Math.max(1, expectedColumns ?? inferExpectedColumns(rows));
  const groupedRows: string[][] = [];
  for (let start = 0; start < flatCells.length; start += groupSize) {
    const chunk = flatCells.slice(start, start + groupSize);
    if (chunk.some((cell) => cell !== "")) {
      groupedRows.push(chunk);
    }
  }

  return groupedRows;
}

function parseWithMapping(
  text: string,
  roles: ColRole[],
  skipHeader: boolean,
  parseMode: CsvParseMode
): ParsedRow[] {
  const rows = parseCsvRows(text, parseMode, roles.length || undefined);
  const parsedRows: ParsedRow[] = [];
  let autoNumber = 1;

  const numIdx = roles.indexOf("number");
  const wordIdx = roles.indexOf("word");
  const transIdx = roles.indexOf("translation");

  if (wordIdx === -1 || transIdx === -1) return [];

  const startIdx = skipHeader ? 1 : 0;

  for (let i = startIdx; i < rows.length; i++) {
    const parts = rows[i];
    if (!parts || parts.every((part) => part === "")) continue;

    let num = autoNumber;
    if (numIdx >= 0 && numIdx < parts.length) {
      const parsed = parseInt(parts[numIdx], 10);
      if (!Number.isNaN(parsed)) {
        num = parsed;
        autoNumber = parsed + 1;
      } else {
        autoNumber++;
      }
    } else {
      autoNumber++;
    }

    const question = wordIdx < parts.length ? parts[wordIdx] : "";
    const answer = transIdx < parts.length ? parts[transIdx] : "";

    if (!question || !answer) {
      parsedRows.push({ number: num, question, answer, error: "空の列あり" });
    } else {
      parsedRows.push({ number: num, question, answer });
    }
  }

  return parsedRows;
}

function buildFallbackRoles(columns: string[]): ColRole[] {
  if (columns.length === 0) return [];

  const roles: ColRole[] = Array(columns.length).fill("ignore");
  if (columns.length >= 3 && /^\d+$/.test(columns[0] ?? "")) {
    roles[0] = "number";
    roles[1] = "word";
    roles[2] = "translation";
    return roles;
  }

  if (columns.length >= 2) {
    roles[columns.length - 2] = "word";
    roles[columns.length - 1] = "translation";
  }

  return roles;
}

export function CsvImportDialog({ bookId, bookName }: Props) {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [parseMode, setParseMode] = useState<CsvParseMode>("line_break");
  const [colRoles, setColRoles] = useState<ColRole[]>([]);
  const [skipHeader, setSkipHeader] = useState(false);
  const [detected, setDetected] = useState(false);
  const importCsv = useImportCsv();
  const detectColumns = useDetectColumns();
  const detectionRunId = useRef(0);

  const sampleColumns = useMemo(() => {
    return parseCsvRows(csvText, parseMode, colRoles.length || undefined)[0] ?? [];
  }, [csvText, parseMode, colRoles.length]);

  const preview = useMemo(() => {
    if (colRoles.length === 0 || sampleColumns.length === 0) return [];
    return parseWithMapping(csvText, colRoles, skipHeader, parseMode);
  }, [csvText, colRoles, skipHeader, sampleColumns, parseMode]);

  const validCount = preview.filter(
    (row) => !row.error && row.question && row.answer
  ).length;

  const resetDetection = useCallback(() => {
    setColRoles([]);
    setDetected(false);
  }, []);

  const detectRoles = useCallback(
    async (text: string, mode: CsvParseMode) => {
      if (!text.trim()) {
        resetDetection();
        return;
      }

      const runId = detectionRunId.current + 1;
      detectionRunId.current = runId;

      try {
        const result = await detectColumns.mutateAsync({
          csvText: text,
          parseMode: mode,
        });
        if (detectionRunId.current !== runId) return;

        if (result.columns.length > 0) {
          setColRoles(
            result.columns.map((column) => column.suggested_role as ColRole)
          );
          setDetected(true);
          return;
        }
      } catch {
        // Fallback handled below.
      }

      if (detectionRunId.current !== runId) return;
      const fallbackSampleColumns = parseCsvRows(text, mode)[0] ?? [];
      const fallbackRoles = buildFallbackRoles(fallbackSampleColumns);
      setColRoles(fallbackRoles);
      setDetected(fallbackRoles.length > 0);
    },
    [detectColumns, resetDetection]
  );

  const handleTextChange = useCallback(
    (text: string) => {
      setCsvText(text);
      void detectRoles(text, parseMode);
    },
    [detectRoles, parseMode]
  );

  const handleModeChange = useCallback(
    (mode: CsvParseMode) => {
      setParseMode(mode);
      void detectRoles(csvText, mode);
    },
    [csvText, detectRoles]
  );

  const setRole = (index: number, role: ColRole) => {
    setColRoles((prev) => {
      const next = [...prev];
      next[index] = role;
      return next;
    });
  };

  const buildMapping = (): ColumnMapping | undefined => {
    const wordIdx = colRoles.indexOf("word");
    const transIdx = colRoles.indexOf("translation");
    if (wordIdx === -1 || transIdx === -1) return undefined;

    const numIdx = colRoles.indexOf("number");
    return {
      number_col: numIdx >= 0 ? numIdx : null,
      word_col: wordIdx,
      translation_col: transIdx,
      skip_header: skipHeader,
    };
  };

  const handleImport = async () => {
    if (!csvText.trim()) return;
    try {
      const mapping = buildMapping();
      const result = await importCsv.mutateAsync({
        bookId,
        csvText,
        columnMapping: mapping,
        parseMode,
      });
      toast.success(
        `インポート完了: ${result.imported}件追加, ${result.updated}件更新` +
          (result.errors.length > 0
            ? ` (${result.errors.length}件エラー)`
            : "")
      );
      if (result.errors.length > 0) {
        console.warn("Import errors:", result.errors);
      }
      setCsvText("");
      setParseMode("line_break");
      setColRoles([]);
      setSkipHeader(false);
      setDetected(false);
      setOpen(false);
    } catch {
      toast.error("インポートに失敗しました");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          <Upload className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>CSVインポート - {bookName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              Excelからコピーしたデータを貼り付けてください。列の役割は自動検出されます。
            </p>
            <p>
              {"改行モードは1行ごとに判定し、\",\"のみモードは改行をまたいでもカンマだけで区切ります。"}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium">取り込みモード</p>
            <Select
              value={parseMode}
              onValueChange={(value) => handleModeChange(value as CsvParseMode)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PARSE_MODE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <textarea
            className="w-full h-32 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={
              parseMode === "line_break"
                ? "1\tSection1\tabandon\t捨てる、見捨てる\n2\tSection1\tability\t能力\n..."
                : "1,abandon,捨てる,2,ability,能力,..."
            }
            value={csvText}
            onChange={(e) => handleTextChange(e.target.value)}
          />

          {detected && sampleColumns.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium">
                列の役割を確認してください:
              </p>
              <div className="flex gap-2 flex-wrap">
                {sampleColumns.map((sample, i) => (
                  <div
                    key={i}
                    className="border rounded-md p-2 min-w-[110px] space-y-1"
                  >
                    <div className="text-[10px] text-muted-foreground truncate max-w-[110px]">
                      {sample || "(空)"}
                    </div>
                    <Select
                      value={colRoles[i] || "ignore"}
                      onValueChange={(value) => setRole(i, value as ColRole)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key} className="text-xs">
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={skipHeader}
                  onChange={(e) => setSkipHeader(e.target.checked)}
                  className="rounded"
                />
                1行目をヘッダーとしてスキップ
              </label>
            </div>
          )}

          {preview.length > 0 && (
            <div className="flex-1 overflow-auto min-h-0">
              <p className="text-xs text-muted-foreground mb-1">
                プレビュー: {validCount}件有効 / {preview.length}件
              </p>
              <div className="border rounded-md overflow-auto max-h-48">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left w-12">No.</th>
                      <th className="px-2 py-1 text-left">単語</th>
                      <th className="px-2 py-1 text-left">意味</th>
                      <th className="px-2 py-1 text-left w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map((row, i) => (
                      <tr
                        key={i}
                        className={row.error ? "bg-destructive/10" : ""}
                      >
                        <td className="px-2 py-0.5 text-muted-foreground">
                          {row.number}
                        </td>
                        <td className="px-2 py-0.5">{row.question}</td>
                        <td className="px-2 py-0.5">{row.answer}</td>
                        <td className="px-2 py-0.5 text-destructive text-[10px]">
                          {row.error}
                        </td>
                      </tr>
                    ))}
                    {preview.length > 50 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-2 py-1 text-center text-muted-foreground"
                        >
                          ...他 {preview.length - 50}件
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={validCount === 0 || importCsv.isPending}
            className="w-full"
          >
            {importCsv.isPending
              ? "インポート中..."
              : `${validCount}件をインポート`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
