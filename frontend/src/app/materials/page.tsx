"use client";

import { useState } from "react";
import { useMaterials, useCreateMaterial, useAddNode } from "@/lib/queries/materials";
import { usePdfTree } from "@/lib/queries/pdfs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, FileText, Plus } from "lucide-react";

export default function MaterialsPage() {
  const { data: materials, isLoading } = useMaterials();
  const { data: pdfTree } = usePdfTree();
  const createMutation = useCreateMaterial();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newAliases, setNewAliases] = useState("");

  // Node add state
  const [addNodeFor, setAddNodeFor] = useState("");
  const [nodeKey, setNodeKey] = useState("");
  const [nodeTitle, setNodeTitle] = useState("");
  const [nodeRange, setNodeRange] = useState("");
  const [nodePdf, setNodePdf] = useState("");
  const [nodeDuplex, setNodeDuplex] = useState(false);

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
    if (!newKey.trim() || !newName.trim()) return;
    createMutation.mutate(
      {
        key: newKey.trim(),
        name: newName.trim(),
        aliases: newAliases
          ? newAliases.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      },
      {
        onSuccess: () => {
          toast.success("教材を登録しました");
          setCreateOpen(false);
          setNewKey("");
          setNewName("");
          setNewAliases("");
        },
        onError: (err) => toast.error(`登録に失敗: ${err.message}`),
      }
    );
  };

  // Flatten PDF tree for selector
  const allPdfs =
    pdfTree?.flatMap((entry) =>
      entry.files.map((f) => ({ label: f.path, value: f.path }))
    ) || [];

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
                  <label className="mb-1 block text-sm font-medium">キー</label>
                  <Input
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="例: w:英単語1900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">名前</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例: 英単語ターゲット1900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    エイリアス（カンマ区切り）
                  </label>
                  <Input
                    value={newAliases}
                    onChange={(e) => setNewAliases(e.target.value)}
                    placeholder="例: ターゲット,target1900"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={
                    !newKey.trim() || !newName.trim() || createMutation.isPending
                  }
                >
                  登録
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
            allPdfs={allPdfs}
            addNodeFor={addNodeFor}
            setAddNodeFor={setAddNodeFor}
            nodeKey={nodeKey}
            setNodeKey={setNodeKey}
            nodeTitle={nodeTitle}
            setNodeTitle={setNodeTitle}
            nodeRange={nodeRange}
            setNodeRange={setNodeRange}
            nodePdf={nodePdf}
            setNodePdf={setNodePdf}
            nodeDuplex={nodeDuplex}
            setNodeDuplex={setNodeDuplex}
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
  allPdfs,
  addNodeFor,
  setAddNodeFor,
  nodeKey,
  setNodeKey,
  nodeTitle,
  setNodeTitle,
  nodeRange,
  setNodeRange,
  nodePdf,
  setNodePdf,
  nodeDuplex,
  setNodeDuplex,
}: {
  mat: { key: string; name: string; nodes: any[] };
  isExpanded: boolean;
  onToggle: () => void;
  allPdfs: { label: string; value: string }[];
  addNodeFor: string;
  setAddNodeFor: (v: string) => void;
  nodeKey: string;
  setNodeKey: (v: string) => void;
  nodeTitle: string;
  setNodeTitle: (v: string) => void;
  nodeRange: string;
  setNodeRange: (v: string) => void;
  nodePdf: string;
  setNodePdf: (v: string) => void;
  nodeDuplex: boolean;
  setNodeDuplex: (v: boolean) => void;
}) {
  const addNodeMutation = useAddNode(mat.key);

  const handleAddNode = () => {
    if (!nodeKey.trim() || !nodeTitle.trim()) return;
    addNodeMutation.mutate(
      {
        key: nodeKey.trim(),
        title: nodeTitle.trim(),
        range_text: nodeRange.trim(),
        pdf_relpath: nodePdf === "__none__" ? "" : nodePdf,
        duplex: nodeDuplex,
      },
      {
        onSuccess: () => {
          toast.success("範囲を追加しました");
          setAddNodeFor("");
          setNodeKey("");
          setNodeTitle("");
          setNodeRange("");
          setNodePdf("");
          setNodeDuplex(false);
        },
        onError: (err) => toast.error(`追加に失敗: ${err.message}`),
      }
    );
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
            open={addNodeFor === mat.key}
            onOpenChange={(open) => {
              if (!open) setAddNodeFor("");
            }}
          >
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={(e) => {
                  e.stopPropagation();
                  setAddNodeFor(mat.key);
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
                    範囲キー
                  </label>
                  <Input
                    value={nodeKey}
                    onChange={(e) => setNodeKey(e.target.value)}
                    placeholder="例: w:英単語1900:001"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    タイトル
                  </label>
                  <Input
                    value={nodeTitle}
                    onChange={(e) => setNodeTitle(e.target.value)}
                    placeholder="例: 1-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    範囲テキスト
                  </label>
                  <Input
                    value={nodeRange}
                    onChange={(e) => setNodeRange(e.target.value)}
                    placeholder="例: p.1-10"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    PDFファイル
                  </label>
                  <Select value={nodePdf} onValueChange={setNodePdf}>
                    <SelectTrigger>
                      <SelectValue placeholder="PDFを選択（任意）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">なし</SelectItem>
                      {allPdfs.map((pdf) => (
                        <SelectItem key={pdf.value} value={pdf.value}>
                          {pdf.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="duplex"
                    checked={nodeDuplex}
                    onChange={(e) => setNodeDuplex(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <label htmlFor="duplex" className="text-sm font-medium">
                    両面印刷
                  </label>
                </div>
                <Button
                  className="w-full"
                  onClick={handleAddNode}
                  disabled={
                    !nodeKey.trim() ||
                    !nodeTitle.trim() ||
                    addNodeMutation.isPending
                  }
                >
                  追加
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      )}
    </Card>
  );
}
