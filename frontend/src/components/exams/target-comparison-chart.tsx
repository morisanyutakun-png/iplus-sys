"use client";

import type { SubjectScoreDetail } from "@/lib/types";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ReferenceLine } from "@/lib/recharts-imports";
import { TOOLTIP_STYLE, AXIS_TICK_STYLE, GRID_PROPS, SEMANTIC_COLORS } from "@/lib/chart-config";

type Props = {
  subjects: SubjectScoreDetail[];
};

export function TargetComparisonChart({ subjects }: Props) {
  const data = subjects
    .filter((s) => s.target_score != null && s.score != null)
    .map((s) => ({
      name: s.subject_name,
      差分: Math.round((s.score! - s.target_score!) * 10) / 10,
      実点: s.score,
      目標: s.target_score,
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        目標点が設定されていないか、スコアがありません
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey="name"
          tick={AXIS_TICK_STYLE}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis tick={AXIS_TICK_STYLE} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            if (name === "差分") return [`${value > 0 ? "+" : ""}${value}点`, "目標との差"];
            return [value, name];
          }}
          contentStyle={TOOLTIP_STYLE}
        />
        <ReferenceLine y={0} stroke="hsl(0 0% 60%)" strokeDasharray="3 3" />
        <Bar dataKey="差分" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.差分 >= 0 ? SEMANTIC_COLORS.success : SEMANTIC_COLORS.danger}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
