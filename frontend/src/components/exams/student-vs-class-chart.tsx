"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "@/lib/recharts-imports";
import { TOOLTIP_STYLE, AXIS_TICK_STYLE, GRID_PROPS, SEMANTIC_COLORS } from "@/lib/chart-config";
import type { SubjectScoreDetail, SubjectAverageItem } from "@/lib/types";

type Props = {
  studentSubjects: SubjectScoreDetail[];
  classAverages: SubjectAverageItem[];
};

export function StudentVsClassChart({ studentSubjects, classAverages }: Props) {
  const avgMap = new Map(classAverages.map((a) => [a.subject_name, a.avg_percentage]));

  const data = studentSubjects
    .filter((s) => s.score != null)
    .map((s) => ({
      name: s.subject_name,
      個人: Math.round((s.score! / s.max_score) * 100),
      教室平均: avgMap.get(s.subject_name) ?? 0,
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        データがありません
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey="name"
          tick={AXIS_TICK_STYLE}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis
          domain={[0, 100]}
          tick={AXIS_TICK_STYLE}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [`${value}%`, name]}
          contentStyle={TOOLTIP_STYLE}
        />
        <Legend
          verticalAlign="top"
          iconType="circle"
          formatter={(value) => <span className="text-xs">{value}</span>}
        />
        <Bar dataKey="個人" fill={SEMANTIC_COLORS.primary} radius={[4, 4, 0, 0]} barSize={20} />
        <Bar dataKey="教室平均" fill={SEMANTIC_COLORS.secondary} radius={[4, 4, 0, 0]} barSize={20} opacity={0.7} />
      </BarChart>
    </ResponsiveContainer>
  );
}
