/**
 * Centralized dynamic Recharts imports (SSR-safe).
 * Import from here instead of declaring dynamic() in every chart file.
 */
import dynamic from "next/dynamic";

// Layout
export const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);

// Bar charts
export const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false }
);
export const Bar = dynamic(
  () => import("recharts").then((m) => m.Bar),
  { ssr: false }
);

// Line charts
export const LineChart = dynamic(
  () => import("recharts").then((m) => m.LineChart),
  { ssr: false }
);
export const Line = dynamic(
  () => import("recharts").then((m) => m.Line),
  { ssr: false }
);

// Area charts
export const AreaChart = dynamic(
  () => import("recharts").then((m) => m.AreaChart),
  { ssr: false }
);
export const Area = dynamic(
  () => import("recharts").then((m) => m.Area),
  { ssr: false }
);

// Pie charts
export const PieChart = dynamic(
  () => import("recharts").then((m) => m.PieChart),
  { ssr: false }
);
export const Pie = dynamic(
  () => import("recharts").then((m) => m.Pie),
  { ssr: false }
);

// Radar charts
export const RadarChart = dynamic(
  () => import("recharts").then((m) => m.RadarChart),
  { ssr: false }
);
export const Radar = dynamic(
  () => import("recharts").then((m) => m.Radar),
  { ssr: false }
);
export const PolarGrid = dynamic(
  () => import("recharts").then((m) => m.PolarGrid),
  { ssr: false }
);
export const PolarAngleAxis = dynamic(
  () => import("recharts").then((m) => m.PolarAngleAxis),
  { ssr: false }
);
export const PolarRadiusAxis = dynamic(
  () => import("recharts").then((m) => m.PolarRadiusAxis),
  { ssr: false }
);

// Shared components
export const XAxis = dynamic(
  () => import("recharts").then((m) => m.XAxis),
  { ssr: false }
);
export const YAxis = dynamic(
  () => import("recharts").then((m) => m.YAxis),
  { ssr: false }
);
export const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false }
);
export const Tooltip = dynamic(
  () => import("recharts").then((m) => m.Tooltip),
  { ssr: false }
);
export const Legend = dynamic(
  () => import("recharts").then((m) => m.Legend),
  { ssr: false }
);
export const Cell = dynamic(
  () => import("recharts").then((m) => m.Cell),
  { ssr: false }
);
export const ReferenceLine = dynamic(
  () => import("recharts").then((m) => m.ReferenceLine),
  { ssr: false }
);
export const ReferenceArea = dynamic(
  () => import("recharts").then((m) => m.ReferenceArea),
  { ssr: false }
);
