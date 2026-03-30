"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "@/lib/recharts-imports";
import { TOOLTIP_STYLE, AXIS_TICK_STYLE, GRID_PROPS, CHART_COLORS } from "@/lib/chart-config";

type TimelineEntry = {
  date: string;
  material_key: string;
  action: string;
  old_pointer?: number;
  new_pointer?: number;
};

type CompletionRate = {
  material_key: string;
  material_name: string;
  total_nodes: number;
};

type Props = {
  timeline: TimelineEntry[];
  completionRates: CompletionRate[];
};

export function ProgressTimelineChart({ timeline, completionRates }: Props) {
  if (timeline.length === 0 || completionRates.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        進捗データがありません
      </div>
    );
  }

  // Build material info map
  const matInfo = new Map(completionRates.map((c) => [c.material_key, c]));

  // Build cumulative progress per material per date
  // Track current pointer per material
  const pointerState = new Map<string, number>();
  const dateMap = new Map<string, Map<string, number>>();

  for (const entry of timeline) {
    const info = matInfo.get(entry.material_key);
    if (!info || info.total_nodes === 0) continue;

    // Update pointer state
    if (entry.new_pointer != null) {
      pointerState.set(entry.material_key, entry.new_pointer);
    }

    const dateKey = entry.date.split("T")[0];
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, new Map());
    }
    // Snapshot all materials at this date
    const dayData = dateMap.get(dateKey)!;
    for (const [mk, ptr] of pointerState) {
      const mi = matInfo.get(mk);
      if (mi) {
        dayData.set(mk, Math.min(((ptr - 1) / mi.total_nodes) * 100, 100));
      }
    }
  }

  // Get unique material keys that have data
  const materialKeys = [...new Set(timeline.map((t) => t.material_key))].filter(
    (k) => matInfo.has(k) && (matInfo.get(k)?.total_nodes ?? 0) > 0
  );

  if (materialKeys.length === 0) return null;

  // Convert to chart data array
  const sortedDates = [...dateMap.keys()].sort();
  const data = sortedDates.map((date) => {
    const dayData = dateMap.get(date)!;
    const row: Record<string, string | number> = {
      date: date.slice(5), // MM-DD
    };
    for (const mk of materialKeys) {
      const name = matInfo.get(mk)?.material_name || mk;
      row[name] = Math.round(dayData.get(mk) ?? 0);
    }
    return row;
  });

  // Limit to max 6 materials for readability
  const displayMaterials = materialKeys.slice(0, 6);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="date" tick={AXIS_TICK_STYLE} />
        <YAxis domain={[0, 100]} tick={AXIS_TICK_STYLE} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [`${value}%`, name]}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          formatter={(value) => <span className="text-xs">{value}</span>}
        />
        {displayMaterials.map((mk, i) => {
          const name = matInfo.get(mk)?.material_name || mk;
          return (
            <Line
              key={mk}
              type="monotone"
              dataKey={name}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
