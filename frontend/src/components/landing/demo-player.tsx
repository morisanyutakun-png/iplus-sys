"use client";

import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Printer,
  FileText,
  UserCheck,
  Shield,
  Languages,
  ClipboardCheck,
  BarChart3,
  Plus,
  Pause,
  Play,
  RotateCcw,
  ChevronRight,
  Eye,
  Trash2,
  Upload,
  Check,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ExternalLink,
  Calculator,
} from "lucide-react";

type Scene = {
  id: "dashboard" | "mastery" | "assign" | "exam" | "print";
  page: string;
  title: string;
  subtitle: string;
  durationMs: number;
};

const SCENES: Scene[] = [
  {
    id: "dashboard",
    page: "/dashboard",
    title: "1. ダッシュボードで今日を把握",
    subtitle: "完了間近・正答率低下の生徒に自動で印が立つ",
    durationMs: 6000,
  },
  {
    id: "mastery",
    page: "/students",
    title: "2. 定着度を入れて、進捗を進める",
    subtitle: "表に点数を入れる → 合格にチェック → 次の章へ自動進行",
    durationMs: 6500,
  },
  {
    id: "assign",
    page: "/students",
    title: "3. 教材を割り当て・PDFを確認",
    subtitle: "円形プログレスでどこまで進んだかひと目で",
    durationMs: 5500,
  },
  {
    id: "exam",
    page: "/exams",
    title: "4. 試験成績を多角的に分析",
    subtitle: "レーダー・推移・圧縮スコアで合格力を見える化",
    durationMs: 6000,
  },
  {
    id: "print",
    page: "/print",
    title: "5. その生徒だけ、まとめて印刷",
    subtitle: "問題と解答を1つのPDFに結合してプリンタへ",
    durationMs: 6000,
  },
];

const TOTAL_MS = SCENES.reduce((a, s) => a + s.durationMs, 0);

const STUDENT = { name: "田中 太郎", grade: "高3", initial: "田" };

