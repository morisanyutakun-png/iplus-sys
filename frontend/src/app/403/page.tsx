import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center flex-col gap-4 bg-background">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-muted-foreground">403</h1>
        <h2 className="text-xl font-semibold">アクセス権限がありません</h2>
        <p className="text-sm text-muted-foreground">
          このページにアクセスする権限がありません。
        </p>
      </div>
      <Link
        href="/students"
        className="text-sm text-primary underline underline-offset-4 hover:opacity-80"
      >
        生徒ページに戻る
      </Link>
    </div>
  );
}
