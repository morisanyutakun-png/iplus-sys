"use client";

import type { SubjectScoreDetail } from "@/lib/types";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "@/lib/recharts-imports";
import { TOOLTIP_STYLE, AXIS_TICK_STYLE, GRID_PROPS } from "@/lib/chart-config";

type Props = {
  subjects: SubjectScoreDetail[];
  title?: string;
};

export function SubjectScoreChart({ subjects, title }: Props) {
  const data = subjects.map((s) => ({
    name: s.subject_name,
    得点率: s.score != null ? Math.round((s.score / s.max_score) * 100) : 0,
    得点: s.score ?? 0,
    満点: s.max_score,
    目標: s.target_score != null ? Math.round((s.target_score / s.max_score) * 100) : null,
  }));

  return (
    <div>
      {title && <p className="text-sm font-medium mb-2">{title}</p>}
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
          formatter={(value: any, name: any) => {
              if (name === "得点率") return [`${value}%`, "得点率"];
              if (name === "目標") return [`${value}%`, "目標"];
              return [value, name];
            }}
            contentStyle={TOOLTIP_STYLE}
          />
          <Bar dataKey="得点率" fill="url(#score-gradient)" radius={[0, 6, 6, 0]} />
          {data.some((d) => d.目標 != null) && (
            <Bar dataKey="目標" fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" />
          )}
          <defs>
            <linearGradient id="score-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#f87171" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
