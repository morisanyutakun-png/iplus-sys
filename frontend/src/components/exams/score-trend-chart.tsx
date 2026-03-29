"use client";

import dynamic from "next/dynamic";
import type { ExamAttemptSummary } from "@/lib/types";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(
  () => import("recharts").then((m) => m.LineChart),
  { ssr: false }
);
const Line = dynamic(
  () => import("recharts").then((m) => m.Line),
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
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 91%)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "hsl(0 0% 45%)" }}
          tickFormatter={(v) => {
            const d = new Date(v);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "hsl(0 0% 45%)" }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          labelFormatter={(v) => new Date(v).toLocaleDateString("ja-JP")}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            if (name === "得点率") return [`${value}%`, "得点率"];
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
        <Line
          type="monotone"
          dataKey="得点率"
          stroke="#dc2626"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "#dc2626" }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
