"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "@/lib/recharts-imports";
import { TOOLTIP_STYLE, AXIS_TICK_STYLE, GRID_PROPS } from "@/lib/chart-config";

type Props = {
  weeklyDetail: Record<string, number>;
};

export function LearningPaceChart({ weeklyDetail }: Props) {
  const entries = Object.entries(weeklyDetail);
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        学習データがありません
      </div>
    );
  }

  // Sort by week key and format for display
  const data = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => {
      // Convert "2025-W10" to short label like "W10"
      const weekNum = week.split("-W")[1] || week;
      return { week: `W${weekNum}`, アクション数: count };
    });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="week" tick={AXIS_TICK_STYLE} />
        <YAxis tick={AXIS_TICK_STYLE} allowDecimals={false} />
        <Tooltip
          formatter={(v) => [`${v}件`, "アクション"]}
          contentStyle={TOOLTIP_STYLE}
        />
        <Area
          type="monotone"
          dataKey="アクション数"
          stroke="#dc2626"
          fill="url(#pace-gradient)"
          strokeWidth={2.5}
        />
        <defs>
          <linearGradient id="pace-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc2626" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#dc2626" stopOpacity={0.02} />
          </linearGradient>
        </defs>
      </AreaChart>
    </ResponsiveContainer>
  );
}
