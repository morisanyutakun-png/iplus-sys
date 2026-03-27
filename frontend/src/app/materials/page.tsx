"use client";

import { useState, useMemo } from "react";
import { useMaterials, useCreateMaterial, useAddNodeSimple, useDeleteMaterial, useUpdateNode, useDeleteNode } from "@/lib/queries/materials";
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
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Upload,
  Search,
  BookOpen,
  Trash2,
  Calculator,
  Languages,
  PenLine,
  FlaskConical,
  Globe,
  Layers,
  File,
  Pencil,
  Settings2,
  Check,
  X,
} from "lucide-react";
import type { Material, MaterialNode } from "@/lib/types";

// Subject config with icons, gradients, and colors
interface SubjectConfig {
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  headerBg: string;
  accent: string;
  text: string;
  badge: string;
  border: string;
  dot: string;
}

const SUBJECT_CONFIG: Record<string, SubjectConfig> = {
  "数学": {
    icon: Calculator,
    gradient: "from-blue-500 to-indigo-600",
    headerBg: "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
    accent: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-300",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
  },
  "英語": {
    icon: Languages,
    gradient: "from-rose-500 to-red-600",
    headerBg: "bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30",
    accent: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
    dot: "bg-rose-500",
  },
  "国語": {
    icon: PenLine,
    gradient: "from-emerald-500 to-green-600",
    headerBg: "bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30",
    accent: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  "理科": {
    icon: FlaskConical,
    gradient: "from-violet-500 to-purple-600",
    headerBg: "bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30",
    accent: "bg-violet-500",
    text: "text-violet-700 dark:text-violet-300",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300",
    border: "border-violet-200 dark:border-violet-800",
    dot: "bg-violet-500",
  },
  "社会": {
    icon: Globe,
    gradient: "from-amber-500 to-orange-600",
    headerBg: "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
    accent: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
  },
};

const DEFAULT_CONFIG: SubjectConfig = {
  icon: BookOpen,
  gradient: "from-gray-500 to-gray-600",
  headerBg: "bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-950/30 dark:to-slate-950/30",
  accent: "bg-gray-500",
  text: "text-gray-700 dark:text-gray-300",
  badge: "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300",
  border: "border-gray-200 dark:border-gray-800",
  dot: "bg-gray-500",
};

function getConfig(subject: string) {
  return SUBJECT_CONFIG[subject] || DEFAULT_CONFIG;
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

  const totalMaterials = materials?.length || 0;
  const totalNodes = (materials || []).reduce((s, m) => s + m.nodes.length, 0);

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
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-9 w-40 rounded-xl skeleton-pulse" />
            <div className="h-4 w-56 rounded-lg skeleton-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-64 rounded-xl skeleton-pulse" />
            <div className="h-10 w-28 rounded-xl skeleton-pulse" />
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl overflow-hidden">
            <div className="h-14 skeleton-pulse" />
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="h-36 rounded-xl skeleton-pulse" />
              <div className="h-36 rounded-xl skeleton-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">教材管理</h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="secondary" className="rounded-full text-xs font-medium">
              <Layers className="mr-1 h-3 w-3" />
              {totalMaterials} 教材
            </Badge>
            <Badge variant="secondary" className="rounded-full text-xs font-medium">
              <File className="mr-1 h-3 w-3" />
              {totalNodes} 範囲
            </Badge>
            <Badge variant="secondary" className="rounded-full text-xs font-medium">
              {grouped.length} 教科
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="教材を検索..."
              className="pl-10 w-64 h-10 rounded-xl bg-muted/40 border-0 focus-visible:bg-background focus-visible:ring-2 transition-all"
            />
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 rounded-xl shadow-premium font-medium">
                <Plus className="mr-2 h-4 w-4" />
                教材追加
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg">新しい教材を登録</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">教材名</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例: 英単語ターゲット1900"
                    className="h-10 rounded-xl"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">教科</label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_SUBJECTS.map((s) => {
                      const cfg = getConfig(s);
                      const SubjectIcon = cfg.icon;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => { setSelectedSubject(s); setCustomSubject(""); }}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all border-2",
                            selectedSubject === s
                              ? `${cfg.badge} border-current shadow-sm scale-105`
                              : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <SubjectIcon className="h-3.5 w-3.5" />
                          {s}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedSubject("カスタム")}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all border-2",
                        selectedSubject === "カスタム"
                          ? "bg-gray-100 text-gray-800 border-gray-300 shadow-sm dark:bg-gray-800 dark:text-gray-200"
                          : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      その他
                    </button>
                  </div>
                  {selectedSubject === "カスタム" && (
                    <Input
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      placeholder="教科名を入力"
                      className="mt-3 h-10 rounded-xl"
                    />
                  )}
                </div>
                <Button
                  className="w-full h-10 rounded-xl font-medium"
                  onClick={handleCreate}
                  disabled={!newName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? "登録中..." : "登録する"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Empty state */}
      {grouped.length === 0 && (
        <Card className="border-0 shadow-premium overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-24">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 mb-6">
              <BookOpen className="h-10 w-10 text-primary/40" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {searchQuery ? "該当する教材がありません" : "教材がまだ登録されていません"}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {searchQuery ? "検索条件を変更してみてください" : "教材を追加して、学習管理を始めましょう"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setCreateOpen(true)} className="rounded-xl font-medium">
                <Plus className="mr-2 h-4 w-4" />
                最初の教材を追加
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Subject groups */}
      {grouped.map(([subject, mats]) => {
        const cfg = getConfig(subject);
        const isCollapsed = collapsedSubjects.has(subject);
        const SubjectIcon = cfg.icon;
        const subjectNodeCount = mats.reduce((s, m) => s + m.nodes.length, 0);

        return (
          <div key={subject} className="rounded-2xl border border-border/60 overflow-hidden shadow-premium">
            {/* Subject header */}
            <button
              type="button"
              onClick={() => toggleSubjectCollapse(subject)}
              className={cn(
                "w-full flex items-center justify-between px-6 py-4 transition-all",
                cfg.headerBg,
                "hover:opacity-95 cursor-pointer"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm text-white",
                  cfg.gradient
                )}>
                  <SubjectIcon className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-bold text-base", cfg.text)}>{subject}</span>
                    {isCollapsed ? (
                      <ChevronRight className={cn("h-4 w-4", cfg.text)} />
                    ) : (
                      <ChevronDown className={cn("h-4 w-4", cfg.text)} />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {mats.length}教材 · {subjectNodeCount}範囲
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn("rounded-full text-[10px] font-semibold", cfg.badge)}>
                  {mats.length}
                </Badge>
              </div>
            </button>

            {/* Material cards grid */}
            {!isCollapsed && (
              <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4 bg-card">
                {mats.map((mat) => (
                  <MaterialCard key={mat.key} mat={mat} config={cfg} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Node Edit Dialog ── */
function NodeEditDialog({
  node,
  materialKey,
  open,
  onOpenChange,
}: {
  node: MaterialNode;
  materialKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateMutation = useUpdateNode(materialKey);
  const deleteNodeMutation = useDeleteNode(materialKey);
  const [title, setTitle] = useState(node.title);
  const [rangeText, setRangeText] = useState(node.range_text);
  const [duplex, setDuplex] = useState(node.duplex);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    const updates: { title?: string; range_text?: string; duplex?: boolean } = {};
    if (title.trim() !== node.title) updates.title = title.trim();
    if (rangeText.trim() !== node.range_text) updates.range_text = rangeText.trim();
    if (duplex !== node.duplex) updates.duplex = duplex;
    if (Object.keys(updates).length === 0) {
      onOpenChange(false);
      return;
    }
    updateMutation.mutate(
      { nodeKey: node.key, updates },
      {
        onSuccess: () => {
          toast.success("範囲を更新しました");
          onOpenChange(false);
        },
        onError: () => toast.error("更新に失敗しました"),
      }
    );
  };

  const handleDeleteNode = () => {
    deleteNodeMutation.mutate(node.key, {
      onSuccess: (data) => {
        const msg = data.pointer_adjustments > 0
          ? `範囲を削除しました（${data.pointer_adjustments}名のポインタを調整）`
          : "範囲を削除しました";
        toast.success(msg);
        setConfirmDelete(false);
        onOpenChange(false);
      },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-muted-foreground" />
            範囲を編集
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <label className="mb-1.5 block text-sm font-medium">タイトル</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9"
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">範囲テキスト</label>
            <Input
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              className="h-9"
              placeholder="例: p.1〜p.20"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <label className="text-sm font-medium">両面印刷</label>
            <button
              type="button"
              role="switch"
              aria-checked={duplex}
              onClick={() => setDuplex(!duplex)}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                duplex ? "bg-primary" : "bg-muted-foreground/20"
              )}
            >
              <span className={cn(
                "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm",
                duplex ? "translate-x-4.5" : "translate-x-0.5"
              )} />
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span>{node.pdf_relpath ? `PDF: ${node.pdf_relpath.split("/").pop()}` : "PDF なし"}</span>
            <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">
              #{node.sort_order}
            </Badge>
          </div>

          <div className="flex items-center justify-between pt-1">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive font-medium">本当に削除？</span>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 px-3 text-xs"
                  onClick={handleDeleteNode}
                  disabled={deleteNodeMutation.isPending}
                >
                  {deleteNodeMutation.isPending ? "削除中..." : "削除"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setConfirmDelete(false)}
                >
                  戻る
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                この範囲を削除
              </Button>
            )}
            <Button
              size="sm"
              className="h-8 px-4"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Material Card ── */
function MaterialCard({
  mat,
  config,
}: {
  mat: Material;
  config: SubjectConfig;
}) {
  const addNodeMutation = useAddNodeSimple(mat.key);
  const deleteMutation = useDeleteMaterial();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nodeTitle, setNodeTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showNodeList, setShowNodeList] = useState(false);
  const [editingNode, setEditingNode] = useState<MaterialNode | null>(null);

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

  const handleDelete = () => {
    deleteMutation.mutate(mat.key, {
      onSuccess: (data) => {
        const msg = data.unassigned > 0
          ? `「${mat.name}」を削除しました（${data.unassigned}名の割当を解除）`
          : `「${mat.name}」を削除しました`;
        toast.success(msg);
        setDeleteOpen(false);
      },
      onError: (err) => toast.error(err.message),
    });
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

  const sortedNodes = [...mat.nodes].sort((a, b) => a.sort_order - b.sort_order);
  const pdfCount = mat.nodes.filter((n) => n.pdf_relpath).length;

  return (
    <Card className="group border-0 shadow-sm hover:shadow-premium-lg transition-all duration-300 overflow-hidden relative">
      {/* Top accent line */}
      <div className={cn("h-1 w-full bg-gradient-to-r", config.gradient)} />

      <CardContent className="p-5 pt-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[15px] tracking-tight truncate">{mat.name}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="secondary" className="rounded-full text-[10px] font-medium px-2 py-0">
                {mat.nodes.length} 範囲
              </Badge>
              {pdfCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <FileText className="h-3 w-3" />
                  PDF {pdfCount}/{mat.nodes.length}
                </span>
              )}
            </div>
          </div>

          {/* Actions - visible on hover */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>教材を削除しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    「{mat.name}」と{mat.nodes.length}件の範囲が完全に削除されます。
                    割り当て中の生徒がいる場合は自動的に割当が解除されます。
                    この操作は元に戻せません。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteMutation.isPending ? "削除中..." : "削除する"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Dialog
              open={addOpen}
              onOpenChange={(open) => {
                setAddOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent onClick={(e) => e.stopPropagation()} className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{mat.name} に範囲追加</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">タイトル</label>
                    <Input
                      value={nodeTitle}
                      onChange={(e) => setNodeTitle(e.target.value)}
                      placeholder="例: 1-100"
                      className="h-10 rounded-xl"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">PDF（任意）</label>
                    <div
                      className={cn(
                        "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all",
                        isDragging
                          ? "border-primary bg-primary/5 scale-[1.02]"
                          : pdfFile
                            ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                            : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30"
                      )}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                    >
                      {pdfFile ? (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-5 w-5 text-emerald-600" />
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
                          <Upload className="mb-2 h-8 w-8 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground">ドラッグ&ドロップ</p>
                          <label className="mt-1.5 cursor-pointer text-sm font-medium text-primary hover:underline">
                            またはファイルを選択
                            <input type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    className="w-full h-10 rounded-xl font-medium"
                    onClick={handleAddNode}
                    disabled={!nodeTitle.trim() || addNodeMutation.isPending}
                  >
                    {addNodeMutation.isPending ? "追加中..." : "追加する"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Node summary dots + manage button (skip for word test materials — ranges managed at assignment) */}
        {mat.key.startsWith("単語:") ? (
          mat.nodes.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="flex flex-wrap gap-1 flex-1">
                {sortedNodes.slice(0, 20).map((node) => (
                  <span
                    key={node.key}
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      node.pdf_relpath ? "bg-emerald-500" : "bg-muted-foreground/25"
                    )}
                    title={`${node.sort_order}. ${node.title}`}
                  />
                ))}
                {sortedNodes.length > 20 && (
                  <span className="text-[10px] text-muted-foreground ml-0.5">+{sortedNodes.length - 20}</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">{sortedNodes.length}範囲（割り当て時に設定）</span>
            </div>
          )
        ) : mat.nodes.length > 0 ? (
          <div className="space-y-2">
            {/* Compact dot summary */}
            <div className="flex items-center gap-1">
              <div className="flex flex-wrap gap-1 flex-1">
                {sortedNodes.slice(0, 20).map((node) => (
                  <span
                    key={node.key}
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      node.pdf_relpath ? "bg-emerald-500" : "bg-muted-foreground/25"
                    )}
                    title={`${node.sort_order}. ${node.title}`}
                  />
                ))}
                {sortedNodes.length > 20 && (
                  <span className="text-[10px] text-muted-foreground ml-0.5">+{sortedNodes.length - 20}</span>
                )}
              </div>
            </div>

            {/* Manage nodes toggle */}
            <button
              type="button"
              onClick={() => setShowNodeList(!showNodeList)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              {showNodeList ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <Settings2 className="h-3 w-3" />
              範囲を管理
            </button>

            {/* Expandable node list */}
            {showNodeList && (
              <div className="rounded-lg border border-border/60 bg-muted/20 divide-y divide-border/40 overflow-hidden">
                {sortedNodes.map((node) => (
                  <div
                    key={node.key}
                    className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/40 transition-colors group/row"
                  >
                    <span className="text-muted-foreground/50 font-mono tabular-nums w-5 text-right shrink-0">
                      {node.sort_order}
                    </span>
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      node.pdf_relpath ? "bg-emerald-500" : "bg-muted-foreground/25"
                    )} />
                    <span className="font-medium truncate flex-1">{node.title}</span>
                    {node.range_text && node.range_text !== node.title && (
                      <span className="text-muted-foreground truncate max-w-[80px]">{node.range_text}</span>
                    )}
                    {node.duplex && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">両面</Badge>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0"
                      onClick={() => setEditingNode(node)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="px-3 py-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-full text-xs text-primary hover:text-primary"
                    onClick={() => setAddOpen(true)}
                  >
                    <Plus className="mr-1.5 h-3 w-3" />
                    範囲を追加
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-3 px-3 rounded-xl bg-muted/30 border border-dashed border-border/50">
            <BookOpen className="h-4 w-4 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground">範囲がまだありません</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-primary ml-auto"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="mr-1 h-3 w-3" />
              追加
            </Button>
          </div>
        )}
      </CardContent>

      {/* Node edit dialog */}
      {editingNode && (
        <NodeEditDialog
          node={editingNode}
          materialKey={mat.key}
          open={!!editingNode}
          onOpenChange={(open) => { if (!open) setEditingNode(null); }}
        />
      )}
    </Card>
  );
}
