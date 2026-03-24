"use client";

import { useState, useMemo, useCallback } from "react";
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
import type { ColumnMapping } from "@/lib/types";

interface Props {
  bookId: number;
  bookName: string;
}

type ColRole = "number" | "word" | "translation" | "ignore";

const ROLE_LABELS: Record<ColRole, string> = {
  number: "番号",
  word: "英単語",
  translation: "訳",
  ignore: "無視",
};

interface ParsedRow {
  number: number;
  question: string;
  answer: string;
  error?: string;
}

function parseWithMapping(
  text: string,
  roles: ColRole[],
  skipHeader: boolean
): ParsedRow[] {
  const lines = text.trim().split("\n");
  const rows: ParsedRow[] = [];
  let autoNumber = 1;

  const numIdx = roles.indexOf("number");
  const wordIdx = roles.indexOf("word");
  const transIdx = roles.indexOf("translation");

  if (wordIdx === -1 || transIdx === -1) return [];

  const startIdx = skipHeader ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.includes("\t")
      ? line.split("\t").map((s) => s.trim())
      : line.split(",").map((s) => s.trim());

    let num = autoNumber;
    if (numIdx >= 0 && numIdx < parts.length) {
      const parsed = parseInt(parts[numIdx], 10);
      if (!isNaN(parsed)) {
        num = parsed;
        autoNumber = parsed + 1;
      }
    } else {
      autoNumber++;
    }

    const question = wordIdx < parts.length ? parts[wordIdx] : "";
    const answer = transIdx < parts.length ? parts[transIdx] : "";

    if (!question || !answer) {
      rows.push({ number: num, question, answer, error: "空の列あり" });
    } else {
      rows.push({ number: num, question, answer });
    }
  }

  return rows;
}

export function CsvImportDialog({ bookId, bookName }: Props) {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [colRoles, setColRoles] = useState<ColRole[]>([]);
  const [skipHeader, setSkipHeader] = useState(false);
  const [detected, setDetected] = useState(false);
  const importCsv = useImportCsv();
  const detectColumns = useDetectColumns();

  const sampleColumns = useMemo(() => {
    if (!csvText.trim()) return [];
    const firstLine = csvText.trim().split("\n")[0];
    const parts = firstLine.includes("\t")
      ? firstLine.split("\t").map((s) => s.trim())
      : firstLine.split(",").map((s) => s.trim());
    return parts;
  }, [csvText]);

  const preview = useMemo(() => {
    if (colRoles.length === 0 || sampleColumns.length === 0) return [];
    return parseWithMapping(csvText, colRoles, skipHeader);
  }, [csvText, colRoles, skipHeader, sampleColumns]);

  const validCount = preview.filter(
    (r) => !r.error && r.question && r.answer
  ).length;

  const handlePaste = useCallback(
    async (text: string) => {
      setCsvText(text);
      if (!text.trim()) {
        setColRoles([]);
        setDetected(false);
        return;
      }

      try {
        const result = await detectColumns.mutateAsync(text);
        if (result.columns.length > 0) {
          const roles: ColRole[] = result.columns.map(
            (c) => c.suggested_role as ColRole
          );
          setColRoles(roles);
          setDetected(true);
        }
      } catch {
        // Fallback: simple 3-column detection
        const firstLine = text.trim().split("\n")[0];
        const parts = firstLine.includes("\t")
          ? firstLine.split("\t")
          : firstLine.split(",");
        if (parts.length >= 3) {
          setColRoles(["number", "word", "translation", ...Array(Math.max(0, parts.length - 3)).fill("ignore")]);
        } else if (parts.length === 2) {
          setColRoles(["word", "translation"]);
        }
        setDetected(true);
      }
    },
    [detectColumns]
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
      setColRoles([]);
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
          </div>

          <textarea
            className="w-full h-32 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={
              "1\tSection1\tabandon\t捨てる、見捨てる\n2\tSection1\tability\t能力\n..."
            }
            value={csvText}
            onChange={(e) => handlePaste(e.target.value)}
          />

          {/* Column Mapping UI */}
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
                      onValueChange={(v) => setRole(i, v as ColRole)}
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

          {/* Preview */}
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
