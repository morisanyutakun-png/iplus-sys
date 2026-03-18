"use client";

import { useState } from "react";
import { useMaterials, useCreateMaterial, useAddNodeSimple } from "@/lib/queries/materials";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, FileText, Plus, Upload } from "lucide-react";

export default function MaterialsPage() {
  const { data: materials, isLoading } = useMaterials();
  const createMutation = useCreateMaterial();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate(
      { name: newName.trim() },
      {
        onSuccess: () => {
          toast.success("教材を登録しました");
          setCreateOpen(false);
          setNewName("");
        },
        onError: (err) => toast.error(`登録に失敗: ${err.message}`),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">教材管理</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{materials?.length || 0} 教材</Badge>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                教材追加
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>教材登録</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">教材名</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例: 英単語ターゲット1900"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newName.trim()) handleCreate();
                    }}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={!newName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? "登録中..." : "登録"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        {(materials || []).map((mat) => (
          <MaterialCard
            key={mat.key}
            mat={mat}
            isExpanded={expanded.has(mat.key)}
            onToggle={() => toggleExpand(mat.key)}
          />
        ))}
      </div>
    </div>
  );
}

function MaterialCard({
  mat,
  isExpanded,
  onToggle,
}: {
  mat: { key: string; name: string; nodes: any[] };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const addNodeMutation = useAddNodeSimple(mat.key);
  const [addOpen, setAddOpen] = useState(false);
  const [nodeTitle, setNodeTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetForm = () => {
    setNodeTitle("");
    setPdfFile(null);
    setIsDragging(false);
  };

  const handleAddNode = () => {
    if (!nodeTitle.trim()) return;
    addNodeMutation.mutate(
      { title: nodeTitle.trim(), file: pdfFile || undefined },
      {
        onSuccess: () => {
          toast.success("範囲を追加しました");
          resetForm();
          setAddOpen(false);
        },
        onError: (err) => toast.error(`追加に失敗: ${err.message}`),
      }
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") setPdfFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPdfFile(file);
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <CardTitle className="text-base">{mat.name}</CardTitle>
            <Badge variant="outline">{mat.key}</Badge>
          </div>
          <Badge variant="secondary">{mat.nodes.length} 範囲</Badge>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>タイトル</TableHead>
                <TableHead>範囲</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead className="w-20">両面</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mat.nodes.map((node) => (
                <TableRow key={node.key}>
                  <TableCell className="text-muted-foreground">
                    {node.sort_order}
                  </TableCell>
                  <TableCell className="font-medium">{node.title}</TableCell>
                  <TableCell>{node.range_text || "-"}</TableCell>
                  <TableCell>
                    {node.pdf_relpath ? (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span className="max-w-[200px] truncate">
                          {node.pdf_relpath}
                        </span>
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {node.duplex ? (
                      <Badge variant="default">両面</Badge>
                    ) : (
                      <span className="text-muted-foreground">片面</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Dialog
            open={addOpen}
            onOpenChange={(open) => {
              setAddOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={(e) => {
                  e.stopPropagation();
                  setAddOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                範囲追加
              </Button>
            </DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
              <DialogHeader>
                <DialogTitle>{mat.name} に範囲追加</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    タイトル
                  </label>
                  <Input
                    value={nodeTitle}
                    onChange={(e) => setNodeTitle(e.target.value)}
                    placeholder="例: 1-100"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && nodeTitle.trim()) handleAddNode();
                    }}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    PDF（任意）
                  </label>
                  <div
                    className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : pdfFile
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                          : "border-muted-foreground/25 hover:border-muted-foreground/50"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                  >
                    {pdfFile ? (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-5 w-5 text-green-600" />
                        <span className="font-medium">{pdfFile.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs text-muted-foreground"
                          onClick={() => setPdfFile(null)}
                        >
                          取消
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="mb-2 h-8 w-8 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          ドラッグ&ドロップ または
                        </p>
                        <label className="mt-1 cursor-pointer text-sm font-medium text-primary hover:underline">
                          ファイルを選択
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={handleFileSelect}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleAddNode}
                  disabled={!nodeTitle.trim() || addNodeMutation.isPending}
                >
                  {addNodeMutation.isPending ? "追加中..." : "追加"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      )}
    </Card>
  );
}
