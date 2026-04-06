"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export type UserRole = "admin" | "trainer";

export interface AuthUser {
  id: number;
  username: string;
  google_email: string | null;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async (): Promise<AuthUser | null> => {
    try {
      return await apiFetch<AuthUser>("/api/auth/me");
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    fetchMe().then((u) => {
      setUser(u);
      setIsLoading(false);
    });
  }, [fetchMe]);

  const loginWithGoogle = async (credential: string) => {
    const me = await apiFetch<AuthUser>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    });
    setUser(me);
  };

  const logout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
