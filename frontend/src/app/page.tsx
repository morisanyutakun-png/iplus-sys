import Link from "next/link";
import { cookies } from "next/headers";
import {
  Sparkles,
  Printer,
  ArrowRight,
  CheckCircle2,
  Zap,
  Users,
  BookOpen,
  Clock,
  Eye,
  ShieldCheck,
  Smartphone,
  ChevronDown,
  ClipboardCheck,
} from "lucide-react";
import { DemoPlayer } from "@/components/landing/demo-player";

export default async function LandingPage() {
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(cookieStore.get("access_token")?.value);

  return (
    <div className="min-h-screen bg-white text-zinc-900 selection:bg-orange-200 selection:text-orange-900">
      {/* ============== NAV ============== */}
      <nav className="sticky top-0 z-50 backdrop-blur bg-white/70 border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              i+
            </div>
            <span className="font-bold tracking-tight">iPlus Sys</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <a href="#demo" className="hidden sm:inline text-zinc-600 hover:text-zinc-900 transition">
              デモ
            </a>
            <a href="#features" className="hidden sm:inline text-zinc-600 hover:text-zinc-900 transition">
              機能
            </a>
            <a href="#flow" className="hidden sm:inline text-zinc-600 hover:text-zinc-900 transition">
              使い方
            </a>
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="rounded-full px-3.5 py-1.5 bg-zinc-900 text-white font-medium text-xs sm:text-sm hover:bg-zinc-800 transition shadow-sm"
            >
              {isLoggedIn ? "ダッシュボードへ" : "ログイン"}
            </Link>
          </div>
        </div>
      </nav>

      {/* ============== HERO ============== */}
      <section className="relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-32 -right-20 w-96 h-96 rounded-full bg-gradient-to-br from-orange-200/40 to-red-200/40 blur-3xl" />
          <div className="absolute top-40 -left-20 w-96 h-96 rounded-full bg-gradient-to-tr from-amber-100/40 to-orange-100/40 blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-12 sm:pb-16">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 text-zinc-700 px-3 py-1 text-xs font-medium mb-6">
              <Sparkles className="w-3 h-3 text-orange-500" />
              <span>塾の運用支援ツール</span>
              <span className="text-zinc-400">·</span>
              <span className="text-zinc-500">2026 春</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.15]">
              塾の今が、<span className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">ひと目で</span>分かる。
              <br />
              <span className="text-zinc-900">ボタン1つで、</span>
              <br className="sm:hidden" />
              <span className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">明日の宿題が刷り上がる。</span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-zinc-600 leading-relaxed max-w-2xl mx-auto">
              生徒の進み具合を一覧でチェックしながら、次に渡す教材プリントが自動で出てくる。
              <br className="hidden sm:block" />
              今お使いの宿題管理スプレッドシートとも、そのままつながります。
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={isLoggedIn ? "/dashboard" : "/login"}
                className="group inline-flex items-center gap-2 rounded-full bg-zinc-900 text-white px-5 py-3 font-semibold text-sm shadow-xl hover:shadow-2xl transition-all hover:-translate-y-0.5"
              >
                {isLoggedIn ? "ダッシュボードを開く" : "Googleアカウントでログイン"}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center gap-2 rounded-full bg-white border border-zinc-200 text-zinc-800 px-5 py-3 font-medium text-sm hover:bg-zinc-50 transition"
              >
                <Eye className="w-4 h-4" />
                先に動きを見る
              </a>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                インストール不要
              </span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                ブラウザだけでOK
              </span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                許可制
              </span>
            </div>
          </div>

          {/* Scroll cue */}
          <div className="mt-12 flex justify-center">
            <a href="#demo" aria-label="デモへ" className="text-zinc-400 hover:text-zinc-600 transition">
              <ChevronDown className="w-5 h-5 animate-bounce" />
            </a>
          </div>
        </div>
      </section>

      {/* ============== DEMO ============== */}
      <section id="demo" className="relative py-12 sm:py-20 bg-gradient-to-b from-zinc-50 to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 text-orange-700 px-3 py-1 text-xs font-semibold mb-3">
              <Zap className="w-3 h-3" />
              ライブデモ
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              <span className="text-zinc-900">教材を作って、</span>
              <span className="text-zinc-900">入力して、</span>
              <br className="sm:hidden" />
              <span className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">この子だけ印刷。</span>
            </h2>
            <p className="mt-3 text-sm sm:text-base text-zinc-600 max-w-xl mx-auto">
              田中 太郎さんを例に、実際の画面そのままの流れを4ステップで再現しています。
              <br className="hidden sm:block" />
              下のボタンで停止・巻き戻しも可能です。
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <DemoPlayer />
          </div>
        </div>
      </section>

      {/* ============== FEATURES ============== */}
      <section id="features" className="py-12 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-zinc-900">
              できること、3つの柱。
            </h2>
            <p className="mt-3 text-sm sm:text-base text-zinc-600 max-w-xl mx-auto">
              塾の運用で「面倒だった」3つのことを、まとめて引き受けます。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <FeatureCard
              icon={<BookOpen className="w-5 h-5" />}
              accent="from-blue-500 to-blue-600"
              title="教材を1分で登録"
              points={[
                "教科ごとに色分けされた一覧",
                "1教材に章をいくつでも追加",
                "問題・解答・復習用のPDFを紐付け",
              ]}
            />
            <FeatureCard
              icon={<ClipboardCheck className="w-5 h-5" />}
              accent="from-orange-500 to-red-600"
              title="点数を入れたら、進む"
              points={[
                "エクセル感覚で「点数 / 満点」入力",
                "合格にチェックで次の章に自動進行",
                "60点未満が続くと赤フラグ",
              ]}
              highlight
            />
            <FeatureCard
              icon={<Printer className="w-5 h-5" />}
              accent="from-purple-500 to-purple-700"
              title="生徒ごとに印刷"
              points={[
                "生徒の行ごとに「印刷」ボタン",
                "問題と解答が1つのPDFに結合",
                "プリンタへそのまま送信",
              ]}
            />
          </div>
        </div>
      </section>

      {/* ============== STAT STRIP ============== */}
      <section className="py-10 sm:py-14 bg-zinc-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <Stat icon={<Users className="w-4 h-4" />} value="48名" label="生徒の管理" />
            <Stat icon={<BookOpen className="w-4 h-4" />} value="22冊" label="登録ずみ教材" />
            <Stat icon={<Clock className="w-4 h-4" />} value="〜30分" label="毎日の作業時短" />
            <Stat icon={<CheckCircle2 className="w-4 h-4" />} value="9画面" label="必要な機能ぜんぶ" />
          </div>
        </div>
      </section>

      {/* ============== FLOW ============== */}
      <section id="flow" className="py-12 sm:py-20 bg-gradient-to-b from-white to-zinc-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-zinc-900">
              使い方は、たったの4ステップ。
            </h2>
            <p className="mt-3 text-sm sm:text-base text-zinc-600 max-w-xl mx-auto">
              朝、塾長がやることはこれだけ。後はシステムが回します。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            <FlowStep n={1} title="教材を登録" desc="教材名と教科を入れて、章ごとにPDFを紐付け。" icon={<BookOpen className="w-5 h-5" />} />
            <FlowStep n={2} title="生徒に割り当て" desc="生徒の詳細画面でクリック1つ、教材をアサイン。" icon={<Users className="w-5 h-5" />} />
            <FlowStep n={3} title="点数を入力" desc="授業で採点した結果を点数で入れて「反映」。" icon={<ClipboardCheck className="w-5 h-5" />} highlight />
            <FlowStep n={4} title="その子だけ印刷" desc="生徒の行の「印刷」ボタンを押すだけ。" icon={<Printer className="w-5 h-5" />} />
          </div>
        </div>
      </section>

      {/* ============== TRUST BAR ============== */}
      <section className="py-10 sm:py-14 bg-white border-t border-zinc-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <TrustItem
              icon={<ShieldCheck className="w-5 h-5" />}
              title="許可制ログイン"
              desc="登録済みのGoogleアカウントだけが入れます。塾長と先生で権限を分けられます。"
            />
            <TrustItem
              icon={<Smartphone className="w-5 h-5" />}
              title="どの端末でも"
              desc="PC・iPad・スマホ、ブラウザがあればすぐ使えます。インストール不要。"
            />
            <TrustItem
              icon={<Zap className="w-5 h-5" />}
              title="クラウド保管"
              desc="データはインターネット上に。教室が停電しても大丈夫です。"
            />
          </div>
        </div>
      </section>

      {/* ============== CTA ============== */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-orange-950" />
        <div className="absolute inset-0 -z-10 opacity-30">
          <div className="absolute -top-20 right-10 w-72 h-72 rounded-full bg-orange-500/30 blur-3xl" />
          <div className="absolute bottom-10 left-10 w-72 h-72 rounded-full bg-red-500/20 blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center text-white">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            さっそく、開いてみてください。
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-300 max-w-xl mx-auto">
            ログインして数秒で、いつもの塾の景色が「ホーム画面」として現れます。
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="group inline-flex items-center gap-2 rounded-full bg-white text-zinc-900 px-6 py-3.5 font-semibold text-sm sm:text-base shadow-2xl hover:shadow-orange-500/30 transition-all hover:-translate-y-0.5"
            >
              {isLoggedIn ? "ダッシュボードを開く" : "Googleアカウントでログイン"}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#demo"
              className="text-sm text-zinc-300 hover:text-white transition inline-flex items-center gap-1.5"
            >
              <Eye className="w-4 h-4" />
              もう一度デモを見る
            </a>
          </div>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer className="py-8 bg-zinc-950 text-zinc-400 text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-[10px]">
              i+
            </div>
            <span>iPlus Sys</span>
            <span className="text-zinc-600">·</span>
            <span>塾の運用支援ツール</span>
          </div>
          <div className="text-zinc-500">© 2026 iPlus Sys</div>
        </div>
      </footer>
    </div>
  );
}

