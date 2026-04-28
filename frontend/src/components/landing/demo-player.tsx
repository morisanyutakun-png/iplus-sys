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
  ChevronDown,
  Eye,
  Trash2,
  Upload,
  Check,
  X,
  Loader2,
  CheckCircle2,
  Calculator,
  Languages as LangIcon,
  Save,
  Package,
  User,
  Search,
  Settings2,
} from "lucide-react";

type Scene = {
  id: "materials" | "students_select" | "assign" | "mastery" | "reflected" | "print";
  page: string;
  title: string;
  subtitle: string;
  durationMs: number;
};

const SCENES: Scene[] = [
  {
    id: "materials",
    page: "/materials",
    title: "1. 教材を作る",
    subtitle: "「+ 教材追加」→ 教材名・教科を入れて登録 → 章を1つ追加",
    durationMs: 6000,
  },
  {
    id: "students_select",
    page: "/students",
    title: "2. 生徒を選ぶ",
    subtitle: "生徒切替セレクタで田中 太郎さんを選択",
    durationMs: 3500,
  },
  {
    id: "assign",
    page: "/students?tab=materials",
    title: "3. 割り当て管理タブで教材を追加",
    subtitle: "「追加可能な教材」から いま作った教材をクリック",
    durationMs: 5000,
  },
  {
    id: "mastery",
    page: "/students?tab=mastery",
    title: "4. 定着度入力タブで結果を入れる",
    subtitle: "講師選択 → 得点・満点・合格 → 「反映 (Ctrl+S)」",
    durationMs: 7000,
  },
  {
    id: "reflected",
    page: "/students?tab=mastery",
    title: "5. 反映 → 進捗が次の章へ自動進行",
    subtitle: "「次回の範囲」が自動で更新／円形プログレスも進む",
    durationMs: 4500,
  },
  {
    id: "print",
    page: "/print",
    title: "6. 印刷ページで個別印刷",
    subtitle: "田中さんの行の「印刷」ボタン → 問題＋解答が1つのPDFに",
    durationMs: 6000,
  },
];

const TOTAL_MS = SCENES.reduce((a, s) => a + s.durationMs, 0);

const STUDENT = { id: "S0042", name: "田中 太郎", grade: "高3", initial: "田" };
const NEW_MATERIAL = "ターゲット1900";

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

        <div className="flex h-[480px] sm:h-[540px] bg-white">
          {/* Sidebar — actual 8 items */}
          <aside className="hidden md:flex w-44 lg:w-52 flex-col bg-zinc-950 text-zinc-200 py-4 px-3 gap-0.5 text-xs flex-shrink-0">
            <div className="flex items-center gap-2 px-2 py-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm">
                i+
              </div>
              <span className="font-bold text-sm">iPlus Sys</span>
            </div>
            <NavItem icon={<LayoutDashboard className="w-3.5 h-3.5" />} label="ダッシュボード" />
            <NavItem
              icon={<Users className="w-3.5 h-3.5" />}
              label="生徒"
              active={
                scene.id === "students_select" ||
                scene.id === "assign" ||
                scene.id === "mastery" ||
                scene.id === "reflected"
              }
            />
            <NavItem icon={<BookOpen className="w-3.5 h-3.5" />} label="教材管理" active={scene.id === "materials"} />
            <NavItem icon={<LangIcon className="w-3.5 h-3.5" />} label="単語テスト" />
            <NavItem icon={<FileText className="w-3.5 h-3.5" />} label="試験管理" />
            <NavItem icon={<Printer className="w-3.5 h-3.5" />} label="印刷" active={scene.id === "print"} />
            <NavItem icon={<UserCheck className="w-3.5 h-3.5" />} label="講師管理" />
            <NavItem icon={<Shield className="w-3.5 h-3.5" />} label="アカウント管理" />
          </aside>

          <main className="flex-1 overflow-hidden relative bg-zinc-50">
            <SceneMaterials visible={scene.id === "materials"} progress={sceneProgress} />
            <SceneStudentsSelect visible={scene.id === "students_select"} progress={sceneProgress} />
            <SceneAssign visible={scene.id === "assign"} progress={sceneProgress} />
            <SceneMastery visible={scene.id === "mastery"} progress={sceneProgress} />
            <SceneReflected visible={scene.id === "reflected"} progress={sceneProgress} />
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
   SCENE 1 — /materials
   ヘッダ「教材管理」+ バッジ + 検索 + 「+ 教材追加」
   英語=rose、教材カードに ●範囲 PDFバッジ＋小ドット
   「+ 教材追加」ダイアログ：教材名 / 教科チップ / 「登録する」
   ============================================================ */
