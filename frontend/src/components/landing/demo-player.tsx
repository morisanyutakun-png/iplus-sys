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
  ArrowRight,
} from "lucide-react";

type Scene = {
  id: "materials" | "assign" | "mastery" | "print";
  page: string;
  title: string;
  subtitle: string;
  durationMs: number;
};

const SCENES: Scene[] = [
  {
    id: "materials",
    page: "/materials",
    title: "1. 教材を登録する",
    subtitle: "「英単語ターゲット1900」を新規追加 → 章を1つ作る",
    durationMs: 6000,
  },
  {
    id: "assign",
    page: "/students",
    title: "2. 生徒に割り当てる",
    subtitle: "田中 太郎さんに、いま作った教材をアサイン",
    durationMs: 5000,
  },
  {
    id: "mastery",
    page: "/students",
    title: "3. 定着度を入力する",
    subtitle: "85 / 100 → 合格 → 次の範囲が自動セット",
    durationMs: 6500,
  },
  {
    id: "print",
    page: "/print",
    title: "4. その生徒だけ印刷する",
    subtitle: "田中さん行の「印刷」ボタンでPDFが出力される",
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
              <span className="text-zinc-500">{scene.page}</span>
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono">
            {Math.round(totalProgress * 100)}%
          </div>
        </div>

        {/* App body */}
        <div className="flex h-[460px] sm:h-[520px] bg-white">
          {/* Sidebar (matches actual app) */}
          <aside className="hidden md:flex w-44 lg:w-52 flex-col bg-zinc-950 text-zinc-200 py-4 px-3 gap-0.5 text-xs flex-shrink-0">
            <div className="flex items-center gap-2 px-2 py-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm">
                i+
              </div>
              <span className="font-bold text-sm">iPlus Sys</span>
            </div>
            <NavItem icon={<LayoutDashboard className="w-3.5 h-3.5" />} label="ダッシュボード" />
            <NavItem icon={<Users className="w-3.5 h-3.5" />} label="生徒" active={scene.id === "assign" || scene.id === "mastery"} />
            <NavItem icon={<BookOpen className="w-3.5 h-3.5" />} label="教材管理" active={scene.id === "materials"} />
            <NavItem icon={<Languages className="w-3.5 h-3.5" />} label="単語テスト" />
            <NavItem icon={<FileText className="w-3.5 h-3.5" />} label="試験管理" />
            <NavItem icon={<Printer className="w-3.5 h-3.5" />} label="印刷" active={scene.id === "print"} />
            <NavItem icon={<UserCheck className="w-3.5 h-3.5" />} label="講師管理" />
            <NavItem icon={<Shield className="w-3.5 h-3.5" />} label="アカウント管理" />
          </aside>

          {/* Main */}
          <main className="flex-1 overflow-hidden relative bg-zinc-50">
            <SceneMaterials visible={scene.id === "materials"} progress={sceneProgress} />
            <SceneAssign visible={scene.id === "assign"} progress={sceneProgress} />
            <SceneMastery visible={scene.id === "mastery"} progress={sceneProgress} />
            <ScenePrint visible={scene.id === "print"} progress={sceneProgress} />
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

      {/* Scene caption */}
      <div className="mt-4 rounded-xl bg-zinc-900 text-white px-4 py-3 flex items-start gap-3">
        <div className="rounded-full bg-orange-500/20 text-orange-400 w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {sceneIdx + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{scene.title}</div>
          <div className="text-xs text-zinc-400 mt-0.5">{scene.subtitle}</div>
        </div>
        <div className="text-[10px] text-zinc-500 font-mono hidden sm:block">
          {scene.page}
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
   SCENE 1 — 教材管理ページ
   /materials のレイアウト：
   - ヘッダ「教材管理」+ 検索 + [+ 教材追加]
   - 教科グルーピングで色分け（英語=rose）
   - 教材カードに ●●● ノードドット
   ============================================================ */
function SceneMaterials({ visible, progress }: { visible: boolean; progress: number }) {
  // Phase: 0..0.25 = 開く, 0.25..0.55 = ダイアログ表示と入力, 0.55..0.75 = 保存しカード出現, 0.75..1 = 章追加してドット増加
  const showDialog = progress > 0.18 && progress < 0.55;
  const inputProgress = Math.max(0, Math.min(1, (progress - 0.25) / 0.25));
  const cardCreated = progress > 0.55;
  const cardPulse = progress > 0.55 && progress < 0.66;
  const showNodeAdded = progress > 0.78;

  const newMaterialName = "英単語ターゲット1900";
  const typedName = newMaterialName.slice(0, Math.floor(newMaterialName.length * inputProgress));

  return (
    <SceneWrapper visible={visible}>
      <div className="p-4 sm:p-5 h-full overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900">教材管理</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">5 教材</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">42 範囲</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">5 教科</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="hidden sm:block text-xs px-3 py-1.5 rounded-md border border-zinc-200 w-44 text-zinc-500"
              placeholder="教材を検索..."
              readOnly
            />
            <button
              className="text-xs px-3 py-1.5 rounded-md bg-gradient-to-r from-orange-500 to-red-600 text-white font-medium shadow inline-flex items-center gap-1"
              style={{
                transform: progress < 0.18 ? "scale(1.04)" : "scale(1)",
                boxShadow: progress < 0.18 ? "0 0 0 6px rgba(244,63,94,0.18)" : "",
                transition: "all 0.3s",
              }}
            >
              <Plus className="w-3 h-3" />
              教材追加
            </button>
          </div>
        </div>

        {/* Subject groups (existing) */}
        <div className="space-y-2">
          <SubjectHeader color="rose" icon={<Languages className="w-3.5 h-3.5" />} label="英語" count={cardCreated ? 3 : 2} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <MaterialCard name="システム英単語" nodes={["g","g","g","g","g","g","y","y","g","g"]} />
            <MaterialCard name="Vintage" nodes={["g","g","g","g","g","g","g","g","g","y","y","y"]} />
            {cardCreated && (
              <div
                className="col-span-1 sm:col-span-2"
                style={{
                  animation: "fadeSlideIn 0.5s cubic-bezier(0.16,1,0.3,1)",
                }}
              >
                <MaterialCard
                  name={newMaterialName}
                  nodes={showNodeAdded ? ["g"] : []}
                  highlight={cardPulse}
                  emptyHint={!showNodeAdded}
                />
              </div>
            )}
          </div>

          <SubjectHeader color="blue" icon={<BookOpen className="w-3.5 h-3.5" />} label="数学" count={2} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 opacity-60">
            <MaterialCard name="基礎問題精講 IA" nodes={["g","g","g","g","y","y","y"]} />
            <MaterialCard name="青チャート IIB" nodes={["g","g","g","y","y"]} />
          </div>
        </div>

        {/* New material dialog */}
        {showDialog && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div
              className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-zinc-200 p-4"
              style={{ animation: "fadeSlideIn 0.3s cubic-bezier(0.16,1,0.3,1)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-zinc-900">教材を追加</h3>
                <X className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-medium text-zinc-600">教材名</label>
                  <div className="mt-1 px-2.5 py-1.5 rounded-md border border-zinc-300 text-xs text-zinc-900 bg-white min-h-[28px]">
                    {typedName}
                    {inputProgress < 1 && <span className="inline-block w-px h-3 bg-zinc-900 ml-0.5 align-middle animate-pulse" />}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-zinc-600">教科</label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {["数学", "英語", "国語", "理科", "社会"].map((s) => {
                      const selected = s === "英語" && progress > 0.4;
                      return (
                        <span
                          key={s}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                            selected
                              ? "bg-rose-100 border-rose-300 text-rose-700 font-medium"
                              : "bg-white border-zinc-200 text-zinc-500"
                          }`}
                        >
                          {selected && <Check className="w-2.5 h-2.5 inline mr-0.5" />}
                          {s}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <button
                  className="w-full mt-2 text-xs px-3 py-2 rounded-md bg-gradient-to-r from-orange-500 to-red-600 text-white font-medium shadow"
                  style={{
                    transform: progress > 0.48 && progress < 0.55 ? "scale(0.97)" : "scale(1)",
                    transition: "transform 0.15s",
                  }}
                >
                  登録する
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast on success */}
        {progress > 0.56 && progress < 0.74 && (
          <Toast message="教材を登録しました" />
        )}
        {showNodeAdded && progress < 0.95 && (
          <Toast message="範囲を追加しました（PDF 1件）" />
        )}
      </div>
      <style jsx>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </SceneWrapper>
  );
}

function SubjectHeader({
  color,
  icon,
  label,
  count,
}: {
  color: "rose" | "blue" | "emerald" | "violet" | "amber";
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  const cls = {
    rose: "from-rose-500 to-red-600 text-rose-700",
    blue: "from-blue-500 to-indigo-600 text-blue-700",
    emerald: "from-emerald-500 to-green-600 text-emerald-700",
    violet: "from-violet-500 to-purple-600 text-violet-700",
    amber: "from-amber-500 to-orange-600 text-amber-700",
  }[color];
  const [grad, text] = cls.split(" ").reduce<string[]>((acc, c) => {
    if (c.includes("text")) acc[1] = c;
    else acc[0] = (acc[0] || "") + " " + c;
    return acc;
  }, ["", ""]);
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className={`inline-flex w-6 h-6 rounded-md items-center justify-center text-white bg-gradient-to-br ${grad}`}>
        {icon}
      </span>
      <span className={`font-bold text-xs ${text}`}>{label}</span>
      <span className="text-[10px] text-zinc-500">·</span>
      <span className="text-[10px] text-zinc-500">{count} 教材</span>
      <ChevronRight className="w-3 h-3 text-zinc-300 ml-auto rotate-90" />
    </div>
  );
}

function MaterialCard({
  name,
  nodes,
  highlight,
  emptyHint,
}: {
  name: string;
  nodes: string[];
  highlight?: boolean;
  emptyHint?: boolean;
}) {
  return (
    <div
      className="rounded-lg bg-white border p-2.5 transition-all"
      style={{
        borderColor: highlight ? "rgb(244 63 94)" : "rgb(228 228 231)",
        boxShadow: highlight ? "0 0 0 3px rgba(244,63,94,0.12)" : "",
      }}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div className="text-[12px] font-semibold text-zinc-900 truncate">{name}</div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-100 text-zinc-600">
            {nodes.length} 範囲
          </span>
          <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
            PDF {nodes.filter((n) => n === "g").length}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        {nodes.length === 0 ? (
          <span className="text-[10px] text-zinc-400">
            {emptyHint ? "範囲を追加してください" : "—"}
          </span>
        ) : (
          nodes.map((c, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                c === "g" ? "bg-emerald-500" : "bg-zinc-300"
              }`}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ============================================================
   SCENE 2 — 生徒画面 / 割り当て管理タブ
   左に生徒リスト、右に詳細パネル（タブ4枚）
   ============================================================ */
function SceneAssign({ visible, progress }: { visible: boolean; progress: number }) {
  const showAdded = progress > 0.55;
  const cardPulse = progress > 0.55 && progress < 0.7;
  const buttonHover = progress > 0.3 && progress < 0.55;

  return (
    <SceneWrapper visible={visible}>
      <div className="h-full flex">
        {/* Student list */}
        <aside className="hidden md:flex flex-col w-44 border-r border-zinc-200 bg-white">
          <div className="px-3 py-2.5 border-b border-zinc-100">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">生徒一覧</div>
          </div>
          <div className="flex-1 overflow-hidden py-1">
            {[
              { name: "佐藤 花子", grade: "高3", initial: "佐", pct: 72 },
              { name: STUDENT.name, grade: STUDENT.grade, initial: STUDENT.initial, pct: 58, active: true },
              { name: "鈴木 あい", grade: "高3", initial: "鈴", pct: 81 },
              { name: "山田 健", grade: "高1", initial: "山", pct: 35 },
              { name: "高橋 美咲", grade: "高3", initial: "高", pct: 64 },
            ].map((s) => (
              <div
                key={s.name}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs ${
                  s.active ? "bg-orange-50 border-l-2 border-orange-500" : "border-l-2 border-transparent"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                    s.active
                      ? "bg-gradient-to-br from-orange-500 to-red-600"
                      : "bg-zinc-300"
                  }`}
                >
                  {s.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium truncate ${s.active ? "text-zinc-900" : "text-zinc-700"}`}>
                    {s.name}
                  </div>
                  <div className="text-[9px] text-zinc-500">{s.grade} · {s.pct}%</div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Detail panel */}
        <main className="flex-1 overflow-hidden bg-zinc-50">
          <div className="p-4">
            {/* Student header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-xs font-bold text-white">
                {STUDENT.initial}
              </div>
              <div>
                <div className="text-base font-bold text-zinc-900">{STUDENT.name}</div>
                <div className="text-[10px] text-zinc-500">{STUDENT.grade} · 平均進捗 58%</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-3 text-[11px] border-b border-zinc-200">
              <Tab icon={<ClipboardCheck className="w-3 h-3" />} label="定着度入力" />
              <Tab icon={<BookOpen className="w-3 h-3" />} label="割り当て管理" active />
              <Tab icon={<BarChart3 className="w-3 h-3" />} label="分析" />
              <Tab icon={<Users className="w-3 h-3" />} label="生徒一覧" />
            </div>

            {/* Assigned section */}
            <div className="rounded-lg bg-white border border-blue-200 p-3 mb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[11px] font-semibold text-zinc-800">割り当て中</span>
                <span className="text-[10px] text-zinc-500 ml-auto">
                  {showAdded ? "3" : "2"} 教材
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <AssignedMaterial name="システム英単語" pct={72} />
                <AssignedMaterial name="基礎問題精講 IA" pct={45} />
                {showAdded && (
                  <div
                    style={{
                      animation: "fadeSlideIn 0.45s cubic-bezier(0.16,1,0.3,1)",
                    }}
                  >
                    <AssignedMaterial
                      name="英単語ターゲット1900"
                      pct={0}
                      highlight={cardPulse}
                      isNew
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Available section */}
            <div className="rounded-lg bg-white border border-emerald-200 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[11px] font-semibold text-zinc-800">追加可能な教材</span>
                <span className="text-[10px] text-zinc-500 ml-auto">クリックで割り当て</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <AvailableCard name="Vintage" />
                <AvailableCard
                  name="英単語ターゲット1900"
                  hover={buttonHover && !showAdded}
                  hidden={showAdded}
                />
                <AvailableCard name="青チャート IIB" />
              </div>
            </div>
          </div>

          {/* Cursor moving toward "英単語ターゲット1900" available card */}
          {progress > 0.05 && progress < 0.55 && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${36 + Math.min(0.95, progress * 1.6) * 28}%`,
                top: `${85 - Math.min(0.95, progress * 1.6) * 14}%`,
                transition: "left 1.2s cubic-bezier(0.4,0,0.2,1), top 1.2s cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <CursorIcon clicking={progress > 0.48 && progress < 0.56} />
            </div>
          )}

          {showAdded && progress < 0.78 && (
            <Toast message={`${STUDENT.name}さんに「英単語ターゲット1900」を割り当てました`} />
          )}
        </main>
      </div>
      <style jsx>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </SceneWrapper>
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
        active
          ? "border-orange-500 text-zinc-900 font-medium"
          : "border-transparent text-zinc-500"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}

function AssignedMaterial({
  name,
  pct,
  highlight,
  isNew,
}: {
  name: string;
  pct: number;
  highlight?: boolean;
  isNew?: boolean;
}) {
  const color = pct >= 70 ? "emerald" : pct >= 40 ? "blue" : pct === 0 ? "zinc" : "amber";
  const colorMap = {
    emerald: "stroke-emerald-500 text-emerald-700",
    blue: "stroke-blue-500 text-blue-700",
    amber: "stroke-amber-500 text-amber-700",
    zinc: "stroke-zinc-400 text-zinc-500",
  } as const;
  return (
    <div
      className="rounded-lg bg-white border p-2.5 text-center transition-all"
      style={{
        borderColor: highlight ? "rgb(244 63 94)" : "rgb(228 228 231)",
        boxShadow: highlight ? "0 0 0 3px rgba(244,63,94,0.15)" : "",
      }}
    >
      <div className="relative inline-flex items-center justify-center mb-1">
        <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
          <circle cx="22" cy="22" r="18" stroke="rgb(228 228 231)" strokeWidth="3" fill="none" />
          <circle
            cx="22"
            cy="22"
            r="18"
            className={colorMap[color]}
            strokeWidth="3"
            fill="none"
            strokeDasharray={`${(pct / 100) * 113} 113`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s" }}
          />
        </svg>
        <span className={`absolute text-[11px] font-bold ${colorMap[color].split(" ")[1]}`}>
          {pct}%
        </span>
      </div>
      <div className="text-[10px] font-medium text-zinc-700 leading-tight truncate">{name}</div>
      <div className="flex items-center justify-center gap-0.5 mt-1.5 text-[9px]">
        <button className="px-1 py-0.5 rounded bg-zinc-100 text-zinc-600">−</button>
        <span className="px-1.5 py-0.5 bg-zinc-50 rounded text-zinc-700 tabular-nums">
          {isNew ? "1/100" : "32/100"}
        </span>
        <button className="px-1 py-0.5 rounded bg-zinc-100 text-zinc-600">+</button>
      </div>
    </div>
  );
}

function AvailableCard({
  name,
  hover,
  hidden,
}: {
  name: string;
  hover?: boolean;
  hidden?: boolean;
}) {
  if (hidden) return <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 h-full min-h-[64px]" />;
  return (
    <div
      className={`rounded-lg border bg-white p-2.5 text-center cursor-pointer transition-all ${
        hover
          ? "border-emerald-400 bg-emerald-50 shadow-md"
          : "border-zinc-200 hover:border-emerald-300"
      }`}
      style={{
        transform: hover ? "scale(1.04)" : "scale(1)",
      }}
    >
      <Plus className={`w-4 h-4 mx-auto mb-1 ${hover ? "text-emerald-600" : "text-zinc-400"}`} />
      <div className="text-[10px] font-medium text-zinc-700 truncate">{name}</div>
      <div className="text-[9px] text-zinc-500 mt-0.5">100 範囲</div>
    </div>
  );
}

/* ============================================================
   SCENE 3 — 定着度入力スプレッドシート
   /students の「定着度入力」タブ
   行: 教材名 / 現在範囲 / 未実施 / 得点 / 満点 / 合格 / 次回
   ============================================================ */
function SceneMastery({ visible, progress }: { visible: boolean; progress: number }) {
  // Phase: 0..0.1 instructor select, 0.1..0.4 type score, 0.4..0.55 type max, 0.55..0.65 click pass, 0.65..0.85 hit save, 0.85..1 result
  const instructorPicked = progress > 0.08;
  const scoreTyped = Math.min(85, Math.floor(Math.max(0, (progress - 0.12) * 220)));
  const maxTyped = progress > 0.4 ? Math.min(100, Math.floor((progress - 0.4) * 240)) : 0;
  const passClicked = progress > 0.58;
  const saveClicked = progress > 0.7 && progress < 0.78;
  const showResult = progress > 0.78;

  return (
    <SceneWrapper visible={visible}>
      <div className="h-full flex">
        {/* Student list (compact) */}
        <aside className="hidden md:flex flex-col w-32 border-r border-zinc-200 bg-white py-2 px-1.5 gap-0.5">
          <div className="text-[9px] font-semibold text-zinc-500 px-1.5 mb-1 uppercase">生徒</div>
          {["佐藤 花子", STUDENT.name, "鈴木 あい", "山田 健"].map((n) => {
            const active = n === STUDENT.name;
            return (
              <div
                key={n}
                className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] ${
                  active ? "bg-orange-50 text-zinc-900 font-medium border-l-2 border-orange-500" : "text-zinc-600"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full inline-flex items-center justify-center text-[8px] text-white font-bold ${
                    active ? "bg-gradient-to-br from-orange-500 to-red-600" : "bg-zinc-300"
                  }`}
                >
                  {n[0]}
                </span>
                <span className="truncate">{n}</span>
              </div>
            );
          })}
        </aside>

        <main className="flex-1 overflow-hidden bg-zinc-50 p-3 sm:p-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-[11px] font-bold text-white">
              {STUDENT.initial}
            </div>
            <div className="text-sm font-bold text-zinc-900">{STUDENT.name}</div>
          </div>
          <div className="flex gap-1 mb-2 text-[11px] border-b border-zinc-200">
            <Tab icon={<ClipboardCheck className="w-3 h-3" />} label="定着度入力" active />
            <Tab icon={<BookOpen className="w-3 h-3" />} label="割り当て管理" />
            <Tab icon={<BarChart3 className="w-3 h-3" />} label="分析" />
          </div>

          {/* Toolbar */}
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
              {showResult ? "0/3" : passClicked ? "1/3" : maxTyped >= 100 ? "0/3 入力中" : "0/3"} 件入力済
            </span>
            <button className="text-[10px] px-2 py-1 rounded border border-zinc-200 bg-white inline-flex items-center gap-1 text-zinc-600">
              <RotateCcw className="w-3 h-3" /> リセット
            </button>
            <button
              className="text-[10px] px-2.5 py-1 rounded bg-gradient-to-r from-orange-500 to-red-600 text-white font-medium inline-flex items-center gap-1 shadow"
              style={{
                transform: saveClicked ? "scale(0.96)" : progress > 0.62 && !showResult ? "scale(1.04)" : "scale(1)",
                boxShadow: progress > 0.62 && !showResult ? "0 0 0 4px rgba(244,63,94,0.18)" : "",
              }}
            >
              <Upload className="w-3 h-3" /> 反映 (Ctrl+S)
            </button>
          </div>

          {/* Spreadsheet */}
          <div className="rounded-lg bg-white border border-zinc-200 overflow-hidden text-[11px]">
            <SpreadsheetRow label="教材名" labelBg="bg-zinc-900 text-white" cells={[
              { content: "システム英単語", subtle: true },
              { content: "英単語ターゲット1900", focus: true },
              { content: "基礎問題精講 IA", subtle: true },
            ]} />
            <SpreadsheetRow label="現在の範囲" labelBg="bg-zinc-50 text-zinc-700" cells={[
              { content: "501-600", subtle: true },
              { content: "1-100", focus: true },
              { content: "第3章 二次関数", subtle: true },
            ]} />
            <SpreadsheetRow label="未実施" labelBg="bg-amber-50 text-amber-900" cells={[
              { content: <Checkbox checked={false} />, center: true, subtle: true },
              { content: <Checkbox checked={false} />, center: true, focus: true },
              { content: <Checkbox checked={true} />, center: true, dimmed: true },
            ]} />
            <SpreadsheetRow label="得点" labelBg="bg-amber-50 text-amber-900" cells={[
              { content: <CellInput value="" />, subtle: true },
              { content: <CellInput value={scoreTyped > 0 ? String(scoreTyped) : ""} cursor={progress > 0.12 && progress < 0.4} highlight />, focus: true },
              { content: <CellInput value="" disabled />, dimmed: true },
            ]} />
            <SpreadsheetRow label="満点" labelBg="bg-amber-50 text-amber-900" cells={[
              { content: <CellInput value="" />, subtle: true },
              { content: <CellInput value={maxTyped > 0 ? String(maxTyped) : ""} cursor={progress > 0.4 && progress < 0.55} highlight />, focus: true },
              { content: <CellInput value="" disabled />, dimmed: true },
            ]} />
            <SpreadsheetRow label="合格" labelBg="bg-amber-50 text-amber-900" cells={[
              { content: <Checkbox checked={false} />, center: true, subtle: true },
              { content: <Checkbox checked={passClicked} pulse={progress > 0.55 && progress < 0.62} />, center: true, focus: true, success: passClicked },
              { content: <span className="text-zinc-400">—</span>, center: true, dimmed: true },
            ]} />
            <SpreadsheetRow label="次回の範囲" labelBg="bg-zinc-50 text-zinc-700" cells={[
              { content: <span className="text-zinc-400">—</span>, subtle: true },
              {
                content: showResult ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <ArrowRight className="w-3 h-3" /> 101-200
                  </span>
                ) : (
                  <span className="text-zinc-400">—</span>
                ),
                focus: true,
                success: showResult,
              },
              { content: <span className="text-zinc-400">↻ 再実施予定</span>, dimmed: true },
            ]} />
          </div>

          {showResult && progress < 0.96 && (
            <Toast message="採点お疲れ様でした。返却お願いします。" />
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
    subtle?: boolean;
    focus?: boolean;
    dimmed?: boolean;
    center?: boolean;
    success?: boolean;
  }>;
}) {
  return (
    <div className="grid grid-cols-[80px_repeat(3,1fr)] border-b border-zinc-100 last:border-b-0">
      <div className={`px-2 py-1.5 text-[10px] font-semibold ${labelBg}`}>{label}</div>
      {cells.map((c, i) => (
        <div
          key={i}
          className={`px-2 py-1.5 border-l border-zinc-100 ${
            c.success
              ? "bg-emerald-50/60"
              : c.focus
              ? "bg-orange-50/40 ring-1 ring-orange-300/40 ring-inset"
              : c.dimmed
              ? "bg-zinc-50/60 opacity-50"
              : c.subtle
              ? ""
              : ""
          } ${c.center ? "text-center" : ""}`}
        >
          {c.content}
        </div>
      ))}
    </div>
  );
}

function CellInput({
  value,
  cursor,
  disabled,
  highlight,
}: {
  value: string;
  cursor?: boolean;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`min-h-[20px] text-[11px] tabular-nums ${
        disabled ? "text-zinc-400" : highlight ? "text-zinc-900 font-semibold" : "text-zinc-800"
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
        checked
          ? "bg-emerald-500 border-emerald-500"
          : "bg-white border-zinc-300"
      } ${pulse ? "ring-2 ring-emerald-300 ring-offset-1" : ""}`}
    >
      {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
    </span>
  );
}

/* ============================================================
   SCENE 4 — 印刷ページ
   /print：生徒ごとにグループ化されたキュー、行ごとに「印刷」ボタン
   ============================================================ */
function ScenePrint({ visible, progress }: { visible: boolean; progress: number }) {
  const showJobItems = progress > 0.05;
  const cursorOnButton = progress > 0.32 && progress < 0.5;
  const buttonClicked = progress > 0.46 && progress < 0.55;
  const sending = progress > 0.5 && progress < 0.78;
  const completed = progress > 0.78;

  return (
    <SceneWrapper visible={visible}>
      <div className="h-full overflow-hidden p-3 sm:p-4 bg-zinc-50">
        {/* Header */}
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

        {/* Tabs */}
        <div className="flex gap-1 mb-3 text-[11px] border-b border-zinc-200">
          <Tab icon={<Printer className="w-3 h-3" />} label="キュー [3件]" active />
          <Tab icon={<FileText className="w-3 h-3" />} label="ジョブ履歴" />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[10px]">
          <button className="px-2 py-1 rounded border border-zinc-200 bg-white text-zinc-600 inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> 手動追加
          </button>
          <span className="ml-auto text-[10px] text-zinc-500">3件 / 1名</span>
        </div>

        {/* Other students (collapsed cards) */}
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
            boxShadow:
              cursorOnButton || buttonClicked
                ? "0 0 0 4px rgba(244,115,22,0.10)"
                : "",
          }}
        >
          {/* Header */}
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
                { mat: "英単語ターゲット1900", node: "1-100", type: "問題" },
                { mat: "システム英単語", node: "501-600", type: "問題" },
              ].map((row, i) => (
                <PrintRow
                  key={i}
                  row={row}
                  i={i}
                  state={completed ? "done" : sending ? "sending" : "pending"}
                />
              ))}
          </div>

          {/* 解答 group */}
          <div className="bg-amber-50/50 px-3 py-1.5 border-y border-amber-100 flex items-center gap-2 text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white font-medium">解答</span>
            <span className="text-zinc-600">1件</span>
          </div>
          <div>
            {showJobItems && (
              <PrintRow
                row={{ mat: "英単語ターゲット1900", node: "1-100", type: "解答" }}
                i={0}
                state={completed ? "done" : sending ? "sending" : "pending"}
              />
            )}
          </div>
        </div>

        {/* Cursor */}
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

        {/* Print preview window */}
        {sending && (
          <div className="absolute inset-x-4 sm:inset-x-12 bottom-4 rounded-xl bg-white border-2 border-zinc-300 shadow-2xl p-3"
               style={{ animation: "fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
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
          <div className="absolute inset-x-4 sm:inset-x-12 bottom-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 shadow-2xl p-3 flex items-center gap-3"
               style={{ animation: "fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
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
      <span className="col-span-3 text-zinc-600">{row.node}</span>
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
      {clicking && (
        <span className="absolute -inset-2 rounded-full bg-orange-400/40 animate-ping" />
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
