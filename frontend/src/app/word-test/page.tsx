"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import { WordBookList } from "@/components/word-test/word-book-list";
import { useWords } from "@/lib/queries/word-test";
import type { WordBook } from "@/lib/types";

function WordPreview({ bookId }: { bookId: number }) {
  const { data: words = [], isLoading } = useWords(bookId);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">読み込み中...</div>;
  }

  if (words.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        単語が登録されていません。CSVインポートで追加してください。
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-auto max-h-72">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 sticky top-0">
          <tr>
            <th className="px-3 py-1.5 text-left w-12">No.</th>
            <th className="px-3 py-1.5 text-left">単語</th>
            <th className="px-3 py-1.5 text-left">意味</th>
          </tr>
        </thead>
        <tbody>
          {words.slice(0, 100).map((word) => (
            <tr key={word.id} className="border-t border-border/50">
              <td className="px-3 py-1 text-muted-foreground">{word.word_number}</td>
              <td className="px-3 py-1 font-medium">{word.question}</td>
              <td className="px-3 py-1">{word.answer}</td>
            </tr>
          ))}
          {words.length > 100 && (
            <tr>
              <td colSpan={3} className="px-3 py-2 text-center text-muted-foreground text-xs">
                ...他 {words.length - 100}語
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function WordTestPage() {
  const [selectedBook, setSelectedBook] = useState<WordBook | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">単語テスト</h1>
        <p className="text-sm text-muted-foreground mt-1">
          単語帳の管理・CSVインポート
        </p>
      </div>

      {/* 単語帳リスト */}
      <WordBookList
        selectedBookId={selectedBook?.id ?? null}
        onSelectBook={setSelectedBook}
      />

      {/* 選択中の単語帳の単語一覧 */}
      {selectedBook && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">{selectedBook.name}</h3>
              <Badge variant="secondary">{selectedBook.total_words}語</Badge>
            </div>
            <WordPreview bookId={selectedBook.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
