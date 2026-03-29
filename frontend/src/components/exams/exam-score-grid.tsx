"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Plus, X } from "lucide-react";
import { useBatchUpsertExamScores } from "@/lib/queries/exam-scores";
import type { ExamMaterial, ExamScore, ExamScoreUpsert } from "@/lib/types";

type Props = {
  studentId: string;
  examMaterial: ExamMaterial;
  existingScores: ExamScore[];
};

export function ExamScoreGrid({ studentId, examMaterial, existingScores }: Props) {
  // Extract unique attempt dates from existing scores
  const existingDates = useMemo(() => {
    const dates = new Set(existingScores.map((s) => s.attempt_date));
    return Array.from(dates).sort();
  }, [existingScores]);

  const [dates, setDates] = useState<string[]>(
    existingDates.length > 0 ? existingDates : [new Date().toISOString().split("T")[0]]
  );
  const [newDate, setNewDate] = useState("");

  // scores[subjectId][dateStr] = score value (string for input)
  const [scoreInputs, setScoreInputs] = useState<Record<number, Record<string, string>>>(() => {
    const init: Record<number, Record<string, string>> = {};
    for (const subj of examMaterial.subjects) {
      init[subj.id] = {};
      for (const d of dates) {
        const existing = existingScores.find(
          (s) => s.exam_subject_id === subj.id && s.attempt_date === d
        );
        init[subj.id][d] = existing?.score != null ? String(existing.score) : "";
      }
    }
    return init;
  });

  const batchUpsert = useBatchUpsertExamScores();

  const handleAddDate = () => {
    if (!newDate) {
      toast.error("日付を選択してください");
      return;
    }
    if (dates.includes(newDate)) {
      toast.error("同じ日付が既にあります");
      return;
    }
    const updated = [...dates, newDate].sort();
    setDates(updated);
    // Add empty entries for new date
    const newInputs = { ...scoreInputs };
    for (const subj of examMaterial.subjects) {
      if (!newInputs[subj.id]) newInputs[subj.id] = {};
      newInputs[subj.id][newDate] = "";
    }
    setScoreInputs(newInputs);
    setNewDate("");
  };

  const handleRemoveDate = (d: string) => {
    setDates(dates.filter((dd) => dd !== d));
    const newInputs = { ...scoreInputs };
    for (const subj of examMaterial.subjects) {
      if (newInputs[subj.id]) {
        delete newInputs[subj.id][d];
      }
    }
    setScoreInputs(newInputs);
  };

  const handleScoreChange = (subjectId: number, dateStr: string, value: string) => {
    setScoreInputs((prev) => ({
      ...prev,
      [subjectId]: {
        ...prev[subjectId],
        [dateStr]: value,
      },
    }));
  };

  const handleSave = () => {
    const scores: ExamScoreUpsert[] = [];
    for (const subj of examMaterial.subjects) {
      for (const d of dates) {
        const val = scoreInputs[subj.id]?.[d];
        if (val === undefined || val === "") continue;
        const num = Number(val);
        if (isNaN(num)) continue;
        if (num > subj.max_score) {
          toast.error(`${subj.subject_name}: ${num} は満点(${subj.max_score})を超えています`);
          return;
        }
        scores.push({
          student_id: studentId,
          exam_material_id: examMaterial.id,
          exam_subject_id: subj.id,
          score: num,
          attempt_date: d,
        });
      }
    }
    if (scores.length === 0) {
      toast.error("保存するスコアがありません");
      return;
    }
    batchUpsert.mutate(scores, {
      onSuccess: (res) => toast.success(`${res.upserted}件保存しました`),
      onError: (e) => toast.error(e.message),
    });
  };

  // Calculate totals per date
  const dateTotals = useMemo(() => {
    const totals: Record<string, { score: number; max: number }> = {};
    for (const d of dates) {
      let sum = 0;
      let max = 0;
      for (const subj of examMaterial.subjects) {
        const val = scoreInputs[subj.id]?.[d];
        max += subj.max_score;
        if (val && !isNaN(Number(val))) {
          sum += Number(val);
        }
      }
      totals[d] = { score: sum, max };
    }
    return totals;
  }, [scoreInputs, dates, examMaterial.subjects]);

  return (
    <div className="space-y-4">
      {/* Date management */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">実施日:</span>
        {dates.map((d) => (
          <Badge key={d} variant="secondary" className="gap-1">
            {d}
            <button
              onClick={() => handleRemoveDate(d)}
              className="ml-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="h-7 w-36 text-xs"
          />
          <Button variant="outline" size="sm" className="h-7" onClick={handleAddDate}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Score grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3 font-medium text-muted-foreground w-32">
                教科
              </th>
              <th className="text-center py-2 px-2 font-medium text-muted-foreground w-16">
                満点
              </th>
              {dates.map((d) => (
                <th key={d} className="text-center py-2 px-2 font-medium text-muted-foreground min-w-[80px]">
                  {d.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {examMaterial.subjects.map((subj) => (
              <tr key={subj.id} className="border-b hover:bg-muted/30">
                <td className="py-1.5 px-3 font-medium">{subj.subject_name}</td>
                <td className="py-1.5 px-2 text-center text-muted-foreground">
                  {subj.max_score}
                </td>
                {dates.map((d) => {
                  const val = scoreInputs[subj.id]?.[d] || "";
                  const numVal = Number(val);
                  const isOver = val && !isNaN(numVal) && numVal > subj.max_score;
                  const pct = val && !isNaN(numVal) ? (numVal / subj.max_score) * 100 : null;
                  return (
                    <td key={d} className="py-1.5 px-1">
                      <div className="relative">
                        <Input
                          value={val}
                          onChange={(e) => handleScoreChange(subj.id, d, e.target.value)}
                          className={`h-8 text-center text-sm ${isOver ? "border-destructive" : ""}`}
                          type="number"
                          min={0}
                          max={subj.max_score}
                          step="any"
                        />
                        {pct !== null && (
                          <span className={`absolute right-1 top-0 text-[9px] ${pct >= 80 ? "text-emerald-500" : pct >= 60 ? "text-blue-500" : pct >= 40 ? "text-orange-500" : "text-destructive"}`}>
                            {Math.round(pct)}%
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Total row */}
            <tr className="border-t-2 font-bold">
              <td className="py-2 px-3">合計</td>
              <td className="py-2 px-2 text-center text-muted-foreground">
                {examMaterial.subjects.reduce((s, subj) => s + subj.max_score, 0)}
              </td>
              {dates.map((d) => {
                const t = dateTotals[d];
                const pct = t && t.max > 0 ? (t.score / t.max) * 100 : 0;
                return (
                  <td key={d} className="py-2 px-2 text-center">
                    <div>{t?.score || 0}</div>
                    <div className={`text-[10px] font-normal ${pct >= 80 ? "text-emerald-500" : pct >= 60 ? "text-blue-500" : pct >= 40 ? "text-orange-500" : "text-destructive"}`}>
                      {Math.round(pct)}%
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={batchUpsert.isPending}>
          <Save className="mr-1.5 h-4 w-4" />
          {batchUpsert.isPending ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
