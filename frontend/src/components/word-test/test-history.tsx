"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWordBooks, useWordTestSessions } from "@/lib/queries/word-test";
import { useStudents } from "@/lib/queries/students";
import type { TestRange } from "@/lib/types";

function formatRanges(ranges: TestRange[]): string {
  return ranges.map((r) => `${r.start}-${r.end}`).join(", ");
}

export function TestHistory() {
  const { data: books = [] } = useWordBooks();
  const { data: students = [] } = useStudents();

  const [studentFilter, setStudentFilter] = useState<string>("__all__");
  const [bookFilter, setBookFilter] = useState<string>("__all__");

  const { data: sessions = [], isLoading } = useWordTestSessions(
    studentFilter === "__all__" ? undefined : studentFilter,
    bookFilter === "__all__" ? undefined : parseInt(bookFilter, 10)
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">テスト履歴</h3>

      <div className="flex gap-3 flex-wrap">
        <Select value={studentFilter} onValueChange={setStudentFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="生徒で絞り込み" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全生徒</SelectItem>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={bookFilter} onValueChange={setBookFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="単語帳で絞り込み" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全単語帳</SelectItem>
            {books.map((b) => (
              <SelectItem key={b.id} value={b.id.toString()}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      ) : sessions.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          テスト履歴がありません
        </div>
      ) : (
        <div className="border rounded-md overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">日付</th>
                <th className="px-3 py-2 text-left">生徒</th>
                <th className="px-3 py-2 text-left">単語帳</th>
                <th className="px-3 py-2 text-left">範囲</th>
                <th className="px-3 py-2 text-right">結果</th>
                <th className="px-3 py-2 text-right">正答率</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const pct = Math.round(s.accuracy_rate * 100);
                return (
                  <tr key={s.id} className="border-t border-border/50">
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {s.test_date}
                    </td>
                    <td className="px-3 py-1.5">{s.student_name || s.student_id}</td>
                    <td className="px-3 py-1.5">{s.word_book_name || s.word_book_id}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      {formatRanges(s.ranges)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {s.correct_count}/{s.total_questions}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <span
                        className={`font-bold ${
                          pct >= 80
                            ? "text-green-600"
                            : pct >= 60
                            ? "text-amber-600"
                            : "text-red-600"
                        }`}
                      >
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
