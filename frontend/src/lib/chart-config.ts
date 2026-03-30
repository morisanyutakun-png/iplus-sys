/** Shared chart design tokens for consistent visualization styling */
import type React from "react";

// Brand-aligned categorical color palette (8 colors)
export const CHART_COLORS = [
  "#dc2626", // red-600 (primary)
  "#2563eb", // blue-600
  "#16a34a", // green-600
  "#d97706", // amber-600
  "#7c3aed", // violet-600
  "#0891b2", // cyan-600
  "#db2777", // pink-600
  "#65a30d", // lime-600
] as const;

// Semantic colors for specific data meanings
export const SEMANTIC_COLORS = {
  primary: "#dc2626",
  secondary: "#2563eb",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  muted: "hsl(0 0% 45%)",
} as const;

// Gradient definitions for chart fills
export const CHART_GRADIENTS = {
  primary: { id: "primary-gradient", start: "#dc2626", end: "#f87171" },
  blue: { id: "blue-gradient", start: "#1e40af", end: "#3b82f6" },
  area: { id: "area-gradient", start: "#dc2626", startOpacity: 0.25, end: "#dc2626", endOpacity: 0.02 },
  success: { id: "success-gradient", start: "#059669", end: "#10b981" },
} as const;

// Common tooltip contentStyle (used in all chart tooltips)
export const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: "12px",
  border: "none",
  boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
  fontSize: "13px",
  padding: "10px 14px",
};

// Common axis tick style
export const AXIS_TICK_STYLE = {
  fontSize: 11,
  fill: "hsl(0 0% 45%)",
} as const;

// Common CartesianGrid props
export const GRID_PROPS = {
  strokeDasharray: "3 3",
  stroke: "hsl(0 0% 91%)",
} as const;

// Progress bracket colors (for histograms / progress bars)
export const BRACKET_COLORS = {
  low: "#ef4444",     // 0-25%  red
  mid: "#f59e0b",     // 25-50% amber
  good: "#3b82f6",    // 50-75% blue
  high: "#10b981",    // 75-100% green
} as const;

export function getBracketColor(percent: number): string {
  if (percent >= 75) return BRACKET_COLORS.high;
  if (percent >= 50) return BRACKET_COLORS.good;
  if (percent >= 25) return BRACKET_COLORS.mid;
  return BRACKET_COLORS.low;
}
