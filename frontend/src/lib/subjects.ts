// ── 高校カリキュラム教科マスター定義 ──
// アプリ全体で教科選択に使う唯一の定義。自由入力は不可。

export interface SubjectGroup {
  label: string;
  subjects: string[];
}

// 教科グループ（UI表示用）
export const SUBJECT_GROUPS: SubjectGroup[] = [
  {
    label: "英語",
    subjects: ["英語R", "英語L", "英語"],
  },
  {
    label: "国語",
    subjects: ["現代文", "古文", "漢文", "国語"],
  },
  {
    label: "数学",
    subjects: ["数学IA", "数学IIB", "数学IIIC", "数学"],
  },
  {
    label: "理科",
    subjects: [
      "物理基礎", "物理",
      "化学基礎", "化学",
      "生物基礎", "生物",
      "地学基礎", "地学",
    ],
  },
  {
    label: "社会",
    subjects: [
      "日本史", "世界史", "地理",
      "政治経済", "倫理", "倫理政経", "現代社会", "公共",
    ],
  },
  {
    label: "情報",
    subjects: ["情報I"],
  },
];

// 全教科フラットリスト（ソート順を保持）
export const ALL_SUBJECTS: string[] = SUBJECT_GROUPS.flatMap((g) => g.subjects);

// 教科 → グループラベル のマップ
export const SUBJECT_TO_GROUP: Record<string, string> = {};
for (const g of SUBJECT_GROUPS) {
  for (const s of g.subjects) {
    SUBJECT_TO_GROUP[s] = g.label;
  }
}

// ── 定着度スプレッドシート用ソートキー ──
export function getSubjectSortIndex(subject: string): number {
  const idx = ALL_SUBJECTS.indexOf(subject);
  return idx >= 0 ? idx : ALL_SUBJECTS.length;
}

// ── ヘッダー色マッピング（教科グループ単位） ──
const GROUP_HEADER_COLORS: Record<string, string> = {
  "英語": "bg-rose-700",
  "国語": "bg-red-700",
  "数学": "bg-blue-700",
  "理科": "bg-emerald-700",
  "社会": "bg-amber-700",
  "情報": "bg-cyan-700",
};

const GROUP_WORD_TEST_COLORS: Record<string, string> = {
  "英語": "bg-rose-600",
  "国語": "bg-red-600",
  "数学": "bg-blue-600",
  "理科": "bg-emerald-600",
  "社会": "bg-amber-600",
  "情報": "bg-cyan-600",
};

export function getSubjectHeaderColor(subject: string): string {
  const group = SUBJECT_TO_GROUP[subject];
  return GROUP_HEADER_COLORS[group] ?? "bg-gray-800";
}

export function getWordTestHeaderColor(subject: string): string {
  const group = SUBJECT_TO_GROUP[subject];
  return GROUP_WORD_TEST_COLORS[group] ?? "bg-slate-700";
}

export const EXAM_HEADER_COLOR = "bg-violet-700";

// ── 共通テストデフォルト科目 ──
export const COMMON_TEST_SUBJECTS = [
  { subject_name: "英語R", max_score: 100 },
  { subject_name: "英語L", max_score: 100 },
  { subject_name: "数学IA", max_score: 100 },
  { subject_name: "数学IIB", max_score: 100 },
  { subject_name: "国語", max_score: 200 },
  { subject_name: "物理", max_score: 100 },
  { subject_name: "化学", max_score: 100 },
  { subject_name: "生物", max_score: 100 },
  { subject_name: "地学", max_score: 100 },
  { subject_name: "日本史", max_score: 100 },
  { subject_name: "世界史", max_score: 100 },
  { subject_name: "地理", max_score: 100 },
  { subject_name: "政治経済", max_score: 100 },
  { subject_name: "倫理", max_score: 100 },
  { subject_name: "現代社会", max_score: 100 },
  { subject_name: "倫理政経", max_score: 100 },
  { subject_name: "情報I", max_score: 100 },
];

// ── 教材管理ページ用：グループ単位のカラー設定 ──
export const SUBJECT_GROUP_STYLES: Record<string, { gradient: string; badge: string; border: string; dot: string }> = {
  "英語": { gradient: "from-rose-500 to-red-600", badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800", dot: "bg-rose-500" },
  "国語": { gradient: "from-red-500 to-red-600", badge: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300", border: "border-red-200 dark:border-red-800", dot: "bg-red-500" },
  "数学": { gradient: "from-blue-500 to-indigo-600", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800", dot: "bg-blue-500" },
  "理科": { gradient: "from-emerald-500 to-green-600", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" },
  "社会": { gradient: "from-amber-500 to-orange-600", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500" },
  "情報": { gradient: "from-cyan-500 to-teal-600", badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800", dot: "bg-cyan-500" },
};

export function getSubjectGroupStyle(subject: string) {
  const group = SUBJECT_TO_GROUP[subject] ?? "";
  return SUBJECT_GROUP_STYLES[group] ?? {
    gradient: "from-gray-500 to-gray-600",
    badge: "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300",
    border: "border-gray-200 dark:border-gray-800",
    dot: "bg-gray-500",
  };
}
