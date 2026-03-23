"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Shuffle, Trash2, Eye, EyeOff } from "lucide-react";
import { useWordBooks, useGenerateTest } from "@/lib/queries/word-test";
import type { Word, TestRange } from "@/lib/types";

export function TestGenerator() {
  const { data: books = [] } = useWordBooks();
  const generateTest = useGenerateTest();

  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [ranges, setRanges] = useState<TestRange[]>([{ start: 1, end: 100 }]);
  const [count, setCount] = useState<string>("");
  const [generatedWords, setGeneratedWords] = useState<Word[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);

  const addRange = () => {
    setRanges([...ranges, { start: 1, end: 100 }]);
  };

  const removeRange = (index: number) => {
    if (ranges.length <= 1) return;
    setRanges(ranges.filter((_, i) => i !== index));
  };

  const updateRange = (index: number, field: "start" | "end", value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) && value !== "") return;
    const updated = [...ranges];
    updated[index] = { ...updated[index], [field]: num || 0 };
    setRanges(updated);
  };

  const handleGenerate = async () => {
    if (!selectedBookId) {
      toast.error("単語帳を選択してください");
      return;
    }

    const validRanges = ranges.filter((r) => r.start > 0 && r.end >= r.start);
    if (validRanges.length === 0) {
      toast.error("有効な範囲を入力してください");
      return;
    }

    try {
      const result = await generateTest.mutateAsync({
        word_book_id: selectedBookId,
        ranges: validRanges,
        count: count ? parseInt(count, 10) : undefined,
      });
      setGeneratedWords(result.words);
      setShowAnswers(false);
      toast.success(`${result.total}問のテストを生成しました`);
    } catch {
      toast.error("テスト生成に失敗しました");
    }
  };

  const rangesLabel = ranges
    .filter((r) => r.start > 0 && r.end >= r.start)
    .map((r) => `${r.start}-${r.end}`)
    .join(", ");

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1 block">単語帳</label>
          <Select
            value={selectedBookId?.toString() ?? ""}
            onValueChange={(v) => setSelectedBookId(parseInt(v, 10))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="単語帳を選択" />
            </SelectTrigger>
            <SelectContent>
              {books.map((book) => (
                <SelectItem key={book.id} value={book.id.toString()}>
                  {book.name} ({book.total_words}語)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">出題範囲</label>
          <div className="space-y-2">
            {ranges.map((range, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="開始"
                  value={range.start || ""}
                  onChange={(e) => updateRange(i, "start", e.target.value)}
                  className="w-24"
                />
                <span className="text-muted-foreground">~</span>
                <Input
                  type="number"
                  min={1}
                  placeholder="終了"
                  value={range.end || ""}
                  onChange={(e) => updateRange(i, "end", e.target.value)}
                  className="w-24"
                />
                {ranges.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeRange(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addRange}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              範囲を追加
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">出題数（任意）</label>
          <Input
            type="number"
            min={1}
            placeholder="全問出題"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-32"
          />
        </div>

        <Button onClick={handleGenerate} disabled={generateTest.isPending}>
          <Shuffle className="h-4 w-4 mr-1" />
          {generateTest.isPending ? "生成中..." : "テスト生成"}
        </Button>
      </div>

      {generatedWords.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">
                出題リスト ({generatedWords.length}問)
                {rangesLabel && (
                  <span className="text-xs text-muted-foreground ml-2">
                    範囲: {rangesLabel}
                  </span>
                )}
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAnswers(!showAnswers)}
              >
                {showAnswers ? (
                  <><EyeOff className="h-3.5 w-3.5 mr-1" />答え非表示</>
                ) : (
                  <><Eye className="h-3.5 w-3.5 mr-1" />答え表示</>
                )}
              </Button>
            </div>
            <div className="border rounded-md overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5 text-left w-10">#</th>
                    <th className="px-3 py-1.5 text-left w-12">No.</th>
                    <th className="px-3 py-1.5 text-left">単語</th>
                    <th className="px-3 py-1.5 text-left">意味</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedWords.map((word, i) => (
                    <tr key={word.id} className="border-t border-border/50">
                      <td className="px-3 py-1 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-1 text-muted-foreground">{word.word_number}</td>
                      <td className="px-3 py-1 font-medium">{word.question}</td>
                      <td className="px-3 py-1">
                        {showAnswers ? word.answer : "••••••"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
