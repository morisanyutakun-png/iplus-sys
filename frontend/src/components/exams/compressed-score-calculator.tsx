"use client";

import { useState } from "react";
import { useUniversityWeights } from "@/lib/queries/university-weights";
import { useCompressedScore } from "@/lib/queries/exam-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GraduationCap } from "lucide-react";

type Props = {
  studentId: string;
  examMaterialId?: number;
};

export function CompressedScoreCalculator({ studentId, examMaterialId }: Props) {
  const { data: weights } = useUniversityWeights();
  const [selectedWeightId, setSelectedWeightId] = useState<number>(0);

  const { data: result, isLoading } = useCompressedScore(
    studentId,
    selectedWeightId,
    examMaterialId
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium whitespace-nowrap">圧縮点プロファイル</label>
        <Select
          value={selectedWeightId ? String(selectedWeightId) : ""}
          onValueChange={(v) => setSelectedWeightId(Number(v))}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="プロファイルを選択" />
          </SelectTrigger>
          <SelectContent>
            {(weights || []).map((w) => (
              <SelectItem key={w.id} value={String(w.id)}>
                {w.name} ({w.university} {w.faculty})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && selectedWeightId > 0 && (
        <div className="h-32 rounded-xl skeleton-pulse" />
      )}

      {result && (
        <Card className="border-0 shadow-premium">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                {result.university} {result.faculty}
              </CardTitle>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {result.total_compressed}
                  <span className="text-sm text-muted-foreground font-normal">
                    /{result.total_compressed_max}
                  </span>
                </div>
                <Badge
                  variant={result.percentage >= 80 ? "default" : result.percentage >= 60 ? "secondary" : "destructive"}
                >
                  {result.percentage}%
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {result.subjects.map((s) => {
                const pct = s.compressed_max > 0 ? (s.compressed_score / s.compressed_max) * 100 : 0;
                return (
                  <div key={s.subject_name} className="flex items-center gap-3 text-sm">
                    <span className="w-20 text-muted-foreground shrink-0">
                      {s.subject_name}
                    </span>
                    <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 80
                            ? "bg-emerald-500"
                            : pct >= 60
                            ? "bg-blue-500"
                            : pct >= 40
                            ? "bg-orange-500"
                            : "bg-destructive"
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="w-24 text-right tabular-nums">
                      {s.compressed_score}/{s.compressed_max}
                    </span>
                    <span className="w-12 text-right text-xs text-muted-foreground">
                      ({s.raw_score}/{s.original_max})
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedWeightId && (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          プロファイルを選択すると圧縮点が計算されます
        </div>
      )}
    </div>
  );
}
