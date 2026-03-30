"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "@/lib/recharts-imports";
import { TOOLTIP_STYLE, AXIS_TICK_STYLE, GRID_PROPS, getBracketColor } from "@/lib/chart-config";

type Props = {
  percentages: number[];
};

export function ScoreDistributionChart({ percentages }: Props) {
  if (percentages.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        データがありません
      </div>
    );
  }

  // Build 10% bracket histogram
  const brackets = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}-${(i + 1) * 10}%`,
    min: i * 10,
    count: 0,
  }));

  percentages.forEach((p) => {
    const idx = Math.min(Math.floor(p / 10), 9);
    brackets[idx].count++;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={brackets} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid {...GRID_PROPS} horizontal vertical={false} />
        <XAxis dataKey="range" tick={{ ...AXIS_TICK_STYLE, fontSize: 10 }} interval={0} />
        <YAxis tick={AXIS_TICK_STYLE} allowDecimals={false} />
        <Tooltip
          formatter={(v) => [`${v}人`, "生徒数"]}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={28}>
          {brackets.map((entry, i) => (
            <Cell key={i} fill={getBracketColor(entry.min + 5)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
