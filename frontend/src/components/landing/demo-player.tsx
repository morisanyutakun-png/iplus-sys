"use client";

import { useEffect, useRef, useState } from "react";
import {
  Home,
  Users,
  BookOpen,
  Printer,
  BarChart3,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
  Cog,
  FileText,
  Send,
  ChevronRight,
} from "lucide-react";

type Scene = {
  id: string;
  title: string;
  subtitle: string;
  durationMs: number;
};

const SCENES: Scene[] = [
  {
    id: "home",
    title: "ホーム画面",
    subtitle: "塾全体の様子をひと目で確認",
    durationMs: 4500,
  },
  {
    id: "click",
    title: "ボタン1つ",
    subtitle: "「全員ぶん 次のプリント自動準備」を実行",
    durationMs: 3000,
  },
  {
    id: "queue",
    title: "印刷キューに自動追加",
    subtitle: "全生徒の次のプリントが並ぶ",
    durationMs: 4500,
  },
  {
    id: "send",
    title: "送信",
    subtitle: "ジョブをプリンタへ",
    durationMs: 3000,
  },
  {
    id: "done",
    title: "印刷完了",
    subtitle: "教室のプリンタから紙が出てくる",
    durationMs: 3500,
  },
];

const TOTAL_MS = SCENES.reduce((a, s) => a + s.durationMs, 0);

const STUDENTS = [
  { name: "佐藤 花子", grade: "高3", subject: "数学IIB", chapter: "第3章 微分", color: "rose" },
  { name: "田中 太郎", grade: "高2", subject: "英語", chapter: "Unit 5 仮定法", color: "blue" },
  { name: "鈴木 あい", grade: "高3", subject: "現代文", chapter: "評論 読解2", color: "amber" },
  { name: "山田 健", grade: "高1", subject: "数学IA", chapter: "第2章 二次関数", color: "emerald" },
  { name: "高橋 美咲", grade: "高3", subject: "物理", chapter: "電磁気2", color: "violet" },
  { name: "渡辺 翔", grade: "高2", subject: "化学", chapter: "有機化学1", color: "cyan" },
];

export function DemoPlayer() {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [elapsedInScene, setElapsedInScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  const lastTickRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);

  // Animation loop
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
      {/* Browser frame */}
      <div className="rounded-2xl bg-zinc-900 shadow-2xl ring-1 ring-zinc-800/50 overflow-hidden">
        {/* Title bar */}
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
              <span className="text-zinc-500">{scene.id === "queue" || scene.id === "send" || scene.id === "done" ? "/print" : "/dashboard"}</span>
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">
            {Math.round(totalProgress * 100)}%
          </div>
        </div>

        {/* App body */}
        <div className="flex h-[420px] sm:h-[480px] bg-white">
          {/* Sidebar */}
          <aside className="hidden md:flex w-44 lg:w-52 flex-col bg-zinc-950 text-zinc-200 py-4 px-3 gap-1 text-xs flex-shrink-0">
            <div className="flex items-center gap-2 px-2 py-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm">
                i+
              </div>
              <span className="font-bold text-sm">iPlus Sys</span>
            </div>
            <NavItem icon={<Home className="w-4 h-4" />} label="ホーム" active={scene.id === "home" || scene.id === "click"} />
            <NavItem icon={<Users className="w-4 h-4" />} label="生徒" />
            <NavItem icon={<BookOpen className="w-4 h-4" />} label="教材" />
            <NavItem icon={<BarChart3 className="w-4 h-4" />} label="模試・試験" />
            <NavItem icon={<FileText className="w-4 h-4" />} label="単語テスト" />
            <NavItem icon={<Printer className="w-4 h-4" />} label="印刷" active={scene.id === "queue" || scene.id === "send" || scene.id === "done"} />
          </aside>

          {/* Main */}
          <main className="flex-1 overflow-hidden relative bg-zinc-50">
            <SceneHome visible={scene.id === "home"} progress={sceneProgress} />
            <SceneClick visible={scene.id === "click"} progress={sceneProgress} />
            <SceneQueue visible={scene.id === "queue"} progress={sceneProgress} />
            <SceneSend visible={scene.id === "send"} progress={sceneProgress} />
            <SceneDone visible={scene.id === "done"} progress={sceneProgress} />
          </main>
        </div>

        {/* Bottom progress bar */}
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
                className={`text-[11px] sm:text-xs font-medium rounded-full px-2.5 sm:px-3 py-1.5 transition-all ${
                  isCur
                    ? "bg-zinc-900 text-white shadow-md"
                    : isDone
                    ? "bg-zinc-200 text-zinc-700"
                    : "bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                <span className="opacity-60 mr-1">{i + 1}.</span>
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

      {/* Scene caption */}
      <div className="mt-4 rounded-xl bg-zinc-900 text-white px-4 py-3 flex items-start gap-3">
        <div className="rounded-full bg-orange-500/20 text-orange-400 w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {sceneIdx + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{scene.title}</div>
          <div className="text-xs text-zinc-400 mt-0.5">{scene.subtitle}</div>
        </div>
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
        active
          ? "bg-gradient-to-r from-orange-600/30 to-red-600/30 text-white"
          : "text-zinc-400"
      }`}
    >
      <span className={active ? "text-orange-400" : ""}>{icon}</span>
      <span className="text-[11px]">{label}</span>
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400" />}
    </div>
  );
}