export function DemoPlayer() {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [elapsedInScene, setElapsedInScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  const lastTickRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    const tick = (now: number) => {
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setElapsedInScene((prev) => {
        const next = prev + delta;
        const cur = SCENES[sceneIdx];
        if (next >= cur.durationMs) {
          setSceneIdx((i) => (i + 1) % SCENES.length);
          return 0;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    lastTickRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, sceneIdx]);

  const scene = SCENES[sceneIdx];
  const sceneProgress = elapsedInScene / scene.durationMs;
  const totalElapsed =
    SCENES.slice(0, sceneIdx).reduce((a, s) => a + s.durationMs, 0) + elapsedInScene;
  const totalProgress = totalElapsed / TOTAL_MS;

  const goToScene = (idx: number) => {
    setSceneIdx(idx);
    setElapsedInScene(0);
  };

  const restart = () => {
    setSceneIdx(0);
    setElapsedInScene(0);
    setPlaying(true);
  };

  return (
    <div className="relative">
      <div className="rounded-2xl bg-zinc-900 shadow-2xl ring-1 ring-zinc-800/50 overflow-hidden">
        {/* Browser title bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-zinc-800 rounded-md px-3 py-1 text-xs text-zinc-400 inline-flex items-center gap-2 max-w-md">
              <span className="text-zinc-500">https://</span>
              <span>iplus-sys.app</span>
              <span className="text-zinc-500">{scene.page}</span>
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">
            {Math.round(totalProgress * 100)}%
          </div>
        </div>

        {/* App body */}
        <div className="flex h-[480px] sm:h-[540px] bg-white">
          {/* Sidebar (matches actual 8 items) */}
          <aside className="hidden md:flex w-44 lg:w-52 flex-col bg-zinc-950 text-zinc-200 py-4 px-3 gap-0.5 text-xs flex-shrink-0">
            <div className="flex items-center gap-2 px-2 py-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm">
                i+
              </div>
              <span className="font-bold text-sm">iPlus Sys</span>
            </div>
            <NavItem icon={<LayoutDashboard className="w-3.5 h-3.5" />} label="ダッシュボード" active={scene.id === "dashboard"} />
            <NavItem icon={<Users className="w-3.5 h-3.5" />} label="生徒" active={scene.id === "mastery" || scene.id === "assign"} />
            <NavItem icon={<BookOpen className="w-3.5 h-3.5" />} label="教材管理" />
            <NavItem icon={<Languages className="w-3.5 h-3.5" />} label="単語テスト" />
            <NavItem icon={<FileText className="w-3.5 h-3.5" />} label="試験管理" active={scene.id === "exam"} />
            <NavItem icon={<Printer className="w-3.5 h-3.5" />} label="印刷" active={scene.id === "print"} />
            <NavItem icon={<UserCheck className="w-3.5 h-3.5" />} label="講師管理" />
            <NavItem icon={<Shield className="w-3.5 h-3.5" />} label="アカウント管理" />
          </aside>

          {/* Main */}
          <main className="flex-1 overflow-hidden relative bg-zinc-50">
            <SceneDashboard visible={scene.id === "dashboard"} progress={sceneProgress} />
            <SceneMastery visible={scene.id === "mastery"} progress={sceneProgress} />
            <SceneAssign visible={scene.id === "assign"} progress={sceneProgress} />
            <SceneExam visible={scene.id === "exam"} progress={sceneProgress} />
            <ScenePrint visible={scene.id === "print"} progress={sceneProgress} />
          </main>
        </div>

        <div className="h-1 bg-zinc-800 relative">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500 to-red-500 transition-[width] duration-100"
            style={{ width: `${totalProgress * 100}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {SCENES.map((s, i) => {
            const isCur = i === sceneIdx;
            const isDone = i < sceneIdx;
            return (
              <button
                key={s.id}
                onClick={() => goToScene(i)}
                className={`text-[11px] sm:text-xs font-medium rounded-full px-3 py-1.5 transition-all ${
                  isCur
                    ? "bg-zinc-900 text-white shadow-md"
                    : isDone
                    ? "bg-zinc-200 text-zinc-700"
                    : "bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                {s.title}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="rounded-full w-9 h-9 inline-flex items-center justify-center bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition"
            aria-label={playing ? "一時停止" : "再生"}
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            onClick={restart}
            className="rounded-full w-9 h-9 inline-flex items-center justify-center bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition"
            aria-label="最初から"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-zinc-900 text-white px-4 py-3 flex items-start gap-3">
        <div className="rounded-full bg-orange-500/20 text-orange-400 w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {sceneIdx + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{scene.title}</div>
          <div className="text-xs text-zinc-400 mt-0.5">{scene.subtitle}</div>
        </div>
        <div className="text-[10px] text-zinc-500 font-mono hidden sm:block">{scene.page}</div>
      </div>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all ${
        active ? "bg-gradient-to-r from-orange-600/30 to-red-600/30 text-white" : "text-zinc-400"
      }`}
    >
      <span className={active ? "text-orange-400" : ""}>{icon}</span>
      <span className="text-[11px]">{label}</span>
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400" />}
    </div>
  );
}

function SceneWrapper({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute inset-0 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!visible}
    >
      {children}
    </div>
  );
}

/* ============================================================
   SCENE 1 — ダッシュボード
   実画面：KPI3枚＋完了間近リマインド＋正答率低下リマインド＋週間推移グラフ
   ============================================================ */
function SceneDashboard({ visible, progress }: { visible: boolean; progress: number }) {
  // Phase: 0..0.4 view, 0.4..0.55 cursor moves to acknowledge, 0.55..0.7 click, 0.7..1 row dimmed + jump hint
  const ackClicked = progress > 0.55 && progress < 0.7;
  const ackDone = progress > 0.65;
  const cursorActive = progress > 0.3 && progress < 0.7;

  return (
    <SceneWrapper visible={visible}>
      <div className="p-4 sm:p-5 h-full overflow-hidden relative">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg sm:text-xl font-bold text-zinc-900">ダッシュボード</h1>
          <div className="text-[10px] text-zinc-500">2026-04-28 月曜日</div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
          <DashKpi
            label="生徒数"
            sub="登録済み生徒"
            value="48"
            icon={<Users className="w-3.5 h-3.5" />}
            from="from-rose-500"
            to="to-red-600"
          />
          <DashKpi
            label="教材数"
            sub="登録済み教材"
            value="22"
            icon={<BookOpen className="w-3.5 h-3.5" />}
            from="from-zinc-700"
            to="to-zinc-900"
          />
          <DashKpi
            label="今週の学習"
            sub="先週比 +18%"
            value="312"
            trend="up"
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            from="from-orange-500"
            to="to-red-600"
          />
        </div>

        {/* Reminder: 完了間近 */}
        <div className="rounded-lg bg-white border border-amber-200 mb-2 overflow-hidden">
          <div className="bg-amber-50 px-3 py-1.5 border-b border-amber-100 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[11px] font-semibold text-amber-900">完了間近リマインド</span>
            <span className="text-[10px] text-amber-700 ml-1">残り1〜2回で教材完了の生徒</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-medium">
              {ackDone ? "1" : "2"} 件
            </span>
          </div>
          <ReminderRow
            initial="佐"
            name="佐藤 花子"
            material="システム英単語"
            badge="残り 1"
            pct={94}
            color="rose"
            acknowledged={ackDone}
            ackPulse={ackClicked}
          />
          <ReminderRow
            initial="鈴"
            name="鈴木 あい"
            material="基礎問題精講 IA"
            badge="残り 2"
            pct={88}
            color="amber"
          />
        </div>

        {/* Reminder: 正答率低下 */}
        <div className="rounded-lg bg-white border border-rose-200 overflow-hidden">
          <div className="bg-rose-50 px-3 py-1.5 border-b border-rose-100 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            <span className="text-[11px] font-semibold text-rose-900">正答率低下リマインド</span>
            <span className="text-[10px] text-rose-700 ml-1">2回以上連続で60%未満</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-rose-200 text-rose-900 font-medium">
              1 件
            </span>
          </div>
          <ReminderRow
            initial="高"
            name="高橋 美咲"
            material="青チャート IIB · 第3章"
            badge="2回連続 · 直近 52%"
            color="rose"
            danger
          />
        </div>

        {/* Mini week trend */}
        <div className="mt-2 rounded-lg bg-white border border-zinc-200 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-[11px] font-semibold text-zinc-800">週間アクティビティ推移</span>
            <span className="ml-auto text-[10px] text-zinc-500">過去8週</span>
          </div>
          <div className="flex items-end gap-1 h-10">
            {[28, 35, 32, 41, 38, 45, 52, 60].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end">
                <div
                  className="rounded-sm bg-gradient-to-t from-rose-500 to-rose-400"
                  style={{
                    height: visible ? `${h}%` : "0%",
                    transition: `height 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 50}ms`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Cursor toward 1st reminder ack button */}
        {cursorActive && (
          <div
            className="absolute pointer-events-none"
            style={{
              right: `${5 + (1 - Math.min(0.9, progress * 1.4)) * 12}%`,
              top: `${42 + Math.min(0.9, progress * 1.4) * 4}%`,
              transition: "right 1.0s cubic-bezier(0.4,0,0.2,1), top 1.0s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <CursorIcon clicking={ackClicked} />
          </div>
        )}

        {ackDone && progress < 0.95 && (
          <Toast message="対処済みにしました（取消もできます）" />
        )}
      </div>
    </SceneWrapper>
  );
}

function DashKpi({
  label,
  sub,
  value,
  icon,
  trend,
  from,
  to,
}: {
  label: string;
  sub: string;
  value: string;
  icon: React.ReactNode;
  trend?: "up" | "down";
  from: string;
  to: string;
}) {
  return (
    <div className="rounded-lg bg-white border border-zinc-200 p-2.5 relative overflow-hidden">
      <div className={`absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r ${from} ${to}`} />
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`inline-flex w-5 h-5 rounded items-center justify-center text-white bg-gradient-to-br ${from} ${to}`}>
          {icon}
        </span>
        <span className="text-[10px] text-zinc-600 font-medium">{label}</span>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-zinc-900 tabular-nums leading-none">
        {value}
      </div>
      <div className={`text-[10px] mt-0.5 inline-flex items-center gap-0.5 ${trend === "up" ? "text-emerald-600 font-medium" : "text-zinc-500"}`}>
        {trend === "up" && <TrendingUp className="w-2.5 h-2.5" />}
        {trend === "down" && <TrendingDown className="w-2.5 h-2.5" />}
        {sub}
      </div>
    </div>
  );
}

function ReminderRow({
  initial,
  name,
  material,
  badge,
  pct,
  color,
  acknowledged,
  ackPulse,
  danger,
}: {
  initial: string;
  name: string;
  material: string;
  badge: string;
  pct?: number;
  color: "rose" | "amber";
  acknowledged?: boolean;
  ackPulse?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 text-[11px] transition-all ${
        acknowledged ? "opacity-40" : ""
      }`}
    >
      <button
        className={`w-4 h-4 rounded-full border-2 inline-flex items-center justify-center transition-all flex-shrink-0 ${
          acknowledged
            ? "bg-emerald-500 border-emerald-500"
            : "bg-white border-zinc-300"
        } ${ackPulse ? "ring-2 ring-emerald-300 ring-offset-1 scale-110" : ""}`}
      >
        {acknowledged && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      </button>
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${
          color === "rose"
            ? "bg-gradient-to-br from-rose-500 to-red-600"
            : "bg-gradient-to-br from-amber-500 to-orange-600"
        }`}
      >
        {initial}
      </span>
      <span className={`font-medium text-zinc-800 ${acknowledged ? "line-through" : ""}`}>
        {name}
      </span>
      <span className="text-zinc-400">·</span>
      <span className="text-zinc-600 truncate">{material}</span>
      <span
        className={`ml-auto text-[9px] px-1.5 py-0.5 rounded border ${
          danger
            ? "bg-rose-50 border-rose-200 text-rose-700"
            : color === "rose"
            ? "bg-rose-50 border-rose-200 text-rose-700"
            : "bg-amber-50 border-amber-200 text-amber-700"
        }`}
      >
        {badge}
      </span>
      {pct !== undefined && (
        <span className="w-7 h-7 relative inline-flex items-center justify-center flex-shrink-0">
          <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90">
            <circle cx="14" cy="14" r="11" stroke="rgb(228 228 231)" strokeWidth="2.5" fill="none" />
            <circle
              cx="14"
              cy="14"
              r="11"
              className={color === "rose" ? "stroke-rose-500" : "stroke-amber-500"}
              strokeWidth="2.5"
              fill="none"
              strokeDasharray={`${(pct / 100) * 69} 69`}
              strokeLinecap="round"
            />
          </svg>
          <span className={`absolute text-[8px] font-bold ${color === "rose" ? "text-rose-700" : "text-amber-700"}`}>
            {pct}
          </span>
        </span>
      )}
      <ExternalLink className="w-3 h-3 text-zinc-300 flex-shrink-0" />
    </div>
  );
}

/* ============================================================
   SCENE 2 — 定着度入力（実機能のキモ）
   /students 定着度タブ：行 = 教材、点数/満点/合格 → Ctrl+S → 進捗自動進行
   ============================================================ */
function SceneMastery({ visible, progress }: { visible: boolean; progress: number }) {
  const instructorPicked = progress > 0.08;
  const score1 = Math.min(85, Math.floor(Math.max(0, (progress - 0.12) * 220)));
  const score2 = progress > 0.32 ? Math.min(78, Math.floor((progress - 0.32) * 280)) : 0;
  const max1 = progress > 0.4 ? 100 : 0;
  const max2 = progress > 0.5 ? 100 : 0;
  const pass1 = progress > 0.55;
  const pass2 = progress > 0.62;
  const saveClicked = progress > 0.7 && progress < 0.78;
  const showResult = progress > 0.78;

  return (
    <SceneWrapper visible={visible}>
      <div className="h-full flex">
        <aside className="hidden md:flex flex-col w-32 border-r border-zinc-200 bg-white py-2 px-1.5 gap-0.5 flex-shrink-0">
          <div className="text-[9px] font-semibold text-zinc-500 px-1.5 mb-1 uppercase">生徒</div>
          {[
            { n: "佐藤 花子", a: false },
            { n: STUDENT.name, a: true },
            { n: "鈴木 あい", a: false },
            { n: "山田 健", a: false },
            { n: "高橋 美咲", a: false },
          ].map((s) => (
            <div
              key={s.n}
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] ${
                s.a ? "bg-orange-50 text-zinc-900 font-medium border-l-2 border-orange-500" : "text-zinc-600"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full inline-flex items-center justify-center text-[8px] text-white font-bold ${
                  s.a ? "bg-gradient-to-br from-orange-500 to-red-600" : "bg-zinc-300"
                }`}
              >
                {s.n[0]}
              </span>
              <span className="truncate">{s.n}</span>
            </div>
          ))}
        </aside>

        <main className="flex-1 overflow-hidden bg-zinc-50 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-[11px] font-bold text-white">
              {STUDENT.initial}
            </div>
            <div className="text-sm font-bold text-zinc-900">{STUDENT.name}</div>
            <span className="text-[10px] text-zinc-500">{STUDENT.grade}</span>
          </div>

          <div className="flex gap-1 mb-2 text-[11px] border-b border-zinc-200">
            <Tab icon={<ClipboardCheck className="w-3 h-3" />} label="定着度入力" active />
            <Tab icon={<BookOpen className="w-3 h-3" />} label="割り当て管理" />
            <Tab icon={<BarChart3 className="w-3 h-3" />} label="分析" />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[10px]">
            <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">2026-04-28</span>
            <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">3 教材</span>
            <div
              className={`px-2 py-0.5 rounded inline-flex items-center gap-1 transition-all ${
                instructorPicked
                  ? "bg-zinc-100 text-zinc-700"
                  : "bg-amber-50 text-amber-700 border border-amber-300"
              }`}
            >
              <UserCheck className="w-3 h-3" />
              {instructorPicked ? "佐々木 先生" : "講師を選択..."}
            </div>
            <span className="ml-auto px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
              {showResult ? "2/3 反映済み" : pass2 ? "2/3 入力中" : pass1 ? "1/3 入力中" : "0/3"}
            </span>
            <button
              className="text-[10px] px-2.5 py-1 rounded bg-gradient-to-r from-orange-500 to-red-600 text-white font-medium inline-flex items-center gap-1 shadow"
              style={{
                transform: saveClicked ? "scale(0.95)" : pass2 && !showResult ? "scale(1.05)" : "scale(1)",
                boxShadow: pass2 && !showResult ? "0 0 0 4px rgba(244,63,94,0.20)" : "",
              }}
            >
              <Upload className="w-3 h-3" /> 反映 (Ctrl+S)
            </button>
          </div>

          <div className="rounded-lg bg-white border border-zinc-200 overflow-hidden text-[11px]">
            <SpreadsheetRow label="教材名" labelBg="bg-zinc-900 text-white" cells={[
              { content: <span className="font-medium text-rose-700">システム英単語</span>, accent: "rose" },
              { content: <span className="font-medium text-blue-700">基礎問題精講 IA</span>, accent: "blue" },
              { content: <span className="font-medium text-emerald-700">古文読解</span>, accent: "emerald" },
            ]} />
            <SpreadsheetRow label="現在の範囲" labelBg="bg-zinc-50 text-zinc-700" cells={[
              { content: "501-600" },
              { content: "第3章 二次関数" },
              { content: "第1課 評論" },
            ]} />
            <SpreadsheetRow label="未実施" labelBg="bg-amber-50 text-amber-900" cells={[
              { content: <Checkbox checked={false} />, center: true },
              { content: <Checkbox checked={false} />, center: true },
              { content: <Checkbox checked={true} />, center: true, dimmed: true },
            ]} />
            <SpreadsheetRow label="得点" labelBg="bg-amber-50 text-amber-900" cells={[
              { content: <CellInput value={score1 > 0 ? String(score1) : ""} cursor={progress > 0.12 && progress < 0.32} highlight={pass1} success={showResult} /> },
              { content: <CellInput value={score2 > 0 ? String(score2) : ""} cursor={progress > 0.32 && progress < 0.5} highlight={pass2} success={showResult} /> },
              { content: <CellInput value="" disabled />, dimmed: true },
            ]} />
            <SpreadsheetRow label="満点" labelBg="bg-amber-50 text-amber-900" cells={[
              { content: <CellInput value={max1 > 0 ? "100" : ""} success={showResult} /> },
              { content: <CellInput value={max2 > 0 ? "100" : ""} success={showResult} /> },
              { content: <CellInput value="" disabled />, dimmed: true },
            ]} />
            <SpreadsheetRow label="合格" labelBg="bg-amber-50 text-amber-900" cells={[
              { content: <Checkbox checked={pass1} pulse={progress > 0.52 && progress < 0.58} />, center: true, success: pass1 },
              { content: <Checkbox checked={pass2} pulse={progress > 0.6 && progress < 0.66} />, center: true, success: pass2 },
              { content: <span className="text-zinc-400">—</span>, center: true, dimmed: true },
            ]} />
            <SpreadsheetRow label="次回の範囲" labelBg="bg-zinc-50 text-zinc-700" cells={[
              {
                content: showResult ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <ArrowRight className="w-3 h-3" /> 601-700
                  </span>
                ) : (
                  <span className="text-zinc-400">—</span>
                ),
                success: showResult,
              },
              {
                content: showResult ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <ArrowRight className="w-3 h-3" /> 第4章 三角関数
                  </span>
                ) : (
                  <span className="text-zinc-400">—</span>
                ),
                success: showResult,
              },
              { content: <span className="text-zinc-400">↻ 再実施予定</span>, dimmed: true },
            ]} />
          </div>

          {showResult && progress < 0.95 && (
            <Toast message="2件を反映しました。次の章へ自動で進めました。" />
          )}
        </main>
      </div>
    </SceneWrapper>
  );
}

