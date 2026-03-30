"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "@/lib/recharts-imports";
import { TOOLTIP_STYLE, AXIS_TICK_STYLE, GRID_PROPS, SEMANTIC_COLORS } from "@/lib/chart-config";
import type { SubjectAverageItem } from "@/lib/types";

type Props = {
  subjectAverages: SubjectAverageItem[];
  classAveragePercentage: number;
};

export function ClassSubjectChart({ subjectAverages, classAveragePercentage }: Props) {
  if (subjectAverages.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        データがありません
      </div>
    );
  }

  const data = subjectAverages.map((sa) => ({
    name: sa.subject_name,
    平均得点率: sa.avg_percentage,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={AXIS_TICK_STYLE}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          dataKey="name"
          type="category"
          tick={AXIS_TICK_STYLE}
          width={70}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`${value}%`, "平均得点率"]}
          contentStyle={TOOLTIP_STYLE}
        />
        <ReferenceLine
          x={classAveragePercentage}
          stroke={SEMANTIC_COLORS.warning}
          strokeDasharray="4 3"
          label={{ value: `全体${classAveragePercentage}%`, position: "top", fontSize: 10, fill: SEMANTIC_COLORS.warning }}
        />
        <Bar dataKey="平均得点率" fill="url(#class-subj-gradient)" radius={[0, 6, 6, 0]} />
        <defs>
          <linearGradient id="class-subj-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1e40af" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  );
}