/* ============================ SCENES ============================ */

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

function SceneHome({ visible, progress }: { visible: boolean; progress: number }) {
  return (
    <SceneWrapper visible={visible}>
      <div className="p-4 sm:p-5 h-full overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-900">ホーム</h2>
            <p className="text-[11px] text-zinc-500">2026年4月28日 月曜日</p>
          </div>
          <div className="hidden sm:flex gap-2">
            <button className="text-[11px] px-3 py-1.5 rounded-md bg-white border border-zinc-200 text-zinc-700">
              印刷ページへ
            </button>
            <button
              className="text-[11px] px-3 py-1.5 rounded-md bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium shadow-md inline-flex items-center gap-1 transition-transform"
              style={{
                transform: visible && progress > 0.5 ? "scale(1.04)" : "scale(1)",
                boxShadow:
                  visible && progress > 0.5
                    ? "0 0 0 6px rgba(16,185,129,0.18)"
                    : "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <Sparkles className="w-3 h-3" />
              全員ぶん 次のプリント自動準備
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
          <KpiCard
            label="生徒の人数"
            value="48"
            unit="名"
            icon={<Users className="w-3.5 h-3.5" />}
            tint="bg-blue-50 text-blue-700 border-blue-100"
          />
          <KpiCard
            label="教材の数"
            value="22"
            unit="冊"
            icon={<BookOpen className="w-3.5 h-3.5" />}
            tint="bg-emerald-50 text-emerald-700 border-emerald-100"
          />
          <KpiCard
            label="今週の学習"
            value="312"
            unit="回"
            sub="先週比 +18%"
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            tint="bg-orange-50 text-orange-700 border-orange-100"
          />
        </div>

        {/* Alerts + chart */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <div className="rounded-lg bg-white border border-zinc-200 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-[11px] font-semibold text-zinc-800">要注意の生徒</span>
              <span className="ml-auto text-[10px] text-zinc-500">3件</span>
            </div>
            <div className="space-y-1.5">
              <AlertRow color="amber" label="佐藤 花子" badge="もうすぐ終わる" />
              <AlertRow color="rose" label="高橋 美咲" badge="正答率 ↓" />
              <AlertRow color="amber" label="渡辺 翔" badge="もうすぐ終わる" />
            </div>
          </div>

          <div className="rounded-lg bg-white border border-zinc-200 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] font-semibold text-zinc-800">過去8週の学習量</span>
            </div>
            <div className="flex items-end gap-1 h-16">
              {[28, 35, 32, 41, 38, 45, 52, 60].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end">
                  <div
                    className="rounded-sm bg-gradient-to-t from-orange-500 to-orange-400"
                    style={{
                      height: visible ? `${h}%` : "0%",
                      transition: `height 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 50}ms`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SceneWrapper>
  );
}

function KpiCard({
  label,
  value,
  unit,
  sub,
  icon,
  tint,
}: {
  label: string;
  value: string;
  unit: string;
  sub?: string;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="rounded-lg bg-white border border-zinc-200 p-2.5 sm:p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`inline-flex w-5 h-5 sm:w-6 sm:h-6 rounded items-center justify-center border ${tint}`}>
          {icon}
        </span>
        <span className="text-[10px] sm:text-[11px] text-zinc-600 font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl sm:text-2xl font-bold text-zinc-900 tabular-nums">{value}</span>
        <span className="text-[10px] sm:text-xs text-zinc-500">{unit}</span>
      </div>
      {sub && <div className="text-[10px] text-emerald-600 font-medium">{sub}</div>}
    </div>
  );
}

function AlertRow({
  color,
  label,
  badge,
}: {
  color: "amber" | "rose";
  label: string;
  badge: string;
}) {
  const cls = color === "rose" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className={`inline-block w-2 h-2 rounded-full ${color === "rose" ? "bg-rose-500" : "bg-amber-500"}`} />
      <span className="font-medium text-zinc-800">{label}</span>
      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>
        {badge}
      </span>
    </div>
  );
}

function SceneClick({ visible, progress }: { visible: boolean; progress: number }) {
  // Cursor moves toward button, then "click" pulse, then toast
  const cursorX = visible ? 78 - progress * 18 : 78;
  const cursorY = visible ? 18 + progress * 4 : 18;
  const showClick = progress > 0.45 && progress < 0.65;
  const showToast = progress > 0.55;

  return (
    <SceneWrapper visible={visible}>
      <div className="p-4 sm:p-5 h-full relative">
        {/* Same dashboard but dimmed slightly */}
        <div className="opacity-70 pointer-events-none">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900">ホーム</h2>
            <div className="hidden sm:flex gap-2">
              <button className="text-[11px] px-3 py-1.5 rounded-md bg-white border border-zinc-200 text-zinc-700">
                印刷ページへ
              </button>
              {/* The button being clicked */}
              <button
                className="relative text-[11px] px-3 py-1.5 rounded-md bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium shadow-md inline-flex items-center gap-1"
                style={{
                  transform: showClick ? "scale(0.96)" : "scale(1.04)",
                  boxShadow: "0 0 0 6px rgba(16,185,129,0.25)",
                  transition: "transform 0.15s ease",
                }}
              >
                <Sparkles className="w-3 h-3" />
                全員ぶん 次のプリント自動準備
                {showClick && (
                  <span className="absolute -inset-1 rounded-md ring-4 ring-emerald-300 animate-ping" />
                )}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-lg bg-white border border-zinc-200 p-3 h-16" />
            <div className="rounded-lg bg-white border border-zinc-200 p-3 h-16" />
            <div className="rounded-lg bg-white border border-zinc-200 p-3 h-16" />
          </div>
        </div>

        {/* Animated cursor */}
        <div
          className="absolute pointer-events-none"
          style={{
            right: `${cursorX}%`,
            top: `${cursorY}%`,
            transition: "right 1.4s cubic-bezier(0.4,0,0.2,1), top 1.4s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <CursorIcon clicking={showClick} />
        </div>

        {/* Processing overlay */}
        {progress > 0.55 && progress < 0.85 && (
          <div className="absolute inset-x-0 bottom-1/3 flex justify-center">
            <div className="rounded-xl bg-white shadow-xl border border-zinc-200 px-4 py-3 flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <div>
                <div className="text-xs font-medium text-zinc-900">次のプリントを準備しています…</div>
                <div className="text-[10px] text-zinc-500">全48名分の次回ノードを抽出中</div>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {showToast && (
          <div
            className="absolute top-2 right-2 sm:top-3 sm:right-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 shadow-lg flex items-center gap-2 text-xs"
            style={{
              animation: "slideInRight 0.4s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <div>
              <div className="font-semibold">12件をキューに追加しました</div>
              <div className="text-[10px] opacity-80">印刷ページで送信できます</div>
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </SceneWrapper>
  );
}

function CursorIcon({ clicking }: { clicking: boolean }) {
  return (
    <div className="relative">
      {clicking && (
        <span className="absolute -inset-2 rounded-full bg-emerald-400/40 animate-ping" />
      )}
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path
          d="M3 2L19 11L11 13L8 20L3 2Z"
          fill="white"
          stroke="black"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function SceneQueue({ visible, progress }: { visible: boolean; progress: number }) {
  const itemsToShow = Math.min(STUDENTS.length, Math.floor(progress * STUDENTS.length * 1.6));
  return (
    <SceneWrapper visible={visible}>
      <div className="p-4 sm:p-5 h-full overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-900">印刷</h2>
            <p className="text-[11px] text-zinc-500">待ち列に {itemsToShow} 件</p>
          </div>
          <div className="hidden sm:flex gap-2">
            <button className="text-[11px] px-3 py-1.5 rounded-md bg-white border border-zinc-200 text-zinc-700">
              すべてクリア
            </button>
            <button className="text-[11px] px-3 py-1.5 rounded-md bg-orange-600 text-white font-medium shadow inline-flex items-center gap-1">
              <Send className="w-3 h-3" />
              送信
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3 text-[11px]">
          <span className="px-2.5 py-1 rounded-md bg-zinc-900 text-white font-medium">待ち列</span>
          <span className="px-2.5 py-1 rounded-md text-zinc-500">まとめ</span>
          <span className="px-2.5 py-1 rounded-md text-zinc-500">プリンタ</span>
          <span className="px-2.5 py-1 rounded-md text-zinc-500">履歴</span>
        </div>

        {/* Queue items */}
        <div className="rounded-lg bg-white border border-zinc-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-medium text-zinc-500 bg-zinc-50 border-b border-zinc-200">
            <span className="col-span-3">生徒</span>
            <span className="col-span-2">教材</span>
            <span className="col-span-4">章・回</span>
            <span className="col-span-2">種類</span>
            <span className="col-span-1 text-right">状態</span>
          </div>
          <div className="divide-y divide-zinc-100">
            {STUDENTS.map((s, i) => {
              const shown = i < itemsToShow;
              return (
                <div
                  key={s.name}
                  className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] items-center"
                  style={{
                    opacity: shown ? 1 : 0,
                    transform: shown ? "translateX(0)" : "translateX(-12px)",
                    transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  <span className="col-span-3 font-medium text-zinc-800">
                    <span className="text-zinc-400 mr-1">{s.grade}</span>
                    {s.name}
                  </span>
                  <span className="col-span-2 text-zinc-600">{s.subject}</span>
                  <span className="col-span-4 text-zinc-700">{s.chapter}</span>
                  <span className="col-span-2">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-blue-50 text-blue-700 border border-blue-100">
                      問題＋解答
                    </span>
                  </span>
                  <span className="col-span-1 text-right">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                  </span>
                </div>
              );
            })}
            {/* Skeleton rows */}
            {Array.from({ length: Math.max(0, 6 - itemsToShow) }).map((_, i) => (
              <div key={`sk-${i}`} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
                <div className="col-span-3 h-3 rounded bg-zinc-100" />
                <div className="col-span-2 h-3 rounded bg-zinc-100" />
                <div className="col-span-4 h-3 rounded bg-zinc-100" />
                <div className="col-span-2 h-3 rounded bg-zinc-100" />
                <div className="col-span-1 h-3 rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        </div>

        {itemsToShow >= 6 && (
          <div className="mt-2 text-[10px] text-zinc-500 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>全48名分の次回プリントが整いました</span>
          </div>
        )}
      </div>
    </SceneWrapper>
  );
}

function SceneSend({ visible, progress }: { visible: boolean; progress: number }) {
  const status =
    progress < 0.3 ? "受付中" : progress < 0.7 ? "送信中" : "印刷完了";
  const fill = Math.min(1, progress * 1.3);
  return (
    <SceneWrapper visible={visible}>
      <div className="p-4 sm:p-5 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base sm:text-lg font-bold text-zinc-900">印刷ジョブ #128</h2>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
              status === "印刷完了"
                ? "bg-emerald-100 text-emerald-700"
                : status === "送信中"
                ? "bg-blue-100 text-blue-700"
                : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {status}
          </span>
        </div>

        {/* Status pipeline */}
        <div className="rounded-lg bg-white border border-zinc-200 p-4 mb-3">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <PipelineStep label="受付中" done={progress > 0.05} icon={<FileText className="w-3.5 h-3.5" />} />
            <ArrowRight className="w-3 h-3 text-zinc-300" />
            <PipelineStep label="送信中" done={progress > 0.4} active={progress > 0.05 && progress <= 0.7} icon={<Send className="w-3.5 h-3.5" />} />
            <ArrowRight className="w-3 h-3 text-zinc-300" />
            <PipelineStep label="完了" done={progress > 0.85} active={progress > 0.7 && progress <= 0.85} icon={<CheckCircle2 className="w-3.5 h-3.5" />} />
          </div>
        </div>

        {/* Progress */}
        <div className="rounded-lg bg-white border border-zinc-200 p-4 mb-3">
          <div className="flex justify-between text-[11px] text-zinc-600 mb-2">
            <span>12件 / 48ページ</span>
            <span className="tabular-nums font-medium">{Math.round(fill * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
              style={{ width: `${fill * 100}%` }}
            />
          </div>
        </div>

        {/* Job items */}
        <div className="rounded-lg bg-white border border-zinc-200 p-3 flex-1 overflow-hidden">
          <div className="text-[10px] font-medium text-zinc-500 mb-2">処理中の項目</div>
          <div className="space-y-1.5">
            {STUDENTS.slice(0, 3).map((s, i) => (
              <div key={s.name} className="flex items-center gap-2 text-[11px]">
                <span className="w-3 h-3 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" style={{ animationDelay: `${i * 0.2}s` }} />
                <span className="text-zinc-700">{s.name}</span>
                <span className="text-zinc-400">·</span>
                <span className="text-zinc-600">{s.subject}</span>
                <span className="ml-auto text-[10px] text-zinc-500">{s.chapter}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SceneWrapper>
  );
}

function PipelineStep({
  label,
  done,
  active,
  icon,
}: {
  label: string;
  done: boolean;
  active?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <span
        className={`w-7 h-7 rounded-full inline-flex items-center justify-center transition-all ${
          done
            ? "bg-emerald-500 text-white"
            : active
            ? "bg-blue-500 text-white animate-pulse"
            : "bg-zinc-100 text-zinc-400"
        }`}
      >
        {icon}
      </span>
      <span className={`font-medium ${done || active ? "text-zinc-800" : "text-zinc-400"}`}>
        {label}
      </span>
    </div>
  );
}

function SceneDone({ visible, progress }: { visible: boolean; progress: number }) {
  const sheets = Math.min(5, Math.floor(progress * 6));
  return (
    <SceneWrapper visible={visible}>
      <div className="p-4 sm:p-5 h-full flex flex-col items-center justify-center text-center bg-gradient-to-b from-zinc-50 to-emerald-50/30">
        <div className="relative mb-4">
          {/* Printer */}
          <div className="w-32 sm:w-40 h-20 sm:h-24 rounded-xl bg-zinc-800 shadow-2xl relative">
            <div className="absolute top-2 inset-x-2 h-3 bg-zinc-900 rounded-md" />
            <div className="absolute top-7 right-3 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="absolute bottom-3 left-3 right-3 h-2 rounded bg-zinc-700" />
            {/* Slot */}
            <div className="absolute top-7 inset-x-6 h-1 bg-black rounded-full" />
          </div>

          {/* Paper coming out */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex flex-col-reverse items-center pointer-events-none">
            {Array.from({ length: sheets }).map((_, i) => {
              const yOffset = -(i + 1) * 6;
              return (
                <div
                  key={i}
                  className="w-20 sm:w-24 h-24 sm:h-28 bg-white rounded shadow-md border border-zinc-200 mb-[-90px]"
                  style={{
                    transform: `translateY(${yOffset}px) rotate(${(i % 2 === 0 ? 1 : -1) * (i * 0.8)}deg)`,
                    transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1)",
                    zIndex: 10 - i,
                  }}
                >
                  <div className="p-2 space-y-1">
                    <div className="h-1.5 bg-zinc-200 rounded w-3/4" />
                    <div className="h-1 bg-zinc-100 rounded w-full" />
                    <div className="h-1 bg-zinc-100 rounded w-5/6" />
                    <div className="h-1 bg-zinc-100 rounded w-4/6" />
                    <div className="h-1 bg-zinc-100 rounded w-full mt-2" />
                    <div className="h-1 bg-zinc-100 rounded w-3/5" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-32 sm:mt-36">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-semibold mb-2">
            <CheckCircle2 className="w-4 h-4" />
            印刷完了
          </div>
          <div className="text-sm sm:text-base font-bold text-zinc-900">
            48枚のプリントが教室で出力されました
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            ホーム画面のボタン1回で、ここまで全自動。
          </div>
        </div>
      </div>
    </SceneWrapper>
  );
}
