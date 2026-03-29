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
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, Trash2, Pencil } from "lucide-react";
import { SUBJECT_GROUPS, getSubjectGroupStyle } from "@/lib/subjects";
import { useWordBooks, useCreateWordBook, useUpdateWordBook, useDeleteWordBook } from "@/lib/queries/word-test";
import type { WordBook } from "@/lib/types";
import { CsvImportDialog } from "./csv-import-dialog";

interface Props {
  selectedBookId: number | null;
  onSelectBook: (book: WordBook) => void;
}

export function WordBookList({ selectedBookId, onSelectBook }: Props) {
  const { data: books = [], isLoading } = useWordBooks();
  const createBook = useCreateWordBook();
  const updateBook = useUpdateWordBook();
  const deleteBook = useDeleteWordBook();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("英語");
  const [renameBook, setRenameBook] = useState<WordBook | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameSubject, setRenameSubject] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const book = await createBook.mutateAsync({ name: name.trim(), description: description.trim(), subject });
      toast.success(`「${book.name}」を作成しました`);
      setName("");
      setDescription("");
      setSubject("英語");
      setCreateOpen(false);
      onSelectBook(book);
    } catch {
      toast.error("作成に失敗しました");
    }
  };

  const handleRename = async () => {
    if (!renameBook || !renameName.trim()) return;
    try {
      const updated = await updateBook.mutateAsync({
        bookId: renameBook.id,
        name: renameName.trim() !== renameBook.name ? renameName.trim() : undefined,
        subject: renameSubject !== renameBook.subject ? renameSubject : undefined,
      });
      toast.success(`「${updated.name}」を更新しました`);
      setRenameBook(null);
      setRenameName("");
    } catch {
      toast.error("名称変更に失敗しました");
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
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">教科</label>
                <div className="space-y-1.5">
                  {SUBJECT_GROUPS.map((group) => (
                    <div key={group.label} className="flex flex-wrap gap-1">
                      {group.subjects.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSubject(s)}
                          className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-all ${
                            subject === s
                              ? `${getSubjectGroupStyle(s).badge} border-current shadow-sm`
                              : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/60"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
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
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">{book.total_words}語</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full">{book.subject || "英語"}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameBook(book);
                        setRenameName(book.name);
                        setRenameSubject(book.subject || "英語");
                      }}
                      title="名称変更"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
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

      {/* Rename dialog */}
      <Dialog open={!!renameBook} onOpenChange={(open) => !open && setRenameBook(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>単語帳の編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="新しい単語帳名"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">教科</label>
              <div className="space-y-1.5">
                {SUBJECT_GROUPS.map((group) => (
                  <div key={group.label} className="flex flex-wrap gap-1">
                    {group.subjects.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRenameSubject(s)}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-all ${
                          renameSubject === s
                            ? `${getSubjectGroupStyle(s).badge} border-current shadow-sm`
                            : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/60"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <Button
              onClick={handleRename}
              disabled={
                (!renameName.trim() || (renameName.trim() === renameBook?.name && renameSubject === (renameBook?.subject || "英語")))
                || updateBook.isPending
              }
              className="w-full"
            >
              {updateBook.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
