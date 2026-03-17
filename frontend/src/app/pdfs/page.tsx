"use client";

import { useRef, useState } from "react";
import { usePdfTree, useUploadPdf, useDeletePdf, pdfFileUrl } from "@/lib/queries/pdfs";
import { useMaterials } from "@/lib/queries/materials";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Trash2, FileText, FolderOpen, Eye, HardDrive } from "lucide-react";

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function PdfsPage() {
  const { data: tree, isLoading } = usePdfTree();
  const { data: materials } = useMaterials();
  const uploadMut = useUploadPdf();
  const deleteMut = useDeletePdf();

  const [isDragging, setIsDragging] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const matKey = selectedMaterial === "__none__" ? undefined : selectedMaterial || undefined;
    for (const file of Array.from(files)) {
      try {
        await uploadMut.mutateAsync({ file, materialKey: matKey });
        toast.success(file.name + " をアップロードしました");
      } catch {
        toast.error(file.name + " のアップロードに失敗しました");
      }
    }
    setDialogOpen(false);
  };

  const handleDelete = async (path: string, name: string) => {
    if (!confirm(name + " を削除しますか？")) return;
    try {
      await deleteMut.mutateAsync(path);
      toast.success("削除しました");
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 rounded-lg skeleton-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 rounded-2xl skeleton-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const totalFiles = (tree || []).reduce((sum, e) => sum + e.files.length, 0);

  return (
    <div
      className="space-y-8 relative"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="rounded-3xl border-2 border-dashed border-primary/50 bg-primary/5 p-16 text-center">
            <Upload className="mx-auto mb-4 h-16 w-16 text-primary/50" />
            <p className="text-xl font-semibold">ドロップしてアップロード</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PDF管理</h1>
          <p className="mt-1 text-muted-foreground">印刷用PDFファイルの管理</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="rounded-full px-3 py-1 gap-1">
            <HardDrive className="h-3 w-3" />
            {totalFiles} ファイル
          </Badge>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 shadow-premium hover:shadow-premium-lg transition-all">
                <Upload className="mr-2 h-4 w-4" />
                アップロード
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>PDFアップロード</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">教材フォルダ（任意）</label>
                  <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="ルートに保存" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">ルート</SelectItem>
                      {(materials || []).map((m) => (
                        <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Input
                    ref={fileRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    className="h-11 rounded-xl"
                    onChange={(e) => handleUpload(e.target.files)}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {(tree || []).map((entry, idx) => (
        <Card key={entry.directory} className="border-0 shadow-premium overflow-hidden stagger-item" style={{ animationDelay: idx * 60 + "ms" }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-base">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow">
                <FolderOpen className="h-4 w-4" />
              </div>
              {entry.directory || "ルート"}
              <Badge variant="outline" className="ml-auto rounded-full">{entry.files.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {entry.files.map((file) => (
                <div key={file.path} className="group relative flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 dark:bg-red-950">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={pdfFileUrl(file.path)} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(file.path, file.name)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {entry.files.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground col-span-full">空のフォルダ</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