function SpreadsheetRow({
  label,
  labelBg,
  cells,
}: {
  label: string;
  labelBg: string;
  cells: Array<{
    content: React.ReactNode;
    accent?: "rose" | "blue" | "emerald";
    dimmed?: boolean;
    center?: boolean;
    success?: boolean;
  }>;
}) {
  return (
    <div className="grid grid-cols-[80px_repeat(3,1fr)] border-b border-zinc-100 last:border-b-0">
      <div className={`px-2 py-1.5 text-[10px] font-semibold ${labelBg}`}>{label}</div>
      {cells.map((c, i) => {
        const accent =
          c.accent === "rose"
            ? "bg-rose-50/40"
            : c.accent === "blue"
            ? "bg-blue-50/40"
            : c.accent === "emerald"
            ? "bg-emerald-50/40"
            : "";
        return (
          <div
            key={i}
            className={`px-2 py-1.5 border-l border-zinc-100 transition-colors ${
              c.success ? "bg-emerald-50/70" : c.dimmed ? "bg-zinc-50/60 opacity-50" : accent
            } ${c.center ? "text-center" : ""}`}
          >
            {c.content}
          </div>
        );
      })}
    </div>
  );
}

function CellInput({
  value,
  cursor,
  disabled,
  highlight,
  success,
}: {
  value: string;
  cursor?: boolean;
  disabled?: boolean;
  highlight?: boolean;
  success?: boolean;
}) {
  return (
    <div
      className={`min-h-[20px] text-[11px] tabular-nums ${
        disabled ? "text-zinc-400" : success ? "text-emerald-800 font-semibold" : highlight ? "text-zinc-900 font-semibold" : "text-zinc-800"
      }`}
    >
      {value || <span className="text-zinc-300">—</span>}
      {cursor && <span className="inline-block w-px h-3 bg-zinc-900 ml-0.5 align-middle animate-pulse" />}
    </div>
  );
}