/* ============================ COMPONENTS ============================ */

function FeatureCard({
  icon,
  title,
  points,
  accent,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  points: string[];
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl p-6 transition-all hover:-translate-y-1 ${
        highlight
          ? "bg-gradient-to-br from-zinc-900 to-zinc-800 text-white shadow-2xl ring-1 ring-zinc-700"
          : "bg-white border border-zinc-200 shadow-sm hover:shadow-md"
      }`}
    >
      {highlight && (
        <span className="absolute -top-2 left-6 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-orange-500 to-red-600 text-white px-2 py-0.5 rounded-full shadow-md">
          目玉機能
        </span>
      )}
      <div
        className={`inline-flex w-10 h-10 rounded-xl items-center justify-center mb-4 text-white bg-gradient-to-br ${accent} shadow-md`}
      >
        {icon}
      </div>
      <h3 className={`text-lg font-bold mb-3 ${highlight ? "text-white" : "text-zinc-900"}`}>
        {title}
      </h3>
      <ul className="space-y-2 text-sm">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2">
            <CheckCircle2
              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                highlight ? "text-orange-400" : "text-emerald-500"
              }`}
            />
            <span className={highlight ? "text-zinc-200" : "text-zinc-700"}>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div>
      <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-orange-400 mb-2">
        {icon}
      </div>
      <div className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</div>
      <div className="text-xs text-zinc-400 mt-1">{label}</div>
    </div>
  );
}

function FlowStep({
  n,
  title,
  desc,
  icon,
  highlight,
}: {
  n: number;
  title: string;
  desc: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="relative">
      <div
        className={`relative rounded-2xl p-5 h-full transition-all ${
          highlight
            ? "bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-xl"
            : "bg-white border border-zinc-200 text-zinc-900 shadow-sm"
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`inline-flex w-8 h-8 rounded-full items-center justify-center text-sm font-bold ${
              highlight ? "bg-white text-orange-600" : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {n}
          </span>
          <span className={highlight ? "text-white/90" : "text-zinc-500"}>{icon}</span>
        </div>
        <h3 className={`font-bold text-base mb-1 ${highlight ? "text-white" : "text-zinc-900"}`}>
          {title}
        </h3>
        <p className={`text-xs leading-relaxed ${highlight ? "text-white/85" : "text-zinc-600"}`}>
          {desc}
        </p>
      </div>
    </div>
  );
}

function TrustItem({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-zinc-900 text-white inline-flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-semibold text-sm text-zinc-900 mb-1">{title}</div>
        <div className="text-xs text-zinc-600 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}
