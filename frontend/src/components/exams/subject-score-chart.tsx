"use client";

import dynamic from "next/dynamic";
import type { SubjectScoreDetail } from "@/lib/types";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false }
);
const Bar = dynamic(
  () => import("recharts").then((m) => m.Bar),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((m) => m.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((m) => m.YAxis),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((m) => m.Tooltip),
  { ssr: false }
);
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false }
);
const ReferenceLine = dynamic(
  () => import("recharts").then((m) => m.ReferenceLine),
  { ssr: false }
);

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
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 91%)" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "hsl(0 0% 45%)" }}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: 11, fill: "hsl(0 0% 45%)" }}
            width={70}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
              if (name === "得点率") return [`${value}%`, "得点率"];
              if (name === "目標") return [`${value}%`, "目標"];
              return [value, name];
            }}
            contentStyle={{
              borderRadius: "12px",
              border: "none",
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
              fontSize: "13px",
              padding: "10px 14px",
            }}
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