function SceneMaterials({ visible, progress }: { visible: boolean; progress: number }) {
  const showDialog = progress > 0.12 && progress < 0.55;
  const inputProgress = Math.max(0, Math.min(1, (progress - 0.18) / 0.22));
  const subjectPicked = progress > 0.38;
  const submitPress = progress > 0.5 && progress < 0.55;
  const cardCreated = progress > 0.55;
  const cardPulse = progress > 0.55 && progress < 0.66;
  const showNodeAdded = progress > 0.78;

  const typedName = NEW_MATERIAL.slice(0, Math.floor(NEW_MATERIAL.length * inputProgress));

  return (
    <SceneWrapper visible={visible}>
      <div className="p-4 sm:p-5 h-full overflow-hidden relative">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5 text-white" />
              </div>
              <h1 className="text-base sm:text-lg font-bold text-zinc-900">教材管理</h1>
            </div>
            <div className="flex items-center gap-1.5 mt-1 ml-9">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{cardCreated ? 6 : 5} 教材</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{showNodeAdded ? 43 : 42} 範囲</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600">5 教科</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center text-xs px-3 py-1.5 rounded-md border border-zinc-200 bg-white text-zinc-400 w-44">
              <Search className="w-3 h-3 mr-1.5" />
              教材を検索...
            </div>
            <button
              className="text-xs px-3 py-1.5 rounded-md bg-gradient-to-r from-orange-500 to-red-600 text-white font-medium shadow inline-flex items-center gap-1"
              style={{
                transform: progress < 0.12 ? "scale(1.05)" : "scale(1)",
                boxShadow: progress < 0.12 ? "0 0 0 6px rgba(244,63,94,0.18)" : "",
                transition: "all 0.3s",
              }}
            >
              <Plus className="w-3 h-3" />
              教材追加
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <SubjectGroupHeader color="rose" icon={<Languages className="w-3.5 h-3.5" />} label="英語" count={cardCreated ? 3 : 2} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <MaterialCard name="システム英単語" subject="rose" nodes={Array(10).fill("g")} />
            <MaterialCard name="Vintage" subject="rose" nodes={[...Array(9).fill("g"), "y", "y", "y"]} />
            {cardCreated && (
              <div
                className="col-span-1 sm:col-span-2"
                style={{ animation: "fadeSlideIn 0.5s cubic-bezier(0.16,1,0.3,1)" }}
              >
                <MaterialCard
                  name={NEW_MATERIAL}
                  subject="rose"
                  nodes={showNodeAdded ? ["g"] : []}
                  highlight={cardPulse}
                  emptyHint={!showNodeAdded}
                />
              </div>
            )}
          </div>
          <SubjectGroupHeader color="blue" icon={<BookOpen className="w-3.5 h-3.5" />} label="数学" count={2} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 opacity-50">
            <MaterialCard name="基礎問題精講 IA" subject="blue" nodes={Array(7).fill("g")} />
            <MaterialCard name="青チャート IIB" subject="blue" nodes={Array(5).fill("g")} />
          </div>
        </div>

        {/* "+教材追加" Dialog (matches actual: name + subject chips) */}
        {showDialog && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-4 z-20">
            <div
              className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-zinc-200 p-4"
              style={{ animation: "fadeSlideIn 0.3s cubic-bezier(0.16,1,0.3,1)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-zinc-900">教材を追加</h3>
                <X className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="space-y-3">
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
                    {[
                      { name: "数学", color: "blue" },
                      { name: "英語", color: "rose" },
                      { name: "国語", color: "emerald" },
                      { name: "理科", color: "violet" },
                      { name: "社会", color: "amber" },
                    ].map((s) => {
                      const selected = s.name === "英語" && subjectPicked;
                      return (
                        <span
                          key={s.name}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                            selected
                              ? "bg-rose-100 border-rose-300 text-rose-700 font-medium"
                              : "bg-white border-zinc-200 text-zinc-500"
                          }`}
                        >
                          {selected && <Check className="w-2.5 h-2.5 inline mr-0.5" />}
                          {s.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <button
                  className="w-full mt-1 text-xs px-3 py-2 rounded-md bg-gradient-to-r from-orange-500 to-red-600 text-white font-medium shadow"
                  style={{
                    transform: submitPress ? "scale(0.97)" : "scale(1)",
                    transition: "transform 0.15s",
                  }}
                >
                  登録する
                </button>
              </div>
            </div>
          </div>
        )}

        {progress > 0.56 && progress < 0.74 && <Toast message="教材を登録しました" />}
        {showNodeAdded && progress < 0.95 && <Toast message="範囲を追加しました（PDF 1件）" />}
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

function SubjectGroupHeader({
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
  const grad =
    color === "rose"
      ? "from-rose-500 to-red-600"
      : color === "blue"
      ? "from-blue-500 to-indigo-600"
      : color === "emerald"
      ? "from-emerald-500 to-green-600"
      : color === "violet"
      ? "from-violet-500 to-purple-600"
      : "from-amber-500 to-orange-600";
  const text =
    color === "rose"
      ? "text-rose-700"
      : color === "blue"
      ? "text-blue-700"
      : color === "emerald"
      ? "text-emerald-700"
      : color === "violet"
      ? "text-violet-700"
      : "text-amber-700";
  const bg =
    color === "rose"
      ? "from-rose-50 to-red-50"
      : color === "blue"
      ? "from-blue-50 to-indigo-50"
      : color === "emerald"
      ? "from-emerald-50 to-green-50"
      : color === "violet"
      ? "from-violet-50 to-purple-50"
      : "from-amber-50 to-orange-50";
  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded-md bg-gradient-to-r ${bg}`}>
      <ChevronDown className="w-3 h-3 text-zinc-500" />
      <span className={`inline-flex w-5 h-5 rounded items-center justify-center text-white bg-gradient-to-br ${grad}`}>
        {icon}
      </span>
      <span className={`font-bold text-xs ${text}`}>{label}</span>
      <span className={`text-[10px] ml-auto px-1.5 py-0.5 rounded-full bg-white/60 ${text}`}>
        {count}
      </span>
    </div>
  );
}

function MaterialCard({
  name,
  subject,
  nodes,
  highlight,
  emptyHint,
}: {
  name: string;
  subject: "rose" | "blue";
  nodes: string[];
  highlight?: boolean;
  emptyHint?: boolean;
}) {
  const top =
    subject === "rose"
      ? "from-rose-500 to-red-600"
      : "from-blue-500 to-indigo-600";
  return (
    <div
      className="rounded-lg bg-white border p-2.5 transition-all relative overflow-hidden"
      style={{
        borderColor: highlight ? "rgb(244 63 94)" : "rgb(228 228 231)",
        boxShadow: highlight ? "0 0 0 3px rgba(244,63,94,0.12)" : "",
      }}
    >
      <div className={`absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r ${top}`} />
      <div className="flex items-start justify-between mb-1.5 mt-0.5">
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
      <div className="flex items-center gap-0.5 flex-wrap">
        {nodes.length === 0 ? (
          <span className="text-[10px] text-zinc-400">
            {emptyHint ? "範囲を追加してください" : "—"}
          </span>
        ) : (
          nodes.map((c, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                c === "g" ? "bg-emerald-500" : "bg-amber-300"
              }`}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ============================================================
   SCENE 2 — /students 生徒切り替え
   実画面: 上部に <select> 生徒切替 → 表示 / Pencil で編集
   ============================================================ */
function SceneStudentsSelect({ visible, progress }: { visible: boolean; progress: number }) {
  const dropOpen = progress > 0.22 && progress < 0.7;
  const studentPicked = progress > 0.55;

  return (
    <SceneWrapper visible={visible}>
      <div className="p-4 sm:p-5 h-full overflow-hidden bg-zinc-50">
        {/* Student switcher header (matches actual UI) */}
        <div className="flex items-center gap-3 mb-3 relative">
          <div
            className={`text-sm font-bold rounded-lg border px-3 py-1.5 bg-white inline-flex items-center gap-2 transition-all ${
              !studentPicked && dropOpen ? "ring-2 ring-orange-400 border-orange-400" : "border-zinc-300"
            }`}
            style={{ minWidth: 200 }}
          >
            <User className="w-3.5 h-3.5 text-zinc-500" />
            <span className="flex-1">{studentPicked ? `${STUDENT.name} (${STUDENT.grade})` : "佐藤 花子 (高3)"}</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <button className="w-7 h-7 rounded inline-flex items-center justify-center text-zinc-400 hover:text-zinc-700">
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-zinc-500">
            {studentPicked ? "3教材 · 進捗 58%" : "5教材 · 進捗 72%"}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3 text-[11px] border-b border-zinc-200">
          <Tab icon={<ClipboardCheck className="w-3 h-3" />} label="定着度入力" active />
          <Tab icon={<BookOpen className="w-3 h-3" />} label="割り当て管理" />
          <Tab icon={<BarChart3 className="w-3 h-3" />} label="分析" />
          <Tab icon={<Users className="w-3 h-3" />} label="生徒一覧" />
        </div>

        {/* Dimmed mastery preview */}
        <div className="rounded-lg bg-white border border-zinc-200 p-3 opacity-50">
          <div className="text-[10px] text-zinc-500">講師を選択 → 教材ごとに点数を入力 → 反映</div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded bg-zinc-100" />
            ))}
          </div>
        </div>

        {/* Dropdown panel showing student list */}
        {dropOpen && (
          <div
            className="absolute top-[58px] left-[20px] sm:left-[20px] w-64 rounded-lg bg-white border border-zinc-300 shadow-2xl z-20 overflow-hidden"
            style={{ animation: "fadeSlideIn 0.25s cubic-bezier(0.16,1,0.3,1)" }}
          >
            <div className="px-3 py-2 bg-zinc-50 border-b border-zinc-100 text-[10px] font-semibold text-zinc-500 uppercase">
              生徒を切り替え
            </div>
            {[
              { n: "佐藤 花子", g: "高3", cur: !studentPicked },
              { n: STUDENT.name, g: STUDENT.grade, cur: studentPicked, target: true },
              { n: "鈴木 あい", g: "高3" },
              { n: "山田 健", g: "高1" },
              { n: "高橋 美咲", g: "高3" },
            ].map((s) => (
              <div
                key={s.n}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs ${
                  s.cur
                    ? "bg-orange-50 border-l-2 border-orange-500 font-semibold text-zinc-900"
                    : s.target && progress > 0.32 && progress < 0.55
                    ? "bg-zinc-50"
                    : "text-zinc-700"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[9px] text-white font-bold ${
                    s.target
                      ? "bg-gradient-to-br from-orange-500 to-red-600"
                      : "bg-zinc-300"
                  }`}
                >
                  {s.n[0]}
                </span>
                <span className="flex-1">{s.n}</span>
                <span className="text-[10px] text-zinc-400">{s.g}</span>
                {s.cur && <Check className="w-3 h-3 text-orange-500" />}
              </div>
            ))}
          </div>
        )}

        {/* Cursor moving toward 田中 row */}
        {dropOpen && progress < 0.55 && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${15 + Math.min(0.95, (progress - 0.22) * 2.2) * 8}%`,
              top: `${22 + Math.min(0.95, (progress - 0.22) * 2.2) * 12}%`,
              transition: "all 0.7s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <CursorIcon clicking={progress > 0.5 && progress < 0.56} />
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
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
        active ? "border-orange-500 text-zinc-900 font-medium" : "border-transparent text-zinc-500"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}

/* ============================================================
   SCENE 3 — /students?tab=materials 割り当て管理
   実画面: 「割り当て中」(青枠) + 「追加可能な教材」(緑枠) + 円形プログレス + ステッパー
   フロー: 「追加可能な教材」から ターゲット1900 をクリック → 割り当て中に追加
   ============================================================ */
function SceneAssign({ visible, progress }: { visible: boolean; progress: number }) {
  const cursorActive = progress > 0.1 && progress < 0.6;
  const buttonClicked = progress > 0.5 && progress < 0.6;
  const newAssigned = progress > 0.55;
  const cardPulse = progress > 0.55 && progress < 0.7;

  return (
    <SceneWrapper visible={visible}>
      <div className="p-4 sm:p-5 h-full overflow-hidden bg-zinc-50 relative">
        {/* Student header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="text-sm font-bold rounded-lg border border-zinc-300 px-3 py-1.5 bg-white inline-flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-zinc-500" />
            <span>{STUDENT.name} ({STUDENT.grade})</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <span className="text-xs text-zinc-500">{newAssigned ? 3 : 2}教材 · 進捗 {newAssigned ? 39 : 58}%</span>
        </div>

        <div className="flex gap-1 mb-3 text-[11px] border-b border-zinc-200">
          <Tab icon={<ClipboardCheck className="w-3 h-3" />} label="定着度入力" />
          <Tab icon={<BookOpen className="w-3 h-3" />} label="割り当て管理" active />
          <Tab icon={<BarChart3 className="w-3 h-3" />} label="分析" />
          <Tab icon={<Users className="w-3 h-3" />} label="生徒一覧" />
        </div>

        {/* 割り当て中 (blue border, actual structure) */}
        <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/30 p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 inline-flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs font-bold text-blue-800">割り当て中</div>
              <div className="text-[9px] text-zinc-500">{newAssigned ? 3 : 2} 教材</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <AssignedCard name="システム英単語" pct={72} subject="rose" nodeCount="72/100" />
            <AssignedCard name="基礎問題精講 IA" pct={45} subject="blue" nodeCount="45/100" />
            {newAssigned ? (
              <div style={{ animation: "fadeSlideIn 0.45s cubic-bezier(0.16,1,0.3,1)" }}>
                <AssignedCard
                  name={NEW_MATERIAL}
                  pct={0}
                  subject="rose"
                  nodeCount="1/1"
                  pulse={cardPulse}
                  isNew
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/40" />
            )}
          </div>
        </div>

        {/* 追加可能な教材 (green border) */}
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 inline-flex items-center justify-center">
              <Package className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-800">追加可能な教材</div>
              <div className="text-[9px] text-zinc-500">クリックで割り当て</div>
            </div>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {newAssigned ? 3 : 4}件
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <AvailableCard name="Vintage" />
            <AvailableCard
              name={NEW_MATERIAL}
              hover={progress > 0.3 && progress < 0.55 && !newAssigned}
              hidden={newAssigned}
            />
            <AvailableCard name="青チャート IIB" />
            <AvailableCard name="現代文 入試問題集" />
          </div>
        </div>

        {/* Cursor moving toward "ターゲット1900" available card */}
        {cursorActive && !newAssigned && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${30 + Math.min(0.95, (progress - 0.1) * 2.0) * 12}%`,
              top: `${72 - Math.min(0.95, (progress - 0.1) * 2.0) * 5}%`,
              transition: "all 1s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <CursorIcon clicking={buttonClicked} />
          </div>
        )}

        {newAssigned && progress < 0.78 && (
          <Toast message={`「${NEW_MATERIAL}」を割り当てました`} />
        )}
      </div>
      <style jsx>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
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
  nodeCount,
  isNew,
}: {
  name: string;
  pct: number;
  pulse?: boolean;
  subject: "rose" | "blue" | "emerald";
  nodeCount: string;
  isNew?: boolean;
}) {
  const stroke =
    pct >= 90 ? "stroke-emerald-500" : pct >= 50 ? "stroke-blue-500" : pct > 0 ? "stroke-amber-500" : "stroke-zinc-300";
  const text =
    pct >= 90 ? "text-emerald-700" : pct >= 50 ? "text-blue-700" : pct > 0 ? "text-amber-700" : "text-zinc-500";

  return (
    <div
      className="rounded-2xl bg-white border p-2.5 relative transition-all"
      style={{
        borderColor: pulse ? "rgb(244 63 94)" : isNew ? "rgb(252 165 165)" : "rgb(228 228 231)",
        boxShadow: pulse ? "0 0 0 3px rgba(244,63,94,0.18)" : "",
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="relative">
          <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
            <circle cx="22" cy="22" r="18" stroke="rgb(228 228 231)" strokeWidth="3" fill="none" />
            <circle
              cx="22"
              cy="22"
              r="18"
              className={stroke}
              strokeWidth="3"
              fill="none"
              strokeDasharray={`${(pct / 100) * 113} 113`}
              strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.5s cubic-bezier(0.16,1,0.3,1)" }}
            />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${text}`}>
            {pct}%
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold text-zinc-900 truncate leading-tight">{name}</div>
          <div className="text-[9px] text-zinc-500 mt-0.5">{nodeCount} 完了</div>
        </div>
      </div>
      <div className="flex items-center gap-0.5 text-[9px]">
        <button className="w-5 h-5 rounded border border-zinc-300 bg-white text-zinc-600 inline-flex items-center justify-center">−</button>
        <div className="flex-1 h-5 bg-zinc-50 border-y border-zinc-200 inline-flex items-center justify-center text-zinc-700 font-mono">
          {nodeCount}
        </div>
        <button className="w-5 h-5 rounded border border-zinc-300 bg-white text-zinc-600 inline-flex items-center justify-center">+</button>
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
  if (hidden)
    return <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 h-14" />;
  return (
    <button
      className={`rounded-lg border bg-white p-2 text-center cursor-pointer transition-all ${
        hover
          ? "border-emerald-400 bg-emerald-50 shadow-md scale-[1.04]"
          : "border-zinc-200 hover:border-emerald-300"
      }`}
    >
      <Plus className={`w-3.5 h-3.5 mx-auto mb-0.5 ${hover ? "text-emerald-600" : "text-zinc-400"}`} />
      <div className="text-[10px] font-medium text-zinc-700 truncate">{name}</div>
    </button>
  );
}

/* ============================================================
   SCENE 4 — /students?tab=mastery 定着度入力
   実画面: ツールバー（日付 + 教材数 + 講師セレクト + 入力カウンタ + リセット + 反映 Ctrl+S）
   表: 7行（教材名 / 現在の範囲 / 未実施 / 得点 / 満点 / 合格 / 次回の範囲）
   教材名行: 教科色（黒い帯）。未実施・得点・満点・合格の行: 黄色背景。
   ============================================================ */
function SceneMastery({ visible, progress }: { visible: boolean; progress: number }) {
  const instructorPicked = progress > 0.1;
  const score1 = Math.min(85, Math.floor(Math.max(0, (progress - 0.15) * 200)));
  const max1 = progress > 0.42 ? 100 : 0;
  const pass1 = progress > 0.5;
  const score2 = progress > 0.55 ? Math.min(78, Math.floor((progress - 0.55) * 320)) : 0;
  const max2 = progress > 0.7 ? 100 : 0;
  const pass2 = progress > 0.78;
  const saveClicked = progress > 0.86 && progress < 0.95;

  return (
    <SceneWrapper visible={visible}>
      <div className="p-4 sm:p-5 h-full overflow-hidden bg-zinc-50">
        {/* Student header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="text-sm font-bold rounded-lg border border-zinc-300 px-3 py-1.5 bg-white inline-flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-zinc-500" />
            <span>{STUDENT.name} ({STUDENT.grade})</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <span className="text-xs text-zinc-500">3教材 · 進捗 39%</span>
        </div>

        <div className="flex gap-1 mb-2 text-[11px] border-b border-zinc-200">
          <Tab icon={<ClipboardCheck className="w-3 h-3" />} label="定着度入力" active />
          <Tab icon={<BookOpen className="w-3 h-3" />} label="割り当て管理" />
          <Tab icon={<BarChart3 className="w-3 h-3" />} label="分析" />
          <Tab icon={<Users className="w-3 h-3" />} label="生徒一覧" />
        </div>

        {/* Toolbar (matches actual: date / 教材数 / 講師セレクト | 入力カウンタ / リセット / 反映 Ctrl+S) */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[10px]">
          <span className="px-2 py-0.5 rounded border border-zinc-200 bg-white text-zinc-700">2026-04-28</span>
          <span className="text-zinc-500">3教材</span>
          <span className="text-zinc-300">|</span>
          <div
            className={`px-2 py-1 rounded inline-flex items-center gap-1 transition-all border ${
              instructorPicked
                ? "bg-white border-zinc-200 text-zinc-700"
                : "bg-amber-50 border-amber-300 text-amber-700"
            }`}
          >
            <UserCheck className="w-3 h-3" />
            {instructorPicked ? "佐々木 先生" : "講師を選択..."}
          </div>
          {(score1 > 0 || score2 > 0) && (
            <>
              <span className="ml-auto px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700 font-medium">
                {pass2 ? "2/2" : pass1 ? "1/2" : "0/2"} 件入力済
              </span>
              <button className="text-[10px] px-2 py-1 rounded inline-flex items-center gap-1 text-zinc-600 hover:bg-zinc-100">
                <RotateCcw className="w-3 h-3" /> リセット
              </button>
              <button
                className="text-[10px] px-2.5 py-1 rounded bg-gradient-to-r from-orange-500 to-red-600 text-white font-medium inline-flex items-center gap-1 shadow"
                style={{
                  transform: saveClicked ? "scale(0.95)" : pass2 ? "scale(1.05)" : "scale(1)",
                  boxShadow: pass2 && !saveClicked ? "0 0 0 4px rgba(244,63,94,0.20)" : "",
                  opacity: pass2 ? 1 : 0.6,
                }}
                disabled={!pass2}
              >
                <Upload className="w-3 h-3" /> 反映 (Ctrl+S)
              </button>
            </>
          )}
          {!score1 && !score2 && (
            <>
              <span className="ml-auto px-2 py-0.5 rounded border border-zinc-200 bg-white text-zinc-500">0/2件</span>
              <button className="text-[10px] px-2.5 py-1 rounded bg-zinc-200 text-zinc-400 inline-flex items-center gap-1">
                <Upload className="w-3 h-3" /> 反映 (Ctrl+S)
              </button>
            </>
          )}
        </div>

        {/* Spreadsheet — 7 rows × 3 cols (材料), matches real layout */}
        <div className="rounded-lg border border-zinc-200 overflow-hidden text-[11px] shadow-sm">
          {/* Row: 教材名 (subject color header) */}
          <SsRow label="教材名" labelClass="bg-zinc-900 text-white">
            <SsHeaderCell name="システム英単語" color="rose" />
            <SsHeaderCell name={NEW_MATERIAL} color="rose" highlight />
            <SsHeaderCell name="基礎問題精講 IA" color="blue" />
          </SsRow>
          {/* Row: 現在の範囲 */}
          <SsRow label="現在の範囲" labelClass="bg-zinc-100 text-zinc-500">
            <SsCell>501-600</SsCell>
            <SsCell highlight>1-100（新規）</SsCell>
            <SsCell>第3章 二次関数</SsCell>
          </SsRow>
          {/* Row: 未実施 (yellow row) */}
          <SsRow label="未実施" labelClass="bg-amber-50 text-amber-900 border-l-2 border-amber-400">
            <SsCell center><Checkbox checked={false} /></SsCell>
            <SsCell center highlight><Checkbox checked={false} /></SsCell>
            <SsCell center><Checkbox checked={false} /></SsCell>
          </SsRow>
          {/* Row: 得点 */}
          <SsRow label="得点" labelClass="bg-amber-50 text-amber-900 border-l-2 border-amber-400">
            <SsCell highlight={progress > 0.15 && progress < 0.42}>
              <ScoreField value={score1 || ""} cursor={progress > 0.15 && progress < 0.42} />
            </SsCell>
            <SsCell highlight={progress > 0.55 && progress < 0.7}>
              <ScoreField value={score2 || ""} cursor={progress > 0.55 && progress < 0.7} />
            </SsCell>
            <SsCell><span className="text-zinc-300">—</span></SsCell>
          </SsRow>
          {/* Row: 満点 */}
          <SsRow label="満点" labelClass="bg-amber-50 text-amber-900 border-l-2 border-amber-400">
            <SsCell><ScoreField value={max1 || ""} /></SsCell>
            <SsCell><ScoreField value={max2 || ""} /></SsCell>
            <SsCell><span className="text-zinc-300">—</span></SsCell>
          </SsRow>
          {/* Row: 合格 */}
          <SsRow label="合格" labelClass="bg-amber-50 text-amber-900 border-l-2 border-amber-400">
            <SsCell center success={pass1}><Checkbox checked={pass1} pulse={progress > 0.48 && progress < 0.55} /></SsCell>
            <SsCell center success={pass2}><Checkbox checked={pass2} pulse={progress > 0.76 && progress < 0.83} /></SsCell>
            <SsCell center><Checkbox checked={false} /></SsCell>
          </SsRow>
          {/* Row: 次回の範囲 */}
          <SsRow label="次回の範囲" labelClass="bg-zinc-100 text-zinc-500">
            <SsCell><span className="text-zinc-300">—</span></SsCell>
            <SsCell><span className="text-zinc-300">—</span></SsCell>
            <SsCell><span className="text-zinc-300">—</span></SsCell>
          </SsRow>
        </div>

        <div className="text-[10px] text-zinc-500 mt-1.5">
          ↑↓←→ で移動 / Space で合格切替 / Ctrl+S で反映 / Esc で抜ける
        </div>
      </div>
    </SceneWrapper>
  );
}

/* ============================================================
   SCENE 5 — 反映後（Toast＋次回の範囲が緑＋pointer +1）
   ============================================================ */
function SceneReflected({ visible, progress }: { visible: boolean; progress: number }) {
  const showToast = progress < 0.85;
  return (
    <SceneWrapper visible={visible}>
      <div className="p-4 sm:p-5 h-full overflow-hidden bg-zinc-50 relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-sm font-bold rounded-lg border border-zinc-300 px-3 py-1.5 bg-white inline-flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-zinc-500" />
            <span>{STUDENT.name} ({STUDENT.grade})</span>
          </div>
          <span className="text-xs text-zinc-500">3教材 · 進捗 41%</span>
        </div>

        <div className="flex gap-1 mb-2 text-[11px] border-b border-zinc-200">
          <Tab icon={<ClipboardCheck className="w-3 h-3" />} label="定着度入力" active />
          <Tab icon={<BookOpen className="w-3 h-3" />} label="割り当て管理" />
          <Tab icon={<BarChart3 className="w-3 h-3" />} label="分析" />
          <Tab icon={<Users className="w-3 h-3" />} label="生徒一覧" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[10px]">
          <span className="px-2 py-0.5 rounded border border-zinc-200 bg-white text-zinc-700">2026-04-28</span>
          <span className="text-zinc-500">3教材</span>
          <span className="text-zinc-300">|</span>
          <div className="px-2 py-1 rounded inline-flex items-center gap-1 bg-white border border-zinc-200 text-zinc-700">
            <UserCheck className="w-3 h-3" />
            佐々木 先生
          </div>
          <span className="ml-auto px-2 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 font-medium inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 反映完了
          </span>
        </div>

        <div className="rounded-lg border border-zinc-200 overflow-hidden text-[11px] shadow-sm">
          <SsRow label="教材名" labelClass="bg-zinc-900 text-white">
            <SsHeaderCell name="システム英単語" color="rose" />
            <SsHeaderCell name={NEW_MATERIAL} color="rose" />
            <SsHeaderCell name="基礎問題精講 IA" color="blue" subdued />
          </SsRow>
          <SsRow label="現在の範囲" labelClass="bg-zinc-100 text-zinc-500">
            <SsCell><span className="line-through text-zinc-400">501-600</span></SsCell>
            <SsCell><span className="line-through text-zinc-400">1-100</span></SsCell>
            <SsCell>第3章 二次関数</SsCell>
          </SsRow>
          <SsRow label="得点" labelClass="bg-zinc-50 text-zinc-500">
            <SsCell success><span className="font-semibold text-emerald-700 tabular-nums">85 / 100</span></SsCell>
            <SsCell success><span className="font-semibold text-emerald-700 tabular-nums">78 / 100</span></SsCell>
            <SsCell><span className="text-zinc-300">—</span></SsCell>
          </SsRow>
          <SsRow label="合格" labelClass="bg-zinc-50 text-zinc-500">
            <SsCell center success><Checkbox checked={true} /></SsCell>
            <SsCell center success><Checkbox checked={true} /></SsCell>
            <SsCell center><span className="text-zinc-400">—</span></SsCell>
          </SsRow>
          <SsRow label="次回の範囲" labelClass="bg-emerald-50 text-emerald-700 border-l-2 border-emerald-400">
            <SsCell success>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                <ChevronRight className="w-3 h-3" /> 601-700
              </span>
            </SsCell>
            <SsCell success>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                <ChevronRight className="w-3 h-3" /> 101-200
              </span>
            </SsCell>
            <SsCell><span className="text-zinc-300">—</span></SsCell>
          </SsRow>
        </div>

        {/* Pointer auto-advance hint */}
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center gap-2 text-[11px] text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>
            <strong>システム英単語</strong>のポインタが <code className="bg-white px-1 rounded text-[10px]">1/100</code> から
            <code className="bg-white px-1 rounded text-[10px] ml-1">2/100</code> に進みました。
            <strong className="ml-1">{NEW_MATERIAL}</strong>も同様に次へ。
          </span>
        </div>

        {showToast && <Toast message="採点お疲れ様でした。返却お願いします。" />}
      </div>
    </SceneWrapper>
  );
}

/* ============================================================
   SCENE 6 — /print 個別印刷
   実画面: 生徒ごとにグループ化 → 問題セクション・解答セクション → 各生徒行右に「印刷」ボタン
   ============================================================ */
function ScenePrint({ visible, progress }: { visible: boolean; progress: number }) {
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
            <div className="text-[10px] text-zinc-500">印刷キュー・ジョブ履歴</div>
          </div>
        </div>

        <div className="flex gap-1 mb-3 text-[11px] border-b border-zinc-200">
          <Tab icon={<Printer className="w-3 h-3" />} label="キュー [3件]" active />
          <Tab icon={<FileText className="w-3 h-3" />} label="ジョブ履歴" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[10px]">
          <span className="px-1.5 py-0.5 rounded border border-zinc-200 bg-white text-zinc-700">問題+解答</span>
          <button className="px-2 py-1 rounded border border-zinc-200 bg-white text-zinc-600 inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> 手動追加
          </button>
          <button className="px-2 py-1 rounded border border-zinc-200 bg-white text-zinc-600 inline-flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> 全削除
          </button>
          <span className="ml-auto text-zinc-500">3件 / 1名</span>
        </div>

        {/* Other student (collapsed) */}
        <div className="rounded-lg bg-white border border-zinc-200 mb-2 px-3 py-2 flex items-center gap-2 text-[11px] opacity-60">
          <ChevronRight className="w-3 h-3 text-zinc-400" />
          <User className="w-3.5 h-3.5 text-zinc-500" />
          <span className="font-medium text-zinc-700">佐藤 花子</span>
          <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-100 text-zinc-600">高3</span>
          <span className="text-[9px] text-zinc-500 ml-auto">問2 解1</span>
        </div>

        {/* Target student card (matches actual structure: header / 問題 group / 解答 group) */}
        <div
          className="rounded-lg bg-white border-2 transition-all"
          style={{
            borderColor: cursorOnButton || buttonClicked ? "rgb(244 115 22)" : "rgb(228 228 231)",
            boxShadow: cursorOnButton || buttonClicked ? "0 0 0 4px rgba(244,115,22,0.10)" : "",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100">
            <ChevronDown className="w-3 h-3 text-zinc-400" />
            <User className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-[12px] font-semibold text-zinc-900">{STUDENT.name}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-600">{STUDENT.grade}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">問2</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">解1</span>
            <button className="ml-auto text-[10px] px-2 py-1 rounded text-rose-600 inline-flex items-center gap-1 hover:bg-rose-50">
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
              {sending ? "結合中..." : completed ? "完了" : "印刷"}
              {buttonClicked && (
                <span className="absolute -inset-1 rounded ring-4 ring-orange-300 animate-ping" />
              )}
            </button>
          </div>

          {/* 問題 section (blue) */}
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-blue-50/50 text-zinc-600 text-[9px] font-medium">
                <td className="px-3 py-1 w-8"></td>
                <td className="px-3 py-1">教材</td>
                <td className="px-3 py-1">範囲</td>
                <td className="px-3 py-1 w-20">種類</td>
                <td className="px-3 py-1 w-16 text-right"></td>
              </tr>
            </thead>
            <tbody>
              {[
                { mat: "システム英単語", node: "601-700", type: "問題" },
                { mat: NEW_MATERIAL, node: "101-200", type: "問題" },
              ].map((row, i) => (
                <PrintRow key={i} row={row} state={completed ? "done" : sending ? "sending" : "pending"} />
              ))}
            </tbody>
          </table>

          {/* 解答 section (amber) */}
          <div className="bg-amber-50/50 px-3 py-1 border-y border-amber-100 text-[9px] font-medium text-amber-700">
            解答 1件
          </div>
          <table className="w-full text-[11px]">
            <tbody>
              <PrintRow
                row={{ mat: "システム英単語", node: "601-700", type: "解答" }}
                state={completed ? "done" : sending ? "sending" : "pending"}
              />
            </tbody>
          </table>
        </div>

        {progress > 0.1 && progress < 0.5 && (
          <div
            className="absolute pointer-events-none"
            style={{
              right: `${20 - Math.min(0.95, progress * 1.6) * 12}%`,
              top: `${28 + Math.min(0.95, progress * 1.6) * 4}%`,
              transition: "all 1.2s cubic-bezier(0.4,0,0.2,1)",
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
              <span className="text-[11px] font-semibold text-zinc-800">PDFを結合中... (3件)</span>
              <span className="ml-auto text-[10px] text-zinc-500">新しいタブで開きます</span>
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
  state,
}: {
  row: { mat: string; node: string; type: string };
  state: "pending" | "sending" | "done";
}) {
  return (
    <tr className="border-t border-zinc-100">
      <td className="px-3 py-1.5 w-8">
        {state === "done" ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        ) : state === "sending" ? (
          <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
        ) : (
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
        )}
      </td>
      <td className="px-3 py-1.5 text-zinc-800 font-medium truncate max-w-[160px]">{row.mat}</td>
      <td className="px-3 py-1.5 text-zinc-600 truncate max-w-[120px]">{row.node}</td>
      <td className="px-3 py-1.5">
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded border ${
            row.type === "問題"
              ? "bg-white border-blue-200 text-blue-700"
              : "bg-amber-100 border-amber-200 text-amber-800"
          }`}
        >
          {row.type}
        </span>
      </td>
      <td className="px-3 py-1.5 text-right">
        <Eye className="w-3 h-3 text-zinc-400 inline mr-1" />
        <Trash2 className="w-3 h-3 text-zinc-400 inline" />
      </td>
    </tr>
  );
}

/* ============================================================
   Spreadsheet shared cells
   ============================================================ */
function SsRow({
  label,
  labelClass,
  children,
}: {
  label: string;
  labelClass: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid border-b border-zinc-100 last:border-b-0"
      style={{ gridTemplateColumns: "80px repeat(3, 1fr)" }}
    >
      <div className={`px-2 py-1.5 text-[10px] font-semibold flex items-center ${labelClass}`}>
        {label}
      </div>
      {children}
    </div>
  );
}

function SsHeaderCell({
  name,
  color,
  highlight,
  subdued,
}: {
  name: string;
  color: "rose" | "blue" | "emerald";
  highlight?: boolean;
  subdued?: boolean;
}) {
  const bg =
    color === "rose"
      ? "bg-gradient-to-r from-rose-500 to-red-600"
      : color === "blue"
      ? "bg-gradient-to-r from-blue-500 to-indigo-600"
      : "bg-gradient-to-r from-emerald-500 to-green-600";
  return (
    <div
      className={`px-3 py-1.5 text-[11px] font-bold text-white text-center border-l border-white/20 ${bg} ${
        subdued ? "opacity-50" : ""
      }`}
      style={{
        boxShadow: highlight ? "inset 0 0 0 2px white, 0 0 0 2px rgb(244 63 94)" : "",
      }}
    >
      {name}
    </div>
  );
}

function SsCell({
  children,
  highlight,
  success,
  center,
}: {
  children: React.ReactNode;
  highlight?: boolean;
  success?: boolean;
  center?: boolean;
}) {
  return (
    <div
      className={`px-2 py-1.5 border-l border-zinc-100 transition-colors ${
        success ? "bg-emerald-50" : highlight ? "bg-orange-50/40 ring-1 ring-orange-300/40 ring-inset" : "bg-white"
      } ${center ? "text-center flex items-center justify-center" : ""}`}
    >
      {children}
    </div>
  );
}

function ScoreField({
  value,
  cursor,
}: {
  value: string | number;
  cursor?: boolean;
}) {
  return (
    <div className="text-[12px] tabular-nums font-semibold text-zinc-900 min-h-[18px]">
      {value === "" || value === 0 ? <span className="text-zinc-300 font-normal">—</span> : value}
      {cursor && <span className="inline-block w-px h-3.5 bg-zinc-900 ml-0.5 align-middle animate-pulse" />}
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
