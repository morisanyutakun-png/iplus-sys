"use client";

import { useState } from "react";
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
import { Save } from "lucide-react";
import { useWordBooks, useSaveTestSession } from "@/lib/queries/word-test";
import { useStudents } from "@/lib/queries/students";
import type { TestRange } from "@/lib/types";

export function TestResultForm() {
  const { data: books = [] } = useWordBooks();
  const { data: students = [] } = useStudents();
  const saveSession = useSaveTestSession();

  const [studentId, setStudentId] = useState("");
  const [bookId, setBookId] = useState<string>("");
  const [rangesText, setRangesText] = useState("1-100");
  const [totalQuestions, setTotalQuestions] = useState("");
  const [correctCount, setCorrectCount] = useState("");
  const [testDate, setTestDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const parseRanges = (text: string): TestRange[] => {
    return text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((part) => {
        const [start, end] = part.split("-").map((n) => parseInt(n.trim(), 10));
        return { start: start || 0, end: end || start || 0 };
      })
      .filter((r) => r.start > 0 && r.end >= r.start);
  };

  const total = parseInt(totalQuestions, 10);
  const correct = parseInt(correctCount, 10);
  const accuracy = total > 0 && !isNaN(correct) ? Math.round((correct / total) * 100) : null;

  const handleSave = async () => {
    if (!studentId || !bookId || !totalQuestions || correctCount === "") {
      toast.error("必須項目を入力してください");
      return;
    }

    const ranges = parseRanges(rangesText);
    if (ranges.length === 0) {
      toast.error("有効な範囲を入力してください");
      return;
    }

    try {
      await saveSession.mutateAsync({
        student_id: studentId,
        word_book_id: parseInt(bookId, 10),
        ranges,
        total_questions: total,
        correct_count: correct,
        test_date: testDate,
      });
      toast.success("テスト結果を保存しました");
      setTotalQuestions("");
      setCorrectCount("");
    } catch {
      toast.error("保存に失敗しました");
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">結果入力</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium mb-1 block">生徒</label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="生徒を選択" />
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">単語帳</label>
          <Select value={bookId} onValueChange={setBookId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="単語帳を選択" />
            </SelectTrigger>
            <SelectContent>
              {books.map((book) => (
                <SelectItem key={book.id} value={book.id.toString()}>
                  {book.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">テスト範囲</label>
          <Input
            placeholder="1-100, 401-600"
            value={rangesText}
            onChange={(e) => setRangesText(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            カンマ区切りで複数範囲指定可
          </p>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">日付</label>
          <Input
            type="date"
            value={testDate}
            onChange={(e) => setTestDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">出題数</label>
          <Input
            type="number"
            min={1}
            placeholder="50"
            value={totalQuestions}
            onChange={(e) => setTotalQuestions(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">正答数</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              placeholder="45"
              value={correctCount}
              onChange={(e) => setCorrectCount(e.target.value)}
            />
            {accuracy !== null && (
              <span
                className={`text-sm font-bold shrink-0 ${
                  accuracy >= 80
                    ? "text-green-600"
                    : accuracy >= 60
                    ? "text-amber-600"
                    : "text-red-600"
                }`}
              >
                {accuracy}%
              </span>
            )}
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saveSession.isPending}>
        <Save className="h-4 w-4 mr-1" />
        {saveSession.isPending ? "保存中..." : "結果を保存"}
      </Button>
    </div>
  );
}
