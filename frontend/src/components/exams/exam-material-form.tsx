"use client";

import { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, X, Zap } from "lucide-react";
import { useCreateExamMaterial } from "@/lib/queries/exam-materials";

const COMMON_TEST_SUBJECTS = [
  { subject_name: "英語R", max_score: 100 },
  { subject_name: "英語L", max_score: 100 },
  { subject_name: "数学IA", max_score: 100 },
  { subject_name: "数学IIB(C)", max_score: 100 },
  { subject_name: "国語", max_score: 200 },
  { subject_name: "物理", max_score: 100 },
  { subject_name: "化学", max_score: 100 },
  { subject_name: "生物", max_score: 100 },
  { subject_name: "地学", max_score: 100 },
  { subject_name: "日本史", max_score: 100 },
  { subject_name: "世界史", max_score: 100 },
  { subject_name: "地理", max_score: 100 },
  { subject_name: "政治経済", max_score: 100 },
  { subject_name: "倫理", max_score: 100 },
  { subject_name: "現代社会", max_score: 100 },
  { subject_name: "倫理政経", max_score: 100 },
  { subject_name: "情報I", max_score: 100 },
];

type SubjectEntry = { subject_name: string; max_score: number };

type Props = {
  defaultExamType?: "common_test" | "university_past";
  trigger?: React.ReactNode;
};

export function ExamMaterialForm({ defaultExamType, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [examType, setExamType] = useState<string>(defaultExamType || "common_test");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [university, setUniversity] = useState("");
  const [faculty, setFaculty] = useState("");
  const [examPeriod, setExamPeriod] = useState("");
  const [subjects, setSubjects] = useState<SubjectEntry[]>([]);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectMax, setNewSubjectMax] = useState("100");

  const createMutation = useCreateExamMaterial();

  const handleApplyTemplate = () => {
    setSubjects([...COMMON_TEST_SUBJECTS]);
    toast.success("共テテンプレートを適用しました");
  };

  const handleAddSubject = () => {
    const trimmed = newSubjectName.trim();
    if (!trimmed) return;
    if (subjects.some((s) => s.subject_name === trimmed)) {
      toast.error("同じ教科が既に追加されています");
      return;
    }
    setSubjects([...subjects, { subject_name: trimmed, max_score: Number(newSubjectMax) || 100 }]);
    setNewSubjectName("");
    setNewSubjectMax("100");
  };

  const handleRemoveSubject = (idx: number) => {
    setSubjects(subjects.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("名前を入力してください");
      return;
    }
    if (subjects.length === 0) {
      toast.error("教科を1つ以上追加してください");
      return;
    }
    createMutation.mutate(
      {
        name: trimmedName,
        exam_type: examType,
        year: year ? Number(year) : undefined,
        university: university || undefined,
        faculty: faculty || undefined,
        exam_period: examPeriod || undefined,
        subjects,
      },
      {
        onSuccess: () => {
          toast.success("試験を作成しました");
          setOpen(false);
          resetForm();
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const resetForm = () => {
    setName("");
    setYear(String(new Date().getFullYear()));
    setUniversity("");
    setFaculty("");
    setExamPeriod("");
    setSubjects([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            試験追加
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>試験を追加</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">種別</label>
            <Select value={examType} onValueChange={setExamType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="common_test">共通テスト</SelectItem>
                <SelectItem value="university_past">大学過去問</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">名前</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={examType === "common_test" ? "2025共テ" : "東大2024前期"}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">年度</label>
              <Input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                type="number"
              />
            </div>
            {examType === "university_past" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">大学名</label>
                  <Input
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    placeholder="東京大学"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">学部</label>
                  <Input
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    placeholder="理学部"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">日程</label>
                  <Select value={examPeriod} onValueChange={setExamPeriod}>
                    <SelectTrigger>
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="前期">前期</SelectItem>
                      <SelectItem value="後期">後期</SelectItem>
                      <SelectItem value="中期">中期</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          {/* Subjects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">教科 ({subjects.length})</label>
              {examType === "common_test" && (
                <Button variant="outline" size="sm" onClick={handleApplyTemplate}>
                  <Zap className="mr-1 h-3 w-3" />
                  共テテンプレート
                </Button>
              )}
            </div>

            {subjects.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-2">
                {subjects.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted">
                    <span>{s.subject_name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{s.max_score}点</Badge>
                      <button
                        onClick={() => handleRemoveSubject(i)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="教科名"
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
              />
              <Input
                value={newSubjectMax}
                onChange={(e) => setNewSubjectMax(e.target.value)}
                type="number"
                className="w-20"
                placeholder="満点"
              />
              <Button variant="outline" size="icon" onClick={handleAddSubject}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "作成中..." : "作成"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
