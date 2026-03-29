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
const Cell = dynamic(
  () => import("recharts").then((m) => m.Cell),
  { ssr: false }
);
const ReferenceLine = dynamic(
  () => import("recharts").then((m) => m.ReferenceLine),
  { ssr: false }
);

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
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 91%)" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "hsl(0 0% 45%)" }}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis tick={{ fontSize: 11, fill: "hsl(0 0% 45%)" }} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            if (name === "差分") return [`${value > 0 ? "+" : ""}${value}点`, "目標との差"];
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
        <ReferenceLine y={0} stroke="hsl(0 0% 60%)" strokeDasharray="3 3" />
        <Bar dataKey="差分" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.差分 >= 0 ? "#10b981" : "#ef4444"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
