"use client";

import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend } from "@/lib/recharts-imports";
import { TOOLTIP_STYLE, SEMANTIC_COLORS } from "@/lib/chart-config";

type RadarDataPoint = {
  subject: string;
  得点率: number;
  目標?: number | null;
  平均?: number | null;
};

type Props = {
  data: RadarDataPoint[];
  showTarget?: boolean;
  showAverage?: boolean;
  title?: string;
};

export function SubjectRadarChart({ data, showTarget, showAverage, title }: Props) {
  if (data.length < 3) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        レーダーチャートの表示には3教科以上が必要です
      </div>
    );
  }

  return (
    <div>
      {title && <p className="text-sm font-medium mb-2">{title}</p>}
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="hsl(0 0% 85%)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: "hsl(0 0% 35%)" }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: "hsl(0 0% 55%)" }}
            tickFormatter={(v) => `${v}`}
          />
          <Radar
            name="得点率"
            dataKey="得点率"
            stroke={SEMANTIC_COLORS.primary}
            fill={SEMANTIC_COLORS.primary}
            fillOpacity={0.2}
            strokeWidth={2}
          />
          {showTarget && data.some((d) => d.目標 != null) && (
            <Radar
              name="目標"
              dataKey="目標"
              stroke={SEMANTIC_COLORS.warning}
              fill="none"
              strokeWidth={2}
              strokeDasharray="4 3"
            />
          )}
          {showAverage && data.some((d) => d.平均 != null) && (
            <Radar
              name="教室平均"
              dataKey="平均"
              stroke={SEMANTIC_COLORS.secondary}
              fill={SEMANTIC_COLORS.secondary}
              fillOpacity={0.08}
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          )}
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [`${Math.round(value)}%`, name]}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
