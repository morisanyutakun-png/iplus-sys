"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Shuffle, ClipboardList, ExternalLink } from "lucide-react";
import { WordBookList } from "@/components/word-test/word-book-list";
import { TestGenerator } from "@/components/word-test/test-generator";
import { TestResultForm } from "@/components/word-test/test-result-form";
import { TestHistory } from "@/components/word-test/test-history";
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
          単語帳の管理・ミックステスト生成・結果記録
        </p>
      </div>

      <Tabs defaultValue="books" className="space-y-4">
        <TabsList>
          <TabsTrigger value="books" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            単語帳管理
          </TabsTrigger>
          <TabsTrigger value="generate" className="gap-1.5">
            <Shuffle className="h-3.5 w-3.5" />
            テスト作成
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            結果・履歴
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: 単語帳管理 */}
        <TabsContent value="books" className="space-y-4">
          <WordBookList
            selectedBookId={selectedBook?.id ?? null}
            onSelectBook={setSelectedBook}
          />

          {selectedBook && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-medium">{selectedBook.name}</h3>
                  <Badge variant="secondary">{selectedBook.total_words}語</Badge>
                  {selectedBook.material_key ? (
                    <>
                      <Badge variant="outline" className="text-green-600 border-green-300">
                        教材連携済
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                        className="gap-1.5"
                      >
                        <a href="/materials">
                          <ExternalLink className="h-3.5 w-3.5" />
                          教材管理で表示
                        </a>
                      </Button>
                    </>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      CSVインポートで自動連携
                    </Badge>
                  )}
                </div>

                <WordPreview bookId={selectedBook.id} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: テスト作成 */}
        <TabsContent value="generate">
          <Card>
            <CardContent className="p-4">
              <TestGenerator />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: 結果・履歴 */}
        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <TestResultForm />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <TestHistory />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
