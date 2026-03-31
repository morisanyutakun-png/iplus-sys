"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceArea } from "@/lib/recharts-imports";
import { TOOLTIP_STYLE, AXIS_TICK_STYLE, GRID_PROPS, CHART_COLORS, SEMANTIC_COLORS } from "@/lib/chart-config";

type AccuracyEntry = {
  date: string;
  material_key: string;
  material_name: string;
  accuracy_rate: number;
};

type Props = {
  data: AccuracyEntry[];
};

export function AccuracyTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        正答率データがありません
      </div>
    );
  }

  // Group by date, with one line per material
  const materials = [...new Set(data.map((d) => d.material_name))].slice(0, 6);
  const dates = [...new Set(data.map((d) => d.date))].sort();

  const chartData = dates.map((date) => {
    const row: Record<string, string | number> = { date: date.slice(5) }; // MM-DD
    for (const mat of materials) {
      const entry = data.find((d) => d.date === date && d.material_name === mat);
      if (entry) {
        row[mat] = Math.round(entry.accuracy_rate * 100);
      }
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="date" tick={AXIS_TICK_STYLE} />
        <YAxis domain={[0, 100]} tick={AXIS_TICK_STYLE} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [`${value}%`, name]}
        />
        <ReferenceArea
          y1={70}
          y2={80}
          fill={SEMANTIC_COLORS.success}
          fillOpacity={0.1}
        />
        <ReferenceLine
          y={60}
          stroke={SEMANTIC_COLORS.danger}
          strokeDasharray="4 3"
          label={{ value: "60%", position: "right", fontSize: 10, fill: SEMANTIC_COLORS.danger }}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          formatter={(value) => <span className="text-xs">{value}</span>}
        />
        {materials.map((mat, i) => (
          <Line
            key={mat}
            type="monotone"
            dataKey={mat}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
