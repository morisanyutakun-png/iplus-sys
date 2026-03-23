"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, BookOpen, Trash2 } from "lucide-react";
import { useWordBooks, useCreateWordBook, useDeleteWordBook } from "@/lib/queries/word-test";
import type { WordBook } from "@/lib/types";
import { CsvImportDialog } from "./csv-import-dialog";

interface Props {
  selectedBookId: number | null;
  onSelectBook: (book: WordBook) => void;
}

export function WordBookList({ selectedBookId, onSelectBook }: Props) {
  const { data: books = [], isLoading } = useWordBooks();
  const createBook = useCreateWordBook();
  const deleteBook = useDeleteWordBook();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const book = await createBook.mutateAsync({ name: name.trim(), description: description.trim() });
      toast.success(`「${book.name}」を作成しました`);
      setName("");
      setDescription("");
      setCreateOpen(false);
      onSelectBook(book);
    } catch {
      toast.error("作成に失敗しました");
    }
  };

  const handleDelete = async (book: WordBook) => {
    try {
      await deleteBook.mutateAsync(book.id);
      toast.success(`「${book.name}」を削除しました`);
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">単語帳一覧</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              新規作成
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>単語帳を作成</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Input
                placeholder="単語帳名（例: ターゲット1900）"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <Input
                placeholder="説明（任意）"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <Button onClick={handleCreate} disabled={!name.trim() || createBook.isPending} className="w-full">
                作成
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {books.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            単語帳がありません。「新規作成」から追加してください。
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <Card
              key={book.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedBookId === book.id
                  ? "ring-2 ring-primary shadow-md"
                  : ""
              }`}
              onClick={() => onSelectBook(book)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/30">
                      <BookOpen className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{book.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {book.total_words}語
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <CsvImportDialog bookId={book.id} bookName={book.name} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>単語帳を削除</AlertDialogTitle>
                          <AlertDialogDescription>
                            「{book.name}」を削除しますか？単語データとテスト履歴もすべて削除されます。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(book)}>
                            削除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {book.description && (
                  <p className="mt-2 text-xs text-muted-foreground truncate">
                    {book.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
