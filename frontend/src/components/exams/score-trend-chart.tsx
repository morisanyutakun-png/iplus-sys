"use client";

import type { ExamAttemptSummary } from "@/lib/types";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "@/lib/recharts-imports";
import { TOOLTIP_STYLE, AXIS_TICK_STYLE, GRID_PROPS, SEMANTIC_COLORS } from "@/lib/chart-config";

type Props = {
  attempts: ExamAttemptSummary[];
};

export function ScoreTrendChart({ attempts }: Props) {
  const data = attempts.map((a) => ({
    date: a.attempt_date,
    得点率: a.percentage,
    合計点: a.total_score,
  }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        データがありません
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey="date"
          tick={AXIS_TICK_STYLE}
          tickFormatter={(v) => {
            const d = new Date(v);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          }}
        />
        <YAxis
          domain={[0, 100]}
          tick={AXIS_TICK_STYLE}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          labelFormatter={(v) => new Date(v).toLocaleDateString("ja-JP")}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            if (name === "得点率") return [`${value}%`, "得点率"];
            return [value, name];
          }}
          contentStyle={TOOLTIP_STYLE}
        />
        <Line
          type="monotone"
          dataKey="得点率"
          stroke={SEMANTIC_COLORS.primary}
          strokeWidth={2.5}
          dot={{ r: 4, fill: SEMANTIC_COLORS.primary }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
