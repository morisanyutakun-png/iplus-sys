"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Lock } from "lucide-react";

function IPlusLogo() {
  return (
    <svg width="40" height="40" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="login-logo-gradient" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="oklch(0.55 0.22 25)" />
          <stop offset="1" stopColor="oklch(0.3 0.08 20)" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="url(#login-logo-gradient)" />
      <text x="7" y="25" fontFamily="system-ui, -apple-system, sans-serif" fontSize="16" fontWeight="700" fill="white" letterSpacing="-0.5">
        i+
      </text>
    </svg>
  );
}

function LoginForm() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [silentRefreshing, setSilentRefreshing] = useState(true);

  // Attempt silent refresh on mount (handles page reload with valid refresh token)
  useEffect(() => {
    apiFetch("/api/auth/refresh", { method: "POST" })
      .then(() => {
        router.replace(from);
      })
      .catch(() => {
        setSilentRefreshing(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Already logged in
  useEffect(() => {
    if (!isLoading && user) {
      router.replace(from);
    }
  }, [user, isLoading, router, from]);

  if (silentRefreshing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">認証中...</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
      router.replace(from);
    } catch {
      toast.error("ユーザー名またはパスワードが正しくありません");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-8 shadow-premium">
        <div className="flex flex-col items-center gap-3">
          <IPlusLogo />
          <div className="text-center">
            <h1 className="text-xl font-bold">
              <span className="bg-gradient-to-r from-[oklch(0.55_0.22_25)] to-[oklch(0.3_0.08_20)] bg-clip-text text-transparent">
                iPlus
              </span>
              <span className="ml-1">Sys</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">ログインしてください</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="username">
              ユーザー名
            </label>
            <Input
              id="username"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              パスワード
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4 animate-pulse" />
                ログイン中...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                ログイン
              </span>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
