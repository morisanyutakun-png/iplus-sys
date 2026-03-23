"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { useImportCsv } from "@/lib/queries/word-test";

interface Props {
  bookId: number;
  bookName: string;
}

interface ParsedRow {
  number: number;
  question: string;
  answer: string;
  error?: string;
}

function parseCsvText(text: string): ParsedRow[] {
  const lines = text.trim().split("\n");
  const rows: ParsedRow[] = [];
  let autoNumber = 1;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const parts = line.includes("\t")
      ? line.split("\t").map((s) => s.trim())
      : line.split(",").map((s) => s.trim());

    if (parts.length >= 3) {
      const num = parseInt(parts[0], 10);
      if (isNaN(num)) {
        rows.push({ number: autoNumber, question: parts[0], answer: parts[1], error: "番号が不正" });
      } else {
        rows.push({ number: num, question: parts[1], answer: parts[2] });
        autoNumber = num + 1;
      }
    } else if (parts.length === 2) {
      rows.push({ number: autoNumber, question: parts[0], answer: parts[1] });
      autoNumber++;
    } else {
      rows.push({ number: autoNumber, question: line, answer: "", error: "列数不足" });
      autoNumber++;
    }
  }

  return rows;
}

export function CsvImportDialog({ bookId, bookName }: Props) {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const importCsv = useImportCsv();

  const preview = useMemo(() => parseCsvText(csvText), [csvText]);
  const validCount = preview.filter((r) => !r.error && r.question && r.answer).length;

  const handleImport = async () => {
    if (!csvText.trim()) return;
    try {
      const result = await importCsv.mutateAsync({ bookId, csvText });
      toast.success(
        `インポート完了: ${result.imported}件追加, ${result.updated}件更新` +
        (result.errors.length > 0 ? ` (${result.errors.length}件エラー)` : "")
      );
      if (result.errors.length > 0) {
        console.warn("Import errors:", result.errors);
      }
      setCsvText("");
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
            <p>Excelからコピーしたデータを貼り付けてください。</p>
            <p>対応形式: <code className="bg-muted px-1 rounded">番号 TAB 単語 TAB 意味</code> または <code className="bg-muted px-1 rounded">単語 TAB 意味</code>（自動連番）</p>
          </div>

          <textarea
            className="w-full h-40 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={"1\tabandon\t捨てる、見捨てる\n2\tability\t能力\n..."}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />

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
                        <td className="px-2 py-0.5 text-muted-foreground">{row.number}</td>
                        <td className="px-2 py-0.5">{row.question}</td>
                        <td className="px-2 py-0.5">{row.answer}</td>
                        <td className="px-2 py-0.5 text-destructive text-[10px]">
                          {row.error}
                        </td>
                      </tr>
                    ))}
                    {preview.length > 50 && (
                      <tr>
                        <td colSpan={4} className="px-2 py-1 text-center text-muted-foreground">
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
            {importCsv.isPending ? "インポート中..." : `${validCount}件をインポート`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