function Checkbox({ checked, pulse }: { checked: boolean; pulse?: boolean }) {
  return (
    <span
      className={`inline-flex w-3.5 h-3.5 rounded border items-center justify-center transition-all ${
        checked ? "bg-emerald-500 border-emerald-500" : "bg-white border-zinc-300"
      } ${pulse ? "ring-2 ring-emerald-300 ring-offset-1 scale-125" : ""}`}
    >
      {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
    </span>
  );
}

function Tab({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 border-b-2 ${
        active ? "border-orange-500 text-zinc-900 font-medium" : "border-transparent text-zinc-500"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}

/* ============================================================
   SCENE 3 — 割り当て管理 + PDFプレビュー
   ============================================================ */
function SceneAssign({ visible, progress }: { visible: boolean; progress: number }) {
  const stepperBumped = progress > 0.35 && progress < 0.55;
  const newPct = stepperBumped || progress > 0.55 ? 60 : 58;
  const showPdfPreview = progress > 0.55;

  return (
    <SceneWrapper visible={visible}>
      <div className="h-full overflow-hidden bg-zinc-50 p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-[11px] font-bold text-white">
            {STUDENT.initial}
          </div>
          <div className="text-sm font-bold text-zinc-900">{STUDENT.name}</div>
          <span className="text-[10px] text-zinc-500">{STUDENT.grade}</span>
        </div>

        <div className="flex gap-1 mb-3 text-[11px] border-b border-zinc-200">
          <Tab icon={<ClipboardCheck className="w-3 h-3" />} label="定着度入力" />
          <Tab icon={<BookOpen className="w-3 h-3" />} label="割り当て管理" active />
          <Tab icon={<BarChart3 className="w-3 h-3" />} label="分析" />
        </div>

        {/* Assigned section */}
        <div className="rounded-lg bg-white border border-blue-200 p-3 mb-2">
          <div className="flex items-center gap-1.5 mb-2">
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[11px] font-semibold text-zinc-800">割り当て中</span>
            <span className="text-[10px] text-zinc-500 ml-auto">3 教材</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <AssignedCard name="システム英単語" pct={72} subject="rose" />
            <AssignedCard
              name="基礎問題精講 IA"
              pct={newPct}
              pulse={stepperBumped}
              subject="blue"
              currentNode={progress > 0.55 ? "33/100" : "32/100"}
              stepperHover={progress > 0.18 && progress < 0.35}
            />
            <AssignedCard name="古文読解" pct={45} subject="emerald" />
          </div>
        </div>

        {/* Available */}
        <div className="rounded-lg bg-white border border-emerald-200 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[11px] font-semibold text-zinc-800">追加可能な教材</span>
            <span className="text-[10px] text-zinc-500 ml-auto">クリックで割り当て</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {["Vintage", "ターゲット1900", "青チャート IIB", "現代文 入試問題集"].map((n) => (
              <div
                key={n}
                className="rounded-lg border border-zinc-200 bg-white p-2 text-center text-[10px] text-zinc-700"
              >
                <Plus className="w-3.5 h-3.5 mx-auto mb-0.5 text-zinc-400" />
                <div className="truncate">{n}</div>
              </div>
            ))}
          </div>
        </div>

        {/* PDF preview floating panel */}
        {showPdfPreview && (
          <div
            className="absolute right-4 sm:right-6 bottom-4 w-60 sm:w-72 rounded-lg bg-white border-2 border-zinc-300 shadow-2xl overflow-hidden"
            style={{ animation: "fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)" }}
          >
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 border-b border-zinc-200">
              <FileText className="w-3 h-3 text-zinc-600" />
              <span className="text-[10px] font-semibold text-zinc-800">第3章-問題.pdf</span>
              <X className="w-3 h-3 text-zinc-400 ml-auto" />
            </div>
            <div className="bg-zinc-50 p-2.5 h-32 sm:h-36 relative overflow-hidden">
              <div className="bg-white shadow rounded p-2 text-[8px] text-zinc-400 space-y-1 h-full">
                <div className="font-bold text-zinc-700 text-[10px]">第3章 二次関数</div>
                <div className="text-zinc-500">問1. 次の関数のグラフを描け。</div>
                <div className="text-zinc-700">  y = x² − 4x + 3</div>
                <div className="text-zinc-500 mt-1">問2. 頂点の座標を求めよ。</div>
                <div className="text-zinc-700">  y = −2(x + 1)² + 5</div>
                <div className="text-zinc-500 mt-1">問3. 解を求めよ。</div>
                <div className="text-zinc-700">  x² − 5x + 6 = 0</div>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-zinc-50 border-t border-zinc-200 flex items-center gap-1 text-[9px] text-zinc-600">
              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">問題</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">解答</span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-600">復習</span>
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </SceneWrapper>
  );
}

function AssignedCard({
  name,
  pct,
  pulse,
  subject,
  currentNode,
  stepperHover,
}: {
  name: string;
  pct: number;
  pulse?: boolean;
  subject: "rose" | "blue" | "emerald";
  currentNode?: string;
  stepperHover?: boolean;
}) {
  const stroke =
    subject === "rose" ? "stroke-rose-500" : subject === "blue" ? "stroke-blue-500" : "stroke-emerald-500";
  const text =
    subject === "rose" ? "text-rose-700" : subject === "blue" ? "text-blue-700" : "text-emerald-700";
  const top =
    subject === "rose"
      ? "from-rose-500 to-red-600"
      : subject === "blue"
      ? "from-blue-500 to-indigo-600"
      : "from-emerald-500 to-green-600";

  return (
    <div
      className="rounded-lg bg-white border p-2.5 text-center transition-all relative overflow-hidden"
      style={{
        borderColor: pulse ? "rgb(244 63 94)" : "rgb(228 228 231)",
        boxShadow: pulse ? "0 0 0 3px rgba(244,63,94,0.15)" : "",
      }}
    >
      <div className={`absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r ${top}`} />
      <div className="relative inline-flex items-center justify-center mb-1 mt-1">
        <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
          <circle cx="24" cy="24" r="20" stroke="rgb(228 228 231)" strokeWidth="3" fill="none" />
          <circle
            cx="24"
            cy="24"
            r="20"
            className={stroke}
            strokeWidth="3"
            fill="none"
            strokeDasharray={`${(pct / 100) * 126} 126`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.5s cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>
        <span className={`absolute text-[11px] font-bold ${text}`}>{pct}%</span>
      </div>
      <div className="text-[10px] font-medium text-zinc-700 leading-tight truncate">{name}</div>
      <div className="flex items-center justify-center gap-0.5 mt-1.5 text-[9px]">
        <button
          className={`px-1 py-0.5 rounded transition-all ${
            stepperHover ? "bg-orange-200" : "bg-zinc-100"
          } text-zinc-600`}
        >
          −
        </button>
        <span className="px-1.5 py-0.5 bg-zinc-50 rounded text-zinc-700 tabular-nums">
          {currentNode || "32/100"}
        </span>
        <button
          className={`px-1 py-0.5 rounded transition-all ${
            stepperHover
              ? "bg-orange-500 text-white shadow"
              : "bg-zinc-100 text-zinc-600"
          }`}
          style={{
            transform: stepperHover ? "scale(1.15)" : "scale(1)",
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   SCENE 4 — 試験管理（分析タブ）
   subject-radar / score-trend / target-comparison / compressed-score
   ============================================================ */
function SceneExam({ visible, progress }: { visible: boolean; progress: number }) {
  const showCompressed = progress > 0.45;
  const profile =
    progress < 0.6 ? "東大 理科一類" : progress < 0.85 ? "京大 工学部" : "東大 理科一類";
  const compressedScore = profile === "東大 理科一類" ? 562 : 498;

  return (
    <SceneWrapper visible={visible}>
      <div className="h-full overflow-hidden bg-zinc-50 p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-base sm:text-lg font-bold text-zinc-900">試験管理</h1>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-500">生徒:</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-white">{STUDENT.name}</span>
            <span className="text-[10px] text-zinc-500 ml-2">試験:</span>
            <span className="text-[10px] px-2 py-0.5 rounded border border-zinc-300 bg-white">
              共テ模試 第3回
            </span>
          </div>
        </div>

        <div className="flex gap-1 mb-2 text-[11px] border-b border-zinc-200">
          <Tab icon={<BarChart3 className="w-3 h-3" />} label="分析" active />
          <Tab icon={<FileText className="w-3 h-3" />} label="試験教材" />
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <ExamKpi label="最新合計点" value="612" sub="/ 900" tone="emerald" />
          <ExamKpi label="得点率" value="68%" sub="目標 75%" tone="amber" />
          <ExamKpi label="実施回数" value="3" sub="模試 / 過去問" tone="blue" />
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          {/* Radar */}
          <div className="rounded-lg bg-white border border-zinc-200 p-2.5">
            <div className="text-[10px] font-semibold text-zinc-700 mb-1">教科バランス（レーダー）</div>
            <RadarChart progress={progress} />
          </div>

          {/* Score trend */}
          <div className="rounded-lg bg-white border border-zinc-200 p-2.5">
            <div className="text-[10px] font-semibold text-zinc-700 mb-1">得点率の推移</div>
            <TrendChart progress={progress} />
          </div>
        </div>

        {/* Compressed score calculator */}
        {showCompressed && (
          <div
            className="rounded-lg bg-gradient-to-r from-zinc-900 to-zinc-800 text-white p-3 flex items-center gap-3"
            style={{ animation: "fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)" }}
          >
            <div className="rounded-full w-9 h-9 inline-flex items-center justify-center bg-orange-500/20 text-orange-300">
              <Calculator className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-zinc-400 font-medium">圧縮スコア（志望大学の配点で換算）</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums">{compressedScore}</span>
                <span className="text-zinc-400 text-xs">/ 900</span>
                <span
                  className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                    compressedScore >= 540 ? "bg-emerald-500/30 text-emerald-200" : "bg-amber-500/30 text-amber-200"
                  }`}
                >
                  {compressedScore >= 540 ? "ボーダー超え" : "あと少し"}
                </span>
              </div>
            </div>
            <div className="hidden sm:flex flex-col gap-1">
              {["東大 理科一類", "京大 工学部"].map((p) => (
                <span
                  key={p}
                  className={`text-[10px] px-2 py-1 rounded transition-all ${
                    p === profile
                      ? "bg-orange-500 text-white font-semibold"
                      : "bg-zinc-700 text-zinc-300"
                  }`}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </SceneWrapper>
  );
}

function ExamKpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "emerald" | "amber" | "blue";
}) {
  const ring =
    tone === "emerald" ? "border-emerald-200" : tone === "amber" ? "border-amber-200" : "border-blue-200";
  const txt = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-blue-700";
  return (
    <div className={`rounded-lg bg-white border ${ring} p-2`}>
      <div className="text-[9px] text-zinc-500">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-lg font-bold tabular-nums ${txt}`}>{value}</span>
        <span className="text-[9px] text-zinc-500">{sub}</span>
      </div>
    </div>
  );
}

function RadarChart({ progress }: { progress: number }) {
  // 5-axis radar
  const reveal = Math.min(1, progress * 2.2);
  const data = [85, 70, 60, 55, 80]; // 英・数・国・理・社
  const labels = ["英", "数", "国", "理", "社"];
  const target = [80, 80, 70, 75, 75];
  const cx = 60;
  const cy = 50;
  const r = 36;
  const polyPoint = (val: number, i: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const v = (val / 100) * r * reveal;
    return [cx + Math.cos(angle) * v, cy + Math.sin(angle) * v];
  };
  const polyStr = (vals: number[]) =>
    vals.map((v, i) => polyPoint(v, i).join(",")).join(" ");
  return (
    <svg viewBox="0 0 120 100" className="w-full h-20">
      {/* gridlines */}
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon
          key={s}
          points={[0, 1, 2, 3, 4]
            .map((i) => {
              const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
              return `${cx + Math.cos(a) * r * s},${cy + Math.sin(a) * r * s}`;
            })
            .join(" ")}
          fill="none"
          stroke="rgb(228 228 231)"
          strokeWidth="0.5"
        />
      ))}
      {/* target */}
      <polygon points={polyStr(target)} fill="rgba(251,146,60,0.18)" stroke="rgb(251 146 60)" strokeWidth="1" strokeDasharray="2 2" />
      {/* actual */}
      <polygon points={polyStr(data)} fill="rgba(244,63,94,0.28)" stroke="rgb(244 63 94)" strokeWidth="1.5" />
      {/* points */}
      {data.map((v, i) => {
        const [x, y] = polyPoint(v, i);
        return <circle key={i} cx={x} cy={y} r="1.6" fill="rgb(244 63 94)" />;
      })}
      {/* labels */}
      {labels.map((l, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const lx = cx + Math.cos(a) * (r + 8);
        const ly = cy + Math.sin(a) * (r + 8) + 2;
        return (
          <text key={l} x={lx} y={ly} fontSize="6" textAnchor="middle" fill="rgb(82 82 91)">
            {l}
          </text>
        );
      })}
    </svg>
  );
}

function TrendChart({ progress }: { progress: number }) {
  const reveal = Math.min(1, progress * 2);
  const data = [52, 58, 55, 64, 68]; // 5 試験
  const target = 75;
  const w = 110;
  const h = 60;
  const padX = 6;
  const padY = 10;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const stepX = innerW / (data.length - 1);
  const visibleN = Math.min(data.length, Math.floor(reveal * data.length) + 1);
  const points = data
    .slice(0, visibleN)
    .map((v, i) => `${padX + i * stepX},${padY + innerH - (v / 100) * innerH}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
      <line x1={padX} x2={w - padX} y1={padY + innerH - (target / 100) * innerH} y2={padY + innerH - (target / 100) * innerH} stroke="rgb(251 146 60)" strokeWidth="0.6" strokeDasharray="2 2" />
      <text x={w - padX} y={padY + innerH - (target / 100) * innerH - 1} fontSize="5" textAnchor="end" fill="rgb(251 146 60)">
        目標 75
      </text>
      <polyline points={points} fill="none" stroke="rgb(244 63 94)" strokeWidth="1.5" strokeLinecap="round" />
      {data.slice(0, visibleN).map((v, i) => (
        <circle
          key={i}
          cx={padX + i * stepX}
          cy={padY + innerH - (v / 100) * innerH}
          r="1.8"
          fill="white"
          stroke="rgb(244 63 94)"
          strokeWidth="1.2"
        />
      ))}
      {/* axis */}
      <line x1={padX} y1={padY + innerH} x2={w - padX} y2={padY + innerH} stroke="rgb(228 228 231)" strokeWidth="0.5" />
    </svg>
  );
}

/* ============================================================
   SCENE 5 — 印刷（生徒個別）
   ============================================================ */
function ScenePrint({ visible, progress }: { visible: boolean; progress: number }) {
  const showJobItems = progress > 0.05;
  const cursorOnButton = progress > 0.32 && progress < 0.5;
  const buttonClicked = progress > 0.46 && progress < 0.55;
  const sending = progress > 0.5 && progress < 0.78;
  const completed = progress > 0.78;

  return (
    <SceneWrapper visible={visible}>
      <div className="h-full overflow-hidden p-3 sm:p-4 bg-zinc-50 relative">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-zinc-900">印刷</h1>
            <div className="text-[10px] text-zinc-500">印刷キュー・ジョブ履歴を管理</div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-500">表示:</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-white">問題+解答</span>
          </div>
        </div>

        <div className="flex gap-1 mb-3 text-[11px] border-b border-zinc-200">
          <Tab icon={<Printer className="w-3 h-3" />} label="キュー [3件]" active />
          <Tab icon={<FileText className="w-3 h-3" />} label="ジョブ履歴" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[10px]">
          <button className="px-2 py-1 rounded border border-zinc-200 bg-white text-zinc-600 inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> 手動追加
          </button>
          <span className="ml-auto text-[10px] text-zinc-500">3件 / 1名</span>
        </div>

        {/* Other student (collapsed) */}
        <div className="rounded-lg bg-white border border-zinc-200 mb-2 px-3 py-2 flex items-center gap-2 text-[11px] opacity-60">
          <ChevronRight className="w-3 h-3 text-zinc-400" />
          <Users className="w-3.5 h-3.5 text-zinc-500" />
          <span className="font-medium text-zinc-700">佐藤 花子</span>
          <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-100 text-zinc-600">高3</span>
          <span className="text-[9px] text-zinc-500 ml-auto">問2 解1</span>
        </div>

        {/* Target student card */}
        <div
          className={`rounded-lg bg-white border-2 transition-all ${
            cursorOnButton || buttonClicked ? "border-orange-400" : "border-zinc-200"
          }`}
          style={{
            boxShadow: cursorOnButton || buttonClicked ? "0 0 0 4px rgba(244,115,22,0.10)" : "",
          }}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100">
            <ChevronRight className="w-3 h-3 text-zinc-400 rotate-90" />
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-[10px] font-bold text-white">
              {STUDENT.initial}
            </div>
            <span className="text-[12px] font-semibold text-zinc-900">{STUDENT.name}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-600">{STUDENT.grade}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">問2</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">解1</span>

            <button className="ml-auto text-[10px] px-2 py-1 rounded border border-zinc-200 text-rose-600 inline-flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> 全削除
            </button>
            <button
              className="text-[10px] px-2.5 py-1 rounded bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold inline-flex items-center gap-1 shadow relative"
              style={{
                transform: buttonClicked ? "scale(0.95)" : cursorOnButton ? "scale(1.06)" : "scale(1)",
                boxShadow:
                  cursorOnButton || buttonClicked
                    ? "0 0 0 6px rgba(244,63,94,0.22)"
                    : "0 1px 3px rgba(0,0,0,0.1)",
                transition: "all 0.15s",
              }}
            >
              {sending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : completed ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <Printer className="w-3 h-3" />
              )}
              {sending ? "送信中..." : completed ? "印刷完了" : "印刷"}
              {buttonClicked && (
                <span className="absolute -inset-1 rounded ring-4 ring-orange-300 animate-ping" />
              )}
            </button>
          </div>

          {/* 問題 group */}
          <div className="bg-blue-50/40 px-3 py-1.5 border-b border-blue-100 flex items-center gap-2 text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-blue-500 text-white font-medium">問題</span>
            <span className="text-zinc-600">2件</span>
          </div>
          <div className="divide-y divide-zinc-100">
            {showJobItems &&
              [
                { mat: "システム英単語", node: "601-700", type: "問題" },
                { mat: "基礎問題精講 IA", node: "第4章 三角関数", type: "問題" },
              ].map((row, i) => (
                <PrintRow
                  key={i}
                  row={row}
                  i={i}
                  state={completed ? "done" : sending ? "sending" : "pending"}
                />
              ))}
          </div>

          <div className="bg-amber-50/50 px-3 py-1.5 border-y border-amber-100 flex items-center gap-2 text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white font-medium">解答</span>
            <span className="text-zinc-600">1件</span>
          </div>
          <div>
            {showJobItems && (
              <PrintRow
                row={{ mat: "システム英単語", node: "601-700", type: "解答" }}
                i={0}
                state={completed ? "done" : sending ? "sending" : "pending"}
              />
            )}
          </div>
        </div>

        {progress > 0.1 && progress < 0.5 && (
          <div
            className="absolute pointer-events-none"
            style={{
              right: `${20 - Math.min(0.95, progress * 1.6) * 12}%`,
              top: `${30 + Math.min(0.95, progress * 1.6) * 5}%`,
              transition: "right 1.2s cubic-bezier(0.4,0,0.2,1), top 1.2s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <CursorIcon clicking={buttonClicked} />
          </div>
        )}

        {sending && (
          <div
            className="absolute inset-x-4 sm:inset-x-12 bottom-4 rounded-xl bg-white border-2 border-zinc-300 shadow-2xl p-3"
            style={{ animation: "fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-zinc-600" />
              <span className="text-[11px] font-semibold text-zinc-800">PDFを生成中... (3件結合)</span>
              <span className="ml-auto text-[10px] text-zinc-500">田中-太郎-2026-04-28.pdf</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                style={{
                  width: `${Math.min(100, ((progress - 0.5) / 0.28) * 100)}%`,
                  transition: "width 0.2s",
                }}
              />
            </div>
          </div>
        )}

        {completed && (
          <div
            className="absolute inset-x-4 sm:inset-x-12 bottom-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 shadow-2xl p-3 flex items-center gap-3"
            style={{ animation: "fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)" }}
          >
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <div className="flex-1">
              <div className="text-[11px] font-bold text-emerald-900">{STUDENT.name}さん の3枚を出力しました</div>
              <div className="text-[10px] text-emerald-700">教室のプリンタからそのまま受け取れます</div>
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </SceneWrapper>
  );
}

function PrintRow({
  row,
  i,
  state,
}: {
  row: { mat: string; node: string; type: string };
  i: number;
  state: "pending" | "sending" | "done";
}) {
  return (
    <div
      className="grid grid-cols-12 gap-2 px-3 py-1.5 items-center text-[11px]"
      style={{
        opacity: 0,
        animation: `fadeSlide 0.4s cubic-bezier(0.16,1,0.3,1) ${100 + i * 80}ms forwards`,
      }}
    >
      <span className="col-span-5 text-zinc-800 truncate">{row.mat}</span>
      <span className="col-span-3 text-zinc-600 truncate">{row.node}</span>
      <span className="col-span-2">
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded border ${
            row.type === "問題"
              ? "bg-blue-50 border-blue-100 text-blue-700"
              : "bg-amber-50 border-amber-100 text-amber-700"
          }`}
        >
          {row.type}
        </span>
      </span>
      <span className="col-span-1 text-center">
        <Eye className="w-3 h-3 text-zinc-400 inline" />
      </span>
      <span className="col-span-1 text-right">
        {state === "done" ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" />
        ) : state === "sending" ? (
          <Loader2 className="w-3 h-3 text-blue-500 animate-spin inline" />
        ) : (
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
        )}
      </span>
      <style jsx>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   Shared bits
   ============================================================ */
function CursorIcon({ clicking }: { clicking: boolean }) {
  return (
    <div className="relative">
      {clicking && <span className="absolute -inset-2 rounded-full bg-orange-400/40 animate-ping" />}
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M3 2L19 11L11 13L8 20L3 2Z" fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div
      className="absolute top-3 right-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 shadow-lg flex items-center gap-2 text-[11px] z-30"
      style={{ animation: "slideInRight 0.35s cubic-bezier(0.16,1,0.3,1)" }}
    >
      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
      <span className="font-medium">{message}</span>
      <style jsx>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
