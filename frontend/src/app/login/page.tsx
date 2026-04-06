"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

// Declare Google Identity Services types
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              width?: number | string;
              text?: string;
              locale?: string;
            }
          ) => void;
        };
      };
    };
  }
}

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
  const { loginWithGoogle, user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";
  const buttonRef = useRef<HTMLDivElement>(null);

  const [silentRefreshing, setSilentRefreshing] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  // Attempt silent refresh on mount
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

  // Load Google Identity Services and render button
  useEffect(() => {
    if (silentRefreshing) return;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set");
      return;
    }

    const handleCredential = async (response: { credential: string }) => {
      setSigningIn(true);
      try {
        await loginWithGoogle(response.credential);
        router.replace(from);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("403")) {
          toast.error("このGoogleアカウントはアクセスが許可されていません");
        } else {
          toast.error("ログインに失敗しました");
        }
        setSigningIn(false);
      }
    };

    const initGoogle = () => {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        use_fedcm_for_prompt: true,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: "100%",
        text: "signin_with",
        locale: "ja",
      });
    };

    if (window.google) {
      initGoogle();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [silentRefreshing]);

  if (silentRefreshing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">認証中...</p>
      </div>
    );
  }

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
            <p className="text-sm text-muted-foreground mt-1">Googleアカウントでログイン</p>
          </div>
        </div>

        <div className="space-y-3">
          {signingIn ? (
            <div className="flex h-10 items-center justify-center text-sm text-muted-foreground">
              ログイン中...
            </div>
          ) : (
            <div ref={buttonRef} className="flex justify-center" />
          )}
          <p className="text-center text-[11px] text-muted-foreground">
            許可されたGoogleアカウントのみアクセスできます
          </p>
        </div>
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
