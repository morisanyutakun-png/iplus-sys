"use client";

import { useState, useMemo } from "react";
import { useMaterials, useCreateMaterial, useAddNodeSimple } from "@/lib/queries/materials";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Upload,
  Search,
  BookOpen,
} from "lucide-react";
import type { Material } from "@/lib/types";

// Subject color config
const SUBJECT_COLORS: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  "数学": { border: "border-l-blue-500", bg: "bg-blue-50", text: "text-blue-700", badge: "bg-blue-100 text-blue-800" },
  "英語": { border: "border-l-red-500", bg: "bg-red-50", text: "text-red-700", badge: "bg-red-100 text-red-800" },
  "国語": { border: "border-l-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800" },
  "理科": { border: "border-l-purple-500", bg: "bg-purple-50", text: "text-purple-700", badge: "bg-purple-100 text-purple-800" },
  "社会": { border: "border-l-amber-500", bg: "bg-amber-50", text: "text-amber-700", badge: "bg-amber-100 text-amber-800" },
};
const DEFAULT_COLOR = { border: "border-l-gray-400", bg: "bg-gray-50", text: "text-gray-600", badge: "bg-gray-100 text-gray-700" };

function getSubjectColor(subject: string) {
  return SUBJECT_COLORS[subject] || DEFAULT_COLOR;
}

const PRESET_SUBJECTS = ["数学", "英語", "国語", "理科", "社会"];

export default function MaterialsPage() {
  const { data: materials, isLoading } = useMaterials();
  const createMutation = useCreateMaterial();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("その他");
  const [customSubject, setCustomSubject] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedSubjects, setCollapsedSubjects] = useState<Set<string>>(new Set());

  // Group materials by subject
  const grouped = useMemo(() => {
    const filtered = (materials || []).filter((m) =>
      searchQuery ? m.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
    );
    const groups = new Map<string, Material[]>();
    for (const mat of filtered) {
      const subject = mat.subject || "その他";
      if (!groups.has(subject)) groups.set(subject, []);
      groups.get(subject)!.push(mat);
    }
    // Sort: preset subjects first, then alphabetical
    const sorted = [...groups.entries()].sort(([a], [b]) => {
      const ai = PRESET_SUBJECTS.indexOf(a);
      const bi = PRESET_SUBJECTS.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [materials, searchQuery]);

  const subjectCount = grouped.length;
  const totalMaterials = materials?.length || 0;

  const toggleSubjectCollapse = (subject: string) => {
    setCollapsedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  };

  const effectiveSubject =
    selectedSubject === "カスタム" ? customSubject.trim() || "その他" : selectedSubject;

  const handleCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate(
      { name: newName.trim(), subject: effectiveSubject },
      {
        onSuccess: () => {
          toast.success("教材を登録しました");
          setCreateOpen(false);
          setNewName("");
          setSelectedSubject("その他");
          setCustomSubject("");
        },
        onError: (err) => toast.error(`登録に失敗: ${err.message}`),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">教材管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalMaterials}教材 · {subjectCount}教科
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="教材を検索..."
              className="pl-9 w-56 h-9"
            />
          </div>
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
                  <label className="mb-1.5 block text-sm font-medium">教材名</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例: 英単語ターゲット1900"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">教科</label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_SUBJECTS.map((s) => {
                      const color = getSubjectColor(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => { setSelectedSubject(s); setCustomSubject(""); }}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium transition-all border-2",
                            selectedSubject === s
                              ? `${color.badge} border-current shadow-sm scale-105`
                              : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedSubject("カスタム")}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium transition-all border-2",
                        selectedSubject === "カスタム"
                          ? "bg-gray-100 text-gray-800 border-gray-300 shadow-sm"
                          : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      その他
                    </button>
                  </div>
                  {selectedSubject === "カスタム" && (
                    <Input
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      placeholder="教科名を入力"
                      className="mt-2"
                    />
                  )}
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

      {/* Subject groups */}
      {grouped.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <BookOpen className="h-12 w-12 opacity-20 mb-3" />
          <p className="text-sm">
            {searchQuery ? "該当する教材がありません" : "教材がまだ登録されていません"}
          </p>
        </div>
      )}

      {grouped.map(([subject, mats]) => {
        const color = getSubjectColor(subject);
        const isCollapsed = collapsedSubjects.has(subject);

        return (
          <div key={subject} className={cn("rounded-xl border border-border overflow-hidden")}>
            {/* Subject header */}
            <button
              type="button"
              onClick={() => toggleSubjectCollapse(subject)}
              className={cn(
                "w-full flex items-center justify-between px-5 py-3 transition-colors",
                color.bg,
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <div className="flex items-center gap-3">
                {isCollapsed ? (
                  <ChevronRight className={cn("h-4 w-4", color.text)} />
                ) : (
                  <ChevronDown className={cn("h-4 w-4", color.text)} />
                )}
                <span className={cn("font-bold text-base", color.text)}>{subject}</span>
                <Badge className={cn("rounded-full text-xs", color.badge)}>
                  {mats.length}教材
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {mats.reduce((sum, m) => sum + m.nodes.length, 0)}範囲
              </span>
            </button>

            {/* Material cards */}
            {!isCollapsed && (
              <div className="p-4 space-y-3 bg-white">
                {mats.map((mat) => (
                  <MaterialCard key={mat.key} mat={mat} subjectColor={color} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MaterialCard({
  mat,
  subjectColor,
}: {
  mat: Material;
  subjectColor: { border: string; bg: string; text: string; badge: string };
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
    <Card className={cn("border-l-4 shadow-sm", subjectColor.border)}>
      <CardContent className="p-4">
        {/* Material header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{mat.name}</h3>
            <Badge variant="secondary" className="text-[10px] rounded-full">
              {mat.nodes.length}範囲
            </Badge>
          </div>
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
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <Plus className="mr-1 h-3 w-3" />
                範囲追加
              </Button>
            </DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
              <DialogHeader>
                <DialogTitle>{mat.name} に範囲追加</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">タイトル</label>
                  <Input
                    value={nodeTitle}
                    onChange={(e) => setNodeTitle(e.target.value)}
                    placeholder="例: 1-100"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">PDF（任意）</label>
                  <div
                    className={cn(
                      "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
                      isDragging
                        ? "border-primary bg-primary/5"
                        : pdfFile
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                          : "border-muted-foreground/25 hover:border-muted-foreground/50"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
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
                        <p className="text-sm text-muted-foreground">ドラッグ&ドロップ または</p>
                        <label className="mt-1 cursor-pointer text-sm font-medium text-primary hover:underline">
                          ファイルを選択
                          <input type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
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
        </div>

        {/* Node pills - compact horizontal display */}
        {mat.nodes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {[...mat.nodes]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((node) => (
                <div
                  key={node.key}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors",
                    "bg-muted/50 hover:bg-muted text-foreground/80",
                    "border border-border/50"
                  )}
                  title={[
                    node.title,
                    node.range_text && node.range_text !== node.title ? node.range_text : "",
                    node.pdf_relpath ? "PDF あり" : "",
                    node.duplex ? "両面印刷" : "",
                  ].filter(Boolean).join(" · ")}
                >
                  <span className="text-muted-foreground font-medium">{node.sort_order}.</span>
                  <span className="font-medium truncate max-w-[120px]">{node.title}</span>
                  {node.pdf_relpath && (
                    <FileText className="h-3 w-3 text-blue-500 shrink-0" />
                  )}
                </div>
              ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">範囲がまだありません</p>
        )}
      </CardContent>
    </Card>
  );
}
